import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const book=read('data/book.json'),map=read('data/page-map.json'),search=read('data/search-index.json');
assert.equal(book.groups.filter(g=>g.number).length,18);
assert.equal(book.groups.reduce((n,g)=>n+g.pageCount,0),406);
assert.equal(map.pages.length,406);assert.equal(new Set(map.pages.map(p=>p.id)).size,406);
assert.deepEqual(map.pages.map(p=>p.sourcePage),Array.from({length:406},(_,i)=>i+1));
assert.equal(search.pages.length,406);
for(const g of [...book.groups,book.update]){
  assert(fs.existsSync(path.join(root,g.path)));
  assert.equal(fs.statSync(path.join(root,g.path)).size,g.bytes);
}
let core;
vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8')+'\nthis.coreAssets=CORE;',{
  self:{addEventListener(){}},get coreAssets(){return core;},set coreAssets(v){core=v;}
});
for(const asset of core){const name=asset==='./'?'index.html':asset;assert(fs.existsSync(path.join(root,name)),`Missing shell asset ${asset}`);}
const manifest=read('manifest.webmanifest');
assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');assert.equal(manifest.display,'standalone');
for(const icon of manifest.icons){
  const png=fs.readFileSync(path.join(root,icon.src));
  assert.equal(png.toString('ascii',1,4),'PNG');
  const [w,h]=icon.sizes.split('x').map(Number);assert.equal(png.readUInt32BE(16),w);assert.equal(png.readUInt32BE(20),h);
}
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.name.startsWith('.git'))continue;const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else files.push(p);}}
walk(root);
const sizes=files.map(p=>({path:path.relative(root,p),bytes:fs.statSync(p).size})).sort((a,b)=>b.bytes-a.bytes);
assert(sizes.every(x=>x.bytes<100*1024*1024));
const report={date:'2026-11-02',pages:406,chapters:18,pdfs:22,coreAssets:core.length,
  fullTextPages:search.pages.length,sourceTocEntries:book.groups.reduce((s,g)=>s+(g.contents?.length||0),0),
  manifest:'valid',missingFiles:[],filesOverGithubLimit:[],largestFile:sizes[0],totalBytes:sizes.reduce((s,x)=>s+x.bytes,0)};
fs.writeFileSync(path.join(root,'reports/project-checks.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
