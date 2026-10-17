# 03 — Old backend port map

**Source of the "older implementation":** `pasted_content_6.txt` was not found on this machine. The code that report describes is preserved in `git stash@{0}` ("local changes before syncing to origin/main 2026-10-15"), built on `8b4f9de` before Hamza's 2026-10-14 redesign. The owner chose (2026-10-15) to port from that stash, adapting each piece to the new frontend rather than popping it.

Status: **present** (already in new frontend) · **reusable** (port nearly as-is) · **adapt** (port the logic, rewrite the integration) · **missing** (not in stash either) · **deferred**.

| Capability | Stash location | Status | Notes for the port |
| --- | --- | --- | --- |
| XP, streak, daily goal, likes, saves | `feed/progress.ts` | **present** | Hamza's store already has these plus car ownership |
| Car/avatar selection | `feed/progress.ts` | **present** | New store adds cars; keep |
| Anonymous learner ID | stash `progress.ts` `learnerId()` | **adapt** | Add to existing store under the same key `roadloop-progress`; random UUID, no demo value |
| First-session status | `isFirstSession`, `completeFirstSession` | **adapt** | Needed for launch routing |
| Settings: permit date, sound | `settings()`, `setPermitTestDate`, `setFeedSound` | **adapt** | Hamza removed the feed sound toggle; keep only permit date unless sound control returns |
| Review Later queue | `addReviewLater`, `resolveReview`, `reviewQueue` | **reusable** | Upsert/reactivate, reasons `menu`/`skip`/`sim-exit`/`help`/`missed` |
| Per-topic mastery | `topicRecord`, `recordMastery`, `recordHelp`, `recordTopicSkip` | **reusable** | Topic IDs must be mapped from Hamza's `topic` strings (e.g. `road awareness`) |
| Per-video watch + key segment | `videoRecord`, `recordWatch`, `recordVideoSkip`; `learning/watch.ts` | **adapt** | Hook into Hamza's `feed.ts` playback; key segments need per-lesson times (not in curriculum data) |
| Quiz attempts (correct, time, kind) | `recordAttempt`, `attempts` | **reusable** | |
| Simulation attempts | `recordSimulation`, `simulations` | **adapt** | Change the record to the V4 contract: `success` + `chosenAction`, outcome derived (`safe`/`unsafe`/`timeout`/`exit`) |
| Safe migration of old data | stash `load()` validators | **reusable** | Tests in stash `learner-records.test.mjs` |
| A/W/N/T scoring, smoothing, priority | `learning/scoring.ts` | **reusable** | Pure; tests in `scoring.test.mjs`; 0.59875 < 0.60 raw routing |
| Session evidence (visit → mastery) | `learning/session.ts` | **reusable** | |
| Planner (first/returning session, permit-date mix, daily review) | `learning/planner.ts` | **adapt** | Lesson list now comes from `curriculum.ts` + `clips.ts` |
| Sync boundary | `data/sync.ts` (`LocalOnlySync`) | **adapt** | Becomes the seam for the Supabase adapter |
| Precache guard for videos | `vite.config.ts` `isPrecached` + `precache.test.mjs` | **adapt** | Hamza's `vite.config.ts` already excludes videos; port only the test |
| `ended`-triggered quiz | — | **present** | Already in Hamza's feed |
| Three-dots menu (know / review later / help) | stash `feed.ts` | **adapt** | Rebuild inside Hamza's quiz drawer using his components |
| Wrong answer → explanation → similar question → recovery | stash `feed.ts`, `content/lessons.ts` (21 similar, 21 harder drafts) | **adapt** | Similar/harder questions are drafts keyed to old lesson IDs; remap to curriculum IDs and keep `draft: true` |
| Early-leave safety gate | stash `feed.ts` | **adapt** | Needs key-segment data |
| Mixed cards (16 glossary, 10 flashcards, 4 permit posts, 2 artifacts) | `content/cards.ts`, `feed/content.ts` | **adapt** | Draft content; needs a card renderer in Hamza's feed style |
| 16 decision activities | `content/lessons.ts` | **adapt** | Owner-supplied briefs; curriculum rules (no timers, no crashes) |
| Daily review route | stash `feed.ts`/`main.ts` `#/review` | **adapt** | New route in Hamza's shell |
| Emergency checklist | `content/emergency.ts`, `emergency/*` | **adapt** | Draft content; compact reference behind the menu |
| Simulation contract, registry, host | `simulation/*` | **adapt** | Contract matches V4; host must be restyled to Hamza's tokens |
| SIM-01 four-way stop (hand-ported, older) | `simulation/packages/four-way-stop` | **replaced** | Use the V4 package from the supplied folder instead |
| Supabase / remote sync | — | **missing** | New in this pass (no live project) |
| Leaderboard backend | — | **missing** | New in this pass |
| Credits / Privacy / Terms | — | **missing** | New in this pass |
| Push notifications, public comments, CMS | — | **deferred** | Out of scope per PDF §7.1 |

## Older report claims vs. this clone

| Claim | Actual |
| --- | --- |
| 24 lessons | 24 feed lessons (19 curriculum + 5 poster) ✔ |
| 18 working videos, lesson 2 unavailable | **19 videos present**, including `after-collision.mp4` (lesson 2) |
| 68 tests | 47 tests in this clone; the stash adds 7 test files |
| 16 decision activities | In stash only |
| One imported simulation | In stash only (older SIM-01); 10 V4 packages supplied separately |

## Missing-Work-evidence policy (DEF-09)

The stash's `work()` and Hamza's CLAUDE.md both flag this as unresolved: does an unassigned correction/activity score 0 or leave the denominator? The stash's current behavior is mixed: an unassigned **activity** is dropped from the denominator (`applies: activityCompleted !== undefined`), while an unassigned **correction/retry** still applies and scores 0. The port will keep that behavior unchanged, record raw evidence, and add a test that pins it. **Owner decision still needed** before changing it.
