import test from 'node:test';
import assert from 'node:assert/strict';
import { planFeed, resumeLesson, checkFor, STANDALONE_SIM_AFTER, CARD_GAPS } from '../src/learning/planner.ts';

const blank = { mastery: null, lastPracticedAt: null, attempts: 0, correct: 0, skips: 0, help: 0, retries: 0, reviewAttempts: 0, reviewCorrect: 0 };
const lessons = Array.from({ length: 8 }, (_, i) => ({ id: `l${i + 1}`, topicId: `t${i + 1}`, safety: i === 2 ? 0.6 : 0.9, hasRecall: true, hasGlossary: i !== 4, scenarioId: i === 1 ? 'simA' : undefined }));
const sims = [{ id: 'simA', topicId: 'ta', lessonId: 'l2' }, { id: 'simSolo', topicId: 'ts', lessonId: null }];
const cards = [{ id: 'g1', kind: 'glossary', topicId: 't1' }, { id: 'f1', kind: 'flashcard', topicId: 't2' }, { id: 'p1', kind: 'permit-post', topicId: 't3' }];
const now = new Date(2026, 9, 15, 12);
const state = (overrides = {}) => ({ done: () => false, topic: () => blank, safeSim: () => false, review: [], position: null, permitTestDate: null, now, ...overrides });
const ids = plan => plan.map(item => `${item.kind}:${item.id}`);

test('a new learner starts at lesson 1, then 2, with nothing between them', () => {
  const plan = planFeed(lessons, sims, cards, state());
  assert.deepEqual(ids(plan).slice(0, 2), ['lesson:l1', 'lesson:l2']);
});

test('a related simulation follows its lesson until the safe choice is made', () => {
  const plan = ids(planFeed(lessons, sims, cards, state()));
  assert.equal(plan[plan.indexOf('lesson:l2') + 1], 'sim:simA');
  const safe = ids(planFeed(lessons, sims, cards, state({ safeSim: id => id === 'simA' })));
  assert.ok(!safe.includes('sim:simA'));
});

test('a simulation without a lesson is placed after a fixed number of lessons', () => {
  const plan = planFeed(lessons, sims, cards, state());
  const solo = plan.findIndex(item => item.id === 'simSolo');
  assert.equal(plan.slice(0, solo).filter(item => item.kind === 'lesson').length, STANDALONE_SIM_AFTER);
});

test('every lesson and simulation appears once; cards are spaced, never back to back', () => {
  const plan = planFeed(lessons, sims, cards, state());
  const keys = ids(plan);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(plan.filter(item => item.kind === 'lesson').length, lessons.length);
  for (let i = 1; i < plan.length; i++) assert.ok(!(plan[i].kind === 'card' && plan[i - 1].kind === 'card'), `cards adjacent at ${i}`);
});

// A full 24-lesson unit with plenty of cards, for where the cards land.
const unit = Array.from({ length: 24 }, (_, i) => ({ id: `u${i + 1}`, topicId: `t${i % 12}`, safety: 0.9, hasRecall: true, hasGlossary: true }));
const deck = ['glossary', 'flashcard', 'permit-post'].flatMap(kind => Array.from({ length: 6 }, (_, i) => ({ id: `${kind}-${i}`, kind, topicId: `t${i}` })));
// For each card: how many lessons come before it in the plan.
const cardSpots = plan => plan.flatMap((item, index) => item.kind === 'card' ? [plan.slice(0, index).filter(entry => entry.kind === 'lesson').length] : []);

test('with no test date, one card comes in the first five lessons, a few in the middle, most at the end', () => {
  const plan = planFeed(unit, [], deck, state());
  const spots = cardSpots(plan);
  assert.equal(spots.filter(at => at <= 5).length, 1, 'one card among the first five lessons');
  assert.equal(plan.find(item => item.kind === 'card').id.startsWith('permit-post'), true, 'and it is a permit test tip');
  const middle = spots.filter(at => at > 5 && at <= 16).length, end = spots.filter(at => at > 16).length;
  assert.ok(middle >= 1 && middle < end, `some in the middle (${middle}), most at the end (${end})`);
  assert.equal(spots.length, 8, 'as many cards as one every three lessons');
  assert.ok(plan.filter(item => item.kind === 'card' && item.id.startsWith('permit-post')).length >= 3, 'permit tips appear early, in the middle stretch and at the end');
});

test('cards still come more often as the permit test gets closer', () => {
  assert.deepEqual(CARD_GAPS.month, [2]);
  const inDays = days => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days).toISOString().slice(0, 10);
  assert.deepEqual(cardSpots(planFeed(unit, [], deck, state({ permitTestDate: inDays(25) }))).slice(0, 4), [2, 4, 6, 8], 'a month out: every second lesson');
  assert.deepEqual(cardSpots(planFeed(unit, [], deck, state({ permitTestDate: inDays(5) }))).slice(0, 4), [2, 3, 4, 5], 'days out: after every lesson but the first');
});

