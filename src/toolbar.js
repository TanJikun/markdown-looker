/**
 * Markdown 工具栏。
 *
 * - 只作用于代码编辑器，预览区选中不生效。
 * - 区1 需要非空选区，其余始终可用。
 * - 每次按钮操作合并为一次撤销步骤。
 * - 「表格」「警示块」下拉面板：直接弹在按钮下方，无黑色遮罩。
 */
import * as monaco from 'monaco-editor';
import { ICONS } from './toolbar-icons.js';

const TASK_OPEN = '- [ ] ';
const TASK_DONE = '- [x] ';
const TASK_PREFIX_LEN = TASK_OPEN.length; // 6

// ---------- 通用工具 ----------

function isPureEmptyLine(content) {
    return content.trim() === '';
}

/**
 * 选区覆盖的整行范围。
 * 若选区结束在下一行行首，不包含该终点行。
 */
function getLineRange(model, sel) {
    const startLine = sel.startLineNumber;
    let endLine = sel.endLineNumber;
    if (sel.endColumn === 1 && endLine > startLine) {
        endLine -= 1;
    }
    return { startLine, endLine };
}

/**
 * 把选区扩展到覆盖整行。
 * 选区结束在行首且不是起始行时，不包含该行。
 */
function expandToLines(model, sel) {
    const startLine = sel.startLineNumber;
    let endLine = sel.endLineNumber;
    if (sel.endColumn === 1 && endLine > startLine) {
        endLine -= 1;
    }
    return {
        startLineNumber: startLine,
        startColumn: 1,
        endLineNumber: endLine,
        endColumn: model.getLineMaxColumn(endLine),
    };
}

function rangeAt(line, col) {
    return {
        startLineNumber: line,
        startColumn: col,
        endLineNumber: line,
        endColumn: col,
    };
}

function rangeLine(line) {
    return {
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: line,
        endColumn: 1,
    };
}

// ---------- 行内格式（区1） ----------

function wrapSelection(editor, left, right) {
    const model = editor.getModel();
    const sel = editor.getSelection();
    if (!model || sel.isEmpty()) return;

    const text = model.getValueInRange(sel);
    const wrapped = left + text + right;

    editor.pushUndoStop();
    editor.executeEdits('md-toolbar', [{
        range: sel,
        text: wrapped,
    }]);

    const start = sel.getStartPosition();
    const lines = wrapped.split('\n');
    let endLine, endCol;
    if (lines.length === 1) {
        endLine = start.lineNumber;
        endCol = start.column + wrapped.length;
    } else {
        endLine = start.lineNumber + lines.length - 1;
        endCol = lines[lines.length - 1].length + 1;
    }

    // ★ 选中整段（例如 `*苹果*` 整串），而不是只把光标停在末尾。
    editor.setSelection(new monaco.Selection(
        start.lineNumber, start.column,
        endLine, endCol
    ));
    editor.pushUndoStop();
}

// ---------- 行级前缀（区2/3/5 引用） ----------

function applyLinePrefixes(editor, getPrefix) {
    const model = editor.getModel();
    const sel = editor.getSelection();
    if (!model) return;

    const { startLine, endLine } = getLineRange(model, sel);

    const edits = [];
    let nonEmptyIndex = 0;

    for (let line = startLine; line <= endLine; line++) {
        const content = model.getLineContent(line);
        const empty = isPureEmptyLine(content);
        const prefix = getPrefix({ line, content, empty, nonEmptyIndex });
        if (!empty) nonEmptyIndex++;
        if (prefix) {
            edits.push({ range: rangeLine(line), text: prefix });
        }
    }

    if (!edits.length) return;

    editor.pushUndoStop();
    editor.executeEdits('md-toolbar', edits);

    const lastContent = model.getLineContent(endLine);
    editor.setPosition({ lineNumber: endLine, column: lastContent.length + 1 });
    editor.revealLineInCenterIfOutsideViewport(endLine);
    editor.pushUndoStop();
}

