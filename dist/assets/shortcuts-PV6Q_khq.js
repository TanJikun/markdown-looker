import{D as m,A as d,f as g,i as v,b as C,a as b}from"./shortcuts-D_nznk2l.js";const H={id:"shortcuts",title:"快捷键"};let i,r={},s=null;async function j(t,n){i=n;const e=i.getConfig();r={...m,...e.shortcuts||{}},t.innerHTML=`
        <h2 class="settings-panel-title">快捷键</h2>
        <div class="settings-shortcuts-hint">
            点击「编辑」进入捕获：
            <b>修饰键 + 主键</b> 追加一段，可连续追加多段；
            <b>回车</b>（主/小键盘均可）确认；
            <b>退格</b> 删除最后一段；<b>Esc</b> 取消。
            组合键区分左右修饰键，也区分主键盘与小键盘。
        </div>
        <div id="shortcuts-table-host"></div>
    `,S()}function A(){f(),i=null,r={}}function S(){const t=document.getElementById("shortcuts-table-host");if(!t)return;const n=new Map;for(const o of d)n.has(o.group)||n.set(o.group,[]),n.get(o.group).push(o);const e=[];for(const[o,c]of n){e.push('<table class="settings-table">'),e.push(`<thead><tr><th colspan="3" class="settings-table-group">${p(o)}</th></tr></thead>`),e.push("<tbody>");for(const a of c)e.push(`
                <tr data-action="${a.id}">
                    <td class="col-desc">${p(a.label)}</td>
                    <td class="col-key"></td>
                    <td class="col-ops">
                        <button type="button" class="settings-action-btn" data-op="edit" data-id="${a.id}">编辑</button>
                        <button type="button" class="settings-action-btn" data-op="reset" data-id="${a.id}">重置</button>
                        <button type="button" class="settings-action-btn" data-op="unbind" data-id="${a.id}">解绑</button>
                    </td>
                </tr>
            `);e.push("</tbody></table>")}t.innerHTML=e.join(""),t.addEventListener("click",M);for(const o of d)l(o.id)}function M(t){const n=t.target.closest("button[data-op]");if(!n)return;const e=n.dataset.op,o=n.dataset.id;o&&(e==="edit"?$(o):e==="reset"?L(o):e==="unbind"&&k(o))}function l(t){const n=document.querySelector(`tr[data-action="${t}"]`);if(!n)return;const e=n.querySelector(".col-key");if(!e)return;const o=r[t]||"";e.innerHTML=o?`<span class="shortcut-key">${p(g(o))}</span>`:'<span class="shortcut-empty">未绑定</span>'}async function L(t){r[t]=m[t]||"",l(t),await h()}async function k(t){r[t]="",l(t),await h()}async function h(){if(await i.patchConfig({shortcuts:{...r}}),i.emit)try{await i.emit("settings:shortcuts-changed",{shortcuts:{...r}})}catch(t){console.warn("[shortcuts] emit 失败:",t)}}function $(t){f();const n=d.find(o=>o.id===t);if(!n)return;const e=document.createElement("div");e.className="shortcut-capture-overlay",e.innerHTML=`
        <div class="shortcut-capture-box">
            <div class="shortcut-capture-title">为「${p(n.label)}」设置快捷键</div>
            <div class="shortcut-capture-preview" id="shortcut-capture-preview"></div>
            <div class="shortcut-capture-hint">
                修饰键 + 主键追加一段；回车确认；退格删除最后一段；Esc 取消
            </div>
        </div>
    `,document.body.appendChild(e),s={actionId:t,overlay:e,previewEl:e.querySelector("#shortcut-capture-preview"),pressedMods:new Set,segments:[]},window.addEventListener("keydown",w,!0),window.addEventListener("keyup",E,!0),window.addEventListener("blur",y),u()}function f(){s&&(window.removeEventListener("keydown",w,!0),window.removeEventListener("keyup",E,!0),window.removeEventListener("blur",y),s.overlay.remove(),s=null)}function y(){s&&(s.pressedMods.clear(),u())}function x(){if(!s)return;const n=s.overlay.querySelector(".shortcut-capture-box").querySelector(".shortcut-capture-error");n&&n.remove()}function T(t){if(!s)return;const n=s.overlay.querySelector(".shortcut-capture-box");let e=n.querySelector(".shortcut-capture-error");e||(e=document.createElement("div"),e.className="shortcut-capture-error",n.appendChild(e)),e.textContent=t}function u(){if(!s)return;const{segments:t,pressedMods:n}=s,e=t.map(o=>b(o));if(n.size>0){const o=[...n].map(c=>b(c)).join(" + ");e.push(o+" + …")}s.previewEl.textContent=e.length?e.join("，"):"请按下快捷键序列…"}function w(t){if(!s||(t.preventDefault(),t.stopPropagation(),t.stopImmediatePropagation(),x(),t.repeat))return;if(t.code==="Enter"||t.code==="NumpadEnter"){if(s.segments.length>0){const e=s.segments.join(" ");q(s.actionId,e)}return}if(t.code==="Escape"&&s.pressedMods.size===0){f();return}if(t.code==="Backspace"){s.segments.length>0&&(s.segments.pop(),u());return}if(v(t.code)){s.pressedMods.add(t.code),u();return}const n=C(s.pressedMods,t.code);s.segments.push(n),u()}function E(t){s&&(t.preventDefault(),t.stopPropagation(),v(t.code)&&(s.pressedMods.delete(t.code),u()))}function q(t,n){const e=Object.entries(r).find(([o,c])=>o!==t&&c===n);if(e){const o=d.find(a=>a.id===e[0]),c=o?o.label:e[0];T(`「${g(n)}」已被「${c}」使用`);return}r[t]=n,l(t),f(),h()}function p(t){return String(t).replace(/[&<>"']/g,n=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[n])}export{H as meta,j as mount,A as unmount};
