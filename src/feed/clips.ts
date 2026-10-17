import { VIDEO_LESSONS } from './curriculum.ts';
import type { PosterScene } from './poster';

// The curriculum video lessons come first. The five original lessons have no video; each is an
// interactive text post: the learner fills one blank at a time, then takes the lesson's check.
// Optional practice scenarios are mapped to lessons in src/simulation/registry.ts.
export type Clip = {
  id: string;
  topic: string;
  title: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  /** `scene` picks the decorative street map drawn when a lesson video can't load (an intersection by default). */
  poster?: { scene?: PosterScene };
  /** A text lesson: sentences with one blank each, filled in order. Draft until a human reviews it. */
  post?: { steps: PostStep[]; draft: true; source: string };
  followUp?: { question: string; options: string[]; answer: number; explanation: string };
  video?: string;
  /** Owner curriculum text not yet approved against the handbook by a human. */
  draft?: boolean;
  /** Handbook citation for the quick check. */
  source?: string;
  /** On-screen context for curriculum video lessons. */
  lesson?: {
    category: string;
    summary: string;
    /** California correction shown over the clip; most source videos need one. */
    californiaRule: string;
    handbook: string;
    local: string;
    /** creator is the YouTube channel name, required by the clip's CC BY 3.0 license. */
    credit: { title: string; url: string; creator: string };
  };
};

export type PostStep = { before: string; after: string; choices: string[]; answer: number; why: string };
const QRG = 'California Quick Reference Driver’s Handbook (DL 600X, 2025)';

