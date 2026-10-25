# Markdown Looker

> 一款完全复刻 GitHub 渲染效果的轻量级本地 Markdown 桌面编辑器。

[![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB?logo=tauri&logoColor=white)](https://tauri.app/)[![Rust](https://img.shields.io/badge/Rust-1.70+-000000?logo=rust&logoColor=white)](https://www.rust-lang.org/)[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## 📖 为什么做这个项目？

如果你用过市面上主流的 Markdown 编辑器（如 MarkText 等），你可能会遇到以下痛点：
1. 对 `GFM (GitHub Flavored Markdown)` 支持不完善，尤其是 `<details>` 折叠块内部包含空行时，经常被错误地识别为代码块。
2. 很多宣称“GitHub 风格”的编辑器底层使用的是 `markdown-it` 或 `remark`，渲染结果与原生 GitHub 存在肉眼可见的差异。
3. 强制引入在线 CDN 进行代码高亮，导致断网时体验极差。

**Markdown Looker** 正是为了解决这些问题而生。它抛弃了第三方重型框架，采用原生前端结合 **Comrak (编译为 WASM)** 解析引擎，为你提供 1:1 最纯粹的 GitHub 阅读与写作体验。

## ✨ 核心特性

- **100% 完美还原 GitHub 渲染**：完美支持 GFM 警告块（Alerts）、表格、任务列表，尤其是原汁原味的 `<details>` 折叠块解析。
- **完全离线 & 零 CDN**：核心解析器 `comrak.wasm` 已随仓库打包，无需任何网络请求，断网也能完美运行。
- **极速双栏同步滚动**：基于 `postMessage` 与 `requestAnimationFrame` 深度优化，左右拖拽如丝般顺滑，绝无卡顿感。
- **原生桌面级体验**：
  - 支持多标签页管理（Tab System）。
  - 单实例运行：双击多个 `.md` 文件时，在现有窗口新建标签页，不重复启动进程。
  - 防误触机制：关闭含有未保存修改的标签页时，自动弹出拦截提示。
- **深色模式**：整体 UI 与预览区采用 GitHub Dark 主题，沉浸式写作。

## 🛠️ 技术栈

- **框架**: [Tauri 2](https://tauri.app/) (Rust) - 极小体积，极低内存占用。
- **核心解析器**: [Comrak](https://github.com/kivikakk/comrak) (WASM) - 基于 GitHub 官方 `cmark-gfm` 的 Rust 移植版。
- **前端**: Vanilla JavaScript / HTML5 / CSS3 - 纯手写，无前端框架依赖，运行极快。

## 🚀 快速开始

### 1. 环境准备
请确保你的电脑上安装了以下工具：
- [Node.js](https://nodejs.org/) (v16+)
- [Rust](https://www.rust-lang.org/tools/install) (`rustup` 默认配置即可)
- [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (Windows 用户必须勾选“使用 C++ 的桌面开发”)

### 2. 克隆项目
```bash
git clone https://github.com/你的用户名/markdown-looker.git
cd markdown-looker
```

*(注：本项目已内置离线解析器 `src/comrak`，无需额外下载依赖。)*

### 3. 开发调试
```bash
# 全局安装 Tauri CLI（如果尚未安装）
npm install -g @tauri-apps/cli

# 启动开发服务器
tauri dev
```

### 4. 打包发布
```bash
tauri build
```
编译完成后，你的独立可执行文件 `.exe` 将生成在 `src-tauri/target/release/` 目录下，直接双击即可使用。

## 📂 项目结构
```text
markdown-looker/
├── src/                  # 前端源码目录
│   ├── index.html        # 主界面（UI、样式、JS 逻辑均在此）
│   └── comrak/           # 离线 Comrak WASM 解析器包
├── src-tauri/            # Tauri Rust 后端
│   ├── src/lib.rs        # Rust 核心逻辑（单实例拦截、文件读写）
│   ├── Cargo.toml        # Rust 依赖配置
│   └── tauri.conf.json   # Tauri 全局配置文件
└── README.md
```

## 🤝 贡献与反馈
欢迎提出 Issue 或提交 Pull Request。如果你觉得这个项目对你有帮助，请给一个 ⭐️ Star 支持一下！

## 📄 开源协议
本项目基于 [MIT License](LICENSE) 开源。
项目内部集成的 `comrak` 解析器基于 [BSD-2-Clause License](https://github.com/kivikakk/comrak/blob/main/COPYING) 开源。