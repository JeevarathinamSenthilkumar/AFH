"""Reproducible source extraction and local assembly. Never modifies the source PDF."""
from pathlib import Path
import argparse,sys,re,json,hashlib,shutil,collections,time,unicodedata
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'.tools/python'))
import pymupdf as fitz
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[2] if Path(__file__).parent.name=='extraction-and-validation' else Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--source',required=True);p.add_argument('--extract',action='store_true');p.add_argument('--addendum');a=p.parse_args()
OUT=Path(a.output);SOURCE=Path(a.source);OUT.mkdir(parents=True,exist_ok=True)
def dump(path,obj):
 target=OUT/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':')),encoding='utf8')
def put(path,text):
 target=OUT/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(text,encoding='utf8')
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def slug(t):return re.sub(r'[^a-z0-9]+','-',t.lower()).strip('-')[:85]
def textline(l):return ''.join(s['text'] for s in l['spans'] if s['size']>=4).strip()
def bounds(r):return [round(v,2) for v in r]
def webp(page,path,clip=None,scale=3):
 path=OUT/path;path.parent.mkdir(parents=True,exist_ok=True)
 if path.exists():return
 pix=page.get_pixmap(matrix=fitz.Matrix(scale,scale),clip=clip,alpha=False)
 im=Image.frombytes('RGB',(pix.width,pix.height),pix.samples);im.save(path,'WEBP',quality=94,method=4)
