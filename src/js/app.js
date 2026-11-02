import {icon} from './icons.js';
import {ProgressStore} from './progress.js';
import {Reader} from './reader.js';

const $ = s => document.querySelector(s);
const esc = t => String(t ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const root=$('#app'), sheet=$('#sheet');
let toastTimer, book, groups, chapters, reader, activeRoute, forwardId=null, routeVersion=0;
let searchWorker, searchId=0, searchTimer, query='', searchResults=[];
const cacheVersion='ppf-chapters-v1';
function toast(message) {
  $('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>$('#toast').hidden=true,4500);
}
const store=new ProgressStore(toast);
const offline=()=>!navigator.onLine?`<span class="offline-indicator">${icon('offline')}Offline</span>`:'';
const bar=(count,total)=>`<div class="bar ${count===total?'complete':''}"><span style="width:${total?count/total*100:0}%"></span></div>`;
const pct=(count,total)=>Math.round(count/total*100);
const groupLabel=g=>g.number?`Chapter ${g.number}`:g.id==='faa-addendum'?'Updates':g.title;
const label=(g,page)=>g.number?`${g.number}-${page}`:g.id==='glossary'?`G-${page}`:g.id==='index'?`Index-${page}`:String(page);

function brand(){return `<div class="topline"><div class="brand"><span class="brand-mark">${icon('plane')}</span>Pilot Path Flight</div>${offline()}</div>`;}
function library() {
  const ids=book.groups.flatMap(g=>g.pageIds), completed=store.count(ids);
  const completedChapters=chapters.filter(g=>store.count(g.pageIds)===g.pageCount).length;
  const last=store.state.last;
  root.innerHTML=`<div class="shell">${brand()}<div class="heading-row"><h1>Library</h1><button class="icon-btn" data-action="search" aria-label="Search handbook">${icon('search')}</button></div>
    <div class="library-lead"><section class="hero glass" aria-label="Airplane Flying Handbook"><img class="hero-photo" src="./assets/cessna-hero.webp" alt="Cessna 172 Skyhawk on a sunlit airport apron"><div class="hero-title"><div class="eyebrow">Federal Aviation Administration</div><h2>Airplane Flying<br>Handbook</h2><div class="edition">FAA-H-8083-3C<span class="edition-dot"></span>2021 edition</div></div></section>
    <section class="progress-card glass" aria-label="Book reading progress"><div class="progress-top"><div><div class="progress-title">Your reading progress</div><p class="progress-count">${completed} of ${book.pageCount} pages · ${completedChapters} of 18 chapters</p></div><div class="progress-value">${pct(completed,book.pageCount)}<small>%</small></div></div>${bar(completed,book.pageCount)}<button class="primary" data-action="continue">${icon('book')}<span>${last?'Continue Reading':'Start Reading'}</span>${icon('arrow')}</button></section></div>
    <section aria-label="All chapters"><div class="section-title"><h2>Chapters</h2><span>18 chapters</span></div><div class="chapter-list">${chapters.map(g=>chapterCard(g)).join('')}</div></section>
    <section class="extras" aria-label="Book reference pages"><div class="section-title"><h2>In the book</h2></div><div class="support-list glass">${book.groups.filter(g=>!g.number).map(g=>`<button class="support-row" data-group="${g.id}">${icon('book')}<span>${esc(g.title)}</span>${icon('chevron','chev')}</button>`).join('')}</div></section>
    <div class="updates-row support-list glass"><button class="support-row" data-group="faa-addendum"><span class="update-dot"></span><span>Updates<small>FAA addendum · October 2025</small></span>${icon('chevron','chev')}</button></div>
    <footer class="footer"><span>FAA-H-8083-3C · 2021</span><button class="text-button" data-action="credits">About & credits</button></footer></div>`;
}
function chapterCard(g){
  const count=store.count(g.pageIds),done=count===g.pageCount;
  return `<button class="chapter-card ${store.state.selected===g.id?'selected':''}" data-group="${g.id}" aria-label="Chapter ${g.number}: ${esc(g.title)}, ${pct(count,g.pageCount)} percent completed"><span class="chapter-number">${String(g.number).padStart(2,'0')}</span><span class="chapter-body"><span class="chapter-title">${esc(g.title)}</span><span class="chapter-status">${bar(count,g.pageCount)}<span>${pct(count,g.pageCount)}%</span></span></span>${icon(done?'circleCheck':'chevron',`chapter-end ${done?'done':''}`)}</button>`;
}
async function overview(g) {
  const count=g.pageIds?store.count(g.pageIds):0;
  const resume=store.state.positions[g.id];
  const contents=g.contents || (g.id==='front-matter'?[
    {title:'Cover',page:1,printedPage:'Cover'},{title:'Title page',page:2,printedPage:'Title'},
    {title:'Preface',page:4,printedPage:'i'},{title:'Acknowledgments',page:6,printedPage:'iii'},
    {title:'Major Revisions',page:7,printedPage:'iv'},{title:'Table of Contents',page:10,printedPage:'vii'}
  ]:[]);
  root.innerHTML=`<div class="shell"><div class="detail-top"><a class="back-button" href="#library">${icon('back')}Library</a>${offline()}</div>
    <section class="detail-hero glass"><div class="chapter-label">${esc(groupLabel(g))}</div><h1>${esc(g.title)}</h1>${g.pageIds?`<div class="detail-progress">${bar(count,g.pageCount)}<span>${count} of ${g.pageCount} pages · ${pct(count,g.pageCount)}%</span></div>`:`<p class="edition" style="margin-bottom:20px">${esc(g.date)} · ${g.pageCount} pages</p>`}
    <button class="primary" data-open="${g.id}" data-page="1">${g.number?'Open Chapter':g.id==='faa-addendum'?'Open Addendum':'Open Book Pages'}${icon('arrow')}</button>
    ${resume?`<button class="secondary" data-open="${g.id}" data-page="${resume}">Resume Reading<span>· ${esc(label(g,resume))}</span></button>`:''}
    <div class="download-control"><button data-download="${g.id}">${icon('download')}<span>Download for offline</span></button><span>${(g.bytes/1024/1024).toFixed(1)} MB</span></div></section>
    ${contents.length?`<div class="section-title"><h2>Contents</h2></div><div class="contents-list glass">${contents.map(c=>`<button class="contents-row depth-${c.depth||0}" data-open="${g.id}" data-page="${c.page}"><span>${esc(c.title)}</span><span class="page-ref">${esc(c.printedPage)}</span></button>`).join('')}</div>`:g.id==='faa-addendum'?`<p class="sheet-copy">Original FAA addendum, kept separate from the 2021 handbook.<br><a href="${esc(g.sourceUrl)}" target="_blank" rel="noopener">Official FAA source</a></p>`:''}</div>`;
  await updateDownload(g);
}
async function cached(g){
  try{if(!('caches'in window))return false;const cache=await caches.open(cacheVersion);return !!await cache.match(new URL(g.path,document.baseURI).href);}
  catch{return false;}
}
async function updateDownload(g){
  const has=await cached(g), button=document.querySelector(`[data-download="${g.id}"]`);
  if(button){button.innerHTML=icon(has?'circleCheck':'download')+`<span>${has?'Available offline':'Download for offline'}</span>`;button.dataset.cached=has?'true':'false';button.setAttribute('aria-label',has?'Available offline. Remove download':'Download for offline');}
}
async function download(g,button){
  if(button.dataset.cached==='true'){
    const cache=await caches.open(cacheVersion);await cache.delete(new URL(g.path,document.baseURI).href);await updateDownload(g);return;
  }
  if(!('caches'in window)){toast('Offline storage is unavailable in this browser.');return;}
  button.disabled=true;button.innerHTML='<span class="spinner"></span><span>Downloading…</span>';
  try{
    const url=new URL(g.path,document.baseURI).href;
    const response=await fetch(url);
    if(!response.ok)throw new Error();
    const cache=await caches.open(cacheVersion);await cache.put(url,response);
    await navigator.storage?.persist?.();
    await updateDownload(g);
  }catch{toast(navigator.onLine?'The chapter could not be saved. Check available device storage.':'Reconnect to download this chapter.');await updateDownload(g);}
  finally{button.disabled=false;}
}

function searchScreen(){
  root.innerHTML=`<div class="shell">${brand()}<div class="heading-row"><h1>Search</h1></div><div class="search-header"><label class="search-input-wrap">${icon('search')}<input id="search-input" type="search" inputmode="search" placeholder="Search the handbook" aria-label="Search handbook text" autocomplete="off" autocapitalize="none" spellcheck="false" value="${esc(query)}"></label><a href="#library" class="cancel-search">Cancel</a></div><p class="search-status" id="search-status" role="status"></p><div id="search-results" class="search-results"></div></div>`;
  if(!searchWorker){
    searchWorker=new Worker(new URL('./search-worker.js',import.meta.url),{type:'module'});
    searchWorker.onmessage=({data})=>{
      if(data.id!==searchId||activeRoute!=='search')return;
      if(data.error){$('#search-status').textContent=data.error;return;}
      searchResults=data.results;renderResults(data.total);
    };
    searchWorker.onerror=()=>{if(activeRoute==='search')$('#search-status').textContent='Search could not be loaded. Try reloading the app.';};
  }
  $('#search-input').addEventListener('input',e=>{query=e.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(runSearch,160);});
  runSearch();
  setTimeout(()=>$('#search-input')?.focus({preventScroll:true}),80);
}
function runSearch(){
  if(activeRoute!=='search')return;
  if(!query.trim()){searchId++;searchResults=[];$('#search-status').textContent='';$('#search-results').innerHTML=`<div class="search-empty">${icon('search')}<p>Find a chapter, section,<br>or word in the book.</p></div>`;return;}
  $('#search-status').textContent='Searching…';
  searchWorker.postMessage({query,id:++searchId,groups:Object.fromEntries(book.groups.map(g=>[g.id,{title:g.title,number:g.number}]))});
}
function highlight(text){
  const tokens=query.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(' ').filter(Boolean);
  if(!tokens.length)return esc(text);
  return esc(text).replace(new RegExp(`(${tokens.join('|')})`,'gi'),'<mark>$1</mark>');
}
function renderResults(total){
  $('#search-status').textContent=total?`${total} matching ${total===1?'page':'pages'}${total>80?' · first 80 shown':''}`:'No matches';
  $('#search-results').innerHTML=searchResults.map(r=>{
    const g=groups[r.groupId];
    return `<button class="search-result" data-open="${g.id}" data-page="${r.page}"><span class="result-label"><span>${esc(groupLabel(g))}</span><span>Page ${esc(r.printedPage)}</span></span><div class="result-title">${highlight(g.title)}</div>${r.heading?`<div class="result-heading">${highlight(r.heading)}</div>`:''}<p class="result-excerpt">${highlight(r.excerpt)}</p></button>`;
  }).join('');
}
function showSheet(title,html){
  reader.pause();sheet.innerHTML=`<div class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-action="close-sheet" aria-label="Close">${icon('close')}</button></div><div class="sheet-body">${html}</div>`;sheet.showModal();
}
sheet.addEventListener('close',()=>reader.resume());
sheet.addEventListener('click',e=>{if(e.target===sheet){const r=sheet.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)sheet.close();}});
function showStatus(){
  const id=reader.group.pageIds[reader.page-1],completed=store.completed(id);
  showSheet(`Page ${reader.printedPage()}`,`<button class="status-option ${completed?'selected':''}" data-status="complete">${icon('circleCheck')}Completed${completed?icon('check','trailing'):''}</button><button class="status-option ${!completed?'selected':''}" data-status="incomplete">${icon('circle')}Incomplete${!completed?icon('check','trailing'):''}</button>`);
}
function showPages(){
  const g=reader.group;
  showSheet('Pages',`<form class="page-jump" id="page-jump"><label for="jump-page">Go to page</label><input id="jump-page" type="number" min="1" max="${g.pageCount}" value="${reader.page}" inputmode="numeric" required><button type="submit">Go</button></form><div class="page-grid">${Array.from({length:g.pageCount},(_,i)=>`<button class="page-tile ${i+1===reader.page?'current':''}" data-open="${g.id}" data-page="${i+1}" ${i+1===reader.page?'aria-current="page"':''}>${esc(label(g,i+1))}${g.pageIds&&store.completed(g.pageIds[i])?icon('check'):''}</button>`).join('')}</div>`);
  $('#page-jump').addEventListener('submit',e=>{e.preventDefault();const p=Number($('#jump-page').value);if(Number.isInteger(p)&&p>=1&&p<=g.pageCount){sheet.close();goReader(g.id,p);}});
}
function credits(){
  showSheet('About & credits',`<div class="sheet-copy"><p><strong>Pilot Path Flight</strong><br>Airplane Flying Handbook · FAA-H-8083-3C · 2021.<br>406 original pages. October 2025 addendum included separately.</p><p><a href="https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/airplane_handbook" target="_blank" rel="noopener">Official FAA handbook</a></p><p>Decorative Cessna photograph created for this app with OpenAI image generation. Resized, desaturated, and blurred in the interface. Handbook imagery is unchanged.</p><p>PDF rendering: Mozilla PDF.js 5.6.205, Apache 2.0. Original handbook acknowledgments are retained in front matter.</p><p>Reading history is stored on this device. Clearing website data removes reading history and downloads. Safari may reclaim offline storage.</p></div>`);
}
function goReader(id,page,completedId=null){
  if(sheet.open)sheet.close();
  const target=`#reader/${id}/${page}`;
  if(location.hash===target)return;
  forwardId=completedId;location.hash=target;
}
async function route(){
  const version=++routeVersion;
  const parts=location.hash.slice(1).split('/');
  const dest=parts[0]||'library';
  if(sheet.open)sheet.close();
  if(dest==='reader'&&groups[parts[1]]){
    activeRoute='reader';const g=groups[parts[1]],p=Math.max(1,Math.min(g.pageCount,Math.trunc(Number(parts[2]))||1));
    const candidate=forwardId;forwardId=null;
    await reader.show(g,p,candidate);return;
  }
  forwardId=null;
  if(activeRoute==='reader')await reader.close();
  if(version!==routeVersion)return;
  document.body.classList.remove('reading');
  window.scrollTo(0,0);
  if(dest==='chapter'&&groups[parts[1]]){
    activeRoute='chapter';store.state.selected=parts[1];store.save();await overview(groups[parts[1]]);
  }else if(dest==='search'){activeRoute='search';searchScreen();}
  else{activeRoute='library';library();}
}
document.addEventListener('click',e=>{
  const el=e.target.closest('button');if(!el)return;
  if(el.dataset.group){location.hash=`#chapter/${el.dataset.group}`;return;}
  if(el.dataset.open){goReader(el.dataset.open,Number(el.dataset.page)||1);return;}
  if(el.dataset.download){download(groups[el.dataset.download],el);return;}
  if(el.dataset.status){
    const id=reader.group.pageIds[reader.page-1];store.manual(id,el.dataset.status==='complete');
    sheet.close();reader.updateControls();return;
  }
  switch(el.dataset.action){
    case 'search':location.hash='#search';break;
    case 'continue':{const last=store.state.last;goReader(last&&groups[last.groupId]?last.groupId:'chapter-01',last?.page||1);break;}
    case 'credits':credits();break;
    case 'close-sheet':sheet.close();break;
    case 'reload':location.reload();break;
  }
});
for(const event of ['online','offline'])window.addEventListener(event,()=>{
  if(activeRoute==='library')library();
  if(activeRoute==='chapter'){const id=location.hash.split('/')[1];if(groups[id])overview(groups[id]);}
});
window.addEventListener('storage',e=>{if(e.key==='pilot-path-flight.reader.v1'){try{const s=JSON.parse(e.newValue);if(s?.version===1){store.state=s;if(activeRoute==='library')library();else if(activeRoute==='reader')reader.updateControls();}}catch{}}});
async function boot(){
  try{
    const response=await fetch('./data/book.json');if(!response.ok)throw new Error();book=await response.json();
    chapters=book.groups.filter(g=>g.number);groups=Object.fromEntries([...book.groups,book.update].map(g=>[g.id,g]));
    reader=new Reader({root,store,groups:book.groups,navigate:goReader,showStatus,showPages,toast});
    window.addEventListener('hashchange',route);await route();
    if('serviceWorker'in navigator){
      try{await navigator.serviceWorker.register('./sw.js',{scope:'./'});}catch{toast('Offline support could not be enabled.');}
    }
  }catch(error){console.error(error);root.innerHTML='<div class="fatal">The Library could not be loaded.<br>Check your connection and try again.<button class="primary" data-action="reload">Reload Library</button></div>';}
}
boot();
