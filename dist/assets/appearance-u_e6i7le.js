const M=[{value:"split",label:"双栏",hint:"左侧编辑，右侧预览"},{value:"preview",label:"预览",hint:"仅显示预览"},{value:"source",label:"源码",hint:"仅显示编辑器"}],y=window.__TAURI__,_=y?.webviewWindow?.WebviewWindow,R=y?.dpi?.LogicalSize,P=y?.dpi?.PhysicalPosition,X={id:"appearance",title:"外观"};let o,l="system",T="split",r=80,d=null,v=null,E=[];async function O(t,a){o=a;const e=o.getConfig();l=o.VALID_THEMES.includes(e.theme)?e.theme:"system",T=M.some(i=>i.value===e.view_mode)?e.view_mode:"split",r=typeof e.settings_window_ratio=="number"?Math.max(40,Math.min(100,Math.round(e.settings_window_ratio*100))):80,t.innerHTML=`
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
                渲染模式
                <span class="settings-hint">工具栏最右侧也能快速切换</span>
            </div>
            <div class="settings-field-control">
                <div class="settings-radio-group">
                    ${M.map(i=>`
                        <label class="settings-radio-label">
                            <input type="radio" name="view_mode" value="${i.value}"
                                   ${i.value===T?"checked":""}>
                            ${i.label}
                            <span class="settings-hint">${i.hint}</span>
                        </label>
                    `).join("")}
                </div>
            </div>
        </div>

        <div class="settings-field">
            <div class="settings-field-label">
                设置窗口大小
                <span class="settings-hint">相对主窗口，拖动即时生效</span>
            </div>
            <div class="settings-field-control">
                <input type="range" id="ratio-input" min="40" max="100" step="5" value="${r}">
                <span id="ratio-value" class="ratio-value">${r}%</span>
            </div>
        </div>
    `,C(),A(),H(),S(),await L(),await N(r)}function D(){E.forEach(t=>{try{t()}catch{}}),E=[],v&&cancelAnimationFrame(v),v=null,d=null,o=null}function C(){document.querySelectorAll(".theme-btn").forEach(t=>{t.classList.toggle("active",t.dataset.theme===l)})}async function x(t){const a=o.VALID_THEMES.includes(t)?t:"system";if(a!==l){l=a,await o.applyLocalTheme(l),C();try{localStorage.setItem(o.THEME_STORAGE_KEY,l)}catch{}if(await o.patchConfig({theme:l}),o.emit)try{await o.emit("settings:theme-changed",{theme:l})}catch(e){console.warn("[appearance] emit theme-changed 失败:",e)}}}function A(){document.querySelectorAll(".theme-btn").forEach(t=>{t.addEventListener("click",()=>x(t.dataset.theme))})}function H(){document.querySelectorAll('input[name="view_mode"]').forEach(t=>{t.addEventListener("change",async a=>{const e=a.target.value;if(M.some(i=>i.value===e)&&(T=e,await o.patchConfig({view_mode:e}),o.emit))try{await o.emit("settings:view-mode-changed",{view_mode:e})}catch(i){console.warn("[appearance] emit view-mode-changed 失败:",i)}})})}async function N(t){if(!_||!o?.getCurrentWindow||!R||!P)return;const a=Math.max(40/100,Math.min(1,t/100));try{const e=await _.getByLabel("main");if(!e)return;const i=o.getCurrentWindow(),[h,m,p,u]=await Promise.all([e.innerSize(),e.outerPosition(),e.outerSize(),i.scaleFactor()]),w=Math.max(360,Math.round(h.width/u*a)),g=Math.max(260,Math.round(h.height/u*a)),f=m.x+p.width/2,n=m.y+p.height/2,s=Math.round(f-w*u/2),c=Math.round(n-g*u/2);await i.setSize(new R(w,g)),await i.setPosition(new P(s,c))}catch(e){console.warn("[appearance] recenterAndResize 失败:",e)}}function I(t){if(d){d.percent=t;return}d={percent:t},v=requestAnimationFrame(async()=>{const a=d;d=null,v=null,await N(a.percent)})}function W(){const t=document.getElementById("ratio-input"),a=document.getElementById("ratio-value");t&&(t.value=String(r)),a&&(a.textContent=r+"%")}async function B(t){const a=Math.max(40,Math.min(100,Math.round(t)));if(a!==r&&(r=a,W(),await o.patchConfig({settings_window_ratio:r/100}),o.emit))try{await o.emit("settings:window-ratio-changed",{ratio:r/100})}catch(e){console.warn("[appearance] emit window-ratio-changed 失败:",e)}}function S(){const t=document.getElementById("ratio-input");if(!t)return;const a=60;let e=!1,i=null,h=0,m=0,p=1;const u=n=>{const s=t.getBoundingClientRect(),c=Math.max(1,s.width-16),b=Math.max(0,Math.min(1,(n-s.left-16/2)/c));return Math.round(40+b*a)},w=()=>{const n=t.getBoundingClientRect(),s=Math.max(1,n.width-16),c=(Number(t.value)-40)/a;return n.left+16/2+c*s},g=n=>{Number(t.value)!==n&&(t.value=String(n),t.dispatchEvent(new Event("input",{bubbles:!0})))};t.addEventListener("pointerdown",n=>{if(n.button!==0)return;Math.abs(n.clientX-w())<=16/2+2||g(u(n.clientX)),e=!0,i=n.pointerId,h=n.screenX,m=Number(t.value),p=Math.max(1,t.getBoundingClientRect().width-16);try{t.setPointerCapture(n.pointerId)}catch{}n.preventDefault()}),t.addEventListener("pointermove",n=>{if(!e||n.pointerId!==i)return;const c=(n.screenX-h)/p*a,b=Math.max(40,Math.min(100,Math.round(m+c)));g(b)});const f=n=>{if(e&&!(n&&n.pointerId!==void 0&&n.pointerId!==i)){e=!1,i=null;try{t.releasePointerCapture(n.pointerId)}catch{}B(Number(t.value))}};t.addEventListener("pointerup",f),t.addEventListener("pointercancel",f),t.addEventListener("input",()=>{const n=Number(t.value),s=document.getElementById("ratio-value");s&&(s.textContent=n+"%"),I(n)})}async function L(){if(!(!_||!o?.getCurrentWindow))try{const t=await _.getByLabel("main");if(!t)return;const a=await t.onResized(()=>I(r)),e=await t.onMoved(()=>I(r));E.push(a,e)}catch(t){console.warn("[appearance] 绑定父窗口跟随失败:",t)}}export{X as meta,O as mount,D as unmount};
