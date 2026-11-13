// =========================================================
// 外观面板：主题三选一 + 设置窗口大小
// =========================================================

const MIN_RATIO_PERCENT = 40;
const THUMB_WIDTH_PX = 16;

const tauri = window.__TAURI__;
const WebviewWindow = tauri?.webviewWindow?.WebviewWindow;
const LogicalSize = tauri?.dpi?.LogicalSize;
const PhysicalPosition = tauri?.dpi?.PhysicalPosition;

export const meta = { id: 'appearance', title: '外观' };

let ctx;
let currentTheme = 'system';
let currentRatio = 80;
let pendingRecenter = null;
let previewRafId = null;
let unlistenParent = [];

export async function mount(root, context) {
    ctx = context;
    const cfg = ctx.getConfig();
    currentTheme = ctx.VALID_THEMES.includes(cfg.theme) ? cfg.theme : 'system';
    currentRatio = typeof cfg.settings_window_ratio === 'number'
        ? Math.max(MIN_RATIO_PERCENT, Math.min(100, Math.round(cfg.settings_window_ratio * 100)))
        : 80;

    root.innerHTML = `
        <h2 class="settings-panel-title">外观</h2>

        <div class="settings-field">
            <div class="settings-field-label">主题</div>
            <div class="settings-field-control">
                <div class="theme-group">
                    <button type="button" class="theme-btn" data-theme="system">跟随系统</button>
                    <button type="button" class="theme-btn" data-theme="dark">深色</button>
                    <button type="button" class="theme-btn" data-theme="light">浅色</button>
                </div>
            </div>
        </div>

        <div class="settings-field">
            <div class="settings-field-label">
                设置窗口大小
                <span class="settings-hint">相对主窗口，拖动即时生效</span>
            </div>
            <div class="settings-field-control">
                <input type="range" id="ratio-input" min="${MIN_RATIO_PERCENT}" max="100" step="5" value="${currentRatio}">
                <span id="ratio-value" class="ratio-value">${currentRatio}%</span>
            </div>
        </div>
    `;

    updateThemeUI();
    bindThemeButtons();
    bindRatio();
    await bindParentTracking();
    await recenterAndResize(currentRatio);
}

export function unmount() {
    unlistenParent.forEach(fn => { try { fn(); } catch (_) { /* noop */ } });
    unlistenParent = [];
    if (previewRafId) cancelAnimationFrame(previewRafId);
    previewRafId = null;
    pendingRecenter = null;
    ctx = null;
}

// ---------- 主题 ----------
function updateThemeUI() {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === currentTheme);
    });
}

async function setTheme(theme) {
    const next = ctx.VALID_THEMES.includes(theme) ? theme : 'system';
    if (next === currentTheme) return;

    currentTheme = next;
    await ctx.applyLocalTheme(currentTheme);
    updateThemeUI();

    try { localStorage.setItem(ctx.THEME_STORAGE_KEY, currentTheme); } catch (_) { /* noop */ }

    await ctx.patchConfig({ theme: currentTheme });

    if (ctx.emit) {
        try {
            await ctx.emit('settings:theme-changed', { theme: currentTheme });
        } catch (e) {
            console.warn('[appearance] emit theme-changed 失败:', e);
        }
    }
}

function bindThemeButtons() {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => setTheme(btn.dataset.theme));
    });
}

// ---------- 尺寸 ----------
async function recenterAndResize(percent) {
    if (!WebviewWindow || !ctx?.getCurrentWindow || !LogicalSize || !PhysicalPosition) return;

    const ratio = Math.max(MIN_RATIO_PERCENT / 100, Math.min(1, percent / 100));
    try {
        const parent = await WebviewWindow.getByLabel('main');
        if (!parent) return;
        const win = ctx.getCurrentWindow();
        const [parentInnerSize, parentOuterPos, parentOuterSize, sf] = await Promise.all([
            parent.innerSize(),
            parent.outerPosition(),
            parent.outerSize(),
            win.scaleFactor(),
        ]);
        const newW = Math.max(360, Math.round((parentInnerSize.width / sf) * ratio));
        const newH = Math.max(260, Math.round((parentInnerSize.height / sf) * ratio));
        const centerX = parentOuterPos.x + parentOuterSize.width / 2;
        const centerY = parentOuterPos.y + parentOuterSize.height / 2;
        const targetX = Math.round(centerX - (newW * sf) / 2);
        const targetY = Math.round(centerY - (newH * sf) / 2);
        await win.setSize(new LogicalSize(newW, newH));
        await win.setPosition(new PhysicalPosition(targetX, targetY));
    } catch (e) {
        console.warn('[appearance] recenterAndResize 失败:', e);
    }
}

