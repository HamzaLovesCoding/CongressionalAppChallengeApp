import test from 'node:test';
import assert from 'node:assert/strict';
import { CLIPS } from '../src/feed/clips.ts';
import { LEARNING } from '../src/content/learning.ts';

test('every feed lesson has learning data and no orphan entries exist', () => {
  assert.deepEqual(Object.keys(LEARNING).sort(), CLIPS.map(clip => clip.id).sort());
});

test('similar and harder checks are drafts with a source, valid answers, and differ from the lesson check', () => {
  for (const clip of CLIPS) {
    const learning = LEARNING[clip.id];
    assert.ok(learning.safety >= 0.5 && learning.safety <= 1, `${clip.id} safety`);
    for (const kind of ['similar', 'harder']) {
      const q = learning[kind];
      assert.equal(q.draft, true, `${clip.id} ${kind} is a draft`);
      assert.match(q.source, /Handbook/, `${clip.id} ${kind} cites the handbook`);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, `${clip.id} ${kind} answer index`);
      assert.notEqual(q.question, clip.question, `${clip.id} ${kind} is not the same question`);
      assert.equal(new Set(q.options).size, q.options.length, `${clip.id} ${kind} has distinct options`);
    }
    if (learning.activity) {
      assert.equal(learning.activity.draft, true);
      assert.ok(learning.activity.choices.some(choice => choice.safe), `${clip.id} activity has a safe choice`);
      assert.ok(learning.activity.choices.some(choice => !choice.safe), `${clip.id} activity has an unsafe choice`);
    }
  }
});
