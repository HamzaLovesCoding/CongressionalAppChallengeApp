# Supabase backend

Lane works fully on one device without this. With it, progress is backed up, the weekly Global leaderboard shows real, server-validated XP, and friends can compete on a code-group leaderboard.

## Lane's project

A project named **lane** exists in the owner's "Speech and Debate" organization (created 2026-10-15, region us-west-1):

- Project ref: `mtcphmkheqkzyvbvruey`
- URL: `https://mtcphmkheqkzyvbvruey.supabase.co`
- Publishable key: `sb_publishable__pmuPzEwWN6fzb4xBjEFaQ_Xs1QfJcq` (public by design; it ships in the app)

Status (2026-10-16): the owner pasted the foundation and streak-buddies migrations into the SQL editor and turned on anonymous sign-ins; 14 end-to-end checks then passed against the hosted project (sign-in, backup, XP once, unique usernames, buddy request and accept, duo streak, both leaderboards, helper functions closed, signed-out calls refused, own rows only, no direct writes, delete my data). The owner then pasted the **lesson comments** migration; 10 hosted comment checks passed (post, limits, username or Anonymous, votes, no self-votes, delete own only, signed-out and direct access refused). The self-upvote migration followed; 4 hosted vote checks passed. All four migrations are live. The agent’s Supabase connection can read the project, but its schema changes return `declined` without showing the owner a confirmation (the connector asks before statements such as `revoke` and `delete`), so migrations go through the SQL editor.

## Go live (three steps)

1. **Apply the migrations**, in order, in the project's SQL editor (Dashboard → SQL Editor → paste and run each file), or allow the connector’s `apply_migration` tool in claude.ai and ask the agent to apply them:
   - `migrations/20261015000000_lane_learner_foundation.sql`
   - `migrations/20261016000000_lane_streak_buddies.sql`
   - `migrations/20261017000000_lane_lesson_comments.sql`
   - `migrations/20261017010000_lane_comment_self_upvote.sql`
   - `migrations/20261018000000_lane_xp_needs_answer.sql` (lesson XP only after a correct answer is on the server)
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

## Verify

- Static checks: `node --test scripts/supabase-schema.test.mjs`.
- Behavior on real Postgres with three learners (60 checks: ownership, no direct writes, XP validation, idempotency, usernames, leaderboard fields, buddy requests/acceptance/privacy, duo streak, group leaderboard, helper functions closed to direct calls, lesson comments, deletion):

  ```sh
  npm install --no-save @electric-sql/pglite@0.5.8
  node supabase/tests/rls.check.mjs
  ```

- The app's streak-buddies screens against the same SQL (two browser learners): start `VITE_SUPABASE_URL=https://fake-lane.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=test npx vite --port 5174`, then `node scripts/inspect-buddies.mjs`.

  These use PGlite with small shims for Supabase's `auth.uid()` and roles. They are strong evidence but not a hosted-project test.

## Not in this version

Private messages, chat, comment moderation tools in the app (remove comments from the Supabase dashboard), class codes, push notifications, CMS, storing videos in Postgres, pulling remote data back onto a new device (needs real sign-in), generated database types.
