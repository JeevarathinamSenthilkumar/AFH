"""Validate page coverage, source text identity, manifests, relative links, IDs and assets."""
import sys,json,hashlib,re,argparse
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('project');p.add_argument('--source');p.add_argument('--source-only',action='store_true');p.add_argument('--report');a=p.parse_args();root=Path(a.project)
def read(p):return json.loads((root/p).read_text())
issues=[];checks=[]
def require(ok,label):
 (checks if ok else issues).append(label)
cat=read('data/chapters.json');man=read('data/content-manifest.json');fig=read('data/figures-manifest.json');tables=read('data/tables-manifest.json');originals=read('data/original-images-manifest.json');groups=cat['chapters']+cat['references']
require(len(cat['chapters'])==18,'18 chapters');require(len(man['pages'])==406,'406 source pages');require(sorted(p['pdfPage'] for p in man['pages'])==list(range(1,407)),'Every source page covered exactly once')
ids=[];allpages={};assets=set()
for g in groups:
 lessons=read(g['path'])['lessons'];require(len(lessons)==g['lessonCount'],g['id']+' lesson count')
 for l in lessons:
  ids.append(l['id']);allpages[l['pdfPage']]=l;assets.add(l['pageImage'])
  require(hashlib.sha256(l['rawText'].encode()).hexdigest()==man['pages'][l['pdfPage']-1]['textSha256'],'Text hash '+l['id'])
  for b in l['blocks']:
   if b.get('asset'):assets.add(b['asset'])
 for path in g['offlineAssets']:assets.add(path)
require(len(set(ids))==len(ids),'Stable unique lesson identifiers')
for row in fig+tables:
 assets.add(row['asset']);require(row['pdfPage'] in allpages,'Asset source page '+row['id']);require(bool(row['caption']),'Caption '+row['id'])
for image in originals:
 assets.add(image['asset']);require(hashlib.sha256((root/image['asset']).read_bytes()).hexdigest()==image['sha256'],'Original embedded image hash '+image['id'])
require(len(originals)==283,'All 283 embedded image appearances preserved')
for path in assets:require((root/path).is_file() and (root/path).stat().st_size>0,'Asset exists '+path)
if a.source:
 try:
  import pymupdf as fitz
 except ImportError:
  candidate=Path(__file__).resolve().parents[1]/'.tools/python';sys.path.insert(0,str(candidate));import pymupdf as fitz
 doc=fitz.open(a.source)
 require(hashlib.sha256(Path(a.source).read_bytes()).hexdigest()==man['sourceSha256'],'Original PDF SHA-256 unchanged')
 for i,page in enumerate(doc):require(page.get_text(sort=True)==allpages[i+1]['rawText'],f'Full raw text equality PDF page {i+1}')
 # Numbered captions can be independently recounted from line starts.
 found=[]
 for i,page in enumerate(doc):
  for b in page.get_text('dict',flags=fitz.TEXTFLAGS_DICT & ~fitz.TEXT_PRESERVE_IMAGES)['blocks']:
   if b['type']!=0:continue
   for l in b['lines']:
    tx=''.join(s['text'] for s in l['spans'] if s['size']>=4).strip();m=re.match(r'^Figure\s+(\d+[-–]\d+(?:\s?[A-Z](?:[-–][A-Z])?)?)\s*[.:]',tx)
    if m:found.append((i+1,m[1].replace('–','-')))
 listed=[(x['pdfPage'],x['number']) for x in fig if x.get('number')]
 require(sorted(found)==sorted(listed),'All independently detected numbered figure captions inventoried')
for path in ([] if a.source_only else ['index.html','manifest.webmanifest','sw.js','src/js/app.js','src/css/app.css','README.md','docs/github-deployment.md']):
 require((root/path).is_file(),'Application file '+path)
if (root/'src/js/app.js').exists():
 require('/Users/' not in (root/'src/js/app.js').read_text(),'No machine-specific paths in deployed JavaScript')
result=dict(passed=len(checks),failed=len(issues),issues=issues,checks=checks,sourcePages=len(allpages),lessons=len(ids),figures=len(fig),numberedFigures=len([x for x in fig if x.get('number')]),tableRegions=len(tables),originalImageAppearances=len(originals),assets=len(assets),status='Automated checks passed' if not issues else 'Failures remain',manualReviewStatus='Pending; these checks do not establish complete educational or visual verification')
print(json.dumps({k:v for k,v in result.items() if k!='checks'},indent=2));
report=Path(a.report) if a.report else root/'reports/automated-validation.json'
try:report.write_text(json.dumps(result,indent=2))
except PermissionError:print('Report not written: destination permission required',file=sys.stderr)
sys.exit(1 if issues else 0)