function scheduleRecenter(percent) {
    if (pendingRecenter) {
        pendingRecenter.percent = percent;
        return;
    }
    pendingRecenter = { percent };
    previewRafId = requestAnimationFrame(async () => {
        const job = pendingRecenter;
        pendingRecenter = null;
        previewRafId = null;
        await recenterAndResize(job.percent);
    });
}

function updateRatioUI() {
    const input = document.getElementById('ratio-input');
    const value = document.getElementById('ratio-value');
    if (input) input.value = String(currentRatio);
    if (value) value.textContent = currentRatio + '%';
}

async function setRatio(percent) {
    const next = Math.max(MIN_RATIO_PERCENT, Math.min(100, Math.round(percent)));
    if (next === currentRatio) return;

    currentRatio = next;
    updateRatioUI();
    await ctx.patchConfig({ settings_window_ratio: currentRatio / 100 });

    if (ctx.emit) {
        try {
            await ctx.emit('settings:window-ratio-changed', { ratio: currentRatio / 100 });
        } catch (e) {
            console.warn('[appearance] emit window-ratio-changed 失败:', e);
        }
    }
}

function bindRatio() {
    const input = document.getElementById('ratio-input');
    if (!input) return;

    const RANGE = 100 - MIN_RATIO_PERCENT;
    let dragging = false;
    let dragPointerId = null;
    let startX = 0;
    let startValue = 0;
    let dragTrackWidth = 1;

    const valueFromClientX = (clientX) => {
        const rect = input.getBoundingClientRect();
        const usable = Math.max(1, rect.width - THUMB_WIDTH_PX);
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left - THUMB_WIDTH_PX / 2) / usable));
        return Math.round(MIN_RATIO_PERCENT + ratio * RANGE);
    };

    const thumbCenterX = () => {
        const rect = input.getBoundingClientRect();
        const usable = Math.max(1, rect.width - THUMB_WIDTH_PX);
        const ratio = (Number(input.value) - MIN_RATIO_PERCENT) / RANGE;
        return rect.left + THUMB_WIDTH_PX / 2 + ratio * usable;
    };

    const emitInput = (v) => {
        if (Number(input.value) === v) return;
        input.value = String(v);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    input.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const onThumb = Math.abs(e.clientX - thumbCenterX()) <= THUMB_WIDTH_PX / 2 + 2;
        if (!onThumb) emitInput(valueFromClientX(e.clientX));
        dragging = true;
        dragPointerId = e.pointerId;
        startX = e.screenX;
        startValue = Number(input.value);
        dragTrackWidth = Math.max(1, input.getBoundingClientRect().width - THUMB_WIDTH_PX);
        try { input.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
        e.preventDefault();
    });

    input.addEventListener('pointermove', (e) => {
        if (!dragging || e.pointerId !== dragPointerId) return;
        const dx = e.screenX - startX;
        const deltaValue = (dx / dragTrackWidth) * RANGE;
        const next = Math.max(MIN_RATIO_PERCENT, Math.min(100, Math.round(startValue + deltaValue)));
        emitInput(next);
    });

    const endDrag = (e) => {
        if (!dragging) return;
        if (e && e.pointerId !== undefined && e.pointerId !== dragPointerId) return;
        dragging = false;
        dragPointerId = null;
        try { input.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
        setRatio(Number(input.value));
    };

    input.addEventListener('pointerup', endDrag);
    input.addEventListener('pointercancel', endDrag);

    input.addEventListener('input', () => {
        const v = Number(input.value);
        const label = document.getElementById('ratio-value');
        if (label) label.textContent = v + '%';
        scheduleRecenter(v);
    });
}

// ---------- 跟随父窗口 ----------
async function bindParentTracking() {
    if (!WebviewWindow || !ctx?.getCurrentWindow) return;
    try {
        const parent = await WebviewWindow.getByLabel('main');
        if (!parent) return;
        const un1 = await parent.onResized(() => scheduleRecenter(currentRatio));
        const un2 = await parent.onMoved(() => scheduleRecenter(currentRatio));
        unlistenParent.push(un1, un2);
    } catch (e) {
        console.warn('[appearance] 绑定父窗口跟随失败:', e);
    }
}