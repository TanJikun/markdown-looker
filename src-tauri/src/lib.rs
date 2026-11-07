use std::env;
use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};

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
        Self {
            theme: default_theme(),
        }
    }
}

fn get_config_path() -> Result<PathBuf, String> {
    let exe = env::current_exe().map_err(|e| format!("无法获取程序路径: {}", e))?;
    let dir = exe
        .parent()
        .ok_or_else(|| "无法获取程序所在目录".to_string())?;
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

// ==================== 文件读写 ====================
#[tauri::command]
fn get_initial_file() -> Option<FileData> {
    let args: Vec<String> = env::args().collect();
    if args.len() > 1 {
        let path = &args[1];
        if path.ends_with(".md") || path.ends_with(".markdown") || path.ends_with(".txt") {
            if let Ok(content) = fs::read_to_string(path) {
                return Some(FileData {
                    path: path.clone(),
                    content,
                });
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

// ==================== 入口 ====================
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 1. 注册单实例插件
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
        // ★ 新增 setup：显式设置窗口图标（任务栏 + 标题栏左上角 + Alt+Tab）
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                // 从 bundle.icon 自动解析出的默认图标（Tauri v2 会取 .ico 最佳帧）
                if let Some(icon) = app.default_window_icon() {
                    if let Err(e) = window.set_icon(icon.clone()) {
                        eprintln!("[icon] 设置窗口图标失败: {}", e);
                    }
                } else {
                    eprintln!("[icon] default_window_icon 为空，请检查 tauri.conf.json 的 bundle.icon 是否包含 icons/icon.ico");
                }
            }
            Ok(())
        })
        // 2. 注册命令
        .invoke_handler(tauri::generate_handler![
            get_initial_file,
            read_file,
            save_file,
            load_config,
            save_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}