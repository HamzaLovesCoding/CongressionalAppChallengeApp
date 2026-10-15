# Lane

Instructions for coding agents (Claude Code and Codex) working in this repo.
`AGENTS.md` is a symlink to this file. Edit `CLAUDE.md` only.
Visual design rules live in `DESIGN.md`.

## What Lane is

A phone-first, casual alternative to social media for teens who plan to drive or are already learning to drive. Lane uses a satisfying short-form feed, but turns scrolling time into useful driving knowledge. Built for the Congressional App Challenge.

The intended short **videos are driving lessons**: they teach practical, real-world driving situations and safer decisions. California permit-test preparation is one part of Lane, not its whole identity. The feed opens with 19 licensed curriculum video lessons; the five original lessons after them still use decorative placeholders. When a lesson ends, its knowledge checks open over the same screen. The yellow-light lesson also offers optional 3D driving practice.

- **User:** teens before their permit, roughly 14–16.

- **Rules source:** the California Driver’s Handbook and California DMV Quick Reference Handbook. The curriculum in `AppMaterial/` cites the *California Quick Reference Driver’s Handbook (DL 600X, 2025)* by section and page; use that edition’s page numbers in `source` fields unless a newer edition replaces it. Every rule and correct answer must match the applicable handbook guidance. Use US English and US driving terms (curb, tire, yield). Fix current UK wording such as “give way” and “kerbs” only as part of the relevant content edit.

- **Language:** English only. Keep user-facing lesson text in data files, not scattered through code.

- **Design:** read `DESIGN.md` before UI work. The October 12 rebuild uses the supplied Lane logo, earthy cream and near-black surfaces, restrained ochre, strong control boundaries, rounded mobile controls, and driving imagery. It replaces both the soft-green baseline and the rejected overly minimal, square-control pass. The rebuilt screens are implemented for review; do not imply final user approval or competition readiness. Rationale and earlier misses are in `docs/design/rebuild-decisions.md`.

- **User's visual constraints:** keep sections on one plane rather than stacking bordered cards. Home has one next-lesson action, compact progress, lesson links and the weekly leaderboard. Saved lessons sit beside liked lessons on Profile (owner direction, October 13, 2026). No decorative Home mascots, permit-prep eyebrow, greeting slogan, separate goal card, or cluttered statistics. The learning path is a highway with a car tracking progress. Profile is Garage-only (owner direction, October 14, 2026); the selected collectible car appears in its hero and on Progress. Avatar shopping and character portraits are retired. Preserve all five navigation destinations; their presentation and order can be redesigned. Avoid comparative parallelism, marketing sublines, and companion/journey slogans. Do not turn the app into a generic dashboard or a bare website.

## Status: what exists vs. what’s planned

Don’t assume a planned feature exists. Check the code.

**Built now:**

