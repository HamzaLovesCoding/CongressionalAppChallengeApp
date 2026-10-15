# Lane — Design guide

Current implementation: October 12, 2026 rebuild. This records the implemented direction for review, not a claim that the user has approved the final screens.

## Direction

A driving app with an earthy identity, substantial mobile controls, and a clear page hierarchy. Restore the real Lane wordmark, driving imagery, rounded controls, and collectible Profile cars. Keep Home focused. The previous nearly empty, square-control pass lost too much identity.

Use single surfaces with clear dark boundaries. Rows and ordinary sections share the page; do not put bordered cards inside other bordered cards. A featured lesson, profile identity, or test introduction may have one rounded outer surface. Avoid heavy shadows, decorative characters outside Profile, promotional sublines, and repeated calls to action.

Read this with `CLAUDE.md`. Current user instructions supersede its older soft-green visual baseline. Preserve hash routing, the progress store and its keys, quizzes, optional simulator practice, and offline support.

## Sources

- `src/theme.css`: shared colors plus type, spacing, radius and elevation tokens.
- `src/ui.css`: shared components every screen uses (buttons, chips, segmented tabs, headings, celebration burst). `src/motion.css` holds the shared feedback keyframes.
- `src/home/home.ts`, `home.css`, `tabs.ts`, `icons.ts`: Home, five-destination navigation.
- `src/home/sheet.ts`, `sheet.css`: Home bottom sheets. `src/home/strip.ts`: lesson strip mouse physics. `src/home/spring.ts`: dependency-free springs, momentum projection and rubber-banding (tested in `scripts/spring.test.mjs`).
- `src/progress/path.ts`, `path.css`: Progress road, lesson signs, car, lesson sheet. `road.ts` holds the road geometry (tested in `scripts/progress-road.test.mjs`); `scenery.ts` draws the road and unit scenery.
- `src/profile/profile.ts`, `profile.css`: selected-car identity, stats, Garage, liked and saved lessons.
- `src/home/leaderboard.ts`, `leaderboard.css`: Home's local weekly leaderboard.
- `src/practice/practice.ts`, `practice.css`: practice introduction, questions, feedback, results.
- `src/feed/minimal.css`: complete feed and quiz component styles, not an override layer.
- `src/feed/feed.css`: fonts, shared feed base, lesson summary.
- `src/feed/poster.ts`: decorative street-map fallback; not lesson footage or rule instruction.
- `src/style.css`: simulator controls, scoped to `.experience`.
- `docs/design/home-earth-reference.png`: original earthy reference.
- `docs/design/home-rebuilt-reference.png`: current rebuilt Home.
- `docs/design/rebuild-decisions.md`: rationale and audience tradeoffs.

## Palette and type

Keep colors centralized in `src/theme.css`. Accent replacement should not require redesigning components.

| Token | Value | Use |
| --- | --- | --- |
| `--lane-ink`, `--lane-primary`, `--lane-hero` | `#29251F` | Text, boundaries, dark featured surfaces |
| `--lane-page` | `#F0E4CE` | Cream matched to the supplied logo |
| `--lane-surface` | `#FFFAF0` | Light controls, sheets and test surface |
| `--lane-soft` | `#E8DCC5` | Secondary surfaces |
| `--lane-line` | `#B1A38B` | Secondary row dividers |
| `--lane-support` | `#46423A` | Supporting text |
| `--lane-muted` | `#655F54` | Secondary text |
| `--lane-accent` | `#D19735` | Main actions, progress car |
| `--lane-accent-ink` | `#785119` | Readable accent text |
| `--lane-accent-soft` | `#F0DBAD` | Selection states |
| `--lane-success` | `#405332` | Correct-answer text and borders |
| `--lane-error` | `#974B3D` | Correction text and borders |
| `--lane-lawn`, `--lane-tree`, `--lane-tree-light`, `--lane-roof`, `--lane-roof-shade` | `#E2DAB9`, `#8D986C`, `#B4BD8B`, `#C99D6B`, `#AB7F51` | Progress road scenery only |
| `--lane-work` | `#DC7B2E` | Work-zone orange: cones, barricade, Coming soon sign. Keeps its real-road meaning; not an accent |

