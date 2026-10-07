import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../src/practice/score.ts';
import { PERMIT_BANK } from '../src/practice/questions.ts';

const question = (id, topicId, conceptId) => ({ id, topicId, conceptId, sourcePage: 1, prompt: id, choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correctChoiceId: 'a' });

test('every bank question has a unique id, a valid key, a labeled topic, and described artwork', () => {
  const ids = new Set(PERMIT_BANK.questions.map(q => q.id));
  assert.equal(ids.size, PERMIT_BANK.questions.length);
  assert.equal(PERMIT_BANK.questions.length, 46);
  for (const q of PERMIT_BANK.questions) {
    assert.ok(q.choices.some(c => c.id === q.correctChoiceId), `${q.id} key matches a choice`);
    assert.equal(new Set(q.choices.map(c => c.id)).size, q.choices.length, `${q.id} choice ids are unique`);
    assert.ok(PERMIT_BANK.topics[q.topicId], `${q.id} topic has a label`);
    if (q.image) assert.ok(q.image.src.startsWith('/images/signs/') && q.image.alt, `${q.id} image is local and described`);
  }
});

test('the target uses the raw fraction, not the rounded percentage', () => {
  const questions = Array.from({ length: 250 }, (_, i) => question(`q${i}`, 't', `c${i}`));
  const bank = { title: 'T', target: 0.8, topics: {}, questions };
  const result = summarize(bank, questions.map((_, i) => i < 199));
  assert.equal(result.percentage, 80);
  assert.equal(result.meetsTarget, false);
  assert.equal(summarize(bank, questions.map((_, i) => i < 200)).meetsTarget, true);
});

test('repeated questions on one concept do not dominate a topic', () => {
  const questions = [question('1', 'signs', 'a'), question('2', 'signs', 'a'), question('3', 'signs', 'b'), question('4', 'signs', 'c')];
  const result = summarize({ title: 'T', target: 0.8, topics: { signs: 'Signs' }, questions }, [true, true, false, false]);
  assert.equal(result.correct, 2);
  assert.equal(result.topics[0].accuracy, 1 / 3);
  assert.equal(result.topics[0].status, 'review');
  assert.equal(result.topics[0].label, 'Signs');
});

test('topics with fewer than three concepts are marked as needing more evidence', () => {
  const questions = [question('1', 'parking', 'a'), question('2', 'parking', 'b'), question('3', 'safe', 'a'), question('4', 'safe', 'b'), question('5', 'safe', 'c')];
  const result = summarize({ title: 'T', target: 0.8, topics: {}, questions }, [false, false, true, true, true]);
  assert.deepEqual(result.topics.map(t => [t.id, t.status]), [['parking', 'limited'], ['safe', 'on-track']]);
});
