# 01 — Current system map

Observed in code on 2026-10-15 at `main` `6c9e37e` (branch `lane-integration`). This describes what exists, not what is planned.

## Stack and commands

- Vite 8.3 + TypeScript 7.0 (plain DOM, no framework) + `@babylonjs/core` 9.27.1 (only runtime dependency). Hand-built service worker. Package name `amber-driving-lab`.
- Scripts: `dev`, `build` (`tsc --noEmit && vite build`), `preview`, `inspect`, `inspect:feed`. **No lint script and no linter installed.** Typecheck runs inside `build`.
- Tests: `node --test scripts/*.test.mjs`, no framework.

### Baseline results (before any change)

| Command | Result |
| --- | --- |
| `npm run build` | exit 0; one warning: `createScene` chunk 1,004.81 kB (Babylon, already lazy-loaded) |
| `node --test scripts/*.test.mjs` | 47 tests, 47 pass, 0 fail (139 ms) |
| `node scripts/inspect-baseline.mjs` | 55 screenshots, no page errors, no horizontal overflow (see 00) |

Inspect scripts hard-code Chromium at `/Users/hamza/...`; on this Mac pass `CHROMIUM=~/Library/Caches/ms-playwright/chromium-1248/.../Google Chrome for Testing`.

## Routes (`src/main.ts`)

| Hash | View | Notes |
| --- | --- | --- |
| `` / `#/home` | `mountHome` | App launch lands here for everyone |
| `#/progress` | `mountLearningPath` | Highway road |
| `#/feed[/:clip[/quiz]]` | `mountFeed` | Default for any unknown hash |
| `#/answered/:clip` | `mountFeed` with quiz | Legacy alias |
| `#/practice`, `#/practice/test` | Practice intro / test | |
| `#/profile` | `mountProfile` | Garage-only |
| `#/lesson-progress` | `mountProgress` | Lesson summary |
| `#/drive[/:clip]` | `mountDrive` | Lazy Babylon yellow-light simulator |

Not present: `#/review`, `#/emergency`, `#/sim/...`, settings, credits, privacy, terms.

## Modules

| Area | Files | Role |
| --- | --- | --- |
| Shell | `main.ts`, `navigation.ts`, `theme.css`, `motion.css`, `ui.css` | Router, view transitions, tokens, shared components, SW update-on-launch |
| Home | `home/home.ts`, `content.ts`, `model.ts`, `sheet.ts`, `strip.ts`, `spring.ts`, `tabs.ts`, `icons.ts`, `leaderboard*.ts` | Next-lesson sign, week strip, goal sheet, lesson strip, menu sheet, local leaderboard |
| Feed | `feed/feed.ts` (385 lines), `clips.ts`, `curriculum.ts`, `poster.ts`, `scrollTimer.ts`, `screens.ts`, `minimal.css`, `feed.css` | Vertical lesson feed, quiz drawer, About sheet, share, video cache on `ended` |
| Progress | `progress/path.ts`, `road.ts`, `scenery.ts`, `milestones.ts` | Road, signs, car, milestones |
| Profile | `profile/profile.ts`, `cars.ts`, `avatars.ts` (retired art) | Stats, Garage purchases, liked/saved |
| Practice | `practice/practice.ts`, `questions.ts` (46), `score.ts` | Separate permit-style bank, session-only |
| Simulator | `drive.ts`, `scenario/scenario.ts`, `scene/*`, `ui/controls.ts`, `style.css`, `audio/drivingAudio.ts` | Hard-coded yellow-light Babylon scene |
| Store | `feed/progress.ts` (167 lines) | **Sole progress store** |

## Local state

| Key / cache | Owner | Contents |
| --- | --- | --- |
| `localStorage['roadloop-progress']` | `feed/progress.ts` | `xp`, `clips{tries,firstTry,done}`, `daily{date:xp}`, `liked[]`, `saved[]`, `dailyGoal`, `spentXp`, `ownedAvatars`, `selectedAvatar`, `ownedCars`, `selectedCar` |
| `localStorage['amber-muted']` | `audio/drivingAudio.ts` | Simulator sound only |
| Cache `amber-videos-h264` | `feed/feed.ts`, `sw.js` | Each clip after its `ended` event; byte-range served offline |
| Cache `amber-*` precache | `sw.js`, `vite.config.ts` | App shell + posters; videos excluded |

Not present: learner ID, first-session flag, settings (permit date, sound), Review Later, topic mastery, watch history, quiz attempt log, simulation records.

## Content

- `src/feed/curriculum.ts`: 19 video lessons (IDs below), each `draft: true`, with quiz, explanation, handbook `source`, `lesson.category/summary/californiaRule/handbook/local/credit{title,url}`.
- `src/feed/clips.ts`: `Clip` type and 5 original poster lessons (`yellow-light`, `roundabout`, `four-way-stop`, `following-distance`, `school-bus`); feed order is curriculum first. `yellow-light` has two checks and `simulator: true`.
- `public/videos/`: 19 MP4 (H.264/AAC per `CLAUDE.md`, checked by `curriculum.test.mjs`); posters in `public/images/lessons/posters/`.
- Curriculum IDs: `lane-end-scan`, `after-collision`, `emergency-kit`, `front-curb`, `dark-signal`, `emergency-pull-right`, `emergency-right-edge`, `intersection-right-of-way`, `high-beams`, `passing-bicyclist`, `freeway-entry`, `freeway-merge`, `drive-test-readiness`, `blind-spot-check`, `blind-curve`, `blind-bend`, `merging-trailer`, `stopping-distance`, `three-second-check`.
- No glossary, flashcard, permit-post, activity or simulation cards; no emergency reference content; no captions.

## Feed behavior (verified in code)

- Quiz opens on the real `ended` event for video lessons (`feed.ts:335`); poster lessons use an 8 s `DEMO_SECONDS` timer (`feed.ts:374`).
- `canplay`, `error` handlers; spinner after 300 ms of waiting; poster fallback on error; neighbor-only source attachment.
- XP: 10 per first lesson completion (`answer()` ignores repeats). No replay farming in the current store.
- No three-dots menu, no I already know this / Review later / I need help, no similar follow-up, no early-leave gate, no watch-coverage tracking.

## Backend / Supabase

None. No `.env*`, no `@supabase/supabase-js`, no `supabase/` folder, no sync module. The leaderboard renders only the local "You" row with this week's XP; Group and Global tabs show identical data.

## Simulations

- In repo: the yellow-light Babylon scene only (`#/drive`).
- Supplied: `../LANE App Simulations - Codex/Final Lane Simulations/` (identical to `Final Lane Simulations.zip`) — 10 packages, V4. See 05.

## Discrepancies with CLAUDE.md

- CLAUDE.md describes a package result `{ outcome: 'safe'|'unsafe'|'timeout'|'exit', ... }`; the real packages return `{ scenarioId, topicId, success, chosenAction, elapsedSeconds }`. The packages are authoritative.
- CLAUDE.md says "The package ZIP is not in `AppMaterial/`" — still true; it lives one folder above the repo.
