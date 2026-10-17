# 00 — Visual baseline and preservation audit

Recorded 2026-10-15 on branch `lane-integration`, from `main` at `6c9e37e` (Hamza, 2026-10-14). No UI file has been changed yet.

## How the baseline was captured

`npm run build && npm run preview`, then `node scripts/inspect-baseline.mjs` (new; `LABEL=before`). Fresh learner, service worker blocked, Chromium 1248. 11 route states × 5 viewports = 55 screenshots in `artifacts/baseline/before/` (gitignored), with `notes.json`. No page errors at any viewport. No horizontal overflow at any viewport.

| Route state | Hash | Bottom nav | Notes |
| --- | --- | --- | --- |
| Home | `#/home` | yes | Wordmark, menu button, dark "Next stop" sign (Lesson 1), This week strip + goal ring, Road basics lesson strip (0 of 24), Weekly leaderboard below the fold |
| Progress | `#/progress` | yes | Trip panel (0/4 milestones, XP), road with car at checkered start, dark next-lesson sign, milestone sign, "Unit 1 · Road basics · 24 lessons" label |
| Feed (video) | `#/feed/lane-end-scan` | no (Home return arrow) | Full-bleed video, timer chip top-right, category + title, "California rule" dropdown, like/save/share rail |
| Feed, rule open | same, dropdown opened | no | Cream panel with rule text, handbook page, "About this lesson" |
| Feed (poster lesson) | `#/feed/yellow-light` | no | Decorative street-map poster; quiz after an 8 s timer (no video) |
| Practice | `#/practice` | yes | Test intro, 46 questions, 80% target, numbered topic rows |
| Practice test | `#/practice/test` | no | Focused test surface, pinned Submit |
| Profile | `#/profile` | yes | Dark selected-car hero, Your stats row, Right on the first try, Garage grid, liked/saved tabs |
| Lesson summary | `#/lesson-progress` | no | Summary panel and lesson rows |
| `#/review` | falls back to `#/feed/lane-end-scan` | no | **No review route exists** |
| `#/emergency` | falls back to `#/feed/lane-end-scan` | no | **No emergency route exists** |

Tablet (768) and desktop (1366) render the same 430 px phone column centered on the cream page, by design (`DESIGN.md` → Structure).

## Design system to preserve (source: `DESIGN.md`, `src/theme.css`, `src/ui.css`)

- **Palette:** ink `#29251F`, page cream `#F0E4CE`, surface `#FFFAF0`, ochre accent `#D19735` with dark text, success `#405332`, error `#974B3D`. Road-scenery tokens only on Progress. No general gradients.
- **Type:** self-hosted IBM Plex Sans; four sizes (12/15/20/26) and two weights (400/600); `--fs-hero` 48 for one number only.
- **Spacing/radius:** `--sp-1…7` (4–48); radius 8/14/20/24.
- **Components:** `.ui-button` (one ochre primary per view), `.ui-chip` (real values only), `.ui-segmented`, `.ui-page-head`, `.ui-burst`; bottom sheets from `src/home/sheet.ts` with spring physics.
- **Structure:** single surfaces with dark 1–1.5 px boundaries, no bordered cards inside cards; 44 px targets; safe-area insets; road-strip bottom nav ordered Home / Progress / Feed / Practice / Profile with Feed centered.
- **Feed:** full-screen, Home return control, no bottom nav (owner choice confirmed 2026-10-15 — keep), opaque cream rail buttons, no backdrop blur.
- **Owner constraints (CLAUDE.md):** Profile is Garage-only; Home has one next-lesson action; no mascots, slogans, fake peers or ranks.

## Observed issues to address (each needs a functional reason before a UI change)

| # | Issue | Evidence | Functional reason |
| --- | --- | --- | --- |
| V1 | 15 of 19 curriculum titles repeat "California" | Home strip, Progress signs, feed titles | PDF §4.1 redundancy; titles wrap to 3 lines on 360 px |
| V2 | `#/review`, `#/emergency` silently fall back to Feed | notes.json | Missing routes (PDF §2.3) |
| V3 | No place for permit-test date, display alias, sync status, Credits/Privacy/Terms | Profile, Home menu | PDF §7.6, §8, §10A |
| V4 | Home menu sheet only repeats the five tabs | `src/home/home.ts:62` | Natural, existing entry point for Review / Settings / Credits |
| V5 | Poster lessons open their quiz on an 8 s timer | `src/feed/feed.ts:12,374` | PDF: no timer-driven quizzes (poster lessons have no video) — decision pending |
| V6 | Group tab has no product model | `src/home/leaderboard.ts` | PDF §7.4 — show an accurate unavailable state |

## Changed UI files (final, 2026-10-15)

Before: `artifacts/baseline/before/` (55). After: `artifacts/baseline/after/` (90, adds the new screens). Both gitignored; regenerate with `LABEL=before|after node scripts/inspect-baseline.mjs`.

| File | Change | Functional / accessibility reason |
| --- | --- | --- |
| `src/feed/curriculum.ts`, `clips.ts` | Shorter display titles; "Give way" → "Yield"; removed `simulator` flag | V1 redundancy; US wording; old simulator removed (owner) |
| `src/feed/feed.ts`, `minimal.css`, `content.ts` | ⋯ options menu replaces close on open checks; rule → similar → recovery stages; help, activity, safety-check stages; sim offer on completion; About sheet "Source & credits" | CLAUDE.md learning-flow requirements; PDF §4.2, §6.4; honest credits |
| `src/home/home.ts`, `content.ts`, `icons.ts`, `home.css` | Menu sheet → Review later (+count), Settings, Credits & sources; gear icon | V3/V4: settings and legal entry points; owner chose the menu |
| `src/home/leaderboard.ts`, `.css` | Global first; local-only note; Group unavailable line; remote rows when configured | PDF §7.4 truthful leaderboard (V6) |
| `src/progress/path.ts`, `content.ts`, `src/feed/screens.ts` | Practice link points to the new sims | Old simulator removed |
| `src/pages/*` (new) | Review, Settings, Credits, Privacy, Terms on the practice-test column pattern | V2, V3; PDF §10A |
| `src/simulation/host.*` (new) | Full-screen stage; fallback with Back | PDF §6.4 |
| `index.html`, `public/favicon-*.png` | Owner's favicon | Owner request |
| `src/feed/feed.css`, `src/home/home.css` | Removed orphaned rules (old simulator error screen, blank tab) | Cleanup |

Regression review (5 viewports + 9 phones): no page errors, no horizontal overflow, no blur filters, no new control under 44 px (the practice radio dot sits inside a 64 px label, pre-existing), changed screens use existing tokens and components. Mobile matrix findings on new screens (15 px inputs → iOS zoom; inline credit links too small) were fixed and rechecked.
