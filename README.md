# Lane (Roadloop app)

Swipe through full-screen driving lessons. When a clip ends, it pauses and a one-
or two-question sheet opens over that clip. Answer feedback and the next step stay
on the same screen.

- **Feed** (`src/feed/`): native vertical swiping and scroll snapping. Source video
  playback uses its actual `ended` event. No footage is bundled yet, so timed
  eight-second Lane-style posters stand in. To add a bundled video, put it in
  `public/videos/` and set the lesson's `video` path in `src/feed/clips.ts`.
  A failed video falls back to its poster. A wrong answer can be retried.
- **Practice**: only the yellow-light lesson offers the existing Amber simulator,
  because that is the scenario currently implemented. The other lessons continue
  to the next clip.
- **Progress** (`#/progress`, via the top-right lesson counter): XP, streak, weekly
  bars and weakest topic, stored in `localStorage` on the device.
- **Routes** are hash-based so every screen works offline from the one precached page:
  `#/feed/:clip[/quiz]`, `#/drive[/:clip]`, `#/progress`. The old answered route
  opens the on-feed quiz for existing bookmarks.
- The simulator loads lazily (Babylon is ~1 MB), and **Feed** or `Esc` leaves it for
  the next clip.
- The Lane design uses IBM Plex fonts and navy, butter, red, paper, and ivory colors
  across the feed, progress screen, and simulator controls.
- Lessons play as short rounds: a compact XP/streak HUD, question checkpoints,
  pressed-button feedback, and a brief round-clear animation. Results show actual
  XP earned and first-try answers for that attempt; replaying a completed round
  awards no extra XP. Animations respect reduced-motion preferences.
- The progress screen has a selectable route through all five rounds. Rounds stay
  available in any order, and retries have no timer or penalty.

# Amber — Driving Lab

A self-contained TypeScript + Babylon.js prototype of a single driver-education
moment: you approach a suburban four-way intersection, the light turns amber, and
you choose to brake or continue. Either choice plays out in 3D and then opens an
overhead replay you can scrub.

Built for a phone. Portrait and landscape are both first-class.

## Run it

```sh
npm install
npm run dev       # http://localhost:5173
```

The feed opens at `/`; the simulator is at `/#/drive`.
`npm run build` type-checks and produces a static bundle in `dist/`.
`npm run preview` serves that bundle.

## Controls

Tap the on-screen buttons, or use the keyboard:

| Key | Action |
| --- | --- |
| Hold `B` | Gentle braking; release to coast |
| Hold `Shift+B` | Firm braking |
| `G` | Continue |
| `C` | Switch camera (driver / overhead) |
| `R` | Retry |
| `Space` | Pause, or play/pause the replay |

On touchscreens, hold **Hold to brake**, slide upward for firmer braking, and
release to coast. A steady gentle hold retains the original ~7 m margin. Late
or interrupted braking can overrun the line or leave the car moving at the end
of the 6.5-second recording. The replay and distance strips use the recorded
motion, including those unsuccessful stops. A screen reader's virtual activation
toggles the brake; focused-button Space/Enter can also be held.

Sound starts with your first gesture. Use the **Sound** button to mute/unmute;
the preference is saved locally when browser storage is available. Engine, tyre
roll, decision chime, and near-miss horn are synthesized with WebAudio. Pausing
silences the scene; backgrounding suspends audio and rendering. Tap after returning
if Safari needs another gesture to resume sound.

Open `/?perf=1#/drive` for an FPS / mesh-count overlay and a **Device measurements**
panel, including in a production preview. It records first-frame latency,
per-phase wall-clock FPS, and early/late samples for a two-minute phone test.
See [the device procedure](artifacts/DEVICE-TESTING.md). Desktop SwiftShader FPS
is not a physical-phone benchmark. `window.__amber.snapshot()` is DEV-only.

## Where the code lives

| Path | What it does |
| --- | --- |
| `src/scene/createScene.ts` | Engine, lighting, render loop, resize and visibility handling |
| `src/scene/lighting.ts` | Vertex-gradient sky, feathered contact shade, focused sun shadows |
| `src/scene/scenery.ts` | Roads, kerbs, markings, buildings, trees, street furniture |
| `src/scene/vehicles.ts` | Low-poly vehicle meshes and ambient traffic |
| `src/scene/signals.ts` | Traffic signal heads and lamp state |
| `src/scene/cameras.ts` | Driver cockpit framing and the overhead replay camera |
| `src/scene/replay.ts` | Distance annotations and vehicle highlights |
| `src/scenario/scenario.ts` | State machine, braking physics and recorded replay |
| `src/audio/drivingAudio.ts` | Gesture-unlocked procedural WebAudio and mute |
| `src/scene/performance.ts` | Opt-in local frame measurements |
| `src/ui/controls.ts`, `src/style.css` | Mobile UI |
| `src/main.ts`, `src/drive.ts` | Hash router; lazy simulator mount and exit |
| `src/feed/` | Lane feed and quiz sheet, progress screen, local progress store |

## Browser walkthrough

`scripts/inspect.mjs` drives the running app in headless Chromium at 390×844 and
844×390 using installed full Chromium and SwiftShader. It exercises both outcomes,
touch hold/release/cancel/drag, keyboard braking, replay controls, audio unlock/mute
and one-shot cues. It checks frame-independent stopping, runtime annotations and
incomplete stops, fails on page/console errors, and writes screenshots and clearly
labelled desktop telemetry to `artifacts/`. Original images are in `artifacts/baseline/`.

```sh
npm run dev                      # in one terminal
npm run inspect                  # both viewports
npm run inspect -- portrait      # one viewport
CHROMIUM=/path/to/chrome npm run inspect
npm run build && npm run preview # in another terminal for the production check
PRODUCTION=1 npm run inspect     # production UI, mute persistence and rotation
npm run inspect:feed             # production rounds, XP, simulator handoff, offline
```

See [CREDITS.md](CREDITS.md) — no external assets are used.
