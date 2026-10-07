export const homeContent = {
  title: 'Ready for the road?',
  greeting: 'Small lessons. More confident decisions.',
  intro: 'California permit prep',
  start: 'Start learning',
  continue: 'Continue learning',
  complete: 'Every lesson checked off',
  completeDetail: 'Revisit a lesson or try the practice test.',
  goalNote: 'Earn 10 XP the first time you complete a lesson’s knowledge check. Replays and practice tests don’t add XP.',
  caughtUpNote: 'You’ve completed every available lesson. Keep practicing below; you can earn more XP when new lessons are added.',
  savedEmpty: 'Save a lesson with the bookmark in the feed. Find it here whenever you want another look.',
  shortcuts: [
    { title: 'Permit practice', detail: 'Try the written test', href: '#/practice', icon: 'book' },
    { title: 'Road lessons', detail: 'Choose a topic', action: 'lessons', icon: 'practice' },
    { title: 'Saved lessons', detail: 'Pick up a bookmark', action: 'saved', icon: 'bookmark' },
  ],
} as const;
