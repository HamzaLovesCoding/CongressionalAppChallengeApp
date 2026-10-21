# Hosting Lane on Manus

Last checked against `main` at `e4080b3` (October 20, 2026). This applies to any static host; the Manus-specific part is the prompt in step 5.

## What runs where

| Part | Where it runs | Status |
| --- | --- | --- |
| The app (HTML, JavaScript, images, 19 lesson videos) | **Manus**, as a static website | To do |
| Accounts, backups, leaderboards, comments, code groups | **Supabase** project `lane` (`mtcphmkheqkzyvbvruey`) | Live |
| Driver coach (AI) | Supabase Edge Function `coach`, which calls Anthropic | Live (deployed 2026-10-20, step 3) |

## 1. Every environment file and variable

Keep this table up to date whenever a variable is added.

| Variable | Where it goes | Secret? | Where to get the value |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | `.env.local` on your computer **and** the Manus build settings | No. It ends up in the public JavaScript. | Supabase Dashboard → Project Settings → Data API → Project URL (`https://mtcphmkheqkzyvbvruey.supabase.co`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same two places | No. Supabase designs it to be public; it starts with `sb_publishable_`. | Supabase Dashboard → Project Settings → API Keys → Publishable key |
| `VITE_SUPABASE_ANON_KEY` | Nowhere. It's the older name, read only when the publishable key is missing. | No | Leave unset |
| `ANTHROPIC_API_KEY` | `supabase/functions/.env` on your computer, then sent to Supabase as a secret (step 3) | **Yes.** Never put it in Manus, the app, a `VITE_` variable or git. | console.anthropic.com → API Keys |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Provided to the Edge Function automatically by Supabase | – | Nothing to do |
| `VITE_COACH_LOCAL_URL` | Never set it by hand; `npm run coach:local` sets it for local testing | – | – |

**Never give any of these to Manus or put them in the app:** the Supabase `service_role`/secret key, the database password, or the Anthropic key.

**Files:**
- `.env.example` (in git) is the template for `.env.local` (git-ignored, repo root).
- `supabase/functions/.env.example` (in git) is the template for `supabase/functions/.env` (git-ignored).
- `.gitignore` excludes `.env` and `.env.*` (except the examples), so the real files can't be committed by accident.

The `VITE_` values are **baked in at build time**. If you change them, rebuild and redeploy.

## 2. Check that the database is ready (Supabase SQL editor)

Run this query:

```sql
select proname from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('sync_learner', 'lane_today', 'post_comment', 'lane_xp_needs_answer',
                  'create_group', 'lane_xp_on_answer', 'coach_take_turn')
order by 1;
```

Each missing name means its migration hasn't been run. Paste that file from `supabase/migrations/` into the SQL editor and run it, oldest first:

| Missing name | Migration file to run |
| --- | --- |
| `sync_learner` | `20261015000000_lane_learner_foundation.sql` |
| `lane_today` | `20261016000000_lane_streak_buddies.sql` |
| `post_comment` | `20261017000000_lane_lesson_comments.sql`, then `20261017010000_lane_comment_self_upvote.sql` |
| `lane_xp_needs_answer` | `20261018000000_lane_xp_needs_answer.sql` |
| `create_group` | `20261019000000_lane_code_groups.sql` |
| `lane_xp_on_answer` | `20261021000000_lane_xp_on_answer.sql` |
| `coach_take_turn` | `20261022000000_lane_driver_coach.sql` (expected to be missing today) |

Also check that the global leaderboard change (`20261020000000_lane_global_board_everyone.sql`) is in place. This should return `true`; if it returns `false`, run that file:

```sql
select pg_get_functiondef('public.weekly_leaderboard(integer)'::regprocedure) like '%having sum%';
```

Also check **Authentication → Sign In / Providers → Allow anonymous sign-ins** is on (it was turned on 2026-10-16). No redirect URLs or CORS settings are needed for the Manus address: the app does no sign-in redirects, and Supabase's API accepts any website.

## 3. Turn on the Driver coach (on your computer)

**Done on 2026-10-20.** Repeat these steps only to change the key or redeploy after editing `supabase/functions/coach/`. Run the commands from **inside the project folder**: run from your home folder, they fail with "supabase/functions/.env: not found" and "Entrypoint path does not exist". To check a deploy without spending anything:

```sh
curl -s -X POST https://mtcphmkheqkzyvbvruey.supabase.co/functions/v1/coach -H "Content-Type: application/json" -d '{"messages":[{"role":"user","text":"hi"}]}'
```

`{"error":"unauthorized"}` means it's working (the test isn't signed in). `{"error":"not-configured"}` means the key secret is missing. A "not found" reply means the function isn't deployed.

