// =========================================================
// 设置窗口脚本
// 职责：
//   - 读取/展示 config（theme、settings_window_ratio）
//   - 主题切换时：应用本窗口 + 持久化 + emit 到主窗口
//   - 窗口大小滑块：持久化 + emit（不即时改变当前窗口）
// 配置写入由本窗口独占，主窗口只负责“应用”。
// =========================================================

const THEME_STORAGE_KEY = 'markdown-looker-theme';
const VALID_THEMES = ['system', 'dark', 'light'];
const systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');

const tauri = window.__TAURI__;
const invoke = tauri?.core?.invoke;
const emit = tauri?.event?.emit;
const getCurrentWindow = tauri?.window?.getCurrentWindow;

let currentTheme = 'system';
let currentRatio = 80; // 百分比

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

    // setTheme(null) 后 prefers-color-scheme 需要一两帧恢复，
    // 否则这里读到的还是上一次 setTheme('light'/'dark') 污染后的值。
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

function updateRatioUI() {
    const input = document.getElementById('ratio-input');
    const value = document.getElementById('ratio-value');
    if (input) input.value = String(currentRatio);
    if (value) value.textContent = currentRatio + '%';
}

async function loadConfig() {
    if (!invoke) return;
    try {
        const cfg = await invoke('load_config');
        currentTheme = normalizeTheme(cfg && cfg.theme);

        const r = cfg && typeof cfg.settings_window_ratio === 'number'
            ? Math.round(cfg.settings_window_ratio * 100)
            : 80;
        currentRatio = Math.max(10, Math.min(100, r));
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

async function setRatio(percent) {
    const next = Math.max(10, Math.min(100, Math.round(percent)));
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

    input.addEventListener('input', () => {
        const v = Number(input.value);
        const label = document.getElementById('ratio-value');
        if (label) label.textContent = v + '%';
    });

    input.addEventListener('change', () => {
        setRatio(Number(input.value));
    });
}

async function init() {
    await loadConfig();
    await applyLocalTheme(currentTheme);
    updateThemeUI();
    updateRatioUI();

    bindNav();
    bindThemeButtons();
    bindRatio();

    systemDarkQuery.addEventListener('change', () => {
        if (currentTheme === 'system') applyLocalTheme('system');
    });
}

init().catch(err => console.error('[settings] init 失败:', err));