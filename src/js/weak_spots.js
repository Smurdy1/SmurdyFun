(() => {
"use strict";
const KEY="smurdy-weak-spots-v1", VERSION=1, MAX_STORED=100, MAX_VISIBLE=15, MAX_AGE_MS=90*24*60*60*1000;
const normalize=value=>String(value||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/&/g,"and").replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();
const empty=()=>({version:VERSION,entries:{}});
function read(){try{const value=JSON.parse(localStorage.getItem(KEY)||"null");if(value&&value.version===VERSION&&value.entries&&typeof value.entries==="object")return value;}catch(_){}return empty();}
function sorted(store=read()){return Object.values(store.entries||{}).filter(e=>e&&e.name&&Number(e.score)>0&&Date.now()-Number(e.updatedAt||0)<=MAX_AGE_MS).sort((a,b)=>Number(b.score||0)-Number(a.score||0)||Number(b.updatedAt||0)-Number(a.updatedAt||0)||String(a.name).localeCompare(String(b.name)));}
function write(store){try{const keep=sorted(store).slice(0,MAX_STORED);store.entries=Object.fromEntries(keep.map(e=>[e.key||normalize(e.name),e]));localStorage.setItem(KEY,JSON.stringify(store));window.dispatchEvent(new CustomEvent("smurdy:weakspotschange"));return true;}catch(_){return false;}}
function recordMiss(details={}){
 const name=String(details.name||"").trim(), key=normalize(name); if(!key)return null;
 const store=read(), mode=String(details.mode||"unknown").trim()||"unknown", group=String(details.group||"").trim(), now=Date.now();
 const saved=store.entries[key];
 const entry=saved&&now-Number(saved.updatedAt||0)<=MAX_AGE_MS?saved:{key,name,score:0,misses:0,retrySuccesses:0,modes:{},groups:{},createdAt:now,updatedAt:now};
 entry.name=name; entry.score=Math.min(999,Number(entry.score||0)+2); entry.misses=Number(entry.misses||0)+1; entry.updatedAt=now;
 entry.modes[mode]=Number(entry.modes[mode]||0)+1; if(group)entry.groups[group]=Number(entry.groups[group]||0)+1;
 store.entries[key]=entry; write(store); return {...entry};
}
function recordRetrySuccess(details={}){
 const key=normalize(details.name); if(!key)return null;
 const store=read(), entry=store.entries[key]; if(!entry)return null;
 entry.score=Math.max(0,Number(entry.score||0)-1); entry.retrySuccesses=Number(entry.retrySuccesses||0)+1; entry.updatedAt=Date.now();
 if(entry.score<=0)delete store.entries[key]; else store.entries[key]=entry; write(store); return entry.score>0?{...entry}:null;
}
const getAll=()=>sorted().map(e=>({...e,modes:{...(e.modes||{})},groups:{...(e.groups||{})}}));
function clearAll(){try{localStorage.removeItem(KEY);window.dispatchEvent(new CustomEvent("smurdy:weakspotschange"));return true;}catch(_){return false;}}
function modeLabel(mode){return ({"click-country":"Click Countries","type-country":"Type Countries","find-country":"No Borders","find-point":"Find from a Point","click-subdivision":"Click States","type-subdivision":"Type States","find-subdivision":"No Borders States","find-point-subdivision":"Find State from a Point"})[mode]||String(mode||"Quiz");}
function escapeHtml(value){return String(value||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function updateCount(){const badge=document.getElementById("weak-spots-count");if(!badge)return;const count=getAll().length;badge.textContent=count?String(count):"";badge.hidden=count===0;}
function close(dialog){if(typeof dialog.close==="function"&&dialog.open)dialog.close();else dialog.removeAttribute("open");document.body.classList.remove("weak-spots-dialog-open");}
function render(dialog){
 const list=dialog.querySelector("#weak-spots-list"), clear=dialog.querySelector("#weak-spots-clear"), entries=getAll(); if(!list)return;
 if(!entries.length)list.innerHTML='<li class="weak-spots-empty"><strong>No weak spots yet.</strong><span>Places you miss during quizzes will appear here.</span></li>';
 else list.innerHTML=entries.slice(0,MAX_VISIBLE).map(entry=>{
  const modes=Object.entries(entry.modes||{}).sort((a,b)=>Number(b[1])-Number(a[1])).map(([mode,count])=>escapeHtml(modeLabel(mode))+" "+Number(count)).join(" · ");
  return '<li class="weak-spot-item"><div class="weak-spot-name">'+escapeHtml(entry.name)+'</div><div class="weak-spot-meta">'+Number(entry.misses||0)+" recent "+(Number(entry.misses)===1?"miss":"misses")+(modes?" · "+modes:"")+"</div></li>";
 }).join("");
 if(clear)clear.disabled=entries.length===0; updateCount();
}
function ensureDialog(){
 let dialog=document.getElementById("weak-spots-dialog");if(dialog)return dialog;
 dialog=document.createElement("dialog");dialog.id="weak-spots-dialog";dialog.setAttribute("aria-labelledby","weak-spots-title");
 dialog.innerHTML='<div class="weak-spots-dialog-card"><header class="weak-spots-dialog-header"><div><h2 id="weak-spots-title">Weak Spots</h2><p>Recent mistakes stay on this device. Correct answers in Retry Missed gradually reduce them.</p></div><button id="weak-spots-close" type="button" aria-label="Close Weak Spots">×</button></header><ol id="weak-spots-list" class="weak-spots-list"></ol><footer class="weak-spots-dialog-footer"><span>Showing up to '+MAX_VISIBLE+' places</span><button id="weak-spots-clear" type="button">Clear Weak Spots</button></footer></div>';
 document.body.appendChild(dialog);
 dialog.querySelector("#weak-spots-close").addEventListener("click",()=>close(dialog));
 dialog.querySelector("#weak-spots-clear").addEventListener("click",()=>{if(window.confirm("Clear every saved weak spot on this device?")){clearAll();render(dialog);}});
 dialog.addEventListener("click",event=>{if(event.target===dialog)close(dialog);});
 dialog.addEventListener("cancel",()=>document.body.classList.remove("weak-spots-dialog-open"));
 return dialog;
}
function open(){const dialog=ensureDialog();render(dialog);document.body.classList.add("weak-spots-dialog-open");if(typeof dialog.showModal==="function"){if(!dialog.open)dialog.showModal();}else dialog.setAttribute("open","");}
function install(){const button=document.getElementById("weak-spots-open");if(button&&!button.dataset.weakSpotsBound){button.dataset.weakSpotsBound="true";button.addEventListener("click",open);}updateCount();}
window.SmurdyWeakSpots=Object.freeze({storageKey:KEY,recordMiss,recordRetrySuccess,getAll,clearAll,open});
window.addEventListener("smurdy:weakspotschange",updateCount);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
})();