# Next task (queued by the owner on 2026-10-15): short flexible feature review

Run this **after** the integration work in `docs/lane/HANDOFF.md` is finished. Owner's prompt, verbatim:

---

# Lane — Short Flexible Feature Review Prompt

> Paste this into Claude Code after it has access to the current Lane repository and the main Lane master prompt.

Review the current Lane app and the feature ideas already documented for it. **Do not assume every idea must be added.** First inspect the actual frontend, routes, content, local state, backend/Supabase setup, and existing tests. Preserve the current manually designed frontend and do not redesign its visual system, navigation, copy, or page structure.

For each feature area below, decide one of four outcomes:

- **Implement now** — useful, fits the current app, and can be added safely without a structural overhaul.
- **Already covered** — it exists or the current behavior already meets the need; leave it alone or make only a small bug fix.
- **Defer** — worthwhile, but it needs assets, content review, Supabase configuration, a later quiz pass, or a separate design decision.
- **Exclude for now** — too excessive, redundant, confusing, risky, or not useful enough for this version.

Feature areas to review:

1. Video-first learning feed: direct local videos, true watch/resume tracking, relevant video-to-quiz flow, and a calm loading/error state.
1. Learning flow: short quizzes, Review Later, helpful follow-up after a miss, flashcards, glossary terms, useful posters/photos, and permit-test-date personalization.
1. Progress: explainable learning signals, next-item/refresher selection, streak/daily goal, and a Road Ahead/progress view.
1. Practice: written permit-test practice and topic-level feedback without rebuilding the quiz bank in this pass.
1. Simulations: correctly integrate the supplied 10 simulations after related quizzes, record safe/unsafe/timeout/retry/exit outcomes, and return the learner to the right place.
1. Profile and settings: anonymous learner identity, car/avatar, sound, permit-test date, display alias, local/sync status, Credits, Privacy Policy, and Terms.
1. Backend: local-first progress plus secure Supabase persistence for learner profile/settings, progress, review items, learning events, simulation attempts, mastery, validated XP, and a truthful weekly leaderboard.
1. Mobile quality: phone-first sizing, clear text, stable bottom navigation, direct media behavior, accessible controls, no clutter, and no generic AI-style UI additions.

Create a short `docs/lane/FEATURE_VERDICT.md` table with:

| Feature | Current status | Recommendation | Simple implementation path or reason | Dependencies / risks |

Then:

- Implement only the items you mark **Implement now**.
- Keep changes additive and small. Reuse the current components, tokens, routes, and content structure.
- Do not add fake social features, invented data, generic cards, unnecessary onboarding, repetitive recall checks, public comments, or a redesign.
- Do not treat a feature as complete merely because the UI exists; verify it works.
- For each implemented item, add a focused test or repeatable verification step.
- Finish with a concise report: **implemented**, **already covered**, **deferred**, **excluded**, and **any blocking question**.
