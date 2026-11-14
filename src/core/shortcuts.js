// =========================================================
// 快捷键核心模块
//
// - 使用 KeyboardEvent.code（区分左右修饰键、区分主键盘/小键盘）
// - 修饰键顺序固定：Control → Shift → Alt → Meta
// - 单段存储格式：'ControlLeft+ShiftLeft+KeyS'
// - 多段序列用空格分隔：'ControlLeft+KeyK ControlLeft+KeyS'
// - 空串表示未绑定
//
// 本文件只定义常量和纯函数，不 import 任何 shortcuts 模块。
// =========================================================

export const MOD_ORDER = ['Control', 'Shift', 'Alt', 'Meta'];

// 动作元数据（顺序即设置面板显示顺序）
export const ACTIONS = [
    // 文件
    { id: 'open', label: '打开文件', group: '文件', default: 'ControlLeft+KeyO' },
    { id: 'save', label: '保存', group: '文件', default: 'ControlLeft+KeyS' },
    { id: 'saveAs', label: '另存为', group: '文件', default: 'ControlLeft+ShiftLeft+KeyS' },
    { id: 'openSettings', label: '打开设置', group: '文件', default: 'ControlLeft+AltLeft+Comma' },

    // 行内格式
    { id: 'bold', label: '加粗', group: '格式', default: '' },
    { id: 'italic', label: '斜体', group: '格式', default: '' },
    { id: 'strike', label: '删除线', group: '格式', default: '' },
    { id: 'inlineCode', label: '行内代码', group: '格式', default: '' },
    { id: 'highlight', label: '文本高亮', group: '格式', default: '' },

    // 标题
    { id: 'h1', label: '一级标题', group: '标题', default: '' },
    { id: 'h2', label: '二级标题', group: '标题', default: '' },
    { id: 'h3', label: '三级标题', group: '标题', default: '' },
    { id: 'h4', label: '四级标题', group: '标题', default: '' },
    { id: 'h5', label: '五级标题', group: '标题', default: '' },
    { id: 'h6', label: '六级标题', group: '标题', default: '' },

    // 列表
    { id: 'ul', label: '无序列表', group: '列表', default: '' },
    { id: 'ol', label: '有序列表', group: '列表', default: '' },
    { id: 'task', label: '任务列表', group: '列表', default: '' },

    // 插入
    { id: 'link', label: '链接', group: '插入', default: '' },
    { id: 'image', label: '图片', group: '插入', default: '' },
    { id: 'table', label: '表格', group: '插入', default: '' },
    { id: 'codeBlock', label: '代码块', group: '插入', default: '' },

    // 块级
    { id: 'quote', label: '引用', group: '块级', default: '' },
    { id: 'alert', label: '警示块', group: '块级', default: '' },
    { id: 'hr', label: '分割线', group: '块级', default: '' },
];

export const DEFAULT_SHORTCUTS = Object.fromEntries(
    ACTIONS.map(a => [a.id, a.default])
);

export const FILE_ACTIONS = new Set(['open', 'save', 'saveAs', 'openSettings']);

// ---------- 修饰键判断 ----------

export function isModifierCode(code) {
    return (
        code === 'ControlLeft' || code === 'ControlRight' ||
        code === 'ShiftLeft' || code === 'ShiftRight' ||
        code === 'AltLeft' || code === 'AltRight' ||
        code === 'MetaLeft' || code === 'MetaRight'
    );
}

function modCategory(code) {
    if (code.startsWith('Control')) return 'Control';
    if (code.startsWith('Shift')) return 'Shift';
    if (code.startsWith('Alt')) return 'Alt';
    if (code.startsWith('Meta')) return 'Meta';
    return null;
}

/**
 * 由「当前按下的修饰键集合 + 主键 code」构造规范的单段快捷键字符串。
 * 同一类别（如左右 Ctrl 同时按下）只保留第一个，按固定顺序排列。
 */
