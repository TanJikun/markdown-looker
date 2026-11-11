import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution';

import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import { gfmHeadingId } from 'marked-gfm-heading-id';
import markedAlert from 'marked-alert';
import markedFootnote from 'marked-footnote';
import markedKatex from 'marked-katex-extension';
import Prism from 'prismjs';
import mermaid from 'mermaid';

import { scrollSync } from './core/scroll-sync.js';
import { annotateSourceLines } from './core/source-lines.js';
import { debounce } from './core/debounce.js';
import { sanitizePreviewHtml } from './core/sanitize.js';

import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'katex/dist/katex.min.css';

self.MonacoEnvironment = {
    getWorker() { return new editorWorker(); }
};

marked.use(
    markedHighlight({
        langPrefix: 'language-',
        highlight(code, lang) {
            const language = Prism.languages[lang] ? lang : 'plaintext';
            try {
                return Prism.highlight(code, Prism.languages[language], language);
            } catch (e) { return code; }
        }
    }),
    gfmHeadingId(),
    markedAlert(),
    markedFootnote(),
    markedKatex({ throwOnError: false }),
    { gfm: true, breaks: true }
);

mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' });

const isTauri = window.__TAURI__ !== undefined;
let invoke, listen;
if (isTauri) {
    invoke = window.__TAURI__.core.invoke;
    listen = window.__TAURI__.event.listen;
}

// 切换标签时 editor.setValue() 会触发 onDidChangeModelContent，
// 用这个标志抑制，避免把刚切过去的干净标签误标成 dirty。
let suppressContentChange = false;

const editor = monaco.editor.create(document.getElementById('editor-container'), {
    value: "# 欢迎使用\n左侧编辑，右侧同步预览。",
    language: 'markdown',
    theme: 'vs-dark',
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    scrollbar: { vertical: 'visible', horizontal: 'visible' },
    wordWrap: 'on',
    hover: { enabled: false },
    quickSuggestions: false,
    suggestOnTriggerCharacters: false,
    folding: false,
    lineNumbers: 'off',
    renderLineHighlight: 'line',
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    smoothScrolling: true,
    padding: { top: 24, bottom: 24, left: 16, right: 16 },
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: 15
});

const outputEl = document.getElementById('output');
const previewWrap = document.getElementById('preview');
const tabsContainer = document.getElementById('tabs-container');
const fallbackInput = document.getElementById('fallbackInput');

scrollSync.initialize(editor, previewWrap, { contentRoot: outputEl });
scrollSync.enable();

// =========================================================
// Monaco 滚轮平滑滚动
// WebView2 下 Monaco 自带的 smoothScrolling 对 wheel 基本不生效，
// 会导致"左栏滚 → 两栏瞬间到位"的生硬手感。这里拦截 wheel，
// 自己做指数缓动，滚动由 scroll-sync 逐帧同步到右栏，两栏一起变丝滑。
// =========================================================
const editorDom = editor.getDomNode();
let wheelTargetTop = null;
let wheelRaf = null;

const wheelTick = () => {
    const current = editor.getScrollTop();
    const target = wheelTargetTop ?? current;
    const diff = target - current;

    // 接近目标就吸附并结束
    if (Math.abs(diff) < 0.5) {
        editor.setScrollPosition(
            { scrollTop: target },
            monaco.editor.ScrollType.Immediate
        );
        wheelRaf = null;
        wheelTargetTop = null;
        return;
    }

    // 指数缓动：每帧逼近目标的 22%，约 150~200ms 到位
    editor.setScrollPosition(
        { scrollTop: current + diff * 0.22 },
        monaco.editor.ScrollType.Immediate
    );
    wheelRaf = requestAnimationFrame(wheelTick);
};

// 用 document 的捕获阶段监听，保证先于 Monaco 内部 wheel 处理器执行
document.addEventListener('wheel', (e) => {
    if (!editorDom || !editorDom.contains(e.target)) return;

    // 保留 Ctrl（缩放）、Shift（横向滚动）、Alt 等默认行为
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;

    e.preventDefault();
    e.stopPropagation();

    // 归一化 deltaY（像素 / 行 / 页）
    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 16;       // DOM_DELTA_LINE
    else if (e.deltaMode === 2) delta *= 100; // DOM_DELTA_PAGE

    const lineHeight =
        editor.getOption(monaco.editor.EditorOption.lineHeight) || 19;

    // 一格滚轮 ≈ 3 行（与 Monaco 默认手感一致）
    const scrollDelta = (delta / 100) * lineHeight * 3;

    const current = editor.getScrollTop();
    const max = Math.max(
        0,
        editor.getScrollHeight() - editor.getLayoutInfo().height
    );
    const base = wheelTargetTop ?? current;
    wheelTargetTop = Math.max(0, Math.min(max, base + scrollDelta));

    if (!wheelRaf) {
        wheelRaf = requestAnimationFrame(wheelTick);
    }
}, { capture: true, passive: false });

