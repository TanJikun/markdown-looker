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

// =========================================================
// 主题：'system' | 'dark' | 'light'
// 默认跟随系统；持久化到 localStorage，Tauri 下同时写入 config.json
// =========================================================
const THEME_STORAGE_KEY = 'markdown-looker-theme';
const VALID_THEMES = ['system', 'dark', 'light'];
const systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function normalizeTheme(theme) {
    return VALID_THEMES.includes(theme) ? theme : 'system';
}

function resolveTheme(theme) {
    const t = normalizeTheme(theme);
    if (t === 'system') return systemDarkQuery.matches ? 'dark' : 'light';
    return t;
}

function readCachedTheme() {
    try {
        return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY));
    } catch (e) {
        return 'system';
    }
}

let currentTheme = readCachedTheme();
let initialResolvedTheme = resolveTheme(currentTheme);

// 立即把浅色 class 挂上，避免启动闪烁
document.documentElement.classList.toggle('light', initialResolvedTheme === 'light');

// =========================================================
// 自定义 Monaco 主题：把编辑器的基础色全部对齐到右栏渲染的 CSS 变量
// 深色：--bg #0D1117 / --text #e6edf3 / --border #3D444D / --panel #0D1117 / --muted #8b949e / --accent #58a6ff
// 浅色：--bg #ffffff / --text #1f2328 / --border #454C54 / --panel #ffffff / --muted #656d76 / --accent #0969da
// base 继承 vs-dark / vs，语法高亮 token 色保留，只覆盖基础前景与 UI 部件颜色。
// =========================================================
monaco.editor.defineTheme('markdown-looker-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
        { token: '', foreground: 'e6edf3' },
    ],
    colors: {
        // —— 编辑器主体 ——
        'editor.background': '#0D1117',
        'editor.foreground': '#e6edf3',
        'editorCursor.foreground': '#58a6ff',
        'editor.selectionBackground': '#264F78',
        'editor.inactiveSelectionBackground': '#1c2b3a',
        'editor.selectionHighlightBackground': '#264F7855',
        'editor.wordHighlightBackground': '#264F7855',
        'editor.wordHighlightStrongBackground': '#264F7880',
        'editor.findMatchBackground': '#58a6ff44',
        'editor.findMatchHighlightBackground': '#58a6ff22',
        'editor.lineHighlightBackground': '#151B23',
        'editor.lineHighlightBorder': '#00000000',
        'editor.rangeHighlightBackground': '#58a6ff14',

        // —— Gutter / 缩进 / 空白 ——
        'editorGutter.background': '#0D1117',
        'editorLineNumber.foreground': '#484f58',
        'editorLineNumber.activeForeground': '#8b949e',
        'editorIndentGuide.background1': '#21262d',
        'editorIndentGuide.activeBackground1': '#3D444D',
        'editorWhitespace.foreground': '#3D444D',
        'editorRuler.foreground': '#3D444D',

        // —— 滚动条（对应右侧 ::-webkit-scrollbar-thumb） ——
        'scrollbarSlider.background': '#484f58b3',
        'scrollbarSlider.hoverBackground': '#484f58e6',
        'scrollbarSlider.activeBackground': '#484f58',
        'scrollbar.shadow': '#00000000',

        // —— 概览尺：彻底关闭装饰，避免滚动条顶部出现多余标记 ——
        'editorOverviewRuler.border': '#00000000',
        'editorOverviewRuler.background': '#0D1117',
        'editorOverviewRuler.currentContentForeground': '#00000000',
        'editorOverviewRuler.incomingContentForeground': '#00000000',
        'editorOverviewRuler.commonContentForeground': '#00000000',

        // —— 悬浮控件 / 输入框 / 菜单 ——
        'editorWidget.background': '#0D1117',
        'editorWidget.border': '#3D444D',
        'editorWidget.foreground': '#e6edf3',
        'editorHoverWidget.background': '#0D1117',
        'editorHoverWidget.border': '#3D444D',
        'editorHoverWidget.foreground': '#e6edf3',
        'editorSuggestWidget.background': '#0D1117',
        'editorSuggestWidget.border': '#3D444D',
        'editorSuggestWidget.selectedBackground': '#151B23',
        'editorSuggestWidget.foreground': '#e6edf3',
        'editorSuggestWidget.highlightForeground': '#58a6ff',
        'input.background': '#0D1117',
        'input.border': '#3D444D',
        'input.foreground': '#e6edf3',
        'input.placeholderForeground': '#8b949e',
        'focusBorder': '#3D444D',
        'menu.background': '#0D1117',
        'menu.border': '#3D444D',
        'menu.foreground': '#e6edf3',
        'menu.selectionBackground': '#151B23',
        'menu.selectionForeground': '#e6edf3',
        'menu.separatorBackground': '#3D444D',
        'list.hoverBackground': '#151B23',
        'list.activeSelectionBackground': '#151B23',
        'list.activeSelectionForeground': '#e6edf3',
        'list.inactiveSelectionBackground': '#0D1117',

        // —— 括号匹配 ——
        'editorBracketMatch.background': '#264F78',
        'editorBracketMatch.border': '#58a6ff',

        // —— 链接 ——
        'editorLink.activeForeground': '#58a6ff',
        'textLink.foreground': '#58a6ff',
        'textLink.activeForeground': '#58a6ff',

        // —— 通用 ——
        'foreground': '#e6edf3',
        'descriptionForeground': '#8b949e',
        'errorForeground': '#f85149',
    }
});

