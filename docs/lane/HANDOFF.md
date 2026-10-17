# Lane integration — status (2026-10-15, after the owner's review)

The master-prompt integration and the owner's follow-up feature review are **finished** on branch `lane-integration`. **Nothing is committed** (the owner has not asked). `git stash@{0}` still holds the owner's earlier local work; it was fully used as the port source and can be dropped only if the owner says so.

The owner reviewed the app on the evening of 2026-10-15 and found the learning flow broken (no quiz on scroll, lesson 1 reappearing, timer, sims on a separate page, no flashcards, quizzes not matching videos). That was reproduced and rebuilt; see doc 06 "Owner review" and doc 10 (content index).

2026-10-16: sound button, fill-in-the-blank text lessons, strict lesson order, usernames + streak buddies + Group leaderboard, copy pass, and the Supabase project **lane** created (empty: migration apply was declined). Go-live steps: `supabase/README.md`. Details: doc 06 "Owner requests, 2026-10-16".

Read in this order: `10-content-index.md` → `06-implementation-and-verification-report.md` (what changed, final results, corrections, non-claims) → `FEATURE_REGISTRY.md` → `FEATURE_VERDICT.md` → `09-privacy-and-terms-owner-inputs.md` (owner checklist).

## Owner decisions in force

Home launch for everyone · California rule dropdown kept · only the 10 new simulation packages (old simulator deleted) · Settings / Review / Credits in the Home menu · full-screen Feed kept · Supabase built without a live project, plain `fetch` client (no new dependency) · owner favicon.

Owner answers (2026-10-15 evening): quiz only after the whole video, "Are you sure?" on an early swipe from an important lesson; flashcard or glossary instead of a quiz by severity; algorithm-ordered feed that resumes from the device and can put a sim in a video's place; clip-time timer; SIM-07 as its own feed item; readiness uses the owner's labels with the disclaimer in Settings/Terms.

Defaults I chose (owner can override): poster-lesson 8 s quiz timer kept; lesson 16 kept with a corrected rule (the clip keeps to its own side; doc 10); SIM-02 after lesson 8 and SIM-10 after lesson 10; flashcard checks for lessons with safety below 0.7 (3, 4, 13); emergency checklist not shipped (unreviewed draft); "Unit 1 · Road basics" start sign kept.

## What only the owner can unblock

Supabase project + keys (then re-run RLS checks against it) · handbook review of every `draft: true` item and the 10 simulation manifests · video creator names / CC versions · captions · legal operator, contact, effective date, age/consent policy, retention, governing law · real-phone testing. (DEF-09 is settled by the owner's algorithm code.)

## How to verify again

```sh
npm run build && npm run preview          # then, with CHROMIUM set to a local Chrome for Testing:
node --test scripts/*.test.mjs
node scripts/inspect-learning-flow.mjs && node scripts/inspect-simulations.mjs
npm run inspect:feed && node scripts/inspect-home.mjs && node scripts/inspect-mobile.mjs
npm install --no-save @electric-sql/pglite@0.5.8 && node supabase/tests/rls.check.mjs
```