// --- Mermaid 全屏逻辑 ---
let mermaidFsOverlay = null;

function closeMermaidFullscreen() {
    if (mermaidFsOverlay) {
        mermaidFsOverlay.remove();
        mermaidFsOverlay = null;
    }
    // 与 showMermaidFullscreen 中注册的捕获阶段保持一致
    document.removeEventListener('keydown', mermaidFsEscHandler, true);
}

function mermaidFsEscHandler(e) {
    if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeMermaidFullscreen();
    }
}

function showMermaidFullscreen(svgHtml) {
    if (mermaidFsOverlay) closeMermaidFullscreen();

    const overlay = document.createElement('div');
    overlay.id = 'mermaid-fs-overlay';

    const content = document.createElement('div');
    content.id = 'mermaid-fs-content';
    content.innerHTML = svgHtml;

    const closeBtn = document.createElement('button');
    closeBtn.id = 'mermaid-fs-close';
    closeBtn.title = '关闭 (Esc)';
    closeBtn.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
        <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.751.751 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.751.751 0 0 1-1.06 1.06L8 9.06l-3.22 3.22a.751.751 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/>
      </svg>`;
    closeBtn.onclick = closeMermaidFullscreen;

    overlay.appendChild(content);
    overlay.appendChild(closeBtn);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeMermaidFullscreen();
    });

    // Ctrl + 鼠标滚轮缩放
    const svgEl = content.querySelector('svg');
    let scale = 1;
    const MIN_SCALE = 0.2;
    const MAX_SCALE = 10;

    const applyScale = () => {
        if (svgEl) {
            // 关键：Mermaid 生成的 SVG 带有内联 max-width（如 max-width: 1234px），
            // 内联样式优先级高于外部 CSS，必须显式清掉，否则放大无效（只能缩不能放）。
            svgEl.style.maxWidth = 'none';
            svgEl.style.maxHeight = 'none';
            svgEl.style.width = (scale * 100) + '%';
            svgEl.style.height = 'auto';
        }
    };
    applyScale();

    overlay.addEventListener('wheel', (e) => {
        if (!e.ctrlKey) return;
        // 阻止 WebView 自身的整页缩放
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
        if (next === scale) return;
        scale = next;
        applyScale();
    }, { passive: false });

    document.body.appendChild(overlay);
    mermaidFsOverlay = overlay;

    // 捕获阶段监听，避免 Monaco 等内部组件 stopPropagation 吞掉 Esc
    document.addEventListener('keydown', mermaidFsEscHandler, true);
}

// --- 复制功能逻辑 ---
async function copyToClipboard(text, btnElement) {
    try {
        await navigator.clipboard.writeText(text);
        showCopiedFeedback(btnElement);
    } catch (err) {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.top = "-9999px";
        document.body.appendChild(ta); ta.focus(); ta.select();
        try {
            document.execCommand('copy');
            showCopiedFeedback(btnElement);
        } catch (e) { }
        document.body.removeChild(ta);
    }
}

function showCopiedFeedback(btn) {
    const copyIcon = btn.querySelector('.copy-icon');
    const checkIcon = btn.querySelector('.check-icon');
    if (!copyIcon || !checkIcon) return;

    copyIcon.style.display = 'none';
    checkIcon.style.display = 'block';
    btn.classList.add('copied');

    setTimeout(() => {
        copyIcon.style.display = 'block';
        checkIcon.style.display = 'none';
        btn.classList.remove('copied');
    }, 2000);
}

// 给代码块加复制按钮
function enhanceCodeBlocks(container) {
    container.querySelectorAll('pre').forEach(pre => {
        if (pre.parentElement.classList.contains('code-block-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);

        const btn = document.createElement('button');
        btn.className = 'copy-code-btn';
        btn.innerHTML = `
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" class="copy-icon">
                <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path>
                <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path>
            </svg>
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" class="check-icon" style="display:none;">
                <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
            </svg>
        `;
        btn.onclick = () => {
            const codeText = pre.querySelector('code')?.innerText || pre.innerText;
            copyToClipboard(codeText, btn);
        };
        wrapper.appendChild(btn);
    });
}

// 给流程图加 放大 和 复制 按钮
function enhanceMermaidBlocks(container) {
    container.querySelectorAll('.mermaid-wrapper').forEach(wrapper => {
        if (wrapper.dataset.buttonsDone) return;
        wrapper.dataset.buttonsDone = '1';

        const expandBtn = document.createElement('button');
        expandBtn.className = 'mermaid-expand-btn';
        expandBtn.innerHTML = `
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                <path d="M6.22 4.28a.75.75 0 0 0-1.06 0L1.72 7.72a.75.75 0 0 0 0 1.06l3.44 3.44a.751.751 0 0 0 1.06-1.06L3.31 8l2.91-2.91a.75.75 0 0 0 0-1.06Z"/>
                <path d="M9.78 4.28a.75.75 0 0 1 1.06 0l3.44 3.44a.75.75 0 0 1 0 1.06l-3.44 3.44a.751.751 0 0 1-1.06-1.06L12.69 8 9.78 5.09a.75.75 0 0 1 0-1.06Z"/>
            </svg>`;
        expandBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const svgEl = wrapper.querySelector('svg');
            if (svgEl) {
                showMermaidFullscreen(svgEl.outerHTML);
                return;
            }
            const code = wrapper.dataset.code || '';
            if (!code) return;
            try {
                const { svg } = await mermaid.render(`fs-mermaid-${Date.now()}`, code);
                showMermaidFullscreen(svg);
            } catch (err) {
                console.error('全屏渲染失败', err);
            }
        });
        wrapper.appendChild(expandBtn);

        const copyBtn = document.createElement('button');
        copyBtn.className = 'mermaid-copy-btn';
        copyBtn.innerHTML = `
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" class="copy-icon">
                <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path>
                <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path>
            </svg>
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" class="check-icon" style="display:none;">
                <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
            </svg>
        `;
        copyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const code = wrapper.dataset.code || '';
            copyToClipboard(code, copyBtn);
        });
        wrapper.appendChild(copyBtn);
    });
}

// --- 核心渲染流程 ---
// 每次渲染递增，旧的异步 Mermaid 渲染发现序号不一致就放弃，避免并发竞态。
let previewSeq = 0;

const updatePreview = async (markdown) => {
    const seq = ++previewSeq;

    if (!markdown.trim()) {
        outputEl.innerHTML = '';
        scrollSync.rebuildAnchors();
        return;
    }

    let html = marked.parse(markdown);
    html = sanitizePreviewHtml(html);
    outputEl.innerHTML = html;

    // 1) 先给顶层块打 source-line（此时 Mermaid 还是 <pre><code>）
    annotateSourceLines(outputEl, markdown);

    // 2) 同步把 Mermaid 代码块替换成占位 wrapper：
    //    复制 data-source-line，保留源码；给最小高度，锚点不会断。
    const mermaidBlocks = outputEl.querySelectorAll('code.language-mermaid');
    const mermaidJobs = [];
    mermaidBlocks.forEach((block, i) => {
        const pre = block.parentElement;
        if (!pre) return;
        const code = block.textContent;
        const wrapper = document.createElement('div');
        wrapper.className = 'mermaid-wrapper mermaid-pending';
        wrapper.dataset.code = code;
        const srcLine = pre.getAttribute('data-source-line');
        if (srcLine) wrapper.setAttribute('data-source-line', srcLine);
        pre.replaceWith(wrapper);
        mermaidJobs.push({ wrapper, code, i });
    });

    // 3) 给普通代码块加复制按钮（Mermaid 已被替换，不会误加）
    enhanceCodeBlocks(outputEl);

    // 4) 先基于占位 wrapper 建一次锚点：
    //    保证警示块之后（Mermaid 区域、公式区域）都有锚点，
    //    不会只剩“警示块 → 末尾控制点”导致预览几乎不动。
    scrollSync.rebuildAnchors();

    // 5) 异步串行渲染 Mermaid
    for (const job of mermaidJobs) {
        if (seq !== previewSeq) return;
        try {
            const { svg } = await mermaid.render(`mermaid-${seq}-${job.i}`, job.code);
            if (seq !== previewSeq) return;
            job.wrapper.classList.remove('mermaid-pending');
            job.wrapper.innerHTML = svg;
        } catch (err) {
            console.error('Mermaid render error:', err);
            if (seq !== previewSeq) return;
            job.wrapper.classList.remove('mermaid-pending');
            job.wrapper.classList.add('mermaid-error');
            job.wrapper.textContent = `Mermaid error: ${err.message}`;
        }
    }

    if (seq !== previewSeq) return;

    // 6) 给渲染后的 Mermaid wrapper 加放大/复制按钮
    enhanceMermaidBlocks(outputEl);

    // 7) 用真实高度重建锚点
    scrollSync.rebuildAnchors();
};

const debouncedPreview = debounce((md) => updatePreview(md), 250);

editor.onDidChangeModelContent(() => {
    if (suppressContentChange) return;
    const md = editor.getValue();
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab && !activeTab.isDirty) {
        activeTab.isDirty = true;
        renderTabsUI();
    }
    debouncedPreview(md);
});

// --- 标签页逻辑 ---
let tabs = [];
let activeTabId = null;
let tabCounter = 0;

function createTab(name, content = "", path = null) {
    tabCounter++;
    const id = "tab_" + Date.now() + "_" + tabCounter;
    tabs.push({ id, name, content, path, isDirty: false });
    switchTab(id);
    renderTabsUI();
}

function switchTab(id) {
    const cur = tabs.find(t => t.id === activeTabId);
    if (cur) cur.content = editor.getValue();

    activeTabId = id;
    const next = tabs.find(t => t.id === id);
    if (next) {
        suppressContentChange = true;
        editor.setValue(next.content);
        suppressContentChange = false;
        updatePreview(next.content);
        renderTabsUI();
    }
}

function renderTabsUI() {
    tabsContainer.innerHTML = '';
    tabs.forEach(tab => {
        const el = document.createElement('div');
        el.className = `tab ${tab.id === activeTabId ? 'active' : ''}`;
        el.innerHTML = `<span>${tab.name} ${tab.isDirty ? '●' : ''}</span>`;
        el.onclick = () => switchTab(tab.id);
        tabsContainer.appendChild(el);
    });
}

// --- 主题切换 ---
document.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isDark = btn.dataset.theme === 'dark';
        document.documentElement.classList.toggle('light', !isDark);
        monaco.editor.setTheme(isDark ? 'vs-dark' : 'vs');
        mermaid.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default', securityLevel: 'strict' });
        updatePreview(editor.getValue());
    });
});

// --- 文件操作逻辑 ---
function getFileName(fullPath) {
    if (!fullPath) return '未命名.md';
    return fullPath.split(/[/\\]/).pop();
}

async function handleOpen() {
    if (isTauri) {
        try {
            const filePath = await invoke('open_dialog');
            if (filePath) {
                const fileData = await invoke('read_file', { path: filePath });
                createTab(getFileName(filePath), fileData.content, filePath);
            }
        } catch (e) {
            console.error('Open fail:', e);
            alert('打开文件失败：' + e);
        }
    } else {
        fallbackInput.click();
    }
}

fallbackInput.addEventListener('change', async () => {
    const file = fallbackInput.files[0];
    if (file) {
        const text = await file.text();
        createTab(file.name, text);
    }
});

async function handleSave(saveAs = false) {
    const active = tabs.find(t => t.id === activeTabId);
    if (!active) return;

    const content = editor.getValue();

    // 浏览器 dev 模式：没有 Tauri，降级为下载
    if (!isTauri) {
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = active.name || 'untitled.md';
        a.click();
        URL.revokeObjectURL(url);
        active.content = content;
        active.isDirty = false;
        renderTabsUI();
        return;
    }

    let path = active.path;
    if (!path || saveAs) {
        try {
            path = await invoke('save_dialog', { defaultName: active.name });
        } catch (e) {
            console.error('Save dialog fail:', e);
            alert('打开保存对话框失败：' + e);
            return;
        }
        if (!path) return;
    }

    try {
        await invoke('save_file', { path, content });
        active.path = path;
        active.name = getFileName(path);
        active.content = content;
        active.isDirty = false;
        renderTabsUI();
    } catch (e) {
        console.error('Save fail:', e);
        alert('保存失败：' + e);
    }
}

document.getElementById('menu-open').onclick = () => handleOpen();
document.getElementById('menu-save').onclick = () => handleSave(false);
document.getElementById('menu-save-as').onclick = () => handleSave(true);

window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'o') {
            e.preventDefault();
            handleOpen();
        } else if (key === 's') {
            e.preventDefault();
            handleSave(e.shiftKey);
        }
    }
});

if (isTauri) {
    listen('new-file-opened', async (event) => {
        const path = event.payload;
        try {
            const fileData = await invoke('read_file', { path });
            createTab(getFileName(path), fileData.content, path);
        } catch (e) {
            console.error('Open from event fail:', e);
        }
    });

    invoke('get_initial_file').then(fileData => {
        if (fileData && fileData.content) {
            const path = fileData.path || null;
            const name = path ? getFileName(path) : '未命名.md';
            createTab(name, fileData.content, path);
        } else {
            createTab("未命名 1.md", "# Markdown Looker\n开始写作吧！");
        }
    }).catch(() => {
        createTab("未命名 1.md", "# Markdown Looker\n开始写作吧！");
    });
} else {
    createTab("未命名 1.md", "# Markdown Looker\n开始写作吧！");
}