function applyHeading(editor, level) {
    const prefix = '#'.repeat(level) + ' ';
    applyLinePrefixes(editor, () => prefix);
}

function applyUl(editor) {
    applyLinePrefixes(editor, () => '- ');
}

function applyOl(editor) {
    applyLinePrefixes(editor, ({ empty, nonEmptyIndex }) => {
        if (empty) return '';
        return `${nonEmptyIndex + 1}. `;
    });
}

function applyQuote(editor) {
    applyLinePrefixes(editor, () => '> ');
}

// ---------- 任务列表（区3，唯一非叠加） ----------

function applyTaskToggle(editor) {
    const model = editor.getModel();
    const sel = editor.getSelection();
    if (!model) return;

    const { startLine, endLine } = getLineRange(model, sel);
    const edits = [];

    for (let line = startLine; line <= endLine; line++) {
        const content = model.getLineContent(line);
        if (content.startsWith(TASK_OPEN)) {
            edits.push({
                range: {
                    startLineNumber: line, startColumn: 1,
                    endLineNumber: line, endColumn: TASK_PREFIX_LEN + 1,
                },
                text: TASK_DONE,
            });
        } else if (content.startsWith(TASK_DONE)) {
            edits.push({
                range: {
                    startLineNumber: line, startColumn: 1,
                    endLineNumber: line, endColumn: TASK_PREFIX_LEN + 1,
                },
                text: TASK_OPEN,
            });
        } else {
            edits.push({ range: rangeLine(line), text: TASK_OPEN });
        }
    }

    editor.pushUndoStop();
    editor.executeEdits('md-toolbar', edits);

    const lastContent = model.getLineContent(endLine);
    editor.setPosition({ lineNumber: endLine, column: lastContent.length + 1 });
    editor.revealLineInCenterIfOutsideViewport(endLine);
    editor.pushUndoStop();
}

// ---------- 链接 / 图片（区4） ----------

function insertLink(editor) {
    const model = editor.getModel();
    const sel = editor.getSelection();
    if (!model) return;

    if (sel.isEmpty()) {
        editor.pushUndoStop();
        editor.executeEdits('md-toolbar', [{
            range: sel,
            text: '[]()',
        }]);
        editor.setPosition({
            lineNumber: sel.startLineNumber,
            column: sel.startColumn + 1,
        });
        editor.pushUndoStop();
        return;
    }

    const text = model.getValueInRange(sel);
    const startOffset = model.getOffsetAt(sel.getStartPosition());
    const linkText = `[${text}](url)`;

    editor.pushUndoStop();
    editor.executeEdits('md-toolbar', [{
        range: sel,
        text: linkText,
    }]);

    const urlStart = model.getPositionAt(startOffset + text.length + 3);
    const urlEnd = model.getPositionAt(startOffset + text.length + 6);
    editor.setSelection(new monaco.Selection(
        urlStart.lineNumber, urlStart.column,
        urlEnd.lineNumber, urlEnd.column
    ));
    editor.pushUndoStop();
}

function insertImage(editor) {
    const model = editor.getModel();
    const sel = editor.getSelection();
    if (!model) return;

    const text = sel.isEmpty() ? '' : model.getValueInRange(sel);
    const startOffset = model.getOffsetAt(sel.getStartPosition());
    const imgText = `![${text}](url)`;

    editor.pushUndoStop();
    editor.executeEdits('md-toolbar', [{
        range: sel,
        text: imgText,
    }]);

    const urlStart = model.getPositionAt(startOffset + text.length + 4);
    const urlEnd = model.getPositionAt(startOffset + text.length + 7);
    editor.setSelection(new monaco.Selection(
        urlStart.lineNumber, urlStart.column,
        urlEnd.lineNumber, urlEnd.column
    ));
    editor.pushUndoStop();
}

// ---------- 表格（区4） ----------

