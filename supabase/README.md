# Supabase backend

Lane works fully on one device without this. With it, progress is backed up, the weekly Global leaderboard shows real, server-validated XP, and friends can compete on a code-group leaderboard.

## Lane's project

A project named **lane** exists in the owner's "Speech and Debate" organization (created 2026-10-15, region us-west-1):

- Project ref: `mtcphmkheqkzyvbvruey`
- URL: `https://mtcphmkheqkzyvbvruey.supabase.co`
- Publishable key: `sb_publishable__pmuPzEwWN6fzb4xBjEFaQ_Xs1QfJcq` (public by design; it ships in the app)

Status (2026-10-16): the owner pasted the foundation and streak-buddies migrations into the SQL editor and turned on anonymous sign-ins; 14 end-to-end checks then passed against the hosted project (sign-in, backup, XP once, unique usernames, buddy request and accept, duo streak, both leaderboards, helper functions closed, signed-out calls refused, own rows only, no direct writes, delete my data). The owner then pasted the **lesson comments** migration; 10 hosted comment checks passed (post, limits, username or Anonymous, votes, no self-votes, delete own only, signed-out and direct access refused). The self-upvote migration followed; 4 hosted vote checks passed. All four migrations are live. The agent’s Supabase connection can read the project, but its schema changes return `declined` without showing the owner a confirmation (the connector asks before statements such as `revoke` and `delete`), so migrations go through the SQL editor.

## Go live (three steps)

Update (October 18, 2026): `20261021000000_lane_xp_on_answer.sql` was applied to the live Lane project through the SQL editor. The `xp_on_answer` trigger on `public.learning_events` was verified as installed and enabled. Same-backup XP behavior passed the local Postgres checks; no hosted test learners were created for this change. The four-account cleanup below remains a manual operation.

1. **Apply the migrations**, in order, in the project's SQL editor (Dashboard → SQL Editor → paste and run each file), or allow the connector’s `apply_migration` tool in claude.ai and ask the agent to apply them:
   - `migrations/20261015000000_lane_learner_foundation.sql`
   - `migrations/20261016000000_lane_streak_buddies.sql`
   - `migrations/20261017000000_lane_lesson_comments.sql`
   - `migrations/20261017010000_lane_comment_self_upvote.sql`
   - `migrations/20261018000000_lane_xp_needs_answer.sql` (lesson XP only after a correct answer is on the server)
   - `migrations/20261019000000_lane_code_groups.sql`
   - `migrations/20261020000000_lane_global_board_everyone.sql`
   - `migrations/20261021000000_lane_xp_on_answer.sql` (awards a waiting completion as soon as its correct answer arrives, in the same backup; keeps the answer guard and one-award limit)
   - `migrations/20261022000000_lane_driver_coach.sql` (daily question limits for the driver coach; see "Driver coach" below)
2. **Allow anonymous sign-ins**: Dashboard → Authentication → Sign In / Providers → turn on **Allow anonymous sign-ins**. Learners never type an email or password; each device gets an anonymous account.
3. **Point the app at it**: create `.env.local` (gitignored) with

   ```
   VITE_SUPABASE_URL=https://mtcphmkheqkzyvbvruey.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable__pmuPzEwWN6fzb4xBjEFaQ_Xs1QfJcq
   ```

   then `npm run build`. Use the same two variables in the hosting service's environment settings. **Never** put the service-role key in any `VITE_` variable, the repo, or the browser.

After that, run the Supabase security advisor (Dashboard → Advisors) and repeat the allow/deny checks below against the real project.

## What the migrations do

