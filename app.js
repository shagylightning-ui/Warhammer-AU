'use strict';
// ---------- IndexedDB ----------
let db;
const openDB=()=>new Promise((res,rej)=>{const r=indexedDB.open('gallery',1);
 r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('folders',{keyPath:'id'});const im=d.createObjectStore('images',{keyPath:'id'});im.createIndex('folder','folder');d.createObjectStore('blobs');d.createObjectStore('thumbs')};
 r.onsuccess=()=>res(db=r.result);r.onerror=()=>rej(r.error)});
const tx=(s,m='readonly')=>{if(!db)throw new Error('Storage is not ready. Reload the page in regular Safari.');return db.transaction(s,m)};
const P=r=>new Promise((a,b)=>{r.onsuccess=()=>a(r.result);r.onerror=()=>b(r.error)});
const all=s=>P(tx(s).objectStore(s).getAll());
const get=(s,k)=>P(tx(s).objectStore(s).get(k));
const put=(s,v,k)=>P(tx(s,'readwrite').objectStore(s).put(v,k));
const del=(s,k)=>P(tx(s,'readwrite').objectStore(s).delete(k));
const byFolder=f=>P(tx('images').objectStore('images').index('folder').getAll(f));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
async function saveImage(meta,blob,thumb){const t=tx(['images','blobs','thumbs'],'readwrite');
 t.objectStore('images').put(meta);t.objectStore('blobs').put(blob,meta.id);t.objectStore('thumbs').put(thumb,meta.id);
 return new Promise((a,b)=>{t.oncomplete=a;t.onerror=()=>b(t.error)})}
async function removeImage(id){const t=tx(['images','blobs','thumbs'],'readwrite');['images','blobs','thumbs'].forEach(s=>t.objectStore(s).delete(id));
 return new Promise(a=>t.oncomplete=a)}

// ---------- helpers ----------
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const urls=new Map();function turl(id,blob){if(!urls.has(id))urls.set(id,URL.createObjectURL(blob));return urls.get(id)}
function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,2200)}
async function makeThumb(blob,size=400){
 let src;try{src=await createImageBitmap(blob)}catch(e){src=await new Promise((a,b)=>{const i=new Image();i.onload=()=>a(i);i.onerror=b;i.src=URL.createObjectURL(blob)})}
 const w=src.width,h=src.height,s=Math.min(w,h),c=document.createElement('canvas');c.width=c.height=size;
 c.getContext('2d').drawImage(src,(w-s)/2,(h-s)/2,s,s,0,0,size,size);
 return new Promise(a=>c.toBlob(a,'image/jpeg',.8))}
function sheet(html,bind){$('#shBody').innerHTML=html;$('#sheet').hidden=false;return new Promise(res=>{const done=v=>{$('#sheet').hidden=true;res(v)};
 $('#shCancel').onclick=()=>done(null);bind&&bind(done)})}
function ask(title,val=''){return new Promise(res=>setTimeout(()=>{const v=window.prompt(title,val);res(v&&v.trim()?v.trim():null)},0))}
function menu(title,items){return sheet(`<h3>${esc(title)}</h3>`+items.map((it,i)=>`<button data-i="${i}" class="${it.danger?'danger':''}">${esc(it.label)}</button>`).join(''),done=>{
 $('#shBody').querySelectorAll('button[data-i]').forEach(b=>b.onclick=()=>done(items[b.dataset.i].v))})}

// ---------- state ----------
const S={folder:null,sel:null,cols:+localStorage.cols||3,q:'',list:[]};
async function folderPath(id){const out=[];while(id){const f=await get('folders',id);if(!f)break;out.unshift(f);id=f.parent}return out}

