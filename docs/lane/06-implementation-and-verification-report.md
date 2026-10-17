# 06 — Implementation and verification report

Branch `lane-integration`, from Hamza's `main` @ `6c9e37e`, 2026-10-15. **Not committed.** The owner's earlier local work is preserved in `git stash@{0}`.

## Baseline (before any change)

`npm run build` passed (Babylon chunk warning); `node --test` 47/47; 55 baseline screenshots, no errors. `#/review` and `#/emergency` silently fell back to the Feed. No Supabase configuration of any kind. Details: docs 00, 01.

## What changed and why

| Area | Change | Why |
| --- | --- | --- |
| Content | 18 shorter display titles (IDs unchanged), poster title, "Give way" → "Yield" | PDF §4.1 redundancy; US wording (CLAUDE.md) |
| Store | Settings (permit date, nickname), Review Later, topic mastery, watch, attempts with client IDs, simulation outcomes, completion time; same storage key; old saves load untouched | PDF §3 old capabilities; sync idempotency |
| Learning | Ported A/W/N/T scoring, session evidence, watch coverage; new daily-review selection | PDF §3, §7.5 |
| Feed | ⋯ menu, miss → rule → similar → recovery, help, activities, early-leave safety check, watch tracking, sim offer, Source & credits | CLAUDE.md learning flow; PDF §4.2 |
| Simulations | 10 packages vendored, registry + host + adapter, `#/sim`, old simulator deleted, `#/drive` redirect | PDF §6; owner: only the new sims |
| Menu screens | `#/review`, `#/settings`, `#/credits`, `#/privacy`, `#/terms`; Home menu entries + review count | PDF §8, §10A; owner: Home menu |
| Leaderboard | Global first, local-only note, Group unavailable, remote rows when configured | PDF §7.4 |
| Backend | Supabase migration (RLS, single validated write path, server XP, leaderboard, delete), fetch client, local-first sync | PDF §7; owner: no live project, no new dependency |
| Legal | Privacy Policy and Terms from the data inventory; credits register from lesson data | PDF §10A |
| Favicon | Owner's logo at 32/64 px | owner request |
| Cleanup | Old simulator (scene, scenario, controls, audio, CSS, script, npm script), unused artwork and blank tab, unused learner ID, orphan CSS | owner request: remove excess |

## Old capabilities (stash) → this build

See doc 03. Ported: scoring, session, watch, review selection, store records, sync boundary, menu/miss/help/gate flow, activities, similar/harder drafts. Adapted: simulation records to the V4 `success` contract; SIM-01 replaced by the V4 package. Not shipped: emergency checklist (unreviewed draft), 26 flashcards/glossary/posts (need review + feed change), first-session routing (owner keeps Home launch), the device learner ID (identity is the backend's anonymous session).

## Final verification (2026-10-15, 20:30–20:45 PDT, current build)

| Command | Result |
| --- | --- |
| `npm run build` | pass (only warning: Babylon chunk > 500 kB, lazy-loaded for 3D sims) |
| `npx tsc --noEmit` | pass |
| `node --test scripts/*.test.mjs` | 102 / 102 pass |
| `node supabase/tests/rls.check.mjs` (PGlite 0.5.8, PostgreSQL 18.3) | 21 / 21 pass |
| `npm run inspect:feed` | pass, portrait + landscape (incl. offline replay, similar-question recovery, sim return) |
| `inspect-home`, `inspect-progress`, `inspect-path-motion`, `inspect-progress-rewards`, `inspect-profile`, `inspect-practice`, `inspect-leaderboard` | all pass at their viewports |
| `inspect-learning-flow` | pass (miss → similar → recovery, menu count, help, I already know this, sim exit, `#/drive` redirect, safety check) |
| `inspect-simulations` | 10 / 10 packages: safe, Continue destination, unsafe, retry, timeout, exit, one review item, 0 XP; no-WebGL fallback |
| `inspect-video-load` | WebKit 19 / 19 clips play; first frame 1.2 s (LTE) / 2.7 s (3 Mbps); swipes 0.1–0.3 s |
| `LABEL=after inspect-baseline` | 90 captures at 5 viewports + WebKit 320 px menu screens: no errors, overflow, clipping, blur or small targets |
| `inspect-mobile` (9 phones, WebKit + Chromium) | 0 findings (745 screenshots); rechecked iPhone SE + Galaxy S8 after the last fix |

## Corrections made after self-audit

Earlier "done" claims that were wrong or incomplete, found and fixed before finishing:

1. Only 3 of 10 simulations had been exercised in Lane → new `inspect-simulations.mjs` runs all 10 (found a test-harness bug, not an app bug).
2. The Privacy Policy said Lane keeps "a random learner ID created on this device", but nothing created it → ID removed; policy corrected; sign-in token disclosure added.
3. The ⋯ menu used `role="menu"` without the arrow-key behavior that role promises → plain buttons.
4. The quiz sheet focus trap ignored links (the new practice link) → trap includes links.
5. Settings inputs were 15 px (iOS zooms) and credit links were small inline text → 16 px inputs, full-row links (found by the phone matrix).
6. A draft explanation stretched the handbook's "full block" entry gap to merging and exiting → narrowed.
7. Two existing walkthroughs asserted during route transitions (race on this Chromium) → wait for the new page.
8. Settings' nickname Save button ran off screen on iPhone SE in WebKit only (a text input's default width); found by reviewing phone screenshots, not by the automated checks → fixed and a WebKit 320 px clipping check added to `inspect-baseline.mjs`.
9. `inspect-video-load.mjs` could hang forever once the safety check existed (its timed swipes leave part-watched safety lessons) → it now starts with lessons complete and has a swipe timeout.
10. `inspect-simulations.mjs` could carry a record across phases through a still-open page → each phase uses a fresh browser context.