monaco.editor.defineTheme('markdown-looker-light', {
    base: 'vs',
    inherit: true,
    rules: [
        { token: '', foreground: '1f2328' },
    ],
    colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#1f2328',
        'editorCursor.foreground': '#0969da',
        'editor.selectionBackground': '#b6d7ff',
        'editor.inactiveSelectionBackground': '#ddf4ff',
        'editor.selectionHighlightBackground': '#b6d7ff88',
        'editor.wordHighlightBackground': '#b6d7ff88',
        'editor.wordHighlightStrongBackground': '#b6d7ffaa',
        'editor.findMatchBackground': '#0969da33',
        'editor.findMatchHighlightBackground': '#0969da22',
        'editor.lineHighlightBackground': '#f6f8fa',
        'editor.lineHighlightBorder': '#00000000',
        'editor.rangeHighlightBackground': '#0969da14',

        'editorGutter.background': '#ffffff',
        'editorLineNumber.foreground': '#8c959f',
        'editorLineNumber.activeForeground': '#656d76',
        'editorIndentGuide.background1': '#d8dee4',
        'editorIndentGuide.activeBackground1': '#a0a8b0',
        'editorWhitespace.foreground': '#d0d7de',
        'editorRuler.foreground': '#d0d7de',

        'scrollbarSlider.background': '#d0d7deb3',
        'scrollbarSlider.hoverBackground': '#d0d7dee6',
        'scrollbarSlider.activeBackground': '#d0d7de',
        'scrollbar.shadow': '#00000000',

        'editorOverviewRuler.border': '#00000000',
        'editorOverviewRuler.background': '#ffffff',
        'editorOverviewRuler.currentContentForeground': '#00000000',
        'editorOverviewRuler.incomingContentForeground': '#00000000',
        'editorOverviewRuler.commonContentForeground': '#00000000',

        'editorWidget.background': '#ffffff',
        'editorWidget.border': '#d0d7de',
        'editorWidget.foreground': '#1f2328',
        'editorHoverWidget.background': '#ffffff',
        'editorHoverWidget.border': '#d0d7de',
        'editorHoverWidget.foreground': '#1f2328',
        'editorSuggestWidget.background': '#ffffff',
        'editorSuggestWidget.border': '#d0d7de',
        'editorSuggestWidget.selectedBackground': '#f6f8fa',
        'editorSuggestWidget.foreground': '#1f2328',
        'editorSuggestWidget.highlightForeground': '#0969da',
        'input.background': '#ffffff',
        'input.border': '#d0d7de',
        'input.foreground': '#1f2328',
        'input.placeholderForeground': '#656d76',
        'focusBorder': '#d0d7de',
        'menu.background': '#ffffff',
        'menu.border': '#d0d7de',
        'menu.foreground': '#1f2328',
        'menu.selectionBackground': '#f6f8fa',
        'menu.selectionForeground': '#1f2328',
        'menu.separatorBackground': '#d0d7de',
        'list.hoverBackground': '#f6f8fa',
        'list.activeSelectionBackground': '#f6f8fa',
        'list.activeSelectionForeground': '#1f2328',
        'list.inactiveSelectionBackground': '#ffffff',

        'editorBracketMatch.background': '#b6d7ff',
        'editorBracketMatch.border': '#0969da',

        'editorLink.activeForeground': '#0969da',
        'textLink.foreground': '#0969da',
        'textLink.activeForeground': '#0969da',

        'foreground': '#1f2328',
        'descriptionForeground': '#656d76',
        'errorForeground': '#cf222e',
    }
});

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

