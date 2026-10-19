# Overnight test run: progress notes (2026-10-19)

Working notes so an interrupted run can resume. The final, prioritized report replaces this file.

Tested commit: `0eec65f` (latest `main`).

## Done
- Baseline: `npm run build:test` OK; `node --test scripts/*.test.mjs` 173/173; `rls.check.mjs` 93/93.
- Walkthroughs (Chromium only; WebKit can't be downloaded here): home, progress, path-motion, profile, practice, learning-flow,
  home-readiness, home-motion, groups, coach, simulations (all 10) pass. Stale: first-try (Terms v1.0), progress-rewards
  (selector double-counts), leaderboard ("coming soon"), feed (text-lesson timer spec conflict). garage-feedback needs dev :5173.
- Live Supabase logs (read-only): sync_learner 409s (profiles FK, deleted user), refresh_token_not_found → new anon accounts,
  /functions/v1/coach 404 (incl. OPTIONS preflight).
- Custom judge-path scripts (scratchpad): first lesson with real playback, 10-item run, gate, two misses, know-it, reload/back,
  text lesson, desktop/tablet, keyboard, coach vs 404 backend, session loss, shared-link first visit, comments.

## Confirmed findings so far
1. Coach shows "You're offline" when the function isn't deployed (preflight 404 → fetch TypeError → 'offline').
2. Shared lesson link as first visit + any like/save/answer skips onboarding forever: no Terms, no username, yet anonymous
   sign-in and backups run. Opening comments signs in before consent.
3. Rejected session renewal → silent new anonymous account, username not re-claimed; group actions then say
   "Someone else has your username now"; old account keeps the name (and its XP) on boards.
4. Deleted account → sync_learner 409 retried until token expiry.
5. Desktop: ArrowDown/PageDown don't move the feed until something inside it is clicked (focus on body).
6. Similar/harder questions: correct answer is B in 15/24 and 14/24 (3 options), so guessable.
7. Terms text still says governing law/liability "will be added after legal review, before public release".
8. Comments: moderation is client-only; phone numbers etc. post fine; no report control.

## Next
- Monkey test, Profile/Settings/Practice/Notifications/all-complete, landscape, offline, content accuracy, write report.
