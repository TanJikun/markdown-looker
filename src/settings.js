// =========================================================
// 设置窗口主入口
// 职责：加载配置、渲染导航、按需挂载面板、关闭窗口
// 每个面板独立文件，接口：
//   export const meta = { id, title }
//   export async function mount(root, ctx)
//   export function unmount()
// =========================================================

const THEME_STORAGE_KEY = 'markdown-looker-theme';
const VALID_THEMES = ['system', 'dark', 'light'];
const systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');

const tauri = window.__TAURI__;
const invoke = tauri?.core?.invoke;
const emit = tauri?.event?.emit;
const getCurrentWindow = tauri?.window?.getCurrentWindow;

// 面板注册表：顺序即导航顺序
const PANELS = [
    { id: 'appearance', title: '外观', load: () => import('./settings/appearance.js') },
    { id: 'imagehost', title: '图床', load: () => import('./settings/imagehost.js') },
    { id: 'shortcuts', title: '快捷键', load: () => import('./settings/shortcuts.js') },
];

// ---------- 配置 ----------
const config = {
    theme: 'system',
    settings_window_ratio: 0.8,
    picnexus_path: '',
};

async function loadConfigFromBackend() {
    if (!invoke) return;
    try {
        const cfg = await invoke('load_config');
        if (cfg && typeof cfg === 'object') Object.assign(config, cfg);
    } catch (e) {
        console.error('[settings] load_config 失败:', e);
    }
}

async function persistConfig() {
    if (!invoke) return;
    try {
        await invoke('save_config', { config: { ...config } });
    } catch (e) {
        console.error('[settings] save_config 失败:', e);
    }
}

// ---------- 主题工具（供外观面板使用） ----------
function resolveTheme(theme) {
    const t = VALID_THEMES.includes(theme) ? theme : 'system';
    if (t === 'system') return systemDarkQuery.matches ? 'dark' : 'light';
    return t;
}

async function syncWindowTheme(theme) {
    if (!getCurrentWindow) return;
    try {
        await getCurrentWindow().setTheme(theme === 'system' ? null : theme);
    } catch (e) {
        console.warn('[settings] setTheme 失败:', e);
    }
}

async function applyLocalTheme(theme) {
    const next = VALID_THEMES.includes(theme) ? theme : 'system';
    await syncWindowTheme(next);
    if (next === 'system') {
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    document.documentElement.classList.toggle('light', resolveTheme(next) === 'light');
}

// ---------- 面板挂载 ----------
let activeModule = null;
let activePanelId = null;

async function activatePanel(panelId) {
    if (panelId === activePanelId) return;

    if (activeModule && typeof activeModule.unmount === 'function') {
        try { activeModule.unmount(); } catch (e) { console.warn(e); }
    }
    activeModule = null;
    activePanelId = panelId;

    document.querySelectorAll('.settings-nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.panel === panelId);
    });

    const container = document.getElementById('settings-content');
    if (!container) return;
    container.innerHTML = '';

    const entry = PANELS.find(p => p.id === panelId);
    if (!entry) return;

    const mod = await entry.load();
    activeModule = mod;

    const root = document.createElement('section');
    root.className = 'settings-panel';
    root.dataset.panel = panelId;
    container.appendChild(root);

    const ctx = {
        invoke,
        emit,
        getCurrentWindow,
        systemDarkQuery,
        THEME_STORAGE_KEY,
        VALID_THEMES,
        getConfig: () => ({ ...config }),
        patchConfig: async (patch) => {
            Object.assign(config, patch);
            await persistConfig();
        },
        applyLocalTheme,
        resolveTheme,
    };

    if (typeof mod.mount === 'function') await mod.mount(root, ctx);
}

function renderNav() {
    const nav = document.getElementById('settings-nav');
    if (!nav) return;
    nav.innerHTML = '';
    PANELS.forEach(p => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'settings-nav-item';
        btn.dataset.panel = p.id;
        btn.textContent = p.title;
        btn.addEventListener('click', () => activatePanel(p.id));
        nav.appendChild(btn);
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
    await loadConfigFromBackend();
    await applyLocalTheme(config.theme);
    renderNav();
    bindCloseButton();

    systemDarkQuery.addEventListener('change', () => {
        if ((config.theme || 'system') === 'system') applyLocalTheme('system');
    });

    await activatePanel(PANELS[0].id);
}

init().catch(err => console.error('[settings] init 失败:', err));