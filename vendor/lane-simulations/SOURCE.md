# Where these packages come from

- **Source:** the owner's `Final Lane Simulations` folder (V4), kept outside this repository at
  `../LANE App Simulations - Codex/Final Lane Simulations/`, byte-identical to `Final Lane Simulations.zip`.
- **Imported:** 2026-10-15. Each `<id>/src/index.ts` was compared with the source after copying.
- **Copied per package (runtime + provenance only):** `src/index.ts`, `src/scene.ts`, `src/types.ts`, `src/config.json`,
  `src/styles.css`, `src/vite-env.d.ts`, `scenario-manifest.json`, `thumbnail.png`, `tokens.css`, `README.md`, `package.json`.
  Root: `README.md`, `VERIFICATION.md`, `design.md`, `catalog.json`.
- **Left out on purpose:** each package's standalone demo (`src/demo.ts`, `src/demo.css`, `index.html`), Playwright tests and
  configs, Vite configs, lockfiles, screenshots, the root preview catalog and scripts. Lane builds the packages from source
  with its own Vite and Babylon.js 9.27.1 (the packages declare `^8.0.0`; every import they use exists in 9.27.1 and type-checks).

## Rules

- Do not edit these files to change scenes, choices, timers, outcomes or visuals. That is package work, owned outside Lane.
  Integration fixes belong in `src/simulation/` (registry, outcome adapter, host).
- Every manifest is `draft-needs-human-handbook-review`; keep that status until a human reviews the handbook facts.
- To update a package: replace its folder with the new release using the same file list, then run
  `node --test scripts/simulation.test.mjs` and `node scripts/inspect-simulations.mjs`.
