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

import { goalReadiness, driverClass, nextReadinessStep, readiness as readinessOf } from '../src/learning/scoring.ts';
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

test('the next readiness step names the next label and the real distance to it', () => {
  const at = (score, status, strongTopics = 0, topics = 10) => ({ score, status, strongTopics, topics });
  assert.deepEqual(nextReadinessStep('permit', at(42, 'Needs Foundation')), { label: 'Developing', points: 8, topics: 0 });
  assert.deepEqual(nextReadinessStep('other', at(50, 'Developing')), { label: 'Permit Test Ready', points: 20, topics: 0 });
  assert.deepEqual(nextReadinessStep('permit', at(84, 'Permit Test Ready', 8)), { label: 'Highway Confident', points: 1, topics: 0 });
  // Highway Confident also needs 8 of 10 topics strong: the step names every missing part, never points alone.
  assert.deepEqual(nextReadinessStep('permit', at(83, 'Permit Test Ready', 2)), { label: 'Highway Confident', points: 2, topics: 6 });
  assert.deepEqual(nextReadinessStep('permit', at(90, 'Permit Test Ready', 5)), { label: 'Highway Confident', points: 0, topics: 3 });
  assert.equal(nextReadinessStep('permit', at(95, 'Highway Confident', 9)), null);
  assert.deepEqual(nextReadinessStep('driver', at(0, 'Needs Foundation')), { label: 'Class C', points: 45, topics: 0 });
  assert.deepEqual(nextReadinessStep('driver', at(65, 'Developing')), { label: 'Class A', points: 15, topics: 0 });
  assert.equal(nextReadinessStep('driver', at(90, 'Permit Test Ready')), null);
  // Every driver step agrees with driverClass at its threshold.
  for (const score of [44, 45, 64, 65, 79, 80, 89]) {
    const step = nextReadinessStep('driver', at(score, 'Developing'));
    assert.equal(driverClass(score + step.points), step.label);
  }
  // Every status step agrees with readiness() at its threshold.
  const real = readinessOf([1, 1, 1, 1, 1], { completed: 13, total: 24 });
  const step = nextReadinessStep('permit', real);
  assert.equal(real.status, 'Developing');
  assert.deepEqual(step, { label: 'Permit Test Ready', points: 70 - real.score, topics: 0 });
});

// Independent restatement of the owner formula (October 17): 80% completed lessons + 20% average topic
// mastery (each clamped to 0–1, unpracticed = 0), rounded once; labels by score, Highway also needs 80% of topics strong.
function ownerReadiness(masteries, completed, total) {
  let sum = 0;
  for (const m of masteries) sum += m < 0 ? 0 : m > 1 ? 1 : m;
  const raw = (total ? 80 * Math.min(completed, total) / total : 0) + (masteries.length ? 20 * sum / masteries.length : 0);
  const score = total ? Math.round(raw) : 0;
  const strong = masteries.filter(m => m >= 0.7).length;
  const status = score >= 85 && strong >= Math.floor(masteries.length * 0.8) ? 'Highway Confident' : score >= 70 ? 'Permit Test Ready' : score >= 50 ? 'Developing' : 'Needs Foundation';
  return { score, status, strong };
}
const BANDS = { 'Developing': 50, 'Permit Test Ready': 70, 'Highway Confident': 85 };
const CLASSES = { 'Class C': 45, 'Class B': 65, 'Class A': 80, 'Class A+': 90 };

test('readiness matches the owner formula on 20,000 random learners, and every next step is honest', () => {
  let seed = 17;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let run = 0; run < 20000; run++) {
    const masteries = Array.from({ length: 1 + Math.floor(random() * 24) }, () => random() < 0.2 ? 0 : random() * 1.4 - 0.2);
    const total = 24, completed = Math.floor(random() * 25);
    const real = readinessOf(masteries, { completed, total });
    const expected = ownerReadiness(masteries, completed, total);
    const label = `run ${run}: ${completed}/${total}, ${masteries.length} topics`;
    assert.equal(real.score, expected.score, label);
    assert.equal(real.status, expected.status, label);
    assert.equal(real.strongTopics, expected.strong, label);
    assert.ok(Number.isInteger(real.score) && real.score >= 0 && real.score <= 100, label);

    // Permit/other: doing exactly what the step says reaches its label, and the label is the next one up.
    const step = nextReadinessStep('permit', real);
    if (real.status === 'Highway Confident') assert.equal(step, null, label);
    else if (step.label === 'Highway Confident') {
      assert.ok(real.score + step.points >= 85 && real.strongTopics + step.topics >= Math.floor(masteries.length * 0.8), label);
      assert.ok(step.points > 0 || step.topics > 0, label);
    } else {
      assert.equal(step.topics, 0, label);
      assert.equal(real.score + step.points, BANDS[step.label], label);
      assert.ok(step.points > 0, label);
    }
    // Driver: the next class is exactly score + points away, and none lies in between.
    const drive = nextReadinessStep('driver', real);
    if (real.score >= 90) assert.equal(drive, null, label);
    else {
      assert.equal(driverClass(real.score + drive.points), drive.label, label);
      assert.notEqual(driverClass(real.score + drive.points - 1), drive.label, label);
      assert.equal(real.score + drive.points, CLASSES[drive.label], label);
    }
    // One more completed lesson, or more mastery in one topic, never lowers the score.
    if (completed < total) assert.ok(readinessOf(masteries, { completed: completed + 1, total }).score >= real.score, label);
    const better = masteries.map((m, i) => i === 0 ? Math.min(1, Math.max(0, m) + 0.3) : m);
    assert.ok(readinessOf(better, { completed, total }).score >= real.score, label);
  }
});

test('readiness at the edges: nothing done, everything done, and the 80/20 split', () => {
  assert.equal(readinessOf([], { completed: 0, total: 24 }).score, 0);
  assert.equal(readinessOf([0, 0], { completed: 0, total: 0 }).score, 0, 'an empty catalog never divides by zero');
  assert.equal(readinessOf([0, 0, 0], { completed: 24, total: 24 }).score, 80, 'completion alone caps at 80');
  assert.equal(readinessOf([1, 1, 1], { completed: 0, total: 24 }).score, 20, 'mastery alone caps at 20');
  assert.deepEqual(readinessOf([1, 1, 1, 1, 1], { completed: 24, total: 24 }), { score: 100, status: 'Highway Confident', strongTopics: 5, topics: 5 });
  assert.equal(readinessOf([2, -1], { completed: 30, total: 24 }).score, 90, 'out-of-range inputs are clamped');
  // 1 of 24 lessons is 3.33 points: rounding happens once, on the total.
  assert.equal(readinessOf([0.5], { completed: 1, total: 24 }).score, 13);
});
