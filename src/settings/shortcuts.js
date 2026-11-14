// =========================================================
// 快捷键面板
// - 表格三列：描述 / 快捷键 / 操作（编辑·重置·解绑）
// - 编辑：全屏捕获浮层
//     · 修饰键 + 主键 → 追加一段（不关闭浮层）
//     · 可连续追加多段
//     · 回车（主/小键盘）→ 确认并关闭
//     · 退格 → 删除最后一段
//     · Esc → 取消
// - 冲突：拒绝并提示，不覆盖
// =========================================================

import {
    ACTIONS,
    DEFAULT_SHORTCUTS,
    formatShortcut,
    formatShortcutSequence,
    isModifierCode,
    buildShortcutString,
} from '../core/shortcuts.js';

export const meta = { id: 'shortcuts', title: '快捷键' };

let ctx;
let shortcuts = {};
let captureState = null;

export async function mount(root, context) {
    ctx = context;
    const cfg = ctx.getConfig();
    shortcuts = { ...DEFAULT_SHORTCUTS, ...(cfg.shortcuts || {}) };

    root.innerHTML = `
        <h2 class="settings-panel-title">快捷键</h2>
        <div class="settings-shortcuts-hint">
            点击「编辑」进入捕获：
            <b>修饰键 + 主键</b> 追加一段，可连续追加多段；
            <b>回车</b>（主/小键盘均可）确认；
            <b>退格</b> 删除最后一段；<b>Esc</b> 取消。
            组合键区分左右修饰键，也区分主键盘与小键盘。
        </div>
        <div id="shortcuts-table-host"></div>
    `;

    renderTable();
}

export function unmount() {
    closeCapture();
    ctx = null;
    shortcuts = {};
}

// ---------- 表格 ----------

function renderTable() {
    const host = document.getElementById('shortcuts-table-host');
    if (!host) return;

    const groups = new Map();
    for (const a of ACTIONS) {
        if (!groups.has(a.group)) groups.set(a.group, []);
        groups.get(a.group).push(a);
    }

    const parts = [];
    for (const [groupName, actions] of groups) {
        parts.push(`<table class="settings-table">`);
        parts.push(`<thead><tr><th colspan="3" class="settings-table-group">${escapeHtml(groupName)}</th></tr></thead>`);
        parts.push(`<tbody>`);
        for (const a of actions) {
            parts.push(`
                <tr data-action="${a.id}">
                    <td class="col-desc">${escapeHtml(a.label)}</td>
                    <td class="col-key"></td>
                    <td class="col-ops">
                        <button type="button" class="settings-action-btn" data-op="edit" data-id="${a.id}">编辑</button>
                        <button type="button" class="settings-action-btn" data-op="reset" data-id="${a.id}">重置</button>
                        <button type="button" class="settings-action-btn" data-op="unbind" data-id="${a.id}">解绑</button>
                    </td>
                </tr>
            `);
        }
        parts.push(`</tbody></table>`);
    }

    host.innerHTML = parts.join('');
    host.addEventListener('click', onTableClick);

    for (const a of ACTIONS) refreshRow(a.id);
}

function onTableClick(e) {
    const btn = e.target.closest('button[data-op]');
    if (!btn) return;
    const op = btn.dataset.op;
    const id = btn.dataset.id;
    if (!id) return;
    if (op === 'edit') startCapture(id);
    else if (op === 'reset') resetAction(id);
    else if (op === 'unbind') unbindAction(id);
}

function refreshRow(id) {
    const row = document.querySelector(`tr[data-action="${id}"]`);
    if (!row) return;
    const keyEl = row.querySelector('.col-key');
    if (!keyEl) return;
    const val = shortcuts[id] || '';
    keyEl.innerHTML = val
        ? `<span class="shortcut-key">${escapeHtml(formatShortcutSequence(val))}</span>`
        : `<span class="shortcut-empty">未绑定</span>`;
}

async function resetAction(id) {
    shortcuts[id] = DEFAULT_SHORTCUTS[id] || '';
    refreshRow(id);
    await persist();
}

async function unbindAction(id) {
    shortcuts[id] = '';
    refreshRow(id);
    await persist();
}

async function persist() {
    await ctx.patchConfig({ shortcuts: { ...shortcuts } });
    if (ctx.emit) {
        try {
            await ctx.emit('settings:shortcuts-changed', { shortcuts: { ...shortcuts } });
        } catch (e) {
            console.warn('[shortcuts] emit 失败:', e);
        }
    }
}

