// =========================================================
// 设置窗口脚本
// 职责：
//   - 读取/展示 config（theme、settings_window_ratio）
//   - 主题切换：应用本窗口 + 持久化 + emit 到主窗口
//   - 窗口大小滑块：即时预览 + 持久化 + emit
//   - 始终保持父窗口中央（父窗口 resize/move 时跟随）
//   - 缩放窗口时把光标同步到滑块 thumb 上，防止滑块跳变
// =========================================================

const THEME_STORAGE_KEY = 'markdown-looker-theme';
const VALID_THEMES = ['system', 'dark', 'light'];
const systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');

const MIN_RATIO_PERCENT = 40;
const MIN_RATIO = MIN_RATIO_PERCENT / 100;

// Chromium range thumb 宽度近似值；仅用于估算光标落点，±2px 误差无影响
const THUMB_WIDTH_PX = 16;

const tauri = window.__TAURI__;
const invoke = tauri?.core?.invoke;
const emit = tauri?.event?.emit;
const getCurrentWindow = tauri?.window?.getCurrentWindow;
const WebviewWindow = tauri?.webviewWindow?.WebviewWindow;
const LogicalSize = tauri?.dpi?.LogicalSize;
const PhysicalPosition = tauri?.dpi?.PhysicalPosition;

let currentTheme = 'system';
let currentRatio = 80;        // 已持久化的比例（百分比）
let pendingRecenter = null;   // { percent, syncCursor }
let previewRafId = null;

// ---------- 主题 ----------

function normalizeTheme(theme) {
    return VALID_THEMES.includes(theme) ? theme : 'system';
}

function resolveTheme(theme) {
    const t = normalizeTheme(theme);
    if (t === 'system') return systemDarkQuery.matches ? 'dark' : 'light';
    return t;
}

async function syncWindowTheme(theme) {
    if (!getCurrentWindow) return;
    try {
        const win = getCurrentWindow();
        await win.setTheme(theme === 'system' ? null : theme);
    } catch (e) {
        console.warn('[settings] setTheme 失败:', e);
    }
}

async function applyLocalTheme(theme) {
    const next = normalizeTheme(theme);
    await syncWindowTheme(next);

    if (next === 'system') {
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    }

    const resolved = resolveTheme(next);
    document.documentElement.classList.toggle('light', resolved === 'light');
}

function updateThemeUI() {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === currentTheme);
    });
}

async function setTheme(theme) {
    const next = normalizeTheme(theme);
    if (next === currentTheme) return;

    currentTheme = next;
    await applyLocalTheme(currentTheme);
    updateThemeUI();

    try { localStorage.setItem(THEME_STORAGE_KEY, currentTheme); } catch (_) { /* noop */ }

    await saveConfig();

    if (emit) {
        try {
            await emit('settings:theme-changed', { theme: currentTheme });
        } catch (e) {
            console.warn('[settings] emit theme-changed 失败:', e);
        }
    }
}

// ---------- 居中 + 尺寸（绝对定位，无累积误差） ----------

/**
 * 计算并应用：尺寸 = 父窗口客户区 × ratio；位置 = 父窗口 outer 中心 - 新尺寸/2。
 * 每次都从父窗口的 outer 坐标重新计算，不做任何偏移累加。
 * syncCursor=true 时，resize 完成后把光标移到滑块 thumb 中心。
 */
async function recenterAndResize(percent) {
    if (!WebviewWindow || !getCurrentWindow || !LogicalSize || !PhysicalPosition) return;

    const ratio = Math.max(MIN_RATIO, Math.min(1, percent / 100));
    try {
        const parent = await WebviewWindow.getByLabel('main');
        if (!parent) return;
        const win = getCurrentWindow();
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
        // 删掉末尾的 if (syncCursor) await syncCursorToSlider(percent);
    } catch (e) {
        console.warn('[settings] recenterAndResize 失败:', e);
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

    await saveConfig();

    if (emit) {
        try {
            await emit('settings:window-ratio-changed', { ratio: currentRatio / 100 });
        } catch (e) {
            console.warn('[settings] emit window-ratio-changed 失败:', e);
        }
    }
}

// ---------- 父窗口跟随 ----------

async function bindParentTracking() {
    if (!WebviewWindow) return;
    try {
        const parent = await WebviewWindow.getByLabel('main');
        if (!parent) return;

        // 父窗口 resize / move → 重算尺寸 + 居中；不移光标（用户没在拖滑块）
        parent.onResized(() => scheduleRecenter(currentRatio));
        parent.onMoved(() => scheduleRecenter(currentRatio));
    } catch (e) {
        console.warn('[settings] 绑定父窗口跟随失败:', e);
    }
}

// ---------- 配置读写 ----------

async function loadConfig() {
    if (!invoke) return;
    try {
        const cfg = await invoke('load_config');
        currentTheme = normalizeTheme(cfg && cfg.theme);

        const r = cfg && typeof cfg.settings_window_ratio === 'number'
            ? Math.round(cfg.settings_window_ratio * 100)
            : 80;
        currentRatio = Math.max(MIN_RATIO_PERCENT, Math.min(100, r));
    } catch (e) {
        console.error('[settings] load_config 失败:', e);
    }
}

async function saveConfig() {
    if (!invoke) return;
    try {
        await invoke('save_config', {
            config: {
                theme: currentTheme,
                settings_window_ratio: currentRatio / 100,
            },
        });
    } catch (e) {
        console.error('[settings] save_config 失败:', e);
    }
}

// ---------- 事件绑定 ----------

function bindNav() {
    const navItems = document.querySelectorAll('.settings-nav-item');
    const panels = document.querySelectorAll('.settings-panel');

    navItems.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.panel;
            navItems.forEach(b => b.classList.toggle('active', b === btn));
            panels.forEach(p => {
                p.hidden = p.dataset.panel !== target;
            });
        });
    });
}

