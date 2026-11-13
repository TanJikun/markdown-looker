import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution';

import { marked } from 'marked';
import { gfmHeadingId } from 'marked-gfm-heading-id';
import markedAlert from 'marked-alert';
import markedFootnote from 'marked-footnote';
import markedKatex from 'marked-katex-extension';
import mermaid from 'mermaid';

import { scrollSync } from './core/scroll-sync.js';
import { annotateSourceLines } from './core/source-lines.js';
import { debounce } from './core/debounce.js';
import { sanitizePreviewHtml } from './core/sanitize.js';
import {
    initShiki,
    isShikiReady,
    highlightCodeBlock,
} from './core/shiki-highlighter.js';

import 'katex/dist/katex.min.css';

import { initToolbar } from './toolbar.js';

self.MonacoEnvironment = {
    getWorker() { return new editorWorker(); }
};

// 提前初始化 Shiki，避免首次编辑时延迟。
initShiki().catch(err => console.warn('[shiki] 初始化失败:', err));

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
// 自定义 Monaco 主题
// =========================================================
monaco.editor.defineTheme('markdown-looker-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
        { token: '', foreground: 'e6edf3' },
    ],
    colors: {
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

        'editorGutter.background': '#0D1117',
        'editorLineNumber.foreground': '#484f58',
        'editorLineNumber.activeForeground': '#8b949e',
        'editorIndentGuide.background1': '#21262d',
        'editorIndentGuide.activeBackground1': '#3D444D',
        'editorWhitespace.foreground': '#3D444D',
        'editorRuler.foreground': '#3D444D',

        'scrollbarSlider.background': '#484f58b3',
        'scrollbarSlider.hoverBackground': '#484f58e6',
        'scrollbarSlider.activeBackground': '#484f58',
        'scrollbar.shadow': '#00000000',

        'editorOverviewRuler.border': '#00000000',
        'editorOverviewRuler.background': '#0D1117',
        'editorOverviewRuler.currentContentForeground': '#00000000',
        'editorOverviewRuler.incomingContentForeground': '#00000000',
        'editorOverviewRuler.commonContentForeground': '#00000000',

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

        'editorBracketMatch.background': '#264F78',
        'editorBracketMatch.border': '#58a6ff',

        'editorLink.activeForeground': '#58a6ff',
        'textLink.foreground': '#58a6ff',
        'textLink.activeForeground': '#58a6ff',

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
    lineNumbers: 'on',
    lineNumbersMinChars: 3,
    renderLineHighlight: 'line',
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    smoothScrolling: true,
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
// Markdown 工具栏
initToolbar(editor, {
    refreshPreview: () => updatePreview(editor.getValue()),
});

// =========================================================
// Monaco 滚轮平滑滚动
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

/**
 * 对 outputEl 内所有 <pre><code class="language-*"> 做 Shiki 高亮。
 *
 * 策略：
 *   - 内置语言：高亮器已就绪，直接替换 <pre> 内部 HTML，零闪烁。
 *   - 额外语言：await 读取 grammar，加载成功后替换；
 *     失败则保留原纯文本 DOM，不抛错。
 *   - 并发加载多个额外语言，`Promise.all` 收齐后一次性替换，
 *     期间不阻塞 updatePreview 主流程（调用方不 await）。
 */
async function applyShikiHighlighting(root, seq) {
    if (!isShikiReady()) {
        initShiki()
            .then(() => {
                if (seq === previewSeq) applyShikiHighlighting(root, seq);
            })
            .catch(err => {
                console.warn('[shiki] 初始化失败，代码块保持纯文本:', err);
            });
        return;
    }

    const codeEls = [...root.querySelectorAll('pre > code[class*="language-"]')];
    if (!codeEls.length) return;

    const results = await Promise.all(codeEls.map(async (codeEl) => {
        const pre = codeEl.parentElement;
        if (!pre) return null;

        const match = /language-([^\s]+)/.exec(codeEl.className);
        const rawLang = match ? match[1] : '';
        const code = codeEl.textContent || '';

        const highlighted = await highlightCodeBlock(code, rawLang);
        return { pre, highlighted };
    }));

    if (seq !== previewSeq) return;

    for (const r of results) {
        if (!r || !r.highlighted) continue;
        const { pre, highlighted } = r;
        if (!pre.parentElement) continue;

        const temp = document.createElement('div');
        temp.innerHTML = highlighted;
        const newPre = temp.querySelector('pre');
        if (!newPre) continue;

        // 迁移原 <pre> 上的所有属性（data-source-line 等），
        // 保留 enhanceCodeBlocks 建立的 wrapper 和复制按钮。
        for (const attr of pre.attributes) {
            if (!newPre.hasAttribute(attr.name)) {
                newPre.setAttribute(attr.name, attr.value);
            }
        }

        pre.replaceWith(newPre);
    }
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

    // Shiki 高亮：调用方不 await，避免阻塞后续 mermaid 渲染。
    // 高亮完成后由 MutationObserver 自动触发 scrollSync.rebuildAnchors。
    applyShikiHighlighting(outputEl, seq).catch(err => {
        console.warn('[shiki] 高亮流程异常:', err);
    });

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
        el.title = tab.path || tab.name;

        const label = document.createElement('span');
        label.className = 'tab-label';
        label.textContent = tab.name + (tab.isDirty ? ' ●' : '');
        el.appendChild(label);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'tab-close';
        closeBtn.title = '关闭';
        closeBtn.setAttribute('aria-label', '关闭标签页');
        closeBtn.innerHTML = `<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.751.751 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.751.751 0 0 1-1.06 1.06L8 9.06l-3.22 3.22a.751.751 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>`;
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleCloseTab(tab.id);
        });
        el.appendChild(closeBtn);

        el.onclick = () => switchTab(tab.id);
        tabsContainer.appendChild(el);
    });
}

