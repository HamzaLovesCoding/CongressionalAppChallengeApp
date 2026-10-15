export const homeContent = {
  nextStop: 'Next stop',
  complete: 'Road basics complete',
  completeDetail: 'Practice what you’ve learned.',
  unit: 'Road basics',
  unitTab: 'Unit 1',
  week: 'This week',
  streak: (days: number) => days ? `${days}-day streak` : 'Start a streak today',
  streakPending: 'Earn XP today to keep it going',
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  upNext: 'Up next',
  goalNote: 'Earn 10 XP the first time you complete a lesson’s knowledge check. Replays and practice tests don’t add XP.',
} as const;

export const LEADERBOARD_COPY = {
  title: 'Weekly leaderboard',
  noRank: 'Rank not available yet',
  yourPlace: 'Your place',
  group: { tab: 'Group', list: 'Group weekly rankings' },
  global: { tab: 'Global', list: 'Global weekly rankings' },
} as const;
