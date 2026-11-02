// Shell and small indexes are installed once. PDFs are cached one chapter at a time,
// only when opened or explicitly downloaded. The original full book is never fetched.
const SHELL='ppf-shell-v5';
const CHAPTERS='ppf-chapters-v1';
const CORE=[
  './','./index.html','./manifest.webmanifest',
  './src/css/app.css','./src/js/app.js','./src/js/icons.js','./src/js/progress.js',
  './src/js/reader.js','./src/js/search-worker.js',
  './data/book.json','./data/page-map.json','./data/search-index.json',
  './assets/cessna-hero.webp','./assets/cover.webp',
  './assets/icons/app.svg','./assets/icons/icon-192.png','./assets/icons/icon-512.png',
  './assets/icons/maskable-512.png','./assets/icons/apple-touch-icon.png',
  './vendor/pdf.mjs','./vendor/pdf.worker.mjs',
  './vendor/wasm/openjpeg.wasm','./vendor/wasm/qcms_bg.wasm','./vendor/wasm/jbig2.wasm',
  './vendor/wasm/openjpeg_nowasm_fallback.js',
  ...['FoxitDingbats.pfb','FoxitFixed.pfb','FoxitFixedBold.pfb','FoxitFixedBoldItalic.pfb',
    'FoxitFixedItalic.pfb','FoxitSerif.pfb','FoxitSerifBold.pfb','FoxitSerifBoldItalic.pfb',
    'FoxitSerifItalic.pfb','FoxitSymbol.pfb','LiberationSans-Bold.ttf','LiberationSans-BoldItalic.ttf',
    'LiberationSans-Italic.ttf','LiberationSans-Regular.ttf'].map(f=>'./vendor/standard_fonts/'+f)
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(SHELL).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ppf-shell-')&&k!==SHELL).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
async function rangeResponse(request,response){
  const header=request.headers.get('range');
  if(!header)return response;
  const match=/^bytes=(\d*)-(\d*)$/.exec(header);
  if(!match)return new Response(null,{status:416});
  const data=await response.arrayBuffer(),length=data.byteLength;
  const start=match[1]?Number(match[1]):Math.max(0,length-Number(match[2]));
  const end=match[1]?(match[2]?Math.min(Number(match[2]),length-1):length-1):length-1;
  if(start>=length||end<start)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${length}`}});
  return new Response(data.slice(start,end+1),{status:206,headers:{'Content-Type':'application/pdf',
    'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${length}`,'Content-Length':String(end-start+1)}});
}
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  if(url.pathname.endsWith('.pdf')){
    event.respondWith((async()=>{
      const cache=await caches.open(CHAPTERS),saved=await cache.match(url.href);
      if(saved)return rangeResponse(request,saved);
      try {
        const response=await fetch(request);
        if(response.ok&&response.status===200&&!request.headers.has('range')){
          event.waitUntil(cache.put(url.href,response.clone()).catch(()=>{}));
        }
        return response;
      } catch {
        return new Response('Chapter unavailable offline',{status:503,headers:{'Content-Type':'text/plain'}});
      }
    })());return;
  }
  event.respondWith((async()=>{
    const cache=await caches.open(SHELL);
    const saved=await cache.match(request,{ignoreSearch:true});
    if(saved)return saved;
    try{
      const response=await fetch(request);
      if(response.ok&&url.pathname.includes('/vendor/'))event.waitUntil(cache.put(request,response.clone()).catch(()=>{}));
      return response;
    }catch(error){
      if(request.mode==='navigate')return (await cache.match(new URL('./index.html',self.registration.scope).href))||Response.error();
      return new Response('Resource unavailable offline',{status:503,headers:{'Content-Type':'text/plain'}});
    }
  })());
});
