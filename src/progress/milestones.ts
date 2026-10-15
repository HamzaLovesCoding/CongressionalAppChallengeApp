// Spread across the whole 24-lesson unit so the last badge means the unit is finished, with an early
// second badge so a new learner reaches one soon. The final count must equal the lesson count (tested).
export const MILESTONES = [
  { count: 1, title: 'First checkpoint', detail: 'Complete your first lesson.', icon: 'flag' },
  { count: 5, title: 'Making tracks', detail: 'Complete five Road basics lessons.', icon: 'road' },
  { count: 12, title: 'Halfway there', detail: 'Complete twelve Road basics lessons.', icon: 'wheel' },
  { count: 24, title: 'Road basics', detail: 'Complete every Road basics lesson.', icon: 'trophy' },
] as const;

// Badges are derived from actual lesson records, so replaying or spending XP cannot change them.
export function milestones(completed: number) {
  return MILESTONES.map(milestone => ({ ...milestone, earned: completed >= milestone.count, remaining: Math.max(0, milestone.count - completed) }));
}

export function completionChange(previous: readonly string[] | undefined, current: readonly string[]) {
  const added = previous ? current.filter(id => !previous.includes(id)).length : 0;
  const unlocked = previous ? milestones(current.length).filter(badge => badge.earned && badge.count > previous.length) : [];
  return { added, unlocked };
}
