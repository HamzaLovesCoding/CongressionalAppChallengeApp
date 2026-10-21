<h1 align="center">
    <img src="public/images/brand/lane-logo.png" alt="Lane logo" width="280" />
</h1>
<p align="center">
    <strong>Short, swipeable driving lessons for teens getting ready for their permit.</strong><br />
    <em>Learn And Navigate Emergencies</em>
    <br /><br />
    <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT License" />
    <img src="https://img.shields.io/badge/Language-TypeScript-3178C6.svg" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Platform-Web%20%28installable%29-5A4632.svg" alt="Web, installable" />
    <img src="https://img.shields.io/badge/Made%20In-Novato-FF5733.svg" alt="Made in Novato" />
    <img src="https://img.shields.io/badge/Congressional%20App%20Challenge-2026-4CAF50.svg" alt="Congressional App Challenge 2026" />
</p>

## About

Lane is our entry for the **Congressional App Challenge 2026**, California's 2<sup>nd</sup> congressional district.

Teens already spend time scrolling short videos. Lane turns that habit into something useful: a phone-first feed of short driving lessons, each followed by a quick check, built for teens about 14 to 16 who are getting ready for their learner's permit or just starting to drive. Every rule and answer is checked against the **California Driver's Handbook**, and each lesson cites the handbook page it comes from.

Lane runs in the browser and can be installed to a phone's home screen. Once installed, lessons work offline.

## Features

**Lesson feed**
- 24 lessons: 19 short video lessons and 5 fill-in-the-blank text lessons.
- Each video lesson shows a **California rule** panel that corrects anything in the clip that doesn't match California law (for example, clips filmed in left-hand traffic), with the handbook citation.
- When a video ends, a one-question check opens over it. A wrong answer explains the rule and asks a similar question instead of repeating the same one.
- Swiping away early from an important lesson asks first, with options to keep watching, take the check, or save it for later.
- Like, save and comment on lessons.

**Driving challenges**
- Ten short decision scenarios inside the feed: a four-way stop, an unprotected left turn, a roundabout, a lane ending, a motorcycle in the blind spot, an emergency vehicle at an intersection, railroad tracks without a clear exit, a yellow light, a freeway entrance, and a right turn with a pedestrian and a bicyclist. The last three are in 3D from the driver's seat.
- Unsafe choices show cartoon warnings, never crashes or injuries. A challenge stays in the feed until the safe choice is made.

**Practice and review**
- A 43-question California practice test with feedback on every answer and results by topic.
- **Driver coach:** an AI chat that answers driving questions from the California Driver's Handbook (see [Driver coach](#driver-coach-ai)).
- **Review:** saved lessons come back for review, then return after 2, 4, 8 and 16 days.

**Progress and motivation**
- **Home** shows the next lesson, this week's streak, a readiness score out of 100, and notifications such as an upcoming permit test date.
- **Progress** is a winding road with your car at your next lesson and milestones along the way.
- **Profile** has a garage of six cars you unlock with XP earned from lessons.
- **Leaderboards:** a weekly global board, plus private group boards you create and share with a 6-character code.

## How Lane decides what comes next

Lessons go in order, and each one is scored on four things: how you answered, whether you finished the recovery steps after a miss, how much of the video you watched, and a small time factor. Those scores update a mastery level for each topic. Weak topics and saved lessons come back in review.

The readiness score combines lessons completed (80%) with average topic mastery (20%). The weights are simple rules of thumb, not a trained or validated model, and the score is a study guide, not a prediction of passing the test.

## Driver coach (AI)

The Driver coach on the Practice tab answers driving questions using **Claude Sonnet 5.5**, a model by Anthropic.