function generateTable(rows, cols) {
    const cell = '  ';
    const header = '|' + Array(cols).fill(cell).join('|') + '|';
    if (rows === 1) return header;

    const separator = '|' + Array(cols).fill(' --- ').join('|') + '|';
    const dataRow = '|' + Array(cols).fill(cell).join('|') + '|';
    const lines = [header, separator];
    for (let i = 0; i < rows - 2; i++) lines.push(dataRow);
    return lines.join('\n');
}

function insertTable(editor, rows, cols) {
    const table = generateTable(rows, cols);
    const model = editor.getModel();
    const sel = editor.getSelection();
    if (!model) return;

    editor.pushUndoStop();

    if (!sel.isEmpty()) {
        const endPos = sel.getEndPosition();
        const insertText = '\n' + table + '\n';
        const offset = model.getOffsetAt(endPos);

        editor.executeEdits('md-toolbar', [{
            range: rangeAt(endPos.lineNumber, endPos.column),
            text: insertText,
        }]);

        editor.setPosition(model.getPositionAt(offset + insertText.length));
    } else {
        const pos = sel.getStartPosition();
        const hasContent = model.getLineContent(pos.lineNumber).trim() !== '';
        const prefix = hasContent ? '\n' : '';
        const insertText = prefix + table + '\n';
        const offset = model.getOffsetAt(pos);

        editor.executeEdits('md-toolbar', [{
            range: rangeAt(pos.lineNumber, pos.column),
            text: insertText,
        }]);

        editor.setPosition(model.getPositionAt(offset + insertText.length));
    }

    editor.revealPositionInCenterIfOutsideViewport(editor.getPosition());
    editor.pushUndoStop();
}

// ---------- 代码块（区4） ----------

function insertCodeBlock(editor) {
    const model = editor.getModel();
    const sel = editor.getSelection();
    if (!model) return;

    editor.pushUndoStop();

    if (sel.isEmpty()) {
        const pos = sel.getStartPosition();
        editor.executeEdits('md-toolbar', [{
            range: rangeAt(pos.lineNumber, pos.column),
            text: '```\n```',
        }]);
        editor.setPosition({ lineNumber: pos.lineNumber, column: pos.column + 3 });
    } else {
        const expanded = expandToLines(model, sel);
        const text = model.getValueInRange(expanded);
        const newText = '```\n' + text + '\n```';

        editor.executeEdits('md-toolbar', [{
            range: expanded,
            text: newText,
        }]);

        editor.setPosition({ lineNumber: expanded.startLineNumber, column: 4 });
    }

    editor.revealPositionInCenterIfOutsideViewport(editor.getPosition());
    editor.pushUndoStop();
}

// ---------- 警示块（区5） ----------

const ALERT_TYPES = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'];

function insertAlert(editor, type) {
    const model = editor.getModel();
    const sel = editor.getSelection();
    if (!model) return;

    editor.pushUndoStop();

    if (sel.isEmpty()) {
        const pos = sel.getStartPosition();
        const hasContent = model.getLineContent(pos.lineNumber).trim() !== '';
        const prefix = hasContent ? '\n' : '';
        const insertText = prefix + `> [!${type}]\n> `;
        const offset = model.getOffsetAt(pos);

        editor.executeEdits('md-toolbar', [{
            range: rangeAt(pos.lineNumber, pos.column),
            text: insertText,
        }]);

        editor.setPosition(model.getPositionAt(offset + insertText.length));
    } else {
        const expanded = expandToLines(model, sel);
        const text = model.getValueInRange(expanded);
        const quoted = text.split('\n').map(l => '> ' + l).join('\n');
        const newText = `> [!${type}]\n` + quoted;
        const startOffset = model.getOffsetAt({
            lineNumber: expanded.startLineNumber,
            column: expanded.startColumn,
        });

        editor.executeEdits('md-toolbar', [{
            range: expanded,
            text: newText,
        }]);

        editor.setPosition(model.getPositionAt(startOffset + newText.length));
    }

    editor.revealPositionInCenterIfOutsideViewport(editor.getPosition());
    editor.pushUndoStop();
}

// ---------- 分割线（区5） ----------

