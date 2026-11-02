# Quality assurance report

Build and verification date: November 2, 2026.

## Outcome

Working local static PWA. Tested at a GitHub Pages-style `/Pilot-Path-Flight/` repository subdirectory. No repository push, public publication, or hosted deployment was performed. Public release requires the rights and manual content review described below.

## Automated source and file audit — passed

`automated-validation.json` records **2,825 passing checks, zero failures**:

- 406/406 original PDF pages covered once, with exact raw-text equality and unchanged original PDF SHA-256.
- All 18 chapters, 351 chapter lessons, plus 55 front/glossary/index page lessons.
- 277 independently recounted numbered figure captions, including suffixes and multi-panel labels; 3 unnumbered illustration records.
- 41 table-like regions preserved as original images. Structured cell data is retained for review, not presented as verified HTML tables.
- 283 embedded artwork appearances preserved separately: 281 unaltered image streams and 2 inline bitmaps.
- Stable, unique lesson IDs; source references, captions, original-image hashes and 1,052 referenced assets checked.
- All service-worker precache paths exist; JavaScript syntax checks passed.
- 36 supplemental practice questions across all 18 chapters, each linked to a located source evidence phrase.

The original PDF remains unchanged and is not duplicated into the deployment folder. The complete project is about 389 MiB, including original image preservation assets; largest individual file approximately 7.33 MiB. Large original streams are excluded from automatic chapter downloads.

## Browser interaction checks — passed

Performed in the Codex in-app browser using the actual static files and repository subdirectory:

- Home renders all 18 chapters; selecting Chapter 4 updates context and opens that chapter in Learn.
- Opening lessons does not complete them. Mark as Completed updates counts; progress survives reload.
- Bookmarks and a test note survive reload; next-lesson reading resumes independently.
- Multi-panel Figure 4-1 A-F opens with working zoom and horizontal inspection. Complete original-page view loads sharp 1837-pixel-wide source pages.
- Full-book search for “energy” returns 56 source-page results including chapters, glossary and index; result URLs link to reading lessons. Search indexes exclude invisible 1-point PDF revision counters in the final build.
- Chapter practice shows answer explanations and source links; a two-question attempt records its score in Progress.
- Export creates a valid JSON backup; importing it restores progress. An unrecognized backup is rejected before data replacement.
- QA learning data was restored to a clean initial state after browser testing.
- Home, Learn, Exams and Progress show no horizontal overflow at 320 CSS pixels. Home also checked at 393, 430, and 1024 widths.
- Reading text at 26 pixels fits at 320 width without horizontal overflow.
- Real screenshots were captured and reviewed. Dark mode, Apple system text, touch controls, and readable image enlargement were checked visually.

## Offline checks — passed

- Saved Chapter 4 with all chapter files, figures, page images and search index.
- Stopped the preview HTTP server, reloaded the app, opened the saved chapter, loaded original source pages, and navigated to the next lesson successfully from the service worker cache.
- An unsaved Chapter 18 produced a recovery message with retry/home actions.
- Shell caching works at the repository subdirectory. Downloads report completion only after all required files have been cached.
- Browser cache eviction and storage exhaustion cannot be guaranteed away; app/documentation explain this and recommend progress backups.

## Actual WebKit / iPhone Air Simulator — passed for checked flows

Xcode's installed iOS 26.5 iPhone Air simulator was used through its Safari UI:

- Opened the local subdirectory site in Safari and checked Home and Learn.
- Checked the real Dynamic Island/status area and bottom Home indicator safe areas. No fake status bar is drawn by the app.
- Installed via Safari Share → Add to Home Screen with Open as Web App enabled.
- Launched standalone with the original app icon and no browser toolbar.
- Saved Chapter 1 for offline use in standalone mode and scrolled the reading view. Explicit completion remains untouched.

Screenshots: `iphone-air-safari-home.png`, `iphone-air-safari-learn.png`, `iphone-air-standalone-home.png`, plus browser mobile, source-page and desktop screenshots in this folder.

## Content review still required

**No chapter is claimed to be manually verified complete.** Exact raw-text equality and complete page images preserve source information, but do not prove that every reflow or inferred crop is flawless.

- A complete human comparison of every substantive paragraph, procedure, list, warning and mathematical symbol has not been completed.
- Full original page renders are available throughout the reader; sample chapter openings and Figure 4-1 A-F were visually inspected. Every crop has not been reviewed individually at full size.
- 513 printed table-of-contents entries are inventoried. 436 match extracted headings exactly after normalization. The other 77 are explicitly recorded in `heading-reconciliation.json`; original wording/page references are retained in navigation.
- Figure caption continuations, exact subsection nesting, complex reading order and the index's paired columns still require review. Original-page mode is the reliable layout comparison.
- Table detection is heuristic. It is not an exhaustive human table inventory; many tabular items are numbered “Figure” by the source. Their complete original pages remain available.
- Original native bitmaps may omit PDF text/vector overlays when viewed alone. Optimized figure and source-page renders retain those visible overlays.

## FAA updates and image rights

The complete October 20, 2025 addendum is preserved separately, with four original pages, text, original PDF, affected chapters/pages and official links. The 2021 original Chapter 17 remains intact. Conflicting dates between the addendum and current FAA MOSAIC information are flagged without silently editing either source.

Third-party image permissions remain unresolved for public distribution. Source acknowledgments include Shane Torgerson and Robert Frola without an explicit downstream license. See `references/image-attributions.md`. No claim is made that every handbook image is public domain.

## Remaining device checks

A physical iPhone and long-term iOS cache-eviction behavior were not tested. VoiceOver and a full WCAG accessibility audit have not been performed. Reduced-motion and increased-contrast rules are included but were not exercised by changing the Mac's accessibility settings.
