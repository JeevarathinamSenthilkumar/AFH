"""Extract original embedded image streams without recompression; keep page crops for overlays."""
from pathlib import Path
import sys,json,hashlib
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'.tools/python'))
import pymupdf as f

def extract(source,out):
 root=Path(out);doc=f.open(source);content=json.loads((root/'data/content-manifest.json').read_text());rows=[];seen={}
 for i,page in enumerate(doc):
  meta=content['pages'][i]
  for j,info in enumerate(page.get_image_info(xrefs=True)):
   xref=info['xref']
   if not xref:
    blocks=[b for b in page.get_text('dict')['blocks'] if b['type']==1 and b.get('width')==info['width'] and b.get('height')==info['height']]
    if not blocks:continue
    b=blocks[0];file=f'assets/originals/{meta["chapterId"]}/pdf-{i+1:03}-inline-{j+1:02}.{b["ext"]}';target=root/file;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(b['image'])
    rows.append(dict(id=f'original-inline-p{i+1:03}-{j+1:02}',asset=file,pdfPage=i+1,printedPage=meta['printedPage'],chapterId=meta['chapterId'],sourcePublication='FAA-H-8083-3C',xref=0,width=info['width'],height=info['height'],bounds=list(info['bbox']),sha256=hashlib.sha256(b['image']).hexdigest(),method='Inline PDF bitmap exported losslessly',verificationStatus='Pixel extraction complete; manual visual verification pending'))
    continue
   if xref not in seen:
    data=doc.extract_image(xref);file=f'assets/originals/{meta["chapterId"]}/pdf-{i+1:03}-image-{j+1:02}.{data["ext"]}';target=root/file;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data['image']);seen[xref]=file
    if data.get('smask'):
     mask=doc.extract_image(data['smask']);maskname=f'assets/originals/{meta["chapterId"]}/pdf-{i+1:03}-image-{j+1:02}-mask.{mask["ext"]}';(root/maskname).write_bytes(mask['image'])
   file=seen[xref];rows.append(dict(id=f'original-p{i+1:03}-{j+1:02}',asset=file,pdfPage=i+1,printedPage=meta['printedPage'],chapterId=meta['chapterId'],sourcePublication='FAA-H-8083-3C',xref=xref,width=info['width'],height=info['height'],bounds=list(info['bbox']),sha256=hashlib.sha256((root/file).read_bytes()).hexdigest(),method='Original PDF embedded image stream; no recompression',verificationStatus='Binary extraction verified; artwork overlays must be checked against original page',note='PDF text, arrows, vector overlays, masks and captions may not be part of this embedded bitmap. Use the rendered figure or original full page to see the complete artwork.'))
 (root/'data/original-images-manifest.json').write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':')))
 figs=json.loads((root/'data/figures-manifest.json').read_text())
 for row in figs:
  r=f.Rect(row['crop']);row['originalEmbeddedAssets']=[x['asset'] for x in rows if x['pdfPage']==row['pdfPage'] and (r&f.Rect(x['bounds'])).get_area()>0]
 (root/'data/figures-manifest.json').write_text(json.dumps(figs,ensure_ascii=False,separators=(',',':')))
 print('Preserved',len(rows),'embedded appearances:',len(seen),'original image streams plus',len(rows)-len(seen),'inline bitmaps',flush=True)
if __name__=='__main__':extract(sys.argv[1],sys.argv[2])
