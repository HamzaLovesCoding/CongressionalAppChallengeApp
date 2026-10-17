# 04 — Content and UX cleanup

Scope: **display copy only**. Stable lesson IDs, video paths, quiz text, answers, explanations, handbook `source` fields and California corrections do not change. Quiz-bank rewriting is out of this pass (PDF §4.2). Every rule stays attached to its lesson.

## 1. Titles that repeat "California" (15 of 19 curriculum lessons)

Proposed display titles. The `id` column is the stable key that progress, video files, posters and quizzes use, so renaming `title` breaks nothing. The California context stays in the rule dropdown, the handbook citation and the About sheet.

| # | Stable ID | Current title | Proposed title |
| --- | --- | --- | --- |
| 1 | `lane-end-scan` | Scanning Ahead for Lane-End Warnings | *(unchanged)* |
| 2 | `after-collision` | After a Collision: California’s Required Next Steps | After a Collision: What to Do Next |
| 3 | `emergency-kit` | Build a California-Ready Vehicle Emergency Kit | Build a Vehicle Emergency Kit |
| 4 | `front-curb` | Stopping Safely Before a Front Curb: Use Your Own Visual Reference | Stopping Before a Front Curb |
| 5 | `dark-signal` | California: What to Do at a Nonworking Traffic Light | When a Traffic Light Is Out |
| 6 | `emergency-pull-right` | California: Pull Right and Stop for Approaching Emergency Vehicles | When an Emergency Vehicle Approaches |
| 7 | `emergency-right-edge` | Emergency Vehicles: California’s Right-Edge Yield Rule | Emergency Vehicles: Move to the Right Edge |
| 8 | `intersection-right-of-way` | California Right-of-Way: Who Goes First at Intersections? | Who Goes First at an Intersection? |
| 9 | `high-beams` | California High-Beam Choices: Dark Roads, Rain, and Fog | High Beams on Dark Roads, in Rain, and in Fog |
| 10 | `passing-bicyclist` | Passing a Bicyclist Safely in California: Give 3 Feet | Passing a Bicyclist: Give 3 Feet |
| 11 | `freeway-entry` | Entering a California Freeway Safely: Match Speed, Signal, Scan, Merge | Entering a Freeway |
| 12 | `freeway-merge` | California Freeway Merging: Match Speed, Check, Signal, and Yield | Merging on a Freeway |
| 13 | `drive-test-readiness` | California Drive-Test Readiness: Scan, Space, and Core Maneuvers | Getting Ready for the Drive Test |
| 14 | `blind-spot-check` | California Blind-Spot Checks: Look Over Both Shoulders | Checking Your Blind Spots |
| 15 | `blind-curve` | Slow Down for Blind Curves and Parked Cars: California Driving | Blind Curves and Parked Cars |
| 16 | `blind-bend` | Blind Bends and Parked Cars: California Poor-Visibility Driving | Blind Bends in Poor Visibility |
| 17 | `merging-trailer` | Making Space for a Trailer-Towing Vehicle Merging on a Freeway | Making Space for a Merging Trailer |
| 18 | `stopping-distance` | Why More Speed Requires More Stopping Space | More Speed Needs More Stopping Space |
| 19 | `three-second-check` | Use the California Three-Second Following-Distance Check | The Three-Second Following Distance |

Poster lessons: `four-way-stop` "Four-way stop, two drivers, one moment" reads as a slogan → **"Two cars at a four-way stop"**. The other four are kept.

The crosswalk (old title → new title, same ID) is this table. A test will assert that all 24 IDs, video paths and lesson counts are unchanged after the edit.

## 2. Repeated labels

| Where | Current | Proposal |
| --- | --- | --- |
| Feed, every curriculum clip | "California rule" dropdown | **Decided 2026-10-15: kept exactly as is** (owner). Every curriculum clip needs its correction because the footage differs from California law. |
| Progress | "Road basics" appears in the trip panel and again in the "Unit 1 · Road basics · 24 lessons" start label | **Kept**: DESIGN.md specifies this start sign by name; locked design wins over a marginal change |
| Home | "Road basics" section heading + "Road basics complete" | Keep (one per state) |

## 3. Near-duplicate lessons (flagged, not merged or deleted)

| Pair | Relationship | Proposal |
| --- | --- | --- |
| `emergency-pull-right` (6) / `emergency-right-edge` (7) | Same rule, two clips; validation package keeps them adjacent | Keep both, adjacent |
| `freeway-entry` (11) / `freeway-merge` (12) | Sequential | Keep, adjacent |
| `blind-curve` (15) / `blind-bend` (16) | Same hazard; **16 is "not recommended"** (teaches "keep to the left") | Kept with its correction (default; owner may change) |
| `three-second-check` (19) / poster `following-distance` | Same rule | Kept both (default; owner may change) |
| `intersection-right-of-way` (8) / poster `four-way-stop` | Overlap; SIM-01 fits both | Keep; attach SIM-01 to the four-way-stop lesson |

## 4. Learning-check placement

Current state is already restrained: one check per lesson, opened on `ended`, no injected recall cards. This pass keeps it that way:

- No random Quick Recall / Quick Safety Check cards.
- Mixed cards (glossary, flashcards, permit posts) from the stash are inserted by the planner at a bounded rate, never directly after every lesson.
- The early-leave gate appears only when a learner leaves a video **before its key segment** and only on lessons marked safety-important; routine material just continues.
- Poster lessons currently open their quiz on an 8 s timer (no video). Kept (default; owner may change).

## 5. Other wording seen

- About sheet: "Licensed for use in Lane." The owner confirmed CC status for clips 1–19, but creator and license variant are unrecorded, so it now reads "Source & credits … Used under Creative Commons; see Credits & sources" (done).
- Home goal note and leaderboard copy are direct and need no change.