Dark text on ochre. Traffic signals, signs and simulator measurement colors retain their instructional meaning. No general-purpose gradients. Depth comes only from the elevation tokens: `--shadow-soft` (controls, cards), `--shadow-raised` (featured surfaces, sheets, toasts) and `--shadow-cta` (primary buttons: a faint top highlight plus a warm drop). They are tinted with ink and accent-ink, never grey. `--glow-accent` and `--glow-success` mark the current item or a correct answer.

Use self-hosted IBM Plex Sans, retaining its font license: IBM’s official WOFF2 Latin1 and symbol subsets (`public/fonts/README.md`), about 70 KB on first load instead of a 537 KB TrueType file. Four sizes and two weights everywhere (October 13, 2026): `--fs-caption` 12, `--fs-body` 15, `--fs-title` 20, `--fs-display` 26, at `--fw-regular` 400 and `--fw-bold` 600. `--fs-hero` 48 is only for one large number (practice score, summary count). Values are larger than their labels. Keep sentence case and direct labels. Let lesson titles wrap. Exceptions kept on purpose: the feed's California rule panel (13.5px, clamped over video) and step-downs at 320px width.

Spacing uses `--sp-1`…`--sp-7` (4, 8, 12, 16, 24, 32, 48). Related items sit one step apart and separate groups two steps apart; sections are 32px apart. Corners use `--radius-sm` 8 (tags, chips), `--radius-md` 14 (controls, buttons), `--radius-lg` 20 (cards, featured signs) and `--radius-xl` 24 (sheets, dialogs, hero surfaces).

## Structure

- Phone-first at 390 × 844. Phones of any width fill the screen (`--app-width`; some are 440–480px wide); tablets and desktops get a centered 430px column. Roughly 20px gutters (16px at 320px).
- 1–1.5px dark control boundaries; 1px secondary dividers. Strong boundaries do not require outlining every section.
- Controls 14px corners; featured surfaces and dialogs 20–24px. No floating pill navigation or heavy dimensional shadows.
- Keep safe-area insets, scrolling, 44px minimum interactive targets, visible keyboard focus, readable disabled controls, and semantic progress.
- Navigation is a full-width strip of road seen from above (owner direction, October 13, 2026): opaque warm stone-grey asphalt mixed from `--lane-support` and `--lane-muted`, with soft photographic grain (light grain, sparse aggregate, faint tire-wear streaks; kept subtle on owner request), all drawn from SVG noise in `home.css` with no image file. Five labeled destinations: Home, Progress, Feed, Practice, Profile. Each tab sits on a faint cream lane dash; the current page's dash is painted ochre and glides to the new tab between pages. Labels are cream (74% when inactive). Feed is the central cream control. Preserve `aria-current`.

## Shared components (`src/ui.css`)

Use these instead of screen-specific copies; screens add only layout around them.

- `.ui-button`: the one ochre primary action per view (1.5px ink boundary, `--shadow-cta`, presses down 1px). `.is-secondary` outlined, `.is-dark` for repeated actions in a grid, `.is-quiet` for text-weight actions such as Cancel, `.is-split` for label left and arrow right. Disabled is soft and flat.
- `.ui-chip`: compact real values such as streak, XP, "+10 XP" and status. `.is-accent`, `.is-success`, `.is-dark`, `.is-quiet`. Never a decorative or invented count.
- `.ui-segmented` with `.ui-count`: two-way tabs (leaderboard Group/Global, Profile liked/saved). The selected option is raised on a soft track.
- `.ui-page-head` / `.home-section-heading`: one page-title size and one section-heading size.
- `.ui-burst`: the celebration badge with radiating rays, used by lesson completion. Rays fade after one pass; under reduced motion they simply stay visible.

## Gamification (October 13, 2026)