- **Foundation:** tables for profile, practice days, settings, lesson progress, quiz events, topic mastery, Review Later, simulation attempts and XP events, all with row level security; learners **read only their own rows** and never write tables directly.
  - `sync_learner(payload)` (security definer, `search_path` pinned) is the only progress write path. It takes the user from `auth.uid()`, validates lessons/scenarios/outcomes against allow-lists, clamps numbers and dates, is idempotent on client event IDs, never lets progress shrink, and grants each catalog lesson's XP once.
  - `set_username(name)` claims a username: 3–20 letters, numbers, `-` or `_`, unique ignoring case; returns `ok`, `taken` or `invalid`. Sync never sets it.
  - `weekly_leaderboard(max_rows)` returns only rank, username, car ID, weekly XP (Monday 00:00 Pacific) and is-you. A learner appears to others once they have XP that week: their username (required at onboarding), or Anonymous if the account has none, such as an older save or a name claimed first by someone else.
  - `delete_my_data()` erases the caller's rows, including buddy links and practice days (the anonymous auth user itself needs the service role).
- **Streak buddies (no longer used by the app since 2026-10-17; the code-group leaderboard replaced them):** `buddy_links` (one row per pair, `pending` or `accepted`), readable only by the two learners in it.
  - `request_buddy(username)` by exact name only (no search); returns `sent`, `accepted` (they had asked you), `already`, `not-found`, `self`, `need-username`, `limit` or `invalid`. Limits: 20 pending requests, 50 buddies.
  - `respond_buddy(link_id, accept)`, `remove_buddy(link_id)`.
  - `my_buddies()` returns username, car, relation, duo streak (consecutive Pacific days both practiced), whether each practiced today, and the buddy's weekly XP. Pending requests show only the username.
  - `group_leaderboard()` ranks the caller and accepted buddies by weekly XP.
  - Code groups (`20261019000000_lane_code_groups.sql`): `create_group()` returns a 6-character code, `join_group(code)`, `leave_group(code)` (the last member out deletes the group), `my_groups()`, and `code_group_leaderboard(code)` for members only. A username is required to make or join one; no free text, no group search.
- **Lesson comments:** `lesson_comments` and `comment_votes`, no direct access.
  - `lesson_comments_list(lesson)` returns, newest first (100 max): id, author username (null shows as Anonymous), text, time, score, your vote, whether it is yours.
  - `post_comment(lesson, message)` returns `ok`, `invalid` (empty, over 300 characters or unknown lesson) or `limit` (30 per learner per 24 hours); whitespace is collapsed.
  - `vote_comment(comment, vote)` takes 1, -1 or 0 (clear), one vote per learner; on your own comment only an upvote (`20261017010000`).
  - `delete_comment(comment)` deletes only your own; its votes go with it. There is no edit function.
  - `delete_my_data()` also removes your comments and votes. Remove an abusive comment from the dashboard (Table editor → lesson_comments).

## Driver coach (AI)

The coach on Practice is answered by the `coach` Edge Function (`functions/coach/`), which keeps the Anthropic API key on the server. The app never sees the key: anything in a `VITE_` variable ships inside the app's JavaScript, where anyone could copy it.

Status (2026-10-18): built and tested against stand-ins only. The migration, the secret and the function are **not** on the live project yet.

**Try it on this computer first** (no deploy, nothing sent to the live project): paste the key into `functions/.env`, run `npm run coach:local`, and open http://127.0.0.1:5180/#/practice. It runs the same handler under Deno (downloaded through npx the first time) on 127.0.0.1:8788 and a dev build of the app without Supabase settings. The key is re-read on every question, so no restart is needed after pasting it. Real questions are billed to the key.

1. **Apply** `migrations/20261022000000_lane_driver_coach.sql` in the SQL editor (it uses `lane_today()` from the streak-buddies migration, which is live).
2. **Paste the key** into `functions/.env` (gitignored; `functions/.env.example` is the template): `ANTHROPIC_API_KEY=sk-ant-…`
3. **Send the key and deploy** from the repo root (the CLI runs through npx; `--use-api` needs no Docker):

   ```sh
   npx supabase login
   npx supabase secrets set --env-file supabase/functions/.env --project-ref mtcphmkheqkzyvbvruey
   npx supabase functions deploy coach --project-ref mtcphmkheqkzyvbvruey --no-verify-jwt --use-api
   ```

   `--no-verify-jwt` is deliberate: the function checks the learner itself by calling `coach_take_turn()` with the learner's token, which works with any JWT signing key setup. Without a key the function answers `not-configured` and the app says the coach isn't switched on yet.