1. Run `supabase/migrations/20261022000000_lane_driver_coach.sql` in the SQL editor if step 2 showed `coach_take_turn` missing.
2. Put the key in `supabase/functions/.env` (one line: `ANTHROPIC_API_KEY=sk-ant-…`).
3. From the repo folder:
   ```sh
   npx supabase login
   npx supabase secrets set --env-file supabase/functions/.env --project-ref mtcphmkheqkzyvbvruey
   npx supabase functions deploy coach --project-ref mtcphmkheqkzyvbvruey --no-verify-jwt --use-api
   ```
4. Set a monthly spend limit in the Anthropic Console (Settings → Limits). Expect about $0.015 per question, or $0.13 for the first one after five quiet minutes. The daily caps (30 per learner, 500 total) put the worst case at about $67 a day.

## 4. Build settings (tell Manus exactly these)

| Setting | Value |
| --- | --- |
| Source | GitHub `HamzaLovesCoding/CongressionalAppChallengeApp`, branch `main` (private repo, so Manus needs access) |
| Node.js | 22 (at least 22.12; 20.19+ also works) |
| Install command | `npm ci` |
| Build command | `npm run build`. **Not** `npm run build:test`, which removes the Supabase settings. |
| Output / publish folder | `dist` |
| Build environment variables | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (step 1) |
| Address | The **root** of a domain or subdomain (e.g. `lane.example.com/`). The build uses absolute paths (`/assets/…`), so a sub-folder like `/lane/` shows a blank page. |
| Redirect / rewrite rules | **None.** Routes are `#/home`, `#/feed/…`, so everything loads from `index.html`. Don't add a catch-all rewrite: it would break `/sw.js` and `/videos/…`. |
| HTTPS | Required (the offline service worker and Supabase need it) |

What the host must handle:
- **About 94 MB in 168 files.** The 19 videos in `/videos/` are 3–7.4 MB each.
- **Range requests** (`206 Partial Content`) for `.mp4` files. iPhone Safari won't play video without them. Test this on a real iPhone (step 6).
- If you can set headers: `/sw.js` → `Cache-Control: no-cache`, so updates are picked up; `/assets/*` → `Cache-Control: public, max-age=31536000, immutable`; `/manifest.webmanifest` → `Content-Type: application/manifest+json`.

**If Manus can't build from the private repo:** build on your computer and upload the result.

```sh
cp .env.example .env.local      # then fill in the two VITE_ values
npm ci
npm run build                   # creates the dist/ folder
```

Upload the **contents** of `dist/` (the files inside it, with `index.html` at the top level) as a static site.

## 5. Prompt to paste into Manus

> Deploy a static website from the GitHub repo HamzaLovesCoding/CongressionalAppChallengeApp, branch main. It is a Vite app.
> - Use Node.js 22. Install with `npm ci`. Build with `npm run build` (not `build:test`). Publish the `dist` folder.
> - Set these build environment variables before building: `VITE_SUPABASE_URL=https://mtcphmkheqkzyvbvruey.supabase.co` and `VITE_SUPABASE_PUBLISHABLE_KEY=<paste the publishable key>`. They are public values.
> - Serve it at the root of the domain (not a sub-folder), over HTTPS.
> - Do not add any rewrite or single-page-app fallback rules; the app uses hash routes (`#/…`). `/sw.js` and `/videos/*.mp4` must be served as the real files.
> - The `.mp4` files in `/videos/` must support HTTP range requests (206 Partial Content).
> - If possible, serve `/sw.js` with `Cache-Control: no-cache` and `/assets/*` with a long immutable cache.
> - Do not change any code. Reply with the live URL.

## 6. Check the live site (about 10 minutes)

1. Open the URL on an **iPhone (Safari)** and an Android phone or laptop. The welcome screens appear: choose a username, accept the Terms, pick a goal.
2. **Start lesson 1.** The video plays, the sound button works, and the quiz opens when the video ends.
3. Finish the lesson, wait about 10 seconds, then reload Home. **Weekly leaderboard → Global** shows your username and 10 XP. That proves backups reach Supabase.
4. Open **comments** on a lesson and post one. It appears with your username.
5. **Practice → Driver coach:** ask "Who goes first at a four-way stop?" You should get an answer with handbook page chips (only after step 3).
6. Turn on airplane mode and reopen the site. It still loads (offline mode).
7. Supabase Dashboard → Logs: no new 4xx/5xx errors from the site.
8. Optional: iPhone **Share → Add to Home Screen**, then open it from the icon. Known issue L13: the bell overlaps the lesson sign.

**Updating later:** push to `main` and redeploy on Manus (or rebuild and re-upload `dist/`). People who already visited get the new version the next time they open the app.

## 7. Known issues to fix before judging

- **H1:** fixed by deploying the coach (step 3). If the function is ever removed, the app's message would again wrongly say "You're offline".
- **H2:** someone whose first visit is a direct lesson link (`…/#/feed/<lesson>`), and who then likes or answers anything, never sees the welcome and Terms screens, but their data is still backed up. Share links to the home page, not to a lesson, until this is fixed.
- **M3:** on a laptop, the arrow keys don't move the feed until you click inside it.
