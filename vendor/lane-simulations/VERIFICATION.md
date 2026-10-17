# Verification record · V4

Verified 2026-10-15 in the separate simulation workspace.

## Executed checks

- All ten `npm run build` commands pass TypeScript, standalone Vite, and portable ES-module builds.
- Root browser suite: **116 passed**, including every choice at both **360 × 800** and **390 × 844**.
- Independent package suites: **76 passed** across all ten folders. Each suite runs its own standalone Vite server.
- Screenshot commands regenerate all ten 390 × 844 interaction images and scene-only thumbnails at 2× capture scale. Captures are buffered before writing assets so development hot reload cannot interrupt them.
- Visual review includes ready, active QTE, wrong consequences, safe outcomes, and the three real WebGL thumbnails. Specific checks covered the roundabout safe spacing, railroad gate clearance, emergency shoulder, pedestrian and bicycle framing, freeway mirror, and yellow-light late-braking skid.

## Behavior covered

The tests verify required countdowns, 8% world motion during decisions, active elapsed time, every action, safe Continue without Retry, wrong Retry without Continue, timeout consequences, visible impact markers, exit cancellation, catalog advancement, fallback, failed scene imports, WebGL unavailability/context loss, loading artwork before JavaScript, keyboard access, reduced motion, and destroy/remount cleanup.

Layout assertions cover both primary phone sizes plus 320 × 568, 375, 414, and 768-pixel widths. They check viewport fit, no document scrolling, visible controls, and tap-target sizes. Geometry regressions sample all seven safe overhead paths for vehicle separation, all unsafe overhead actions for contact, and every overhead action for continuity at selection. Production standalone builds and portable library imports are exercised for all ten packages.

These checks use desktop Chrome at mobile-sized viewports. Physical iOS/Android devices have not been tested. Safe-area CSS is included; native browser chrome and device performance still need a device pass. The 20–45 second total experience is a target including reading and reflection, not a measured user-study result.

## V4 follow-up

- The motorcycle begins behind the car, approaches the blind spot, then moves gently forward and back. Lane dashes and roadside markers move backward relative to both vehicles, including during slow motion.
- Both pedestrian scenes stop translation and gait at the sidewalk. The 3D pedestrian completes the crossing at the near sidewalk corner.
- The activity fills the mobile stage. QTE panels reserve their own space; the renderer resizes above them. Start/Continue/Retry sit below the stage. A compact semicircle displays illustrative relative speed, not calibrated mph.
- All overhead approach and safe-outcome actor bounds are sampled to prevent clipping. Safe vehicle endpoints stay visible. Extended road geometry fills tall viewports, and impact markers remain aligned when the viewport resizes.
- New regression checks cover the bike approach and forward/back motion, road direction, pedestrian stopping in 2D/3D, actor framing, and overlay clearance. Existing layout checks now also assert that controls never overlap the rendered activity and the primary button remains below the stage.

## Earlier V3 changes

- Removed marketing headings, redundant labels, explanatory footers, and the optional-timer mode. The index contains only simulation blocks.
- Added visible ready/loading posters, required countdown, continuous slow motion, and immediate branch-specific cartoon impact/near-miss results.
- Correct answers advance through Continue. Incorrect answers and timeout permit Retry. Exit remains Review Later and cancels pending completion.
- Reworked plausible choices and direct misconception-focused feedback across all ten scenarios.
- Rebuilt portrait overhead geometry, recognizable pedestrians, relative roadway motion, symmetric emergency shoulders, and railroad gate timing.
- Retained driver-seat 3D, captions, and mirror; improved freeway geometry, pedestrian gait, bicycle orientation, signals, braking, collision framing, and camera consequences.

## Packaging and integration

The ten source folders remain independent. Upload archives contain source, lockfiles, manifests, screenshots, tests, and documentation; dependencies, generated builds, test output, obsolete unused SVG helpers, and internal generators are excluded. Archive integrity and file contents are checked after generation. No production Lane repository was changed.

All packages retain `startScenario(container, {onComplete, onRetry, onExit})`. Optional `onContinue(result)` and the `scenario_continue` event support advancing the host flow. Results retain exactly five fields. Timeout now records an unsafe attempt with the reserved action `timeout`; it is not mastery.

Scene modules load on demand in all packages. Keep the complete `dist-lib/` directory when using compiled output. Babylon produces large-chunk warnings in the three 3D builds; these builds pass. The host can share Babylon through source integration and should dispose scenes when recycling cards.

All 2D visuals and 3D geometry are original code. No GLB/GLTF, videos, textures, downloaded artwork, or font files are included. Each README documents asset provenance and dependency licenses.

## Content review

Official DMV source sections were checked on 2026-10-15 and remain linked in every README and manifest. Final human review of wording, scenario assumptions, and illustrative consequences remains pending. The animation is not calibrated vehicle physics. Lesson/topic identifiers must be mapped to Lane’s production registry during later integration.