4. **Set a spend limit** in the Anthropic Console (Settings → Limits). The daily caps below bound normal use; the Console limit is the backstop.
5. **Check it**: ask the coach a question on Practice, then open Dashboard → Edge Functions → coach → Logs. Each answer logs one line of token counts (never the question or answer). A second question within five minutes should show `cache_read_input_tokens` near the handbook's size, meaning the handbook was read from the prompt cache.

How it works:

- Model `claude-sonnet-5-5`, effort `low`, at most 4,096 output tokens. The system prompt (`functions/coach/prompt.ts`) keeps answers short, handbook-based, age-appropriate and on driving; it stops anyone who says they're driving and never predicts a pass.
- The handbook goes with every question as a cited document (`functions/coach/handbook.ts`, about 90,000 characters, built by `scripts/extract-handbook.mjs` from the DMV PDF). It's cached for 5 minutes and shared by every learner, so only the first question after a quiet spell pays to load it. Citations come back as handbook page numbers with the quoted lines, which the app lists under each answer.
- Server-side fallback (`fallbacks: "default"`) retries a request Anthropic's safety classifiers decline on another model where one applies; anything still declined shows "can't help with that one".
- `coach_take_turn()` counts each question: **30 per learner per Pacific day, 500 for everyone together**. Change the numbers in the function and re-run it to adjust. Counts older than a week are deleted; `delete_my_data()` leaves them (it would otherwise reset the limit).
- Nothing the learner types is stored. The app sends the last five exchanges as context; Anthropic receives a one-way hash of the account ID as `metadata.user_id`.
- Rough cost (Sonnet 5.5: $2 input, $10 output, $2.50 cache write, $0.20 cache read per million tokens; handbook about 25,000 tokens): about $0.01 per question while the cache is warm, about $0.07 for the first question after five quiet minutes. 500 cold questions in a day would be roughly $35, which is why the Console spend limit matters.

## Verify

- Use `npm run build:test && npm run preview:test` for browser walkthroughs. The separate `dist-test/` build clears every Supabase setting, including those from `.env.local`; regular production builds remain connected when configured.
- The one-off October 18 test-account cleanup is `maintenance/20261018_remove_demo_test_learners.sql`. It checks and deletes only the four UUIDs read from the live dashboard, with cascading learner data and the two comments owned by `yob`. It is separate from migrations and must be run manually; do not apply it to other environments.
- Static checks: `node --test scripts/supabase-schema.test.mjs`.
- Behavior on local Postgres with four learners (84 checks: ownership, no direct writes, same-backup XP, answer/completion arrival order, idempotency, usernames, leaderboard fields, buddy requests/acceptance/privacy, duo streak, code groups, helper functions closed to direct calls, lesson comments, deletion):

  ```sh
  npm install --no-save @electric-sql/pglite@0.5.8
  node supabase/tests/rls.check.mjs
  ```

- The app's streak-buddies screens against the same SQL (two browser learners): start `VITE_SUPABASE_URL=https://fake-lane.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=test npx vite --port 5174`, then `node scripts/inspect-buddies.mjs`.

  These use PGlite with small shims for Supabase's `auth.uid()` and roles. They are strong evidence but not a hosted-project test.

- The coach without spending the key: `node --test scripts/coach.test.mjs` (request shape, caching, citations, validation), `node supabase/tests/rls.check.mjs` (daily limits on Postgres), and `node scripts/inspect-coach.mjs` (every chat state against a stand-in backend; needs the fake-backend dev server on 5175).

## Not in this version

Private messages between learners, saved coach conversations, comment moderation tools in the app (remove comments from the Supabase dashboard), class codes, push notifications, CMS, storing videos in Postgres, pulling remote data back onto a new device (needs real sign-in), generated database types.