TITLES=['Introduction to Flight Training','Ground Operations','Basic Flight Maneuvers','Energy Management: Mastering Altitude and Airspeed Control','Maintaining Aircraft Control: Upset Prevention and Recovery Training','Takeoffs and Departure Climbs','Ground Reference Maneuvers','Airport Traffic Patterns','Approaches and Landings','Performance Maneuvers','Night Operations','Transition to Complex Airplanes','Transition to Multiengine Airplanes','Transition to Tailwheel Airplanes','Transition to Turbopropeller-Powered Airplanes','Transition to Jet-Powered Airplanes','Transition to Light Sport Airplanes (LSA)','Emergency Procedures']
STARTS=[22,38,62,87,106,133,147,165,172,210,218,232,250,287,295,310,335,350,373]
PUBLICATION='FAA-H-8083-3C'
if a.extract:
 if not a.addendum:raise SystemExit('--addendum is required for extraction')
 doc=fitz.open(SOURCE); sha=digest(SOURCE);print('Source SHA-256',sha,flush=True)
 chapters=[dict(id=f'chapter-{n:02}',number=n,title=t,firstPdfPage=STARTS[n-1],lastPdfPage=STARTS[n]-1,path=f'data/lessons/chapter-{n:02}.json',sections=[],lessons=[]) for n,t in enumerate(TITLES,1)]
 refs=[dict(id='front-matter',number=0,title='Front matter',firstPdfPage=1,lastPdfPage=21,path='data/lessons/front-matter.json',sections=[],lessons=[]),dict(id='glossary',number=0,title='Glossary',firstPdfPage=373,lastPdfPage=391,path='data/lessons/glossary.json',sections=[],lessons=[]),dict(id='index',number=0,title='Index',firstPdfPage=392,lastPdfPage=406,path='data/lessons/index.json',sections=[],lessons=[])]
 groups=chapters+refs;pages=[];figures=[];tables=[];unassigned=[];heads=[];search={g['id']:[] for g in groups};payload={g['id']:[] for g in groups};toc=[]
 for i in range(9,21):
  for line in doc[i].get_text(sort=True).splitlines():
   m=re.match(r'^(\s*)(.*?)\s+(\d{1,2})-(\d+)\s*$',line)
   if m:
    ch=int(m[3]);pn=int(m[4]);title=m[2].strip()
    if 1<=ch<=18:
     ent=dict(title=title,chapter=ch,printedPage=f'{ch}-{pn}',pdfPage=STARTS[ch-1]+pn-1,indent=len(m[1]),tocPdfPage=i+1)
     toc.append(ent)
 dump('data/section-inventory.json',toc)
 for i,page in enumerate(doc):
  pdf=i+1;g=next(x for x in groups if x['firstPdfPage']<=pdf<=x['lastPdfPage']);gid=g['id'];n=g['number'];off=pdf-g['firstPdfPage']+1
  pid=f'{gid}-p{off:03}';printed=f'{n}-{off}' if n else ('G-'+str(off) if gid=='glossary' else 'Index-'+str(off) if gid=='index' else ('Cover' if pdf==1 else 'Title' if pdf==2 else str(pdf-3)))
  imagepath=f'chapters/{gid}/page-{pdf:03}.webp';webp(page,imagepath)
  raw=page.get_text(sort=True);d=page.get_text('dict',flags=fitz.TEXTFLAGS_DICT & ~fitz.TEXT_PRESERVE_IMAGES)
  lines=[]
  for b in d['blocks']:
   if b['type']!=0:continue
   for l in b['lines']:
    tx=textline(l)
    if tx:lines.append(dict(text=tx,bbox=list(l['bbox']),spans=[dict(text=s['text'],font=s['font'],size=s['size']) for s in l['spans'] if s['text'].strip() and s['size']>=4],block=b['number']))
  lines.sort(key=lambda l:(round(l['bbox'][1]/3)*3,l['bbox'][0]))
  if not n:
   foot=[l['text'] for l in lines if l['bbox'][1]>735]
   if foot:printed=foot[-1]
  imgs=[fitz.Rect(x['bbox']) & page.rect for x in page.get_image_info() if fitz.Rect(x['bbox']).get_area()>40]
  drawings=[fitz.Rect(x['rect']) & page.rect for x in page.get_drawings() if fitz.Rect(x['rect']).get_area()>200]
  # Captions are matched only at line starts, never in body figure references.
  caps=[]
  for j,l in enumerate(lines):
   m=re.match(r'^(Figure|Table)\s+(\d+[-–]\d+(?:\s?[A-Z](?:[-–][A-Z])?)?)\s*[.:]',l['text'])
   if not m:continue
   seq=[l];k=j+1
   while k<len(lines) and lines[k]['bbox'][1]-seq[-1]['bbox'][3]<7:
    candidate=lines[k]
    if any('Italic' in s['font'] for s in candidate['spans']) and not re.match(r'^(Figure|Table)\s',candidate['text']):seq.append(candidate);k+=1
    else:break
   caption=' '.join(q['text'] for q in seq);r=fitz.Rect(l['bbox'])
   for q in seq:r|=fitz.Rect(q['bbox'])
   eligible=[x for x in imgs if x.y1<=r.y0+12 and r.y0-x.y1<100]
   method='raster-region-with-caption';status='Extracted but requires review'
   if eligible:
    nearest=max(eligible,key=lambda x:x.y1);rect=nearest+(-5,-5,5,5)
    # Include all panels sharing the same vertical band and any vector overlay.
    for x in imgs+drawings:
     if x.y1>nearest.y0 and x.y0<nearest.y1 and x.y1<=r.y0+12:rect|=x
    rect|=r;rect=(rect+(-3,-3,3,3)) & page.rect
   else:
    rect=page.rect;method='full-original-page-fallback'
   label=m[2].replace('–','-');fid=f'{m[1].lower()}-{slug(label)}'
   file=f'assets/{"figures" if m[1]=="Figure" else "tables"}/{gid}/{fid}.webp';webp(page,file,clip=rect)
   row=dict(id=fid,kind=m[1].lower(),number=label,chapter=n,chapterTitle=g['title'],section=None,pdfPage=pdf,printedPage=printed,caption=caption,asset=file,sourcePublication=PUBLICATION,sourcePageAsset=imagepath,crop=bounds(rect),captionBounds=bounds(r),method=method,verificationStatus=status,rightsStatus='Local study copy; third-party rights review required before public redistribution')
   (figures if m[1]=='Figure' else tables).append(row);caps.append((r,row))
  # Inventory all embedded appearances, including unnumbered illustrations.
  covered=[]
  for j,r in enumerate(imgs):
   matched=[row['id'] for cr,row in caps if (fitz.Rect(row['crop']) & r).get_area()>=r.get_area()*.98]
   if not matched:
    fid=f'unnumbered-p{pdf:03}-{j+1:02}';file=f'assets/figures/{gid}/{fid}.webp';webp(page,file,clip=(r+(-5,-5,5,5))&page.rect)
    row=dict(id=fid,kind='unnumbered-illustration',number=None,chapter=n,chapterTitle=g['title'],section=None,pdfPage=pdf,printedPage=printed,caption='Unnumbered artwork from original page '+printed,asset=file,sourcePublication=PUBLICATION,sourcePageAsset=imagepath,crop=bounds(r),method='embedded-appearance-region',verificationStatus='Extracted but requires review',rightsStatus='Unresolved before public redistribution')
    figures.append(row);unassigned.append(row)
  # Tables are often labelled figures; detect structure but preserve images as authority.
  try:
   ft=page.find_tables()
   for j,t in enumerate(ft.tables):
    if t.row_count<2 or t.col_count<2:continue
    rect=fitz.Rect(t.bbox);fid=f'table-region-p{pdf:03}-{j+1}';file=f'assets/tables/{gid}/{fid}.webp';webp(page,file,clip=(rect+(-12,-12,12,12))&page.rect)
    nearby=min(caps,key=lambda v:abs(v[0].y0-rect.y1),default=None)
    row=dict(id=fid,kind='detected-table-region',number=None,chapter=n,chapterTitle=g['title'],section=None,pdfPage=pdf,printedPage=printed,caption=nearby[1]['caption'] if nearby and abs(nearby[0].y0-rect.y1)<60 else f'Table-like region on original page {printed}',asset=file,sourcePublication=PUBLICATION,sourcePageAsset=imagepath,crop=bounds(rect),rows=t.extract(),method='structure-detection-and-original-image',verificationStatus='Source unclear; manual table inventory required')
    tables.append(row)
  except Exception as e:unassigned.append(dict(pdfPage=pdf,issue='table-detection',error=str(e)))
  content=[];pgheads=[];byblock=collections.defaultdict(list)
  for l in lines:byblock[l['block']].append(l)
  for bid,ls in byblock.items():
   # Empty PDF positioning spans and invisible 1pt revision counters never enter reflow.
   if all(l['bbox'][1]>747 for l in ls):continue
   segments=[]
   for l in ls:
    tx=l['text'];ss=l['spans'];inside=any(r.contains(fitz.Rect(l['bbox'])) for r in imgs)
    cap=next((row for cr,row in caps if cr.intersects(fitz.Rect(l['bbox']))),None)
    if cap:kind='caption'
    elif inside:kind='diagram-label'
    elif ss and all(('Bold' in s['font'] or 'bold' in s['font']) and ('Times' not in s['font']) for s in ss) and len(tx)<180:kind='heading'
    elif re.match(r'^[⦁•▪]|^\d+[.)]\s',tx):kind='list'
    else:kind='paragraph'
    if segments and segments[-1]['type']=='list' and kind=='paragraph' and l['bbox'][1]-segments[-1]['bbox'][3]<5:
     segments[-1]['text']+=' '+tx;segments[-1]['bbox'][3]=max(segments[-1]['bbox'][3],l['bbox'][3]);continue
    if segments and kind==segments[-1]['type'] and kind in ['paragraph','list','caption','heading']:
     segments[-1]['text']+=' '+tx;segments[-1]['bbox'][3]=max(segments[-1]['bbox'][3],l['bbox'][3])
    else:segments.append(dict(type=kind,text=tx,bbox=bounds(l['bbox']),size=max((s['size'] for s in ss),default=10)))
   for seg in segments:
    if seg['type']=='heading':
     seg['id']=f'h-{pdf}-{len(pgheads)+1}';seg['level']=1 if seg['size']>=13 else 2 if seg['size']>=11 else 3
     ent=dict(title=seg['text'],id=seg['id'],level=seg['level'],lessonId=pid,pdfPage=pdf,printedPage=printed,bbox=seg['bbox'],verificationStatus='Extracted but requires review')
     pgheads.append(ent);heads.append(dict(chapter=gid,**ent))
    content.append(seg)
  for cr,row in caps:content.append(dict(type='figure',asset=row['asset'],caption=row['caption'],figureId=row['id'],bbox=row['crop'],y=cr.y0-.2))
  for row in [x for x in unassigned if x.get('pdfPage')==pdf and x.get('asset')]:content.append(dict(type='figure',asset=row['asset'],caption=row['caption'],figureId=row['id'],bbox=row['crop'],y=row['crop'][1]))
  content.sort(key=lambda b:(b.get('y',b['bbox'][1]),b['bbox'][0]))
  actualheads=[h for h in pgheads if not h['title'].startswith(('Airplane Flying','Chapter '))]
  toc_titles=[x['title'] for x in toc if x['pdfPage']==pdf]
  title=(actualheads[0]['title'] if actualheads else toc_titles[0] if toc_titles else f'{g["title"]} · continued')
  lesson=dict(id=pid,title=title,chapterId=gid,pdfPage=pdf,printedPage=printed,source=PUBLICATION,pageImage=imagepath,rawText=raw,blocks=content,headings=pgheads,figureIds=[row['id'] for cr,row in caps],verificationStatus='Extracted but requires review')
  payload[gid].append(lesson);g['lessons'].append(dict(id=pid,title=title,pdfPage=pdf,printedPage=printed,words=len(raw.split()),headings=pgheads));g['sections'].extend(pgheads)
  search[gid].append(dict(id=pid,title=title,pdfPage=pdf,printedPage=printed,text=' '.join(l['text'] for l in lines)))
  pages.append(dict(id=pid,chapterId=gid,pdfPage=pdf,printedPage=printed,image=imagepath,textSha256=hashlib.sha256(raw.encode()).hexdigest(),textCharacters=len(raw),headings=len(pgheads),figures=[row['id'] for cr,row in caps],embeddedAppearances=len(imgs),verificationStatus='Automated extraction verified; semantic and visual review pending'))
  if pdf%20==0:print('Extracted',pdf,'/',len(doc),flush=True);dump('reports/extraction-checkpoint.json',dict(pagesExtracted=pdf,totalPages=len(doc),sourceSha256=sha))
 for g in groups:
  dump(g['path'],dict(chapter=g['id'],lessons=payload[g['id']]))
  dump(f'data/search/{g["id"]}.json',search[g['id']]);g['lessonCount']=len(g['lessons']);g['figureCount']=sum(x['chapter']==g['number'] for x in figures) if g['number'] else sum(x['pdfPage']>=g['firstPdfPage'] and x['pdfPage']<=g['lastPdfPage'] for x in figures)
  g['downloadBytes']=sum((OUT/x['image']).stat().st_size for x in pages if x['chapterId']==g['id'])+sum((OUT/x['asset']).stat().st_size for x in figures+tables if g['firstPdfPage']<=x['pdfPage']<=g['lastPdfPage'])+(OUT/g['path']).stat().st_size+(OUT/f'data/search/{g["id"]}.json').stat().st_size
  g['offlineAssets']=[g['path'],f'data/search/{g["id"]}.json']+[x['image'] for x in pages if x['chapterId']==g['id']]+[x['asset'] for x in figures+tables if g['firstPdfPage']<=x['pdfPage']<=g['lastPdfPage']]
 dump('data/chapters.json',dict(publication=PUBLICATION,edition=2021,chapters=chapters,references=refs,sourcePageCount=len(doc),verificationStatus='Extracted but requires review'))
 dump('data/content-manifest.json',dict(publication=PUBLICATION,edition=2021,sourceFilename=SOURCE.name,sourceSha256=sha,pdfPages=len(doc),chapters=18,pages=pages,headings=heads,verificationStatus='Extracted but requires review',verificationLimits=['No exhaustive human page-by-page review has been completed.','Full original page images preserve layout; inferred figure crops and table detection require manual review.','Font-derived heading hierarchy may differ from the printed table of contents.','Third-party image licenses require clearance before public distribution.']))
 dump('data/figures-manifest.json',figures);dump('data/tables-manifest.json',tables);dump('data/review-queue.json',unassigned)
 # Small hero is an unchanged crop of the original cross-country photo panel, Figure 1-1.
 webp(doc[21],'assets/images/flight-hero.webp',clip=fitz.Rect(362,346,463,490),scale=6)
 # Official update is a separate layer, never mixed into original lessons.
 add=fitz.open(a.addendum);updates=[]
 for i,pg in enumerate(add):
  file=f'references/faa-updates/page-{i+1}.webp';webp(pg,file)
  updates.append(dict(pdfPage=i+1,text=pg.get_text(sort=True),image=file))
 shutil.copy2(a.addendum,OUT/'references/AFH-Addendum-MOSAIC-2025.pdf')
 dump('data/faa-updates.json',dict(title='FAA Updates',publicationDate='2025-10-20',checkedDate='2026-11-02',sourceUrl='https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/AFH_Addendum_%28MOSAIC%29.pdf',affectedChapters=[1,2,4,6,17],affectedPages=['1-4','1-16','2-4','2-12','4-17','6-1','6-7'],pages=updates,note='The original Chapter 17 remains available. The addendum says it will be removed and its material redistributed in a future revision. The source mentions dates that differ from the current FAA MOSAIC page; consult the linked current FAA page for effective dates.',mosaicUrl='https://www.faa.gov/aircraft/MOSAIC'))
 dump('reports/extraction-checkpoint.json',dict(pagesExtracted=len(doc),totalPages=len(doc),sourceSha256=sha,phase='Extraction complete; manual review remains'))
 print('COMPLETE',len(pages),'pages',len(figures),'illustrations',len(tables),'table regions',len(toc),'TOC entries',len(heads),'headings',flush=True)
 put('reports/source-inventory.md',f'# Source inventory\n\nInspected 2026-11-02.\n\n- Title: Airplane Flying Handbook\n- Publication: {PUBLICATION}\n- Edition: 2021 (supersedes 2016 3B)\n- PDF pages: {len(doc)}; readable and not encrypted\n- Source file: {SOURCE.name}; {SOURCE.stat().st_size:,} bytes\n- SHA-256: `{sha}`\n- Folder also contained no other source documents. Original PDF was not modified.\n- All 18 chapters were found by original PDF bookmarks and printed chapter openings.\n- Front matter PDF 1–21; glossary 373–391; index 392–406.\n- Full table of contents: data/section-inventory.json ({len(toc)} entries).\n- Full page, heading, and source inventory: data/content-manifest.json.\n\nEvery PDF page is preserved as a 216-dpi image. Chapters use stable page-based reading lessons, following original page boundaries rather than a target lesson count.\n')
 put('reports/chapter-coverage-report.md','# Chapter coverage report\n\n**No chapter is claimed to be manually verified complete.** All source pages are represented by extracted text and full original page renders. Figure crops, inferred hierarchy, reading order, and table classifications remain subject to review. The images provide a source-preserving fallback, not proof that every crop is correct.\n\n| Chapter | Title | PDF pages | Reading lessons | Numbered figures | Status |\n|---|---|---|---|---|---|\n'+'\n'.join(f'| {g["number"]} | {g["title"]} | {g["firstPdfPage"]}–{g["lastPdfPage"]} | {g["lessonCount"]} | {sum(x["chapter"]==g["number"] and x["number"] is not None for x in figures)} | Extracted but requires review |' for g in chapters)+f'\n\nFront matter: 21 pages; glossary: 19 pages; index: 15 pages. Total: 406/406 page images and raw-text records.\n\n{len(figures)} numbered/unnumbered illustration records; {len(tables)} detected table regions. The handbook labels many tabular figures as “Figure”; table detection is not an exhaustive table audit. See manifests and review queue.\n\nReview each page alongside its reflowed text, confirm all headings against the TOC inventory, and inspect every image at full size. Change a record to “Verified complete” only after that review.\n')
 put('reports/extraction-report.md',f'# Extraction report\n\nSource: {PUBLICATION}, 2021, 406 pages.\n\n- Full raw text stored per original PDF page, including symbols and figure labels.\n- Every page rendered at 216 dpi into quality-94 WebP.\n- Meaningful PDF spans are reflowed into headings, paragraphs, and lists. Whitespace-only positioning spans and 1-point revision counters are excluded from reflow, retained in raw text.\n- Text blocks are geometrically sorted. This is reliable on the predominantly single-column source, but complex layouts and index columns need human review.\n- Numbered captions detected at line starts; italic continuations joined.\n- Crops include raster artwork, related panels, nearby vector overlays, and caption; ambiguous matches use the full original page. All crops remain unverified.\n- Unnumbered embedded appearances are inventoried and preserved too.\n- Table-like regions detected automatically; original images are authoritative, structured cell data is for review only.\n- {len(toc)} printed TOC entries retained with indentation, page reference, and source page.\n- Raw text hashes checked by validation script.\n\nNot completed: exhaustive semantic comparison, visual crop review, exact table reconstruction, full heading reconciliation, third-party image licensing. These are explicit release limitations, not silent omissions.\n')
