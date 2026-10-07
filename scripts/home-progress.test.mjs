import test from 'node:test';
import assert from 'node:assert/strict';
import { lessonProgress } from '../src/home/model.ts';

const lessons = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
test('home starts with the first lesson and resumes the first unfinished one', () => {
  assert.deepEqual(lessonProgress(lessons, () => undefined), { completed: 0, next: lessons[0], total: 3, allDone: false, percentage: 0 });
  const records = { a: { done: true }, b: { done: false }, c: { done: true }, removed: { done: true } };
  const state = lessonProgress(lessons, id => records[id]);
  assert.equal(state.next.id, 'b');
  assert.equal(state.completed, 2);
  assert.equal(state.percentage, 67);
  assert.equal(state.allDone, false);
});
test('completed and empty catalogs have bounded progress', () => {
  assert.equal(lessonProgress(lessons, () => ({ done: true })).percentage, 100);
  assert.equal(lessonProgress(lessons, () => ({ done: true })).allDone, true);
  assert.deepEqual(lessonProgress([], () => undefined), { completed: 0, next: undefined, total: 0, allDone: false, percentage: 0 });
});

test('goal changes preserve legacy learning records and reject unsupported values', async () => {
  const legacy = { xp: 20, clips: { a: { done: true, tries: 1, firstTry: true } }, daily: {}, saved: ['a'], liked: ['b'] };
  let stored = JSON.stringify(legacy);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => stored, setItem: (_key, value) => { stored = value; } } });
  const progress = await import('../src/feed/progress.ts?legacy-goal');
  assert.equal(progress.dailyGoal(), 50);
  for (const invalid of [0, -1, 20, 100, NaN, Infinity]) assert.equal(progress.setDailyGoal(invalid), false);
  assert.deepEqual(JSON.parse(stored), legacy);
  assert.equal(progress.setDailyGoal(30), true);
  assert.deepEqual(JSON.parse(stored), { ...legacy, dailyGoal: 30 });
  const reloaded = await import('../src/feed/progress.ts?reloaded-goal');
  assert.equal(reloaded.dailyGoal(), 30);
  reloaded.answer('a', true);
  assert.equal(reloaded.stats().xpTotal, 20, 'Reviewing a completed lesson does not award XP');
  reloaded.answer('new', true, false);
  assert.equal(reloaded.stats().xpTotal, 20, 'An unfinished check does not award XP');
  reloaded.answer('new', true);
  assert.equal(reloaded.stats().xpTotal, 30);
  assert.equal(reloaded.stats().xpToday, 10);
  assert.equal(reloaded.stats().streak, 1);
  assert.equal(reloaded.dailyGoal(), 30);
  reloaded.toggleMark('saved', 'a');
  assert.deepEqual(JSON.parse(stored).saved, []);
  assert.deepEqual(JSON.parse(stored).liked, ['b']);
});

test('a bad stored goal falls back and unavailable storage still allows session goals', async () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => '{"dailyGoal":-20}', setItem: () => { throw new Error('disabled'); } } });
  const progress = await import('../src/feed/progress.ts?invalid-goal');
  assert.equal(progress.dailyGoal(), 50);
  assert.equal(progress.setDailyGoal(10), true);
  assert.equal(progress.dailyGoal(), 10);
});
