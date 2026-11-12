/**
 * Markdown 工具栏。
 *
 * - 只作用于代码编辑器，预览区选中不生效。
 * - 区1 需要非空选区，其余始终可用。
 * - 每次按钮操作合并为一次撤销步骤。
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

function rangeFullLine(model, line) {
    return {
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: line,
        endColumn: model.getLineMaxColumn(line),
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

    // 光标放到包裹后
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
    editor.setPosition({ lineNumber: endLine, column: endCol });
    editor.pushUndoStop();
}

// ---------- 行级前缀（区2/3/5 引用） ----------

/**
 * 对选区覆盖的每一行行首插入前缀。
 * getPrefix({ line, content, empty, nonEmptyIndex }) 返回要插入的字符串；
 * 返回空字符串表示不插入。
 * nonEmptyIndex 为当前行之前非空行的数量（0-based）。
 */
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

    // 选中占位符 url
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

// ---------- 弹窗 ----------

function showModal({ title, body, validate, onConfirm }) {
    const overlay = document.createElement('div');
    overlay.className = 'toolbar-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'toolbar-modal';
    modal.innerHTML = `
        <div class="toolbar-modal-title">${title}</div>
        <div class="toolbar-modal-body">${body}</div>
        <div class="toolbar-modal-footer">
            <button type="button" class="toolbar-modal-cancel">取消</button>
            <button type="button" class="toolbar-modal-confirm">确定</button>
        </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const confirmBtn = modal.querySelector('.toolbar-modal-confirm');
    const cancelBtn = modal.querySelector('.toolbar-modal-cancel');

    const updateConfirm = () => {
        confirmBtn.disabled = !validate();
    };
    updateConfirm();

    modal.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', updateConfirm);
        inp.addEventListener('change', updateConfirm);
    });

    const close = () => {
        overlay.remove();
    };

    cancelBtn.addEventListener('click', close);

    confirmBtn.addEventListener('click', () => {
        if (!validate()) return;
        onConfirm();
        close();
    });

    // 点击弹窗外关闭；不支持 ESC
    overlay.addEventListener('mousedown', (e) => {
        if (e.target === overlay) close();
    });

    // 聚焦第一个输入框
    const firstInput = modal.querySelector('input');
    if (firstInput) firstInput.focus();
}

function isValidPositiveInt(value) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 1;
}

function openTableDialog(editor) {
    showModal({
        title: '插入表格',
        body: `
            <div class="toolbar-modal-row">
                <label for="md-toolbar-table-rows">行数</label>
                <input id="md-toolbar-table-rows" class="toolbar-modal-input"
                       type="number" value="1" min="1" step="1">
            </div>
            <div class="toolbar-modal-row">
                <label for="md-toolbar-table-cols">列数</label>
                <input id="md-toolbar-table-cols" class="toolbar-modal-input"
                       type="number" value="1" min="1" step="1">
            </div>
        `,
        validate: () => {
            const r = document.getElementById('md-toolbar-table-rows');
            const c = document.getElementById('md-toolbar-table-cols');
            if (!r || !c) return false;
            return isValidPositiveInt(r.value) && isValidPositiveInt(c.value);
        },
        onConfirm: () => {
            const r = document.getElementById('md-toolbar-table-rows');
            const c = document.getElementById('md-toolbar-table-cols');
            if (!r || !c) return;
            const rows = parseInt(r.value, 10);
            const cols = parseInt(c.value, 10);
            insertTable(editor, rows, cols);
        },
    });
}

function openAlertDialog(editor) {
    showModal({
        title: '插入警示块',
        body: `
            <div class="toolbar-alert-options">
                ${ALERT_TYPES.map(t => `
                    <label class="toolbar-alert-option">
                        <input type="radio" name="md-toolbar-alert-type" value="${t}"
                               ${t === 'NOTE' ? 'checked' : ''}>
                        <span>${t}</span>
                    </label>
                `).join('')}
            </div>
        `,
        validate: () => {
            const el = document.querySelector('input[name="md-toolbar-alert-type"]:checked');
            return !!el;
        },
        onConfirm: () => {
            const el = document.querySelector('input[name="md-toolbar-alert-type"]:checked');
            if (!el) return;
            insertAlert(editor, el.value);
        },
    });
}

// ---------- DOM 构建 ----------

const BUTTONS = [
    // 区1
    { group: 1, action: 'bold', title: '加粗', text: 'B', style: 'font-weight:800' },
    { group: 1, action: 'italic', title: '斜体', text: 'I', style: 'font-style:italic;font-family:Georgia,serif' },
    { group: 1, action: 'strike', title: '删除线', text: 'S', style: 'text-decoration:line-through' },
    { group: 1, action: 'inlineCode', title: '行内代码', icon: 'inlineCode' },
    { group: 1, action: 'highlight', title: '文本高亮', icon: 'highlight' },

    // 区2
    { group: 2, action: 'h1', title: '一级标题', text: 'H1' },
    { group: 2, action: 'h2', title: '二级标题', text: 'H2' },
    { group: 2, action: 'h3', title: '三级标题', text: 'H3' },
    { group: 2, action: 'h4', title: '四级标题', text: 'H4' },
    { group: 2, action: 'h5', title: '五级标题', text: 'H5' },
    { group: 2, action: 'h6', title: '六级标题', text: 'H6' },

    // 区3
    { group: 3, action: 'ul', title: '无序列表', icon: 'ul' },
    { group: 3, action: 'ol', title: '有序列表', icon: 'ol' },
    { group: 3, action: 'task', title: '任务列表', icon: 'task' },

    // 区4
    { group: 4, action: 'link', title: '链接', icon: 'link' },
    { group: 4, action: 'image', title: '图片', icon: 'image' },
    { group: 4, action: 'table', title: '表格', icon: 'table' },
    { group: 4, action: 'codeBlock', title: '代码块', icon: 'codeBlock' },

    // 区5
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
    if (!container) return;

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

    const dispatch = (action) => {
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
            case 'table': openTableDialog(editor); return;
            case 'codeBlock': insertCodeBlock(editor); break;

            case 'quote': applyQuote(editor); break;
            case 'alert': openAlertDialog(editor); return;
            case 'hr': insertHr(editor); break;
        }
        afterEdit();
    };

    container.addEventListener('click', (e) => {
        const btn = e.target.closest('.md-toolbar-btn');
        if (!btn || btn.disabled) return;
        e.preventDefault();
        dispatch(btn.dataset.action);
    });

    // 实时刷新区1按钮可用性
    editor.onDidChangeCursorSelection(refreshInline);
    editor.onDidChangeModelContent(refreshInline);

    refreshInline();
}