Every reward reads from data the app already stores; nothing adds currency, storage keys, fake peers or ranks. Likes and saves still never affect XP or mastery.

- **Answer feedback** (feed quiz and practice test): a correct choice bumps with a green glow and its check pops; a wrong choice shakes once. Feedback sits in a tinted panel. The answer that first completes a lesson shows a "+10 XP" chip.
- **Lesson completion (the peak):** emblem burst, XP earned and right-first-try tiles, today's goal bar with "Daily goal reached" and streak chips, a "Milestone earned" row only on the completion that earns it, then one Next lesson action.
- **Home:** the next-lesson sign shows its "+10 XP" reward. The streak chip is lit once today has XP and quiet while today's XP is still pending (with a screen-reader hint). The goal ring fills ochre and shows a check once the goal is met.
- **Progress:** milestones at 1, 5, 12 and 24 completed lessons; the last equals the lesson count (tested). A badge earned since the last visit pops once.
- **Profile:** Garage only (owner direction, October 14, 2026). One dark hero shows the selected car, its name and Open Garage. Flat stats follow, then the Garage and adjacent Lessons you like / Saved lessons tabs. Avatar shopping, avatar tabs and character portraits are retired; existing saved ownership and spending are preserved.

- The Garage has one owned count, one next-unlock line and a three-column button grid. Tiles show art, name and Selected / Owned / locked price. Each opens the existing bottom sheet with larger art, description and one action, retaining purchase confirmation. XP to spend appears only in the stats row.
- Six locally drawn SVG cars share one renderer between Profile and Progress. Keep their nose-up orientation on the highway; preview them diagonally in the Garage. Rounded bodywork, raised roofs, inset windows, lights, mirrors, tire details and restrained highlights make them feel like collectible toy cars. Each has a distinct silhouette and cabin: short hatchback, separate-trunk sedan, long wagon with roof rails, open-bed pickup, tall minivan with sliding doors, and a round-fender coupe with a cream roof. No racing motifs or performance stats.
- Prices remain Hatchback included; Sedan 15, Wagon 25, Pickup 35, Minivan 45, Classic coupe 60 XP. The collection costs 180 XP. The selected car is read on every Progress render; all cars retain the same movement, reduced-motion and final-parking behavior. Cars do not appear on Home or the leaderboard; the latter uses a neutral person icon.
- Selecting an owned car gives a short tile-art lift; purchasing adds an outline pulse and a four-second unlock message. Re-selecting the current car does nothing. Reduced motion preserves states and messages without movement. No idle animation or sound.

**Practice:** topic icons; "N in a row" after two or more consecutive correct answers in the current attempt (never stored); results show a score ring with the 80% target marked and a star when the target is met.
- **Feed rail:** turning a like or save on pops the icon once.

## Screens