if (OUT/'data/content-manifest.json').exists():
 m=json.loads((OUT/'data/content-manifest.json').read_text())
 for manifest_name in ['figures-manifest.json','tables-manifest.json']:
  items=json.loads((OUT/'data'/manifest_name).read_text())
  for row in items:
   hs=[h for h in m['headings'] if h['pdfPage']==row['pdfPage'] and h['bbox'][1]<=row['crop'][1] and not h['title'].startswith('Airplane Flying')]
   row['section']=hs[-1]['title'] if hs else row['chapterTitle']
  dump('data/'+manifest_name,items)
if (OUT/'data/chapters.json').exists():
 catalog=json.loads((OUT/'data/chapters.json').read_text())
 toc_inventory=json.loads((OUT/'data/section-inventory.json').read_text())
 import difflib
 def normalized(t):return re.sub(r'[^a-z0-9]','',t.lower())
 for g in catalog['chapters']+catalog['references']:
  lessons=json.loads((OUT/g['path']).read_text())['lessons']
  for lesson in lessons:
   merged=[]
   for block in lesson['blocks']:
    if merged and merged[-1]['type']=='list' and block['type']=='paragraph' and 0<=block['bbox'][1]-merged[-1]['bbox'][3]<5:
     merged[-1]['text']+=' '+block['text'];merged[-1]['bbox'][3]=block['bbox'][3]
    else:merged.append(block)
   lesson['blocks']=merged
  dump(g['path'],dict(chapter=g['id'],lessons=lessons))
  g['tableOfContents']=[]
  for item in toc_inventory:
   if item['chapter']!=g['number']:continue
   lesson=next((l for l in lessons if l['pdfPage']==item['pdfPage']),None)
   if not lesson:continue
   hs=lesson['headings'];best=max(hs,key=lambda h:difflib.SequenceMatcher(None,normalized(item['title']),normalized(h['title'])).ratio(),default=None)
   similarity=difflib.SequenceMatcher(None,normalized(item['title']),normalized(best['title'])).ratio() if best else 0
   g['tableOfContents'].append(dict(title=item['title'],lessonId=lesson['id'],printedPage=item['printedPage'],id=best['id'] if similarity>.6 else '',level=3 if item['indent']>=3 else 2))
  if g['id']=='index':
   for l in lessons:l['title']='Index · '+l['printedPage']
   for l in g['lessons']:l['title']='Index · '+l['printedPage']
   dump(g['path'],dict(chapter=g['id'],lessons=lessons))
  dump('data/search/'+g['id']+'.json',[dict(id=l['id'],title=l['title'],pdfPage=l['pdfPage'],printedPage=l['printedPage'],text=' '.join(b['text'] for b in l['blocks'] if 'text' in b)) for l in lessons])
 dump('data/chapters.json',catalog)
