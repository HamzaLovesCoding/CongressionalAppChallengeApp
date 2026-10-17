# Portable driving simulations · V4

Ten independent Vite + plain TypeScript packages. SIM-01 through SIM-07 are straight overhead SVG scenes. SIM-08 through SIM-10 are actual Babylon.js driver-seat 3D scenes built from procedural geometry. No existing Lane frontend repository was edited. Each package is designed to mount inside a mobile web app, including a social-feed card or an existing lesson view.

Each interaction opens with visible scene artwork and Start, then a 1.8-second approach and a required 5–6 second countdown. The scene keeps moving at 8% speed during the decision. Selecting resumes the consequence at normal speed. Safe results provide Continue; wrong choices and timeout show a non-graphic impact or near-miss marker and Retry. Exit closes the practice separately from completion.

The development index contains only the ten simulation blocks. Catalog Continue advances to the next block; Exit returns to the list. Individual packages remain independent.
## Preview everything

```sh
npm ci
npm run dev -- --port 5176
```

Open http://127.0.0.1:5176/ for a local preview catalog. This page is a development aid, not a replacement for Lane's application. Each link opens one standalone package. Each package can also run independently with `npm ci && npm run dev` inside its own folder.

## Folder tree

```text
lane-simulations/
  four-way-stop/              # SIM-01 · 2D
  unprotected-left-turn/      # SIM-02 · 2D
  roundabout-entry/           # SIM-03 · 2D
  lane-ends-merge/            # SIM-04 · 2D
  blind-spot-motorcycle/      # SIM-05 · 2D
  emergency-vehicle-yield/    # SIM-06 · 2D
  railroad-clear-exit/        # SIM-07 · 2D
  yellow-light-stop/          # SIM-08 · 3D
  freeway-entrance-merge/     # SIM-09 · 3D
  right-turn-scan/            # SIM-10 · 3D
  README.md
  VERIFICATION.md
  design.md
  catalog.json
  index.html                 # Local preview catalog
  package.json
  package-lock.json
  playwright.config.ts
  .gitignore
  scripts/
    build-all.mjs
    screenshots.mjs
    package-all.py
  tests/
    catalog.spec.ts
```

Each scenario folder contains:

```text
<scenario-id>/
  .gitignore
  README.md
  scenario-manifest.json
  screenshot.png
  thumbnail.png              # Scene-only catalog image
  package.json
  package-lock.json
  index.html
  tsconfig.json
  vite.config.ts
  vite.lib.config.ts
  playwright.config.ts
  tokens.css
  src/
    index.ts                 # startScenario(container, callbacks)
    scene.ts                 # This scenario's geometry and animation
    types.ts
    config.json
    styles.css
    demo.ts
    demo.css
    vite-env.d.ts
  tests/scenario.spec.ts
  scripts/screenshot.mjs
```

## Exactly what to upload

Upload all files in `lane-all-10-simulations.zip` for the complete workspace, or a scenario's `<scenario-id>-upload.zip` to import one package. Keep each directory intact. The archives contain source, lockfiles, screenshots, tests, manifests, and documentation. They exclude `node_modules`, generated build directories, temporary test outputs, legacy unused rendering helpers, and internal authoring scripts.

For integration only, the ten scenario folders are sufficient; the root preview catalog and test harness are optional. Each folder's README documents the callback results, asset provenance, remaining content review, and exact upload list.

## Build, verify, and package

```sh
npm run build
npx playwright install chromium
npm test
# Each scenario also has its own npm test command.
# With the preview server running on 5176:
npm run screenshots
npm run package
```

On Linux, use `npx playwright install --with-deps chromium` if browser dependencies are missing. With Chrome installed, prefix test/screenshot commands with `PLAYWRIGHT_CHANNEL=chrome`.

Every package builds both `dist/` (standalone) and `dist-lib/` (portable ES module). The standalone builds use relative asset URLs. For compiled integration, retain the entire `dist-lib/` directory, including scene, runtime, and shader chunks, or import source into Lane's bundler so Babylon can be shared.

## Mobile web behavior

The primary viewports are 360 × 800 and 390 × 844. The activity fills a single portrait stage with safe-area spacing. A compact QTE panel appears inside the stage while the renderer resizes into unobscured space above it. Choice buttons are 49 pixels high at the primary sizes, and Start/Continue/Retry sit below the stage. A semicircular gauge shows relative illustrative speed without calibrated mph. Hosts can set `--scenario-height` for their available space. Narrower or shorter screens use compact controls with at least 44-pixel targets. Timers pause when a card scrolls out of view or the tab is hidden; inactive 3D scenes stop redrawing. Styles are isolated from the host in Shadow DOM. The app retains ownership of navigation, progress, and Review Later. Dispose mounted scenes when recycling feed items.

## Host responsibilities

All packages export `startScenario(container, {onComplete, onRetry, onExit})` and return an idempotent `destroy()` handle. Results contain `scenarioId`, `topicId`, `success`, `chosenAction`, and `elapsedSeconds`. Unsafe outcomes are not mastery. Exit remains a separate event for Review Later. Timeout follows the scenario’s unsafe default action and returns `success: false, chosenAction: 'timeout'`. The optional `onContinue(result)` callback or `scenario_continue` event lets the host advance after a safe result; it does not emit another completion or an exit. No package writes storage or calls a production API.

Lesson and topic IDs are proposed local keys: map them to Lane's actual content registry before integration. The final human handbook review is still pending for every scenario. Official California DMV source sections and scene-specific checks are documented in the manifests and READMEs.

## Asset provenance

All visuals are original code-generated geometry. No user-provided screenshots, logos, catalog PDFs, third-party art, videos, textures, or font files are redistributed. Babylon.js is the only runtime dependency, used only by the three 3D packages. There are no GLB or GLTF files. Screenshots capture the generated scenes. Each package carries source/license notes; retain dependency licenses when distributing compiled builds.