- Home with the original wordmark, the next unfinished lesson, compact real completion/daily XP, editable goals, lesson picker and Group/Global weekly leaderboard tabs. Only the local user's real weekly XP and a neutral profile icon ship; no online competitors or ranks exist. All-complete state links to Practice.
- Five working destinations, ordered Home / Progress / Feed / Practice / Profile. The full-width bottom bar puts Feed in the center. Full-screen feed and test flows have their own return controls.
- 24 feed lessons with like/bookmark/share, a visible-session timer, and same-screen knowledge checks. Curriculum lessons 1–19 come first, each with a real video. Each shows its category and title over the clip, a collapsed California rule dropdown with the handbook citation and About this lesson sheet (summary, rule with handbook page, Novato context, original-video credit), and its one quick check, which opens on the real `ended` event and cites the handbook after answering. Their quiz text is `draft: true`. The five original poster lessons follow; the yellow-light lesson has two checks. Data lives in `src/feed/curriculum.ts` (video lessons) and `src/feed/clips.ts`.
- Progress as a winding road with the car selected in Profile’s Garage at the next unfinished lesson (rebuilt October 14, 2026 for review): a compact trip panel with a car-on-track meter and milestone pins, one aligned column of lesson signs, the next lesson as Home’s dark sign with a direct Start action, and milestones standing by the road. The selected SVG car is read from the progress store on each render. It moves when returning after completing a lesson, respects reduced motion, and parks at the final stop when all are complete. It draws all 24 lessons as one long unit; splitting them into units is future work.
- Profile with a dark identity surface and selected-car shortcut, one row for total XP/spendable XP/streak/days, and first-try accuracy. A Garage-only three-column collection has item bottom sheets, purchase confirmation and the existing spendable-XP pool. Six detailed, toy-like top-down SVG cars (Hatchback included; Sedan 15, Wagon 25, Pickup 35, Minivan 45, Classic coupe 60 XP) cost 180 XP in total, against 240 lifetime XP from 24 lessons. Legacy avatar ownership and spending remain in saved data for compatibility; avatar controls and portraits are removed. Adjacent liked/saved lesson tabs retain counts, lesson links and save removal.
- Practice with a separate 46-question California bank, answer feedback, topic results, restart and leave confirmation. Attempts are session-only and do not award lesson XP. This is an existing practice implementation, not an official DMV test or a newly verified content source.
- Lesson summary, one yellow-light simulator with portrait/landscape controls and replay, hash routing, local progress through the sole progress store, and the offline service worker.

**Planned, roughly in order:**

1. Group the curriculum lessons into units by the curriculum’s categories. Lessons 1–19 are built; supplemental lessons 20–23 have no video file yet. See Source materials.

1. Continue the existing practice-test bank's content review and expand it as needed. Preserve its separate question data and scoring module.

1. 10 simulator scenarios, SIM-01 to SIM-10 in the master plan (see Simulator).

1. Saves become a “review later” list. Keep the feed's like/bookmark/share rail, as requested in the current design.

1. Onboarding → required Supabase sign-in → videos. Leaderboards use friend or class codes. This step is **built last**, but it’s the app’s front door, so don’t design anything that assumes users are signed out forever.

1. Maybe later: a Capacitor wrapper for the app stores.

Deadline: **TODO**. Team and content owner: **TODO**.

## Source materials (`AppMaterial/`)

The owner supplied these planning documents, curriculum files and media. They describe intent and draft content, and none of them proves a feature is built. Where they disagree with this file or `DESIGN.md`, follow this file and tell the owner about the conflict instead of resolving it yourself.

`AppMaterial/` is not gitignored. `Videos.zip` is 156 MB, which is over GitHub’s 100 MB file limit, so never stage it. `pdftotext` and `ffmpeg` aren’t installed, and `python3` and Homebrew need the Xcode license accepted. For video encoding, the `ffmpeg-static` npm binary works when installed outside the project (pass it as `FFMPEG=`). To extract PDF text, use PDFKit. Spacing around the letter “a” comes out scrambled, but the text is readable:

```sh
osascript -l JavaScript -e 'ObjC.import("PDFKit"); function run(a){return $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(a[0])).string.js}' "$PWD/AppMaterial/<file>.pdf"
```

| File | Contents | Use it for |
| --- | --- | --- |
| `Lane-_California_Driver_Education_—_Video_Lessons,_Quizzes_&_Decision_Prompts.pdf` | 51-page deck covering 23 lessons. Each has a California correction, one quick check with its answer and handbook page, and an optional decision-only activity brief | Lesson copy, quiz drafts, activity briefs |
| `California Driver-Education Video Validation and Curriculum Package.pdf` | Per-clip review of the same 23 lessons: California determination, required edits, media-rights status, local crash-data sources and their limits, recommended order | Why each clip needs edits, rights status, local-impact citations |
| `Lane-Master-Features-Design-and-Backend.pdf` | October 12 consolidated plan: owner direction, stable feature IDs (`LN-*`), the SIM-01–SIM-10 catalog, learning model, local-first/backend boundary, build slices, deferred registry (`DEF-01`–`DEF-11`) | Product intent and scope. Cite its IDs when reporting work on a planned feature |
| `Driver App Self-Learning Algorithm.pdf` | Explainable mastery and review-priority formulas | Future learner-model work (summarized below) |
| `Videos.zip` | 19 MP4s. Filename prefixes 1–19 match curriculum lessons 1–19 | Source clips. See Video rules |
| `testappicon.png` | Full logo, 1536×1024, byte-identical to `public/images/brand/lane-logo.png`. The tagline “Learn And Navigate Emergencies” spells LANE | Brand source. `DESIGN.md` and the brand README name a `LANE APP CAC Design Logo.png` that isn’t in the folder |
| `LANE APP CAC Design Logo (40 x 40 px).jpg` | 40×40 wordmark | Tiny sizes only |