function insertHr(editor) {
    const model = editor.getModel();
    const sel = editor.getSelection();
    if (!model) return;

    editor.pushUndoStop();

    if (!sel.isEmpty()) {
        const endPos = sel.getEndPosition();
        const insertText = '\n---\n';
        const offset = model.getOffsetAt(endPos);

        editor.executeEdits('md-toolbar', [{
            range: rangeAt(endPos.lineNumber, endPos.column),
            text: insertText,
        }]);

        editor.setPosition(model.getPositionAt(offset + insertText.length));
    } else {
        const pos = sel.getStartPosition();
        const hasContent = model.getLineContent(pos.lineNumber).trim() !== '';
        const prefix = hasContent ? '\n' : '';
        const insertText = prefix + '---\n';
        const offset = model.getOffsetAt(pos);

        editor.executeEdits('md-toolbar', [{
            range: rangeAt(pos.lineNumber, pos.column),
            text: insertText,
        }]);

        editor.setPosition(model.getPositionAt(offset + insertText.length));
    }

    editor.revealPositionInCenterIfOutsideViewport(editor.getPosition());
    editor.pushUndoStop();
}

// ---------- 下拉面板（替代原遮罩弹窗） ----------

let currentPanel = null; // { el, anchor, cleanup }

function closePanel() {
    if (!currentPanel) return;
    currentPanel.cleanup();
    currentPanel.el.remove();
    currentPanel = null;
}

/**
 * 在 anchorEl 下方弹出面板。
 * 面板是独立的 fixed 定位元素，不带遮罩；点击外部或尺寸变化时自动关闭。
 * 再次点击同一按钮 => toggle 关闭。
 */
function openPanel(anchorEl, buildContent) {
    if (currentPanel && currentPanel.anchor === anchorEl) {
        closePanel();
        return;
    }
    closePanel();

    const panel = document.createElement('div');
    panel.className = 'toolbar-dropdown';
    // 先在隐藏状态下挂到 body，测量宽高
    panel.style.visibility = 'hidden';
    document.body.appendChild(panel);
    buildContent(panel);

    const rect = anchorEl.getBoundingClientRect();
    const panelW = panel.offsetWidth;
    const panelH = panel.offsetHeight;

    let left = rect.left;
    if (left + panelW > window.innerWidth - 8) {
        left = Math.max(8, rect.right - panelW);
    }
    let top = rect.bottom + 4;
    if (top + panelH > window.innerHeight - 8) {
        top = Math.max(8, rect.top - panelH - 4);
    }
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    panel.style.visibility = '';

    const onMouseDown = (e) => {
        if (panel.contains(e.target)) return;
        if (anchorEl.contains(e.target)) return;
        closePanel();
    };
    const onResize = () => closePanel();

    // 延迟一帧注册，避免本次点击的 mousedown 立即关闭面板
    setTimeout(() => {
        document.addEventListener('mousedown', onMouseDown, true);
        const firstInput = panel.querySelector('input');
        if (firstInput) {
            firstInput.focus();
            firstInput.select();
        }
    }, 0);
    window.addEventListener('resize', onResize);

    currentPanel = {
        el: panel,
        anchor: anchorEl,
        cleanup: () => {
            document.removeEventListener('mousedown', onMouseDown, true);
            window.removeEventListener('resize', onResize);
        },
    };
}

