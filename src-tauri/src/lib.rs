mod grammar;

use std::env;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
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
    #[serde(default = "default_settings_window_ratio")]
    pub settings_window_ratio: f64,

    // === 插入图片行为 ===
    #[serde(default = "default_insert_mode")]
    pub insert_image_mode: String, // "local" | "cloud"

    // 本地配置
    #[serde(default = "default_local_save_mode")]
    pub local_image_save_mode: String, // "fixed" | "same_dir" | "sub_dir"
    #[serde(default)]
    pub local_fixed_dir: String,       // 当 save_mode == "fixed" 时使用
    #[serde(default = "default_local_sub_dir_mode")]
    pub local_sub_dir_mode: String,    // "shared"(.image) | "independent"(同名文件夹)

    // 云端配置
    #[serde(default = "default_cloud_provider")]
    pub cloud_provider: String,        // 目前仅 "picnexus"
    #[serde(default)]
    pub picnexus_path: Option<String>, // PicNexus 位置
    #[serde(default)]
    pub picnexus_bed: String,          // PicNexus 支持的图床（命令行参数）
}

fn default_theme() -> String { "system".to_string() }
fn default_settings_window_ratio() -> f64 { 0.8 }
fn default_insert_mode() -> String { "local".to_string() }
fn default_local_save_mode() -> String { "same_dir".to_string() }
fn default_local_sub_dir_mode() -> String { "shared".to_string() }
fn default_cloud_provider() -> String { "picnexus".to_string() }

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            settings_window_ratio: default_settings_window_ratio(),
            insert_image_mode: default_insert_mode(),
            local_image_save_mode: default_local_save_mode(),
            local_fixed_dir: "".to_string(),
            local_sub_dir_mode: default_local_sub_dir_mode(),
            cloud_provider: default_cloud_provider(),
            picnexus_path: None,
            picnexus_bed: "".to_string(),
        }
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

// ==================== PicNexus 路径与通用文件夹检测 ====================

/// 把用户输入或环境变量里的值，解析成真实的 PicNexus.exe 路径。
/// 规则：
/// - 如果是文件：检查扩展名是不是 .exe，是则直接返回。
/// - 如果是文件夹：**只看根目录**，寻找 PicNexus.exe，不递归子文件夹。
fn resolve_picnexus_path(raw: &str) -> Option<String> {
    let p = Path::new(raw.trim());
    if !p.exists() {
        return None;
    }

    if p.is_file() {
        let is_exe = p
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.eq_ignore_ascii_case("exe"))
            .unwrap_or(false);
        return if is_exe {
            Some(p.to_string_lossy().to_string())
        } else {
            None
        };
    }

    if p.is_dir() {
        // 只读根目录一层，不递归
        if let Ok(entries) = fs::read_dir(p) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_file() {
                    continue;
                }
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.eq_ignore_ascii_case("picnexus.exe") {
                        return Some(path.to_string_lossy().to_string());
                    }
                }
            }
        }
    }

    None
}

/// 遍历 PATH 的每一项，寻找 PicNexus.exe，找到第一个即返回。
#[tauri::command]
fn detect_picnexus_path() -> Option<String> {
    let path_var = env::var("PATH").ok()?;
    let separator = if cfg!(windows) { ';' } else { ':' };

    for dir in path_var.split(separator) {
        if dir.trim().is_empty() {
            continue;
        }
        if let Some(found) = resolve_picnexus_path(dir) {
            return Some(found);
        }
    }
    None
}

/// 校验用户手动输入/选择的路径是否有效。
#[tauri::command]
fn validate_picnexus_path(path: String) -> Option<String> {
    resolve_picnexus_path(&path)
}

/// 弹出文件夹选择框，让用户选择 PicNexus 所在目录，并校验。
#[tauri::command]
fn pick_picnexus_path(app: tauri::AppHandle) -> Option<String> {
    let folder = app.dialog().file().blocking_pick_folder();
    if let Some(fp) = folder {
        let path_str = file_path_to_string(fp);
        return resolve_picnexus_path(&path_str);
    }
    None
}

/// 通用文件夹选择框（用于“本地固定位置”）
#[tauri::command]
fn pick_folder(app: tauri::AppHandle) -> Option<String> {
    let folder = app.dialog().file().blocking_pick_folder();
    folder.map(file_path_to_string)
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
fn file_path_to_string(file_path: FilePath) -> String {
    match file_path {
        FilePath::Path(p) => p.to_string_lossy().to_string(),
        FilePath::Url(u) => u.to_string(),
    }
}

#[tauri::command]
async fn open_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
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
            grammar::read_lang_grammar,
            detect_picnexus_path,
            validate_picnexus_path,
            pick_picnexus_path,
            pick_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}