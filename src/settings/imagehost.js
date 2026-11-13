// =========================================================
// 图床面板：插入图片行为 + PicNexus
// =========================================================

export const meta = { id: 'imagehost', title: '图床' };

let ctx;
let currentConfig = {};

export async function mount(root, context) {
    ctx = context;
    currentConfig = ctx.getConfig();

    // 初始化默认值（防止旧配置文件缺字段）
    if (!currentConfig.insert_image_mode) currentConfig.insert_image_mode = 'local';
    if (!currentConfig.local_image_save_mode) currentConfig.local_image_save_mode = 'same_dir';
    if (!currentConfig.local_sub_dir_mode) currentConfig.local_sub_dir_mode = 'shared';
    if (!currentConfig.cloud_provider) currentConfig.cloud_provider = 'picnexus';
    if (!currentConfig.local_fixed_dir) currentConfig.local_fixed_dir = '';
    if (!currentConfig.picnexus_bed) currentConfig.picnexus_bed = '';

    root.innerHTML = `
        <style>
            /* 强制去掉所有动画和过渡 */
            .no-anim * { transition: none !important; animation: none !important; }
            .settings-sub-field {
                margin-left: 24px;
                padding-left: 16px;
                border-left: 2px solid var(--border);
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-top: 10px;
            }
            .settings-field[hidden], .settings-sub-field[hidden] {
                display: none !important;
            }
            .settings-radio-group {
                display: flex;
                gap: 16px;
                align-items: center;
            }
            .settings-radio-label {
                display: flex;
                align-items: center;
                gap: 6px;
                cursor: pointer;
                font-size: 13px;
            }
        </style>

        <h2 class="settings-panel-title">图床</h2>

        <div class="settings-field no-anim">
            <div class="settings-field-label">插入图片行为</div>
            <div class="settings-field-control">
                <div class="theme-group">
                    <button type="button" class="theme-btn" id="mode-btn-local">本地</button>
                    <button type="button" class="theme-btn" id="mode-btn-cloud">云端</button>
                </div>
            </div>
        </div>

        <!-- ================= 本地配置 ================= -->
        <div id="local-section" class="settings-field no-anim">
            <div class="settings-field-label">本地保存位置</div>
            <div class="settings-field-control">
                <div class="settings-radio-group" id="local-mode-group">
                    <label class="settings-radio-label"><input type="radio" name="local_mode" value="fixed"> 固定位置</label>
                    <label class="settings-radio-label"><input type="radio" name="local_mode" value="same_dir"> 相同目录</label>
                    <label class="settings-radio-label"><input type="radio" name="local_mode" value="sub_dir"> 子目录</label>
                </div>
            </div>

            <!-- 固定位置 -->
            <div id="local-fixed-section" class="settings-sub-field" hidden>
                <div class="settings-field-control">
                    <input type="text" id="local-fixed-input" class="settings-text-input" placeholder="选择一个固定的文件夹存放图片">
                    <button type="button" id="local-fixed-btn" class="settings-action-btn">选择…</button>
                </div>
            </div>

            <!-- 子目录设置 -->
            <div id="local-subdir-section" class="settings-sub-field" hidden>
                <div class="settings-field-control">
                    <div class="settings-radio-group">
                        <label class="settings-radio-label"><input type="radio" name="sub_dir_mode" value="shared"> 同目录（.image 文件夹）</label>
                        <label class="settings-radio-label"><input type="radio" name="sub_dir_mode" value="independent"> 独立目录（同名文件夹）</label>
                    </div>
                </div>
            </div>
        </div>

        <!-- ================= 云端配置 ================= -->
        <div id="cloud-section" class="settings-field no-anim" hidden>
            <div class="settings-field-label">云服务商</div>
            <div class="settings-field-control">
                <div class="theme-group">
                    <button type="button" class="theme-btn" id="provider-btn-picnexus">PicNexus</button>
                </div>
            </div>

            <!-- PicNexus 设置 -->
            <div id="picnexus-section" class="settings-sub-field">
                <div class="settings-field-label">
                    PicNexus 位置
                    <span class="settings-hint">支持文件夹或 PicNexus.exe 完整路径</span>
                </div>
                <div class="settings-field-control">
                    <input type="text" id="picnexus-path-input" class="settings-text-input" placeholder="未设置，可手动粘贴路径或点击右侧按钮选择">
                    <button type="button" id="picnexus-pick-btn" class="settings-action-btn">选择…</button>
                </div>
                <div class="settings-field-status" id="picnexus-status"></div>

                <div class="settings-field-label" style="margin-top: 10px;">
                    图床选择
                    <span class="settings-hint">PicNexus 支持的图床标识，用于命令行参数</span>
                </div>
                <div class="settings-field-control">
                    <input type="text" id="picnexus-bed-input" class="settings-text-input" placeholder="例如：smms, github">
                </div>
            </div>
        </div>
    `;

    bindEvents(root);
    refreshUI();
    detectPicNexusFromEnv();
}

export function unmount() {
    ctx = null;
    currentConfig = {};
}

