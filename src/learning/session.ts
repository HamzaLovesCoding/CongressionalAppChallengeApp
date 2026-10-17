import { accuracy, attention, sessionMastery, timeQuality, work } from './scoring.ts';
import type { TopicRecord } from '../feed/progress';

// Everything that happened for one lesson during one feed visit.
export type LessonVisit = {
  firstCorrect: boolean | null;
  // undefined: no correction was needed.
  correctionCorrect?: boolean;
  correctionAssigned: boolean;
  openedHelp: boolean;
  activityAssigned: boolean;
  activityCompleted: boolean;
  firstAnswerMs: number | null;
  // engagement: share of purposeful actions done right (text lessons: blanks over taps); optional.
  watch?: { watchedRatio: number; keySegmentSeen: boolean; engagement?: number };
};

export const newVisit = (): LessonVisit => ({ firstCorrect: null, correctionAssigned: false, openedHelp: false, activityAssigned: false, activityCompleted: false, firstAnswerMs: null });

// Later-review correctness (C3) needs at least two review answers to count as history.
export function laterReview(record: TopicRecord) {
  return record.reviewAttempts >= 2 ? record.reviewCorrect / record.reviewAttempts : undefined;
}

// Session mastery for a visit, or null when the learner never answered (nothing to score).
export function visitMastery(visit: LessonVisit, record: TopicRecord) {
  if (visit.firstCorrect === null) return null;
  const a = accuracy({ firstCorrect: visit.firstCorrect, correctionCorrect: visit.correctionCorrect, laterReview: laterReview(record) });
  const w = work({ submitted: true, retryCompleted: visit.correctionAssigned ? visit.correctionCorrect !== undefined : undefined, activityCompleted: visit.activityAssigned ? visit.activityCompleted : undefined, openedHelp: visit.openedHelp });
  const n = visit.watch ? attention({ watchedRatio: visit.watch.watchedRatio, keySegmentSeen: visit.watch.keySegmentSeen, engagement: visit.watch.engagement }) : undefined;
  const t = timeQuality(visit.firstAnswerMs === null ? Number.NaN : visit.firstAnswerMs / 1000);
  return sessionMastery({ accuracy: a, work: w, attention: n, time: t });
}