function openTablePanel(anchorEl, editor, afterEdit) {
    openPanel(anchorEl, (panel) => {
        panel.innerHTML = `
            <div class="toolbar-dropdown-section">
                <label class="toolbar-dropdown-row">
                    <span>行数</span>
                    <input class="toolbar-dropdown-input" type="number"
                           value="1" min="1" step="1" data-role="rows">
                </label>
                <label class="toolbar-dropdown-row">
                    <span>列数</span>
                    <input class="toolbar-dropdown-input" type="number"
                           value="1" min="1" step="1" data-role="cols">
                </label>
            </div>
            <div class="toolbar-dropdown-footer">
                <button type="button" class="toolbar-dropdown-btn toolbar-dropdown-btn-primary"
                        data-role="confirm">确定</button>
            </div>
        `;

        const rowsInput = panel.querySelector('[data-role="rows"]');
        const colsInput = panel.querySelector('[data-role="cols"]');
        const confirmBtn = panel.querySelector('[data-role="confirm"]');

        const isPosInt = (v) => {
            const n = Number(v);
            return Number.isInteger(n) && n >= 1;
        };
        const refresh = () => {
            confirmBtn.disabled = !(isPosInt(rowsInput.value) && isPosInt(colsInput.value));
        };

        const confirm = () => {
            const r = Number(rowsInput.value);
            const c = Number(colsInput.value);
            if (!Number.isInteger(r) || r < 1) return;
            if (!Number.isInteger(c) || c < 1) return;
            insertTable(editor, r, c);
            closePanel();
            editor.focus();
            afterEdit();
        };

        rowsInput.addEventListener('input', refresh);
        colsInput.addEventListener('input', refresh);
        const onKeyDown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (confirmBtn.disabled) return;
                confirm();
            }
        };
        rowsInput.addEventListener('keydown', onKeyDown);
        colsInput.addEventListener('keydown', onKeyDown);
        confirmBtn.addEventListener('click', confirm);
        refresh();
    });
}

function openAlertPanel(anchorEl, editor, afterEdit) {
    openPanel(anchorEl, (panel) => {
        panel.innerHTML = ALERT_TYPES.map(t => `
            <button type="button" class="toolbar-dropdown-item" data-type="${t}">${t}</button>
        `).join('');

        panel.addEventListener('click', (e) => {
            const btn = e.target.closest('.toolbar-dropdown-item');
            if (!btn) return;
            insertAlert(editor, btn.dataset.type);
            closePanel();
            editor.focus();
            afterEdit();
        });
    });
}

// ---------- DOM 构建 ----------

const BUTTONS = [
    { group: 1, action: 'bold', title: '加粗', text: 'B', style: 'font-weight:800' },
    { group: 1, action: 'italic', title: '斜体', text: 'I', style: 'font-style:italic;font-family:Georgia,serif' },
    { group: 1, action: 'strike', title: '删除线', text: 'S', style: 'text-decoration:line-through' },
    { group: 1, action: 'inlineCode', title: '行内代码', icon: 'inlineCode' },
    { group: 1, action: 'highlight', title: '文本高亮', icon: 'highlight' },

    { group: 2, action: 'h1', title: '一级标题', text: 'H1' },
    { group: 2, action: 'h2', title: '二级标题', text: 'H2' },
    { group: 2, action: 'h3', title: '三级标题', text: 'H3' },
    { group: 2, action: 'h4', title: '四级标题', text: 'H4' },
    { group: 2, action: 'h5', title: '五级标题', text: 'H5' },
    { group: 2, action: 'h6', title: '六级标题', text: 'H6' },

    { group: 3, action: 'ul', title: '无序列表', icon: 'ul' },
    { group: 3, action: 'ol', title: '有序列表', icon: 'ol' },
    { group: 3, action: 'task', title: '任务列表', icon: 'task' },

    { group: 4, action: 'link', title: '链接', icon: 'link' },
    { group: 4, action: 'image', title: '图片', icon: 'image' },
    { group: 4, action: 'table', title: '表格', icon: 'table' },
    { group: 4, action: 'codeBlock', title: '代码块', icon: 'codeBlock' },

    { group: 5, action: 'quote', title: '引用', icon: 'quote' },
    { group: 5, action: 'alert', title: '警示块', icon: 'alert' },
    { group: 5, action: 'hr', title: '分割线', icon: 'hr' },
];

const INLINE_ACTIONS = new Set(['bold', 'italic', 'strike', 'inlineCode', 'highlight']);

function buildButton(spec) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'md-toolbar-btn';
    btn.title = spec.title;
    btn.dataset.action = spec.action;

    if (spec.text) {
        const span = document.createElement('span');
        span.textContent = spec.text;
        if (spec.style) span.style.cssText = spec.style;
        btn.appendChild(span);
    } else if (spec.icon) {
        btn.innerHTML = ICONS[spec.icon] || '';
    }

    return btn;
}

