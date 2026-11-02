# Extraction report

Source: FAA-H-8083-3C, 2021, 406 pages.

- Full raw text stored per original PDF page, including symbols and figure labels.
- Every page rendered at 216 dpi into quality-94 WebP.
- Meaningful PDF spans are reflowed into headings, paragraphs, and lists. Whitespace-only positioning spans and 1-point revision counters are excluded from reflow, retained in raw text.
- Text blocks are geometrically sorted. This is reliable on the predominantly single-column source, but complex layouts and index columns need human review.
- Numbered captions detected at line starts; italic continuations joined.
- Crops include raster artwork, related panels, nearby vector overlays, and caption; ambiguous matches use the full original page. All crops remain unverified.
- Unnumbered embedded appearances are inventoried and preserved too.
- Table-like regions detected automatically; original images are authoritative, structured cell data is for review only.
- 513 printed TOC entries retained with indentation, page reference, and source page.
- Raw text hashes checked by validation script.

Not completed: exhaustive semantic comparison, visual crop review, exact table reconstruction, full heading reconciliation, third-party image licensing. These are explicit release limitations, not silent omissions.

## Native image preservation

All 283 embedded appearances have separate preservation assets: 281 original image streams without recompression and two inline title-page bitmaps. Native artwork may rely on PDF vector/text overlays or masks; use the complete rendered figure/page to retain those elements. Original streams are not automatically downloaded for offline chapters.

The original 513-entry table of contents drives chapter contents navigation. The reconciliation audit matched 436 entries exactly after normalization and flags 77 for manual review. See reports/heading-reconciliation.json.
