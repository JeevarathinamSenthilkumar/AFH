# Pilot Path Flight — quality assurance

Verified November 2, 2026. The delivered project is local and unpublished.

## Result

All 406 source pages are present, once each, across 21 section PDFs. All 18 official chapter titles are present. The separate, unchanged October 20, 2025 addendum has four pages. No known failing application behavior remains in the tests below. Physical iPhone installation and touch behavior still require device verification.

**28 browser checks passed, zero failures**, across WebKit 26.5 and Chrome 156.0.8078.74. Five progress-model tests passed. Additional repository-subdirectory, chapter-boundary, cached byte-range, and completed-chapter checks passed in both engines. Exact machine-readable results are in `browser-tests.json`, `deployment-tests.json`, `project-checks.json`, and `content-verification.json`.

## Source preservation

Original input: `../00_afh_full.pdf`, 273,248,888 bytes.

SHA-256: `90dda95dcbe992bd798f1932b02b5a02d620d8344565c0516a6917f29dea1f8d`.

| Check | Result |
| --- | --- |
| Original pages accounted for | 406 / 406 |
| Missing / duplicate original pages | 0 / 0 |
| Original chapters | 18 / 18 |
| Front matter, glossary, index | 21, 19, 15 pages respectively |
| Exact decoded page content streams | 406 / 406 byte-identical |
| Complete-page pixel comparison | 406 / 406 identical at 43.2 dpi using the same renderer |
| Original embedded image streams | 281 / 281 byte-identical |
| Page dimensions / rotation | All unchanged |
| Extracted text | Equivalent on every page; 17 pages differ only in soft-hyphen extraction |
| Original table-of-contents entries | 513 extracted, each assigned to its original chapter-relative page |
| Original full PDF modified | No |
| Largest deployment file | Chapter 3: 42,241,987 bytes, approximately 40.3 MiB |

The original drawing/text operators and original image bytes are preserved; reading PDFs are not rasterized, OCR-reconstructed, or reflowed. Pixel comparisons supplement the byte-level checks and are not a claim of an exhaustive human review at print resolution. Browser screenshots were visually inspected for readable, complete PDF pages and interface layout.

Chapter boundaries: front matter 1–21; chapters 1–18 begin at source pages 22, 38, 62, 87, 106, 133, 147, 165, 172, 210, 218, 232, 250, 287, 295, 310, 335, 350; glossary 373–391; index 392–406. These agree with the source bookmarks and page-label scheme. Titles agree with the [FAA handbook catalog](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/airplane_handbook), checked November 2, 2026.

The original document's cross-chapter link annotations cannot keep their full-book destinations after splitting. The split files retain 31 operative in-section/external link annotations; the app supplies all 513 printed table-of-contents entries as direct navigation. The reader displays the original page drawing; it does not add a PDF annotation/text-selection layer.

## Source-specific limitations retained as published

- Source PDF page 1 (cover image) and page 3 (blank) contain no extractable text. They remain fully readable and are recorded in the coverage report. No invented search text is substituted.
- Source pages 356 and 357 have no printed footer in the supplied PDF. Their manifest/Reader labels, 18-7 and 18-8, follow the original PDF page-label scheme and chapter sequence. No footer has been added to either page.
- On 17 pages, pypdf's serialization changes extraction of an identically drawn soft-hyphen glyph from U+00AD to U+002D. Original page content streams, appearance, and embedded image bytes remain identical. Search text comes directly from the original input, excluding invisible/sub-4pt revision counters from excerpts. The exact source page list is in `content-verification.json`.
- Original typographic/edition inconsistencies, including the glossary header's older handbook identifier, are retained without correction.

## Interaction coverage

The following passed in both browser engines:

