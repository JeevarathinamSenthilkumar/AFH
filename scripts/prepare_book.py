"""Split the supplied FAA PDF without altering page content; build a local search index.

Requires Python 3.11+, PyMuPDF, pypdf and Pillow. The input is read-only.
Usage: python scripts/prepare_book.py --source /path/00_afh_full.pdf
"""
from pathlib import Path
import argparse, collections, hashlib, json, re, unicodedata, logging
import pymupdf as fitz
from PIL import Image
from pypdf import PdfReader, PdfWriter

ROOT = Path(__file__).resolve().parents[1]
TITLES = [
    "Introduction to Flight Training", "Ground Operations", "Basic Flight Maneuvers",
    "Energy Management: Mastering Altitude and Airspeed Control",
    "Maintaining Aircraft Control: Upset Prevention and Recovery Training",
    "Takeoffs and Departure Climbs", "Ground Reference Maneuvers", "Airport Traffic Patterns",
    "Approaches and Landings", "Performance Maneuvers", "Night Operations",
    "Transition to Complex Airplanes", "Transition to Multiengine Airplanes",
    "Transition to Tailwheel Airplanes", "Transition to Turbopropeller-Powered Airplanes",
    "Transition to Jet-Powered Airplanes", "Transition to Light Sport Airplanes (LSA)",
    "Emergency Procedures",
]
STARTS = [22, 38, 62, 87, 106, 133, 147, 165, 172, 210, 218, 232, 250, 287, 295, 310, 335, 350, 373]

def write(name, value):
    p = ROOT / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")

def sha(data):
    return hashlib.sha256(data).hexdigest()

def normalize(text):
    text = re.sub(r"([a-zA-Z])-\s*\n\s*([a-zA-Z])", r"\1\2", text)
    text = unicodedata.normalize("NFKD", text).lower()
    return re.sub(r"[^a-z0-9]+", " ", text).strip()

def visible_search_text(page):
    # The supplied PDF includes tiny revision counters inside normal paragraphs.
    # Exclude only these sub-4pt/invisible positioning spans from the search excerpt.
    data = page.get_text('dict', sort=True, flags=fitz.TEXTFLAGS_DICT & ~fitz.TEXT_PRESERVE_IMAGES)
    lines = []
    for block in data['blocks']:
        if block['type'] != 0:
            continue
        for line in block['lines']:
            text = ''.join(s['text'] for s in line['spans'] if s['size'] >= 4 and s.get('alpha',255)>0).strip()
            if text:
                lines.append(text)
    text = re.sub(r"([a-zA-Z])-\s*\n\s*([a-zA-Z])", r"\1\2", '\n'.join(lines))
    return re.sub(r"\s+", " ", text).strip()