function showSaveConfirmDialog(tabName) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'save-confirm-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'save-confirm-dialog';
        dialog.innerHTML = `
            <div class="save-confirm-message"></div>
            <div class="save-confirm-buttons">
                <button type="button" class="save-confirm-cancel">不保存</button>
                <button type="button" class="save-confirm-save">保存</button>
            </div>
        `;
        dialog.querySelector('.save-confirm-message').textContent =
            `「${tabName}」有未保存的更改。是否保存？`;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const close = (result) => {
            overlay.remove();
            document.removeEventListener('keydown', onKey, true);
            resolve(result);
        };
        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                close('cancel');
            }
        };

        dialog.querySelector('.save-confirm-save')
            .addEventListener('click', () => close('save'));
        dialog.querySelector('.save-confirm-cancel')
            .addEventListener('click', () => close('cancel'));
        document.addEventListener('keydown', onKey, true);
        dialog.querySelector('.save-confirm-save').focus();
    });
}

async function handleCloseTab(tabId) {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    if (tabId === activeTabId) {
        tab.content = editor.getValue();
    }

    if (tab.isDirty) {
        const action = await showSaveConfirmDialog(tab.name);
        if (action === 'save') {
            const ok = await saveTab(tabId, false);
            if (!ok) return; // 保存失败 / 用户在系统「另存为」里取消 => 中止关闭
        }
        // action === 'cancel' => 放弃保存，继续关闭
    }

    removeTab(tabId);
}

function removeTab(tabId) {
    const idx = tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;

    tabs.splice(idx, 1);

    if (tabs.length === 0) {
        // 关闭所有后至少保留一个空白标签
        activeTabId = null;
        createTab('未命名.md', '');
        return;
    }

    if (activeTabId === tabId) {
        const nextIdx = Math.min(idx, tabs.length - 1);
        switchTab(tabs[nextIdx].id);
    } else {
        renderTabsUI();
    }
}

// --- 设置窗口 ---
async function openSettingsWindow() {
    if (!isTauri) return;

    const WebviewWindow = window.__TAURI__.webviewWindow.WebviewWindow;
    const getCurrentWindow = window.__TAURI__.window.getCurrentWindow;

    // 已开则聚焦
    try {
        const existing = await WebviewWindow.getByLabel('settings');
        if (existing) {
            await existing.setFocus();
            return;
        }
    } catch (_) { /* noop */ }

    // 读取配置里的 ratio
    let ratio = 0.8;
    try {
        const cfg = await invoke('load_config');
        if (cfg && typeof cfg.settings_window_ratio === 'number') {
            ratio = Math.max(0.4, Math.min(1, cfg.settings_window_ratio));
        }
    } catch (e) {
        console.warn('读取窗口比例失败:', e);
    }

    // 绝对居中计算：父窗口 outer 中心 - 新窗口尺寸/2
    const parent = getCurrentWindow();
    let w = 800, h = 600, x = null, y = null;
    try {
        const [parentInnerSize, parentOuterPos, parentOuterSize, sf] = await Promise.all([
            parent.innerSize(),
            parent.outerPosition(),
            parent.outerSize(),
            parent.scaleFactor(),
        ]);
        w = Math.max(360, Math.round((parentInnerSize.width / sf) * ratio));
        h = Math.max(260, Math.round((parentInnerSize.height / sf) * ratio));

        const centerX = parentOuterPos.x + parentOuterSize.width / 2;
        const centerY = parentOuterPos.y + parentOuterSize.height / 2;
        x = Math.round(centerX - (w * sf) / 2);
        y = Math.round(centerY - (h * sf) / 2);
    } catch (e) {
        console.warn('计算窗口尺寸失败:', e);
    }

    const opts = {
        url: 'settings.html',
        title: '设置',
        width: w,
        height: h,
        resizable: false,       // 用户不可拖拽缩放手柄
        decorations: false,     // 无原生标题栏 → 用户无法拖动窗口
        minimizable: false,
        maximizable: false,
        skipTaskbar: true,
        parent: 'main',
    };
    if (x !== null && y !== null) {
        opts.x = x;
        opts.y = y;
    }

    try {
        const win = new WebviewWindow('settings', opts);
        win.once('tauri://error', (e) => {
            console.error('创建设置窗口失败:', e);
        });
    } catch (e) {
        console.error('创建设置窗口异常:', e);
    }
}