**Home** (owner decisions, October 12, 2026; built with Emil Kowalski's `prototype` and `apple-design` skills):
- The next lesson is a roadside sign, the same object as the Progress road: an exit-style lesson tab, "Next stop" tag, title, topic and one ochre action, on two posts. The whole sign is one tap target. It is the page's one bold element; everything below stays quiet. All complete: "Road basics complete" and a link to Practice.
- This week: streak, seven daily XP bars on the daily goal's scale (today in ochre, future days faded), and the editable goal ring.
- The unit's lessons as a sideways strip that opens one card before the next lesson. Touch uses native scrolling, so it gets the platform's momentum, snapping and edge bounce; a mouse gets the same physics from `strip.ts`. Dragging never opens a lesson.
- Weekly leaderboard below the lesson strip, with Group/Global tabs and the local user's real weekly XP and a neutral profile icon. Online competitors and ranks remain future work.
- Menu and daily goal open as bottom sheets: they rise on a critically damped spring, follow the finger 1:1 from the grab point, resist when pulled up, can be caught mid-flight, and on release the throw decides (a clear flick by direction, otherwise where it would come to rest). Escape and the close button play the same exit. Reduced motion fades instead.
- Springs use damping 1 by default; slight overshoot only after a released drag. No animation library and no load animation on Home.
- No greeting slogan, mascot or extra stat cards. Saved lessons live on Profile (owner direction, October 13, 2026).

**Progress:** a car driving a real road, not a Duolingo-style node path. Rebuilt October 14, 2026 after the owner called the previous pass messy and distorted and asked for a clean, neat, gamified layout showing a car progressing through lessons; implemented for review, not approved. The road, right-side signs, moving car, work zone and milestones from the October 12 decisions remain.
- A compact fixed trip panel: Progress title, a Milestones chip (earned of four, opens the collection) and lifetime XP; then Road basics with the real completion count above a trip meter, a track whose fill ends at the selected car, with the four milestone pins on it. Short screens fold the panel into one row (title, meter, chips). No back button: Progress is a tab.
- Top-down two-lane road on the left, running bottom → top with gentle bends kept within 8px so it never reaches the signs. Dashed yellow center line, cream edge lines, sidewalks, and a grass verge with a regular row of trees on the left, sized so none is cut in half. The trip starts at a checkered line beside a plain Unit 1 · Road basics label; the page opens scrolled to the car.
- Each lesson is a roadside sign on two posts in one aligned column right of the road, with a stop line across the driver's lane where its posts land. Upcoming signs are light, with the lesson number and +10 XP; completed signs are green with a check and earned XP. The next lesson is the one dark sign and the same object as Home's: lesson tab, Next stop and +10 XP tags, title, topic and one Start/Continue lesson action. The whole sign starts that lesson, and its stop line is painted ochre. Nothing is locked; every other sign opens the lesson sheet.
- The selected Garage car, drawn larger than its Garage base scale, waits in the right-hand lane just before the next stop line; ochre breadcrumb dots trace the distance driven. All complete parks it past the last stop beside a dark "Road basics complete" sign whose action goes to Practice.
- Milestones at 1, 5, 12 and 24 completed lessons stand by the road just after the lesson that earns them: medal, title, and Earned or lessons to go. They and the header chip open the spring-driven collection sheet. Derive them from existing completion records; no extra currency, bonus XP, locks or new storage.
- Past the last lesson: cones, a barricade, dashed planned road, and one orange "More road ahead · Coming soon" sign. Do not name future units until the curriculum is approved.
- Returning after a completed lesson, the car drives (turning with the road) to its new stop while the page and the trip-meter car follow it. Any scroll or tap hands the view back. Then the newly completed sign and any new milestone pop once, and an arrival message (checkpoint or milestone name, XP earned) shows above the tab bar for five seconds; it is a polite live region. Revisits do not repeat it. Reduced motion places the car immediately, without pops.
- Find my car appears only while the car is out of view: a round button over the road, never over a sign, showing the selected car and an arrow toward it.
- The lesson sheet uses the shared spring sheet: title, lesson number and topic, status, XP and first-try or tries chips, the curriculum summary where one exists, then Start / Continue / Review, plus the optional simulator only where one exists.
- Signs are flow content; the road is drawn to meet their measured posts, so wrapping and larger text never misalign it.

**Profile:** gamified avatars belong here. One dark identity surface, flat real-stat rows, compact Avatars/Garage collection, then adjacent Lessons you like / Saved lessons tabs with counts. Both lists open their lessons; saves also have removal controls. Keep purchase confirmation, affordability, free switching, and persistence. The leaderboard lives on Home (owner direction, October 13, 2026). No companion slogans.

- The Road crew collection uses four matching matte, rounded character busts: olive Sprout, ochre Sunny, stone Cloud and clay Peach, with warm cream faces and driving jackets. Preserve names, IDs and prices so existing purchases still work. The same art appears in the identity, collection, purchase preview and leaderboard.
- Collection uses Avatars and Garage segmented tabs with ownership counts, one next-unlock line and a three-column button grid. Tiles show art, name and Selected / Owned / locked price. Each opens the shared bottom sheet with larger art, description and one state-dependent action; buying retains the purchase confirmation. No collection segments, extra count chip or separate wallet. XP to spend appears only in the stats row.
- Garage cars use the highway’s top-down SVG medium, with six distinct body shapes in the earthy palette. Hatchback is included; Sedan 15, Wagon 25, Pickup 35, Minivan 45, Classic coupe 60 XP. Cars and avatars share the spending ledger. The selected car appears in the identity shortcut and on the highway; it is absent from Home and the leaderboard.
- Selecting a different owned item gives a short tile-art lift; purchasing adds a single outline pulse and a four-second unlock message above the navigation. Re-selecting the current avatar does nothing. Reduced motion preserves the selected state and message without movement. No idle animation or sound.

**Practice:** a substantial test introduction with question count and target, one Start test action, numbered topic rows. The test has its own focused surface, clearly bordered answers, supportive feedback and a readable result panel. On a question, the feedback and Submit/Next action stay pinned to the bottom of the screen while long questions scroll beneath them. Preserve question content and scoring.

**Feed:** full-screen vertical lesson feed, Home return, timer-only visible-session counter, like/save/share. Video is the focus: a compact topic and title sit above a collapsed California rule dropdown. Opening the dropdown pauses playback and reveals the full rule, handbook citation and About this lesson link; closing it resumes previously playing video. No sound toggle; playback attempts audio, falls back to muted autoplay when required, and a video tap enables audio. Rounded translucent controls have dark boundaries (no backdrop blur: it re-renders every video frame on low-end phones). Each video shows its first-frame poster at once and a spinner only while playback waits for data. A decorative street map is the fallback while licensed lesson video is unavailable. The roundabout lesson draws a two-lane roundabout instead of the intersection, with traffic circulating counterclockwise as in California; a lesson picks its map with `poster.scene` in `clips.ts`. Keep the same-lesson quiz drawer, strong answer states, real XP, and optional simulator handoff. Use lesson terminology instead of promotional run/pocket metaphors.

**Summary:** Lesson summary heading, one completion panel with Continue/Review, lesson rows, weekly activity and real stats. Remove the previous slogans and duplicated route labels.

**Simulator:** full scene alongside one integrated control panel: bottom in portrait, right in landscape. Real wordmark, legible signal and measurement overlays, clear Brake/Continue and replay controls. Preserve scene, physics, camera, replay, audio, and lazy loading. This redesign adds no scenario.

## Assets and motion

The supplied source is `AppMaterial/testappicon.png`; `public/images/brand/lane-logo.png` preserves it. Home crops the wordmark without stretching or showing the tagline. App icons use the supplied full logo centered on square cream backgrounds, with extra safe-area padding for maskable icons (owner direction, October 13, 2026). Keep asset provenance files.

`public/images/lessons/cedar-crossing.png` is captured from Lane's own Babylon scene; Home no longer shows it. Retired avatar art remains in `public/images/avatars/road-crew/`; provenance and generation prompts are linked in `src/profile/ARTWORK.md`. Its provenance is retained; these characters are no longer displayed. No new dependencies.

Keep short route, press and drawer transitions. Honor reduced motion, including the progress car. Avoid endless decorative animation.

## Validation

Run the build, existing Node logic tests, and matching walkthroughs. Inspect fresh screenshots rather than relying on a passing process. Check portrait, narrow phones, landscape, desktop, empty/completed states, modal overflow, larger text, focus return and navigation clearance.

Exercise goals, saves, quizzes, purchases, all practice questions, car movement, simulator Brake/Continue/replay/retry, and offline reloads. `scripts/inspect-path-motion.mjs` checks the car using actual quiz completion, both with and without reduced motion.

Browser emulation does not establish physical-phone performance. Licensed videos, accounts, online rankings and additional simulator scenarios remain future work.

Progress gamification (October 13, 2026): `scripts/progress-milestones.test.mjs` covers thresholds and non-repeating completion feedback. `scripts/inspect-progress-rewards.mjs` exercises actual quiz completion, badges, the draggable collection sheet, focus return and recentering at phone and landscape sizes. This remains an implementation for review.