def run(source):
    doc = fitz.open(source)
    reader = PdfReader(source)
    # pypdf reports dropped cross-file navigation destinations while splitting.
    # The app's extracted contents supplies cross-chapter navigation.
    logging.getLogger('pypdf').setLevel(logging.ERROR)
    source_hash = sha(source.read_bytes())
    assert len(doc) == 406, "This builder targets the supplied 406-page 2021 3C edition."
    groups = [dict(id="front-matter", number=0, title="Cover & front matter", first=1, last=21)]
    groups += [dict(id=f"chapter-{n:02}", number=n, title=t, first=STARTS[n-1], last=STARTS[n]-1)
               for n, t in enumerate(TITLES, 1)]
    groups += [dict(id="glossary", number=0, title="Glossary", first=373, last=391),
               dict(id="index", number=0, title="Index", first=392, last=406)]
    toc = []
    for i in range(9, 21):
        for line in doc[i].get_text(sort=True).splitlines():
            m = re.match(r"^(\s*)(.*?)\s+(\d{1,2})-(\d+)\s*$", line)
            if m and 1 <= int(m[3]) <= 18:
                ch, page = int(m[3]), int(m[4])
                absolute = STARTS[ch-1] + page - 1
                assert absolute < STARTS[ch]
                toc.append(dict(title=m[2].strip(), chapter=ch, page=page,
                                sourcePage=absolute, printedPage=f"{ch}-{page}",
                                depth=0 if len(m[1]) <= 2 else 1, sourceTocPage=i+1))
    assert len(toc) > 500, f"Unexpected TOC coverage: {len(toc)}"
    pages, search_pages, audit = [], [], []
    postings = collections.defaultdict(list)
    no_text, soft_hyphens, missing_footers = [], [], []
    image_references, image_streams = 0, set()
    for g in groups:
        g.update(pageCount=g["last"]-g["first"]+1, path=f"pdf/{g['id']}.pdf")
        g["contents"] = [t for t in toc if t["chapter"] == g["number"]] if g["number"] else []
        split = PdfWriter()
        split.append(reader, pages=(g["first"]-1,g["last"]), import_outline=False)
        # Copy the source label scheme at this boundary, including the front-matter changes.
        labels = []
        for label in doc.get_page_labels():
            if g["first"]-1 <= label["startpage"] <= g["last"]-1:
                labels.append(dict(label, startpage=label["startpage"]-g["first"]+1))
        for index, label in enumerate(labels):
            end = labels[index+1]["startpage"]-1 if index+1 < len(labels) else g["pageCount"]-1
            split.set_page_label(label["startpage"], end, style='/' + label['style'],
                                 prefix=label['prefix'], start=label['firstpagenum'])
        split.add_metadata({"/Title": g["title"], "/Author": "Federal Aviation Administration",
                            "/Subject": "FAA-H-8083-3C (2021); original pages"})
        output = ROOT / g["path"]
        split.write(output)
        split.close()
        actual = fitz.open(output)
        assert len(actual) == g["pageCount"]
        g["bytes"] = output.stat().st_size
        assert g["bytes"] < 100_000_000, "GitHub individual file limit exceeded"
        g["sha256"] = sha(output.read_bytes())
        g["pageIds"] = []
        for relative, src in enumerate(range(g["first"]-1, g["last"]), 1):
            before, after = doc[src], actual[relative-1]
            raw = before.get_text(sort=True)
            extracted = after.get_text(sort=True)
            if raw != extracted:
                # PDFDocEncoding can canonicalize an identically drawn soft-hyphen glyph.
                assert raw.replace('\xad','-') == extracted.replace('\xad','-'), f"Text changed on {src+1}"
                soft_hyphens.append(src+1)
            # Exact pixel equality of every complete page, not selected samples.
            pix1 = before.get_pixmap(matrix=fitz.Matrix(0.6, 0.6), alpha=False)
            pix2 = after.get_pixmap(matrix=fitz.Matrix(0.6, 0.6), alpha=False)
            assert pix1.samples == pix2.samples, f"Appearance changed on {src+1}"
            assert before.rect == after.rect and before.rotation == after.rotation
            # Decoded content streams remain byte-identical, preserving vector/text operators.
            assert before.read_contents() == after.read_contents(), f"Content changed on {src+1}"
            original_images = sorted(sha(doc.xref_stream_raw(x[0]) or b'') for x in before.get_images(full=True))
            split_images = sorted(sha(actual.xref_stream_raw(x[0]) or b'') for x in after.get_images(full=True))
            assert original_images == split_images, f"Image stream changed on {src+1}"
            image_references += len(original_images)
            image_streams.update(original_images)
            if g["number"]:
                printed = f"{g['number']}-{relative}"
            elif g["id"] == "glossary":
                printed = f"G-{relative}"
            elif g["id"] == "index":
                printed = f"Index-{relative}"
            else:
                printed = {1: "Cover", 2: "Title", 3: "Blank"}.get(relative, before.get_label())
            if src >= 21:
                footer_visible = bool(re.search(r"(?:^|\s)" + re.escape(printed) + r"\s*$", raw))
                if not footer_visible:
                    # Preserve source omissions; the PDF page-label scheme still identifies the page.
                    missing_footers.append(dict(sourcePage=src+1,label=printed))
            pid = f"afh-3c-2021-p{src+1:04}"
            row = dict(id=pid, groupId=g["id"], sourcePage=src+1, page=relative,
                       printedPage=printed, pdf=g["path"], width=before.rect.width, height=before.rect.height)
            pages.append(row)
            g["pageIds"].append(pid)
            page_headings = [t["title"] for t in g["contents"] if t["page"] == relative]
            text = visible_search_text(before)
            search_pages.append(dict(id=pid, groupId=g["id"], page=relative,
                                     printedPage=printed, text=text, headings=page_headings))
            idx = len(search_pages)-1
            for token in set(normalize(text + " " + g["title"] + " " + " ".join(page_headings)).split()):
                postings[token].append(idx)
            if not text:
                no_text.append(dict(sourcePage=src+1, id=pid, printedPage=printed))
            audit.append(dict(sourcePage=src+1, id=pid, output=g["path"], outputPage=relative,
                              textSha256=sha(raw.encode()), contentSha256=sha(before.read_contents()),
                              renderSha256=sha(pix1.samples), identicalRender=True))
        print(g["id"], g["pageCount"], f"{g['bytes']/1024/1024:.1f} MiB", flush=True)
    assert sorted(p["sourcePage"] for p in pages) == list(range(1, len(doc)+1))
    assert len({p["id"] for p in pages}) == len(doc)
    add_path = ROOT / "pdf/faa-addendum-2025.pdf"
    add = fitz.open(add_path)
    update = dict(id="faa-addendum", number=0, title="FAA addendum", date="October 20, 2025",
                  checked="2026-11-02", path="pdf/faa-addendum-2025.pdf", pageCount=len(add),
                  bytes=add_path.stat().st_size, sha256=sha(add_path.read_bytes()),
                  sourceUrl="https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/AFH_Addendum_%28MOSAIC%29.pdf")
    write("data/book.json", dict(publication="FAA-H-8083-3C", edition=2021, pageCount=len(doc),
                                sourceSha256=source_hash, groups=groups, update=update))
    write("data/page-map.json", dict(sourceFilename=source.name, sourceSha256=source_hash, pages=pages))
    write("data/search-index.json", dict(version=1, pages=search_pages, postings=postings))
    write("reports/content-verification.json", dict(sourceFilename=source.name, sourceBytes=source.stat().st_size,
          sourceSha256=source_hash, pageCount=len(doc), chapters=18, splitPdfCount=len(groups),
          missingPages=[], duplicatePages=[], exactContentStreams=406, exactPixelComparisons=406,
          renderDpi=43.2, equivalentTextPages=406, softHyphenExtractionDifferences=soft_hyphens,
          identicalEmbeddedImageReferences=image_references, identicalUniqueEmbeddedImageStreams=len(image_streams),
          tocEntries=len(toc), pagesWithoutExtractableText=no_text,
          sourcePagesWithoutPrintedFooter=missing_footers, pages=audit))
    assert sha(source.read_bytes()) == source_hash, "Source changed"
    # Thumbnails are navigation assets only. Reading always uses the PDF.
    for src, name in [(0, "cover"), (21, "chapter-one")]:
        pix = doc[src].get_pixmap(matrix=fitz.Matrix(0.65, 0.65), alpha=False)
        Image.frombytes("RGB", (pix.width, pix.height), pix.samples).save(ROOT / f"assets/{name}.webp", quality=88)
    print(f"VERIFIED {len(pages)}/406 pages; {len(toc)} contents entries; {len(no_text)} textless pages", flush=True)

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True, type=Path)
    run(ap.parse_args().source)
