import test from 'node:test';
import assert from 'node:assert/strict';
import { accuracy, work, attention, timeQuality, sessionMastery, smoothMastery, masteryBand, reviewPriority } from '../src/learning/scoring.ts';

const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} ≠ ${expected}`);

// Owner engine (algorithmforlaneapp.ts): with no correction needed, C2 takes the first answer's value.
test('accuracy uses first answer, correction, and later review, defaulting review to 0.5', () => {
  close(accuracy({ firstCorrect: true }), 0.925, 'correct, no history');
  close(accuracy({ firstCorrect: false, correctionCorrect: true }), 0.325, 'corrected');
  close(accuracy({ firstCorrect: true, laterReview: 1 }), 1, 'remembered later');
  close(accuracy({ firstCorrect: false, correctionCorrect: false }), 0.075, 'missed twice');
  close(accuracy({ firstCorrect: true, laterReview: 7 }), 1, 'review is clamped');
  close(accuracy({ firstCorrect: false }), 0.075, 'missed, no correction given');
});

// Owner engine (settles DEF-09): an unassigned retry or activity is left out of the denominator.
test('work drops an unassigned retry or activity', () => {
  close(work({ submitted: true, openedHelp: false }), 0.8, 'nothing else assigned');
  close(work({ submitted: true, retryCompleted: false, openedHelp: false }), 0.5, 'one submission');
  close(work({ submitted: true, retryCompleted: true, openedHelp: true }), 1, 'correction + help, no activity assigned');
  close(work({ submitted: true, retryCompleted: true, activityCompleted: false, openedHelp: true }), 0.8, 'skipped an assigned activity');
  close(work({ submitted: true, retryCompleted: true, activityCompleted: true, openedHelp: true }), 1, 'everything');
  close(work({ submitted: false, retryCompleted: false, openedHelp: false }), 0, 'abandoned');
  assert.ok(work({ submitted: true, retryCompleted: false, openedHelp: false }) < work({ submitted: true, retryCompleted: true, activityCompleted: true, openedHelp: false }));
});

// Owner engine: without an engagement task, E is 1 after watching over 80% and 0.5 otherwise.
test('attention defaults engagement from how much was watched', () => {
  close(attention({ watchedRatio: 1, keySegmentSeen: true, engagement: 0.5 }), 0.9, 'document example');
  close(attention({ watchedRatio: 1, keySegmentSeen: true }), 1, 'no task assigned');
  close(attention({ watchedRatio: 0.2, keySegmentSeen: false, engagement: 0 }), 0.1, 'skimmed');
  close(attention({ watchedRatio: 0.2, keySegmentSeen: false }), 0.2, 'skimmed, no task');
  close(attention({ watchedRatio: 0.8, keySegmentSeen: true }), 0.8, 'exactly 80% is not over 80%');
  close(attention({ watchedRatio: 4, keySegmentSeen: true }), 1, 'ratio is capped');
});

test('time quality bands match the algorithm boundaries', () => {
  for (const [seconds, expected] of [[4, 0.45], [6.24, 0.45], [6.25, 0.7], [12.4, 0.7], [12.5, 1], [18, 1], [50, 1], [50.1, 0.75], [100, 0.75], [100.1, 0.55]]) close(timeQuality(seconds), expected, `${seconds}s`);
  close(timeQuality(10, 10), 1, 'custom expectation');
  close(timeQuality(Number.NaN), 1, 'missing time is not penalized');
});

test('session mastery reproduces the formulas with unrounded values', () => {
  // Corrected worked examples (the printed document values had arithmetic errors).
  close(sessionMastery({ accuracy: 0.675, work: 0.4, attention: 1, time: 1 }), 0.73125, 'Example A as printed inputs');
  close(sessionMastery({ accuracy: 0.325, work: 0.8, attention: 1, time: 1 }), 0.59875, 'Example B as printed inputs');
  close(sessionMastery({ accuracy: 0.075, work: 0.4, attention: 0.1, time: 0.45 }), 0.16625, 'Example C with corrected N');
  close(sessionMastery({ accuracy: 1, work: 1, time: 1 }), 1, 'no attention component');
  close(sessionMastery({ accuracy: 0.5, work: 0.5, time: 0.5 }), 0.5, 'renormalized without attention');
});

test('band routing compares raw values, so 0.59875 is support, not developing', () => {
  const raw = sessionMastery({ accuracy: 0.325, work: 0.8, attention: 1, time: 1 });
  assert.equal(Number(raw.toFixed(2)), 0.6, 'it would display as 0.60');
  assert.equal(masteryBand(raw), 'support');
  assert.equal(masteryBand(0.6), 'developing');
  assert.equal(masteryBand(0.8), 'strong');
  assert.equal(masteryBand(0.79999), 'developing');
  assert.equal(masteryBand(0.4), 'support');
  assert.equal(masteryBand(0.39999), 'instruction');
});

test('smoothing blends 70/30 and starts from the first session', () => {
  close(smoothMastery(null, 0.8), 0.8, 'first session');
  close(smoothMastery(0.5, 1), 0.65, 'blend');
  close(smoothMastery(0.9, 0), 0.63, 'one bad day');
  close(smoothMastery(undefined, 2), 1, 'clamped');
});

test('review priority favors weak, forgotten, skipped, safety-critical topics', () => {
  const weak = reviewPriority({ mastery: 0.35, daysSincePractice: 1, skips: 1, safety: 1 });
  const strong = reviewPriority({ mastery: 0.85, daysSincePractice: 6, skips: 0, safety: 0.7 });
  close(weak, 0.5 * 0.65 + 0.2 / 7 + 0.2 / 3 + 0.1, 'topic 1');
  close(strong, 0.5 * 0.15 + 0.2 * 6 / 7 + 0.07, 'topic 2');
  assert.ok(weak > strong);
  close(reviewPriority({ mastery: 1, daysSincePractice: 30, skips: 9, safety: 1 }), 0.5, 'caps on days and skips');
  close(reviewPriority({ mastery: 1, daysSincePractice: 0, skips: 0, safety: 0.1 }), 0.05, 'safety floor 0.5');
  assert.ok(reviewPriority({ mastery: 0.5, daysSincePractice: 2, skips: 2, safety: 1 }) > reviewPriority({ mastery: 0.5, daysSincePractice: 2, skips: 0, safety: 1 }), 'skips raise priority');
});

import { goalReadiness, driverClass, readiness as readinessOf } from '../src/learning/scoring.ts';
test('the Home goal words one readiness score three ways', () => {
  const result = readinessOf([0.9, 0.7, 0.5, 0], { completed: 12, total: 24 });
  assert.equal(result.score, 51);
  assert.deepEqual(goalReadiness('permit', result), { title: 'Permit test readiness', value: '51%', detail: 'Developing', score: 51 });
  assert.deepEqual(goalReadiness('driver', result), { title: 'Driver class', value: 'Class C', detail: 'Readiness 51', score: 51 });
  assert.deepEqual(goalReadiness('other', result), { title: 'Driver readiness', value: '51', detail: 'Developing', score: 51 });
  assert.deepEqual([95, 90, 89, 80, 79, 65, 64, 45, 44, 0].map(driverClass), ['Class A+', 'Class A+', 'Class A', 'Class A', 'Class B', 'Class B', 'Class C', 'Class C', 'Learner', 'Learner']);
});

// The Driver App Self-Learning Algorithm PDF's worked examples, fed their stated component values.
test('PDF worked examples: mastery, time quality and review priority formulas', () => {
  // The PDF prints 0.69125, 0.61875 and 0.20225; its formula M = .55A + .15W + .20N + .10T gives these.
  // Example B sits just under 0.60, so it routes to support (correction + similar question).
  close(sessionMastery({ accuracy: 0.675, work: 0.4, attention: 1, time: 1 }), 0.73125, 'Example A');
  close(sessionMastery({ accuracy: 0.325, work: 0.8, attention: 1, time: 1 }), 0.59875, 'Example B');
  assert.equal(masteryBand(0.59875), 'support');
  close(sessionMastery({ accuracy: 0.075, work: 0.4, attention: 0.4, time: 0.45 }), 0.22625, 'Example C');
  assert.equal(timeQuality(18), 1); assert.equal(timeQuality(4), 0.45);
  close(attention({ watchedRatio: 1, keySegmentSeen: true, engagement: 0.5 }), 0.9, 'attention example');
  close(work({ submitted: true, retryCompleted: true, activityCompleted: false, openedHelp: true }), 0.8, 'work example');
  // The PDF prints ≈0.54 and ≈0.27 for its two topics; its own formula gives 0.520 and 0.316 (same order).
  close(reviewPriority({ mastery: 0.35, daysSincePractice: 1, skips: 1, safety: 1 }), 0.325 + 0.2 / 7 + 0.2 / 3 + 0.1, 'priority topic 1');
  close(reviewPriority({ mastery: 0.85, daysSincePractice: 6, skips: 0, safety: 0.7 }), 0.075 + 0.2 * 6 / 7 + 0.07, 'priority topic 2');
  // Owner engine (algorithmforlaneapp.ts) refinement: a correct first answer with no correction needed counts
  // C2 = C1, so A is 0.925 (the PDF's example used C2 = 0 for 0.675).
  close(accuracy({ firstCorrect: true }), 0.925, 'engine C2 rule');
  close(accuracy({ firstCorrect: false, correctionCorrect: true }), 0.325, 'wrong first, corrected');
});


test('readiness is driven by completed lessons with a bounded mastery contribution', () => {
  assert.equal(readinessOf([0.6, 0.6], { completed: 12, total: 24 }).score, 52);
  assert.equal(readinessOf([1, 1], { completed: 0, total: 24 }).score, 20, 'mastery alone supplies at most 20 points');
  assert.equal(readinessOf([0, 0], { completed: 24, total: 24 }).score, 80, 'legacy completions still count without mastery records');
  assert.equal(readinessOf([1, 1], { completed: 24, total: 24 }).score, 100);
  assert.equal(readinessOf([], { completed: 0, total: 0 }).score, 0);
  assert.equal(readinessOf([1], { completed: 0, total: 0 }).score, 0, 'an empty catalog has no readiness');
  assert.equal(readinessOf([NaN, -1, Infinity], { completed: -1, total: 24 }).score, 0);
  assert.equal(readinessOf([2], { completed: 99, total: 24 }).score, 100);
});

test('each new completion raises readiness even within an already-practiced topic', () => {
  const scores = Array.from({ length: 25 }, (_, completed) => readinessOf([0.8, 0, 0], { completed, total: 24 }).score);
  for (let i = 1; i < scores.length; i++) assert.ok(scores[i] > scores[i - 1]);
  assert.equal(readinessOf([0.599], { completed: 12, total: 24 }).score, 52, 'round once after blending');
  assert.equal(readinessOf([1, 1, 1, 1, 0], { completed: 24, total: 24 }).status, 'Highway Confident');
  assert.equal(readinessOf([0, 0, 0, 0, 0], { completed: 24, total: 24 }).status, 'Permit Test Ready', 'the highest label still requires strong topics');
});
