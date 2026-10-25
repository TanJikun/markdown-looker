use std::env;
use std::fs;
use serde::Serialize;
use tauri::{Emitter, Manager};

#[derive(Serialize)]
struct FileData {
    path: String,
    content: String,
}

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 1. 注册单实例插件
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // 当用户双击第二个文件时，会触发这里
            if argv.len() > 1 {
                let path = &argv[1];
                if path.ends_with(".md") || path.ends_with(".markdown") || path.ends_with(".txt") {
                    // 把文件路径发给前端（触发新建标签页）
                    let _ = app.emit("new-file-opened", path.clone());
                }
            }
            // 将窗口带到前台
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![get_initial_file, read_file, save_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}