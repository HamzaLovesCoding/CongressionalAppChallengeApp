# Lane

Instructions for coding agents (Claude Code and Codex) working in this repo.
`AGENTS.md` is a symlink to this file. Edit `CLAUDE.md` only.
Visual design rules live in `DESIGN.md`.

## What Lane is

A phone-first, casual alternative to social media for teens who plan to drive or are already learning to drive. Lane uses a satisfying short-form feed, but turns scrolling time into useful driving knowledge. Built for the Congressional App Challenge.

The short **videos are driving lessons**: they teach practical, real-world driving situations and safer decisions. The feed’s **permit-test posts, handbook cards, and knowledge checks** focus on California written permit-test preparation. When a lesson clip ends, a one-question check opens over it. Some important lessons also have an optional 3D driving simulator to practice the moment.

- **User:** teens before their permit, roughly 14–16.

- **Rules source:** the California Driver’s Handbook and California DMV Quick Reference Handbook. Every rule and correct answer must match the applicable handbook guidance. Use US English and US driving terms (curb, tire, yield). Fix current UK wording such as “give way” and “kerbs” only as part of the relevant content edit.

- **Language:** English only. Keep user-facing lesson text in data files, not scattered through code.

- **Design:** read `DESIGN.md` before UI work. The accepted visual baseline is the soft green, rounded home screen in `src/home/`; extend it across the app as each screen is requested. This supersedes the older indigo/red, square-control styling for future designs. Do not replace it with a generic dashboard, card grid, or unrelated design system.

## Status: what exists vs. what’s planned

Don’t assume a planned feature exists. Check the code.

**Built now:** the green home screen with working Home / Feed / Practice / Progress / Profile navigation; a minimal green feed of 5 lessons with decorative animated posters instead of video, a bottom title, like/bookmark/share controls, and a small visible-session timer; the rounded green quiz sheet; XP, a streak, a daily goal, weekly bars, likes and saves (stored in localStorage through the progress store); one simulator scenario (yellow light); the feed's lesson-summary screen; hash routing; and an offline service worker. The Practice, Progress, and Profile tabs are intentionally blank. Home now uses Lane copy, real XP/streak/completion, the next unfinished lesson, native progress bars, editable daily XP goals, a lesson picker, and saved-lesson access. Lesson data remains in `src/feed/clips.ts`.

**Planned, roughly in order:**

1. 30 video lessons, each with one handwritten question, grouped into units by handbook chapter.

1. A mock permit test drawn from a separate question bank. The bank is based on DMV practice tests, but in our own wording.

1. 10+ simulator scenarios built on shared scenes (see Simulator).

1. Saves become a “review later” list. Keep the feed's like/bookmark/share rail, as requested in the current design.

1. Onboarding → required Supabase sign-in → videos. Leaderboards use friend or class codes. This step is **built last**, but it’s the app’s front door, so don’t design anything that assumes users are signed out forever.

1. Maybe later: a Capacitor wrapper for the app stores.

Deadline: **TODO**. Team and content owner: **TODO**.

## Stack

Vite + plain TypeScript (no UI framework) + Babylon.js (`@babylonjs/core`, pinned to 9.27.1). It’s an installable web app (PWA) with a hand-built service worker. This project-specific stack overrides generic defaults: don’t suggest or perform a migration to Next.js, React, Zustand, Dexie, tRPC, Drizzle, or another framework/store. Supabase is still the planned backend.

No new runtime dependencies without asking first. Babylon is already about 1 MB and is lazy-loaded for that reason.

**Scope rule:** make the smallest local change that delivers the requested feature. Do not use a feature or design request as a reason to restructure the app, replace the router, rename storage keys, or do unrelated cleanup. If a small refactor is truly required, explain why it is required and preserve existing behavior before adding new behavior.

## Layout

| Path | What it does |
| --- | --- |
| `src/main.ts` | Hash router: home and blank tabs, `#/feed/:clip[/quiz]`, `#/drive[/:clip]`, `#/lesson-progress`; registers the service worker in production only |
| `src/home/home.ts`, `home.css` | Functional home with live progress, lesson shortcuts, goal editor, and saved lessons; copy in `content.ts`, selection logic in `model.ts` |
| `src/home/tabs.ts`, `icons.ts` | Shared Home / Feed / Practice / Progress / Profile bar, blank tab views, and home icons; full-screen feed uses a Home return control |
| `src/navigation.ts` | `View` type and `go()`. Use `replace` for automatic redirects so Back doesn’t bounce |
| `src/drive.ts` | Lazy-loads the simulator and its CSS; exit returns to the next clip |
| `src/feed/clips.ts` | Lesson data (questions, answers, explanations, poster, `video`, `simulator`) |
| `src/feed/feed.ts`, `feed.css`, `minimal.css` | Feed UI and quiz sheet; scoped green overrides keep the media view minimal. HTML is built from template strings. Escape all data with `esc()` |
| `src/feed/poster.ts`, `scrollTimer.ts` | Decorative media fallback and visible-time counter for the current feed visit |
| `src/feed/progress.ts` | The only progress store: XP, streak, daily totals, saves/review-later items |
| `src/feed/screens.ts` | Existing lesson summary at `#/lesson-progress`, separate from the blank Progress tab |
| `src/scenario/scenario.ts` | Yellow-light state machine, braking physics, replay recording |
| `src/scene/*` | Babylon scene: engine, lighting, scenery, vehicles, signals, cameras, replay overlay, perf overlay |
| `src/ui/controls.ts`, `src/style.css` | Simulator UI |
| `src/audio/drivingAudio.ts` | WebAudio sounds generated in code; unlocked by the first user gesture |
| `src/sw.js` | Service worker template; `vite.config.ts` fills in the precache list at build time |
| `scripts/inspect*.mjs` | Playwright walkthroughs that take screenshots |
| `public/` | Icons, manifest, self-hosted IBM Plex fonts and their license (`ibm-plex-OFL.txt`, which must stay) |

