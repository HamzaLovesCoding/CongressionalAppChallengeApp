# Where these packages come from

- **Source:** the owner's `Final Lane Simulations` folder (V4), kept outside this repository at
  `../LANE App Simulations - Codex/Final Lane Simulations/`, byte-identical to `Final Lane Simulations.zip`.
- **Imported:** 2026-10-15. Each `<id>/src/index.ts` was compared with the source after copying. The owner-approved patches below mean the vendored runtime is no longer byte-identical to that release.
- **Copied per package (runtime + provenance only):** `src/index.ts`, `src/scene.ts`, `src/types.ts`, `src/config.json`,
  `src/styles.css`, `src/vite-env.d.ts`, `scenario-manifest.json`, `thumbnail.png`, `tokens.css`, `README.md`, `package.json`.
  Root: `README.md`, `VERIFICATION.md`, `design.md`, `catalog.json`.
- **Left out on purpose:** each package's standalone demo (`src/demo.ts`, `src/demo.css`, `index.html`), Playwright tests and
  configs, Vite configs, lockfiles, screenshots, the root preview catalog and scripts. Lane builds the packages from source
  with its own Vite and Babylon.js 9.27.1 (the packages declare `^8.0.0`; every import they use exists in 9.27.1 and type-checks).

## Rules

- Do not edit these files to change scenes, choices, timers, outcomes or visuals without owner authorization. That is package work, owned outside Lane.
  Integration fixes belong in `src/simulation/` (registry, outcome adapter, host).
- Every manifest is `draft-needs-human-handbook-review`; keep that status until a human reviews the handbook facts.
- To update a package: replace its folder with the new release using the same file list, then run
  `node --test scripts/simulation.test.mjs` and `node scripts/inspect-simulations.mjs`.

## Owner-approved local patches — 2026-10-17

The owner requested fixes to all four findings in the simulation audit. The original source folder is unavailable in this checkout, so these targeted fixes are maintained here and must be preserved or ported when replacing a package:

- All ten `src/styles.css`: 44px Exit targets and a side-by-side scene/control layout for short landscape screens. Lane's `src/feed/minimal.css` widens only the active simulation's feed column for that layout.
- `freeway-entrance-merge/src/styles.css` and `src/scene.ts`: reserve caption clearance above the mirror and keep the rendered mirror viewport aligned with its frame when resizing.
- `yellow-light-stop/src/scene.ts`: put the signal on the far side of the intersection, keeping every lamp visible after the safe stop.
- `lane-ends-merge/src/scene.ts`: use a yellow diamond with a right-lane-reduction symbol, based on the [FHWA W4-2R drawing](https://mutcd.fhwa.dot.gov/SHSm/warning.pdf).
- `lane-ends-merge/thumbnail.png` and `yellow-light-stop/thumbnail.png`: regenerated from the corrected live scenes so loading artwork and text fallbacks show the same geometry.

Choices, timers, outcomes, callbacks and draft content status are unchanged. Verification adds `inspect-simulation-outcomes.mjs`, `inspect-simulation-edges.mjs`, `inspect-simulation-geometry.mjs` and `inspect-simulation-3d.mjs`; set `AUDIT_DIR` to keep a separate run's screenshots and results.
