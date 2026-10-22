# 10 — Content index: every video, its check, and what follows it

Written 2026-10-15 after reviewing all 19 clips by hand, one frame per second, reading every burned-in caption. Audio could not be heard; where a clip has no captions (lessons 4, 7, 11, 17), the summary describes only what the frames show. All checks, flashcards and glossary cards are `draft: true` with handbook page numbers verified against the DL 600 X (6/2025) text (printed page = PDF page − 4).

## How a lesson flows now

```
video (corner timer = clip time, stops at the end)
  │ swipe away early on an important lesson (safety ≥ 0.8) → "Are you sure? The video isn't finished."
  │     Keep watching · I already know this. Quiz me · Watch the important part · Review later
  ▼ video ends
check — chosen by the planner (src/learning/planner.ts, checkFor):
  first visit, safety ≥ 0.7 → quiz        first visit, safety < 0.7 → flashcard (lessons 3, 4, 13)
  repeat visit: mastery < 0.6 → quiz again (counts as later review, C3) · < 0.8 → flashcard · ≥ 0.8 → glossary term
  ▼ session score (owner algorithm): strong → done · developing → one quick-recall flashcard · miss → rule + similar question · miss again → important part / activity / rule, saved to Review later
simulation card (if the lesson has one and the learner hasn't made the safe choice yet) → Start simulation runs it in the card; Exit stays put and saves to Review later
feed card (glossary / flashcard / permit-test tip): with no test date in the next 30 days, after lessons 3, 9, 13, 16, 18, 20, 22, 24 of a session; every 2nd lesson within a month of the permit test, every lesson within two weeks
next lesson
```

Feed order (src/feed/plan.ts → planFeed): resume where the learner left off (saved on the device); a returning learner on a new day may first get one due refresher, and a challenge can stand in for that video; SIM-07 (railroad, no lesson) appears after the 4th lesson, or after the next lesson without a simulation of its own so two never come back to back; finished lessons waiting in Review later return after every 3rd lesson; when everything is done, at most 5 refreshers.

Lesson order (src/feed/clips.ts → FEED_ORDER, owner 2026-10-22). Judges see the front of the feed, so it opens with the strongest videos that have a simulation, each on a different topic; every other topic then gets its first lesson, best footage first; lessons that return to a topic come last. The # column in the index below is the curriculum deck's numbering, not the feed position. Progress, XP and review key on lesson IDs, so the order can change without moving anyone's records (tested in scripts/content-crosswalk.test.mjs).

| Feed | Lesson ID | Why it sits here | Simulation |
| --- | --- | --- | --- |
| 1 | `freeway-entry` | Animated 3D interchange, the most polished clip | SIM-09, 3D |
| 2 | `emergency-pull-right` | Studio presenter with captions; matches California law as filmed | SIM-06 |
| 3 | `passing-bicyclist` | Clear dashcam with captions | SIM-10, 3D |
| 4 | `intersection-right-of-way` | Studio presenter; the California rule panel corrects its tie rule | SIM-02 |
| 5 | `lane-end-scan` | Dashcam with captions | SIM-04 |
| 6 | `blind-spot-check` | Letterboxed and right-hand drive, but the last video with a simulation | SIM-05 |
| 7–14 | `after-collision`, `stopping-distance`, `yellow-light`, `high-beams`, `front-curb`, `drive-test-readiness`, `emergency-kit`, `blind-curve` | First lesson for each remaining topic; presenter clips and the braking demo first, the letterboxed left-hand-traffic clip last. `yellow-light` is a text lesson with the third 3D simulation (SIM-08). | SIM-07 after `after-collision`; SIM-08 |
| 15–24 | `dark-signal`, `freeway-merge`, `roundabout`, `emergency-right-edge`, `three-second-check`, `merging-trailer`, `four-way-stop`, `blind-bend`, `following-distance`, `school-bus` | Second lessons on a topic, never two of one topic in a row; text lessons last | SIM-03, SIM-01 |

