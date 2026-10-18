# 07 — Data and vendor inventory

Derived from the code on branch `lane-integration` (2026-10-15). The Privacy Policy (`src/legal/documents.ts`) is written from this table; `scripts/legal.test.mjs` fails if the sync payload and the policy drift apart.

**Remote sync is not configured in this build.** Rows marked "remote (when configured)" apply only after the operator sets `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` and applies the migration.

## On the device

| Data | Where | Source | Purpose | Created/used by | Required? | Deletion |
| --- | --- | --- | --- | --- | --- | --- |
| Lesson results: tries, first-try, done, completion time | `localStorage['roadloop-progress'].clips` | learner answers | progress, Home next lesson, Progress road, XP | `src/feed/progress.ts` via feed/review | needed for progress | clear site data |
| XP total, daily XP by date, daily goal | `.xp`, `.daily`, `.dailyGoal` | lesson completion | streak, goal, weekly XP | progress store | yes | clear site data |
| Liked / saved lessons | `.liked`, `.saved` | learner taps | Profile lists | feed rail | optional | unlike/unsave, clear site data |
| Car (and retired avatar) ownership, selection, spent XP | `.ownedCars`, `.selectedCar`, `.spentXp`, `.ownedAvatars`, `.selectedAvatar` | Garage purchases | personalization | Profile | optional | clear site data |
| First-session completion time | `.firstSessionCompletedAt` | first lesson completion | sent to settings when synced | feed | automatic | clear site data |
| Permit test date, nickname | `.settings` | Settings form | review length; leaderboard alias | `src/pages/settings.ts` | optional | Settings → clear field |
| Review Later list | `.reviewLater` | menu, safety check, misses, simulation exit/unsafe | daily review | feed, review, simulations | automatic | resolves when reviewed; clear site data |
| Topic records (mastery, attempts, skips, help) | `.topics` | answers, help, skips | review priority | feed, review | automatic | clear site data |
| Video watch coverage, key part seen, skips | `.videos` | video `played` ranges | safety check, review, attention signal | feed | automatic | clear site data |
| Quiz attempts (correct, kind, active time; last 300) | `.attempts` | answers | review selection, evidence | feed, review | automatic | clear site data |
| Simulation outcomes (last 200) | `.simulations` | package results | review, evidence (never XP) | `src/simulation/host.ts` | automatic | clear site data |
| Sync session token, last sync time | `localStorage['lane-auth']` | Supabase anonymous sign-in | resume sync | `src/data/sync.ts` | only when sync configured | Settings → Delete synced data; clear site data |
| Legacy simulator sound setting | `localStorage['amber-muted']` | removed simulator | none (no longer read) | — | — | clear site data |
| App shell, posters, simulations (precache) | Cache Storage `amber-<build>` | service worker | offline use | `src/sw.js` | automatic | browser |
| Watched lesson videos | Cache Storage `amber-videos-h264` | after a video reaches `ended` | offline replay | feed + `src/sw.js` | automatic | browser |
| Driver coach chat (questions, answers, cited quotes) | memory only (`src/coach/state.ts`), never storage | learner questions, coach answers | the open conversation | Practice, `#/practice/coach` | optional | New chat; closing or reloading Lane |

## Remote (when configured) — Supabase

| Table / function | Data | Purpose | Access |
| --- | --- | --- | --- |
| `auth.users` (Supabase) | anonymous user ID | identity for sync | Supabase Auth |
| `profiles` | nickname (validated), car ID | leaderboard display | own row read; written only via `sync_learner()` |
| `learner_settings` | permit date, daily goal, first-session time, reminders flag (reserved, false) | restore settings | own row |
| `content_progress` | per-lesson tries, first try, done, completion, watch ratio, key part seen | progress backup | own rows |
| `learning_events` | quiz attempts (client event ID, lesson, topic, kind, correct, active ms) | evidence | own rows |
| `topic_mastery` | topic records | review priority | own rows |
| `review_items` | Review Later items | daily review | own rows |
| `simulation_attempts` | scenario, outcome, action, seconds | evidence | own rows |
| `xp_events` | server-computed lesson XP (once per lesson) | weekly leaderboard | own rows; never client-written |
| `weekly_leaderboard()` | rank, nickname, car ID, weekly XP, is-you | leaderboard | learners with a nickname, plus the caller |
| `delete_my_data()` | — | erase caller's rows | caller only |

Not sent: XP totals, likes, saves, car purchases/spending, raw watch ranges. Supabase (vendor) may process IP address and device information in its own logs.

### Driver coach (added 2026-10-18; not yet deployed to the live project)

| Piece | Data | Purpose | Retention |
| --- | --- | --- | --- |
| `coach` Edge Function (`supabase/functions/coach`) | the question plus up to the last five questions and answers of the open chat; the learner's access token | answer the question | not stored; logs hold token counts and error types only |
| `coach_usage` table via `coach_take_turn()` | account ID, Pacific date, number of questions | 30-per-learner and 500-overall daily limits | rows deleted after 7 days; no direct access; kept by `delete_my_data()` so the limit can't be reset |
| Anthropic (vendor, Claude Sonnet 5.5) | the same conversation, the handbook text, and `metadata.user_id`: a SHA-256 hash of the account ID | write the answer | Anthropic's API terms: no training on API data; deleted within 30 days unless needed for its usage policy or the law (owner to confirm, `docs/legal/README.md`) |

## Not collected anywhere

Real name, email, phone, address, school, location, camera, microphone, contacts, advertising IDs, analytics, error reporting. Fonts are self-hosted. No third-party scripts.

## External links and sharing

- About sheet and Credits open YouTube source pages and dmv.ca.gov in a new tab (their policies apply).
- Share uses `navigator.share` or copies a lesson URL; Lane receives nothing back.

## Agreement records

Lane does not require agreeing to the Terms before use, so there is no `legal_acceptances` table and no "agreed" record. If the owner decides to require agreement, that is a separate, deferred feature (affirmative action, version + timestamp + learner ID only).
