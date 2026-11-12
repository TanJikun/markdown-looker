/**
 * Markdown 工具栏 SVG 图标集合。
 * 区1 的 B/I/S、H1-H6 使用文字，不使用本文件。
 */

const S = (path, extra = '') =>
    `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ${extra}>${path}</svg>`;

export const ICONS = {
    inlineCode: S(`<path d="M5.5 4.5L2 8l3.5 3.5"/><path d="M10.5 4.5L14 8l-3.5 3.5"/>`),

    highlight: S(`<path d="M11 2.5l2.5 2.5-7 7H4v-2.5z"/><path d="M2 14h12"/>`),

    ul: S(`
        <circle cx="3" cy="4" r="1" fill="currentColor" stroke="none"/>
        <circle cx="3" cy="8" r="1" fill="currentColor" stroke="none"/>
        <circle cx="3" cy="12" r="1" fill="currentColor" stroke="none"/>
        <path d="M6.5 4h7.5"/><path d="M6.5 8h7.5"/><path d="M6.5 12h7.5"/>`),

    ol: S(`
        <text x="1" y="5.5" font-size="5.5" font-weight="700" fill="currentColor" stroke="none">1</text>
        <text x="1" y="9.5" font-size="5.5" font-weight="700" fill="currentColor" stroke="none">2</text>
        <text x="1" y="13.5" font-size="5.5" font-weight="700" fill="currentColor" stroke="none">3</text>
        <path d="M6.5 4h7.5"/><path d="M6.5 8h7.5"/><path d="M6.5 12h7.5"/>`),

    task: S(`
        <rect x="1.5" y="2.5" width="4" height="4" rx="0.8"/>
        <path d="M2.5 4.5l1 1 1.8-1.8"/>
        <path d="M8 4.5h6.5"/>
        <rect x="1.5" y="9.5" width="4" height="4" rx="0.8"/>
        <path d="M8 11.5h6.5"/>`),

    link: S(`
        <path d="M6.5 9.5a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 0 0-3.5-3.5l-1 1"/>
        <path d="M9.5 6.5a2.5 2.5 0 0 0-3.5 0l-2 2a2.5 2.5 0 0 0 3.5 3.5l1-1"/>`),

    image: S(`
        <rect x="2" y="3" width="12" height="10" rx="1"/>
        <circle cx="5.5" cy="6.5" r="1"/>
        <path d="M2 12l3.5-3.5L8 11l2.5-2.5L14 12"/>`),

    table: S(`
        <rect x="2" y="3" width="12" height="10" rx="1"/>
        <path d="M2 6.5h12"/><path d="M2 10h12"/>
        <path d="M6.5 3v10"/><path d="M10 3v10"/>`),

    codeBlock: S(`
        <rect x="2" y="3" width="12" height="10" rx="1"/>
        <path d="M5.5 6.5L4 8l1.5 1.5"/>
        <path d="M10.5 6.5L12 8l-1.5 1.5"/>`),

    quote: S(`<path d="M3 3v10"/><path d="M6 5h7"/><path d="M6 8h7"/><path d="M6 11h4"/>`),

    alert: S(`
        <path d="M8 2l6 11H2z"/>
        <path d="M8 6.5v3"/>
        <circle cx="8" cy="11.5" r="0.5" fill="currentColor" stroke="none"/>`),

    hr: S(`<path d="M2 8h12"/>`),
};