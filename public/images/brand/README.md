# Lane brand artwork

Source: user-provided `AppMaterial/testappicon.png`. `lane-logo.png` is a byte-identical, unmodified copy used by the Home header. The quiz-template ZIP is not the logo source.

The source's dominant colors are parchment `#F0E4CE`, brown `#332A20`, and ochre `#D19735`. The shared UI palette extends these colors in `src/theme.css`.

As requested on October 13, 2026, app icons use the supplied full wordmark and tagline. `public/icon.svg` and `public/icon-maskable.svg` embed the original PNG, trim its surrounding blank space, and center it without stretching on a square cream background. The maskable version keeps the artwork inside the circular safe area. SVG and PNG exports come from `node scripts/render-icons.mjs`, using existing Playwright; no external artwork or new dependency is used.