// --- 主题应用 / 持久化 ---
/**
 * 将原始主题同步给原生窗口。
 * system -> null，让窗口恢复跟随系统；
 * 否则 Tauri 的 setTheme('light'/'dark') 会强制覆盖 WebView 的
 * prefers-color-scheme，导致“系统深色 + 用户选浅色”后再选“跟随系统”
 * 读到的仍是浅色（被污染的 false）。
 */
function syncWindowTheme(theme) {
    if (!isTauri) return Promise.resolve();
    try {
        const win = window.__TAURI__.window.getCurrentWindow();
        return win.setTheme(theme === 'system' ? null : theme)
            .catch(err => console.error('setTheme 失败:', err));
    } catch (e) {
        console.error('获取窗口失败:', e);
        return Promise.resolve();
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

async function applyTheme(theme, { persist = true } = {}) {
    const next = normalizeTheme(theme);
    currentTheme = next;

    // 先把原始主题同步给原生窗口：system -> null
    await syncWindowTheme(next);

    // setTheme(null) 后 WebView 的 prefers-color-scheme 需要一两帧才恢复，
    // 否则这里读到的还是上一次 setTheme('light'/'dark') 污染后的值。
    if (next === 'system' && isTauri) {
        await new Promise(resolve =>
            requestAnimationFrame(() => requestAnimationFrame(resolve))
        );
    }

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

    updatePreview(editor.getValue());

    if (persist) {
        persistTheme(next);
    }
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
        await applyTheme(persisted, { persist: false });
    } else {
        // 传原始主题：system 时让窗口 setTheme(null) 跟随系统
        await syncWindowTheme(currentTheme);
    }
}

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

async function saveTab(tabId, saveAs = false) {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return false;

    const content = tabId === activeTabId ? editor.getValue() : tab.content;

    if (!isTauri) {
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = tab.name || 'untitled.md';
        a.click();
        URL.revokeObjectURL(url);
        tab.content = content;
        tab.isDirty = false;
        renderTabsUI();
        return true;
    }

    let path = tab.path;
    if (!path || saveAs) {
        try {
            path = await invoke('save_dialog', { defaultName: tab.name });
        } catch (e) {
            console.error('Save dialog fail:', e);
            alert('打开保存对话框失败：' + e);
            return false;
        }
        if (!path) return false; // 用户取消保存对话框
    }

    try {
        await invoke('save_file', { path, content });
        tab.path = path;
        tab.name = getFileName(path);
        tab.content = content;
        tab.isDirty = false;
        renderTabsUI();
        return true;
    } catch (e) {
        console.error('Save fail:', e);
        alert('保存失败：' + e);
        return false;
    }
}

async function handleSave(saveAs = false) {
    if (!activeTabId) return;
    await saveTab(activeTabId, saveAs);
}

document.getElementById('menu-open').onclick = () => handleOpen();
document.getElementById('menu-save').onclick = () => handleSave(false);
document.getElementById('menu-save-as').onclick = () => handleSave(true);
document.getElementById('menu-settings').onclick = () => openSettingsWindow();

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

    // 设置窗口改主题时，主窗口只应用（持久化由设置窗口负责）
    listen('settings:theme-changed', async (event) => {
        const theme = event.payload && event.payload.theme;
        if (theme) {
            await applyTheme(theme, { persist: false });
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

// --- 关闭窗口：拦截 + 逐个询问脏标签 ---
let closingInProgress = false;

async function confirmCloseAllTabs() {
    const cur = tabs.find(t => t.id === activeTabId);
    if (cur) cur.content = editor.getValue();

    const dirtyTabs = tabs.filter(t => t.isDirty);
    for (const tab of dirtyTabs) {
        const action = await showSaveConfirmDialog(tab.name);
        if (action === 'save') {
            const ok = await saveTab(tab.id, false);
            if (!ok) return false; // 保存失败 / 系统保存框取消 => 中止关闭整个窗口
        }
        // action === 'cancel' => 放弃保存，继续问下一个脏标签
    }
    return true;
}

function setupWindowCloseHandler() {
    if (!isTauri) {
        window.addEventListener('beforeunload', (e) => {
            const cur = tabs.find(t => t.id === activeTabId);
            if (cur) cur.content = editor.getValue();
            if (tabs.some(t => t.isDirty)) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
        return;
    }

    const win = window.__TAURI__.window.getCurrentWindow();
    win.onCloseRequested(async (event) => {
        event.preventDefault();
        if (closingInProgress) return;
        closingInProgress = true;
        try {
            const canClose = await confirmCloseAllTabs();
            if (canClose) {
                await win.destroy();
            }
        } finally {
            closingInProgress = false;
        }
    }).catch(err => console.error('注册窗口关闭处理失败:', err));
}

setupWindowCloseHandler();