export const CLIPS: Clip[] = [
  ...VIDEO_LESSONS,
  {
    id: 'yellow-light', topic: 'signals',
    title: 'When the light turns yellow',
    question: 'The light turns yellow. You can stop smoothly before the line. What do you do?',
    options: ['Speed up to clear the intersection', 'Stop before the stop line', 'Keep going at the same speed', 'Brake hard and stop past the line'],
    answer: 1,
    explanation: 'Yellow means red is next. If you can stop safely before the line, stop. Only continue if you are too close to stop safely.',
    post: { draft: true, source: `${QRG}, Section 5, “Solid Yellow Light,” p. 24`, steps: [
      { before: 'A solid yellow light means the signal is about to turn ', after: '.', choices: ['red', 'green', 'off'], answer: 0, why: 'Yellow means caution. Red comes next.' },
      { before: 'When the light turns yellow, ', after: ' if you can do it safely.', choices: ['speed up', 'stop', 'keep going'], answer: 1, why: 'A safe stop is always the first choice.' },
      { before: 'If you are too close to stop safely, ', after: ' through the intersection.', choices: ['stop sharply', 'speed up', 'cross cautiously'], answer: 2, why: 'The handbook says to cross with caution when you can’t stop safely.' },
    ] },
    followUp: { question: 'When is it safer to continue through a yellow light?', options: ['When you are running late', 'When you are too close to stop safely', 'When no car is behind you'], answer: 1, explanation: 'If a smooth stop is no longer possible, continue carefully. Never accelerate to beat the light.' },
  },
  {
    id: 'roundabout', topic: 'right of way',
    title: 'Who goes first at a two-lane roundabout',
    question: "You're entering the roundabout from the left lane. Who has right of way?",
    options: ['Traffic already on the roundabout', 'Whoever signals first', 'Vehicles in the right lane', "You do, once you're past the line"],
    answer: 0,
    explanation: 'Yield to anything already circulating. Your lane only sets which exit you can take.',
    poster: { scene: 'roundabout' },
    post: { draft: true, source: `${QRG}, Section 5, “Roundabouts,” p. 31`, steps: [
      { before: 'Traffic in a roundabout travels ', after: ' around the center island.', choices: ['clockwise', 'counterclockwise', 'either way'], answer: 1, why: 'You enter heading right and circle counterclockwise.' },
      { before: 'Before you enter, ', after: ' to all traffic already in the roundabout.', choices: ['yield', 'signal', 'flash your lights'], answer: 0, why: 'Cars already circling go first.' },
      { before: 'Enter when there is a ', after: ' gap in traffic.', choices: ['small', 'big enough', 'any'], answer: 1, why: 'Wait for a gap you can merge into safely.' },
      { before: 'Once you’re in the roundabout, don’t ', after: ' or pass.', choices: ['signal', 'slow down', 'stop'], answer: 2, why: 'Keep moving. If you miss your exit, go around again.' },
    ] },
  },
  {
    id: 'four-way-stop', topic: 'right of way',
    title: 'Two cars at a four-way stop',
    question: 'You and another car reach a four-way stop at the same time on crossing roads. Who goes first?',
    options: ['The larger vehicle', 'The car on the left', 'The car on the right', 'Whoever waves first'],
    answer: 2,
    explanation: 'When two drivers arrive together, the driver on the left yields to the driver on the right.',
    post: { draft: true, source: `${QRG}, Section 5, “Intersections,” p. 30`, steps: [
      { before: 'At a four-way stop, the driver who ', after: ' goes first.', choices: ['is going straight', 'stopped first', 'has the bigger car'], answer: 1, why: 'Arrival order decides who goes first.' },
      { before: 'If you stop at the same time, yield to the driver on your ', after: '.', choices: ['left', 'right', 'opposite side'], answer: 1, why: 'A tie goes to the road user on your right.' },
      { before: 'Before you go, check for ', after: '. They always have the right-of-way.', choices: ['pedestrians', 'parked cars', 'traffic signs'], answer: 0, why: 'People crossing come first at every intersection.' },
    ] },
  },
  {
    id: 'following-distance', topic: 'following distance',
    title: 'The three-second rule',
    question: 'In good weather, how far behind the car ahead should you stay?',
    options: ['One car length', 'At least three seconds', 'About two seconds', 'Ten feet at any speed'],
    answer: 1,
    explanation: 'Pick a fixed point. When the car ahead passes it, count. You should reach it no sooner than three seconds later, and later still in rain or at night.',
    post: { draft: true, source: `${QRG}, Section 6, “Tailgating,” p. 44; “Slippery Roads,” p. 48`, steps: [
      { before: 'Use the ', after: ' rule to keep a safe following distance.', choices: ['one-second', 'three-second', 'one-car-length'], answer: 1, why: 'Three seconds gives you time to react if the driver ahead brakes.' },
      { before: 'When the car ahead passes a fixed sign, ', after: ' before you reach it.', choices: ['count three seconds', 'tap your brakes', 'check your mirror'], answer: 0, why: 'If you reach the sign before you finish counting, you’re too close.' },
      { before: 'On wet or slippery roads, leave ', after: ' space.', choices: ['less', 'the same', 'more'], answer: 2, why: 'Slippery roads take longer to stop on.' },
    ] },
  },
  {
    id: 'school-bus', topic: 'sharing the road',
    title: 'Red lights on a school bus',
    question: 'A school bus ahead of you on a two-lane road stops with its red lights flashing. What do you do?',
    options: ['Pass slowly on the left', 'Slow down and pass with care', 'Stop only if you see children', 'Stop until the lights stop flashing'],
    answer: 3,
    explanation: 'On an undivided road, traffic in both directions stops for flashing red lights and waits until they turn off and the stop arm folds away.',
    post: { draft: true, source: `${QRG}, Section 5, “Around Children,” pp. 38–39`, steps: [
      { before: 'Flashing yellow lights on a school bus mean ', after: '.', choices: ['pass before it stops', 'slow down and get ready to stop', 'keep your speed'], answer: 1, why: 'The bus is about to stop to let children off.' },
      { before: 'When the bus flashes red lights, you must ', after: ' from either direction.', choices: ['stop', 'slow down', 'pass carefully'], answer: 0, why: 'Stay stopped until the children are across and the lights stop flashing.' },
      { before: 'If the bus is across a divided or multilane highway, you ', after: ' stop.', choices: ['must always', 'don’t need to', 'must also'], answer: 1, why: 'With two or more lanes each way between you, you don’t need to stop.' },
    ] },
  },
];

export const clipById = (id: string | undefined) => CLIPS.find(clip => clip.id === id);
export const nextClip = (id: string) => CLIPS[CLIPS.findIndex(clip => clip.id === id) + 1];