mermaid.initialize({
    startOnLoad: false,
    theme: initialResolvedTheme === 'dark' ? 'dark' : 'default',
    securityLevel: 'strict'
});

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
    theme: initialResolvedTheme === 'dark' ? 'markdown-looker-dark' : 'markdown-looker-light',
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    // 滚动条：12px 轨道 + 6px 滑块，对齐右栏 ::-webkit-scrollbar；
    // useShadows: false 关闭滚动时顶部的渐隐阴影；
    // alwaysConsumeMouseWheel: false 让滚轮在边界处不被吃掉；
    // arrowSize: 0 隐藏轨道两端的箭头（右栏没有）。
    scrollbar: {
        vertical: 'visible',
        horizontal: 'visible',
        verticalScrollbarSize: 12,
        horizontalScrollbarSize: 12,
        verticalSliderSize: 6,
        horizontalSliderSize: 6,
        useShadows: false,
        alwaysConsumeMouseWheel: false,
        arrowSize: 0,
    },
    wordWrap: 'on',
    hover: { enabled: false },
    quickSuggestions: false,
    suggestOnTriggerCharacters: false,
    folding: false,
    // 行号：Monaco 原生按“逻辑行”编号——wordWrap 折行出的视觉行不会累加行号。
    // lineNumbersMinChars: 3 保证 1~999 行时行号区宽度稳定，不抖动。
    lineNumbers: 'on',
    lineNumbersMinChars: 3,
    renderLineHighlight: 'line',
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    smoothScrolling: true,
    // 左右各 16：左侧让行号适度贴边，右侧给 12px 滚动条留出 4px 呼吸
    padding: { top: 24, bottom: 24, left: 16, right: 16 },
    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, "Courier New", monospace',
    fontSize: 16,
    lineHeight: 26,
    fontLigatures: false
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

    if (Math.abs(diff) < 0.5) {
        editor.setScrollPosition(
            { scrollTop: target },
            monaco.editor.ScrollType.Immediate
        );
        wheelRaf = null;
        wheelTargetTop = null;
        return;
    }

    editor.setScrollPosition(
        { scrollTop: current + diff * 0.22 },
        monaco.editor.ScrollType.Immediate
    );
    wheelRaf = requestAnimationFrame(wheelTick);
};

