import test from 'node:test';
import assert from 'node:assert/strict';
import { planFeed, resumeLesson, checkFor, STANDALONE_SIM_AFTER } from '../src/learning/planner.ts';

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
