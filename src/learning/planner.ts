import type { ReviewItem, TopicRecord } from '../feed/progress';
import { reviewPriority } from './scoring.ts';
import { testBand, type TestBand } from './review.ts';

// Decides what the feed shows and in what order. Pure: everything comes in as arguments, so the
// rules are tested without a browser (scripts/planner.test.mjs). Based on the owner's earlier
// planner (git stash@{0}, src/learning/planner.ts) and the owner's direction of 2026-10-15:
//   - lessons go strictly in order: the next lesson is always the earliest unfinished one, so a
//     lesson saved for later stays next until it is done (owner, 2026-10-16);
//   - a returning session may open with one due refresher, and a simulation can take a video's
//     place in that slot;
//   - a related simulation follows its lesson until the learner has made the safe choice;
//   - lower-stakes lessons and repeat visits get a flashcard or glossary card instead of a full quiz;
//   - fixed spacing, so the feed is varied but never random or endless.

export type PlanLesson = { id: string; topicId: string; safety: number; hasRecall: boolean; hasGlossary: boolean; scenarioId?: string };
export type PlanSim = { id: string; topicId: string; lessonId: string | null };
export type PlanCard = { id: string; kind: 'glossary' | 'flashcard' | 'permit-post'; topicId: string };
export type PlanItem =
  | { kind: 'lesson'; id: string; revisit: boolean }
  | { kind: 'sim'; id: string; lessonId: string | null }
  | { kind: 'card'; id: string };
export type CheckKind = 'quiz' | 'review-quiz' | 'recall' | 'glossary';
export type PlanState = {
  done: (lessonId: string) => boolean;
  topic: (topicId: string) => TopicRecord;
  safeSim: (scenarioId: string) => boolean;
  review: ReviewItem[];
  position: { lessonId: string; at: string } | null;
  permitTestDate: string | null;
  now: Date;
};

const DAY = 86_400_000;
const localDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
// A refresher needs evidence that the topic is weak or overdue.
export const REFRESH_THRESHOLD = 0.45;
// Safety weight from which a first visit gets the full quiz (src/content/learning.ts QUIZ_SAFETY).
export const QUIZ_SAFETY = 0.7;
// A standalone simulation (no lesson of its own) comes after this many lessons.
export const STANDALONE_SIM_AFTER = 4;

// Cards come more often, and flashcards first, as the permit test gets closer.
const CARD_SPACING: Record<TestBand, number> = { none: 3, month: 2, weeks: 1, days: 1 };
const CARD_ORDER: Record<TestBand, PlanCard['kind'][]> = {
  none: ['permit-post', 'glossary', 'flashcard'],
  month: ['permit-post', 'flashcard', 'glossary'],
  weeks: ['flashcard', 'permit-post', 'glossary'],
  days: ['flashcard', 'glossary', 'permit-post'],
};

export function topicPriority(lessons: PlanLesson[], topicId: string, state: PlanState) {
  const record = state.topic(topicId);
  const safety = Math.max(0.5, ...lessons.filter(lesson => lesson.topicId === topicId).map(lesson => lesson.safety));
  // Without a practice date there is no evidence of forgetting, so age adds nothing.
  const days = record.lastPracticedAt ? Math.max(0, (state.now.getTime() - new Date(record.lastPracticedAt).getTime()) / DAY) : 0;
  const queued = state.review.filter(item => item.topicId === topicId && !item.resolvedAt).length;
  return reviewPriority({ mastery: record.mastery ?? 0.5, daysSincePractice: days, skips: record.skips + queued, safety });
}

// The lesson to continue: the earliest unfinished lesson, in curriculum order. Null when every
// lesson is done. Progress fills in order, one lesson after another.
export function resumeLesson(lessons: PlanLesson[], state: PlanState): string | null {
  return lessons.find(lesson => !state.done(lesson.id))?.id ?? null;
}

// What follows a video. First visits: the full quiz, or the lesson's flashcard for lower-stakes
// lessons. Repeat visits scale with topic mastery: weak → quiz again, developing → flashcard,
// strong → the lesson's glossary term.
export function checkFor(lesson: PlanLesson, state: PlanState): CheckKind {
  if (!state.done(lesson.id)) return lesson.safety >= QUIZ_SAFETY || !lesson.hasRecall ? 'quiz' : 'recall';
  const mastery = state.topic(lesson.topicId).mastery;
  if (mastery === null || mastery < 0.6) return 'review-quiz';
  if (mastery < 0.8 || !lesson.hasGlossary) return lesson.hasRecall ? 'recall' : 'review-quiz';
  return 'glossary';
}

export type PlanTarget = { lessonId?: string; scenarioId?: string };

