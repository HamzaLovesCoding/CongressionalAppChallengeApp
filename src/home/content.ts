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
  // Group = a code group the learner made or joined (supabase/migrations/20261019000000_lane_code_groups.sql).
  groupIntro: 'Make a group and share its code with friends, or join theirs.',
  pickGroup: 'Group',
  code: 'Code',
  shareCode: (code: string) => `Share group code ${code.split('').join(' ')}`,
  shareText: (code: string) => `Join my Lane leaderboard with code ${code}`,
  create: 'Create group',
  joinWithCode: 'Join with code',
  codeLabel: 'Group code',
  codePlaceholder: 'Code',
  join: 'Join',
  cancel: 'Cancel',
  leave: (name: string) => `Leave ${name}`,
  leaveConfirm: (name: string) => `Leave ${name}? You can rejoin with its code.`,
  created: (code: string) => `Group made. Share code ${code} with friends.`,
  joining: 'Joining…',
  joined: 'You joined the group.',
  left: 'You left the group.',
  copied: 'Code copied.',
  groupErrors: {
    'need-username': 'Choose a username in Settings first.',
    limit: 'You’ve reached the group limit for now.',
    full: 'That group is full.',
    'not-found': 'No group has that code. Check it and try again.',
    invalid: 'Codes are 6 letters and numbers.',
    already: 'You’re already in that group.',
    offline: 'Couldn’t reach the server. Try again.',
  },
  noAlias: 'Choose a username in Settings to appear here.',
} as const;