**Curriculum.** All sources are on `youtube.com/`. Lessons 20–23 are not in the zip. “No activity” means the curriculum recommends only the quick check. The validation package recommends starting with road awareness, lane changes and space. Intersections and emergency response come next, with 6 and 7 adjacent and 11 and 12 together. Lessons 20–23 form the following module.

| # | Lesson | Source | Notes |
| --- | --- | --- | --- |
| 1 | Scanning ahead for lane-end warnings | `shorts/Y_WfR2eIQHo` | Video says “two blocks”; CA rule is scan 10 s ahead |
| 2 | After a collision | `shorts/VEz6_4xEDf0` | Video’s $5,000 police threshold isn’t California’s |
| 3 | Vehicle emergency kit | `shorts/YwktUIc6SzE` | Kit is recommended, not required. No activity |
| 4 | Stopping before a front curb | `shorts/p7ZyEO5YtdQ` | Mirror reference is vehicle-specific, not a rule |
| 5 | Nonworking traffic light | `shorts/qTuNCIlZKmM` | |
| 6 | Pull right for emergency vehicles | `shorts/W_OS3ZtmeZQ` | |
| 7 | Emergency vehicles: right-edge rule | `shorts/EAX-BfaXnNA` | Left-hand traffic footage |
| 8 | Right-of-way at intersections | `shorts/mVRobcWCxFU` | |
| 9 | High beams: dark roads, rain, fog | `shorts/aTbYpaOgYxU` | |
| 10 | Passing a bicyclist: 3 feet | `shorts/4BWgFvgGiEw` | Video says 1 m |
| 11 | Entering a freeway | `shorts/yVxIoBMzeoo` | |
| 12 | Freeway merging | `shorts/Oc7FD511OA8` | |
| 13 | Drive-test readiness | `shorts/PqXkWiuHRBA` | No activity |
| 14 | Blind-spot checks | `shorts/f6fzDN3xroc` | Right-hand-drive car |
| 15 | Blind curves and parked cars | `shorts/MEiEuxfxB4s` | Left-hand traffic footage |
| 16 | Blind bends, poor visibility | `shorts/6yk-USG8gL0` | **Not recommended**: teaches “keep to the left” |
| 17 | Making space for a merging trailer | `shorts/qMWo4bs6_WI` | |
| 18 | Speed vs. stopping distance | `shorts/gHtV3oKT7Yc` | km/h; label mph (40 ≈ 25, 60 ≈ 37) |
| 19 | Three-second following distance | `shorts/qmI6rG2oUik` | No activity |
| 20 | Distraction-free driving | `watch?v=n2CwnsQ0MYM` | California OTS video |
| 21 | DUI consequences | `watch?v=IJbLyBQClHA` | Dramatization |
| 22 | Child passenger safety | `watch?v=w8zNrbuaXbU` | 2017 training, not the legal source |
| 23 | Railroad crossings | `watch?v=Q33u7SSAPbk` | |

**Rules the materials add**

- **Clip licenses: confirmed by the owner on October 13, 2026.** The curriculum PDFs’ older “link-only” advice is superseded for clips 1–19. Creator names and license types are still not recorded, and a CC-BY license requires naming the creator. Record them before public release.

