import { CLIPS } from './clips';
import { attempts, hasSafeRun, lastPosition, record, reviewQueue, savedLessonIds, settings, topicRecord } from './progress';
import { savedReview } from '../learning/review';
import { readiness } from '../learning/scoring';
import { learningFor, topicOf } from '../content/learning';
import { CONTENT_CARDS } from '../content/cards';
import { SCENARIOS } from '../simulation/registry';
import { checkFor, planFeed, resumeLesson, type PlanLesson, type PlanState, type PlanTarget } from '../learning/planner';

// Binds the pure planner to this device's progress and Lane's content. Home, Progress and the
// feed all ask here, so "your next lesson" means the same thing everywhere.
export const PLAN_LESSONS: PlanLesson[] = CLIPS.map(clip => {
  const learning = learningFor(clip.id);
  return {
    id: clip.id, topicId: topicOf(clip.id), safety: learning?.safety ?? 0.7,
    hasRecall: !!learning?.recall, hasGlossary: !!learning?.glossary,
    scenarioId: SCENARIOS.find(entry => entry.lessonId === clip.id)?.id,
  };
});
const PLAN_SIMS = SCENARIOS.map(entry => ({ id: entry.id, topicId: entry.topicId, lessonId: entry.lessonId }));
const PLAN_CARDS = CONTENT_CARDS.map(card => ({ id: card.id, kind: card.kind, topicId: card.topicId }));

export function planState(now = new Date()): PlanState {
  return {
    done: id => !!record(id)?.done, topic: topicRecord, safeSim: hasSafeRun, review: reviewQueue(),
    position: lastPosition(), permitTestDate: settings().permitTestDate, now,
  };
}
export const currentPlan = (target: PlanTarget = {}) => planFeed(PLAN_LESSONS, PLAN_SIMS, PLAN_CARDS, planState(), target);
/** The lesson to continue, or null when every lesson is complete. */
export const nextLessonId = () => resumeLesson(PLAN_LESSONS, planState());
export const checkKindFor = (lessonId: string) => {
  const lesson = PLAN_LESSONS.find(entry => entry.id === lessonId);
  return lesson ? checkFor(lesson, planState()) : 'quiz';
};

// Saved lessons in review order: today's are due, the rest come back on their review day (#/review, Home).
export function savedEntries(now = new Date()) {
  return savedReview({
    savedIds: savedLessonIds(), lessons: PLAN_LESSONS.map(lesson => ({ id: lesson.id, topicId: lesson.topicId, safety: lesson.safety, done: !!record(lesson.id)?.done })),
    attempts: attempts(), topic: topicRecord, permitTestDate: settings().permitTestDate, now,
  });
}

// One readiness score everywhere: only current catalog completions count; untouched topics contribute 0.
export function currentReadiness() {
  return readiness([...new Set(PLAN_LESSONS.map(lesson => lesson.topicId))].map(id => topicRecord(id).mastery ?? 0), {
    completed: PLAN_LESSONS.filter(lesson => record(lesson.id)?.done).length,
    total: PLAN_LESSONS.length,
  });
}
