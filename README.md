## Markdown Looker

一个极简、优雅、且拥有**极致丝滑左右双向滚动同步**的本地 Markdown 桌面编辑器。

基于 Tauri + Vite + 原生前端技术栈构建，拥有极低的内存占用和原生的性能体验。

## 核心特性

- **极致丝滑的滚动同步**：移植并重构了 [markups](https://github.com/Nir-Bhay/markups) 的源码行号（`data-source-line`）锚点映射算法，无论快速拖拽还是慢速滚动，左右两侧都能完美对齐，告别滚轮漂移。
- **强大的编辑器底座**：左侧采用 VS Code 同款的 **Monaco Editor**，提供顶级的 Markdown 语法高亮和编辑体验。
- **全功能渲染支持**：
  - 支持 **Mermaid** 流程图/时序图渲染，支持“一键复制代码”和“全屏查看”。
  - 支持 **KaTeX** 数学公式渲染（`$ ... $` 与 `$$ ... $$`）。
  - 支持 **Shiki** 代码块语法高亮，深浅主题切换零重新渲染，代码块右上角自带“一键复制”按钮。
  - 支持 GitHub 风格的 Alert 警告块（NOTE, TIP, WARNING 等）。
- **轻量级代码高亮**：
  - 内置 8 种常用语言（Java、C、C++、Python、Rust、JavaScript、HTML、CSS、Markdown），打包进主程序，首屏零闪烁。
  - 其余语言通过 `langs/` 目录按需加载，按实际使用选择性放入语法文件，不占打包体积。
- **轻量级桌面应用**：打包生成的 `.exe` 体积小巧，启动迅速，原生支持文件关联（双击 `.md` 文件直接打开）。
- **多标签页与主题**：支持多文件标签切换，支持深色/浅色主题切换，并自动记忆。

## 技术栈

本项目采用前后端分离的现代化桌面开发架构：

### 前端 (Frontend)
- **构建工具**: [Vite](https://vitejs.dev/) (极致的前端构建体验)
- **核心语言**: 原生 JavaScript (ES Modules)
- **编辑器引擎**: [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- **Markdown 解析**:
  - [Marked](https://marked.js.org/) (核心解析器)
  - `marked-katex-extension` (数学公式扩展)
  - `marked-alert` (GitHub 警告块扩展)
  - `marked-footnote` (脚注扩展)
- **图表与公式**: [Mermaid](https://mermaid.js.org/) & [KaTeX](https://katex.org/)
- **代码高亮**: [Shiki](https://shiki.style/) (基于 TextMate 语法的精确高亮，支持深浅双主题)
- **安全过滤**: [DOMPurify](https://github.com/cure53/DOMPurify) (防止 XSS 注入)
- **UI 样式**: 原生 CSS 变量 (支持深色/浅色主题无缝切换)

### 后端与打包 (Backend & Bundler)
- **桌面框架**: [Tauri (v2)](https://tauri.app/)
- **后端语言**: [Rust](https://www.rust-lang.org/)
- **系统交互**: 通过 Tauri IPC 实现原生的文件读写、系统对话框调用、窗口主题控制，以及额外语言语法文件的按需读取。

## 项目结构

```text
markdown-looker/
├── src/                          # 前端源码目录
│   ├── core/                     # 核心逻辑
│   │   ├── scroll-sync.js        # 双向滚动同步核心算法
│   │   ├── source-lines.js       # Markdown 块级行号锚点提取
│   │   ├── sanitize.js           # HTML 安全过滤
│   │   ├── debounce.js           # 性能防抖
│   │   ├── eventBus.js           # 事件总线
│   │   └── shiki-highlighter.js  # Shiki 高亮器（内置语言 + 额外语言按需加载）
│   ├── main.js                   # 应用入口，串联 Monaco 与 Markdown 渲染
│   └── style.css                 # 全局 UI 与 Markdown 渲染样式
├── src-tauri/                    # Tauri (Rust) 后端目录
│   ├── src/                      # Rust 源码
│   │   ├── lib.rs                # 入口与命令注册
│   │   └── grammar.rs            # 从 exe 同级 langs/ 读取语法文件
│   ├── Cargo.toml                # Rust 依赖配置
│   └── tauri.conf.json           # Tauri 应用配置
├── index.html                    # 主页面 HTML 骨架
├── package.json                  # 前端依赖与脚本
├── vite.config.js                # Vite 配置
└── build.bat                     # Windows 一键编译打包脚本
```

打包完成后，如果希望启用额外语言高亮，需要在 exe 同级目录创建 `langs/` 文件夹（详见下文「代码高亮与额外语言」）：

```text
markdown-looker.exe
langs/
  go.tmLanguage.json
  ruby.tmLanguage.json
  bash.tmLanguage.json
  ...
```

## 开发与构建

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

## 代码高亮与额外语言

代码块高亮基于 [Shiki](https://shiki.style/)，采用 **"内置核心 + 按需扩展"** 的策略：

- **内置语言**（Java、C、C++、Python、Rust、JavaScript、HTML、CSS、Markdown）已在构建时静态导入，无需任何配置，开箱即用。
- **其他语言** 需要在 exe 同级目录放置对应的 TextMate 语法文件（`.tmLanguage.json`）。文件存在则自动加载高亮；文件缺失、损坏或格式错误时，该语言的代码块会静默回退为纯文本，不会报错、不会崩溃。

### 一、语法文件从哪里获取

语法文件的官方来源是 [shikijs/textmate-grammars-themes](https://github.com/shikijs/textmate-grammars-themes) 仓库，也可以从 npm 包 `tm-grammars` 中获取，两者内容一致。

#### 方式一：通过 npm 包获取（推荐）

```bash
npm install tm-grammars --no-save
```

安装后，在 `node_modules/tm-grammars/grammars/` 目录下即可找到所有语言的 `.json` 文件，例如 `go.json`、`ruby.json`、`shellscript.json`、`yaml.json`。

> `--no-save` 表示临时下载，不写入 `package.json`，只用于手动提取文件。

#### 方式二：从 GitHub 直接下载

仓库中语法文件所在的实际路径是：

```
https://github.com/shikijs/textmate-grammars-themes/tree/main/packages/tm-grammars/grammars
```

以 Go 语言为例，Raw 文件地址为：

```
https://raw.githubusercontent.com/shikijs/textmate-grammars-themes/main/packages/tm-grammars/grammars/go.json
```

打开对应的 Raw 页面后，右键「另存为」即可下载。

#### 方式三：从 VS Code 源码提取

`tm-grammars` 中的语法多数源自 VS Code，也可直接从 `microsoft/vscode` 仓库对应语言扩展的 `syntaxes/` 目录获取原始 `.tmLanguage.json` 文件，格式完全兼容。

### 二、文件放置与命名规则

将下载的文件放入 **exe 同级目录下的 `langs/` 文件夹**，并重命名为 `<语言标记>.tmLanguage.json` 格式。文件名中的 `<语言标记>` 必须与 Markdown 代码块中 ` ``` ` 后写的语言名一致。

| Markdown 中写法 | 源文件名 | 放入 `langs/` 后重命名为 |
| :--- | :--- | :--- |
| ` ```go ` | `go.json` | `go.tmLanguage.json` |
| ` ```ruby ` | `ruby.json` | `ruby.tmLanguage.json` |
| ` ```bash ` | `shellscript.json` | `bash.tmLanguage.json` |
| ` ```json ` | `json.json` | `json.tmLanguage.json` |
| ` ```yaml ` | `yaml.json` | `yaml.tmLanguage.json` |

注意：`bash` 在 `tm-grammars` 中的原始文件名是 `shellscript.json`，需要特别留意重命名。

### 三、常见别名

Shiki 高亮器内置了一张别名映射表，以下写法可直接识别为对应语言，无需重复放置语法文件：

| Markdown 中写法 | 实际加载语言 |
| :--- | :--- |
| `js` | `javascript` |
| `py` | `python` |
| `md` | `markdown` |
| `c++` / `cxx` | `cpp` |
| `h` | `c` |
| `hpp` | `cpp` |
| `sh` / `shell` | `bash` |
| `htm` | `html` |

### 四、行为说明

| 场景 | 行为 |
| :--- | :--- |
| 内置 8 种语言 | 首帧高亮，零闪烁 |
| 额外语言，`langs/` 存在对应文件 | 首帧纯文本，文件读取完成后替换为高亮 |
| 额外语言，`langs/` 缺失文件 | 永久纯文本，不报错 |
| 额外语言，JSON 损坏或格式不合法 | 永久纯文本，控制台输出警告 |
| 浏览器环境（`npm run dev`） | 仅内置 8 种语言高亮，额外语言全部回退纯文本 |
| 深浅主题切换 | 不重新高亮，仅通过 CSS 变量切换颜色 |

## 致谢

- 感谢 [Nir-Bhay/markups](https://github.com/Nir-Bhay/markups) 项目提供的完美滚动同步解决方案（`scroll-sync` 及 `source-lines` 逻辑），本项目在此基础上进行了深度适配与重构。
- 感谢 [Shiki](https://shiki.style/) 与 [textmate-grammars-themes](https://github.com/shikijs/textmate-grammars-themes) 提供的高质量语法与主题资源。

## License

MIT License