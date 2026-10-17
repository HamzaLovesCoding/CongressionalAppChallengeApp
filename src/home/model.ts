type Lesson = { id: string };
type Result = { done: boolean } | undefined;

// Count only lessons still in the catalog; old saved records must not inflate completion.
// nextId: the planner's resume point (src/feed/plan.ts), so every screen agrees on the next lesson.
export function lessonProgress<T extends Lesson>(lessons: T[], result: (id: string) => Result, nextId?: string | null) {
  const completed = lessons.filter(lesson => result(lesson.id)?.done).length;
  const next = lessons.find(lesson => lesson.id === nextId && !result(lesson.id)?.done) ?? lessons.find(lesson => !result(lesson.id)?.done) ?? lessons[0];
  return { completed, next, total: lessons.length, allDone: lessons.length > 0 && completed === lessons.length,
    percentage: lessons.length ? Math.round(completed / lessons.length * 100) : 0 };
}
