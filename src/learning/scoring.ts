// Lane's explainable learning score. Follows the owner's engine (algorithmforlaneapp.ts, Oct 3,
// 2026), which refines the earlier Driver App Self-Learning Algorithm PDF in three places, noted
// below. Pure functions only. Values stay unrounded: routing compares raw numbers, so a raw
// 0.59875 is below the 0.60 band even though it displays as "0.60". This is a study aid, not a
// DMV prediction.

const clamp01 = (value: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
const bit = (value: boolean | undefined) => value ? 1 : 0;

// Weighted average over only the components that apply.
function weighted(parts: { weight: number; value: number; applies: boolean }[]) {
  const live = parts.filter(part => part.applies);
  const total = live.reduce((sum, part) => sum + part.weight, 0);
  return total ? live.reduce((sum, part) => sum + part.weight * clamp01(part.value), 0) / total : 0;
}

export type AccuracyInput = {
  firstCorrect: boolean;
  // Undefined when no correction question was needed.
  correctionCorrect?: boolean;
  // Average correctness on this topic in later review; undefined without enough history.
  laterReview?: number;
};

// A = 0.60·C1 + 0.25·C2 + 0.15·C3. Owner engine: when no correction was needed, C2 takes the
// first answer's value (the PDF's worked examples used 0).
export function accuracy({ firstCorrect, correctionCorrect, laterReview }: AccuracyInput) {
  const c3 = laterReview === undefined ? 0.5 : clamp01(laterReview);
  return 0.6 * bit(firstCorrect) + 0.25 * bit(correctionCorrect ?? firstCorrect) + 0.15 * c3;
}

export type WorkInput = {
  submitted: boolean;
  // Undefined when no correction/similar question was assigned; it is then left out.
  retryCompleted?: boolean;
  // Undefined when no interactive activity was assigned; it is then left out.
  activityCompleted?: boolean;
  openedHelp: boolean;
};

// W = 0.40·Q + 0.30·R + 0.20·I + 0.10·H. Owner engine (settles DEF-09): an unassigned retry or
// activity is removed and the remaining weights renormalized; Q and H always count.
export function work({ submitted, retryCompleted, activityCompleted, openedHelp }: WorkInput) {
  return weighted([
    { weight: 0.4, value: bit(submitted), applies: true },
    { weight: 0.3, value: bit(retryCompleted), applies: retryCompleted !== undefined },
    { weight: 0.2, value: bit(activityCompleted), applies: activityCompleted !== undefined },
    { weight: 0.1, value: bit(openedHelp), applies: true },
  ]);
}

export type AttentionInput = {
  watchedRatio: number;
  keySegmentSeen: boolean;
  // Fraction of assigned purposeful actions completed; undefined when none were assigned.
  engagement?: number;
};

// N = 0.50·V + 0.30·K + 0.20·E. Owner engine: without an engagement task, E is 1 after watching
// more than 80% of the clip and 0.5 otherwise.
export function attention({ watchedRatio, keySegmentSeen, engagement }: AttentionInput) {
  const v = clamp01(watchedRatio);
  const e = engagement === undefined ? (v > 0.8 ? 1 : 0.5) : clamp01(engagement);
  return 0.5 * v + 0.3 * bit(keySegmentSeen) + 0.2 * e;
}

export const DEFAULT_EXPECTED_SECONDS = 25;

// Time is a small diagnostic, never a grade: fast answers may be guesses, long ones confusion.
export function timeQuality(activeSeconds: number, expectedSeconds = DEFAULT_EXPECTED_SECONDS) {
  if (!Number.isFinite(activeSeconds) || activeSeconds < 0 || !(expectedSeconds > 0)) return 1;
  const ratio = activeSeconds / expectedSeconds;
  if (ratio < 0.25) return 0.45;
  if (ratio < 0.5) return 0.7;
  if (ratio <= 2) return 1;
  if (ratio <= 4) return 0.75;
  return 0.55;
}

export type SessionInput = { accuracy: number; work: number; attention?: number; time: number };

// M = 0.55·A + 0.15·W + 0.20·N + 0.10·T. A standalone card with no video (glossary, flashcard)
// has nothing to attend to, so N is left out and the other weights renormalize.
export function sessionMastery({ accuracy: a, work: w, attention: n, time: t }: SessionInput) {
  return weighted([
    { weight: 0.55, value: a, applies: true },
    { weight: 0.15, value: w, applies: true },
    { weight: 0.2, value: n ?? 0, applies: n !== undefined },
    { weight: 0.1, value: t, applies: true },
  ]);
}

// new = 0.70·old + 0.30·session, so one lucky guess or one bad day cannot swing a profile.
export function smoothMastery(previous: number | null | undefined, session: number) {
  const current = clamp01(session);
  return previous === null || previous === undefined || !Number.isFinite(previous) ? current : 0.7 * clamp01(previous) + 0.3 * current;
}

export type MasteryBand = 'strong' | 'developing' | 'support' | 'instruction';

// Routing bands (app instructions, not grades): strong → proceed; developing → short
// reinforcement; support → correction + similar question; instruction → key part + correction + activity.
export function masteryBand(mastery: number): MasteryBand {
  if (mastery >= 0.8) return 'strong';
  if (mastery >= 0.6) return 'developing';
  if (mastery >= 0.4) return 'support';
  return 'instruction';
}

export type PriorityInput = { mastery: number; daysSincePractice: number; skips: number; safety: number };

// P = 0.50·(1−M) + 0.20·min(D/7,1) + 0.20·min(X/3,1) + 0.10·S. Higher P returns sooner.
// Safety importance S is set by curriculum authors in the 0.50–1.00 range.
export function reviewPriority({ mastery, daysSincePractice, skips, safety }: PriorityInput) {
  const s = Math.min(1, Math.max(0.5, Number.isFinite(safety) ? safety : 0.5));
  return 0.5 * (1 - clamp01(mastery)) + 0.2 * Math.min(Math.max(0, daysSincePractice) / 7, 1) + 0.2 * Math.min(Math.max(0, skips) / 3, 1) + 0.1 * s;
}

export type ReadinessStatus = 'Needs Foundation' | 'Developing' | 'Permit Test Ready' | 'Highway Confident';

// Owner-approved October 17: completion drives 80% of readiness; topic mastery supplies 20%.
// Round only the final score. This changes no mastery or routing values, and stores no new data.
export function readiness(topicMasteries: number[], lessons: { completed: number; total: number }): { score: number; status: ReadinessStatus; strongTopics: number; topics: number } {
  const completion = lessons.total > 0 ? clamp01(lessons.completed / lessons.total) : 0;
  const mastery = topicMasteries.length ? topicMasteries.reduce((sum, value) => sum + clamp01(value), 0) / topicMasteries.length : 0;
  const score = lessons.total > 0 ? Math.round(80 * completion + 20 * mastery) : 0;
  const strongTopics = topicMasteries.filter(value => value >= 0.7).length;
  const status: ReadinessStatus = score >= 85 && strongTopics >= Math.floor(topicMasteries.length * 0.8) ? 'Highway Confident'
    : score >= 70 ? 'Permit Test Ready' : score >= 50 ? 'Developing' : 'Needs Foundation';
  return { score, status, strongTopics, topics: topicMasteries.length };
}

// Home's readiness goal, worded for the learner's main goal from onboarding. Every version is the same
// readiness score (an estimate from practice in Lane; the disclaimer is in Settings and Terms).
export type GoalKind = 'permit' | 'driver' | 'other';
export const driverClass = (score: number) => score >= 90 ? 'Class A+' : score >= 80 ? 'Class A' : score >= 65 ? 'Class B' : score >= 45 ? 'Class C' : 'Learner';
// Score thresholds where each label starts, lowest first. Home's gauge draws these as ticks.
export const DRIVER_CLASS_STEPS = [[45, 'Class C'], [65, 'Class B'], [80, 'Class A'], [90, 'Class A+']] as const;
export const STATUS_STEPS = [[50, 'Developing'], [70, 'Permit Test Ready'], [85, 'Highway Confident']] as const;
export type ReadinessStep = { label: string; points: number; topics: number };
// The next label above where the learner is now, or null at the top. Highway Confident also needs 80% of
// topics strong (readiness() above), so its step counts whatever is still missing: points, topics or both.
export function nextReadinessStep(goal: GoalKind, result: { score: number; status: ReadinessStatus; strongTopics: number; topics: number }): ReadinessStep | null {
  if (goal === 'driver') {
    const next = DRIVER_CLASS_STEPS.find(([at]) => result.score < at);
    return next ? { label: next[1], points: next[0] - result.score, topics: 0 } : null;
  }
  if (result.status === 'Highway Confident') return null;
  const next = STATUS_STEPS.find(([at]) => result.score < at);
  if (next && next[1] !== 'Highway Confident') return { label: next[1], points: next[0] - result.score, topics: 0 };
  const [highway] = STATUS_STEPS.slice(-1);
  return { label: highway[1], points: Math.max(0, highway[0] - result.score), topics: Math.max(0, Math.floor(result.topics * 0.8) - result.strongTopics) };
}
export function goalReadiness(goal: GoalKind, result: { score: number; status: ReadinessStatus }) {
  if (goal === 'permit') return { title: 'Permit test readiness', value: `${result.score}%`, detail: result.status, score: result.score };
  if (goal === 'driver') return { title: 'Driver class', value: driverClass(result.score), detail: `Readiness ${result.score}`, score: result.score };
  return { title: 'Driver readiness', value: String(result.score), detail: result.status, score: result.score };
}