## Rules

**Content (questions, answers, explanations)**

- Agents may draft new questions only when they are marked in the lesson data with `draft: true` and a handbook reference, for example `source: 'California Driver’s Handbook — Right-of-Way section'`. A human approves a draft before it ships.

- Don’t change a rule or correct answer in approved content without citing the handbook. A wrong answer is the worst bug this app can have.

- Don’t copy DMV practice-test wording word for word. Rewrite it.

**Learning flow and tone**

- When a video reaches its real `ended` event, open the one-question quiz sheet over it. A user cannot silently scroll away from an open quiz: they answer, use the three-dots menu, or complete the required key-video action.

- If a user skips before the important rule segment, show a supportive safety gate before the next lesson. They can answer the question, watch the important part, or choose Review Later. Use wording such as: “This rule may appear on your permit test and can matter in a real driving situation.”

- The three-dots menu must support **I already know this**, **Review later**, and **I need help**. “I already know this” gives a harder confirmation question; a correct answer allows the lesson to be skipped because the learner proved the rule. “Review later” adds the item to daily review instead of removing it forever. “I need help” shows the relevant explanation, key video section, or practice option.

- A wrong answer or a score below 60% uses a supportive correction flow: explain the rule, then ask a similar—not identical—question. If the learner misses again, require a useful recovery action such as rewatching the relevant segment or completing a short activity (right-of-way selection, hazard tap, sign match, or safe-following-distance choice).

- Do not shame or punish learners. Never use “You failed” or “You are locked.” Prefer phrases such as “Almost. Here is the rule that changes the answer,” “Quick safety check before the next lesson,” “Nice, you proved you already know this,” and “You are getting closer to being permit-test ready.”

- Interactive activities and simulators are optional practice. If a learner exits one, add it to Review Later; do not treat it as completed mastery.

- Daily review should include material from today, one day ago, two days ago, skipped/review-later items, and weak topics. Start with an in-app review flow. Push notifications require a separate, explicit implementation and user consent.

**Progress and accounts**

- All progress reads and writes go through `src/feed/progress.ts` (or whatever explicitly replaces it). Never touch `localStorage` for progress from feature code. That module is the seam where Supabase gets swapped in later.

- Users are minors. When Supabase lands, store only what a feature needs, and show nicknames only on leaderboards.

**Video**

- Videos live in `public/videos/` and are referenced by each lesson’s `video` field. The quiz opens on the video’s real `ended` event. A video that fails to load falls back to its poster.

- Exclude videos from the service-worker precache and cache each one the first time it’s watched. The current `vite.config.ts` precaches everything in `dist/`, so this has to change before the videos are added.

- Every video needs a recorded source and license. **TODO: record where the Drive videos came from and where the credits list lives.** Don’t add a video whose source you don’t know.

**Simulator**

- Target: a few reusable 3D locations plus a config per scenario (signals, other traffic, decision point, what counts as safe). The yellow-light scenario is currently hard-coded and needs refactoring into that shape before scenario #2. Don’t add a second hard-coded scenario.

- Sims are optional, offered after the quiz. A lesson never requires one to count as done.

- Performance floor: **TODO: confirm the oldest supported phone** (proposed: iPhone 13). Software-rendered FPS from the inspect scripts doesn’t tell you how a real phone performs.

**Offline and later Capacitor**

- Keep hash routing. Every screen must load from the single cached `index.html`.

- Core features must work without the service worker. Capacitor’s WebView doesn’t treat service workers the way a browser does.

## Verify before calling a change done

1. `npm run build`: type-check plus bundle. Must pass.

1. Logic tests with Node’s built-in runner (`node --test`), for pure logic such as streak, XP, review selection, and mock-test scoring. **None exist yet.** Add them alongside any logic you change, with no test-framework dependency.

1. Whenever the UI changes, run the matching walkthrough and look at the screenshots:
  - Home/tabs: run `npm run build && npm run preview`, then `node scripts/inspect-home.mjs`.
  - Simulator: run `npm run dev`, then `npm run inspect` (optional `portrait`/`landscape` arg). For the production build: `npm run build && npm run preview`, then `PRODUCTION=1 npm run inspect`.
  - Feed: `npm run build && npm run preview`, then `npm run inspect:feed`.
  - Screenshots and logs go to `artifacts/`, which is gitignored. The Chromium path is hard-coded to this Mac. Override it with `CHROMIUM=...`.
  - `?perf=1` shows the FPS and device-measurement overlay.

1. Before reporting completion, say exactly what was implemented and what remains future work. Do not present placeholders, unverified video licensing, draft handbook content, or simulator concepts as completed production features.

## Known leftovers

Don’t fix these unless asked:

- Old names in code: package `amber-driving-lab`, cache prefix `amber-`, storage keys `amber-muted` and `roadloop-progress`. Renaming a storage key wipes existing saved data.

- `liked` is retained in the progress store and powers the feed's like control, per the current design request.
