type Lesson = { id: string };
type Result = { done: boolean } | undefined;

// Count only lessons still in the catalog; old saved records must not inflate completion.
export function lessonProgress<T extends Lesson>(lessons: T[], result: (id: string) => Result) {
  const completed = lessons.filter(lesson => result(lesson.id)?.done).length;
  const next = lessons.find(lesson => !result(lesson.id)?.done) ?? lessons[0];
  return { completed, next, total: lessons.length, allDone: lessons.length > 0 && completed === lessons.length,
    percentage: lessons.length ? Math.round(completed / lessons.length * 100) : 0 };
}
