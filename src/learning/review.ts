import type { QuizAttempt, ReviewItem, TopicRecord } from '../feed/progress.ts';
import { reviewPriority } from './scoring.ts';

// Chooses today's review. Pure: everything is passed in, so the rules are tested without a browser
// and could run on a backend later. Ported from the earlier planner.

export type ReviewLesson = { id: string; topicId: string; safety: number; done: boolean };
export type ReviewReason = 'saved' | 'skipped' | 'missed' | 'practice' | 'today' | 'yesterday' | 'two-days-ago' | 'weak-topic';
export type ReviewEntry = { id: string; reason: ReviewReason; priority: number };
// cardIds: feed flashcards and glossary cards that can be queued ("Not yet") alongside lessons.
export type ReviewInput = { lessons: ReviewLesson[]; queue: ReviewItem[]; attempts: QuizAttempt[]; topic(topicId: string): TopicRecord; permitTestDate: string | null; now: Date; cardIds?: string[] };

// How close the written permit test is. It changes only how much review is offered: no countdown.
export type TestBand = 'none' | 'month' | 'weeks' | 'days';
const DAY = 86_400_000;
const NEUTRAL_MASTERY = 0.5;
const WEAK = 0.6;
const localDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export function daysUntil(dateText: string | null, now: Date) {
  if (!dateText) return null;
  const [year, month, day] = dateText.split('-').map(Number);
  return Math.round((new Date(year, month - 1, day).getTime() - localDay(now)) / DAY);
}
export function testBand(dateText: string | null, now: Date): TestBand {
  const days = daysUntil(dateText, now);
  if (days === null || days < 0 || days > 30) return 'none';
  if (days >= 14) return 'month';
  if (days >= 7) return 'weeks';
  return 'days';
}
export const REVIEW_LIMIT: Record<TestBand, number> = { none: 5, month: 6, weeks: 8, days: 10 };

function topicPriority(input: ReviewInput, topicId: string) {
  const record = input.topic(topicId);
  const safety = Math.max(0.5, ...input.lessons.filter(lesson => lesson.topicId === topicId).map(lesson => lesson.safety));
  // Without a practice date there is no evidence of forgetting, so age adds nothing.
  const days = record.lastPracticedAt ? Math.max(0, (input.now.getTime() - new Date(record.lastPracticedAt).getTime()) / DAY) : 0;
  const queued = input.queue.filter(item => item.topicId === topicId && !item.resolvedAt).length;
  return reviewPriority({ mastery: record.mastery ?? NEUTRAL_MASTERY, daysSincePractice: days, skips: record.skips + queued, safety });
}

const QUEUE_REASON: Record<ReviewItem['reason'], ReviewReason> = { menu: 'saved', skip: 'skipped', missed: 'missed', help: 'saved', 'sim-exit': 'practice', 'sim-unsafe': 'practice' };

export function dailyReview(input: ReviewInput, limit = REVIEW_LIMIT[testBand(input.permitTestDate, input.now)]): ReviewEntry[] {
  const today = localDay(input.now);
  const lessons = new Map(input.lessons.map(lesson => [lesson.id, lesson]));
  const reasons = new Map<string, { reason: ReviewReason; topicId: string; boost: number }>();
  // Saved, skipped and missed items come first: the learner or the lesson asked for them.
  for (const item of input.queue) {
    if (item.resolvedAt) continue;
    const isSim = item.itemId.startsWith('sim:');
    if (isSim || lessons.has(item.itemId) || input.cardIds?.includes(item.itemId)) reasons.set(item.itemId, { reason: QUEUE_REASON[item.reason], topicId: item.topicId, boost: 0.1 });
  }
  for (const attempt of input.attempts) {
    const age = Math.round((today - localDay(new Date(attempt.at))) / DAY);
    if (lessons.has(attempt.itemId) && age >= 0 && age <= 2 && !reasons.has(attempt.itemId)) {
      reasons.set(attempt.itemId, { reason: age === 0 ? 'today' : age === 1 ? 'yesterday' : 'two-days-ago', topicId: lessons.get(attempt.itemId)!.topicId, boost: 0 });
    }
  }
  for (const lesson of input.lessons) {
    const mastery = input.topic(lesson.topicId).mastery;
    if (mastery !== null && mastery < WEAK && lesson.done && !reasons.has(lesson.id)) reasons.set(lesson.id, { reason: 'weak-topic', topicId: lesson.topicId, boost: 0 });
  }
  return [...reasons].map(([id, entry]) => ({ id, reason: entry.reason, priority: topicPriority(input, entry.topicId) + entry.boost }))
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id)).slice(0, limit);
}

