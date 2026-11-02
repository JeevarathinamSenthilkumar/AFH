// Development-only tests; install Playwright locally or point PPF_PLAYWRIGHT_MODULE to it.
const {createRequire}=require('node:module');
const {resolve,join}=require('node:path');
const {mkdirSync,writeFileSync,readFileSync,createReadStream}=require('node:fs');
const {createServer}=require('node:http');
const {extname}=require('node:path');
const assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PPF_PLAYWRIGHT_MODULE||'playwright');
const root=resolve(__dirname,'..');
const base=process.env.PPF_TEST_URL||'http://127.0.0.1:4173/';
const key='pilot-path-flight.reader.v1';
const results=[],errors=[];
mkdirSync(join(root,'reports/screenshots'),{recursive:true});
const book=JSON.parse(readFileSync(join(root,'data/book.json')));
const sourceIndex=JSON.parse(readFileSync(join(root,'data/search-index.json')));
const record=(browser,name,details={})=>{results.push({browser,test:name,status:'passed',...details});console.log(browser+': '+name);};

async function suite(name,browserType,launchOptions={}){
  const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json',
    '.css':'text/css','.wasm':'application/wasm','.pdf':'application/pdf','.webmanifest':'application/manifest+json',
    '.webp':'image/webp','.svg':'image/svg+xml','.png':'image/png'};
  const server=createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=join(root,pathname.endsWith('/')?pathname+'index.html':pathname);
    res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');
    createReadStream(file).on('error',()=>{res.statusCode=404;res.end();}).pipe(res);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const port=server.address().port,base=`http://127.0.0.1:${port}/`;
  const browser=await browserType.launch({headless:true,...launchOptions});
  const context=await browser.newContext({viewport:{width:420,height:912},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await context.addInitScript(()=>Object.defineProperty(navigator,'onLine',{configurable:true,
    get:()=>sessionStorage.getItem('__ppfQaOffline')!=='1'}));
  const page=await context.newPage();
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  const requests=[];page.on('request',r=>{if(r.url().endsWith('.pdf'))requests.push(r.url());});
  const shot=label=>page.screenshot({path:join(root,'reports/screenshots',name+'-'+label+'.png')});
  const state=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
  const rendered=(group,p)=>page.locator(`#pdf-canvas[data-rendered="${group}:${p}"]`).waitFor({timeout:45000});
  const jump=async(group,p)=>{await page.goto(base+`#reader/${group}/${p}`);await rendered(group,p);};
  const next=()=>page.getByRole('button',{name:'Next page',exact:true}).click();
  const previous=()=>page.getByRole('button',{name:'Previous page',exact:true}).click();
  const back=()=>page.getByRole('link',{name:'Back to Library',exact:true}).click();
  try{
    await page.goto(base);
    await page.locator('.chapter-card').first().waitFor();
    assert.equal(await page.locator('.chapter-card').count(),18);
    const titles=await page.locator('.chapter-title').allTextContents();
    assert.deepEqual(titles,book.groups.filter(g=>g.number).map(g=>g.title));
    assert.equal(await page.getByRole('button',{name:/Start Reading/}).count(),1);
    assert.equal(requests.length,0);
    await shot('library');
    record(name,'18-chapter Library; exact official titles; no PDF prefetch');

    await page.locator('[data-group="chapter-01"]').click();
    await page.locator('.detail-hero').waitFor();
    assert.equal(await page.locator('.contents-row').count(),book.groups[1].contents.length);
    await shot('chapter');
    await page.getByRole('button',{name:'Open Chapter',exact:true}).click();
    await rendered('chapter-01',1);
    assert.equal(await page.locator('.chapter-list').count(),0);
    assert.equal(await page.locator('#reader-page-label').innerText(),'1-1');
    assert.equal(await page.locator('canvas').count(),1);
    const canvas=await page.locator('canvas').evaluate(c=>({w:c.width,h:c.height,ink:[...c.getContext('2d').getImageData(0,0,c.width,c.height).data].filter((v,i)=>i%4!==3&&v<180).length}));
    assert(canvas.w*canvas.h<=7_020_000&&canvas.ink>10000);
    await shot('reader');
    record(name,'Chapter overview, contents, Open Chapter and original PDF rendering',canvas);

    // A very brief appearance followed by Next must not complete a page.
    await next();await rendered('chapter-01',2);
    assert.equal((await state()).pages['afh-3c-2021-p0022'],undefined);
    await previous();await rendered('chapter-01',1);
    await page.waitForTimeout(2150);await next();await rendered('chapter-01',2);
    assert.equal((await state()).pages['afh-3c-2021-p0022'].auto,true);
    record(name,'Automatic completion after deliberate forward navigation; brief appearances ignored');

    await previous();await rendered('chapter-01',1);
    await page.getByRole('button',{name:/Page completed. Change status/}).click();
    await page.getByRole('button',{name:'Incomplete',exact:true}).click();
    await page.waitForTimeout(2150);await next();await rendered('chapter-01',2);
    assert.equal((await state()).pages['afh-3c-2021-p0022'].manual,false);
    await page.locator('[data-reader="status"]').click();
    await page.getByRole('button',{name:'Completed',exact:true}).click();
    assert.equal((await state()).pages['afh-3c-2021-p0023'].manual,true);
    await page.reload();await rendered('chapter-01',2);
    assert.equal((await state()).pages['afh-3c-2021-p0022'].manual,false);
    assert.equal((await state()).pages['afh-3c-2021-p0023'].manual,true);
    record(name,'Manual incomplete override, manual complete override, refresh persistence');

    await page.getByRole('button',{name:'Choose page',exact:true}).click();
    await page.locator('#jump-page').fill('10');
    await page.locator('#page-jump button').click();await rendered('chapter-01',10);
    const afterJump=await state();
    assert.equal(Object.keys(afterJump.pages).length,2);
    assert.equal(afterJump.last.page,10);
    record(name,'Page chooser jumps directly without completing earlier pages');

    await page.getByRole('button',{name:'Zoom in',exact:true}).click();
    await page.waitForTimeout(400);
    assert.equal(await page.locator('#zoom-label').innerText(),'150%');
    await page.getByRole('button',{name:'Reset zoom',exact:true}).click();
    // Two touch-pointer streams exercise the pinch and pan handlers in both engines.
    const touchResult=await page.locator('.reader-stage').evaluate(stage=>{
      const r=stage.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
      const fire=(type,id,px,py)=>stage.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:px,clientY:py,bubbles:true}));
      // setPointerCapture requires real active browser pointers. Stub only capture for synthetic events.
      const old=stage.setPointerCapture;stage.setPointerCapture=()=>{};
      fire('pointerdown',11,x-30,y);fire('pointerdown',12,x+30,y);
      fire('pointermove',11,x-70,y);fire('pointermove',12,x+70,y);
      fire('pointerup',11,x-70,y);fire('pointerup',12,x+70,y);
      const pinched=stage.querySelector('.page-wrap').style.transform;
      fire('pointerdown',13,x,y);fire('pointermove',13,x+35,y+20);fire('pointerup',13,x+35,y+20);
      const panned=stage.querySelector('.page-wrap').style.transform;stage.setPointerCapture=old;
      return{pinched,panned};
    });
    assert(!touchResult.pinched.includes('scale(1)'));
    assert.notEqual(touchResult.pinched,touchResult.panned);
    await page.getByRole('button',{name:'Reset zoom',exact:true}).click();
    await page.getByRole('button',{name:'Hide reader controls',exact:true}).click();
    assert(await page.locator('.reader.focus').isVisible());
    assert.equal(await page.locator('.reader-top').isVisible(),false);
    await page.waitForTimeout(250);await shot('focus');
    await page.locator('.reader-stage').tap({position:{x:30,y:30}});
    await page.locator('.reader:not(.focus)').waitFor();
    record(name,'Zoom controls, synthetic pinch/pan handlers, focus mode and tap to restore');

    await back();await page.locator('.chapter-card').first().waitFor();
    assert.match(await page.locator('.progress-count').innerText(),/^1 of 406 pages/);
    assert.match(await page.locator('[data-group="chapter-01"] .chapter-status').innerText(),/6%/);
    await page.getByRole('button',{name:/Continue Reading/}).click();await rendered('chapter-01',10);
    await back();await page.locator('[data-group="chapter-01"]').click();
    await page.getByRole('button',{name:/Resume Reading/}).click();await rendered('chapter-01',10);
    record(name,'Accurate chapter/overall progress, Continue Reading and Resume Reading');

    await back();await page.getByRole('button',{name:'Search handbook',exact:true}).click();
    await page.getByRole('searchbox',{name:'Search handbook text'}).fill('crosswind');
    await page.locator('.search-result').first().waitFor({timeout:20000});
    const first=page.locator('.search-result').first();
    const gid=await first.getAttribute('data-open'),p=Number(await first.getAttribute('data-page'));
    assert(p>1);
    const real=sourceIndex.pages.find(x=>x.groupId===gid&&x.page===p);
    assert.match(real.text.toLowerCase(),/crosswind/);
    await shot('search');await first.click();await rendered(gid,p);
    assert.equal(await page.locator('#reader-page-label').innerText(),label(gid,p));
    record(name,'Full-text crosswind search grounded in source; result opens precise original page',{group:gid,page:p});

    await back();await page.getByRole('button',{name:'Search handbook',exact:true}).click();
    await page.getByRole('searchbox').fill('Energy Management');
    await page.locator('.search-result[data-open="chapter-04"]').first().waitFor();
    await page.getByRole('searchbox').fill('notawordinthishandbookzzzz');
    await page.getByText('No matches',{exact:true}).waitFor();
    record(name,'Chapter-title search and no-results state');

    await page.goto(base+'#library');await page.locator('.chapter-card').first().waitFor();
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.reload();await page.locator('.chapter-card').first().waitFor();
    await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
    await page.locator('[data-group="chapter-08"]').click();
    await page.getByRole('button',{name:'Download for offline',exact:true}).click();
    await page.getByRole('button',{name:'Available offline. Remove download',exact:true}).waitFor({timeout:45000});
    const pdfCount=await page.evaluate(async()=>{const c=await caches.open('ppf-chapters-v1');return(await c.keys()).length;});
    assert(pdfCount<22);
    await page.evaluate(()=>{sessionStorage.setItem('__ppfQaOffline','1');dispatchEvent(new Event('offline'));});
    server.closeAllConnections();await new Promise(r=>server.close(r));
    await page.goto(base+'#library');await page.reload();await page.locator('.chapter-card').first().waitFor();
    await page.getByText('Offline',{exact:true}).waitFor();
    await page.locator('[data-group="chapter-08"]').click();await page.getByRole('button',{name:'Open Chapter',exact:true}).click();await rendered('chapter-08',1);
    await shot('offline-reader');
    await back();await page.getByRole('button',{name:'Search handbook',exact:true}).click();
    await page.getByRole('searchbox').fill('crosswind');await page.locator('.search-result').first().waitFor();
    record(name,'Offline shell reload, explicit chapter download, offline PDF and search with test server stopped',{cachedPdfs:pdfCount});
    await page.goto(base+'#reader/chapter-18/1');
    await page.locator('.reader-error:not([hidden])').waitFor({timeout:20000});
    assert.match(await page.locator('.reader-error').innerText(),/not available offline/);
    await new Promise(r=>server.listen(port,'127.0.0.1',r));
    await page.evaluate(()=>{sessionStorage.removeItem('__ppfQaOffline');dispatchEvent(new Event('online'));});
    record(name,'Uncached chapter gives a useful offline error');

    await page.goto(base+'#library');await page.locator('.chapter-card').first().waitFor();
    await page.locator('[data-group="faa-addendum"]').click();await page.getByRole('button',{name:'Open Addendum',exact:true}).click();await rendered('faa-addendum',1);
    assert.equal(await page.locator('[data-reader="status"]').isEnabled(),false);
    await shot('addendum');record(name,'Separate four-page FAA addendum; excluded from book progress');

    for(const [width,height]of [[360,780],[420,912],[440,956],[912,420]]){
      await page.setViewportSize({width,height});await page.goto(base+'#library');await page.locator('.chapter-card').first().waitFor();
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false);
      if(width===360||width===440)await shot('library-'+width);
      await jump('chapter-04',1);await page.waitForTimeout(250);
      const boxes=await page.locator('.reader-stage').evaluate(stage=>{
        const s=stage.getBoundingClientRect(),p=stage.querySelector('.page-wrap').getBoundingClientRect();
        return{stage:{left:s.left,right:s.right,top:s.top,bottom:s.bottom},page:{left:p.left,right:p.right,top:p.top,bottom:p.bottom}};
      });
      assert(boxes.page.left>=boxes.stage.left-1&&boxes.page.right<=boxes.stage.right+1);
      assert(boxes.page.top>=boxes.stage.top-1&&boxes.page.bottom<=boxes.stage.bottom+1);
      if(width===912)await shot('landscape');
    }
    await page.setViewportSize({width:420,height:912});
    await page.addStyleTag({content:':root{--safe-top:59px;--safe-bottom:34px}'});
    const safe=await page.locator('.reader').evaluate(el=>({top:parseFloat(getComputedStyle(el.querySelector('.reader-top')).paddingTop),bottom:parseFloat(getComputedStyle(el.querySelector('.reader-bottom')).paddingBottom)}));
    assert(safe.top>=59&&safe.bottom>=34);await shot('safe-areas');
    record(name,'360 / 420 / 440px portrait, landscape, full-page fit and simulated safe-area padding');
    assert.deepEqual(pageErrors,[]);
    record(name,'No uncaught JavaScript errors');
  }catch(error){
    errors.push({browser:name,message:error.stack});console.error(name,error);
    await shot('failure').catch(()=>{});
  }finally{await context.close();await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
}
function label(gid,p){const g=book.groups.find(g=>g.id===gid);return g.number?`${g.number}-${p}`:gid==='glossary'?`G-${p}`:gid==='index'?`Index-${p}`:String(p);}
(async()=>{
  await suite('webkit',webkit);
  await suite('chrome',chromium,{channel:'chrome'});
  const report={date:'2026-11-02',base,results,errors,limitations:[
    'WebKit automation is not a physical iPhone Air or an iOS Simulator.',
    'Pinch and pan handlers used synthetic touch pointer events; physical multi-touch remains untested.',
    'Safe-area padding was simulated with 59px top and 34px bottom; actual Dynamic Island and Home indicator behavior needs device confirmation.',
    'Home Screen installation requires HTTPS hosting and manual iPhone Safari confirmation; not claimed tested.',
    'Offline tests stopped the isolated HTTP server and simulated the browser offline indicator. Playwright context.setOffline fails inside WebKit before service-worker interception, so that emulation mode was not used.',
  ]};
  writeFileSync(join(root,'reports/browser-tests.json'),JSON.stringify(report,null,2)+'\n');
  if(errors.length)process.exitCode=1;
  console.log(`${results.length} checks passed; ${errors.length} failures`);
})();