async function render(){
 const folders=await all('folders'),images=await all('images');
 const inF=S.folder?await get('folders',S.folder):null;if(S.folder&&!inF){S.folder=null}
 $('#title').textContent=S.q?'Search':inF?inF.name:'Gallery';
 $('#back').hidden=!S.folder&&!S.q;$('#addImgs').hidden=!S.folder||!!S.q;$('#selBtn').hidden=!S.folder&&!S.q;
 $('#addFolder').textContent=S.folder?'＋ Sub':'＋ Folder';$('#addFolder').hidden=!!S.q;
 $('#selBar').hidden=!S.sel;$('#fab').hidden=!!S.sel;
 const count={},cover={};images.sort((a,b)=>a.created-b.created).forEach(i=>{count[i.folder]=(count[i.folder]||0)+1;cover[i.folder]=cover[i.folder]||i.id});
 const deep=f=>count[f.id]||0?count[f.id]:0;
 const tot=id=>(count[id]||0)+folders.filter(f=>f.parent===id).reduce((s,f)=>s+tot(f.id),0);
 const firstCover=id=>cover[id]||folders.filter(f=>f.parent===id).map(f=>firstCover(f.id)).find(Boolean);
 let h='';
 if(S.q){const q=S.q.toLowerCase();S.list=images.filter(i=>(i.caption||'').toLowerCase().includes(q)||(i.name||'').toLowerCase().includes(q));
  h+=`<div class="sec">${S.list.length} result(s)</div>`}
 else{const subs=folders.filter(f=>(f.parent||null)===S.folder).sort((a,b)=>a.name.localeCompare(b.name));
  if(subs.length){h+=`<div class="sec">${S.folder?'Subfolders':'Folders'}</div><div class="folders">`;
   for(const f of subs){const c=firstCover(f.id);let bg='';if(c){const t=await get('thumbs',c);if(t)bg=`style="background-image:url(${turl(c,t)})"`}
    h+=`<div class="folder" data-f="${f.id}"><div class="cv" ${bg}>${bg?'':'▢'}</div><div class="nm">${esc(f.name)}</div><div class="ct">${tot(f.id)} image${tot(f.id)==1?'':'s'}</div><button class="fm" data-fm="${f.id}">⋯</button></div>`}
   h+='</div>'}
  S.list=S.folder?images.filter(i=>i.folder===S.folder):[];
  if(S.folder)h+=`<div class="sec">${S.list.length} image(s)</div>`;
  if(!subs.length&&!S.folder)h+=`<div class="empty">No folders yet.<br>Tap “＋ Folder” to create one.</div>`;
  else if(S.folder&&!S.list.length)h+=`<div class="empty">Empty. Tap “＋ Images” to add from your photo library.</div>`}
 h+=`<div class="grid" style="--cols:${S.cols}">`;
 for(const i of S.list){const t=await get('thumbs',i.id);h+=`<div class="cell ${S.sel&&S.sel.has(i.id)?'sel':''}" data-i="${i.id}" style="background-image:url(${t?turl(i.id,t):''})"></div>`}
 $('#main').innerHTML=h+'</div>';$('#selCount').textContent=S.sel?S.sel.size+' selected':'';
}

// ---------- events ----------
$('#main').addEventListener('click',async e=>{
 const fm=e.target.closest('[data-fm]');if(fm){e.stopPropagation();return folderMenu(fm.dataset.fm)}
 const f=e.target.closest('[data-f]');if(f){S.folder=f.dataset.f;S.q='';$('#q').value='';$('#searchRow').hidden=true;return render()}
 const c=e.target.closest('[data-i]');if(!c)return;
 if(S.sel){S.sel.has(c.dataset.i)?S.sel.delete(c.dataset.i):S.sel.add(c.dataset.i);c.classList.toggle('sel');$('#selCount').textContent=S.sel.size+' selected';return}
 openViewer(S.list.findIndex(i=>i.id===c.dataset.i))});
// long-press to start selection
let lp;$('#main').addEventListener('touchstart',e=>{const c=e.target.closest('[data-i]');if(!c||S.sel)return;lp=setTimeout(()=>{S.sel=new Set([c.dataset.i]);render()},500)},{passive:true});
['touchend','touchmove'].forEach(ev=>$('#main').addEventListener(ev,()=>clearTimeout(lp),{passive:true}));
// pinch to change columns
let pd=0;$('#main').addEventListener('touchmove',e=>{if(e.touches.length!==2)return;const[a,b]=e.touches,d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
 if(!pd){pd=d;return}if(Math.abs(d-pd)>60){setCols(S.cols+(d<pd?1:-1));pd=d}},{passive:true});
