import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { CLIPS } from '../src/feed/clips.ts';
import { VIDEO_LESSONS } from '../src/feed/curriculum.ts';
import { LEARNING } from '../src/content/learning.ts';
import { CONTENT_CARDS, GLOSSARY } from '../src/content/cards.ts';
import { SCENARIOS } from '../src/simulation/registry.ts';

// Checks from the owner's question-quality rules (Agreed Features §5) and the 2026-10-15 video review.

// Clip lengths in seconds, measured from the encoded files on 2026-10-15 (ffmpeg-static).
const DURATIONS = { 'lane-end-scan': 32.5, 'after-collision': 33.8, 'emergency-kit': 14.7, 'front-curb': 16.7, 'dark-signal': 16.4, 'emergency-pull-right': 19.2, 'emergency-right-edge': 29.5, 'intersection-right-of-way': 24.1, 'high-beams': 35.1, 'passing-bicyclist': 27.5, 'freeway-entry': 33.8, 'freeway-merge': 36.1, 'drive-test-readiness': 37.7, 'blind-spot-check': 24.6, 'blind-curve': 33.7, 'blind-bend': 25.0, 'merging-trailer': 35.1, 'stopping-distance': 11.1, 'three-second-check': 25.0 };

test('every video lesson has a key segment inside its clip', () => {
  for (const clip of VIDEO_LESSONS) {
    const segment = LEARNING[clip.id].keySegment;
    assert.ok(segment && segment.start >= 0 && segment.end > segment.start, clip.id);
    assert.ok(segment.end <= DURATIONS[clip.id] + 0.1, `${clip.id} ends at ${segment.end}s, clip is ${DURATIONS[clip.id]}s`);
    const file = `public/${clip.video}`;
    assert.ok(existsSync(file), file);
  }
});

test('every lesson has a flashcard, and every glossary link resolves', () => {
  for (const clip of CLIPS) {
    const learning = LEARNING[clip.id];
    assert.ok(learning.recall?.front && learning.recall.back && learning.recall.draft === true && /p\. ?\d|pp\. ?\d/.test(learning.recall.source), clip.id);
    if (learning.glossary) assert.ok(GLOSSARY.some(card => card.id === learning.glossary), `${clip.id} → ${learning.glossary}`);
  }
});

test('the correct answer is not given away by being much longer than the others', () => {
  for (const clip of CLIPS) {
    const lengths = clip.options.map(option => option.length);
    const others = lengths.filter((_, i) => i !== clip.answer);
    assert.ok(lengths[clip.answer] <= Math.max(...others) * 1.35, `${clip.id}: ${lengths}`);
  }
});

test('correct answers are spread across positions', () => {
  const positions = new Set(VIDEO_LESSONS.map(clip => clip.answer));
  assert.ok(positions.size >= 4, [...positions].join(','));
});

test('every check cites a handbook page and stays a draft', () => {
  for (const clip of VIDEO_LESSONS) {
    assert.equal(clip.draft, true, clip.id);
    assert.match(clip.source, /p\. ?\d|pp\. ?\d/, clip.id);
  }
  for (const card of CONTENT_CARDS) assert.equal(card.draft, true, card.id);
});

test('all ten simulations are reachable in the feed', () => {
  const lessonIds = new Set(CLIPS.map(clip => clip.id));
  for (const scenario of SCENARIOS) assert.ok(scenario.lessonId === null || lessonIds.has(scenario.lessonId), scenario.id);
  assert.equal(SCENARIOS.length, 10);
  assert.ok(SCENARIOS.every(scenario => scenario.rule.length > 10));
});


test('lessons without video are fill-in-the-blank posts with handbook citations', () => {
  for (const clip of CLIPS.filter(entry => !entry.video)) {
    assert.ok(clip.post && clip.post.steps.length >= 3, `${clip.id} has a text post`);
    assert.equal(clip.post.draft, true);
    assert.match(clip.post.source, /p\. ?\d|pp\. ?\d/, clip.id);
    for (const step of clip.post.steps) {
      assert.ok(step.answer >= 0 && step.answer < step.choices.length && step.choices.length >= 3, `${clip.id}: ${step.before}`);
      assert.ok(step.why.length > 10, `${clip.id} explains each blank`);
      const lengths = step.choices.map(choice => choice.length), others = lengths.filter((_, i) => i !== step.answer);
      assert.ok(lengths[step.answer] <= Math.max(...others) * 1.6 + 4, `${clip.id}: the right word isn't the giveaway long one (${step.choices})`);
    }
  }
});

test('follow-up questions and decision activities do not give the answer away by length', () => {
  for (const [id, learning] of Object.entries(LEARNING)) {
    for (const kind of ['similar', 'harder']) {
      const q = learning[kind], lengths = q.options.map(option => option.length), others = lengths.filter((_, i) => i !== q.answer);
      assert.ok(lengths[q.answer] <= Math.max(...others) * 1.35, `${id} ${kind}: ${q.options}`);
    }
    if (!learning.activity) continue;
    const safe = learning.activity.choices.filter(choice => choice.safe).map(choice => choice.label.length);
    const unsafe = learning.activity.choices.filter(choice => !choice.safe).map(choice => choice.label.length);
    assert.ok(Math.max(...safe) <= Math.max(...unsafe) * 1.35, `${id} activity`);
  }
});

test('practice test questions do not give the answer away by length', async () => {
  const module = await import('../src/practice/questions.ts');
  const bank = Object.values(module).find(value => value && Array.isArray(value.questions));
  for (const q of bank.questions) {
    const correct = q.choices.find(choice => choice.id === q.correctChoiceId);
    const others = q.choices.filter(choice => choice !== correct).map(choice => choice.text.length);
    assert.ok(correct.text.length <= Math.max(...others) * 1.35, `${q.id}: ${q.choices.map(choice => choice.text)}`);
  }
});