document.addEventListener('wheel', (e) => {
    if (!editorDom || !editorDom.contains(e.target)) return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;

    e.preventDefault();
    e.stopPropagation();

    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 16;
    else if (e.deltaMode === 2) delta *= 100;

    const lineHeight =
        editor.getOption(monaco.editor.EditorOption.lineHeight) || 26;

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
let mermaidFsCleanup = [];

function closeMermaidFullscreen() {
    if (mermaidFsOverlay) {
        mermaidFsOverlay.remove();
        mermaidFsOverlay = null;
    }
    document.removeEventListener('keydown', mermaidFsEscHandler, true);
    for (const fn of mermaidFsCleanup) {
        try { fn(); } catch (e) { /* noop */ }
    }
    mermaidFsCleanup = [];
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

    document.body.appendChild(overlay);
    mermaidFsOverlay = overlay;

    const svgEl = content.querySelector('svg');

    let scale = 1;
    const MIN_SCALE = 0.2;
    const MAX_SCALE = 10;
    let baseW = 1;
    let baseH = 1;

    const computeBase = () => {
        const cs = getComputedStyle(content);
        const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
        const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
        const availW = Math.max(1, content.clientWidth - padX - 1);
        const availH = Math.max(1, content.clientHeight - padY - 1);

        let aspect = null;
        if (svgEl) {
            const vb = svgEl.viewBox && svgEl.viewBox.baseVal;
            if (vb && vb.width && vb.height) {
                aspect = vb.width / vb.height;
            } else {
                const w = svgEl.width && svgEl.width.baseVal ? svgEl.width.baseVal.value : 0;
                const h = svgEl.height && svgEl.height.baseVal ? svgEl.height.baseVal.value : 0;
                if (w && h) aspect = w / h;
            }
        }

        if (aspect && isFinite(aspect) && aspect > 0) {
            if (availW / availH > aspect) {
                baseH = availH;
                baseW = availH * aspect;
            } else {
                baseW = availW;
                baseH = availW / aspect;
            }
        } else {
            baseW = availW;
            baseH = availH;
        }
    };

    const updateCursor = () => {
        const canX = content.scrollWidth > content.clientWidth + 1;
        const canY = content.scrollHeight > content.clientHeight + 1;
        content.classList.toggle('scrollable', canX || canY);
    };

    const applyScale = () => {
        if (!svgEl) return;
        svgEl.style.maxWidth = 'none';
        svgEl.style.maxHeight = 'none';
        svgEl.style.width = (baseW * scale) + 'px';
        svgEl.style.height = (baseH * scale) + 'px';
        updateCursor();
    };

    computeBase();
    applyScale();

    const handleZoomWheel = (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        if (e.defaultPrevented) return;
        e.preventDefault();
        e.stopPropagation();
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
        if (next === scale) return;
        scale = next;
        applyScale();
    };
    content.addEventListener('wheel', handleZoomWheel, { passive: false, capture: true });
    overlay.addEventListener('wheel', handleZoomWheel, { passive: false });

    const setCtrlHeld = (held) => {
        content.classList.toggle('ctrl-held', held);
    };
    const onCtrlKeyDown = (e) => {
        if (e.key === 'Control' || e.key === 'Meta') setCtrlHeld(true);
    };
    const onCtrlKeyUp = (e) => {
        if (e.key === 'Control' || e.key === 'Meta') setCtrlHeld(false);
    };
    const onWindowBlur = () => setCtrlHeld(false);

    window.addEventListener('keydown', onCtrlKeyDown, true);
    window.addEventListener('keyup', onCtrlKeyUp, true);
    window.addEventListener('blur', onWindowBlur);

    let dragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragStartScrollLeft = 0;
    let dragStartScrollTop = 0;

    const onContentMouseDown = (e) => {
        if (e.button !== 0) return;
        if (!content.classList.contains('scrollable')) return;
        dragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragStartScrollLeft = content.scrollLeft;
        dragStartScrollTop = content.scrollTop;
        content.classList.add('dragging');
        e.preventDefault();
    };

    const onWindowMouseMove = (e) => {
        if (!dragging) return;
        content.scrollLeft = dragStartScrollLeft - (e.clientX - dragStartX);
        content.scrollTop = dragStartScrollTop - (e.clientY - dragStartY);
    };

    const onWindowMouseUp = () => {
        if (!dragging) return;
        dragging = false;
        content.classList.remove('dragging');
    };

    content.addEventListener('mousedown', onContentMouseDown);
    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);

    const onResize = () => {
        if (!svgEl) return;
        computeBase();
        applyScale();
    };
    window.addEventListener('resize', onResize);

    mermaidFsCleanup.push(() => {
        content.removeEventListener('mousedown', onContentMouseDown);
        window.removeEventListener('mousemove', onWindowMouseMove);
        window.removeEventListener('mouseup', onWindowMouseUp);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('keydown', onCtrlKeyDown, true);
        window.removeEventListener('keyup', onCtrlKeyUp, true);
        window.removeEventListener('blur', onWindowBlur);
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeMermaidFullscreen();
    });

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

    annotateSourceLines(outputEl, markdown);

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

    enhanceCodeBlocks(outputEl);
    scrollSync.rebuildAnchors();

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

    enhanceMermaidBlocks(outputEl);
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

// --- 主题应用 / 持久化 ---
function updateThemeMenuUI() {
    document.querySelectorAll('.theme-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === currentTheme);
    });
}

function syncWindowTheme(resolved) {
    if (!isTauri) return;
    try {
        const win = window.__TAURI__.window.getCurrentWindow();
        // 传具体值，确保浅色模式下标题栏也变浅
        win.setTheme(resolved).catch(err => console.error('setTheme 失败:', err));
    } catch (e) {
        console.error('获取窗口失败:', e);
    }
}

async function persistTheme(theme) {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) { /* noop */ }

    if (isTauri) {
        try {
            await invoke('save_config', { config: { theme } });
        } catch (e) {
            console.error('保存主题配置失败:', e);
        }
    }
}

function applyTheme(theme, { persist = true } = {}) {
    const next = normalizeTheme(theme);
    currentTheme = next;
    const resolved = resolveTheme(next);

    document.documentElement.classList.toggle('light', resolved === 'light');

    monaco.editor.setTheme(
        resolved === 'dark' ? 'markdown-looker-dark' : 'markdown-looker-light'
    );

    mermaid.initialize({
        startOnLoad: false,
        theme: resolved === 'dark' ? 'dark' : 'default',
        securityLevel: 'strict'
    });

    syncWindowTheme(resolved);
    updateThemeMenuUI();

    if (persist) {
        persistTheme(next);
    }

    updatePreview(editor.getValue());
}

async function loadPersistedTheme() {
    if (isTauri) {
        try {
            const cfg = await invoke('load_config');
            const theme = normalizeTheme(cfg && cfg.theme);
            try {
                localStorage.setItem(THEME_STORAGE_KEY, theme);
            } catch (e) { /* noop */ }
            return theme;
        } catch (e) {
            console.error('读取主题配置失败:', e);
        }
    }
    return readCachedTheme();
}

async function initTheme() {
    const persisted = await loadPersistedTheme();
    if (persisted !== currentTheme) {
        applyTheme(persisted, { persist: false });
    } else {
        // 即使主题相同，也同步一次标题栏和菜单选中态
        syncWindowTheme(resolveTheme(currentTheme));
        updateThemeMenuUI();
    }
}

document.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyTheme(btn.dataset.theme);
    });
});

systemDarkQuery.addEventListener('change', () => {
    if (currentTheme === 'system') {
        applyTheme('system', { persist: false });
    }
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

// 启动时从 config.json 同步主题（Tauri）或 localStorage（浏览器）
initTheme();