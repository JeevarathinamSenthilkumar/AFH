# Sources and assets

## Original handbook

Supplied file: `../00_afh_full.pdf`, 273,248,888 bytes, 406 pages.

SHA-256: `90dda95dcbe992bd798f1932b02b5a02d620d8344565c0516a6917f29dea1f8d`.

Title: **Airplane Flying Handbook**, FAA-H-8083-3C, 2021. Source pages are retained as PDFs, not rewritten into lessons or reconstructed from extracted text. The source file is unchanged. Text extraction is used for search only.

[Official handbook and chapter catalog](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/airplane_handbook). [Current aviation handbook catalog](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation). Both checked November 2, 2026.

The original acknowledgments are retained on source PDF page 6 (printed iii). They credit Shane Torgerson for Sedona Airport imagery and Robert Frola for Evektor-Aerotechnik EV-97 SportStar Max imagery. These credits are reproduced as published. The app-code license does not grant rights in the handbook or its third-party artwork.

## Separate update

`pdf/faa-addendum-2025.pdf` is the four-page official **October 20, 2025** FAA addendum, downloaded unchanged from the [FAA source](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/AFH_Addendum_%28MOSAIC%29.pdf) on November 2, 2026. The FAA catalog currently lists this October 2025 addendum. It remains in Updates, and does not alter the original 2021 pages or progress denominator.

## Background

`assets/cessna-hero.webp` is an original decorative, photorealistic image created for this project with the built-in OpenAI image-generation tool. It is bundled locally. It is not an FAA image or a replacement for any handbook photograph. WebP compression, resizing, neutral overlays, desaturation, and background blur are applied for the interface. The final prompt and generation details are recorded in [assets/background-prompt.md](./assets/background-prompt.md).

## Renderer and icons

Mozilla **PDF.js 5.6.205**: Apache License 2.0. See `vendor/PDFJS-LICENSE`, `vendor/standard_fonts/LICENSE_*`, and `vendor/wasm/LICENSE_*` for bundled components. The legacy browser build supplies compatibility polyfills and runs its PDF worker locally.

App mark and interface SVG icons were authored for this project. System fonts are selected through CSS; there is no remote font download. No FAA seal is used as app branding.
