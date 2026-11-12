/**
 * Shiki 高亮模块。
 *
 * - 8 种内置语言静态导入，进核心 chunk，首屏零闪烁。
 * - 额外语言从 Tauri exe 同级 langs/ 目录按需读取 .tmLanguage.json。
 * - 读取失败 / 解析失败 / 非 Tauri 环境 → 回退纯文本，不抛错。
 * - 双主题（github-light / github-dark）使用 Shiki 的 light/dark 变量输出，
 *   切换主题只走 CSS，不重新高亮。
 */

import { createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

// —— 8 种内置语言（静态 import，进核心 chunk）——
import langJava from '@shikijs/langs/java';
import langC from '@shikijs/langs/c';
import langCpp from '@shikijs/langs/cpp';
import langPython from '@shikijs/langs/python';
import langRust from '@shikijs/langs/rust';
import langJs from '@shikijs/langs/javascript';
import langHtml from '@shikijs/langs/html';
import langCss from '@shikijs/langs/css';
import langMd from '@shikijs/langs/markdown';

// —— 双主题 ——
import themeLight from '@shikijs/themes/github-light';
import themeDark from '@shikijs/themes/github-dark';

const BUILTIN_LANGS = [
    langJava, langC, langCpp, langPython, langRust,
    langJs, langHtml, langCss, langMd,
];

/** 语言别名 → 规范名（Markdown 里常见写法） */
const LANG_ALIAS = {
    js: 'javascript',
    md: 'markdown',
    py: 'python',
    'c++': 'cpp',
    cxx: 'cpp',
    h: 'c',
    hpp: 'cpp',
    'c-header': 'c',
    'c++-header': 'cpp',
    sh: 'bash',
    shell: 'bash',
    htm: 'html',
};

/** 正在进行中的语言加载，避免同一语言并发重复读取 */
const pendingLangLoads = new Map();

let highlighter = null;
let initPromise = null;

/**
 * 初始化高亮器（只初始化一次）。
 * 返回的 Promise 在初始化完成后 resolve，任何失败都会 reject。
 */
export function initShiki() {
    if (initPromise) return initPromise;

    initPromise = (async () => {
        highlighter = await createHighlighterCore({
            themes: [themeLight, themeDark],
            langs: BUILTIN_LANGS,
            engine: createJavaScriptRegexEngine(),
        });
        return highlighter;
    })();

    return initPromise;
}

/** 是否已经初始化完成（同步） */
export function isShikiReady() {
    return highlighter !== null;
}

/**
 * 解析 Markdown 代码块的 info string 为 Shiki 语言名。
 * 支持 “js”, “c++”, “py” 等别名。
 */
export function resolveLang(rawLang) {
    const l = String(rawLang || '').trim().toLowerCase();
    if (!l) return 'text';
    return LANG_ALIAS[l] || l;
}

/**
 * 确保某个语言已加载。
 * 内置语言直接返回 true；额外语言尝试从 exe 同级 langs/ 读取。
 * 任何失败都返回 false，调用方回退纯文本。
 */
async function ensureLanguage(lang) {
    const h = highlighter;
    if (!h) return false;

    if (h.getLoadedLanguages().includes(lang)) return true;

    if (pendingLangLoads.has(lang)) {
        return pendingLangLoads.get(lang);
    }

    const p = (async () => {
        try {
            const grammar = await loadExternalGrammar(lang);
            if (!grammar) return false;
            await h.loadLanguage(grammar);
            return true;
        } catch (err) {
            console.warn(`[shiki] 额外语言加载失败，回退纯文本: ${lang}`, err);
            return false;
        } finally {
            pendingLangLoads.delete(lang);
        }
    })();

    pendingLangLoads.set(lang, p);
    return p;
}

/**
 * 从 exe 同级 langs/ 目录读取 TextMate grammar JSON。
 *
 * 路径约定（由 Rust 端 read_lang_grammar 命令处理）：
 *   Windows:  <exe目录>/langs/<lang>.tmLanguage.json
 *   macOS:    <exe目录>/langs/<lang>.tmLanguage.json
 *   Linux:    <exe目录>/langs/<lang>.tmLanguage.json
 *
 * 文件不存在 / JSON 解析失败 / 非 Tauri 环境 → 返回 null。
 */
async function loadExternalGrammar(lang) {
    if (typeof window === 'undefined' || !window.__TAURI__) return null;

    try {
        const { invoke } = window.__TAURI__.core;
        const text = await invoke('read_lang_grammar', { lang });

        if (!text || typeof text !== 'string') return null;

        const grammar = JSON.parse(text);

        if (!grammar.name) grammar.name = lang;
        if (!grammar.scopeName) grammar.scopeName = `source.${lang}`;

        return grammar;
    } catch {
        return null;
    }
}

/**
 * 对单个代码块做高亮。
 * 返回 Shiki 生成的完整 <pre>...</pre> HTML；
 * 语言不可用、纯文本、或出错时返回 null。
 */
export async function highlightCodeBlock(code, rawLang) {
    const h = highlighter;
    if (!h) return null;

    const lang = resolveLang(rawLang);

    if (lang === 'text' || lang === 'plaintext' || lang === 'plain') {
        return null;
    }

    const ok = await ensureLanguage(lang);
    if (!ok) return null;

    try {
        return h.codeToHtml(code, {
            lang,
            themes: { light: 'github-light', dark: 'github-dark' },
        });
    } catch (err) {
        console.warn(`[shiki] 高亮失败: ${lang}`, err);
        return null;
    }
}