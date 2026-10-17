import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeRanges, coverage, watchSummary } from '../src/learning/watch.ts';
import { visitMastery, newVisit, laterReview } from '../src/learning/session.ts';

const blank = { mastery: null, lastPracticedAt: null, attempts: 0, correct: 0, skips: 0, help: 0, retries: 0, reviewAttempts: 0, reviewCorrect: 0 };

test('played ranges merge and replays are not double counted', () => {
  assert.deepEqual(mergeRanges([[5, 10], [0, 4], [3, 6], [20, 18]]), [[0, 10]]);
  assert.equal(coverage([[0, 10], [0, 10]], 0, 20), 0.5);
});

test('without a supplied key segment, the whole clip must be watched to count as seen', () => {
  assert.deepEqual(watchSummary([[0, 29]], 30), { watchedRatio: 29 / 30, keySegmentSeen: true });
  assert.deepEqual(watchSummary([[0, 10]], 30), { watchedRatio: 1 / 3, keySegmentSeen: false });
  assert.deepEqual(watchSummary([], 0), { watchedRatio: 0, keySegmentSeen: false });
});

test('a supplied key segment is judged on its own', () => {
  const key = { start: 10, end: 20 };
  assert.equal(watchSummary([[10, 19.5]], 30, key).keySegmentSeen, true);
  assert.equal(watchSummary([[0, 12]], 30, key).keySegmentSeen, false);
  assert.equal(watchSummary([[25, 30]], 30, key).keySegmentSeen, false, 'skipping to the end does not count');
});

test('a visit without an answer is not scored', () => {
  assert.equal(visitMastery(newVisit(), blank), null);
});

test('visit mastery follows the formulas; skimming lowers it', () => {
  const full = visitMastery({ ...newVisit(), firstCorrect: true, firstAnswerMs: 18000, watch: { watchedRatio: 1, keySegmentSeen: true } }, blank);
  // A=0.925, W=0.8 (submitted; no retry or activity assigned), N=1, T=1 → 0.55·0.925+0.15·0.8+0.2+0.1
  assert.ok(Math.abs(full - 0.92875) < 1e-9, String(full));
  const skimmed = visitMastery({ ...newVisit(), firstCorrect: true, firstAnswerMs: 3000, watch: { watchedRatio: 0.2, keySegmentSeen: false } }, blank);
  assert.ok(skimmed < full);
  const corrected = visitMastery({ ...newVisit(), firstCorrect: false, correctionAssigned: true, correctionCorrect: true, openedHelp: true, firstAnswerMs: 20000, watch: { watchedRatio: 1, keySegmentSeen: true } }, blank);
  assert.ok(Math.abs(corrected - (0.55 * 0.325 + 0.15 * 1 + 0.2 + 0.1)) < 1e-9);
});

test('later review needs two answers of history', () => {
  assert.equal(laterReview({ ...blank, reviewAttempts: 1, reviewCorrect: 1 }), undefined);
  assert.equal(laterReview({ ...blank, reviewAttempts: 4, reviewCorrect: 3 }), 0.75);
});
