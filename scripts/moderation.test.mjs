import test from 'node:test';
import assert from 'node:assert/strict';
import { isClean } from '../src/feed/moderation.ts';

test('ordinary driving comments are posted', () => {
  for (const text of [
    'Great reminder about the three-second rule.',
    'I always forget to check my blind spot on the right.',
    'Lesson 1 was really helpful, thanks!',
    'Took a bit chilly on the freeway today',
    'My class passed the assessment at Dickinson High.',
    'Niger and Nigeria are countries.',
    'Scunthorpe and the document count are fine',
    'Pass the cocktail of rules, I will assist.',
  ]) assert.equal(isClean(text), true, text);
});

test('profanity and slurs are blocked, including simple disguises', () => {
  for (const text of [
    'this is shit',
    'what the fuck',
    'F U C K this',
    'fuuuuck',
    'sh!t driver',
    'you are a b1tch',
    'SHIT!',
    'total a$$hole',
    'cunt',
    'you cunt',
    'n i g g a',
    'what a retard',
    'f4ggot',
  ]) assert.equal(isClean(text), false, text);
});