$('#main').addEventListener('touchend',()=>pd=0);
function setCols(n){S.cols=Math.max(2,Math.min(4,n));localStorage.cols=S.cols;document.querySelectorAll('.grid').forEach(g=>g.style.setProperty('--cols',S.cols))}
$('#sizeBtn').onclick=()=>setCols(S.cols>=4?2:S.cols+1);
$('#back').onclick=async()=>{if(S.q){S.q='';$('#q').value='';$('#searchRow').hidden=true}else{const f=await get('folders',S.folder);S.folder=f&&f.parent||null}S.sel=null;render()};
$('#searchBtn').onclick=()=>{const r=$('#searchRow');r.hidden=!r.hidden;if(!r.hidden)$('#q').focus();else{S.q='';render()}};
$('#q').oninput=e=>{S.q=e.target.value.trim();render()};
$('#selBtn').onclick=()=>{S.sel=S.sel?null:new Set();render()};
$('#addFolder').onclick=async()=>{const n=await ask(S.folder?'New subfolder':'New folder');if(!n)return;await put('folders',{id:uid(),name:n,parent:S.folder,created:Date.now()});render()};
$('#file').onchange=async e=>{const files=[...e.target.files];e.target.value='';let n=0;
 for(const f of files){try{toast(`Adding ${++n}/${files.length}…`);const th=await makeThumb(f);
  await saveImage({id:uid(),folder:S.folder,name:f.name,type:f.type,caption:'',created:Date.now()+n},f,th)}catch(err){console.error(err)}}
 toast(`Added ${n} image(s)`);render()};

async function folderMenu(id){const f=await get('folders',id);
 const a=await menu(f.name,[{label:'Rename',v:'r'},{label:'Move folder…',v:'m'},{label:'Delete folder and contents',v:'d',danger:1}]);
 if(a==='r'){const n=await ask('Rename folder',f.name);if(n){f.name=n;await put('folders',f)}}
 if(a==='m'){const t=await pickFolder('Move folder to',id,true);if(t!==undefined){f.parent=t;await put('folders',f)}}
 if(a==='d'&&confirm(`Delete “${f.name}” and everything in it?`))await deleteFolder(id);
 render()}
async function deleteFolder(id){for(const s of (await all('folders')).filter(x=>x.parent===id))await deleteFolder(s.id);
 for(const i of await byFolder(id))await removeImage(i.id);await del('folders',id)}
async function pickFolder(title,exclude,allowRoot){const fs=await all('folders');
 const bad=new Set();if(exclude){bad.add(exclude);let ch=true;while(ch){ch=false;fs.forEach(f=>{if(bad.has(f.parent)&&!bad.has(f.id)){bad.add(f.id);ch=true}})}}
 const lab=f=>{let p=[f.name],x=f;while(x.parent){x=fs.find(y=>y.id===x.parent);if(!x)break;p.unshift(x.name)}return p.join(' / ')};
 const items=fs.filter(f=>!bad.has(f.id)).map(f=>({label:lab(f),v:f.id})).sort((a,b)=>a.label.localeCompare(b.label));
 if(allowRoot)items.unshift({label:'(Top level)',v:'__root'});items.push({label:'＋ New folder…',v:'__new'});
 let r=await menu(title,items);if(r===null)return undefined;
 if(r==='__new'){const n=await ask('New folder');if(!n)return undefined;r=uid();await put('folders',{id:r,name:n,parent:null,created:Date.now()})}
 return r==='__root'?null:r}
$('#selBar').onclick=async e=>{const a=e.target.dataset.a;if(!a)return;const ids=[...(S.sel||[])];
 if(a==='cancel'){S.sel=null;return render()}if(!ids.length)return toast('Nothing selected');
 if(a==='del'){if(!confirm(`Delete ${ids.length} image(s)?`))return;for(const id of ids)await removeImage(id);toast('Deleted')}
 if(a==='move'||a==='copy'){const t=await pickFolder(a==='move'?'Move to':'Copy to');if(!t)return;
  for(const id of ids){const m=await get('images',id);if(a==='move'){m.folder=t;await put('images',m)}
   else await saveImage({...m,id:uid(),folder:t,created:Date.now()},await get('blobs',id),await get('thumbs',id))}
  toast(`${a==='move'?'Moved':'Copied'} ${ids.length}`)}
 S.sel=null;render()};