## Index

| # | Lesson ID | Important part | Safety | First check | Correct answer | Flashcard | Glossary | Challenge |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `lane-end-scan` | 10–21 s | 0.8 | Quiz | At least 10 seconds ahead of your vehicle | How far ahead should you scan while driving? | Visual lead time | SIM-04 |
| 2 | `after-collision` | 4–23 s | 1 | Quiz | Move the car out of traffic, then call 911 | When must you report a collision to DMV? | Collision | — |
| 3 | `emergency-kit` | 7–14 s | 0.6 | Flashcard | Flashlight, extra batteries, jumper cables, first-aid kit | Your car breaks down on the freeway. Where do you wait for help? | Shoulder | — |
| 4 | `front-curb` | 3–12 s | 0.6 | Flashcard | By lining the curb up with a spot on the side mirror | What does a red curb mean? | Pedestrian | — |
| 5 | `dark-signal` | 8–16 s | 0.9 | Quiz | Yield to the driver on your right, then go | A traffic light is completely dark. How do you treat the intersection? | Right-of-way | — |
| 6 | `emergency-pull-right` | 8–15 s | 1 | Quiz | Drive to the right edge of the road and stop | How close may you follow a fire engine that has its siren on? | Yield | SIM-06 |
| 7 | `emergency-right-edge` | 20–28 s | 1 | Quiz | To the right edge of the road, then stop | An emergency vehicle with a siren is behind you. Where do you go? | Yield | — |
| 8 | `intersection-right-of-way` | 6–20 s | 0.9 | Quiz | Yield to the road user on your right | Two cars stop at a four-way stop at the same time. Who goes first? | Uncontrolled intersection | SIM-02 |
| 9 | `high-beams` | 8–32 s | 0.8 | Quiz | Dim to low beams so you don’t blind them | Fog, rain or snow: which headlights must you use? | — | — |
| 10 | `passing-bicyclist` | 4–16 s | 1 | Quiz | At least 3 feet | Minimum space when passing a bicyclist? | Vulnerable road users | SIM-10 |
| 11 | `freeway-entry` | 14–28 s | 0.9 | Quiz | Reaching the speed of freeway traffic before you merge | Merging onto a freeway: who has the right-of-way? | Interchange | SIM-09 |
| 12 | `freeway-merge` | 6–22 s | 0.9 | Quiz | Reach traffic speed, then merge after the solid line ends | Merging onto a freeway: may you cross a solid white line? | — | — |
| 13 | `drive-test-readiness` | 14–26 s | 0.6 | Flashcard | A look over your shoulder at your blind spot | How far before a turn should you start signaling? | Behind-the-wheel drive test | — |
| 14 | `blind-spot-check` | 13–23 s | 0.9 | Quiz | Turn only your head and look over your shoulder | Can your mirrors show your blind spots? | Blind spot | SIM-05 |
| 15 | `blind-curve` | 0–11 s | 0.8 | Quiz | Oncoming drivers may cut the corner into you | What does California’s Basic Speed Law say? | Lane positioning | — |
| 16 | `blind-bend` | 2–25 s | 0.8 | Quiz | Stay right, slow down, and be ready to stop | Speed limit at a blind intersection? | Pedestrian | — |
| 17 | `merging-trailer` | 14–25 s | 0.8 | Quiz | Ease off the gas to open space again | A car merges in too close ahead. What is your first move? | No Zone | — |
| 18 | `stopping-distance` | 1–11 s | 0.8 | Quiz | Higher speed needs much more room to stop | The road is wet. How should your speed change? | Tailgating | — |
| 19 | `three-second-check` | 12–21 s | 0.8 | Quiz | After counting three seconds | How do you check a three-second following gap? | Three-second rule | — |
| 20 | `yellow-light` | poster | 0.9 | Quiz | Stop before the stop line | What does a solid yellow light mean? | — | SIM-08 |
| 21 | `roundabout` | poster | 0.9 | Quiz | Traffic already on the roundabout | Which way does traffic travel in a roundabout? | — | SIM-03 |
| 22 | `four-way-stop` | poster | 0.9 | Quiz | The car on the right | You stopped first at a four-way stop. Who goes first? | Yield line | SIM-01 |
| 23 | `following-distance` | poster | 0.8 | Quiz | At least three seconds | Rain, night, or a tailgater behind you: how much following space? | Three-second rule | — |
| 24 | `school-bus` | poster | 1 | Quiz | Stop and wait until the lights stop flashing | A school bus on a two-lane road flashes red lights. What do you do? | — | — |
| — | (no lesson) | — | — | — | — | — | — | SIM-07, placed after the 4th lesson |

