import test from 'node:test';
import assert from 'node:assert/strict';
import { CLIPS } from '../src/feed/clips.ts';

// Display titles changed on 2026-10-15. Stable IDs are what
// progress, videos, posters and quizzes key on, so they and the feed order must never move.
const STABLE_ORDER = [
  'lane-end-scan', 'after-collision', 'emergency-kit', 'front-curb', 'dark-signal', 'emergency-pull-right',
  'emergency-right-edge', 'intersection-right-of-way', 'high-beams', 'passing-bicyclist', 'freeway-entry',
  'freeway-merge', 'drive-test-readiness', 'blind-spot-check', 'blind-curve', 'blind-bend', 'merging-trailer',
  'stopping-distance', 'three-second-check', 'yellow-light', 'roundabout', 'four-way-stop', 'following-distance',
  'school-bus',
];

test('the 24 feed lessons keep their stable IDs and order', () => {
  assert.deepEqual(CLIPS.map(clip => clip.id), STABLE_ORDER);
});

test('lesson titles do not repeat the state name; the California rule stays attached', () => {
  for (const clip of CLIPS) {
    assert.doesNotMatch(clip.title, /California/, `${clip.id} title`);
    if (clip.video) assert.ok(clip.lesson?.californiaRule.length > 40, `${clip.id} keeps its California rule`);
  }
});

test('display copy uses US driving terms', () => {
  for (const clip of CLIPS) {
    const copy = JSON.stringify(clip);
    assert.doesNotMatch(copy, /give way|kerb/i, `${clip.id} uses US wording`);
  }
});