- **Every curriculum clip retains its California correction.** Owner direction on October 13, 2026 puts `lesson.californiaRule` in a collapsed dropdown over each clip. The full correction and handbook citation remain available there and in About this lesson. Lessons 7, 15 and 16 show left-hand traffic and lesson 14 a right-hand-drive car; their rule text says so. Keep these corrections attached to the lessons, including lesson 16.

- **Curriculum quiz text is a draft.** Enter it with `draft: true` and a `source` that cites the handbook section and page from its card. It stays a draft until a human approves it.

- **Local impact figures have a narrow scope.** California OTS reports for Novato in 2023: 134 people killed or injured in fatal-and-injury crashes, 33 speed-related fatal-and-injury collisions, and 17 pedestrian and 14 bicyclist victims killed or injured. These figures are not total crashes. Don’t add news reports together into city totals, and don’t use the figures to assign fault. The validation package has the required attribution line plus the Marin, Caltrans and TAM sources and their scopes.

- **Two kinds of activity.** The curriculum’s decision-only prompts follow choose → lawful outcome or corrective feedback → retry with the rule visible. They never simulate a crash or impairment and have no timed controls. The master plan’s 10 simulations follow later owner direction: a countdown with active slow motion, and non-graphic cartoon warning bursts for unsafe outcomes, never gore or injury. Don’t apply one set of rules to the other without asking.

- **Safety and honesty boundaries.** Lane needs a clear “don’t use while driving” message (planned; check the code). Never show fake comments, likes, peers or ranks. Likes and saves must not affect mastery, XP or ranking. Never claim that a learner is ready to drive or will pass.

**Learning model (proposed, not built).** This summarizes the algorithm PDF and master plan §7. The weights are heuristics, not trained or validated.

```
A = .60·first answer correct + .25·correction correct + .15·later-review rate (.50 with no history)
W = .40·submitted + .30·retry done + .20·activity done + .10·opened help
N = .50·watched fraction + .30·key segment watched + .20·purposeful engagement
T: r = active seconds / expected (25 s default)
   .50–2.00 → 1.00 · .25–.50 → .70 · <.25 → .45 · 2–4 → .75 · >4 → .55
M = .55A + .15W + .20N + .10T
   ≥.80 move on · ≥.60 short reinforcement · ≥.40 correction + similar question · <.40 key segment + correction + activity
topic mastery = .70·previous + .30·session M
review priority P = .50(1−M) + .20·min(days since practice/7, 1) + .20·min(skips/3, 1) + .10·safety importance (.50–1.00)
```

- Route on the raw score. A score that displays as 0.60 can be 0.59875, and it must still route to support.
- **Decision needed (DEF-09):** if a correction or activity wasn’t assigned, does W score it 0 or drop it from the denominator? The PDF’s prose says to drop it, but its worked examples score it 0. Don’t choose without the owner.
- Mastery, review priority and readiness are separate. Time is a small diagnostic and must never become a speed score.

**Where the master plan conflicts with this file** (this file wins until the owner decides):

- Home: the plan puts Daily Goal and the leaderboard on Home and opens normal sessions on Feed. The constraints above drop the separate goal card. The October 13 owner direction moves the leaderboard to Home and saved lessons to Profile.
- Navigation order: the plan lists Home / Feed / Practice / Progress / Profile. The built order is Home / Progress / Feed / Practice / Profile.
- Accounts: the plan is local-first with an anonymous learner and no forced account, and it calls Supabase a candidate, not a requirement. Planned step 5 says sign-in is required.
- Simulations: the plan uses separate per-scenario packages. The Simulator rules below aim for shared scenes plus a config per scenario.
- Lesson count: the curriculum has 23 lessons. This file previously planned 30.
- Feed order: lessons 1–19 come before the five original lessons, so a new learner starts on lesson 1 rather than yellow-light.

## Stack