export function buildShortcutString(pressedMods, code) {
    const seen = new Set();
    const ordered = [];
    for (const c of pressedMods) {
        const cat = modCategory(c);
        if (!cat || seen.has(cat)) continue;
        seen.add(cat);
        ordered.push(c);
    }
    ordered.sort(
        (a, b) => MOD_ORDER.indexOf(modCategory(a)) - MOD_ORDER.indexOf(modCategory(b))
    );
    return [...ordered, code].join('+');
}

/**
 * 解析单段快捷键字符串为 { mods: Set<code>, key: code }。
 */
export function parseShortcutString(str) {
    if (!str) return null;
    const parts = str.split('+');
    if (!parts.length) return null;
    return {
        mods: new Set(parts.slice(0, -1)),
        key: parts[parts.length - 1],
    };
}

/**
 * 精确匹配：修饰键集合必须完全一致（数量 + 每一项）。
 */
export function matchShortcut(parsed, pressedMods, code) {
    if (!parsed) return false;
    if (parsed.key !== code) return false;
    if (parsed.mods.size !== pressedMods.size) return false;
    for (const m of parsed.mods) {
        if (!pressedMods.has(m)) return false;
    }
    return true;
}

/**
 * 解析多段序列（空格分隔）。
 * 'ControlLeft+KeyK ControlLeft+KeyS'
 *   => [ { mods: Set(['ControlLeft']), key: 'KeyK' },
 *        { mods: Set(['ControlLeft']), key: 'KeyS' } ]
 */
export function parseShortcutSequence(str) {
    if (!str) return null;
    const parts = str.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return null;
    const result = [];
    for (const p of parts) {
        const parsed = parseShortcutString(p);
        if (!parsed) return null;
        result.push(parsed);
    }
    return result;
}

// ---------- 显示名 ----------

const KEY_NAMES = {};

for (let i = 0; i < 26; i++) {
    const c = String.fromCharCode(65 + i);
    KEY_NAMES['Key' + c] = c;
}
for (let i = 0; i <= 9; i++) {
    KEY_NAMES['Digit' + i] = String(i);
    KEY_NAMES['Numpad' + i] = '小键盘' + i;
}
for (let i = 1; i <= 12; i++) {
    KEY_NAMES['F' + i] = 'F' + i;
}

Object.assign(KEY_NAMES, {
    ControlLeft: '左Ctrl', ControlRight: '右Ctrl',
    ShiftLeft: '左Shift', ShiftRight: '右Shift',
    AltLeft: '左Alt', AltRight: '右Alt',
    MetaLeft: '左Win', MetaRight: '右Win',

    Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'",
    BracketLeft: '[', BracketRight: ']', Backslash: '\\', Backquote: '`',
    Minus: '-', Equal: '=',

    Space: '空格', Enter: '回车', Tab: 'Tab', Escape: 'Esc',
    Backspace: '退格', Delete: 'Del', Insert: 'Ins',
    Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',

    NumpadAdd: '小键盘+', NumpadSubtract: '小键盘-',
    NumpadMultiply: '小键盘*', NumpadDivide: '小键盘/',
    NumpadDecimal: '小键盘.', NumpadEnter: '小键盘回车',

    CapsLock: 'CapsLock', NumLock: 'NumLock', ScrollLock: 'ScrollLock',
    PrintScreen: 'PrtSc', Pause: 'Pause', ContextMenu: '菜单键',
    IntlBackslash: '\\', IntlRo: '\\', IntlYen: '¥',
});

/**
 * 单段显示：'ControlLeft+KeyS' => '左Ctrl + S'
 * 未识别的 code 原样输出，便于排查键盘布局问题。
 */
export function formatShortcut(str) {
    if (!str) return '';
    return str.split('+').map(c => KEY_NAMES[c] || c).join(' + ');
}

/**
 * 多段显示：'ControlLeft+KeyK ControlLeft+KeyS'
 *   => '左Ctrl + K，左Ctrl + S'
 */
export function formatShortcutSequence(str) {
    if (!str) return '';
    return str.trim().split(/\s+/).filter(Boolean)
        .map(formatShortcut).join('，');
}