// Saved lessons (bookmarked, or saved with Review later) make up today's review. A lesson is due
// until it is answered right in review; each right answer in a row spaces the next review out
// (2, 4, 8, then 16 days), and a miss makes it due again. Due lessons are ordered by review priority P
// and capped like the daily review, so a long saved list never becomes an endless queue.
export type SavedInput = { savedIds: string[]; lessons: ReviewLesson[]; attempts: QuizAttempt[]; topic(topicId: string): TopicRecord; permitTestDate: string | null; now: Date };
export type SavedEntry = { id: string; due: boolean; nextReview: Date | null; priority: number };
const SPACING_DAYS = [2, 4, 8, 16];

export function savedReview(input: SavedInput, limit = REVIEW_LIMIT[testBand(input.permitTestDate, input.now)]): { due: SavedEntry[]; later: SavedEntry[] } {
  const lessons = new Map(input.lessons.map(lesson => [lesson.id, lesson]));
  const priorityInput: ReviewInput = { lessons: input.lessons, queue: [], attempts: input.attempts, topic: input.topic, permitTestDate: input.permitTestDate, now: input.now };
  const entries = [...new Set(input.savedIds)].filter(id => lessons.has(id)).map(id => {
    const reviews = input.attempts.filter(attempt => attempt.itemId === id && attempt.kind === 'review').sort((a, b) => a.at.localeCompare(b.at));
    let streak = 0;
    for (const attempt of reviews) streak = attempt.correct ? streak + 1 : 0;
    const last = reviews.at(-1);
    const nextReview = last && streak ? new Date(localDay(new Date(last.at)) + SPACING_DAYS[Math.min(streak, SPACING_DAYS.length) - 1] * DAY) : null;
    const due = !nextReview || nextReview.getTime() <= localDay(input.now);
    return { id, due, nextReview, priority: topicPriority(priorityInput, lessons.get(id)!.topicId) };
  });
  const byPriority = (a: SavedEntry, b: SavedEntry) => b.priority - a.priority || a.id.localeCompare(b.id);
  const due = entries.filter(entry => entry.due).sort(byPriority);
  return { due: due.slice(0, limit), later: [...due.slice(limit), ...entries.filter(entry => !entry.due).sort((a, b) => a.nextReview!.getTime() - b.nextReview!.getTime())] };
}

// Three practice challenges at a time, chosen by how the learner is doing: unfinished ones (exited,
// unsafe or timed out) first, then untried ones whose lesson is done, then untried ones, then ones
// already handled safely, with weaker topics ahead within each group. A small tie-break that changes
// every other day mixes the picks so the list refreshes.
export type ChallengeState = { id: string; lessonDone: boolean; tried: boolean; safe: boolean; mastery: number | null };
const hash = (text: string) => { let value = 2166136261; for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619); return (value >>> 0) / 4294967296; };

export function pickChallenges(challenges: ChallengeState[], now: Date, count = 3) {
  const period = Math.floor(localDay(now) / DAY / 2);
  const need = (state: ChallengeState) => (state.tried && !state.safe ? 3 : !state.tried && state.lessonDone ? 2 : !state.tried ? 1 : 0)
    + 0.4 * (1 - (state.mastery ?? 0.5)) + 0.5 * hash(`${state.id}:${period}`);
  return [...challenges].sort((a, b) => need(b) - need(a) || a.id.localeCompare(b.id)).slice(0, count).map(state => state.id);
}

// Topic indicator: the owner's mastery bands, worded for learners.
export const TOPIC_BANDS = [
  { min: 0.8, label: 'Strong' }, { min: 0.6, label: 'Developing' }, { min: 0.4, label: 'Needs support' }, { min: 0, label: 'Needs the lesson again' },
] as const;
export const topicBand = (mastery: number) => TOPIC_BANDS.findIndex(band => mastery >= band.min);