// ---------- 捕获浮层 ----------

function startCapture(actionId) {
    closeCapture();

    const actionMeta = ACTIONS.find(a => a.id === actionId);
    if (!actionMeta) return;

    const overlay = document.createElement('div');
    overlay.className = 'shortcut-capture-overlay';
    overlay.innerHTML = `
        <div class="shortcut-capture-box">
            <div class="shortcut-capture-title">为「${escapeHtml(actionMeta.label)}」设置快捷键</div>
            <div class="shortcut-capture-preview" id="shortcut-capture-preview"></div>
            <div class="shortcut-capture-hint">
                修饰键 + 主键追加一段；回车确认；退格删除最后一段；Esc 取消
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    captureState = {
        actionId,
        overlay,
        previewEl: overlay.querySelector('#shortcut-capture-preview'),
        pressedMods: new Set(),
        segments: [],
    };

    window.addEventListener('keydown', onCaptureKeyDown, true);
    window.addEventListener('keyup', onCaptureKeyUp, true);
    window.addEventListener('blur', onCaptureBlur);
    updateCapturePreview();
}

function closeCapture() {
    if (!captureState) return;
    window.removeEventListener('keydown', onCaptureKeyDown, true);
    window.removeEventListener('keyup', onCaptureKeyUp, true);
    window.removeEventListener('blur', onCaptureBlur);
    captureState.overlay.remove();
    captureState = null;
}

function onCaptureBlur() {
    if (!captureState) return;
    captureState.pressedMods.clear();
    updateCapturePreview();
}

function clearCaptureError() {
    if (!captureState) return;
    const box = captureState.overlay.querySelector('.shortcut-capture-box');
    const err = box.querySelector('.shortcut-capture-error');
    if (err) err.remove();
}

function showCaptureError(text) {
    if (!captureState) return;
    const box = captureState.overlay.querySelector('.shortcut-capture-box');
    let err = box.querySelector('.shortcut-capture-error');
    if (!err) {
        err = document.createElement('div');
        err.className = 'shortcut-capture-error';
        box.appendChild(err);
    }
    err.textContent = text;
}

function updateCapturePreview() {
    if (!captureState) return;
    const { segments, pressedMods } = captureState;

    const parts = segments.map(s => formatShortcut(s));

    if (pressedMods.size > 0) {
        const modsDisplay = [...pressedMods].map(c => formatShortcut(c)).join(' + ');
        parts.push(modsDisplay + ' + …');
    }

    captureState.previewEl.textContent = parts.length
        ? parts.join('，')
        : '请按下快捷键序列…';
}

function onCaptureKeyDown(e) {
    if (!captureState) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    clearCaptureError();

    if (e.repeat) return;

    // 回车（主/小键盘）确认
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        if (captureState.segments.length > 0) {
            const str = captureState.segments.join(' ');
            applyCaptured(captureState.actionId, str);
        }
        return;
    }

    // Esc 取消（无修饰键时）
    if (e.code === 'Escape' && captureState.pressedMods.size === 0) {
        closeCapture();
        return;
    }

    // 退格删除最后一段
    if (e.code === 'Backspace') {
        if (captureState.segments.length > 0) {
            captureState.segments.pop();
            updateCapturePreview();
        }
        return;
    }

    // 修饰键：加入当前集合，更新预览
    if (isModifierCode(e.code)) {
        captureState.pressedMods.add(e.code);
        updateCapturePreview();
        return;
    }

    // 主键：构造一段，追加到 segments（不关闭浮层）
    const segment = buildShortcutString(captureState.pressedMods, e.code);
    captureState.segments.push(segment);
    updateCapturePreview();
}

function onCaptureKeyUp(e) {
    if (!captureState) return;
    e.preventDefault();
    e.stopPropagation();
    if (isModifierCode(e.code)) {
        captureState.pressedMods.delete(e.code);
        updateCapturePreview();
    }
}

function applyCaptured(actionId, str) {
    // 冲突检测（按完整序列比较）
    const conflict = Object.entries(shortcuts).find(
        ([id, val]) => id !== actionId && val === str
    );
    if (conflict) {
        const conflictMeta = ACTIONS.find(a => a.id === conflict[0]);
        const name = conflictMeta ? conflictMeta.label : conflict[0];
        showCaptureError(`「${formatShortcutSequence(str)}」已被「${name}」使用`);
        return;
    }

    shortcuts[actionId] = str;
    refreshRow(actionId);
    closeCapture();
    persist();
}

// ---------- 工具 ----------

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}