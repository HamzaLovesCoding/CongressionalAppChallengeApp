# Feature verdict (2026-10-15)

From the owner's short feature-review prompt (`docs/lane/next-feature-review-prompt.md`), checked against the code on `lane-integration` after the integration work. "Verified" means a test or walkthrough exercises it.

| Feature | Current status | Recommendation | Simple implementation path or reason | Dependencies / risks |
| --- | --- | --- | --- | --- |
| Direct local videos | 19 H.264 clips in `public/videos/`, normal `<video>`, neighbor-only preloading (Hamza) | **Already covered** | Verified: `inspect-feed`, `inspect-video-load`, register in doc 08 | Real-phone check still pending |
| True watch tracking | Played-range coverage + key part saved per lesson | **Already covered** (added this pass) | `src/learning/watch.ts`, `recordWatch`; `watch-session.test.mjs` | No per-lesson key-segment timings yet; whole clip counts |
| Resume where you left off | Clips restart from 0 | **Exclude for now** | Clips are 30–60 s shorts; resuming adds little and would weaken the early-leave safety check | Revisit if long-form lessons arrive |
| Video → quiz flow | Quiz opens on real `ended`; poster lessons use an 8 s timer | **Already covered** | Verified in `inspect-feed`, `inspect-learning-flow` | Poster timer kept by default (owner may change) |
| Calm loading / error state | Poster at once, spinner after 300 ms, poster fallback + message on error | **Already covered** | Hamza's feed; offline replay verified | — |
| Short quizzes | One check per lesson (two for yellow light) | **Already covered** | — | Quiz text is `draft: true` |
| Review Later | Menu, safety check, misses, simulation exit/unsafe → queue; `#/review` | **Already covered** (added this pass) | + **Implement now:** waiting count in the Home menu (done) | — |
| Follow-up after a miss | Rule → similar question → recovery (activity / rewatch / read rule) | **Already covered** (added this pass) | `inspect-learning-flow` | Similar/harder questions are drafts |
| Flashcards and glossary terms | 26 draft cards exist only in the old stash | **Defer** | Needs reviewed content and a feed that renders non-lesson items (a structural feed change) | Risk of repetitive recall; content review |
| Useful posters / photos | Video stills and code-drawn maps only | **Defer** | No owner-supplied reference photos to show | Assets + rights |
| Permit-test-date personalization | Date in Settings; changes review length (5→10 items) only | **Already covered** (added this pass) | `review.test.mjs` date bands | Fuller content mix needs flashcards/posts (deferred) |
| Explainable learning signals | A/W/N/T scoring, smoothing, priority run on every lesson | **Already covered** internally | `scoring.test.mjs` (0.59875 routes below 0.60) | Showing signals on Progress needs an owner design decision |
| Next item / refresher | Home "Next stop" + daily review ordering | **Already covered** | `home-progress.test.mjs`, `review.test.mjs` | — |
| Streak / daily goal | Real daily XP, editable goal | **Already covered** | XP cannot be farmed: `learner-records.test.mjs` | — |
| Road Ahead / progress view | Highway road with car and milestones | **Already covered** | `inspect-progress`, `inspect-path-motion` | — |
| Written permit practice | 46-question bank, scoring, results | **Already covered** | `inspect-practice`, `practice-score.test.mjs` | Bank review continues separately |
| Practice topic feedback | Results list topics to review | **Already covered** | — | Feeding practice into lesson topic evidence: **Defer** (different topic IDs; needs mapping) |
| 10 simulations after related quizzes | Registry + host + adapter; offered on the completion sheet or in Review | **Already covered** (added this pass) | `inspect-simulations`: all 10 safe / unsafe / retry / timeout / exit, Continue destination, no XP | Handbook review of manifests; real-phone WebGL |
| Anonymous identity | Supabase anonymous session when sync is configured; otherwise device-only | **Already covered** | `sync.test.mjs` | Needs a Supabase project |
| Car personalization | Garage (Hamza) | **Already covered** | `inspect-profile` | — |
| Sound preference | Tap enables sound; no stored toggle | **Exclude for now** | `DESIGN.md` deliberately has no sound toggle | — |
| Permit date, nickname, sync status | Settings screen from the Home menu | **Already covered** (added this pass) | Settings fields verified; `learner-records.test.mjs` alias sanitizer | — |
| Credits, Privacy Policy, Terms | Screens + version-controlled sources | **Already covered** (added this pass) | `legal.test.mjs` | Owner facts pending (doc 09) |
| Supabase persistence | Migration, RLS, `sync_learner`, leaderboard RPC, fetch client | **Defer (go-live)** — built | 21/21 RLS checks on Postgres (PGlite); `supabase-schema.test.mjs` | Needs project + env; hosted re-test |
| Truthful weekly leaderboard | Own row only + clear note; Group says unavailable | **Already covered** | `inspect-leaderboard` | Real rankings need sync |
| Phone-first sizing, clear text | 9-phone matrix + 5-viewport audit clean | **Already covered** | `inspect-mobile`, `inspect-baseline` | Physical devices not tested |
| Stable bottom navigation | On all tab screens; Feed is full-screen by owner choice | **Already covered** | — | — |
| Accessible controls | Focus moves into sheets, focus trap, labels, reduced motion | **Already covered** | Fixed this pass: menu roles, trap includes links, 16 px inputs, full-row credit links | Captions missing (**Defer**: no caption files) |
| Emergency checklist | Draft in stash only | **Defer** | Unreviewed safety content must not ship | Human review |
| Fake social, public comments, onboarding, extra recall checks | Not present | **Exclude** | Out of scope by both prompts | — |

## Implemented from this review

- Home menu shows the number of items waiting in Review later (`src/home/home.ts`); verified in `scripts/inspect-learning-flow.mjs` (expects "1 waiting" after a second miss).

## Blocking questions

None block this build. Open owner decisions are listed in `docs/lane/09-privacy-and-terms-owner-inputs.md` and the final report.
