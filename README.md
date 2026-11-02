# Pilot Path Flight

An iPhone-first reader for the **original FAA Airplane Flying Handbook, FAA-H-8083-3C (2021)**. The 406 source pages remain PDF pages, with their original layouts, figures, photographs, diagrams, and tables. This is an eBook reader.

No account, backend, API key, Xcode, build step, or runtime internet dependency is required. Nothing has been published.

## Open locally on your Mac

In Terminal:

```sh
cd ~/Desktop/AFH/Pilot-Path-Flight
python3 scripts/serve.py
```

Open [http://127.0.0.1:4173/](http://127.0.0.1:4173/). Keep Terminal open while using the local preview. Press Control-C to stop it. Do not double-click `index.html`: PDF fetching, modules, and service workers require an HTTP(S) origin.

## Reader

- Library contains all 18 chapters, front matter, glossary, index, and a separate Updates entry.
- Select a chapter to open its overview and the original table of contents. Open Chapter begins at its first page; Resume Reading uses its last position.
- Continue Reading returns to the most recently read handbook page.
- Previous and Next move through the book in its original order, including chapter boundaries. Choose the page label for a compact page grid and direct page entry.
- Tap the page to hide or restore controls. Pinch to zoom and drag to pan; double-tap changes between fit and 2× zoom. Plus, minus, and reset controls are also available.
- On a keyboard, left/right arrows turn pages; Escape restores controls or returns to Library.
- The checkmark control sets the current page to Completed or Incomplete. These manual choices persist until explicitly changed.

Automatic completion applies only to the page being left with **Next**, after it has been rendered and visible for at least two seconds. Time while the app is hidden or a sheet is open does not count. A search jump, direct page jump, refresh, opening a chapter, or Previous never completes skipped pages. Automatic completion commits only after the next page renders successfully. Manual overrides always take precedence.

Progress uses actual completed-page counts. Overall progress includes all 406 handbook pages; the completed-chapter count uses the 18 chapters. The four-page addendum is separate. Progress is stored in `localStorage` under `pilot-path-flight.reader.v1`; IDs such as `afh-3c-2021-p0022` identify original edition pages independently of split files. There is no sign-in, cloud sync, import, or export.

Search is in Library. Its index is generated from the original PDF text and printed table of contents. A result opens the matching PDF page. The cover and source blank page have no extractable text; both are preserved for reading. Search covers the handbook, including reference sections; the addendum is read separately.

## Offline and Home Screen installation

The service worker caches the small app shell, local PDF.js renderer, fonts, and search index. **It does not download the full handbook.** Opening a chapter normally caches that chapter; an overview's Download for offline button explicitly stores its complete PDF. “Available offline” confirms that the PDF exists in this browser's cache; tapping that control removes the download without changing progress.

Safari can reclaim cached data. Removing website data also removes progress. If storage is full, explicit downloads report the failure. A chapter that has not been cached cannot be read offline.

For an iPhone, publish to an HTTPS address using the steps below, open that address in **Safari**, then use **Share → Add to Home Screen**. Open the Home Screen app, let its initial shell installation finish, and download the chapters you want available offline. A Mac LAN HTTP address is not a secure PWA installation origin. Device installation, actual Dynamic Island/Home indicator behavior, and physical multi-touch need a final check on your iPhone; see the QA report.

## Publish with GitHub Desktop, when you choose

1. Open GitHub Desktop. Choose **File → Add Local Repository** and select `~/Desktop/AFH/Pilot-Path-Flight/`. If it is not a Git repository yet, use the offered **create a repository here** link. Keep this folder as the repository root.
2. Confirm that `index.html`, `pdf/`, `data/`, `assets/`, `src/`, `vendor/`, `manifest.webmanifest`, `sw.js`, and `.nojekyll` are included. **Do not add `../00_afh_full.pdf`.** No Git LFS configuration is needed: the largest chapter is about 40.3 MiB.
3. Commit the local files in GitHub Desktop. Choose **Publish repository** only when ready. For GitHub Free Pages, use a public repository; private-repository Pages availability depends on your plan.
4. On the repository website, open **Settings → Pages**. Under **Build and deployment**, select **Deploy from a branch**, choose your committed branch and **/(root)**, then save.
5. Open the HTTPS URL GitHub Pages provides. A repository URL such as `https://YOUR-NAME.github.io/Pilot-Path-Flight/` works: assets, workers, manifests, and PDFs use relative URLs, and navigation uses hash routes.
6. In iPhone Safari, add the site to your Home Screen and check one downloaded chapter in airplane mode.

This project has no remote configured and has not been pushed or published by the build. Original acknowledgments and third-party handbook credits are preserved; see [ATTRIBUTIONS.md](./ATTRIBUTIONS.md).

GitHub references: [Desktop: add a local repository](https://docs.github.com/en/desktop/adding-and-cloning-repositories/adding-a-repository-from-your-local-computer-to-github-desktop), [Pages setup](https://docs.github.com/en/pages/quickstart), [file-size limits](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github). Checked November 2, 2026.

## Files

| Path | Purpose |
| --- | --- |
| `index.html`, `src/` | Buildless application, navigation, PDF reader, progress, search worker, glass styling |
| `pdf/` | 21 original-book sections, plus the unchanged official addendum |
| `data/book.json` | Official chapter metadata, original contents, relative-page IDs and PDF hashes |
| `data/page-map.json` | One record for every original PDF page: stable ID, source page, chapter page, printed label, split PDF |
| `data/search-index.json` | Original text per page plus a generated inverted word index |
| `vendor/` | Locally bundled Mozilla PDF.js 5.6.205, CMaps, fonts, and image-decoder support |
| `assets/` | Original app icons, generated decorative Cessna photograph, navigation thumbnails |
| `scripts/` | Development-only processing, local server, integrity checks, and tests |
| `reports/` | Preservation evidence, browser-test results, screenshots, and remaining verification limits |

Only one PDF document and one canvas are active at a time. Canvas resolution is bounded to seven million pixels; page fit responds to viewport/orientation changes. Blur is shared at background and large-surface level rather than on every chapter row. Reduced-motion and opaque glass fallbacks are included.

For a minimal deployment you may omit `scripts/` and `reports/`; retain all runtime files listed above. Leaving the development files in a branch-based Pages repository is also supported. Do not upload the whole enclosing AFH folder.

## Reproduce and check

The finished app needs no developer dependencies. Rebuilding book data requires Python 3.11+ with **PyMuPDF, pypdf, and Pillow**:

```sh
python3 scripts/prepare_book.py --source ../00_afh_full.pdf
node scripts/check-project.mjs
node --test scripts/progress.test.js
```

The builder targets this supplied 406-page edition and reads the source without writing to it. It verifies each split page's complete content stream, pixel rendering, page dimensions, and embedded image bytes. The original full PDF remains one folder above the deployment project. Do not use the builder for a different edition without reconciling boundaries, labels, and stable progress IDs.

Browser tests use Playwright as a development dependency, plus Chrome and WebKit. They are not bundled into the app:

```sh
npm install --no-save playwright
npx playwright install webkit
node scripts/browser-tests.cjs
```

If dependencies are supplied by an existing runtime, `PPF_PLAYWRIGHT_MODULE` can point to its Playwright package. `PLAYWRIGHT_BROWSERS_PATH` can select an existing browser installation. The test runner starts and stops isolated local HTTP servers to verify real cache use with no server available. Offline indicator state, safe-area insets, and pinch pointer events are simulated; these are explicitly distinguished from device tests.

## Updating the app

After changing runtime files, bump the `SHELL` cache version in `sw.js`. Keep the chapter cache name stable if chapter PDFs have not changed. If PDF bytes change, invalidate or version the chapter cache as part of that update. Keep original page IDs unchanged for this edition. An update installs its shell atomically; local progress survives shell cache replacement. A newly activated worker may require reopening or reloading the app to display the new shell.

The FAA catalog and addendum were checked on November 2, 2026. The preserved **October 20, 2025** addendum is separate from the 2021 pages. Refresh `data/book.json` update metadata only after retrieving and checking the actual official PDF; do not overwrite original handbook pages.

Read [reports/QA.md](./reports/QA.md) for exact results and outstanding physical-device verification.