Vite + plain TypeScript (no UI framework) + Babylon.js (`@babylonjs/core`, pinned to 9.27.1). It’s an installable web app (PWA) with a hand-built service worker. This project-specific stack overrides generic defaults: don’t suggest or perform a migration to Next.js, React, Zustand, Dexie, tRPC, Drizzle, or another framework/store. Supabase is still the planned backend.

No new runtime dependencies without asking first. Babylon is already about 1 MB and is lazy-loaded for that reason.

**Scope rule:** make the smallest local change that delivers the requested feature. Do not use a feature or design request as a reason to restructure the app, replace the router, rename storage keys, or do unrelated cleanup. If a small refactor is truly required, explain why it is required and preserve existing behavior before adding new behavior.

## Layout

| Path | What it does |
| --- | --- |
| `src/main.ts` | Hash router: five destinations, `#/practice/test`, `#/feed/:clip[/quiz]`, `#/drive[/:clip]`, `#/lesson-progress`; route transitions; production service-worker registration |
| `src/theme.css`, `src/motion.css`, `src/ui.css` | Shared earthy palette and type/spacing/elevation tokens; route/dialog motion, feedback keyframes and reduced-motion behavior; shared buttons, chips, segmented tabs and celebration burst (see `DESIGN.md`) |
| `src/home/home.ts`, `home.css` | Home: next-lesson sign, This week row, lesson strip, saved lessons; copy in `content.ts`, selection logic in `model.ts`. `sheet.ts` (bottom sheets), `strip.ts` (strip drag), `spring.ts` (spring physics, no dependency) |
| `src/home/tabs.ts`, `icons.ts` | Shared Home / Progress / Feed / Practice / Profile bar and icon system; full-screen feed uses a Home return control |
| `src/home/leaderboard.ts`, `leaderboard-model.ts`, `leaderboard.css` | Local weekly leaderboard presentation mounted on Home; future ranked-data seam |
| `src/progress/path.ts`, `path.css` | Progress: trip panel, lesson signs, moving car, milestones on the road, Find my car and lesson sheet. `road.ts` holds the tested road geometry, `scenery.ts` draws the road, `milestones.ts` derives badges |
| `src/profile/profile.ts`, `profile.css`, `content.ts` | Profile stats, selected-car hero and Garage, item sheets and purchase confirmation, liked/saved lesson tabs and copy |
| `src/profile/cars.ts` | Six-car catalog, prices and shared SVG art used by Garage and the Progress highway |
| `src/practice/practice.ts`, `practice.css`, `questions.ts`, `score.ts` | Practice introduction, test UI, separate question bank and pure scoring |
| `src/navigation.ts` | `View` type and `go()`. Use `replace` for automatic redirects so Back doesn’t bounce |
| `src/drive.ts` | Lazy-loads the simulator and its CSS; exit returns to the next clip |
| `src/feed/curriculum.ts` | Curriculum video lessons 1–19: quick checks, handbook citations, California rule, summary, local context, original-video credit |
| `src/feed/clips.ts` | `Clip` type, the five original lessons, and the feed order (curriculum lessons first) |
| `public/videos/` | Clips 1–19, named by lesson ID, re-encoded from `AppMaterial/Videos.zip` by `scripts/encode-videos.sh`; first-frame posters in `public/images/lessons/posters/` |
| `src/feed/feed.ts`, `feed.css`, `minimal.css` | Feed and quiz; `minimal.css` now defines complete components, while `feed.css` supplies fonts/base/summary styling. Escape data in HTML templates with `esc()` |
| `src/feed/poster.ts`, `scrollTimer.ts` | Decorative media fallback and visible-time counter for the current feed visit |
| `src/feed/progress.ts` | Sole progress store: lesson XP/results, streak, daily/weekly totals, likes/saves, avatar and car ownership/selection with shared spending |
| `src/feed/screens.ts` | Lesson summary at `#/lesson-progress`, separate from the highway Progress tab |
| `src/scenario/scenario.ts` | Yellow-light state machine, braking physics, replay recording |
| `src/scene/*` | Babylon scene: engine, lighting, scenery, vehicles, signals, cameras, replay overlay, perf overlay |
| `src/ui/controls.ts`, `src/style.css` | Simulator controls; CSS scoped to `.experience`, bottom panel in portrait and side panel in landscape |
| `src/audio/drivingAudio.ts` | WebAudio sounds generated in code; unlocked by the first user gesture |
| `src/sw.js` | Service worker template; `vite.config.ts` fills in the precache list at build time |
| `scripts/inspect*.mjs` | Playwright walkthroughs that take screenshots |
| `AppMaterial/` | Owner-supplied curriculum PDFs, plans, clip ZIP and logo files. See Source materials |
| `public/` | Icons, manifest, self-hosted IBM Plex/license, supplied logo, avatar/sign art, and preview captured from Lane's own simulator; retain provenance files |

