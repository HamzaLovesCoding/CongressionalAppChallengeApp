import type { ScenarioModule } from './contract.ts';

// One entry per vendored package (vendor/lane-simulations/<id>). Every one is a feed item placed by the
// planner (src/learning/planner.ts): after its lesson until the learner makes the safe choice, as a
// returning-session refresher, or on its own (SIM-07). Titles, topics and fallback text
// mirror each scenario-manifest.json (checked by scripts/simulation.test.mjs) so the manifests
// themselves stay out of the startup bundle. Every package is draft-needs-human-handbook-review.
export type ScenarioEntry = {
  id: string;
  number: number;
  type: '2d' | '3d';
  title: string;
  topicId: string;
  /** The Lane lesson it follows in the feed, or null when the planner places it on its own. */
  lessonId: string | null;
  /** The rule it practices, shown on its feed card (from the owner's locked 10-scenario catalog). */
  rule: string;
  fallback: string;
  load(): Promise<ScenarioModule>;
};

export const SCENARIOS: ScenarioEntry[] = [
  { id: 'four-way-stop', number: 1, type: '2d', title: 'Four-Way Stop: Who Goes First?', topicId: 'all-way-stop-right-of-way', lessonId: 'four-way-stop', rule: 'When you arrive together, yield to the vehicle on your right.',
    fallback: 'You and the blue car stop together. The gray car arrives later.', load: () => import('../../vendor/lane-simulations/four-way-stop/src/index.ts') },
  { id: 'unprotected-left-turn', number: 2, type: '2d', title: 'Unprotected Left Turn: Wait for Oncoming Traffic', topicId: 'left-turn-right-of-way', lessonId: 'intersection-right-of-way', rule: 'Turning left, yield to pedestrians and to oncoming traffic close enough to be dangerous.',
    fallback: 'The blue car is coming toward you. A person is crossing the street you want to enter.', load: () => import('../../vendor/lane-simulations/unprotected-left-turn/src/index.ts') },
  { id: 'roundabout-entry', number: 3, type: '2d', title: 'Roundabout Entry: Yield Before Joining', topicId: 'roundabout-entry', lessonId: 'roundabout', rule: 'Yield to traffic already in the roundabout, then enter at a safe gap.',
    fallback: 'You are approaching the entrance. The blue car is already inside the roundabout.', load: () => import('../../vendor/lane-simulations/roundabout-entry/src/index.ts') },
  { id: 'lane-ends-merge', number: 4, type: '2d', title: 'Lane Ends: Merge Early and Deliberately', topicId: 'ending-lane-awareness', lessonId: 'lane-end-scan', rule: 'Signal, check mirrors and your blind spot, and merge early into a safe gap.',
    fallback: 'The blue car is in the next lane. There is space behind it.', load: () => import('../../vendor/lane-simulations/lane-ends-merge/src/index.ts') },
  { id: 'blind-spot-motorcycle', number: 5, type: '2d', title: 'Blind-Spot Check: Motorcycle Beside You', topicId: 'blind-spots-lane-change', lessonId: 'blind-spot-check', rule: 'Mirrors miss your blind spot. Look over your shoulder before you move over.',
    fallback: 'You want the right lane. A motorcycle approaches from behind and settles into your blind spot.', load: () => import('../../vendor/lane-simulations/blind-spot-motorcycle/src/index.ts') },
  { id: 'emergency-vehicle-yield', number: 6, type: '2d', title: 'Emergency Vehicle: Clear the Intersection, Then Pull Right', topicId: 'emergency-vehicle-right-of-way', lessonId: 'emergency-pull-right', rule: 'Clear the intersection first, then pull to the right edge and stop.',
    fallback: 'You are already crossing the intersection. A fire engine approaches with red lights and a siren.', load: () => import('../../vendor/lane-simulations/emergency-vehicle-yield/src/index.ts') },
  { id: 'railroad-clear-exit', number: 7, type: '2d', title: 'Railroad Tracks: Do Not Enter Without a Clear Exit', topicId: 'railroad-crossing-clearance', lessonId: null, rule: 'Never start across railroad tracks unless there is room to clear them completely.',
    fallback: 'There is no room for your car beyond the tracks. The crossing lights begin flashing.', load: () => import('../../vendor/lane-simulations/railroad-clear-exit/src/index.ts') },
  { id: 'yellow-light-stop', number: 8, type: '3d', title: 'Yellow Light: Stop if You Can Do So Safely', topicId: 'yellow-light-safe-stop', lessonId: 'yellow-light', rule: 'A solid yellow means stop if you can do so safely.',
    fallback: 'You are approaching the signal. There is enough space to brake smoothly before the line.', load: () => import('../../vendor/lane-simulations/yellow-light-stop/src/index.ts') },
  { id: 'freeway-entrance-merge', number: 9, type: '3d', title: 'Freeway Entrance: Match Traffic and Merge Into a Safe Gap', topicId: 'freeway-entrance-merging', lessonId: 'freeway-entry', rule: 'Freeway traffic has the right-of-way. Match its speed and merge into a safe gap.',
    fallback: 'You are on the entrance ramp. The blue car is on your left; the mirror shows traffic behind.', load: () => import('../../vendor/lane-simulations/freeway-entrance-merge/src/index.ts') },
  { id: 'right-turn-scan', number: 10, type: '3d', title: 'Right Turn Scan: Pedestrian and Bicyclist at the Corner', topicId: 'right-turn-vulnerable-road-users', lessonId: 'passing-bicyclist', rule: 'A green light does not remove your duty to yield to people crossing and riding beside you.',
    fallback: 'A person is crossing ahead. A bicyclist is continuing straight on your right.', load: () => import('../../vendor/lane-simulations/right-turn-scan/src/index.ts') },
];

export const scenarioById = (id: string | undefined) => SCENARIOS.find(entry => entry.id === id);
export const scenarioForLesson = (lessonId: string) => SCENARIOS.find(entry => entry.lessonId === lessonId);
/** Simulations without a lesson of their own; the planner places them in the feed. */
export const standaloneScenarios = () => SCENARIOS.filter(entry => entry.lessonId === null);