function bindThemeButtons() {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => setTheme(btn.dataset.theme));
    });
}

function bindRatio() {
    const input = document.getElementById('ratio-input');
    if (!input) return;

    const RANGE = 100 - MIN_RATIO_PERCENT;   // 40..100 共 60 档

    let dragging = false;
    let dragPointerId = null;
    let startX = 0;
    let startValue = 0;
    let dragTrackWidth = 1;

    // 根据 clientX 反算 value（仅用于“点击轨道空白处跳转”）
    const valueFromClientX = (clientX) => {
        const rect = input.getBoundingClientRect();
        const usable = Math.max(1, rect.width - THUMB_WIDTH_PX);
        const ratio = Math.max(0, Math.min(1,
            (clientX - rect.left - THUMB_WIDTH_PX / 2) / usable));
        return Math.round(MIN_RATIO_PERCENT + ratio * RANGE);
    };

    // 当前 value 对应的 thumb 中心 x（判断是否按在 thumb 上）
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
        if (!onThumb) {
            emitInput(valueFromClientX(e.clientX));   // 点击跳转仍用 clientX，一次性点击不受漂移影响
        }

        dragging = true;
        dragPointerId = e.pointerId;
        startX = e.screenX;
        startValue = Number(input.value);
        dragTrackWidth = Math.max(
            1,
            input.getBoundingClientRect().width - THUMB_WIDTH_PX
        );

        try { input.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
        e.preventDefault();
    });

    input.addEventListener('pointermove', (e) => {
        if (!dragging || e.pointerId !== dragPointerId) return;

        const dx = e.screenX - startX;
        const deltaValue = (dx / dragTrackWidth) * RANGE;
        const next = Math.max(
            MIN_RATIO_PERCENT,
            Math.min(100, Math.round(startValue + deltaValue))
        );
        emitInput(next);
    });

    const endDrag = (e) => {
        if (!dragging) return;
        if (e && e.pointerId !== undefined && e.pointerId !== dragPointerId) return;

        dragging = false;
        dragPointerId = null;
        try { input.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }

        setRatio(Number(input.value));   // 持久化最终值
    };

    input.addEventListener('pointerup', endDrag);
    input.addEventListener('pointercancel', endDrag);

    // 键盘操作 / 程序化赋值走 input 事件；拖动中的 emitInput 也走这里
    input.addEventListener('input', () => {
        const v = Number(input.value);
        const label = document.getElementById('ratio-value');
        if (label) label.textContent = v + '%';
        scheduleRecenter(v);   // 关键：不再 syncCursor
    });
}

function bindCloseButton() {
    const closeBtn = document.querySelector('.settings-titlebar-close');
    if (!closeBtn) return;
    closeBtn.addEventListener('click', () => {
        try { getCurrentWindow?.().close(); } catch (e) {
            console.warn('[settings] close 失败:', e);
        }
    });
}

// ---------- 启动 ----------

async function init() {
    await loadConfig();
    await applyLocalTheme(currentTheme);
    updateThemeUI();
    updateRatioUI();

    bindNav();
    bindThemeButtons();
    bindRatio();
    bindCloseButton();
    bindParentTracking();

    // 启动时主动对齐一次（不移动光标）
    await recenterAndResize(currentRatio);

    systemDarkQuery.addEventListener('change', () => {
        if (currentTheme === 'system') applyLocalTheme('system');
    });
}

init().catch(err => console.error('[settings] init 失败:', err));