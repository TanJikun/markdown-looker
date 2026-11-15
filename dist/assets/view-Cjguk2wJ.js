const d={id:"view",title:"视图"};let t;const a=[{value:"split",label:"双栏",hint:"左侧编辑，右侧预览"},{value:"preview",label:"预览",hint:"仅显示预览"},{value:"source",label:"源码",hint:"仅显示编辑器"}];async function u(i,l){t=l;const n=t.getConfig(),c=a.some(e=>e.value===n.view_mode)?n.view_mode:"split";i.innerHTML=`
        <h2 class="settings-panel-title">视图</h2>
        <div class="settings-field">
            <div class="settings-field-label">
                默认视图模式
                <span class="settings-hint">工具栏最右侧也能快速切换</span>
            </div>
            <div class="settings-field-control">
                <div class="settings-radio-group">
                    ${a.map(e=>`
                        <label class="settings-radio-label">
                            <input type="radio" name="view_mode" value="${e.value}"
                                   ${e.value===c?"checked":""}>
                            ${e.label}
                            <span class="settings-hint">${e.hint}</span>
                        </label>
                    `).join("")}
                </div>
            </div>
        </div>
    `,i.querySelectorAll('input[name="view_mode"]').forEach(e=>{e.addEventListener("change",async o=>{const s=o.target.value;if(await t.patchConfig({view_mode:s}),t.emit)try{await t.emit("settings:view-mode-changed",{view_mode:s})}catch(v){console.warn("[view] emit 失败:",v)}})})}function r(){t=null}export{d as meta,u as mount,r as unmount};
