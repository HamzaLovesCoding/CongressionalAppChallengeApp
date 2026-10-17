// Learner-facing copy for menu screens. Plain, friendly, and about what the learner can do.
// Functions that take a username expect it already escaped for HTML.
// Onboarding (#/welcome).
export const WELCOME_COPY = {
  step: (n: number) => `Step ${n} of 2`,
  title: 'Welcome to Lane',
  usernameLabel: 'Username',
  usernameNote: 'Shows on leaderboards. Skip your real name.',
  readTerms: 'Read the Terms of Service',
  readPrivacy: 'Read the Privacy Policy',
  agree: 'I agree to the Terms of Service and Privacy Policy.',
  needUsername: 'Choose a username to continue.',
  needTerms: 'Agree to the Terms of Service and Privacy Policy to continue.',
  usernameRule: 'Use 3–20 letters, numbers, - or _.',
  taken: 'Someone already has that username. Try another.',
  saving: 'Saving…',
  next: 'Continue',
  goalTitle: 'What’s your main goal?',
  goals: {
    permit: 'Prepare for the permit test, then for driving',
    driver: 'Sharpen my driving skills and learn safer habits',
    other: 'Something else',
  },
  otherLabel: 'Tell us in a few words',
  needGoal: 'Choose a goal to continue.',
  start: 'Start Lane',
} as const;

// One name per learning topic, so the review list never shows two rows with the same title.
export const TOPIC_NAMES: Record<string, string> = {
  'right-of-way': 'Right-of-way', 'night-and-weather': 'Night and weather', 'sharing-the-road': 'Sharing the road',
  'space-and-speed': 'Space and speed', 'railroad-crossing-clearance': 'Railroad crossings', parking: 'Parking',
  licensing: 'Licensing', freeway: 'Freeways', distraction: 'Distraction', 'speed-and-visibility': 'Speed and visibility',
  signals: 'Signals and lights', 'rules-and-laws': 'Rules and laws', 'road-awareness': 'Road awareness',
  emergencies: 'Emergencies', 'drive-test': 'Drive test', 'car-readiness': 'Car readiness', 'blind-spots': 'Blind spots',
  'alcohol-and-drugs': 'Alcohol and drugs',
};