$('#menuBtn').onclick=async()=>{const a=await menu('Menu',[{label:'Export backup (.zip)',v:'e'},{label:'Import backup…',v:'i'},{label:'Storage info',v:'s'}]);
 if(a==='e')exportZip();if(a==='i')importPick();
 if(a==='s'){let m='';if(navigator.storage&&navigator.storage.estimate){const e=await navigator.storage.estimate();m=`Using ${(e.usage/1e6).toFixed(1)} MB of ~${(e.quota/1e6).toFixed(0)} MB.`}
  if(navigator.storage&&navigator.storage.persist)m+=(await navigator.storage.persist())?' Storage is persistent.':' Storage may be cleared by the browser; export backups regularly.';alert(m||'Unknown')}};

// ---------- viewer ----------
let V={i:0};
async function openViewer(i){V.i=i;$('#viewer').hidden=false;
 $('#vtrack').innerHTML=S.list.map((m,k)=>`<div class="sl" data-k="${k}"></div>`).join('');await showSlide()}
async function loadSlide(k){const sl=$(`#vtrack .sl[data-k="${k}"]`);if(!sl||sl.firstChild)return;const m=S.list[k];const b=await get('blobs',m.id);
 if(b){const u=URL.createObjectURL(b);sl.innerHTML=`<img src="${u}" alt="">`}}
async function showSlide(){const t=$('#vtrack');t.style.transform=`translateX(${-V.i*100}%)`;
 $('#vidx').textContent=`${V.i+1} / ${S.list.length}`;$('#vcap').value=S.list[V.i]?.caption||'';
 await Promise.all([V.i-1,V.i,V.i+1].map(loadSlide))}
function closeViewer(){$('#viewer').hidden=true;$('#vtrack').querySelectorAll('img').forEach(i=>URL.revokeObjectURL(i.src));$('#vtrack').innerHTML='';render()}
$('#vclose').onclick=closeViewer;
let sx=0,sy=0,dx=0,sw=false;const vt=$('#vtrack');
vt.addEventListener('touchstart',e=>{if(e.touches.length>1)return;sx=e.touches[0].clientX;sy=e.touches[0].clientY;dx=0;sw=true;vt.style.transition='none'},{passive:true});
vt.addEventListener('touchmove',e=>{if(!sw||e.touches.length>1)return;dx=e.touches[0].clientX-sx;if(Math.abs(e.touches[0].clientY-sy)>Math.abs(dx))return;vt.style.transform=`translateX(calc(${-V.i*100}% + ${dx}px))`},{passive:true});
vt.addEventListener('touchend',()=>{if(!sw)return;sw=false;vt.style.transition='';if(dx<-50&&V.i<S.list.length-1)V.i++;else if(dx>50&&V.i>0)V.i--;showSlide()});
document.addEventListener('keydown',e=>{if($('#viewer').hidden||e.target.tagName==='TEXTAREA')return;if(e.key==='ArrowRight'&&V.i<S.list.length-1){V.i++;showSlide()}if(e.key==='ArrowLeft'&&V.i>0){V.i--;showSlide()}if(e.key==='Escape')closeViewer()});
$('#vcap').onchange=async e=>{const m=S.list[V.i];m.caption=e.target.value;await put('images',m);toast('Caption saved')};
$('#vcap').onblur=$('#vcap').onchange;
function fname(m){const ext=(m.type||'image/png').split('/')[1].replace('jpeg','jpg');return /\.\w+$/.test(m.name||'')?m.name:(m.name||m.id)+'.'+ext}
$('#vshare').onclick=async()=>{const m=S.list[V.i],b=await get('blobs',m.id),file=new File([b],fname(m),{type:b.type||m.type});
 if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],text:m.caption||undefined})}catch(e){}}else download(b,fname(m))};
$('#vdl').onclick=async()=>{const m=S.list[V.i];download(await get('blobs',m.id),fname(m))};
$('#vdel').onclick=async()=>{const m=S.list[V.i];if(!confirm('Delete this image?'))return;await removeImage(m.id);S.list.splice(V.i,1);
 if(!S.list.length)return closeViewer();V.i=Math.min(V.i,S.list.length-1);openViewer(V.i)};
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000)}