## Rules

**Content (questions, answers, explanations)**

- Agents may draft new questions only when they are marked in the lesson data with `draft: true` and a handbook reference, for example `source: 'California Driver’s Handbook — Right-of-Way section'`. A human approves a draft before it ships.

- Don’t change a rule or correct answer in approved content without citing the handbook. A wrong answer is the worst bug this app can have.

- Don’t copy DMV practice-test wording word for word. Rewrite it.

**Learning flow and tone**

The following are product requirements, not a claim that every recovery/menu/review behavior is implemented. This visual rebuild preserves the existing quiz flow; verify the code before describing any planned behavior as built.

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

- Videos are excluded from the service-worker precache (`vite.config.ts`); their posters are precached. The feed saves a clip to the `amber-videos-h264` cache after it plays to its `ended` event, and `src/sw.js` serves cached clips with byte ranges so Safari can play them offline. Rename that cache only when the files change (the old one is deleted on activate). Only nearby clips attach a source: the current one buffers first, then the next buffers and the one after (and the previous) load headers; farther clips release theirs. A failed neighbor retries after the next swipe; only the clip on screen falls back to its poster.

- **Codecs (fixed October 13, 2026):** the source clips were 7 H.264, 6 VP9 and 6 AV1; most iPhones can’t play VP9 or AV1 in MP4. All 19 are now H.264/AAC, 720px wide, 30 fps, about 1–1.8 Mbps, faststart, via `scripts/encode-videos.sh`, which also writes each poster. Encode every new clip the same way; `scripts/curriculum.test.mjs` fails on a non-H.264, non-faststart or posterless clip. `node scripts/inspect-video-load.mjs` checks that every clip plays in WebKit and times first frames on throttled connections. Still check on a real iPhone.

- Every video needs a recorded source and license. The source URL for each of clips 1–19 is in its lesson’s `credit` field and the curriculum table. Creator names and license types are not recorded yet (see Source materials). **TODO: where the credits list lives.** Don’t add a video whose source you don’t know.

- When adding clips from `Videos.zip`, extract only the ones being added and name each by its stable lesson ID, not the zip’s numbered title. One zip filename has a broken apostrophe encoding. Record the zip filename and source URL next to the lesson data.

**Simulator**

- Target: a few reusable 3D locations plus a config per scenario (signals, other traffic, decision point, what counts as safe). The yellow-light scenario is currently hard-coded and needs refactoring into that shape before scenario #2. Don’t add a second hard-coded scenario.

- Sims are optional, offered after the quiz. A lesson never requires one to count as done.

- The master plan locks the catalog at 10 scenarios. The 2D ones are SIM-01 four-way stop, SIM-02 unprotected left turn, SIM-03 roundabout entry, SIM-04 lane ends, SIM-05 motorcycle in the blind spot, SIM-06 emergency vehicle at an intersection and SIM-07 railroad tracks without a clear exit. The 3D driver-seat ones are SIM-08 yellow light, SIM-09 freeway entrance and SIM-10 right turn with a pedestrian and bicyclist. Each runs after its related quiz, never as a feed opener. Its 3–5 s timers are draft values. Whether the built-in yellow-light scene stays or is replaced as SIM-08 is still an open decision.