// ---------- 初始化 ----------

export function initToolbar(editor, options = {}) {
    const container = document.getElementById('md-toolbar');
    if (!container) return null;

    const { refreshPreview } = options;

    const inlineButtons = [];

    let currentGroup = 0;
    for (const spec of BUTTONS) {
        if (spec.group !== currentGroup) {
            if (currentGroup !== 0) {
                const sep = document.createElement('span');
                sep.className = 'toolbar-sep';
                sep.setAttribute('aria-hidden', 'true');
                container.appendChild(sep);
            }
            currentGroup = spec.group;
        }
        const btn = buildButton(spec);
        if (INLINE_ACTIONS.has(spec.action)) {
            btn.disabled = true;
            inlineButtons.push(btn);
        }
        container.appendChild(btn);
    }

    const refreshInline = () => {
        const sel = editor.getSelection();
        const enabled = !!sel && !sel.isEmpty();
        for (const b of inlineButtons) b.disabled = !enabled;
    };

    const afterEdit = () => {
        if (typeof refreshPreview === 'function') {
            try { refreshPreview(); } catch (e) { console.error(e); }
        }
        refreshInline();
    };

    const getButton = (action) =>
        container.querySelector(`.md-toolbar-btn[data-action="${action}"]`);

    const isActionAvailable = (action) => {
        if (!INLINE_ACTIONS.has(action)) return true;
        const sel = editor.getSelection();
        return !!sel && !sel.isEmpty();
    };

    // ★ 核心：把所有动作统一收口到一个函数，按钮 click 与快捷键都走这里。
    const dispatchAction = (action) => {
        if (!isActionAvailable(action)) return;

        const btn = getButton(action);
        // table / alert 的下拉面板需要锚点；快捷键触发时锚到工具栏按钮下方
        const anchor = btn || editor.getDomNode() || document.body;

        switch (action) {
            case 'bold': wrapSelection(editor, '**', '**'); break;
            case 'italic': wrapSelection(editor, '*', '*'); break;
            case 'strike': wrapSelection(editor, '~~', '~~'); break;
            case 'inlineCode': wrapSelection(editor, '`', '`'); break;
            case 'highlight': wrapSelection(editor, '<mark>', '</mark>'); break;

            case 'h1': applyHeading(editor, 1); break;
            case 'h2': applyHeading(editor, 2); break;
            case 'h3': applyHeading(editor, 3); break;
            case 'h4': applyHeading(editor, 4); break;
            case 'h5': applyHeading(editor, 5); break;
            case 'h6': applyHeading(editor, 6); break;

            case 'ul': applyUl(editor); break;
            case 'ol': applyOl(editor); break;
            case 'task': applyTaskToggle(editor); break;

            case 'link': insertLink(editor); break;
            case 'image': insertImage(editor); break;
            case 'table': openTablePanel(anchor, editor, afterEdit); return;
            case 'codeBlock': insertCodeBlock(editor); break;

            case 'quote': applyQuote(editor); break;
            case 'alert': openAlertPanel(anchor, editor, afterEdit); return;
            case 'hr': insertHr(editor); break;
        }
        afterEdit();
        editor.focus();
    };

    container.addEventListener('mousedown', (e) => {
        const btn = e.target.closest('.md-toolbar-btn');
        if (!btn || btn.disabled) return;
        e.preventDefault();
    }, true);

    container.addEventListener('click', (e) => {
        const btn = e.target.closest('.md-toolbar-btn');
        if (!btn || btn.disabled) return;
        e.preventDefault();
        dispatchAction(btn.dataset.action);
    });

    editor.onDidChangeCursorSelection(refreshInline);
    editor.onDidChangeModelContent(refreshInline);

    refreshInline();

    return {
        dispatchAction,
        getButtonElement: getButton,
        isActionAvailable,
    };
}