## What each video actually teaches (from its frames and captions)

| # | What the clip shows / says | Old check fit | New check |
| --- | --- | --- | --- |
| 1 | Dashcam, unfamiliar area: “look at least two blocks ahead… move your eyes side to side… look for information and warning signs… such as this right lane sign… seeing it early means early decisions.” Outro from 24 s. | Asked the lane-change sequence the clip never shows | California’s replacement for “two blocks”: at least 10 seconds (p. 44). Lane-change order moved to the harder question. |
| 2 | Presenter, fender bender: pull over if safe; check you and passengers aren’t injured; call police if anyone is hurt or damage is over $5,000; share driver’s name, number, plate, insurance; photos of everything. | Fit | Same rule, now names the video’s $5,000 claim before asking California’s step (p. 59). |
| 3 | Presenter: every car needs an emergency kit: flashlight with extra batteries, jumper cables, first-aid kit. 15 s. | Asked a freeway breakdown the clip never mentions | Which items the video packs; explanation says a kit is recommended, not required. Freeway breakdown stays as the similar/harder questions and the flashcard (p. 53). |
| 4 | No captions. A car hits a curb (red X), then the side mirror’s lower edge is lined up with the curb, the foot eases the brake, and the car stops short (green check). | True/false about parking legality, tangential | How the driver judged the stop (mirror reference); explanation: that point is car-specific, check curb colors (p. 20). |
| 5 | Presenter: a dark signal causes confusion; treat it like a four-way stop and follow the rules; if unsure, yield to the driver on your right. | Fit | Same rule with balanced options (pp. 25, 30). |
| 6 | Presenter: when you see lights and sirens, move to the right side and stop; pro tip: if stuck in traffic, wait for a safe moment. Never mentions intersections. | Asked the intersection case the clip doesn’t cover | The clip’s own rule: right edge and stop (p. 35). The intersection case is now the similar question. |
| 7 | No captions. Australian dashcam (left-hand traffic); a highlighted vehicle ahead at 2–4 s; an ambulance passes around 22–26 s as cars move left. | Asked the intersection case | Which way to pull over in California versus the clip (right edge, p. 35). |
| 8 | Presenter: the car on your right has right-of-way; if two cars arrive together, the car going straight goes first (not California); at a four-way stop the first to arrive goes first, ties go to the right; always yield to pedestrians. | Fit, but didn’t address the clip’s wrong claim | Names the clip’s “going straight goes first” and asks California’s tie rule (p. 30). Bicyclist-on-the-right moved to the similar question. |
| 9 | Presenter: high beams for very dark roads with no oncoming traffic; avoid them in fog and heavy rain (light reflects back); switch to low beams when a driver approaches or is ahead. | Fit | Same rule, balanced options (pp. 4, 46). |
| 10 | Captions: approaching a cyclist, leave lots of room until it’s safe; give at least one meter as you pass; see them in your rearview mirror before moving back. | Fit in part | California’s 3 feet versus the clip’s 1 meter (pp. 36–37); “can’t give 3 feet → wait” is the similar question. |
| 11 | No captions. Animated interchange: “Entrance ramp” title, the red car loops the ramp, uses the long merge lane, joins the freeway around 20–27 s. | Generic merging question with a long giveaway answer | What the long ramp is for (reaching traffic speed) (pp. 15–16). |
| 12 | Captions: three common merging mistakes: not getting up to speed to blend with traffic; merging too soon; merging late and panic-braking. | Generic, long giveaway answer | Which choice avoids all three, with options of equal length (pp. 15–16). |
| 13 | Presenter: practice; nail the basics (parallel parking, lane changes, smooth turns); keep glancing at your mirrors; keep enough distance so you don’t slam the brakes; follow the speed limit, watch for signs, stay calm. | Lane-change sequence, loosely related | The clip says “glance at mirrors”; what California also requires that mirrors can’t do (shoulder check, p. 8). |
| 14 | “Blind Spot Shoulder Check: example of where to look!” Mirror view, a highlighted car, then the driver looks out the side window. Right-hand-drive car. | Fit, long giveaway answer | How to make the check (turn only your head), options of equal length (p. 45). |
| 15 | Australian lesson: “Why are we keeping to our side? Because people come flying around that corner… cut the bend… if you’re going slow you have time to react.” | Fit in part | Why the instructor keeps to their side (oncoming drivers cut the corner); California = right side (p. 52). |
| 16 | Australian lesson: “we cannot see through this bend… pedestrian crossing in a pretty dangerous spot… keep to the left side… getting some visibility through the parked cars… can’t go too fast… be able to slow and stop.” | Confusing: marked “move left” false right after the instructor said “keep to the left” | Explains that “keep to the left” there means your own side; the California version is stay right, slow down, be ready to stop (pp. 50, 52). The validation package’s “Not recommended” read this as moving toward oncoming traffic; the frames show the car staying on its own side. Owner may want to revisit that verdict. |
| 17 | No captions. Busy freeway, title “Leaving space for heavy vehicle driver”; a loaded truck merges into the lane ahead around 15–18 s; the instructor gestures. | Fit | Same rule (foot off the accelerator, p. 44), options of equal length. |
| 18 | “Braking demonstrations with RYDA”: at 40 km/h the car stops before the cone; at 60 km/h it hits the dummy. 12 s. | Asked the 3-second rule, which the clip doesn’t show | What the demo shows (more speed, much more room to stop); the 3-second rule is now the similar question (pp. 44, 52). |
| 19 | Instructor: hand gesture to reach speed; the car ahead “lines up with the 80” sign; count; “the timing doesn’t have to be highly accurate, this is a guide”; “we want 3 seconds at high speed in good conditions.” | Fit | Same rule, references the 80 sign (p. 44). |

