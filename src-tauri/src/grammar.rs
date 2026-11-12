//! 从 exe 同级目录加载额外语言的 TextMate grammar。
//!
//! 路径约定：<exe目录>/langs/<lang>.tmLanguage.json
//! 找不到文件时返回 Err，前端捕获后回退纯文本。

use std::fs;
use std::path::PathBuf;
use tauri::Manager;

/// 读取 exe 同级 langs/<lang>.tmLanguage.json 的文本内容。
#[tauri::command]
pub fn read_lang_grammar(app: tauri::AppHandle, lang: String) -> Result<String, String> {
    // 白名单：只允许字母数字、连字符和下划线，防止路径穿越。
    if lang.is_empty()
        || !lang
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(format!("invalid language id: {lang}"));
    }

    let file_name = format!("{lang}.tmLanguage.json");

    let mut candidates: Vec<PathBuf> = Vec::new();

    // 1) Tauri 的资源目录（Windows/Linux 下通常就是 exe 目录）
    if let Ok(dir) = app.path().resource_dir() {
        candidates.push(dir.join("langs").join(&file_name));
    }

    // 2) fallback: 当前可执行文件所在目录
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            candidates.push(exe_dir.join("langs").join(&file_name));
        }
    }

    for path in candidates {
        if path.is_file() {
            return fs::read_to_string(&path)
                .map_err(|e| format!("read {:?} failed: {e}", path));
        }
    }

    Err(format!("grammar not found for language: {lang}"))
}