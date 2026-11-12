mod grammar;

use std::env;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};
use tauri_plugin_dialog::{DialogExt, FilePath};

#[derive(Serialize)]
struct FileData {
    path: String,
    content: String,
}

// ==================== 配置（config.json，与 exe 同目录） ====================
#[derive(Serialize, Deserialize, Clone)]
pub struct AppConfig {
    #[serde(default = "default_theme")]
    pub theme: String,
}

fn default_theme() -> String {
    "system".to_string()
}

impl Default for AppConfig {
    fn default() -> Self {
        Self { theme: default_theme() }
    }
}

fn get_config_path() -> Result<PathBuf, String> {
    let exe = env::current_exe().map_err(|e| format!("无法获取程序路径: {}", e))?;
    let dir = exe.parent().ok_or_else(|| "无法获取程序所在目录".to_string())?;
    Ok(dir.join("config.json"))
}

#[tauri::command]
fn load_config() -> Result<AppConfig, String> {
    let path = get_config_path()?;
    if !path.exists() {
        return Ok(AppConfig::default());
    }
    let content = fs::read_to_string(&path).map_err(|e| format!("读取配置失败: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("解析配置失败: {}", e))
}

#[tauri::command]
fn save_config(config: AppConfig) -> Result<(), String> {
    let path = get_config_path()?;
    let content =
        serde_json::to_string_pretty(&config).map_err(|e| format!("序列化配置失败: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("写入配置失败: {}", e))
}

// ==================== 日志（logs/ 目录，与 exe 同目录） ====================
const MAX_LOGS: usize = 10;

struct LogState(Mutex<Option<PathBuf>>);

fn log_dir() -> Result<PathBuf, String> {
    let exe = env::current_exe().map_err(|e| format!("无法获取程序路径: {}", e))?;
    let dir = exe
        .parent()
        .ok_or_else(|| "无法获取程序所在目录".to_string())?
        .join("logs");
    fs::create_dir_all(&dir).map_err(|e| format!("创建日志目录失败: {}", e))?;
    Ok(dir)
}

fn create_new_log(dir: &PathBuf) -> Result<PathBuf, String> {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("获取时间失败: {}", e))?
        .as_millis();
    let path = dir.join(format!("app_{}.log", now_ms));
    let header = format!(
        "=== Markdown Looker Log ===\nCreated: {}\n\n",
        now_ms
    );
    fs::write(&path, header).map_err(|e| format!("创建日志文件失败: {}", e))?;
    Ok(path)
}

fn cleanup_old_logs(dir: &PathBuf) {
    let entries: Vec<PathBuf> = match fs::read_dir(dir) {
        Ok(rd) => rd
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| p.extension().map_or(false, |x| x == "log"))
            .collect(),
        Err(_) => return,
    };

    if entries.len() <= MAX_LOGS {
        return;
    }

    // 文件名含时间戳，字典序即时间序
    let mut sorted = entries;
    sorted.sort();
    let to_remove = sorted.len() - MAX_LOGS;
    for path in sorted.iter().take(to_remove) {
        let _ = fs::remove_file(path);
    }
}

fn init_log() -> Result<PathBuf, String> {
    let dir = log_dir()?;
    let log_path = create_new_log(&dir)?;
    cleanup_old_logs(&dir);
    Ok(log_path)
}

#[tauri::command]
fn append_log(message: String, state: tauri::State<LogState>) -> Result<(), String> {
    let guard = state.0.lock().map_err(|e| format!("锁失败: {}", e))?;
    if let Some(path) = guard.as_ref() {
        let mut file = OpenOptions::new()
            .append(true)
            .create(true)
            .open(path)
            .map_err(|e| format!("打开日志失败: {}", e))?;
        writeln!(file, "{}", message).map_err(|e| format!("写日志失败: {}", e))?;
    }
    Ok(())
}

// ==================== 文件读写 ====================
#[tauri::command]
fn get_initial_file() -> Option<FileData> {
    let args: Vec<String> = env::args().collect();
    if args.len() > 1 {
        let path = &args[1];
        if path.ends_with(".md") || path.ends_with(".markdown") || path.ends_with(".txt") {
            if let Ok(content) = fs::read_to_string(path) {
                return Some(FileData { path: path.clone(), content });
            }
        }
    }
    None
}

#[tauri::command]
fn read_file(path: String) -> Result<FileData, String> {
    match fs::read_to_string(&path) {
        Ok(content) => Ok(FileData { path, content }),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn save_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())
}

/// 把 dialog 插件返回的 FilePath 转成路径字符串。
/// FilePath 是枚举：Path(PathBuf) 或 Url(Url)。
fn file_path_to_string(file_path: FilePath) -> String {
    match file_path {
        FilePath::Path(p) => p.to_string_lossy().to_string(),
        FilePath::Url(u) => u.to_string(),
    }
}

#[tauri::command]
async fn open_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    // 链式调用：add_filter 消费 self 并返回 Self
    let file_path = app
        .dialog()
        .file()
        .add_filter("Markdown", &["md", "markdown", "txt"])
        .blocking_pick_file();

    Ok(file_path.map(file_path_to_string))
}

#[tauri::command]
async fn save_dialog(
    app: tauri::AppHandle,
    default_name: Option<String>,
) -> Result<Option<String>, String> {
    // add_filter 返回 Self，重新绑定后再继续调用 set_file_name
    let mut dialog = app
        .dialog()
        .file()
        .add_filter("Markdown", &["md", "markdown"]);

    if let Some(name) = default_name {
        dialog = dialog.set_file_name(name);
    }

    let file_path = dialog.blocking_save_file();
    Ok(file_path.map(file_path_to_string))
}

// ==================== 入口 ====================
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if argv.len() > 1 {
                let path = &argv[1];
                if path.ends_with(".md") || path.ends_with(".markdown") || path.ends_with(".txt") {
                    let _ = app.emit("new-file-opened", path.clone());
                }
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                if let Some(icon) = app.default_window_icon() {
                    let _ = window.set_icon(icon.clone());
                }
            }

            match init_log() {
                Ok(path) => {
                    eprintln!("[log] 日志文件: {}", path.display());
                    app.manage(LogState(Mutex::new(Some(path))));
                }
                Err(e) => {
                    eprintln!("[log] 初始化日志失败: {}", e);
                    app.manage(LogState(Mutex::new(None)));
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_initial_file,
            read_file,
            save_file,
            open_dialog,
            save_dialog,
            load_config,
            save_config,
            append_log,
            grammar::read_lang_grammar
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}