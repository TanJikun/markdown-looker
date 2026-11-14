import{D as m,A as b,f as l,i as w,b as M}from"./shortcuts-CQhtVUC6.js";const H={id:"shortcuts",title:"快捷键"};let i,r={},s=null;async function D(t,e){i=e;const o=i.getConfig();r={...m,...o.shortcuts||{}},t.innerHTML=`
        <h2 class="settings-panel-title">快捷键</h2>
        <div class="settings-shortcuts-hint">
            点击「编辑」后按下组合键即可绑定。组合键区分左右修饰键，也区分主键盘与小键盘。
            单键绑定（如 <code>A</code>）会拦截编辑器中的该键输入，请谨慎使用。
        </div>
        <div id="shortcuts-table-host"></div>
    `,S()}function N(){p(),i=null,r={}}function S(){const t=document.getElementById("shortcuts-table-host");if(!t)return;const e=new Map;for(const n of b)e.has(n.group)||e.set(n.group,[]),e.get(n.group).push(n);const o=[];for(const[n,u]of e){o.push('<table class="settings-table">'),o.push(`<thead><tr><th colspan="3" class="settings-table-group">${n}</th></tr></thead>`),o.push("<tbody>");for(const c of u){const a=r[c.id]||"",h=a?`<span class="shortcut-key">${d(l(a))}</span>`:'<span class="shortcut-empty">未绑定</span>';o.push(`
                <tr data-action="${c.id}">
                    <td class="col-desc">${d(c.label)}</td>
                    <td class="col-key">${h}</td>
                    <td class="col-ops">
                        <button type="button" class="settings-action-btn" data-op="edit" data-id="${c.id}">编辑</button>
                        <button type="button" class="settings-action-btn" data-op="reset" data-id="${c.id}">重置</button>
                        <button type="button" class="settings-action-btn" data-op="unbind" data-id="${c.id}">解绑</button>
                    </td>
                </tr>
            `)}o.push("</tbody></table>")}t.innerHTML=o.join(""),t.addEventListener("click",$)}function $(t){const e=t.target.closest("button[data-op]");if(!e)return;const o=e.dataset.op,n=e.dataset.id;n&&(o==="edit"?x(n):o==="reset"?L(n):o==="unbind"&&k(n))}function v(t){const e=document.querySelector(`tr[data-action="${t}"]`);if(!e)return;const o=e.querySelector(".col-key");if(!o)return;const n=r[t]||"";o.innerHTML=n?`<span class="shortcut-key">${d(l(n))}</span>`:'<span class="shortcut-empty">未绑定</span>'}async function L(t){r[t]=m[t]||"",v(t),await y()}async function k(t){r[t]="",v(t),await y()}async function y(){if(await i.patchConfig({shortcuts:{...r}}),i.emit)try{await i.emit("settings:shortcuts-changed",{shortcuts:{...r}})}catch(t){console.warn("[shortcuts] emit 失败:",t)}}function x(t){p();const e=b.find(n=>n.id===t);if(!e)return;const o=document.createElement("div");o.className="shortcut-capture-overlay",o.innerHTML=`
        <div class="shortcut-capture-box">
            <div class="shortcut-capture-title">为「${d(e.label)}」设置快捷键</div>
            <div class="shortcut-capture-preview" id="shortcut-capture-preview">请按下快捷键…</div>
            <div class="shortcut-capture-hint">按 Esc 取消（若想绑定 Esc 本身，请加修饰键）</div>
        </div>
    `,document.body.appendChild(o),s={actionId:t,overlay:o,previewEl:o.querySelector("#shortcut-capture-preview"),pressedMods:new Set},window.addEventListener("keydown",C,!0),window.addEventListener("keyup",E,!0),window.addEventListener("blur",g)}function p(){s&&(window.removeEventListener("keydown",C,!0),window.removeEventListener("keyup",E,!0),window.removeEventListener("blur",g),s.overlay.remove(),s=null)}function g(){s&&(s.pressedMods.clear(),f())}function T(){if(!s)return;const e=s.overlay.querySelector(".shortcut-capture-box").querySelector(".shortcut-capture-error");e&&e.remove()}function C(t){if(!s)return;if(t.preventDefault(),t.stopPropagation(),t.stopImmediatePropagation(),T(),w(t.code)){s.pressedMods.add(t.code),f();return}if(t.repeat)return;if(t.code==="Escape"&&s.pressedMods.size===0){p();return}const e=M(s.pressedMods,t.code);q(s.actionId,e)}function E(t){s&&(t.preventDefault(),t.stopPropagation(),w(t.code)&&(s.pressedMods.delete(t.code),f()))}function f(){if(!s)return;const t=[...s.pressedMods];if(t.length===0){s.previewEl.textContent="请按下快捷键…";return}s.previewEl.textContent=t.map(e=>l(e)).join(" + ")+" + …"}function q(t,e){const o=Object.entries(r).find(([n,u])=>n!==t&&u===e);if(o){const n=b.find(h=>h.id===o[0]),u=n?n.label:o[0],c=s.overlay.querySelector(".shortcut-capture-box");let a=c.querySelector(".shortcut-capture-error");a||(a=document.createElement("div"),a.className="shortcut-capture-error",c.appendChild(a)),a.textContent=`「${l(e)}」已被「${u}」使用`,s.pressedMods.clear(),f();return}r[t]=e,v(t),p(),y()}function d(t){return String(t).replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e])}export{H as meta,D as mount,N as unmount};
