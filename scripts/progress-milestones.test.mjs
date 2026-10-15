import test from 'node:test';
import assert from 'node:assert/strict';
import { milestones, completionChange, MILESTONES } from '../src/progress/milestones.ts';
import { VIDEO_LESSONS } from '../src/feed/curriculum.ts';

// clips.ts can't load under plain Node; like the walkthroughs, count the 19 video lessons plus the five originals.
const LESSON_COUNT = VIDEO_LESSONS.length + 5;

test('milestones follow lesson completion thresholds, including out-of-order lessons', () => {
  for (const [count, earned] of [[0, 0], [1, 1], [4, 1], [5, 2], [11, 2], [12, 3], [23, 3], [24, 4]]) {
    const badges = milestones(count);
    assert.equal(badges.filter(badge => badge.earned).length, earned);
    assert.ok(badges.every(badge => badge.remaining >= 0));
  }
  assert.equal(completionChange(['a', 'b', 'c', 'd'], ['d', 'a', 'b', 'c', 'e']).unlocked[0].count, 5);
});

test('the final milestone is earned exactly when every lesson is complete', () => {
  assert.equal(MILESTONES.at(-1).count, LESSON_COUNT);
});

test('first visit and revisits do not announce historical XP or duplicate rewards', () => {
  assert.deepEqual(completionChange(undefined, ['a', 'b', 'c']), { added: 0, unlocked: [] });
  assert.deepEqual(completionChange(['a'], ['a']), { added: 0, unlocked: [] });
  assert.deepEqual(completionChange(['a', 'b'], []), { added: 0, unlocked: [] });
});

test('returning after several completions reports each new lesson and every crossed milestone', () => {
  const result = completionChange([], ['a', 'b', 'c', 'd', 'e']);
  assert.equal(result.added, 5);
  assert.deepEqual(result.unlocked.map(badge => badge.count), [1, 5]);
});
