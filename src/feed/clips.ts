// Timed posters stand in until footage exists. Only the yellow-light clip has a matching simulator.
export type Clip = {
  id: string;
  topic: string;
  title: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  poster: { lines: string[]; caption: string; background: string; foreground: string };
  followUp?: { question: string; options: string[]; answer: number; explanation: string };
  video?: string;
  simulator?: boolean;
};

export const CLIPS: Clip[] = [
  {
    id: 'yellow-light', topic: 'signals',
    title: 'When the light turns yellow',
    question: 'The light turns yellow. You can stop smoothly before the line. What do you do?',
    options: ['Speed up to clear the intersection', 'Stop before the stop line', 'Keep going at the same speed', 'Brake hard and stop past the line'],
    answer: 1,
    explanation: 'Yellow means red is next. If you can stop safely before the line, stop. Only continue if you are too close to stop safely.',
    poster: { lines: ['MAKE', 'THE', 'CALL.'], caption: 'Yellow ahead. Decide with room to stop.', background: '#191970', foreground: '#F7E998' },
    followUp: { question: 'When is it safer to continue through a yellow light?', options: ['When you want to save time', 'When you are too close to stop safely', 'Whenever the road behind you is clear'], answer: 1, explanation: 'If a smooth stop is no longer possible, continue carefully. Never accelerate to beat the light.' },
    simulator: true,
  },
  {
    id: 'roundabout', topic: 'right of way',
    title: 'Who goes first at a two-lane roundabout',
    question: "You're entering the roundabout from the left lane. Who has right of way?",
    options: ['Traffic already on the roundabout', 'Whoever signals first', 'Vehicles in the right lane', "You do, once you're past the line"],
    answer: 0,
    explanation: 'Give way to anything already circulating. Your lane only sets which exit you can take.',
    poster: { lines: ['GIVE', 'WAY.'], caption: 'Look for traffic already moving around.', background: '#FFF2E1', foreground: '#121313' },
  },
  {
    id: 'four-way-stop', topic: 'right of way',
    title: 'Four-way stop, two drivers, one moment',
    question: 'You and another car reach a four-way stop at the same time on crossing roads. Who goes first?',
    options: ['The larger vehicle', 'The car on the left', 'The car on the right', 'Whoever waves first'],
    answer: 2,
    explanation: 'When two drivers arrive together, the driver on the left yields to the driver on the right.',
    poster: { lines: ['WHO', 'GOES', 'FIRST?'], caption: 'One moment. Two drivers. A clear rule.', background: '#121313', foreground: '#FF6044' },
  },
  {
    id: 'following-distance', topic: 'following distance',
    title: 'The three-second rule',
    question: 'In good weather, how far behind the car ahead should you stay?',
    options: ['One car length', 'At least three seconds', 'Close enough to read their plate', 'Ten feet at any speed'],
    answer: 1,
    explanation: 'Pick a fixed point. When the car ahead passes it, count. You should reach it no sooner than three seconds later, and later still in rain or at night.',
    poster: { lines: ['SPACE', 'TO', 'REACT.'], caption: 'A little room makes a big difference.', background: '#FF4747', foreground: '#121313' },
  },
  {
    id: 'school-bus', topic: 'sharing the road',
    title: 'Red lights on a school bus',
    question: 'A school bus ahead of you on a two-lane road stops with its red lights flashing. What do you do?',
    options: ['Pass slowly on the left', 'Honk so children know you are there', 'Stop only if you can see children', 'Stop and wait until the lights stop flashing'],
    answer: 3,
    explanation: 'On an undivided road, traffic in both directions stops for flashing red lights and waits until they turn off and the stop arm folds away.',
    poster: { lines: ['STOP.', 'WAIT.', 'WATCH.'], caption: 'Red bus lights mean children may cross.', background: '#ECEFF1', foreground: '#191970' },
  },
];

export const clipById = (id: string | undefined) => CLIPS.find(clip => clip.id === id);
export const nextClip = (id: string) => CLIPS[CLIPS.findIndex(clip => clip.id === id) + 1];
