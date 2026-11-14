// =========================================================
// 快捷键面板
// - 表格三列：描述 / 快捷键 / 操作（编辑·重置·解绑）
// - 编辑：打开全屏捕获浮层，捕获主键后即确定；Esc 取消
// - 冲突：拒绝并提示，不覆盖
// - 保存即写回后端，同时广播给主窗口
// =========================================================

import {
    ACTIONS,
    DEFAULT_SHORTCUTS,
    formatShortcut,
    isModifierCode,
    buildShortcutString,
} from '../core/shortcuts.js';

export const meta = { id: 'shortcuts', title: '快捷键' };

let ctx;
let shortcuts = {};
let captureState = null; // { actionId, overlay, previewEl, pressedMods }

export async function mount(root, context) {
    ctx = context;
    const cfg = ctx.getConfig();
    shortcuts = { ...DEFAULT_SHORTCUTS, ...(cfg.shortcuts || {}) };

    root.innerHTML = `
        <h2 class="settings-panel-title">快捷键</h2>
        <div class="settings-shortcuts-hint">
            点击「编辑」后按下组合键即可绑定。组合键区分左右修饰键，也区分主键盘与小键盘。
            单键绑定（如 <code>A</code>）会拦截编辑器中的该键输入，请谨慎使用。
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
        parts.push(`<thead><tr><th colspan="3" class="settings-table-group">${groupName}</th></tr></thead>`);
        parts.push(`<tbody>`);
        for (const a of actions) {
            const val = shortcuts[a.id] || '';
            const display = val
                ? `<span class="shortcut-key">${escapeHtml(formatShortcut(val))}</span>`
                : `<span class="shortcut-empty">未绑定</span>`;
            parts.push(`
                <tr data-action="${a.id}">
                    <td class="col-desc">${escapeHtml(a.label)}</td>
                    <td class="col-key">${display}</td>
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
        ? `<span class="shortcut-key">${escapeHtml(formatShortcut(val))}</span>`
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
            <div class="shortcut-capture-preview" id="shortcut-capture-preview">请按下快捷键…</div>
            <div class="shortcut-capture-hint">按 Esc 取消（若想绑定 Esc 本身，请加修饰键）</div>
        </div>
    `;
    document.body.appendChild(overlay);

    captureState = {
        actionId,
        overlay,
        previewEl: overlay.querySelector('#shortcut-capture-preview'),
        pressedMods: new Set(),
    };

    window.addEventListener('keydown', onCaptureKeyDown, true);
    window.addEventListener('keyup', onCaptureKeyUp, true);
    window.addEventListener('blur', onCaptureBlur);
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

function onCaptureKeyDown(e) {
    if (!captureState) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    clearCaptureError();

    if (isModifierCode(e.code)) {
        captureState.pressedMods.add(e.code);
        updateCapturePreview();
        return;
    }
    if (e.repeat) return;

    // 无修饰键的 Esc = 取消
    if (e.code === 'Escape' && captureState.pressedMods.size === 0) {
        closeCapture();
        return;
    }

    const str = buildShortcutString(captureState.pressedMods, e.code);
    applyCaptured(captureState.actionId, str);
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

function updateCapturePreview() {
    if (!captureState) return;
    const mods = [...captureState.pressedMods];
    if (mods.length === 0) {
        captureState.previewEl.textContent = '请按下快捷键…';
        return;
    }
    // 只显示已按下的修饰键，后面跟省略号表示等待主键
    captureState.previewEl.textContent =
        mods.map(c => formatShortcut(c)).join(' + ') + ' + …';
}

function applyCaptured(actionId, str) {
    // 冲突检测：拒绝并提示
    const conflict = Object.entries(shortcuts).find(
        ([id, val]) => id !== actionId && val === str
    );
    if (conflict) {
        const conflictMeta = ACTIONS.find(a => a.id === conflict[0]);
        const name = conflictMeta ? conflictMeta.label : conflict[0];
        const box = captureState.overlay.querySelector('.shortcut-capture-box');
        let err = box.querySelector('.shortcut-capture-error');
        if (!err) {
            err = document.createElement('div');
            err.className = 'shortcut-capture-error';
            box.appendChild(err);
        }
        err.textContent = `「${formatShortcut(str)}」已被「${name}」使用`;
        captureState.pressedMods.clear();
        updateCapturePreview();
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