export function planFeed(lessons: PlanLesson[], sims: PlanSim[], cards: PlanCard[], state: PlanState, target: PlanTarget = {}): PlanItem[] {
  const byId = new Map(lessons.map(lesson => [lesson.id, lesson]));
  const priority = (lesson: PlanLesson) => topicPriority(lessons, lesson.topicId, state);
  const queued = new Set(state.review.filter(item => !item.resolvedAt).map(item => item.itemId));
  const plan: PlanItem[] = [];
  const used = new Set<string>();
  const pushLesson = (id: string, revisit: boolean) => { plan.push({ kind: 'lesson', id, revisit }); used.add(id); };
  const pushSim = (id: string, lessonId: string | null) => { if (used.has(`sim:${id}`)) return; plan.push({ kind: 'sim', id, lessonId }); used.add(`sim:${id}`); };

  // 1. Explicit start (a lesson link, a Review practice link), otherwise a returning-session refresher.
  const targetSim = target.scenarioId ? sims.find(sim => sim.id === target.scenarioId) : undefined;
  if (targetSim) pushSim(targetSim.id, targetSim.lessonId);
  const started = lessons.some(lesson => state.done(lesson.id));
  const returning = !target.lessonId && !targetSim && started && !!state.position && localDay(new Date(state.position.at)) < localDay(state.now);
  if (returning) {
    const due = lessons.filter(lesson => state.done(lesson.id) && (queued.has(lesson.id) || (state.topic(lesson.topicId).mastery !== null && priority(lesson) >= REFRESH_THRESHOLD)))
      .sort((a, b) => priority(b) - priority(a))[0];
    if (due) {
      const sim = due.scenarioId ? sims.find(entry => entry.id === due.scenarioId && !state.safeSim(entry.id)) : undefined;
      // A simulation can stand in for the video when the learner has already seen the lesson.
      if (sim) pushSim(sim.id, sim.lessonId); else pushLesson(due.id, true);
    }
  }

  // 2. Lessons: the start lesson, the unfinished ones after it, then earlier skipped ones.
  const startId = target.lessonId && byId.has(target.lessonId) ? target.lessonId : resumeLesson(lessons, state);
  const startAt = startId ? lessons.findIndex(lesson => lesson.id === startId) : 0;
  const ordered = [...lessons.slice(startAt), ...lessons.slice(0, startAt)];
  const forward = ordered.filter((lesson, index) => (index === 0 && startId === lesson.id) || !state.done(lesson.id));
  // Finished lessons waiting in Review later return as revisits, one after every three lessons.
  const reviewQueue = lessons.filter(lesson => state.done(lesson.id) && queued.has(lesson.id) && lesson.id !== startId).sort((a, b) => priority(b) - priority(a));

  const band = testBand(state.permitTestDate, state.now);
  // Round-robin across card kinds in the band's order; near the test, weaker topics first.
  const roundRobin: PlanCard[] = [];
  const weight = (card: PlanCard) => topicPriority(lessons, card.topicId, state);
  const groups = CARD_ORDER[band].map(kind => cards.filter(card => card.kind === kind).sort((a, b) => band === 'none' ? 0 : weight(b) - weight(a)));
  for (let round = 0; groups.some(group => group.length > round); round++) for (const group of groups) if (group[round]) roundRobin.push(group[round]);
  const standalone = sims.filter(sim => sim.lessonId === null && !state.safeSim(sim.id));
  // A first session keeps the first two foundation lessons together, with nothing between them.
  const firstSession = !started;

  let lessonCount = 0;
  const addAfterLesson = (lesson: PlanLesson) => {
    lessonCount++;
    if (lesson.scenarioId && !state.safeSim(lesson.scenarioId)) {
      const sim = sims.find(entry => entry.id === lesson.scenarioId);
      if (sim) pushSim(sim.id, sim.lessonId);
    }
    if (lessonCount % STANDALONE_SIM_AFTER === 0 && standalone.length) { const sim = standalone.shift()!; pushSim(sim.id, null); }
    const quiet = firstSession && lessonCount < 2;
    if (!quiet && lessonCount % CARD_SPACING[band] === 0 && roundRobin.length) plan.push({ kind: 'card', id: roundRobin.shift()!.id });
    if (lessonCount % 3 === 0 && reviewQueue.length) {
      const revisit = reviewQueue.shift()!;
      if (!used.has(revisit.id)) { pushLesson(revisit.id, true); addAfterLesson(revisit); }
    }
  };
  for (const lesson of forward) {
    if (used.has(lesson.id)) continue;
    pushLesson(lesson.id, state.done(lesson.id));
    addAfterLesson(lesson);
  }
  // 3. Everything done: a short, capped review session instead of an endless feed.
  if (!forward.length || forward.every(lesson => state.done(lesson.id))) {
    const refreshers = lessons.filter(lesson => state.done(lesson.id) && !used.has(lesson.id)).sort((a, b) => priority(b) - priority(a)).slice(0, 5);
    for (const lesson of refreshers) { pushLesson(lesson.id, true); addAfterLesson(lesson); }
  }
  for (const sim of standalone) pushSim(sim.id, null);
  return plan;
}
