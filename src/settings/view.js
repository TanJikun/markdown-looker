// =========================================================
// 视图面板：双栏 / 预览 / 源码
// =========================================================

export const meta = { id: 'view', title: '视图' };

let ctx;

const MODES = [
    { value: 'split', label: '双栏', hint: '左侧编辑，右侧预览' },
    { value: 'preview', label: '预览', hint: '仅显示预览' },
    { value: 'source', label: '源码', hint: '仅显示编辑器' },
];

export async function mount(root, context) {
    ctx = context;
    const cfg = ctx.getConfig();
    const current = MODES.some(m => m.value === cfg.view_mode) ? cfg.view_mode : 'split';

    root.innerHTML = `
        <h2 class="settings-panel-title">视图</h2>
        <div class="settings-field">
            <div class="settings-field-label">
                默认视图模式
                <span class="settings-hint">工具栏最右侧也能快速切换</span>
            </div>
            <div class="settings-field-control">
                <div class="settings-radio-group">
                    ${MODES.map(m => `
                        <label class="settings-radio-label">
                            <input type="radio" name="view_mode" value="${m.value}"
                                   ${m.value === current ? 'checked' : ''}>
                            ${m.label}
                            <span class="settings-hint">${m.hint}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    root.querySelectorAll('input[name="view_mode"]').forEach(radio => {
        radio.addEventListener('change', async (e) => {
            const next = e.target.value;
            await ctx.patchConfig({ view_mode: next });
            if (ctx.emit) {
                try {
                    await ctx.emit('settings:view-mode-changed', { view_mode: next });
                } catch (err) {
                    console.warn('[view] emit 失败:', err);
                }
            }
        });
    });
}

export function unmount() {
    ctx = null;
}