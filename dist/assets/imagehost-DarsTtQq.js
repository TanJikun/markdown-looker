const r={id:"imagehost",title:"图床"};let s,e={};async function m(n,t){s=t,e=s.getConfig(),e.insert_image_mode||(e.insert_image_mode="local"),e.local_image_save_mode||(e.local_image_save_mode="same_dir"),e.local_sub_dir_mode||(e.local_sub_dir_mode="shared"),e.cloud_provider||(e.cloud_provider="picnexus"),e.local_fixed_dir||(e.local_fixed_dir=""),e.picnexus_bed||(e.picnexus_bed=""),n.innerHTML=`
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
    `,c(),a(),u()}function p(){s=null,e={}}function a(){document.getElementById("mode-btn-local").classList.toggle("active",e.insert_image_mode==="local"),document.getElementById("mode-btn-cloud").classList.toggle("active",e.insert_image_mode==="cloud"),document.getElementById("local-section").hidden=e.insert_image_mode!=="local",document.getElementById("cloud-section").hidden=e.insert_image_mode!=="cloud",document.getElementsByName("local_mode").forEach(i=>{i.checked=i.value===e.local_image_save_mode}),document.getElementById("local-fixed-section").hidden=e.local_image_save_mode!=="fixed",document.getElementById("local-subdir-section").hidden=e.local_image_save_mode!=="sub_dir",document.getElementById("local-fixed-input").value=e.local_fixed_dir||"",document.getElementsByName("sub_dir_mode").forEach(i=>{i.checked=i.value===e.local_sub_dir_mode}),document.getElementById("provider-btn-picnexus").classList.toggle("active",e.cloud_provider==="picnexus"),document.getElementById("picnexus-section").hidden=e.cloud_provider!=="picnexus",document.getElementById("picnexus-path-input").value=e.picnexus_path||"",document.getElementById("picnexus-bed-input").value=e.picnexus_bed||""}async function d(){await s.patchConfig(e)}function c(n){document.getElementById("mode-btn-local").addEventListener("click",()=>{e.insert_image_mode="local",a(),d()}),document.getElementById("mode-btn-cloud").addEventListener("click",()=>{e.insert_image_mode="cloud",a(),d()}),document.getElementsByName("local_mode").forEach(t=>{t.addEventListener("change",i=>{e.local_image_save_mode=i.target.value,a(),d()})}),document.getElementById("local-fixed-btn").addEventListener("click",async()=>{if(s.invoke)try{const t=await s.invoke("pick_folder");t&&(e.local_fixed_dir=t,a(),d())}catch(t){console.warn("选择固定位置失败:",t)}}),document.getElementById("local-fixed-input").addEventListener("change",t=>{e.local_fixed_dir=t.target.value.trim(),d()}),document.getElementsByName("sub_dir_mode").forEach(t=>{t.addEventListener("change",i=>{e.local_sub_dir_mode=i.target.value,d()})}),document.getElementById("picnexus-bed-input").addEventListener("change",t=>{e.picnexus_bed=t.target.value.trim(),d()}),document.getElementById("picnexus-path-input").addEventListener("change",async t=>{const i=t.target.value.trim();e.picnexus_path=i,d(),await o(i)}),document.getElementById("picnexus-pick-btn").addEventListener("click",async()=>{if(s.invoke)try{const t=await s.invoke("pick_picnexus_path");if(!t){l("warn","未选择，或所选目录根级没有 PicNexus.exe");return}e.picnexus_path=t,a(),d(),l("ok",`已设置：${t}`)}catch(t){console.warn("pick_picnexus_path 失败:",t),l("warn","选择失败，请手动输入路径")}})}async function u(){if(s.invoke){if(e.picnexus_path){await o(e.picnexus_path);return}try{const n=await s.invoke("detect_picnexus_path");n?(e.picnexus_path=n,a(),d(),l("ok",`已从 PATH 检测到：${n}`)):l("idle","未在 PATH 中找到 PicNexus，请手动选择")}catch(n){console.warn("detect_picnexus_path 失败:",n)}}}async function o(n){if(!n){l("idle","已清空");return}if(s.invoke)try{const t=await s.invoke("validate_picnexus_path",{path:n});t?l("ok",`有效：${t}`):l("error","未在该位置找到 PicNexus.exe")}catch(t){console.warn("validate_picnexus_path 失败:",t),l("error","路径校验失败")}}function l(n,t){const i=document.getElementById("picnexus-status");i&&(i.dataset.kind=n,i.textContent=t)}export{r as meta,m as mount,p as unmount};
