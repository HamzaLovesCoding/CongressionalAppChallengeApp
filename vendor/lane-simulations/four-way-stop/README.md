# Four-Way Stop: Who Goes First?

Portable portrait web component · `four-way-stop` · 2d · manifest version 4.

## What the learner does

You and the blue car stop together. The gray car arrives later. The learner watches a 1.8-second approach, then chooses within 5 seconds while action continues at 8% simulation speed. The countdown measures real active seconds. Choosing resumes the consequence at normal speed, from the exact current positions.

Safe choice: **Let the blue car go first**. Safe outcomes show Continue. Wrong choices show non-graphic cartoon contact or a near-miss/skid marker, direct branch-specific feedback, and Retry. Timeout follows `go-first` visually and records an unsafe attempt with `chosenAction: 'timeout'`. These are illustrative consequences, not a claim that every real mistake inevitably causes a crash.

## Run and verify

```sh
npm ci
npm run dev
npm run typecheck
npm run build
npx playwright install chromium
npm test
npm run screenshot
```

Node 22.12+ or a compatible newer release. On Linux, `npx playwright install --with-deps chromium` installs browser dependencies. If Chrome is already installed, use `PLAYWRIGHT_CHANNEL=chrome npm test` and `PLAYWRIGHT_CHANNEL=chrome npm run screenshot`.

`dist/` is the standalone site; `npm run preview` serves it. `dist-lib/four-way-stop.js` is the portable ES-module entry. Keep the **entire `dist-lib/` directory** when using a build: scenes load as sibling chunks. The screenshot command runs a temporary server on 4174 and creates `screenshot.png` at 390 × 844 CSS pixels plus a scene-only `thumbnail.png`.

## Integration interface

```ts
import {startScenario} from './four-way-stop/src/index';
const handle = startScenario(container, {
  onComplete(result) {
    // Record the attempt. Only result.success can count as mastery.
    // Keep the component mounted to let the learner read the result.
  },
  onRetry() { /* A new timed attempt has started. */ },
  onExit() { /* Review Later; close the host screen. */ },
  onContinue(result) { /* Advance the existing app flow. Optional addition. */ }
});
// Call when removing or recycling the host card:
handle.destroy();
```

`onComplete`, `onRetry`, and `onExit` retain the original interface. `onContinue` is optional; the corresponding `scenario_continue` DOM event also supports hosts using events. Source imports require Vite-compatible inline CSS and JSON imports. Styles are scoped with Shadow DOM. No backend, routing library, storage, login, or production key is required.

Every completion result has exactly `scenarioId`, `topicId`, `success`, `chosenAction`, and `elapsedSeconds`. IDs are `four-way-stop` and `all-way-stop-right-of-way`. `chosenAction` is a manifest action ID, or the reserved value `timeout`. Elapsed seconds include the approach and decision, exclude hidden/offscreen time, and exclude the consequence.

| Learner action | Callback and event |
| --- | --- |
| Start | `scenario_started`, detail `{scenarioId}` |
| Safe consequence ends | `onComplete(result)` with `success: true`, then `scenario_completed` |
| Wrong choice or timeout reaches consequence | `onComplete(result)` with `success: false`, then `scenario_completed` |
| Retry | New `scenario_started`, then `onRetry()` and `scenario_retry_requested` |
| Continue after safe result | `onContinue(result)` if provided, then `scenario_continue`; disposes the instance; no second completion or exit |
| Exit | `onExit()` and `scenario_exited_to_review_later`, detail `{scenarioId,topicId}`; cancels pending completion and disposes the scene |
| Host `destroy()` | Silent, idempotent cleanup; no learner event |

Events bubble from the mounted element through the supplied container. Use callbacks **or** DOM events for recording, not both. A callback that destroys the instance suppresses subsequent event dispatch. Mounting another instance in the same container disposes the previous one without removing unrelated host children.

The standalone demo records events in `window.laneDemoEvents` for tests only. In the local block list, Continue opens the next simulation, and Exit returns to the list. Standalone Continue shows Complete; Exit shows Practice closed. Neither is stored or uploaded.

## Portrait and loading behavior

Targets: 360 × 800 and 390 × 844. The activity fills a single portrait stage. A compact prompt/countdown/choices panel appears inside it; the renderer shrinks into reserved space above that panel so road context stays unobscured. Start, Continue, and Retry sit below the stage. A small semicircular gauge shows relative illustrative vehicle speed, without claiming calibrated mph. No decision scrolling or keyboard is required. The top and bottom include safe-area padding. An embedded host can set `--scenario-height` to its available card height. For short screens the controls compact while retaining at least 44-pixel targets.

A static poster and loading label appear before JavaScript. The component retains an image until its scene is ready. Failed scene imports and unavailable WebGL keep a visible fallback and usable choices. Scene loading has an eight-second fallback deadline. Hidden tabs and offscreen cards pause all active clocks. Reduced motion removes impact shake and camera sweep; the required timer remains.

## Assets and license status

- `src/scene.ts`: original SVG scene, vehicle shapes, pedestrian drawing, and animation paths.
- `src/styles.css`: original UI and non-graphic spiky impact symbol styling; impact SVG markup is in `src/index.ts`.
- `thumbnail.png`: original scene capture; also the loading poster.
- `screenshot.png`: original full portrait interaction capture.
- System fonts only. No downloaded fonts, branded art, catalog PDF, user screenshots, textures, videos, GLB, or GLTF files are redistributed.
- No runtime dependency. Development tools retain their own licenses.

## VS Code Cloud handoff

Upload this scenario’s complete source folder from its upload ZIP, run `npm ci` and the commands above, then import `startScenario` into the existing app. Map `all-way-stop-right-of-way` and related lesson `all-way-stop-right-of-way` to Lane’s production content registry. Preserve separate safe/unsafe attempts, timeout, Continue, Retry, and Review Later semantics. Dispose instances when recycling feed items. No production Lane repository has been edited.

The authoritative upload includes `.gitignore`, this README, `scenario-manifest.json`, both PNGs, `package.json`, `package-lock.json`, `index.html`, `tsconfig.json`, `vite.config.ts`, `vite.lib.config.ts`, `playwright.config.ts`, `tokens.css`, `src/`, `tests/scenario.spec.ts`, and `scripts/screenshot.mjs`. Exclude `node_modules/`, build outputs, test outputs, and the unused legacy `src/svg.ts` file.

## California handbook review

Source: **Section 7 · Right-of-Way Rules · Intersections** — https://www.dmv.ca.gov/portal/handbook/california-driver-handbook/laws-and-rules-of-the-road/

Source checked 2026-10-15. Final human review remains pending for the wording, scenario assumptions, timing, stopping distances, emergency-vehicle behavior, and graphical consequences against Lane’s chosen handbook edition. The compressed animations are educational illustrations, not calibrated vehicle physics. Production lesson/topic mappings also require integration review.