- The master plan splits ownership. GPT/Codex refines the simulation packages. Claude Code integrates approved packages and owns the rest of the frontend. The integrator doesn’t redesign an approved package. A package starts with `startScenario(container, { onComplete, onRetry, onExit })` and returns `{ scenarioId, topicId, outcome: 'safe' | 'unsafe' | 'timeout' | 'exit', selectedAction?, elapsedMs?, retryCount, handbookSource }`. The package ZIP is not in `AppMaterial/`. Babylon version and import strategy need a decision before any 3D package is imported.

- Performance floor: **TODO: confirm the oldest supported phone** (proposed: iPhone 13). Software-rendered FPS from the inspect scripts doesn’t tell you how a real phone performs.

**Offline and later Capacitor**

- Keep hash routing. Every screen must load from the single cached `index.html`.

- Core features must work without the service worker. Capacitor’s WebView doesn’t treat service workers the way a browser does.

- A new build never replaces the one a learner has open. A build installed during an earlier visit takes over at the next launch: `main.ts` asks the waiting worker to skip waiting and reloads once into the new build on the same screen (October 14, 2026). Devices still running a build from before this change need every tab closed once to pick it up.

## Verify before calling a change done

1. `npm run build`: type-check plus bundle. Must pass.

1. Run `node --test scripts/*.test.mjs`. Existing tests cover Home/progress, legacy avatar/car spending, weekly leaderboard logic, practice scoring, visible-session timing and curriculum data integrity. Add meaningful logic coverage alongside changed logic, with no test-framework dependency.

1. Whenever the UI changes, run the matching walkthrough and look at the screenshots:
  - Home/tabs: run `npm run build && npm run preview`, then `node scripts/inspect-home.mjs`.
  - Progress: `node scripts/inspect-progress.mjs` and `node scripts/inspect-path-motion.mjs` (actual quiz completion, moving car and reduced motion).
  - Profile/leaderboard: `node scripts/inspect-profile.mjs` and `node scripts/inspect-leaderboard.mjs`. The leaderboard fixture checks also use the dev server.
  - Practice: `node scripts/inspect-practice.mjs`, including all 46 questions, results and session reset.
  - Simulator: run `npm run dev`, then `npm run inspect` (optional `portrait`/`landscape` arg). For the production build: `npm run build && npm run preview`, then `PRODUCTION=1 npm run inspect`.
  - Feed/summary: `npm run build && npm run preview`, then `npm run inspect:feed` (optional `-- portrait` or `-- landscape`).
  - Phones (any UI change): `node scripts/inspect-mobile.mjs` walks every screen and dialog on nine phone profiles in WebKit and Chromium, including an iPhone launched from the home screen with notch insets, and writes contact sheets to `artifacts/mobile/`. `PHONES=iphone-se,pixel-7` limits the run. It needs Playwright’s WebKit (`npx playwright install webkit`).
  - Keep a build stable during offline checks. Rebuilding while a walkthrough installs its service worker can invalidate the asset list. Run WebGL-heavy walkthroughs sequentially when software rendering is slow; investigate failures rather than reporting a partial run as passed.
  - Screenshots and logs go to `artifacts/`, which is gitignored. The Chromium path is hard-coded to this Mac. Override it with `CHROMIUM=...`.
  - `?perf=1` shows the FPS and device-measurement overlay.

1. Before reporting completion, say exactly what was implemented and what remains future work. Do not present placeholders, unverified video licensing, draft handbook content, or simulator concepts as completed production features.

## Known leftovers

Don’t fix these unless asked:

- Old names in code: package `amber-driving-lab`, cache prefix `amber-`, storage keys `amber-muted` and `roadloop-progress`. Renaming a storage key wipes existing saved data.

- `liked` is retained in the progress store and powers the feed's like control, per the current design request.
