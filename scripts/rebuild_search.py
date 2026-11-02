"""Refresh search excerpts/index without re-splitting verified, unchanged PDFs."""
import argparse, collections, json
from pathlib import Path
import pymupdf as fitz
from prepare_book import ROOT, visible_search_text, normalize, sha, write

ap = argparse.ArgumentParser()
ap.add_argument('--source', required=True, type=Path)
source = ap.parse_args().source
book = json.loads((ROOT/'data/book.json').read_text())
assert sha(source.read_bytes()) == book['sourceSha256'], 'Source edition changed'
index = json.loads((ROOT/'data/search-index.json').read_text())
groups = {g['id']:g for g in book['groups']}
doc = fitz.open(source)
postings = collections.defaultdict(list)
for i, row in enumerate(index['pages']):
    group = groups[row['groupId']]
    row['text'] = visible_search_text(doc[group['first']+row['page']-2])
    for token in set(normalize(row['text']+' '+group['title']+' '+' '.join(row['headings'])).split()):
        postings[token].append(i)
write('data/search-index.json', dict(version=1,pages=index['pages'],postings=postings))
print('Search refreshed from 406 original pages; sub-4pt revision counters excluded.')