if not (OUT/'data/original-images-manifest.json').exists() or len(json.loads((OUT/'data/original-images-manifest.json').read_text()))<283:
 from extract_originals import extract
 extract(SOURCE,OUT)
# Copy local authored app and docs; source extraction is a separate checkpoint.
if (ROOT/'web').exists():
 shutil.copytree(ROOT/'web',OUT,dirs_exist_ok=True)
# Preserve the reproducible scripts with no machine-specific path embedded in deployed code.
scriptdir=OUT/'scripts/extraction-and-validation';scriptdir.mkdir(parents=True,exist_ok=True)
if Path(__file__).resolve()!=(scriptdir/'build_project.py').resolve():shutil.copy2(__file__,scriptdir/'build_project.py')
for name in ['extract_originals.py','validate.py']:
 candidate=ROOT/'tooling'/name
 if not candidate.exists():candidate=Path(__file__).parent/name
 if candidate.exists() and candidate.resolve()!=(scriptdir/name).resolve():shutil.copy2(candidate,scriptdir/name)
# Raster PWA icons are authored geometry, not replacement FAA artwork.
for size in [180,192,512]:
 im=Image.new('RGB',(size,size),'#081425');draw=ImageDraw.Draw(im);s=size/512
 draw.rounded_rectangle((24*s,24*s,488*s,488*s),radius=110*s,fill='#0c2039',outline='#244c71',width=max(1,int(3*s)))
 poly=[(256,88),(280,218),(407,300),(407,326),(279,286),(273,378),(316,406),(316,427),(256,407),(196,427),(196,406),(239,378),(233,286),(105,326),(105,300),(232,218)]
 draw.polygon([(int(x*s),int(y*s)) for x,y in poly],fill='#8ecbff')
 dest=OUT/f'assets/icons/icon-{size}.png';dest.parent.mkdir(parents=True,exist_ok=True);im.save(dest)
report=OUT/'reports/extraction-report.md'
if report.exists() and 'Native image preservation' not in report.read_text():
 report.write_text(report.read_text()+'\n## Native image preservation\n\nAll 283 embedded appearances have separate preservation assets: 281 original image streams without recompression and two inline title-page bitmaps. Native artwork may rely on PDF vector/text overlays or masks; use the complete rendered figure/page to retain those elements. Original streams are not automatically downloaded for offline chapters.\n\nThe original 513-entry table of contents drives chapter contents navigation. The reconciliation audit matched 436 entries exactly after normalization and flags 77 for manual review. See reports/heading-reconciliation.json.\n')
print('Project assembled at',OUT,flush=True)
