# 05 — Simulation integration map

Source: `../LANE App Simulations - Codex/Final Lane Simulations/` (V4; byte-identical to `Final Lane Simulations.zip`, verified with `diff -rq`). Ten independent Vite + TypeScript packages. Every manifest has `contentStatus: "draft-needs-human-handbook-review"`; that status is kept and shown nowhere as approved.

## Verified package contract (read from `four-way-stop/src/index.ts`; same in all ten)

```ts
startScenario(container, { onComplete(result), onRetry(), onExit(), onContinue?(result) }) → { destroy() }
result = { scenarioId, topicId, success: boolean, chosenAction: string, elapsedSeconds: number }
```

- `onComplete` fires once per resolved attempt, **for both safe and unsafe** choices; timeout → `success:false, chosenAction:'timeout'`.
- `onRetry` restarts the attempt; `onExit` closes without a result; `onContinue` fires only after a safe Continue and then self-destroys.
- Packages write no storage and call no API. Styles live in Shadow DOM. Hidden-tab and offscreen pause are built in.
- Imports: `../scenario-manifest.json`, `../thumbnail.png`, `./config.json`, `./styles.css?inline` — all native to Vite.
- 3D packages (SIM-08–10) declare `@babylonjs/core ^8.0.0` (lock: 8.56.2). Lane pins 9.27.1. All 16 deep-import paths they use exist in 9.27.1; type compatibility will be confirmed by `tsc` during integration. **No second Babylon copy and no new dependency.**

## Mapping to Lane content

| SIM | Package ID | Type | Package topic ID | Lane lesson (stable ID) | Related check | Fit |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | `four-way-stop` | 2D | `all-way-stop-right-of-way` | `four-way-stop` (poster lesson) | "You and another car reach a four-way stop at the same time…" | exact |
| 02 | `unprotected-left-turn` | 2D | `left-turn-right-of-way` | `intersection-right-of-way` (8) | uncontrolled intersection, bicyclist on right | close (same chapter) |
| 03 | `roundabout-entry` | 2D | `roundabout-entry` | `roundabout` (poster lesson) | "entering the roundabout… who has right of way?" | exact |
| 04 | `lane-ends-merge` | 2D | `ending-lane-awareness` | `lane-end-scan` (1) | lane ends ahead, signal/check/merge | exact |
| 05 | `blind-spot-motorcycle` | 2D | `blind-spots-lane-change` | `blind-spot-check` (14) | check blind spot before changing lanes | exact |
| 06 | `emergency-vehicle-yield` | 2D | `emergency-vehicle-right-of-way` | `emergency-pull-right` (6) | "already in an intersection when an ambulance approaches" | exact |
| 07 | `railroad-clear-exit` | 2D | `railroad-crossing-clearance` | **none** — curriculum lesson 23 (railroad) has no video yet | — | **no lesson** |
| 08 | `yellow-light-stop` | 3D | `yellow-light-safe-stop` | `yellow-light` (poster lesson) | "The light turns yellow. You can stop smoothly…" | exact; **overlaps the built-in `#/drive` scene** |
| 09 | `freeway-entrance-merge` | 3D | `freeway-entrance-merging` | `freeway-entry` (11) | "entering a highway from an on-ramp" | exact |
| 10 | `right-turn-scan` | 3D | `right-turn-vulnerable-road-users` | `intersection-right-of-way` (8) | bicyclist at intersection | close |

## Integration design (first version, Slice C; replaced by the in-feed design above/below)

1. **Location:** copy the ten folders (source, manifest, README, thumbnail, tokens, tests for reference; no `node_modules`/`dist`) to `vendor/lane-simulations/<id>/`, untouched. Root preview catalog and harness stay out.
2. **One registry:** `src/simulation/registry.ts` maps package ID → lazy `import()` of `vendor/lane-simulations/<id>/src/index.ts`, Lane lesson ID, topic ID, type. No ten ad-hoc imports in feature code. Babylon loads only when a 3D entry is opened.
3. **One host route:** `#/sim/:scenarioId/:lessonId` — full-screen stage with a Back control, mounts the package, calls `destroy()` on route change. On failure to import or render, the package's own fallback shows; if the import itself fails, the host shows the manifest's fallback text and a Back action.
4. **Offer point:** only on the lesson-complete sheet after the related check, as one optional "Practice this decision" action (the slot that already offers the yellow-light simulator). Never a feed opener.
5. **Result handling (adapter, unit-tested first):**

| Event | Recorded | XP / mastery | Review Later |
| --- | --- | --- | --- |
| `onComplete`, `success:true` | `safe`, chosen action, seconds | practical-decision evidence; **no lesson XP** (lesson XP already came from the check) | resolve the sim's review item if present |
| `onComplete`, `success:false`, action ≠ `timeout` | `unsafe` | support evidence only | upsert |
| `onComplete`, `chosenAction:'timeout'` | `timeout` | support evidence only | upsert |
| `onRetry` | retry count +1 | none | — |
| `onExit` | `exit` | none | upsert (`sim-exit`) |
| `onContinue` | nothing new (no duplicate completion) | none | — | → return to the lesson's next feed position |

## Rebuilt 2026-10-15 evening (owner: sims are not a separate page)

All ten packages now run inside feed cards at `#/feed/sim/:id`; `#/sim/...` and `#/drive` redirect there and `host.ts` was removed. A card shows the rule (from the locked catalog) and "Start challenge"; the package mounts in the card and the feed is locked until Continue (next feed item) or Exit (same card, Review later). Mapping: SIM-01 four-way-stop, SIM-02 intersection-right-of-way (was Review-only), SIM-03 roundabout, SIM-04 lane-end-scan, SIM-05 blind-spot-check, SIM-06 emergency-pull-right, SIM-07 standalone after the 4th lesson, SIM-08 yellow-light, SIM-09 freeway-entry, SIM-10 passing-bicyclist (was lesson 8). A challenge stays in the plan until the learner makes the safe choice; a returning learner's refresher slot can be a challenge instead of a video. Verified: `inspect-simulations.mjs`, all ten in the feed.

## Decisions and status before the rebuild (2026-10-15, superseded above)

- SIM-08 **replaces** the built-in simulator (owner). `#/drive` redirects to `#/sim/yellow-light-stop/…`; the old Babylon scene, controls and audio are deleted.
- SIM-07 and SIM-02 are offered from `#/review` ("More practice"); SIM-10 follows lesson 8.
- Vendored to `vendor/lane-simulations/` (runtime files only, unedited; `SOURCE.md`). One registry, one host, one adapter.
- **Verified in Lane** (`scripts/inspect-simulations.mjs`, Chromium 390×844): all 10 load, safe → Continue to the expected destination with one record, unsafe → Retry → timeout → Exit records `unsafe, retry, timeout, exit`, one Review Later item, 0 XP, no page errors. A 3D package without WebGL shows its own "Scene unavailable" fallback. Unit tests: registry ↔ manifests, outcome adapter.
- **Not verified:** physical iOS/Android devices; WebKit for the 3D packages (the phone matrix covers the sim offer, not every package).