## Feed cards (src/content/cards.ts)

23 glossary terms (16 from the owner’s stash, 7 added for specific videos), 7 standalone flashcards, 5 permit-test tips (provisional license, phones under 18, curb colors, solid vs. flashing yellow, railroad crossings). Glossary terms come from the Aceable glossary the owner supplied; definitions are rewritten, not copied, and the handbook wins where they differ. Corrections made while checking: the stash’s phone tip said “even hands-free”, which the handbook doesn’t say (it says answer calls or send/respond to texts); the skid definition now uses the handbook’s three steps.

## Not done / needs a person

- Every check, flashcard, card and simulation manifest is still a draft until a human reviews it against the handbook.
- Audio was not reviewed; four clips without captions were judged on visuals only.
- Lessons 20–23 (distraction, DUI, child seats, railroad) have no video and were not added as lessons; SIM-07 covers railroad as a standalone challenge and a permit-test tip.

## Text lessons (2026-10-16)

The five lessons without video (yellow light, roundabout, four-way stop, following distance, school bus) are fill-in-the-blank posts in `src/feed/clips.ts` (`post`). Each has 3–4 sentences with one blank, three choices of similar length, and a one-line reason, all cited to the handbook (pp. 24, 30, 31, 38–39, 44, 48). Filling every blank opens the lesson's check. Their quiz options were rebalanced so no right answer stands out by length.
