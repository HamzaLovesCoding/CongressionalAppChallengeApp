# 02 — Frontend → backend map

Each current screen or control, the data it needs, what happens locally today, what remote support it needs, and the test that proves it. "Local" means `src/feed/progress.ts`; remote goes through a sync adapter so local behavior never depends on the network.

| Screen / control | Data needed | Local today | Required remote behavior | Test |
| --- | --- | --- | --- | --- |
| App launch | first-session flag, next unfinished lesson, due review | Always opens Home | Read merged learner state; never block launch on network | planner unit test (fresh vs returning); launch walkthrough |
| Home · Next stop sign | next unfinished lesson | `clips` records | `content_progress` | existing `home-progress.test.mjs` + route test |
| Home · This week / goal ring | daily XP, goal | `daily`, `dailyGoal` | `learner_settings.daily_goal`; XP from validated `xp_events` | store test: goal persists; no XP on replay |
| Home · lesson strip | completion per lesson | `clips` | `content_progress` | existing |
| Home · Weekly leaderboard (Global) | own weekly XP, ranked safe rows | own XP only | `weekly_leaderboard` RPC returning rank, alias, car id, weekly XP | RPC field allow-list test; own row pinned |
| Home · Group tab | — | duplicates Global | none until a group model is approved | renders an accurate unavailable state |
| Home · menu sheet | links | repeats tabs | none | link test |
| Feed · video | watch ranges, key segment, ended | not tracked (cache only) | `content_progress` (ratio, key seen, last played) | watch coverage unit test; `ended` walkthrough |
| Feed · quiz | attempt, correctness, active time, kind | `answer()` → tries/firstTry/done | `learning_events` (append-only, client event ID), `topic_mastery` | attempt log test; idempotent event key test |
| Feed · like / save | lists | `liked`, `saved` | stays local (no public likes, PDF §7.1) | existing |
| Feed · share | — | `navigator.share` / copy | none | — |
| Feed · three-dots (new) | review queue, help, harder check | — | `review_items` upsert; `learning_events` | dedupe/reactivate test |
| Feed · early-leave gate (new) | key-segment status | — | `review_items` | gate-shown-only-before-key-segment test |
| Review route (new) | due review items, weak topics, recent | — | `review_items`, `topic_mastery` | daily review selection test |
| Practice | per-topic results | session-only | optional `learning_events` per topic (no XP, no completion) | existing `practice-score.test.mjs` + topic event test |
| Progress · road | completion, milestones, car | `clips`, `selectedCar` | `content_progress`, `profiles.car_id` | existing road/milestone tests |
| Profile · stats | XP, spendable, streak, first-try | store | derived from synced state | existing |
| Profile · Garage | owned/selected car, spent XP | store | `profiles.car_id`; ownership/spend stays local (no economy remotely) | existing `profile-progress.test.mjs` |
| Settings (new) | permit-test date, display alias, sync status | — | `learner_settings`, `profiles.alias` | alias sanitizer test; date boundary test |
| Simulation route (new) | scenario result, retry, exit | yellow-light only, results not stored | `simulation_attempts`; exit → `review_items`; safe → one evidence event, no duplicate XP | adapter test: `success:false` ≠ mastery |
| Credits / Privacy / Terms (new) | attribution registry, policy versions | — | none (static); `legal_acceptances` only if agreement is required | link + render-safety tests |

## Conflict policy (to implement and test)

- Local writes happen first and always succeed (or fail the same way they do today).
- Each event carries a client event ID (UUID). Remote inserts are idempotent on `(user_id, client_event_id)`.
- Counters and records merge by max/union: XP is recomputed from events, never overwritten by a smaller remote value; `done` is sticky; review items upsert by `(user_id, item_key)`.
- Empty or default remote data never overwrites non-empty local data.
- Sync status shown to the learner is one of: on this device only / synced / not synced (retrying).
