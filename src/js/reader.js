import {icon} from './icons.js';

const esc = t => String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let library;
async function pdfjs() {
  if (!library) {
    library = await import('../../vendor/pdf.mjs');
    library.GlobalWorkerOptions.workerSrc = new URL('../../vendor/pdf.worker.mjs',import.meta.url).href;
  }
  return library;
}

export class Reader {
  constructor({root,store,groups,navigate,showStatus,showPages,toast}) {
    Object.assign(this,{root,store,groups,navigate,showStatus,showPages,toast});
    this.generation=0; this.zoom=1; this.x=0; this.y=0; this.pointers=new Map();
    this.onVisibility=()=>{ this.elapsed=this.visibleTime(); this.clock=document.hidden?null:performance.now(); };
    this.onKey=e=>{
      if (document.querySelector('dialog[open]') || ['INPUT','TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key==='ArrowRight') { e.preventDefault(); this.step(1); }
      if (e.key==='ArrowLeft') { e.preventDefault(); this.step(-1); }
      if (e.key==='Escape') { if(this.focused)this.focus(false); else location.hash='#library'; }
    };
    document.addEventListener('visibilitychange',this.onVisibility);
    document.addEventListener('keydown',this.onKey);
  }
  mount() {
    document.body.classList.add('reading');
    this.root.innerHTML=`<section class="reader" aria-label="PDF reader">
      <header class="reader-top"><a href="#library" class="back-button" aria-label="Back to Library">${icon('back')}<span>Library</span></a><div class="reader-title"><div class="small-label" id="reader-chapter"></div><h1 id="reader-title"></h1></div><button class="icon-btn" data-reader="status" aria-label="Page completion" title="Page completion">${icon('circle')}</button></header>
      <div class="reader-stage" tabindex="0" aria-label="Original PDF page. Tap to hide or show controls. Pinch to zoom."><div class="page-wrap loading"><canvas id="pdf-canvas" role="img" aria-label="Original FAA handbook page"></canvas></div><div class="reader-error" hidden><p></p><button class="primary" data-reader="retry">Try again</button></div></div>
      <footer class="reader-bottom"><div class="reader-page-row"><button class="nav-page" data-reader="previous" aria-label="Previous page">${icon('back')}<span>Previous</span></button><button class="page-selector" data-reader="pages" aria-label="Choose page"><span id="reader-page-label"></span><small id="reader-page-count"></small></button><button class="nav-page next" data-reader="next" aria-label="Next page"><span>Next</span>${icon('chevron')}</button></div><div class="reader-utilities"><button data-reader="zoom-out" aria-label="Zoom out">${icon('minus')}</button><button data-reader="reset-zoom" aria-label="Reset zoom"><span id="zoom-label">100%</span></button><button data-reader="zoom-in" aria-label="Zoom in">${icon('plus')}</button><button data-reader="focus" aria-label="Hide reader controls">${icon('focus')}</button></div></footer>
      <div class="page-announcement" aria-live="polite" id="page-announcement"></div></section>`;
    this.section=this.root.querySelector('.reader');
    this.stage=this.root.querySelector('.reader-stage');
    this.wrap=this.root.querySelector('.page-wrap');
    this.canvas=this.root.querySelector('canvas');
    this.error=this.root.querySelector('.reader-error');
    this.section.addEventListener('click',e=>{
      const action=e.target.closest('[data-reader]')?.dataset.reader;
      if(action==='next')this.step(1);
      if(action==='previous')this.step(-1);
      if(action==='status'&&this.rendered)this.showStatus();
      if(action==='pages')this.showPages();
      if(action==='focus')this.focus(true);
      if(action==='zoom-in')this.setZoom(this.zoom+.5);
      if(action==='zoom-out')this.setZoom(this.zoom-.5);
      if(action==='reset-zoom')this.setZoom(1);
      if(action==='retry')this.show(this.group,this.page);
    });
    this.stage.addEventListener('pointerdown',e=>this.pointerDown(e));
    this.stage.addEventListener('pointermove',e=>this.pointerMove(e));
    this.stage.addEventListener('pointerup',e=>this.pointerUp(e));
    this.stage.addEventListener('pointercancel',e=>{this.pointers.delete(e.pointerId);this.moved=true;});
    this.stage.addEventListener('wheel',e=>{
      if(e.ctrlKey||e.metaKey){e.preventDefault();this.setZoom(this.zoom*(e.deltaY>0?.9:1.1));}
      else if(this.zoom>1){e.preventDefault();this.x-=e.deltaX;this.y-=e.deltaY;this.transform();}
    },{passive:false});
    this.observer=new ResizeObserver(()=>{
      clearTimeout(this.resizeTimer);
      this.resizeTimer=setTimeout(()=>{if(this.pdfPage&&this.rendered)this.render(false);},100);
    });
    this.observer.observe(this.stage);
  }
  async show(group,page,forwardId=null) {
    if(!this.section?.isConnected)this.mount();
    const gen=++this.generation;
    const previousPage=this.pdfPage;
    this.rendered=false; this.clock=null; this.elapsed=0;
    this.canvas.removeAttribute('data-rendered');
    this.group=group; this.page=page; this.pdfPage=null;
    this.zoom=1;this.x=0;this.y=0;this.transform();
    this.wrap.classList.add('loading');this.error.hidden=true;
    this.updateControls();
    try {
      this.renderTask?.cancel();
      try { await this.renderTask?.promise; } catch {}
      previousPage?.cleanup();
      const lib=await pdfjs();
      if(gen!==this.generation)return;
      if(this.docGroup!==group.id || !this.doc) {
        await this.loadTask?.destroy();
        if(gen!==this.generation)return;
        this.doc=null; this.docGroup=group.id;
        this.loadTask=lib.getDocument({url:new URL('../../'+group.path,import.meta.url).href,
          cMapUrl:new URL('../../vendor/cmaps/',import.meta.url).href,cMapPacked:true,
          standardFontDataUrl:new URL('../../vendor/standard_fonts/',import.meta.url).href,
          wasmUrl:new URL('../../vendor/wasm/',import.meta.url).href,
          disableRange:true,disableStream:true,disableAutoFetch:true,isEvalSupported:false});
        const doc=await this.loadTask.promise;
        if(gen!==this.generation)return;
        this.doc=doc;
      }
      const pdfPage=await this.doc.getPage(page);
      if(gen!==this.generation)return;
      this.pdfPage=pdfPage;
      await this.render(true);
      if(gen!==this.generation)return;
      this.rendered=true;this.clock=document.hidden?null:performance.now();
      if(group.pageIds) {
        if(forwardId)this.store.auto(forwardId);
        this.store.position(group.id,page);
      }
      this.updateControls();
      document.getElementById('page-announcement').textContent=`${group.title}, page ${this.printedPage()}`;
    } catch(error) {
      if(gen!==this.generation || error?.name==='RenderingCancelledException')return;
      console.error('PDF could not be opened',error);
      this.wrap.classList.remove('loading');this.error.hidden=false;
      this.error.querySelector('p').textContent=navigator.onLine?'This PDF could not be opened. Try again.':'This chapter is not available offline.';
      this.updateControls();
    }
  }
  async render(reset=false) {
    const page=this.pdfPage;
    if(!page)return;
    const renderGen=this.renderGeneration=(this.renderGeneration||0)+1;
    this.renderTask?.cancel();
    try { await this.renderTask?.promise; } catch {}
    if(page!==this.pdfPage||renderGen!==this.renderGeneration)return;
    const natural=page.getViewport({scale:1});
    const pad=this.focused?5:12;
    const style=getComputedStyle(this.stage);
    const availableHeight=this.stage.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)-pad*2;
    const fit=Math.min((this.stage.clientWidth-pad*2)/natural.width,availableHeight/natural.height);
    if(fit<=0)return;
    this.baseWidth=natural.width*fit;this.baseHeight=natural.height*fit;
    this.wrap.style.width=this.baseWidth+'px';this.wrap.style.height=this.baseHeight+'px';
    // One canvas, bounded to 7 million pixels (28 MB RGBA), even at high zoom.
    const desired=fit*Math.min(devicePixelRatio||1,3)*this.zoom;
    const scale=Math.min(desired,Math.sqrt(7_000_000/(natural.width*natural.height)));
    const viewport=page.getViewport({scale});
    this.canvas.width=Math.ceil(viewport.width);this.canvas.height=Math.ceil(viewport.height);
    this.canvas.setAttribute('aria-label',`${this.group.title}, original FAA page ${this.printedPage()}`);
    this.renderTask=page.render({canvasContext:this.canvas.getContext('2d',{alpha:false}),viewport,
      background:'rgb(255,255,255)'});
    try { await this.renderTask.promise; }
    catch(e) {if(e.name==='RenderingCancelledException')return;throw e;}
    if(page!==this.pdfPage||renderGen!==this.renderGeneration)return;
    this.wrap.classList.remove('loading');this.transform();
    this.canvas.dataset.rendered=`${this.group.id}:${this.page}`;
    if(reset)this.stage.scrollTop=0;
  }
  printedPage(){return this.group?.number?`${this.group.number}-${this.page}`:this.group?.id==='glossary'?`G-${this.page}`:this.group?.id==='index'?`Index-${this.page}`:this.group?.id==='front-matter'?({1:'Cover',2:'Title',3:'Blank'}[this.page]||this.roman(this.page-3)):String(this.page);}
  roman(n){const vals=[[10,'x'],[9,'ix'],[5,'v'],[4,'iv'],[1,'i']];let s='';for(const [v,l]of vals)while(n>=v){s+=l;n-=v;}return s;}
  visibleTime(){return (this.elapsed||0)+(this.clock!==null&&this.clock!==undefined?performance.now()-this.clock:0);}
  pause(){this.elapsed=this.visibleTime();this.clock=null;}
  resume(){if(this.rendered&&!document.hidden)this.clock=performance.now();}
  nextTarget(delta) {
    if(!this.group)return null;
    const p=this.page+delta;
    if(p>=1&&p<=this.group.pageCount)return {group:this.group,page:p};
    const i=this.groups.findIndex(g=>g.id===this.group.id);
    if(i<0)return null;
    const g=this.groups[i+delta];return g?{group:g,page:delta>0?1:g.pageCount}:null;
  }
  step(delta) {
    if(!this.rendered)return;
    const target=this.nextTarget(delta);if(!target)return;
    const id=delta===1&&this.group.pageIds&&this.visibleTime()>=2000?this.group.pageIds[this.page-1]:null;
    this.navigate(target.group.id,target.page,id);
  }
  updateControls(){
    if(!this.group)return;
    document.getElementById('reader-chapter').textContent=this.group.number?`Chapter ${this.group.number}`:this.group.id==='faa-addendum'?'Updates':'Airplane Flying Handbook';
    document.getElementById('reader-title').textContent=this.group.title;
    document.getElementById('reader-page-label').textContent=this.printedPage();
    document.getElementById('reader-page-count').textContent=`· ${this.page} of ${this.group.pageCount}`;
    const status=this.section.querySelector('[data-reader=status]');
    const completed=this.group.pageIds&&this.store.completed(this.group.pageIds[this.page-1]);
    status.innerHTML=icon(completed?'circleCheck':'circle');
    status.classList.toggle('completed',!!completed);status.classList.add('page-complete');
    status.disabled=!this.rendered||!this.group.pageIds;status.setAttribute('aria-label',completed?'Page completed. Change status':'Page incomplete. Change status');
    this.section.querySelector('[data-reader=previous]').disabled=!this.rendered||!this.nextTarget(-1);
    this.section.querySelector('[data-reader=next]').disabled=!this.rendered||!this.nextTarget(1);
  }
  focus(value){this.focused=value;this.section.classList.toggle('focus',value);if(this.pdfPage)this.render(false);}
  transform(){
    if(!this.wrap)return;
    const maxX=Math.max(0,((this.baseWidth||0)*this.zoom-this.stage.clientWidth)/2)+20*(this.zoom-1);
    const maxY=Math.max(0,((this.baseHeight||0)*this.zoom-this.stage.clientHeight)/2)+20*(this.zoom-1);
    this.x=Math.max(-maxX,Math.min(maxX,this.x));this.y=Math.max(-maxY,Math.min(maxY,this.y));
    this.wrap.style.transform=`translate(${this.x}px,${this.y}px) scale(${this.zoom})`;
    const label=document.getElementById('zoom-label');if(label)label.textContent=`${Math.round(this.zoom*100)}%`;
  }
  setZoom(value){this.zoom=Math.max(1,Math.min(4,value));if(this.zoom===1){this.x=0;this.y=0;}this.transform();this.scheduleRender();}
  scheduleRender(){clearTimeout(this.zoomTimer);this.zoomTimer=setTimeout(()=>{if(this.pdfPage)this.render(false);},180);}
  pointerDown(e){
    if(e.target.closest('button,a'))return;
    this.stage.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(this.pointers.size===1){this.start={x:e.clientX,y:e.clientY,tx:this.x,ty:this.y,time:performance.now()};this.moved=false;}
    if(this.pointers.size===2){const [a,b]=[...this.pointers.values()];this.pinchStart=Math.hypot(a.x-b.x,a.y-b.y);this.pinchZoom=this.zoom;this.moved=true;}
  }
  pointerMove(e){
    if(!this.pointers.has(e.pointerId))return;
    this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(this.pointers.size===2){const[a,b]=[...this.pointers.values()];this.zoom=Math.max(1,Math.min(4,this.pinchZoom*Math.hypot(a.x-b.x,a.y-b.y)/this.pinchStart));this.transform();this.scheduleRender();return;}
    if(!this.start)return;
    const dx=e.clientX-this.start.x,dy=e.clientY-this.start.y;
    if(Math.hypot(dx,dy)>7)this.moved=true;
    if(this.zoom>1){this.x=this.start.tx+dx;this.y=this.start.ty+dy;this.transform();}
  }
  pointerUp(e){
    if(!this.pointers.has(e.pointerId))return;
    const count=this.pointers.size;this.pointers.delete(e.pointerId);
    if(count===1&&!this.moved&&this.start&&performance.now()-this.start.time<450){
      const now=performance.now();
      if(this.lastTap&&now-this.lastTap<300){clearTimeout(this.tapTimer);this.setZoom(this.zoom>1?1:2);this.lastTap=0;}
      else {this.lastTap=now;this.tapTimer=setTimeout(()=>this.focus(!this.focused),280);}
    }
    if(this.pointers.size===1){const p=[...this.pointers.values()][0];this.start={...p,tx:this.x,ty:this.y,time:performance.now()};this.moved=true;}
    if(!this.pointers.size)this.start=null;
  }
  async close(){
    ++this.generation;this.rendered=false;this.clock=null;this.pdfPage=null;
    clearTimeout(this.zoomTimer);clearTimeout(this.resizeTimer);clearTimeout(this.tapTimer);
    this.observer?.disconnect();this.renderTask?.cancel();
    try{await this.loadTask?.destroy();}catch{}
    this.doc=null;this.loadTask=null;this.docGroup=null;this.section=null;this.focused=false;
    document.body.classList.remove('reading');
  }
}