test('a standalone simulation never comes straight after another simulation', () => {
  const withSims = unit.slice(0, 8).map((lesson, i) => ({ ...lesson, scenarioId: i < 5 ? `own${i}` : undefined }));
  const own = withSims.filter(lesson => lesson.scenarioId).map(lesson => ({ id: lesson.scenarioId, topicId: lesson.topicId, lessonId: lesson.id }));
  const plan = planFeed(withSims, [...own, { id: 'simSolo', topicId: 'ts', lessonId: null }], [], state());
  const solo = plan.findIndex(item => item.id === 'simSolo');
  assert.notEqual(plan[solo - 1].kind, 'sim', 'it follows a lesson');
  assert.equal(plan[solo - 1].id, 'u6', 'the first lesson past the fourth without its own simulation');
});

test('next lesson is always the earliest unfinished one, wherever the learner was', () => {
  const done = id => ['l1', 'l2', 'l3'].includes(id);
  assert.equal(resumeLesson(lessons, state({ done, position: { lessonId: 'l2', at: now.toISOString() } })), 'l4');
  assert.equal(resumeLesson(lessons, state({ done, position: { lessonId: 'l6', at: now.toISOString() } })), 'l4', 'visiting a later lesson does not skip ahead');
  // A lesson saved for later stays next until it is finished.
  const savedForLater = id => id !== 'l1';
  assert.equal(resumeLesson(lessons, state({ done: savedForLater, position: { lessonId: 'l8', at: now.toISOString() } })), 'l1');
  assert.equal(resumeLesson(lessons, state({ done: () => true })), null);
});

test('the feed starts where the learner left off, not at lesson 1', () => {
  const done = id => id === 'l1' || id === 'l2';
  const plan = planFeed(lessons, sims, cards, state({ done, position: { lessonId: 'l2', at: now.toISOString() } }));
  assert.equal(ids(plan)[0], 'lesson:l3');
  assert.ok(!ids(plan).includes('lesson:l1'), 'finished lessons are not replayed in order');
});

test('a returning session opens with a due refresher; a simulation can take the video’s place', () => {
  const yesterday = new Date(2026, 9, 14, 12).toISOString();
  const done = id => ['l1', 'l2', 'l3'].includes(id);
  const weak = id => id === 't2' ? { ...blank, mastery: 0.2, lastPracticedAt: yesterday } : { ...blank, mastery: 0.95, lastPracticedAt: now.toISOString() };
  const plan = planFeed(lessons, sims, cards, state({ done, topic: weak, position: { lessonId: 'l3', at: yesterday } }));
  assert.equal(ids(plan)[0], 'sim:simA', 'the weak topic has an unpracticed simulation, so it replaces the video');
  const practiced = planFeed(lessons, sims, cards, state({ done, topic: weak, safeSim: () => true, position: { lessonId: 'l3', at: yesterday } }));
  assert.deepEqual(practiced[0], { kind: 'lesson', id: 'l2', revisit: true });
  const sameDay = planFeed(lessons, sims, cards, state({ done, topic: weak, position: { lessonId: 'l3', at: now.toISOString() } }));
  assert.equal(ids(sameDay)[0], 'lesson:l4', 'no refresher within the same day');
});

test('an explicit lesson or simulation link starts there', () => {
  assert.equal(ids(planFeed(lessons, sims, cards, state(), { lessonId: 'l6' }))[0], 'lesson:l6');
  assert.equal(ids(planFeed(lessons, sims, cards, state(), { scenarioId: 'simSolo' }))[0], 'sim:simSolo');
});

test('check type: quiz for important first visits, flashcard for lower stakes; repeat visits scale with mastery', () => {
  const s = (mastery, done = true) => state({ done: () => done, topic: () => ({ ...blank, mastery }) });
  assert.equal(checkFor(lessons[0], s(null, false)), 'quiz');
  assert.equal(checkFor(lessons[2], s(null, false)), 'recall', 'safety 0.6 → flashcard');
  assert.equal(checkFor(lessons[0], s(0.4)), 'review-quiz');
  assert.equal(checkFor(lessons[0], s(0.7)), 'recall');
  assert.equal(checkFor(lessons[0], s(0.9)), 'glossary');
  assert.equal(checkFor(lessons[4], s(0.9)), 'recall', 'no glossary term → flashcard');
});

test('everything done: a short capped review session, not an endless feed', () => {
  const plan = planFeed(lessons, sims, cards, state({ done: () => true, safeSim: () => true }));
  assert.ok(plan.filter(item => item.kind === 'lesson').length <= 5);
  assert.ok(plan.every(item => item.kind !== 'lesson' || item.revisit));
});
