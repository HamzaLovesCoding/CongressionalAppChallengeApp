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
  reviewTitle: 'Review later',
  reviewDetail: (count: number) => `${count} saved ${count === 1 ? 'lesson' : 'lessons'} to review today`,
} as const;

// The Home menu reaches screens that have no tab of their own.
export const MENU_LINKS = [
  { href: '#/buddies', icon: 'buddies', label: 'Streak buddies' },
  { href: '#/settings', icon: 'settings', label: 'Settings' },
  { href: '#/credits', icon: 'book', label: 'Credits & sources' },
] as const;

export const LEADERBOARD_COPY = {
  title: 'Weekly leaderboard',
  noRank: 'Rank not available yet',
  yourPlace: 'Your place',
  group: { tab: 'Group', list: 'Group weekly rankings' },
  global: { tab: 'Global', list: 'Global weekly rankings' },
  // Group = the learner and their accepted streak buddies.
  groupEmpty: 'Add streak buddies to see them here.',
  groupAdd: 'Add a buddy',
  comingSoon: 'Weekly rankings are coming soon.',
  noAlias: 'Choose a username in Settings to appear here.',
} as const;
