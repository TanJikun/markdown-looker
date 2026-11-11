# Markdown Looker

一个极简、优雅、且拥有**极致丝滑左右双向滚动同步**的本地 Markdown 桌面编辑器。

基于 Tauri + Vite + 原生前端技术栈构建，拥有极低的内存占用和原生的性能体验。

## ✨ 核心特性

- **极致丝滑的滚动同步**：移植并重构了 [markups](https://github.com/Nir-Bhay/markups) 的源码行号（`data-source-line`）锚点映射算法，无论快速拖拽还是慢速滚动，左右两侧都能完美对齐，告别滚轮漂移。
- **强大的编辑器底座**：左侧采用 VS Code 同款的 **Monaco Editor**，提供顶级的 Markdown 语法高亮和编辑体验。
- **全功能渲染支持**：
  - 支持 **Mermaid** 流程图/时序图渲染，支持“一键复制代码”和“全屏查看”。
  - 支持 **KaTeX** 数学公式渲染（`$ ... $` 与 `$$ ... $$`）。
  - 支持 **Prism.js** 代码块高亮，代码块右上角自带“一键复制”按钮。
  - 支持 GitHub 风格的 Alert 警告块（NOTE, TIP, WARNING 等）。
- **轻量级桌面应用**：打包生成的 `.exe` 体积小巧，启动迅速，原生支持文件关联（双击 `.md` 文件直接打开）。
- **多标签页与主题**：支持多文件标签切换，支持深色/浅色主题切换，并自动记忆。

## 🛠️ 技术栈

本项目采用前后端分离的现代化桌面开发架构：

### 前端 (Frontend)
- **构建工具**: [Vite](https://vitejs.dev/) (极致的前端构建体验)
- **核心语言**: 原生 JavaScript (ES Modules)
- **编辑器引擎**: [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- **Markdown 解析**:
  - [Marked](https://marked.js.org/) (核心解析器)
  - `marked-highlight` (代码高亮扩展)
  - `marked-katex-extension` (数学公式扩展)
  - `marked-alert` (GitHub 警告块扩展)
  - `marked-footnote` (脚注扩展)
- **图表与公式**: [Mermaid](https://mermaid.js.org/) & [KaTeX](https://katex.org/)
- **代码高亮**: [Prism.js](https://prismjs.com/)
- **安全过滤**: [DOMPurify](https://github.com/cure53/DOMPurify) (防止 XSS 注入)
- **UI 样式**: 原生 CSS 变量 (支持深色/浅色主题无缝切换)

### 后端与打包 (Backend & Bundler)
- **桌面框架**: [Tauri (v2)](https://tauri.app/) 
- **后端语言**: [Rust](https://www.rust-lang.org/)
- **系统交互**: 通过 Tauri IPC 实现原生的文件读写、系统对话框调用及窗口主题控制。

## 📂 项目结构

```text
markdown-looker/
├── src/                      # 前端源码目录
│   ├── core/                 # 核心逻辑
│   │   ├── scroll-sync.js    # 双向滚动同步核心算法
│   │   ├── source-lines.js   # Markdown 块级行号锚点提取
│   │   ├── sanitize.js       # HTML 安全过滤
│   │   ├── debounce.js       # 性能防抖
│   │   └── eventBus.js       # 事件总线
│   ├── main.js               # 应用入口，串联 Monaco 与 Markdown 渲染
│   └── style.css             # 全局 UI 与 Markdown 渲染样式
├── src-tauri/                # Tauri (Rust) 后端目录
│   ├── src/                  # Rust 源码
│   ├── Cargo.toml            # Rust 依赖配置
│   └── tauri.conf.json       # Tauri 应用配置
├── index.html                # 主页面 HTML 骨架
├── package.json              # 前端依赖与脚本
├── vite.config.js            # Vite 配置
└── build.bat                 # Windows 一键编译打包脚本
```

## 🚀 开发与构建

### 环境准备
请确保你已安装：
1. [Node.js](https://nodejs.org/) (推荐 v18+)
2. [Rust](https://www.rust-lang.org/tools/install) (通过 rustup 安装)
3. [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)

### 安装依赖
```bash
npm install
```

### 本地开发调试
```bash
# 启动纯前端浏览器预览 (推荐用于调试 UI 和同步逻辑)
npm run dev

# 启动 Tauri 桌面端热更新开发
npm run tauri dev
```

### 生产环境打包
你可以直接双击根目录下的 `build.bat` (Windows)，或者运行以下命令：
```bash
npm run tauri build
```
打包完成后，可执行文件将生成在 `src-tauri/target/release/` 目录下。

## 🙏 致谢

- 感谢 [Nir-Bhay/markups](https://github.com/Nir-Bhay/markups) 项目提供的完美滚动同步解决方案（`scroll-sync` 及 `source-lines` 逻辑），本项目在此基础上进行了深度适配与重构。

## 📄 License

MIT License