- Library with all 18 official titles, real page counts, and no automatic PDF prefetch.
- Chapter selection, overview, original contents, Open Chapter, Resume Reading, and Continue Reading.
- Original PDF rendering in a single bounded canvas; previous/next navigation and correct printed page label.
- Two-second visible-page guard: quickly passing a page does not complete it; deliberate Next does.
- Automatic completion affects only the page being left and commits after successful next-page rendering.
- Manual Incomplete survives later forward navigation; manual Completed survives refresh. Overrides are not overwritten by automatic status.
- Page-grid and direct-page navigation do not complete earlier pages.
- Chapter and overall completed-page totals; complete-chapter icon and completed-chapter count.
- Cross-chapter Next/Previous; disabled Previous at the first original page and Next at the last original page.
- Full-text `crosswind` search, official chapter-title search, and no-result state. The selected `crosswind` result was checked against original extracted text and opened its exact source page.
- Search in Library, absent from the full-screen Reader.
- Zoom controls, reset, focus mode, tapping to restore controls, and synthetic two-pointer pinch/pan handlers.
- Local progress persistence after refreshing the Reader.
- Offline shell cold reload, offline search, and a downloaded original PDF while the isolated HTTP server was stopped.
- Explicit chapter download, useful uncached-chapter error, and chapter-level PDF caching without fetching the whole book.
- Separate addendum reading, excluded from the original handbook's progress denominator.
- 360 × 780, 420 × 912, 440 × 956 portrait layouts and 912 × 420 landscape; no horizontal Library overflow and complete page fit within the reading area.
- Simulated 59 px top and 34 px bottom safe-area padding.
- Repository-style `/pilot-path-flight/` hosting, matching service-worker scope, module/PDF URLs, and cached PDF Range response (206, first 100 bytes beginning `%PDF`).
- No uncaught JavaScript errors in the final runs.

The manifest's scope, start URL, standalone display, icon files, and actual PNG sizes were checked. All 39 shell-cache assets exist. Source map and search records cover the entire book; no deployed file exceeds GitHub's individual-file limit. Root and repository-subdirectory hosting were tested locally; GitHub Pages itself was not published or tested remotely.

## Visual review

Actual screenshots are in `screenshots/`. The Library, chapter overview, search results, original PDF Reader, focus view, narrow/wide iPhone layouts, landscape layout, and safe-area view were inspected. A review montage is `screenshots/review-contact-sheet.jpg`. No clipped text, overlapping controls, off-screen page edges, or foreground aircraft image interfering with the PDF was observed. The app has no imitation status bar.

The generated decorative Cessna image is local. All educational figures and photographs continue to come from the unmodified original page content. Expensive blur is shared across the ambient background and a small set of large surfaces; chapter rows do not each have their own backdrop blur.

## Remaining verification limits

1. **No physical iPhone Air test or iOS Simulator test was performed.** WebKit 26.5 on macOS is additional Safari-engine coverage, not a device certification. Physical multi-touch inertia, actual Dynamic Island/Home indicator placement, Safari toolbar transitions, memory under device pressure, and orientation behavior need an iPhone check.
2. **Actual Add to Home Screen installation and standalone launch were not tested.** They require the user's HTTPS hosting choice. Manifest and safe-area plumbing pass static/browser checks; installation itself is not claimed verified.
3. **Long-term Safari storage eviction cannot be guaranteed.** Browser caches and local progress remain subject to platform storage policies. Explicit downloads report quota failures; removing website data removes progress.
4. **The reader uses a canvas with a page label, without selectable PDF text or a PDF accessibility text layer.** Library, search, contents, page chooser, status controls, and navigation have accessible labels and focus states; full document screen-reader access is not claimed.
5. **No exhaustive human proofread of every page at print resolution was performed.** Instead, every page's content stream, original image streams, dimensions, and rendered output were compared automatically. Source-specific extraction limitations are listed above.

An initial Playwright `context.setOffline(true)` experiment in WebKit failed before service-worker interception. To test actual cached delivery, the final suite stopped its isolated local HTTP server and simulated only the browser's offline indicator. Cached cold reload, PDF reading, and search then passed in both engines. The earlier emulation screenshot is retained as `screenshots/webkit-offline-emulation-limitation.png`; it is not an outstanding app failure.

## Final device check after publishing

Open the chosen HTTPS URL in iPhone Safari, add to Home Screen, download one chapter, enable airplane mode, close and reopen the installed app, read and zoom a page, move forward, set a manual Incomplete override, reopen the app, and confirm the same position and status. Check portrait/landscape safe areas and the longest chapter titles. This checklist is a remaining verification step, not a tested result.
