# Lane feature registry

Labels: **Verified** (built and exercised by a test or walkthrough) · **Implemented** (built, verification partial — reason given) · **Deferred** (intentionally later) · **Blocked** (needs an external fact or owner/content decision).

Updated 2026-10-15 at the end of the integration pass, then again after the owner's review that evening (branch `lane-integration`, uncommitted). Rows marked **rebuilt** changed after that review; see doc 06, "Owner review".

## Existing before this pass (re-verified)

| Feature | Status | Evidence |
| --- | --- | --- |
| Home: next lesson, week strip, goal sheet, lesson strip | Verified | `inspect-home`, `home-progress.test.mjs` |
| Feed: 19 video + 5 poster lessons, like/save/share, timer, California rule, About | Verified | `inspect-feed` (portrait + landscape, offline replay) |
| Quiz on real video `ended` | Verified | `inspect-feed`, `inspect-learning-flow` |
| Progress road, milestones, moving car | Verified | `inspect-progress`, `inspect-path-motion`, `inspect-progress-rewards` |
| Profile Garage, liked/saved | Verified | `inspect-profile` |
| Practice 46-question test | Verified | `inspect-practice` |
| Offline shell, video cache after `ended` | Verified | offline steps in `inspect-feed`, `inspect-home`, `inspect-progress` |

## This pass

| ID | Feature | Status | Evidence / note |
| --- | --- | --- | --- |
| A1 | Visual baseline + preservation audit | Verified | `docs/lane/00`, `inspect-baseline.mjs` before/after |
| A2 | Display-title cleanup, ID crosswalk, US wording | Verified | `content-crosswalk.test.mjs` |
| A3 | California rule dropdown | Verified (kept) | owner decision |
| A4 | Near-duplicate lessons flagged, none removed | Verified | doc 04 |
| B1 | Learner records in the store (settings, review, topics, watch, attempts, sims) | Verified | `learner-records.test.mjs` |
| B2 | Watch coverage + key part | Verified (rebuilt) | key segments for all 19 clips from the frame review (doc 10); `content-quality.test.mjs`, `watch-session.test.mjs` |
| B3 | ⋯ menu: I already know this / Review later / I need help | Verified | `inspect-learning-flow` |
| B4 | Miss → rule → similar → recovery | Verified | `inspect-learning-flow`, `inspect-feed`, `inspect-mobile` |
| B5 | "Are you sure?" on an early swipe (S ≥ 0.8) | Verified (rebuilt) | `inspect-learning-flow`, `inspect-feed`, phone matrix |
| B6 | A/W/N/T scoring, smoothing, priority, readiness (owner engine) | Verified (rebuilt) | `scoring.test.mjs`; drives check type, reinforcement and feed order |
| B6b | Feed planner: resume point, refresher, sims in the feed, card spacing, check type | Verified (new) | `planner.test.mjs`, learner journey |
| B6c | Corner timer = clip time, stops at the end | Verified (new) | `inspect-feed` |
| B7 | Launch routing | Verified (Home for everyone) | owner decision |
| B8 | `#/review` daily review, topic scores and reasons, Home Review later row | Verified (rebuilt) | `review.test.mjs`, `inspect-learning-flow`, learner journey |
| B9 | Poster-lesson 8 s quiz timer | Implemented (kept as is) | default; owner may change |
| B10 | Flashcards / glossary / permit posts | Implemented (rebuilt), drafts | in the feed and as checks; `content-quality.test.mjs`; human review pending |
| B11 | Emergency reference | Blocked | content is an unreviewed draft |
| B12 | No XP farming | Verified | `learner-records.test.mjs`, server `xp_events` uniqueness |
| C1 | 10 V4 packages vendored and organized | Verified | `simulation.test.mjs`, `vendor/lane-simulations/SOURCE.md` |
| C2 | Registry, host, outcome adapter | Verified | `simulation.test.mjs` |
| C3 | All 10 run inside feed cards (safe/unsafe/retry/timeout/exit, feed locked, fallback) | Verified (Chromium, rebuilt) | `inspect-simulations.mjs` |
| C4 | Old built-in simulator removed, `#/drive` redirect | Verified | `inspect-learning-flow` |
| C5 | SIM-02 after lesson 8, SIM-10 after lesson 10, SIM-07 placed by the planner | Verified (rebuilt) | `planner.test.mjs`, `inspect-simulations.mjs` |
| C6 | Checks rewritten to match each video | Implemented, drafts | doc 10; human handbook review pending |
| F1 | Sound button on video lessons | Verified (new) | `inspect-feed` |
| F2 | Fill-in-the-blank text lessons (the five without video) | Verified (new), drafts | `inspect-feed`, `content-quality.test.mjs` |
| F3 | Strict lesson order | Verified (new) | `planner.test.mjs` |
| F4 | Usernames, streak buddies, duo streak, Group leaderboard | Verified on PGlite (new) | `rls.check.mjs` 44/44, `inspect-buddies.mjs`; hosted project not yet migrated |
| F5 | No giveaway answer lengths anywhere (checks, follow-ups, activities, text lessons, Practice) | Verified (new) | `content-quality.test.mjs` |
| D1 | Migrations, RLS, validated write function, leaderboard RPC, delete RPC | Verified on PGlite | `supabase/tests/rls.check.mjs` 21/21, `supabase-schema.test.mjs` |
| D2 | Client without new dependency | Verified | fetch client; `sync.test.mjs` |
| D3 | Local-first sync + conflict policy | Verified (unit) | `sync.test.mjs`; no hosted project |
| D4 | Hosted Supabase project + two-user RLS there | Blocked | needs project and keys |
| E1 | Settings: permit date, nickname, sync status | Verified | phone matrix, field save check |
| E2 | Truthful leaderboard (Global first, Group unavailable) | Verified | `inspect-leaderboard` |
| E3 | Credits, Privacy, Terms screens | Verified | `legal.test.mjs`, phone matrix |
| E4 | Data inventory, credits register, owner inputs, release checklist | Verified | docs 07, 08, 09 |
| E5 | Viewport + phone audit | Verified | 5 viewports, 9 phones (WebKit + Chromium) |
| E6 | Excess-code cleanup | Verified | removed old simulator (≈1,800 lines), unused artwork, blank tab, unused learner ID, orphan CSS |
| E7 | Favicon | Verified | `public/favicon-32/64.png` |
| E8 | Feature verdict review | Verified | `docs/lane/FEATURE_VERDICT.md` |

## Deferred / excluded (not in this pass)

| Feature | Reason |
| --- | --- |
| Public comments, hazard posts, DMs, followers, chat, public likes | Out of scope; needs moderation design |
| Push notifications | Needs explicit consent implementation |
| Content CMS | Out of scope |
| Full offline video library | Later performance project |
| Group/class leaderboard model | No approved product model |
| Quiz-bank rewrite / Practice restructure / practice → topic evidence | Later quiz pass; topic IDs differ |
| Curriculum lessons 20–23 | No video files |
| Captions | No caption files |
| Resume playback position | Short clips; would weaken the safety check |
| Sound preference toggle | DESIGN.md: no sound toggle |
| Showing learning signals on Progress | Needs an owner design decision |
| Required sign-in, account linking, restoring data on a new device | Built last per CLAUDE.md |
| Terms agreement record (`legal_acceptances`) | Agreement not required |