- It answers only from the *California Quick Reference Driver's Handbook (DL 600X, 2025)* and shows the handbook pages it used. Tap a page to see the quoted lines.
- Answers are written by AI and can be wrong, and the chat says so under the question box.
- It works only when backup is on (see [Privacy](#privacy)). Each learner can ask 30 questions per day.
- The conversation lives in memory only. Lane doesn't store what you type. Your question and the recent chat are sent through Lane's server to Anthropic, along with a one-way hash of your anonymous account ID.
- The API key stays on the server, in a Supabase Edge Function. It is never in the app.

## Privacy

- Progress is kept on your device by default.
- Backup is optional. Turning it on creates an anonymous account (no email or password) so progress, leaderboards, groups and comments can sync. Only your chosen username appears to others.
- No ads, no analytics, no tracking cookies.
- The full policy is in the app under **Profile → Settings → Privacy Policy**.

## Tech stack

| Part | Built with |
| --- | --- |
| App | TypeScript and [Vite](https://vite.dev/), with no UI framework |
| 3D challenges | [Babylon.js](https://www.babylonjs.com/) 9.27.1, loaded only when a 3D challenge opens |
| Offline | Installable web app (PWA) with a hand-written service worker |
| Backend | [Supabase](https://supabase.com/): Postgres with row-level security, anonymous sign-in and Edge Functions |
| Driver coach | [Anthropic API](https://docs.anthropic.com/) (Claude Sonnet 5.5), called from a Supabase Edge Function |
| Testing | Node's built-in test runner and [Playwright](https://playwright.dev/) |

## Running it locally

You need [Node.js](https://nodejs.org/) 22 or newer.

```bash
git clone https://github.com/HamzaLovesCoding/CongressionalAppChallengeApp.git
cd CongressionalAppChallengeApp
npm install
npm run dev
```

Open http://localhost:5173. Without backend settings, Lane runs on this device only: lessons, challenges, practice, review, progress and the garage all work. Leaderboards, groups, comments, backup and the Driver coach need the backend.

**Connecting a backend (optional)**
1. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and publishable key.
2. Follow [`supabase/README.md`](supabase/README.md) to apply the database migrations, turn on anonymous sign-ins, and deploy the Driver coach.

**Trying the Driver coach without a backend:** put an Anthropic API key in `supabase/functions/.env` (see [`supabase/functions/.env.example`](supabase/functions/.env.example)) and run `npm run coach:local`, then open http://127.0.0.1:5180/#/practice. Questions are billed to that key.

**Production build:** `npm run build` writes the app to `dist/`, which can be served by any static host.

## Testing

```bash
npm run build:test              # type-check and build an offline copy into dist-test/
node --test scripts/*.test.mjs  # unit tests: scoring, planner, content checks, sync, legal text and more
```

Screen-by-screen walkthroughs use Playwright and save screenshots to `artifacts/`. Start the test build with `npm run preview:test`, then run a walkthrough such as `npm run inspect:feed` or `node scripts/inspect-baseline.mjs`. Run `npx playwright install chromium webkit` once first, and set `CHROMIUM` to the path of your Chromium or Chrome executable when you run a walkthrough.

## Project layout

| Path | What's there |
| --- | --- |
| `src/feed/` | The lesson feed, checks, and lesson data (`curriculum.ts`, `clips.ts`) |
| `src/learning/` | Scoring, the lesson planner and daily review |
| `src/home/`, `src/progress/`, `src/practice/`, `src/profile/` | The five main screens |
| `src/coach/` | The Driver coach chat |
| `src/legal/` | Privacy Policy, Terms and the credits list |
| `vendor/lane-simulations/` | The ten driving challenges |
| `supabase/` | Database migrations, the coach Edge Function and backend setup notes |
| `public/videos/` | Lesson videos (H.264, re-encoded for phones) |
| `docs/` | Design notes, content index, credits register and test reports |

## Content sources and credits

- **Driving rules:** *California Driver's Handbook* and *California Quick Reference Driver's Handbook (DL 600X, 2025)*, California Department of Motor Vehicles, licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). Lane is not affiliated with or endorsed by the DMV.
- **Lesson videos 1–19:** from the YouTube channels **Trubicars** and **CRUDE Ultimate Driving Education**, licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Lane trimmed and re-encoded the clips and added California corrections. Each lesson links to its original video, and the full list is in the app under **Credits & sources** and in [`docs/lane/08-credits-and-attribution-register.md`](docs/lane/08-credits-and-attribution-register.md).
- **Local figures:** 2023 crash data for Novato, California Office of Traffic Safety.
- **Fonts:** [IBM Plex Sans](https://github.com/IBM/plex) and Zilla Slab, both under the SIL Open Font License 1.1 (license files in `public/fonts/`).
- **3D engine:** [Babylon.js](https://github.com/BabylonJS/Babylon.js), Apache License 2.0.
- **Driver coach answers:** Claude Sonnet 5.5 by [Anthropic](https://www.anthropic.com/). Anthropic does not endorse Lane.

## License

The code written for Lane is released under the [MIT License](LICENSE).

The MIT License does not cover third-party material in this repository. The lesson videos, the DMV handbook text, the fonts and Babylon.js keep their own licenses, listed above. The handbook text is licensed for **non-commercial use only**, so any commercial reuse of Lane would need to remove or replace it.

## Team

Lane was built by **Arnav Lal** ([@cubinghay-lgtm](https://github.com/cubinghay-lgtm)) and **Hamza Wadera** ([@HamzaLovesCoding](https://github.com/HamzaLovesCoding)) for the Congressional App Challenge 2026, California's 2<sup>nd</sup> congressional district.

## ⚠️ Disclaimer

- **Never use Lane while driving.**
- Lane is a study aid. It is not an official DMV resource and does not replace the California Driver's Handbook, a licensed driving instructor or behind-the-wheel training.
- The readiness score and the Driver coach can be wrong, and neither guarantees you will pass the permit or driving test.

This software is provided "as is", without warranty of any kind. See [LICENSE](LICENSE).
