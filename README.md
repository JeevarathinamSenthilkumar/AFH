# Pilot Path Flight

An iPhone-first, buildless Progressive Web App for studying the complete supplied FAA Airplane Flying Handbook, FAA-H-8083-3C (2021). No account, backend, subscription, API key, npm install, Xcode, or production build is required.

## Run locally

From this project folder, run:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open http://localhost:4173. Opening `index.html` as a file will not work because browsers restrict JSON fetching and service workers. For an iPhone installation, use an authorized HTTPS host; a Mac LAN HTTP address does not support PWA service workers. In iPhone Safari, Share → Add to Home Screen.

## Reading and learning

The 18 original chapters use 351 stable page-based lessons. All 406 original pages, including front matter, glossary and index, have searchable raw text and full-page source images. The contents panel follows the original 513-entry table of contents; 77 heading matches still need review. Chapters are loaded individually. Learn shows the selected chapter, its original sequence, heading contents, figures, and original page references. Use the original-page toggle to verify formatting and zoom any source image.

Completion is explicit. Opening or scrolling a lesson does not complete it. Reading position, selected chapter, bookmarks, notes and optional practice attempts stay on this device. Progress → Export backup produces a JSON file; Import backup transfers or restores it. Import replaces this app's learning data only after validation. It does not download handbook content.

Download a chapter from Learn or Progress before reading offline. The interface is cached after the first successful visit. Full-book search downloads text indexes on request, not the entire image collection. Offline search reports unavailable indexes. Safari may evict caches, and removing website data also removes progress; keep backups.

## Source and verification status

This is a working source-preserving edition, **not a claim of fully verified transcription**. Automated checks verify source hashes, exact raw text, page coverage, identifiers, captions and file paths. A complete human review of reading order, inferred headings, table detection and figure crop boundaries remains outstanding. Every source page has a 216-dpi fallback. The heading reconciliation matched 436 of 513 contents entries exactly, with 77 requiring review. See the detailed reports before treating any chapter as verified complete.

FAA Updates is a separate layer containing the full October 20, 2025 addendum. Original text, including Chapter 17, remains intact. See `references/faa-updates.md` for affected pages and the addendum's date discrepancy with current FAA MOSAIC information. Practice checks are supplemental author-created material, not official FAA exam questions, and never gate reading.

## Project structure

- `index.html`, `manifest.webmanifest`, `sw.js`: static entry, install metadata, cache strategy.
- `src/css`, `src/js`: interface, routing, reading and device-local data.
- `chapters/`: full original page renders, one file per page.
- `assets/figures`, `assets/tables`: numbered and unnumbered source illustrations and detected table regions.
- `assets/originals`: 281 original embedded image streams without recompression, plus 2 inline bitmaps exported losslessly. These large preservation files are not part of automatic offline downloads.
- `data/lessons`: complete extracted chapter text, source coordinates, raw text and reflowed blocks.
- `data/search`: per-chapter full-text indexes, fetched only when searching.
- `data/*manifest.json`, `data/section-inventory.json`: reviewable inventories.
- `references/`: FAA URLs, separate update PDF, image attribution and rights notes.
- `reports/`: source coverage, extraction, automated validation, mobile/browser QA and explicit limitations.
- `scripts/extraction-and-validation/`: reproducible tooling; Python 3.12+, PyMuPDF, Pillow. The website does not depend on these.
- `docs/github-deployment.md`: GitHub Desktop and Pages instructions.

## Reproduce extraction

Install `PyMuPDF` and `Pillow` in a Python virtual environment. Obtain the original supplied PDF and official addendum locally. They are input arguments, never modified:

```sh
python scripts/extraction-and-validation/build_project.py --source /path/to/00_afh_full.pdf --addendum /path/to/AFH-addendum.pdf --output /path/to/output --extract
python scripts/extraction-and-validation/validate.py /path/to/output --source /path/to/00_afh_full.pdf --source-only
```

Extraction can run without the authored `web/` folder; the output source content is independent from the interface. Reuse the existing app files when rebuilding content. Cached rendered images are reused. Delete or use a fresh output directory if changing the rendering algorithm. Stable IDs are chapter and printed-page based; reconcile editions explicitly before switching source publications.

## Public release

**Do not publish the complete image collection until third-party rights are cleared.** Original credits include imagery by Shane Torgerson and Robert Frola, without explicit downstream licensing. Read `references/image-attributions.md`. This project has not been pushed, published, or connected to a GitHub repository by the build process. FAA artwork is excluded from the app-code license. This independent study app is not endorsed by the FAA and is not aircraft operating guidance.