## Owner review, 2026-10-15 evening: what was wrong, why, and what changed

The owner used the app and found it did not work as a learning product. Reproduced in a scripted fresh-learner session before any change:

| Owner report | Reproduced? | Cause | Fix |
| --- | --- | --- | --- |
| No quiz when scrolling; lessons silently skipped | Yes | The early-leave check only fired on S ≥ 0.9 lessons after ≥ 20% watched, and only if the key part was unseen; no key parts were authored, so it rarely fired | "Are you sure?" on any early swipe from an important lesson (S ≥ 0.8): Keep watching / I already know this, quiz me / Watch the important part / Review later. Lower-stakes lessons record a skip and come back |
| Lesson 2 then "the same thing" (lesson 1 again); "1 of 24" | Yes | Home, Progress and the Feed tab each picked "the first unfinished lesson", so a skipped lesson 1 stayed "next" and the Feed tab reopened lesson 1 | One resume point saved on the device (`setPosition`), used by Home, Progress, the summary and the feed planner |
| Timer keeps going after the video | Yes | It was a session counter | Shows the clip's own time and stops at the end; session time moved to the end card |
| Replay restarts everything; wants skip-to-quiz | Yes | No key segments existed, so "watch the important part" restarted the clip | Key segments for all 19 clips, read from the clips; important-part replay plays only that and returns to the check; "I already know this, quiz me" from the swipe prompt |
| Simulations are a separate page; not all used | Yes | Sims lived at `#/sim` and two were only in Review | All ten run inside feed cards; SIM-02 after lesson 8, SIM-10 after lesson 10, SIM-07 placed by the planner; Exit stays on the same card |
| No flashcards / active recall | Yes | The stash's cards were listed as "not shipped" instead of ported | 23 glossary terms, a flashcard for every one of the 24 lessons plus 7 feed flashcards, 5 permit tips; flashcard checks for lower-stakes lessons and repeat visits; "Not yet" queues review |
| Review later not visible | Yes | Only inside the Home menu | Review later row on Home while items wait; toast says where to find it |
| XP numbers disconnected | Partly | "0 out of 15" could not be reproduced; Progress showed an unlabeled "1/4" | "1/4 milestones" label; readiness line added. Earned, spendable and daily XP are still separate by design (Garage spends XP without lowering earned XP) |
| "The algorithm isn't there" | Built but invisible, and an older version | Scoring existed but did not visibly route anything, and followed the PDF rather than the owner's newer engine | Scoring matches `algorithmforlaneapp.ts`; the planner orders the feed and picks quiz/flashcard/glossary; session score adds a recall card when "developing"; Review shows each topic's score and why it returns; readiness on Progress and Review |
| Quizzes not matching videos | Yes | Checks came from the curriculum deck without checking them against the clips | All 19 clips reviewed frame by frame; all 19 checks rewritten (14 now ask about what the clip shows instead of a rule it never covers; 5 kept their rule with rebalanced options) (doc 10); balanced answer lengths and spread positions, enforced by `content-quality.test.mjs` |

