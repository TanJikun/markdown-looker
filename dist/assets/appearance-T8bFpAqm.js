const E=window.__TAURI__,T=E?.webviewWindow?.WebviewWindow,b=E?.dpi?.LogicalSize,y=E?.dpi?.PhysicalPosition,W={id:"appearance",title:"外观"};let i,u="system",r=80,d=null,w=null,M=[];async function X(t,a){i=a;const n=i.getConfig();u=i.VALID_THEMES.includes(n.theme)?n.theme:"system",r=typeof n.settings_window_ratio=="number"?Math.max(40,Math.min(100,Math.round(n.settings_window_ratio*100))):80,t.innerHTML=`
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
                <input type="range" id="ratio-input" min="40" max="100" step="5" value="${r}">
                <span id="ratio-value" class="ratio-value">${r}%</span>
            </div>
        </div>
    `,R(),N(),H(),await B(),await P(r)}function L(){M.forEach(t=>{try{t()}catch{}}),M=[],w&&cancelAnimationFrame(w),w=null,d=null,i=null}function R(){document.querySelectorAll(".theme-btn").forEach(t=>{t.classList.toggle("active",t.dataset.theme===u)})}async function C(t){const a=i.VALID_THEMES.includes(t)?t:"system";if(a!==u){u=a,await i.applyLocalTheme(u),R();try{localStorage.setItem(i.THEME_STORAGE_KEY,u)}catch{}if(await i.patchConfig({theme:u}),i.emit)try{await i.emit("settings:theme-changed",{theme:u})}catch(n){console.warn("[appearance] emit theme-changed 失败:",n)}}}function N(){document.querySelectorAll(".theme-btn").forEach(t=>{t.addEventListener("click",()=>C(t.dataset.theme))})}async function P(t){if(!T||!i?.getCurrentWindow||!b||!y)return;const a=Math.max(40/100,Math.min(1,t/100));try{const n=await T.getByLabel("main");if(!n)return;const s=i.getCurrentWindow(),[h,m,p,l]=await Promise.all([n.innerSize(),n.outerPosition(),n.outerSize(),s.scaleFactor()]),f=Math.max(360,Math.round(h.width/l*a)),g=Math.max(260,Math.round(h.height/l*a)),_=m.x+p.width/2,e=m.y+p.height/2,o=Math.round(_-f*l/2),c=Math.round(e-g*l/2);await s.setSize(new b(f,g)),await s.setPosition(new y(o,c))}catch(n){console.warn("[appearance] recenterAndResize 失败:",n)}}function v(t){if(d){d.percent=t;return}d={percent:t},w=requestAnimationFrame(async()=>{const a=d;d=null,w=null,await P(a.percent)})}function x(){const t=document.getElementById("ratio-input"),a=document.getElementById("ratio-value");t&&(t.value=String(r)),a&&(a.textContent=r+"%")}async function A(t){const a=Math.max(40,Math.min(100,Math.round(t)));if(a!==r&&(r=a,x(),await i.patchConfig({settings_window_ratio:r/100}),i.emit))try{await i.emit("settings:window-ratio-changed",{ratio:r/100})}catch(n){console.warn("[appearance] emit window-ratio-changed 失败:",n)}}function H(){const t=document.getElementById("ratio-input");if(!t)return;const a=60;let n=!1,s=null,h=0,m=0,p=1;const l=e=>{const o=t.getBoundingClientRect(),c=Math.max(1,o.width-16),I=Math.max(0,Math.min(1,(e-o.left-16/2)/c));return Math.round(40+I*a)},f=()=>{const e=t.getBoundingClientRect(),o=Math.max(1,e.width-16),c=(Number(t.value)-40)/a;return e.left+16/2+c*o},g=e=>{Number(t.value)!==e&&(t.value=String(e),t.dispatchEvent(new Event("input",{bubbles:!0})))};t.addEventListener("pointerdown",e=>{if(e.button!==0)return;Math.abs(e.clientX-f())<=16/2+2||g(l(e.clientX)),n=!0,s=e.pointerId,h=e.screenX,m=Number(t.value),p=Math.max(1,t.getBoundingClientRect().width-16);try{t.setPointerCapture(e.pointerId)}catch{}e.preventDefault()}),t.addEventListener("pointermove",e=>{if(!n||e.pointerId!==s)return;const c=(e.screenX-h)/p*a,I=Math.max(40,Math.min(100,Math.round(m+c)));g(I)});const _=e=>{if(n&&!(e&&e.pointerId!==void 0&&e.pointerId!==s)){n=!1,s=null;try{t.releasePointerCapture(e.pointerId)}catch{}A(Number(t.value))}};t.addEventListener("pointerup",_),t.addEventListener("pointercancel",_),t.addEventListener("input",()=>{const e=Number(t.value),o=document.getElementById("ratio-value");o&&(o.textContent=e+"%"),v(e)})}async function B(){if(!(!T||!i?.getCurrentWindow))try{const t=await T.getByLabel("main");if(!t)return;const a=await t.onResized(()=>v(r)),n=await t.onMoved(()=>v(r));M.push(a,n)}catch(t){console.warn("[appearance] 绑定父窗口跟随失败:",t)}}export{W as meta,X as mount,L as unmount};