// ---------- zip (store-only, no deps) ----------
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(u){let c=-1;for(let i=0;i<u.length;i++)c=CRC[(c^u[i])&255]^(c>>>8);return(c^-1)>>>0}
async function makeZip(entries){const parts=[],cd=[];let off=0;const enc=new TextEncoder();
 for(const e of entries){const name=enc.encode(e.name),data=e.data instanceof Uint8Array?e.data:new Uint8Array(await e.data.arrayBuffer()),crc=crc32(data);
  const h=new DataView(new ArrayBuffer(30));h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);
  parts.push(h,name,data);const c=new DataView(new ArrayBuffer(46));c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,off,true);
  cd.push(c,name);off+=30+name.length+data.length}
 const cdSize=cd.reduce((s,x)=>s+x.byteLength,0),end=new DataView(new ArrayBuffer(22));end.setUint32(0,0x06054b50,true);end.setUint16(8,entries.length,true);end.setUint16(10,entries.length,true);end.setUint32(12,cdSize,true);end.setUint32(16,off,true);
 return new Blob([...parts,...cd,end],{type:'application/zip'})}
async function readZip(blob){const buf=new Uint8Array(await blob.arrayBuffer()),dv=new DataView(buf.buffer);let e=buf.length-22;while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;if(e<0)throw Error('Not a zip');
 const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const out={},dec=new TextDecoder();
 for(let i=0;i<n;i++){const meth=dv.getUint16(p+10,true),cs=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),xl=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),lo=dv.getUint32(p+42,true),name=dec.decode(buf.subarray(p+46,p+46+nl));
  const ds=lo+30+dv.getUint16(lo+26,true)+dv.getUint16(lo+28,true);let data=buf.subarray(ds,ds+cs);
  if(meth===8){if(!window.DecompressionStream)throw Error('Compressed zip not supported here');data=new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer())}
  out[name]=data;p+=46+nl+xl+cl}return out}
async function exportZip(){toast('Preparing backup…');const folders=await all('folders'),images=await all('images'),entries=[];
 for(const m of images){const b=await get('blobs',m.id);if(b){m.file='images/'+m.id+'_'+fname(m).replace(/[^\w.-]/g,'_');entries.push({name:m.file,data:b})}}
 entries.unshift({name:'gallery.json',data:new TextEncoder().encode(JSON.stringify({app:'gallery',version:1,exported:new Date().toISOString(),folders,images}))});
 const z=await makeZip(entries),name=`gallery-backup-${new Date().toISOString().slice(0,10)}.zip`,file=new File([z],name,{type:'application/zip'});
 window.__lastExport=z;
 if(/iPhone|iPad|Android/.test(navigator.userAgent)&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file]});return}catch(e){}}
 download(z,name);toast(`Exported ${images.length} images`)}
function importPick(){const i=document.createElement('input');i.type='file';i.accept='.zip,application/zip';i.onchange=()=>i.files[0]&&importZip(i.files[0]);i.click()}
async function importZip(f){try{toast('Importing…');const z=await readZip(f),meta=JSON.parse(new TextDecoder().decode(z['gallery.json']));
  const have=new Set((await all('folders')).map(x=>x.id)),haveI=new Set((await all('images')).map(x=>x.id));
  for(const fo of meta.folders)if(!have.has(fo.id))await put('folders',fo);let n=0;
  for(const m of meta.images){if(haveI.has(m.id)||!z[m.file])continue;const b=new Blob([z[m.file]],{type:m.type||'image/jpeg'});const file=m.file;delete m.file;
   await saveImage(m,b,await makeThumb(b));n++}
  toast(`Imported ${n} image(s)`);render()}catch(e){alert('Import failed: '+e.message)}}
window.__importZip=importZip;

window.addEventListener('unhandledrejection',e=>alert('Something went wrong: '+((e.reason&&(e.reason.message||e.reason.name))||e.reason)));
window.addEventListener('error',e=>alert('Error: '+e.message));
if(!window.indexedDB){alert('This browser has storage turned off. Open the site in regular Safari (not Private Browsing or an in-app browser).')}
else openDB().then(render).catch(e=>alert('Could not open storage: '+(e&&(e.message||e.name))+'. Open the site in regular Safari, not Private Browsing or an in-app browser.'));
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');