**Why these were missed.** Every walkthrough opened lessons at `#/feed/:id/quiz`, so no test ever watched a video, swiped, or followed a learner from Home through several lessons. Several owner files in Downloads (Agreed Features Source of Truth, the locked sim catalog, the owner's algorithm code, the slideshow, the handbook PDF, the glossary) were never opened, so the quiz-as-feed-item, in-feed sims, mixed cards and readiness requirements were not applied. "Verified" meant "a test passed", not "a learner can use it".

**Also found and fixed during this pass:** after "Keep watching", the next swipe was ignored (a stale scroll target); "Review later" on a lesson dropped the learner into that lesson's challenge; readiness showed "Permit Test Ready" after two lessons because unpracticed topics were left out (now 0); the new readiness link was under the 44 px tap minimum; the stash's phone tip said "even hands-free", which the handbook doesn't say.

## Owner requests, 2026-10-16

| Request | Done | Evidence |
| --- | --- | --- |
| Sound/mute button by the play controls | Sound button beside the clip time on video lessons; remembers the choice (`soundOff` in the store, never synced). The old one belonged to the deleted built-in simulator | `inspect-feed` (mutes, label, stored) |
| Poster lessons "made up" (empty 8 s timer) | The five no-video lessons are fill-in-the-blank text posts (3–4 handbook-cited blanks each, wrong taps marked, reason after each), then the lesson's check. Their quiz options were rebalanced too | `inspect-feed`, `content-quality.test.mjs` |
| Strictly consecutive lessons | Next lesson = earliest unfinished everywhere; a lesson saved for later stays next | `planner.test.mjs` |
| Groups not available | Group tab = you + accepted streak buddies (`group_leaderboard()`) | `rls.check.mjs`, `inspect-buddies.mjs` |
| Streak buddies | Unique usernames (`set_username`), request by exact username, accept/decline, duo streak, remove; no search or messages; Settings + `#/buddies` in the Home menu; Privacy/Terms updated | 43 database checks; two-learner UI walkthrough against the real SQL |
| Supabase set up | Project **lane** created (`mtcphmkheqkzyvbvruey`, us-west-1). Applying the migrations was **declined twice** at the permission prompt, so the project is empty and the app stays local-only. Go-live steps: `supabase/README.md` | — |
| No instruction bleed / antithetical parallelism | Rewrote app copy that described internals ("sync isn’t set up", "Draft, pending review", provenance notes on cards) and "X, not Y" lines in lessons, Settings, Terms, Practice and Profile | read-through of every copy file |

Also found and fixed today: the 10 follow-up questions, 7 decision activities and 14 of the 46 Practice questions had giveaway-long correct answers (now guarded by tests); the buddies page didn't refresh when a friend accepted (now refreshes every 30 s and on return); a script bug briefly corrupted the foundation migration (the edit tool treated `$'` and `$$` in SQL as special), which was rebuilt from its intact parts and re-verified (44/44) before anything was applied. On landscape phones a text lesson was taller than the screen and its last choices were cut off; card content now scrolls inside the card. The feed's end card was focusable while off-screen; it now stays inactive until reached. The 2026-10-15 evening nine-phone run, reported earlier only by its exit code, had in fact stopped early on every phone (two of its new steps only applied to a brand-new learner); those steps are now scoped and the run was repeated on the final build.

## Owner requests, 2026-10-16 evening

- **Review later skipping / next video playing off-screen:** programmatic feed scrolls now keep scroll snapping paused until they arrive, then confirm the active card is on screen (`scrollToCard` in `src/feed/feed.ts`). Swipe repros in Chromium and WebKit land on the playing card. A lesson saved for later still passes over its own challenge card (it belongs after the lesson’s check).
- **“Are you sure?” loop:** a sheet now stops swipe momentum and holds the current card; Keep watching resumes in view (real touch-gesture repro).
- **Gear menu** on Home and Profile only; Review later removed from it.
- **Review page:** Today’s review = saved lessons (bookmark, or Review later, which now also bookmarks), spaced 2/4/8/16 days after a right answer, ordered by P and capped; Saved for later lists the rest with the next review date. Topics show the owner band with real answer counts (the bar is gone). Practice challenges: three, by need, rotating every other day. This narrows the PDF’s daily-review mix (today/yesterday/weak topics) to what the learner saved, by owner direction; misses still return through the feed planner.
- **Readiness goal** replaced the daily XP goal on Home and the lesson-complete card; **onboarding** (`#/welcome`) sets the wording (permit %, driver class, or driver readiness).
- **Lesson comments** with votes and delete-own, via a new migration (57 PGlite checks; three-learner UI test against the real SQL). The owner pasted `20261017000000_lane_lesson_comments.sql` into the hosted project; 10 hosted comment checks passed.
- **Algorithm check:** matches `algorithmforlaneapp.ts` on 20,000 random sessions (≤ 0.0001; engine rounds to 4 decimals). The PDF’s worked totals contain arithmetic slips; the tests record formula values.
- **Content pass:** all 24 lessons re-read; lesson 8 flashcard aligned to intersections without signs, lesson 15 harder option reworded, lesson 1 explanation rewritten in plain language.

## Not claimed

- Not tested on physical phones. Software rendering does not show real WebGL performance.
- Supabase is not live; RLS evidence is from PGlite (Postgres 18.3) with auth shims, not a hosted project.
- All quiz, similar/harder, activity and simulation content is draft pending human handbook review.
- Video creator names and license versions are not recorded; no captions exist.
- Privacy Policy and Terms are app-specific drafts with owner placeholders, not legal advice and not compliance claims.