// ---------- UI 刷新逻辑 ----------
function refreshUI() {
    // 1. 刷新顶部开关
    document.getElementById('mode-btn-local').classList.toggle('active', currentConfig.insert_image_mode === 'local');
    document.getElementById('mode-btn-cloud').classList.toggle('active', currentConfig.insert_image_mode === 'cloud');

    // 2. 刷新本地/云端显隐
    document.getElementById('local-section').hidden = currentConfig.insert_image_mode !== 'local';
    document.getElementById('cloud-section').hidden = currentConfig.insert_image_mode !== 'cloud';

    // 3. 刷新本地模式选中状态
    const localRadios = document.getElementsByName('local_mode');
    localRadios.forEach(r => { r.checked = (r.value === currentConfig.local_image_save_mode); });

    // 4. 刷新本地子选项显隐
    document.getElementById('local-fixed-section').hidden = currentConfig.local_image_save_mode !== 'fixed';
    document.getElementById('local-subdir-section').hidden = currentConfig.local_image_save_mode !== 'sub_dir';

    // 5. 刷新本地固定位置输入框
    document.getElementById('local-fixed-input').value = currentConfig.local_fixed_dir || '';

    // 6. 刷新子目录模式
    const subDirRadios = document.getElementsByName('sub_dir_mode');
    subDirRadios.forEach(r => { r.checked = (r.value === currentConfig.local_sub_dir_mode); });

    // 7. 刷新云端显隐与状态
    document.getElementById('provider-btn-picnexus').classList.toggle('active', currentConfig.cloud_provider === 'picnexus');
    document.getElementById('picnexus-section').hidden = currentConfig.cloud_provider !== 'picnexus';

    // 8. 刷新 PicNexus 相关输入
    document.getElementById('picnexus-path-input').value = currentConfig.picnexus_path || '';
    document.getElementById('picnexus-bed-input').value = currentConfig.picnexus_bed || '';
}

// ---------- 配置保存 ----------
async function save() {
    // 每次保存都提交完整的 currentConfig，满足“配置文件写完整”的要求
    await ctx.patchConfig(currentConfig);
}

// ---------- 事件绑定 ----------
function bindEvents(root) {
    // 1. 主行为切换
    document.getElementById('mode-btn-local').addEventListener('click', () => {
        currentConfig.insert_image_mode = 'local';
        refreshUI();
        save();
    });
    document.getElementById('mode-btn-cloud').addEventListener('click', () => {
        currentConfig.insert_image_mode = 'cloud';
        refreshUI();
        save();
    });

    // 2. 本地模式切换
    document.getElementsByName('local_mode').forEach(radio => {
        radio.addEventListener('change', (e) => {
            currentConfig.local_image_save_mode = e.target.value;
            refreshUI();
            save();
        });
    });

    // 3. 固定位置选择
    document.getElementById('local-fixed-btn').addEventListener('click', async () => {
        if (!ctx.invoke) return;
        try {
            const picked = await ctx.invoke('pick_folder');
            if (picked) {
                currentConfig.local_fixed_dir = picked;
                refreshUI();
                save();
            }
        } catch (e) {
            console.warn('选择固定位置失败:', e);
        }
    });
    document.getElementById('local-fixed-input').addEventListener('change', (e) => {
        currentConfig.local_fixed_dir = e.target.value.trim();
        save();
    });

    // 4. 子目录模式切换
    document.getElementsByName('sub_dir_mode').forEach(radio => {
        radio.addEventListener('change', (e) => {
            currentConfig.local_sub_dir_mode = e.target.value;
            save();
        });
    });

    // 5. PicNexus 图床输入
    document.getElementById('picnexus-bed-input').addEventListener('change', (e) => {
        currentConfig.picnexus_bed = e.target.value.trim();
        save();
    });

    // 6. PicNexus 路径手动修改
    document.getElementById('picnexus-path-input').addEventListener('change', async (e) => {
        const val = e.target.value.trim();
        currentConfig.picnexus_path = val;
        save();
        await validateAndShow(val);
    });

    // 7. PicNexus 路径选择
    document.getElementById('picnexus-pick-btn').addEventListener('click', async () => {
        if (!ctx.invoke) return;
        try {
            const picked = await ctx.invoke('pick_picnexus_path');
            if (!picked) {
                setStatus('warn', '未选择，或所选目录根级没有 PicNexus.exe');
                return;
            }
            currentConfig.picnexus_path = picked;
            refreshUI();
            save();
            setStatus('ok', `已设置：${picked}`);
        } catch (e) {
            console.warn('pick_picnexus_path 失败:', e);
            setStatus('warn', '选择失败，请手动输入路径');
        }
    });
}

// ---------- PicNexus 辅助逻辑 ----------
async function detectPicNexusFromEnv() {
    if (!ctx.invoke) return;
    if (currentConfig.picnexus_path) {
        await validateAndShow(currentConfig.picnexus_path);
        return;
    }

    try {
        const detected = await ctx.invoke('detect_picnexus_path');
        if (detected) {
            currentConfig.picnexus_path = detected;
            refreshUI();
            save();
            setStatus('ok', `已从 PATH 检测到：${detected}`);
        } else {
            setStatus('idle', '未在 PATH 中找到 PicNexus，请手动选择');
        }
    } catch (e) {
        console.warn('detect_picnexus_path 失败:', e);
    }
}

async function validateAndShow(path) {
    if (!path) {
        setStatus('idle', '已清空');
        return;
    }
    if (!ctx.invoke) return;
    try {
        const resolved = await ctx.invoke('validate_picnexus_path', { path });
        if (resolved) {
            setStatus('ok', `有效：${resolved}`);
        } else {
            setStatus('error', '未在该位置找到 PicNexus.exe');
        }
    } catch (e) {
        console.warn('validate_picnexus_path 失败:', e);
        setStatus('error', '路径校验失败');
    }
}

function setStatus(kind, text) {
    const el = document.getElementById('picnexus-status');
    if (!el) return;
    el.dataset.kind = kind;
    el.textContent = text;
}