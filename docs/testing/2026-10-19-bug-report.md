# Lane — overnight test report (October 19, 2026)

**Tested:** commit `0eec65f` (the latest `main`), on branch `claude/app-testing-bug-report-pfwdaa`.
**Scope:** frontend, backend (SQL + live logs, read-only) and every major user flow, prioritized by what a judge is likely to hit.
**Nothing was fixed.** Each issue has a cause and a proposed fix for you to approve or reject. Item IDs (H1, M3, …) are stable, so you can reply with something like "do H1, H2, M3".

## Summary

| Severity | Count | Items |
| --- | --- | --- |
| High (a judge is likely to see it, or it breaks consent/privacy for minors) | 2 | H1, H2 |
| Medium (visible with some effort, data integrity, or safety design) | 8 | M1–M8 |
| Low (polish, edge cases) | 13 | L1–L13 |
| Test maintenance (the app is fine; the walkthrough is stale) | 6 | T1–T6 |

**No wrong answers were found.** I checked all 24 lessons (main check, follow-up, similar, harder, recall card) and the 43-question practice bank against the handbook text bundled in the repo (DL 600X, 2025). See [Content check](#content-check).

**What works well:** the build, all 173 unit tests and all 93 backend SQL checks pass. The core loop works with real video playback (video plays → real `ended` event → quiz → XP/streak/readiness/milestones update everywhere). So do the safety gate, two-miss recovery, "I already know this", Review later, text lessons, all 10 simulations (safe/unsafe/retry/timeout/exit and the no-WebGL fallback), practice test, Garage purchases, offline replay, code groups and comments (HTML is escaped; the profanity filter works). Random-input runs with phone and desktop profiles: see [Monkey testing](#monkey-testing).

---

## High

### H1 — Driver coach tells every user "You're offline" on the live backend
> **Status (2026-10-20): resolved for users.** The `coach` function and its key are now deployed. A test POST returns 401 instead of 404, so the preflight succeeds. Fix 2 (the misleading "offline" label when the function is missing) is still open but no longer visible.

- **What a judge sees:** Practice → *Driver coach (AI)* → ask anything → *"You're offline. The coach needs an internet connection."* with a Retry button. The device is online.
- **Evidence:** live Supabase logs show `/functions/v1/coach` returning **404** for both `OPTIONS` and `GET` (the function was never deployed; `CLAUDE.md` says "not deployed"). I reproduced the exact message against a local HTTPS stand-in that returns 404 like the live project. With a working function the same flow answers normally.
- **Cause:** the browser's CORS preflight gets a 404, so `fetch` throws a `TypeError` before any response can be read. `createClient().invoke()` turns every thrown fetch into `RemoteError('offline')` (`src/data/supabase.ts:59`), and `askCoach` maps that to the `offline` problem (`src/coach/client.ts:29`). The 404 → "not switched on" branch at `src/coach/client.ts:35` can never run in a browser.
- **Proposed fix (choose one or both):**
  1. Deploy the function before judging (owner steps in `supabase/README.md` → *Driver coach*). The API request shape is valid for `claude-sonnet-5-5` (`fallbacks: "default"` + `server-side-fallback-2026-07-01`, `output_config.effort: "low"`, ephemeral caching), so it should work once deployed with a key.
  2. Code: in `askCoach`, when `post()` throws and `navigator.onLine` is true, return `failed` (or `not-configured`) instead of `offline`. Also hide the coach card unless a build flag such as `VITE_COACH_ENABLED=1` is set, so an undeployed coach is never advertised. Related: L8.

### H2 — Opening a shared lesson link first skips onboarding, the Terms and the username forever, but server sign-in and backups still happen
- **Steps:** a new visitor opens a *Share lesson* link (`#/feed/after-collision`) → taps the heart (or saves or answers anything) → goes Home.
- **Result:** onboarding never appears again, so no username is chosen and the Terms/Privacy Policy are never accepted. Even so, the app signs in anonymously and calls `sync_learner` 10 s later. Opening the comments sheet alone signs in and fetches comments before any consent. Captured server calls with no Terms accepted: `auth:signup, lesson_comments_list, my_groups, weekly_leaderboard, sync_learner`.
- **Cause:** `needsOnboarding()` (`src/feed/progress.ts:307–310`) returns false as soon as *any* local activity exists (likes, saves, attempts), a rule meant for learners who predate onboarding. `main.ts:91` gates backups on that check, and `#/welcome` then redirects to Home (`main.ts:37`), so onboarding is unreachable. Comments, leaderboards, groups and the coach don't check consent at all.
- **Why it matters:** users are minors, and the code's own rule is "Nothing reaches the server before the learner has agreed to the Terms." The *Share* button is exactly how a judge or teacher is likely to pass Lane around.
- **Proposed fix:** make onboarding depend only on `settings.onboardedAt`. Grandfather existing learners once, e.g. store a `legacyLearner` flag in `load()` when the saved data predates the onboarding release. Gate *every* server call (backup, comments, leaderboards, groups, coach) on `onboarding().termsAcceptedAt`. A shared-link visitor can still watch the lesson; send them to `#/welcome` (then back to the lesson) before their first interaction that saves or sends anything.

---

## Medium

### M1 — A lost server session silently creates a new account; the username is then lost for good ("Someone else has your username now")
- **Evidence:** live auth logs show `refresh_token_not_found` three times in 24 h, each followed by a new anonymous sign-up (the cause of the token loss on Supabase is unknown: deleted test users, session settings, …). I reproduced it with the stand-in backend.
- **What happens:** `obtain()` falls back to `signInAnonymously()` (`src/data/sync.ts:95`) without re-claiming the username. The next group action calls `ensureUsername()`, but the old (orphaned) account still owns the name, so the server says `taken`. The app then shows *"Someone else has your username now"* (`src/home/content.ts:52`) and **clears the username on the device** (`sync.ts` `ensureUsername`). Meanwhile the old account keeps showing that name and its XP on the boards, and the new account receives all the learner's lesson XP again in the current week (XP events are created at sync time). Groups the learner belonged to disappear from their Home.
- **Proposed fix:** (1) when a renewal is rejected, set `pendingUsername` from the device's username before signing in again (as `deleteRemote()` already does). (2) Add a server function that lets a learner reclaim a name held only by an account with no live session or no activity for N days (or a one-time device "recovery" secret stored with the auth record). (3) Reword `nameTaken` so it doesn't blame "someone else". (4) Check the Supabase Auth session settings (inactivity timeout, refresh-token reuse interval) to find why refresh tokens are disappearing.

### M2 — When an account is deleted on the server, backups fail with HTTP 409 for up to an hour
- **Evidence:** 17 live `sync_learner` responses were 409 (01:35–01:59 UTC), and the database logged the matching error each time: `insert or update on table "profiles" violates foreign key constraint "profiles_user_id_fkey"`. I reproduced it locally.
- **Cause:** the access token is still valid but its user no longer exists. PostgREST maps the foreign-key error to 409, which the client treats as a generic `server` error and retries with the same token until it expires. Settings shows "couldn't back up just now" the whole time.
- **Proposed fix:** at the top of `sync_learner`/`set_username`, raise `42501` when `auth.users` has no row for `auth.uid()` (the client already re-authenticates on 401/403), or treat a 409 from `sync_learner` as `unauthorized` in `request()`. Then M1's fix restores the username.

### M3 — On a laptop, the arrow keys and Page Down don't move the feed until you click inside it
- **Steps:** Home → *Start lesson* (or open any lesson link) → press ↓ or Page Down → nothing happens. Focus is on `<body>`, and the key handler is attached to the app root (`src/feed/feed.ts:838`). The mouse wheel and trackpad work. After a quiz closes, the feed is focused and the keys work.
- **Proposed fix:** at the end of `mountFeed` (`feed.ts:865`), call `feed.focus({ preventScroll: true })`, or listen for `keydown` on `document` while the feed is mounted (ignoring text inputs and open dialogs).

### M4 — Lessons queued after a missed answer never appear on the Review page
- `CLAUDE.md` says missed answers "return through today's review on `#/review`, listed separately from saved lessons", but `src/pages/review.ts:22` lists only saved lessons (`savedEntries()`). A missed lesson only comes back as a feed revisit after every third lesson, and Home doesn't mention it either. A learner who wants to review what they got wrong has no way to find it.
- **Proposed fix:** add a "Missed answers" list to `#/review` built from `reviewQueue()` items with reason `missed` that point to lessons (link to `#/feed/<id>`, or include them in the review quiz). Otherwise, correct `CLAUDE.md`.

### M5 — Comment safety for a teen audience depends on the app alone
- Moderation runs only in the browser (`src/feed/moderation.ts`, as its own comment says); `post_comment` checks only length and rate. Phone numbers, emails and addresses post fine (tested: "My number is 415-555-0199 text me" → *Posted*). There is no Report/Hide control and no owner moderation tool.
- **Proposed fix:** move the word filter into `post_comment` (SQL) and add patterns for phone numbers, emails and street addresses. Add a *Report* action (`comment_reports` table, auto-hide after N reports, owner review query). Mention this in the Privacy Policy.

### M6 — The "similar" and "harder" questions are guessable: the answer is usually B, and on similar questions almost never C
- Among the 3-option follow-up questions, the correct answer is **B in 15 of 24** similar questions (C only once) and **B in 14 of 24** harder questions. These questions drive recovery, "I already know this" (which skips the lesson and awards XP) and the whole Review quiz. The main checks are balanced (A 2, B 7, C 9, D 6), and so is the practice bank.
- **Proposed fix:** shuffle option order at render time in `renderQuestion` and the review page, remapping the answer index (the simplest fix, and it also covers future content), or rebalance the data. Add a `content-quality` test that fails if any position holds more than 50%.

### M7 — The Terms of Service shown to users still contain an unfinished sentence
- `src/legal/documents.ts:90`: *"Governing law and any limitation of liability will be added after legal review, before public release."* It appears inline during onboarding and at `#/terms`, where judges reviewing privacy and terms will see it.
- **Proposed fix (owner decision):** finalize these sections, or rephrase so it doesn't read as a placeholder.

### M8 — Practice advertises the AI coach even when it can't work
- In a build without the backend, Practice shows a *Driver coach (AI)* card that says "This version of Lane isn't connected to its server, so the coach is off." In a backend build without the function deployed, see H1. Either way, judges see a headline feature that doesn't work.
- **Proposed fix:** don't render `coachSection()` unless the coach is actually available (build flag, or a one-time health check of the function). This is the same flag as H1, fix 2.

---

## Low

| ID | Issue | Cause / where | Proposed fix |
| --- | --- | --- | --- |
| L1 | Usernames lose letters with no warning: "José García" → `Jos_Garca`. | `cleanAlias` (`progress.ts:259`) uses NFKC and then strips all non-ASCII. | Use NFKD and remove combining marks first ("José" → "Jose"), and show "Saved as …" when the name changed. |
| L2 | A permit-test date in the past is accepted ("Saved."), and Profile then shows it as a fact. | `setPermitTestDate` validates the format only. | Reject dates before today, or show "Your test date has passed. Update it?". |
| L3 | Settings → Main goal → "Something else" has no text box, so the learner's note can't be added or changed there. | `src/pages/settings.ts:63` keeps the old note. | Show the same text box as onboarding when "Something else" is picked. |
| L4 | On Review → *Your topics*, two topics appear in lowercase: "vehicle control", "emergency vehicles". | `TOPIC_NAMES` (`src/pages/content.ts:30`) lacks `vehicle-control` and `emergency-vehicles`. | Add both names, and a test that every lesson topic has a name. |
| L5 | Lesson titles mix styles: the five text lessons use sentence case ("When the light turns yellow"); the 19 video lessons use Title Case. | `src/feed/clips.ts`. | Pick one style (title IDs unchanged). |
| L6 | A malformed saved-progress store blanks most screens (e.g. `saved: null` → *"h.saved is not iterable"*; Home, Feed, Review and Settings render empty, with no way out except clearing site data). Only reachable with corrupted data. | `load()` (`progress.ts:46–49`) spreads raw JSON over defaults without type-checking `liked`/`saved`/`clips`/`daily`/`xp`. | Validate those five fields in `load()` like the newer fields are. |
| L7 | Home sends `my_groups` twice on every visit (leaderboard and bell each fetch it); visible in the live logs as paired calls. | `leaderboard.ts` `loadGroups` and `notifications.ts` `loadGroups`. | Share one groups/boards fetch per Home mount. |
| L8 | `#/practice/coach` renders the full chat (prompts and input box) even when the coach is unavailable; it fails only after you ask. | `src/coach/chat.ts` doesn't check `coachAvailable()`. | Redirect to `#/practice` or show the unavailable state up front. |
| L9 | 37 of 72 handbook citations in `src/content/learning.ts` (similar/harder questions) have no page number, and they appear under answers. | Data. | Add page numbers (`CLAUDE.md` asks for the DL 600X page). |
| L10 | Saving a lesson from the "Are you sure?" sheet before watching it puts it into *Today's review*, which then asks a question about "the video" the learner hasn't seen. | `savedReview` includes unfinished lessons. | Leave unwatched lessons out of the review quiz (list them, but don't quiz them) until the lesson is done. |
| L11 | Desktop presentation: the app is a 430 px column on a plain white page. It's intentional per `DESIGN.md`, but it looks unfinished on a judge's laptop. | `--lane-surround: #fff` (`src/theme.css:13`). | Optional: use the cream surround colour or a subtle phone frame on wide screens. |
| L12 | Home bell → "Add your permit test date" opens Settings, but Settings' back arrow always goes to Profile, not back to Home. | `back: '#/profile'` is fixed in `src/pages/settings.ts`. | Use `history.back()` when the previous entry is inside the app, falling back to Profile. |
| L13 | When Lane is installed to an iPhone home screen (notch inset 59 px), Home's bell button overlaps the "Lesson N" tab of the next-lesson sign. Seen with the project's own inset emulation (`inspect-mobile`, *iphone-15-home-screen*). | `.home-toolbar` (`src/home/home.css:17`) has `height:88px` *and* `padding-top:env(safe-area-inset-top)` under `box-sizing:border-box`, leaving 29 px for the 44 px bell. | `height: calc(88px + env(safe-area-inset-top))` (or `min-height`). |

---

## Test maintenance (the app is fine; the walkthrough is out of date)

| ID | Walkthrough | Why it fails | Fix |
| --- | --- | --- | --- |
| T1 | `inspect-first-try.mjs` | Expects Terms "Version 1.0"; the app ships 1.1 (coach update). | Update the expected version. |
| T2 | `inspect-progress-rewards.mjs:42` | `.path-medals .is-earned` matches the `<li>` *and* the rosette `<span>` inside it, so it counts 2 per medal. | Use `.path-medals > li.is-earned`. |
| T3 | `inspect-leaderboard.mjs` | Expects "Weekly rankings are coming soon", which was removed on purpose. | Assert the local "You" row instead. |
| T4 | `inspect-feed.mjs:146` | Asserts text lessons have no timer, but the later feed-visit timer (owner, 2026-10-17) is on every card. `CLAUDE.md` still says "No timer … on them". | **Owner decision:** hide the timer on text lessons, or update the test and `CLAUDE.md`. |
| T5 | `inspect-garage-feedback.mjs` | Hard-codes `http://localhost:5173`. | Use `BASE`/`DEV_BASE` like the others. |
| T6 | All walkthroughs | Chromium path hard-coded to the Mac; several also need WebKit. | Default to Playwright's bundled browsers when `CHROMIUM` is unset. |

With T4's assertion skipped, `inspect-feed` passes in portrait and landscape (playback, ended → quiz, citation, offline replay, gate, recovery, challenge Exit, repeat visit, reduced motion).

---

## Before judging: deployment checklist

These aren't code bugs, but each one can sink a demo.
1. **Coach:** deploy it (`supabase/README.md` → *Driver coach*) or hide it (H1/M8). Today a backend-connected build shows a broken coach.
2. **Hosting path:** the build uses absolute URLs (`/assets/…`, `/fonts/…`, `/manifest.webmanifest`). Host at a domain root (Vercel, Netlify, Cloudflare Pages, a custom domain). On a GitHub Pages *project* URL (`…github.io/<repo>/`), set `base` in `vite.config.ts` or the page will be blank.
3. **Backend variables:** a production build needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` at build time. Without them the leaderboards show only "You", comments say "coming soon", and Groups are unavailable.
4. **Real iPhone pass:** Safari could not be tested here (see Limits). Check first-video autoplay with sound, the sound button, offline replay of a watched clip, and the home-screen install (L13).
5. **Test accounts:** if you delete demo accounts on Supabase while devices are signed in, those devices hit M1/M2. Clear site data on demo devices afterwards.

## Working as designed, but judges will notice

These aren't bugs, and I'm not proposing changes. They're the moments a judge is most likely to remark on, so you can be ready for them.
- **The "Are you sure?" sheet appears on most swipes.** 16 of the 19 video lessons (and all five text lessons) have safety ≥ 0.8, so a judge flicking through the feed to "see what's there" meets it on almost every card until they finish a lesson. If you want a lighter demo, consider showing it once per session per learner, or only from the second skip.
- **Lessons start with sound on**, which can be loud in a judging room. The sound button is remembered.
- **The Feed tab can open on a challenge instead of the lesson Home points to** for a returning learner on a new day (the "refresher" slot). Home's *Continue lesson* always opens the right lesson.
- **Skipping to the end of a video gives a "Quick recall" card before *Lesson complete*** (the session scores as "developing"). That's the learning model working, but a judge who scrubs ahead may read it as an extra step.

## Content check

The bundled handbook text (`supabase/functions/coach/handbook.ts`, DL 600X 2025) was searched for every rule I checked. All correct, including: scan 10 s ahead; collision → move out of traffic, then call 911; SR 1 within 10 days over $1,000; freeway breakdown → exit right, stay belted inside; red/white curbs; dark signal = all-way stop; 300 ft behind emergency vehicles; move over for stopped emergency vehicles; T-intersection through traffic; dim high beams within 500/300 ft; low beams in fog; 3 ft for bicyclists; bike lane within 200 ft of a turn; 300 ft gap to merge on the highway; blind intersection 15 mph; packed snow → half speed; wet → 5–10 mph slower; tailgater → keep speed, merge right; leave room to see the rear wheels ahead; roundabouts (counterclockwise, yield, don't stop or pass); school bus rules including divided/multilane highways; flashing yellow; yellow arrow while turning. In the practice bank: following distance, double-double yellow barrier, evading police, left turns one-way to one-way, SR 1, school zone 25 mph, railroad 15 mph, out-of-state registration 20 days, left on red, passing on the right.

Content notes (not errors): M6 (answer positions) and L9 (missing page numbers).

## Walkthroughs and layout audits (Chromium)
- **Pass:** `inspect-home`, `inspect-progress`, `inspect-path-motion`, `inspect-profile`, `inspect-practice` (all 43 questions), `inspect-learning-flow`, `inspect-home-readiness`, `inspect-home-motion`, `inspect-groups`, `inspect-coach`, `inspect-simulations` (all 10), the Chromium half of `inspect-notifications`, and `inspect-feed` with T4's assertion skipped.
- **Fail because the test is stale:** T1–T5.
- **`inspect-baseline`** (every route at 360/375/390/768/1366 px, Chromium-only copy): 109 screens, no horizontal overflow, blur or clipping. One sub-44 px target: "Close lesson list" on desktop Profile.
- **`inspect-mobile`** (Chromium-only copy; iPhone SE, iPhone 15 installed to the home screen, Galaxy S8; fresh and progressed learners; 251 screenshots of every screen and dialog): 0 errors. One note: the CC BY 3.0 link on Credits is 15–33 px tall. Visual review found L13.

## Backend checks
- `node supabase/tests/rls.check.mjs`: **93/93 pass** (RLS, XP rules, comments, groups, coach limits, delete-my-data).
- Live project, read-only log review (no writes): see H1, M1, M2 and L7. Every other RPC returned 200. All traffic in the last 24 h came from `localhost` dev servers, so **no deployed site is using the backend yet**.
- The coach Edge Function verifies the caller through `coach_take_turn` as the learner, so deploying with `--no-verify-jwt` is safe; per-learner (30/day) and global (500/day) caps bound cost.

## Monkey testing
Ten randomized runs, about **6,250 random actions** in total: seven phone runs (390×844 touch), two desktop runs (1280×800) and one phone run against the backend-connected build (stand-in server). Actions were random taps on any visible control, typing into fields, swipes, arrow/Escape/Tab/Enter/Space, seeking videos to their end, Back/Forward, reloads, and jumps to 21 routes, including old redirects (`#/sim/…`, `#/drive`, `#/buddies`) and invalid ones (`#/nonsense/route`, `#/feed/not-a-lesson`). After every action the run checked for page errors, console errors, a blank screen, lesson XP ≠ 10 × completed lessons, and XP spent > XP earned.

**Result: no findings.** No page errors, no blank screens and no broken invariants. Invalid routes fall back to the feed. Honest limit: random tapping rarely finishes a lesson (most runs ended with 0–1 lessons done), so lesson completion, XP and recovery were covered by the targeted scripts above, not by the monkeys. (Four lines in seed 6's log are the harness pressing Back past the app's first page, not an app issue.)

## How this was tested, and limits
- Chromium (Playwright's build) only. **WebKit/Safari could not be downloaded in this environment**, so Safari-specific behaviour (autoplay with sound, byte-range video playback, offline video) is **untested**. Please check those on a real iPhone. iPhone screen sizes and notch insets were checked only by emulation in Chromium (Chromium-only copies of `inspect-mobile` and `inspect-baseline`). `inspect-profile-states`, `inspect-video-load` and the WebKit half of `inspect-notifications` did not run.
- This Chromium can't decode H.264, so for playback tests I served WebM transcodes of the 19 clips in place of the MP4s (test copies only; nothing in `public/` changed). With the real MP4s, a clip that can't play falls back to its poster and an 8-second timer, which I also verified.
- The live Supabase project was **not written to** (as `CLAUDE.md` asks). Backend behaviour was exercised with the PGlite SQL suite and a local HTTPS stand-in that mimics the failure modes seen in the live logs.
- The coach was not run against the real Claude API (no key here); its request parameters were checked against the current API reference.
