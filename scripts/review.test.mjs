import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyReview, testBand, REVIEW_LIMIT, savedReview, pickChallenges, topicBand, TOPIC_BANDS } from '../src/learning/review.ts';

const now = new Date(2026, 9, 15, 12);
const blank = { mastery: null, lastPracticedAt: null, attempts: 0, correct: 0, skips: 0, help: 0, retries: 0, reviewAttempts: 0, reviewCorrect: 0 };
const lessons = [
  { id: 'a', topicId: 'right-of-way', safety: 0.9, done: true },
  { id: 'b', topicId: 'freeway', safety: 0.9, done: true },
  { id: 'c', topicId: 'car-readiness', safety: 0.6, done: true },
  { id: 'd', topicId: 'drive-test', safety: 0.6, done: false },
  { id: 'e', topicId: 'signals', safety: 0.8, done: false },
];
const at = daysAgo => new Date(2026, 9, 15 - daysAgo, 9).toISOString();
const input = (over = {}) => ({ lessons, queue: [], attempts: [], topic: () => blank, permitTestDate: null, now, ...over });

test('nothing to review for a learner with no history', () => {
  assert.deepEqual(dailyReview(input()), []);
});

test('review draws from today, yesterday, two days ago, the queue and weak topics, never older attempts', () => {
  const attempts = [{ itemId: 'a', at: at(0) }, { itemId: 'b', at: at(1) }, { itemId: 'c', at: at(2) }, { itemId: 'd', at: at(3) }];
  const queue = [{ itemId: 'e', topicId: 'signals', reason: 'menu', addedAt: at(5) }, { itemId: 'sim:railroad-clear-exit', topicId: 'railroad-crossing-clearance', reason: 'sim-exit', addedAt: at(0) }];
  const topic = id => id === 'car-readiness' ? { ...blank, mastery: 0.4 } : blank;
  const entries = dailyReview(input({ attempts, queue, topic }), 10);
  const reasons = Object.fromEntries(entries.map(entry => [entry.id, entry.reason]));
  assert.deepEqual(reasons, { a: 'today', b: 'yesterday', c: 'two-days-ago', e: 'saved', 'sim:railroad-clear-exit': 'practice' });
  assert.ok(!('d' in reasons), 'three-day-old attempts are not daily review');
});

test('weak topics appear only for finished lessons, and resolved items drop out', () => {
  const topic = id => id === 'freeway' || id === 'drive-test' ? { ...blank, mastery: 0.5 } : blank;
  const queue = [{ itemId: 'a', topicId: 'right-of-way', reason: 'skip', addedAt: at(1), resolvedAt: at(0) }];
  assert.deepEqual(dailyReview(input({ topic, queue })).map(entry => [entry.id, entry.reason]), [['b', 'weak-topic']]);
});

test('a queued item outranks a recent one even on a less safety-critical topic', () => {
  const queue = [{ itemId: 'c', topicId: 'car-readiness', reason: 'missed', addedAt: at(0) }];
  const attempts = [{ itemId: 'b', at: at(0) }];
  const entries = dailyReview(input({ queue, attempts }));
  // c: .5·.5 + .2·(1/3) + .1·.6 + .1 queue boost ≈ .477; b: .5·.5 + .1·.9 = .34
  assert.deepEqual(entries.map(e => [e.id, e.reason]), [['c', 'missed'], ['b', 'today']]);
  assert.ok(Math.abs(entries[0].priority - (0.25 + 0.2 / 3 + 0.06 + 0.1)) < 1e-9);
});

test('a near permit-test date allows a longer session, never a different rule', () => {
  assert.equal(testBand(null, now), 'none');
  assert.equal(testBand('2026-12-01', now), 'none');
  assert.equal(testBand('2026-10-29', now), 'month');
  assert.equal(testBand('2026-10-22', now), 'weeks');
  assert.equal(testBand('2026-10-15', now), 'days');
  assert.equal(testBand('2026-10-01', now), 'none', 'a past date changes nothing');
  assert.ok(REVIEW_LIMIT.days > REVIEW_LIMIT.none);
});

const review = (itemId, correct, daysAgo) => ({ itemId, topicId: 'x', kind: 'review', correct, activeMs: 9000, at: at(daysAgo), id: itemId + daysAgo });
const saved = (over = {}) => savedReview({ savedIds: [], lessons, attempts: [], topic: () => blank, permitTestDate: null, now, ...over });

test('saved lessons are due until reviewed, then spaced 2, 4, 8, 16 days', () => {
  assert.deepEqual(saved({ savedIds: ['a', 'b', 'missing'] }).due.map(entry => entry.id).sort(), ['a', 'b'], 'unknown ids are ignored');
  const once = saved({ savedIds: ['a'], attempts: [review('a', true, 1)] });
  assert.equal(once.due.length, 0); assert.equal(once.later[0].nextReview.getDate(), 16, 'one right answer: back in 2 days');
  assert.equal(saved({ savedIds: ['a'], attempts: [review('a', true, 2)] }).due.length, 1, 'due again on day 2');
  assert.equal(saved({ savedIds: ['a'], attempts: [review('a', true, 6), review('a', true, 3)] }).due.length, 0, 'two in a row: 4 days');
  assert.equal(saved({ savedIds: ['a'], attempts: [review('a', true, 6), review('a', false, 1)] }).due.length, 1, 'a miss makes it due again');
  assert.equal(saved({ savedIds: ['a'], attempts: [{ ...review('a', true, 0), kind: 'primary' }] }).due.length, 1, 'only review answers count');
});

test('due saved lessons follow review priority and the daily cap', () => {
  const weak = { ...blank, mastery: 0.2, lastPracticedAt: at(1) }, strong = { ...blank, mastery: 0.95, lastPracticedAt: at(1) };
  const result = saved({ savedIds: ['a', 'b'], topic: id => id === 'freeway' ? weak : strong });
  assert.deepEqual(result.due.map(entry => entry.id), ['b', 'a']);
  const many = savedReview({ savedIds: lessons.map(lesson => lesson.id), lessons, attempts: [], topic: () => blank, permitTestDate: null, now }, 2);
  assert.equal(many.due.length, 2); assert.equal(many.later.length, 3, 'over the cap waits for another day');
});

test('three challenges: unfinished first, rotating every other day', () => {
  const states = Array.from({ length: 10 }, (_, i) => ({ id: 'sim-' + i, lessonDone: i < 6, tried: i < 3, safe: i < 2, mastery: 0.5 }));
  const picks = pickChallenges(states, now);
  assert.equal(picks.length, 3);
  assert.equal(picks[0], 'sim-2', 'tried but not yet safe comes first');
  assert.ok(picks.slice(1).every(id => ['sim-3', 'sim-4', 'sim-5'].includes(id)), 'then untried ones whose lesson is done');
  assert.deepEqual(pickChallenges(states, new Date(2026, 9, 15, 20)), picks, 'same day, same picks');
  const later = Array.from({ length: 12 }, (_, d) => pickChallenges(states, new Date(2026, 9, 15 + 2 * d, 12)).join());
  assert.ok(new Set(later).size > 1, 'the mix changes over days');
});

test('topic bands follow the owner mastery bands', () => {
  assert.deepEqual([0.85, 0.8, 0.79, 0.6, 0.59, 0.4, 0.39, 0].map(value => TOPIC_BANDS[topicBand(value)].label),
    ['Strong', 'Strong', 'Developing', 'Developing', 'Needs support', 'Needs support', 'Needs the lesson again', 'Needs the lesson again']);
});
