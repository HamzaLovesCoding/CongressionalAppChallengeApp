import test from 'node:test';
import assert from 'node:assert/strict';
import { CLIPS } from '../src/feed/clips.ts';
import { VIDEO_LESSONS } from '../src/feed/curriculum.ts';
import { topicOf } from '../src/content/learning.ts';
import { SCENARIOS } from '../src/simulation/registry.ts';

// Stable IDs are what progress, XP, videos, posters and quizzes key on, so they never change. The
// feed order is set on purpose in clips.ts (FEED_ORDER, owner 2026-10-22) and pinned here so it only
// moves deliberately.
const FEED_ORDER = [
  'freeway-entry', 'emergency-pull-right', 'passing-bicyclist', 'intersection-right-of-way', 'lane-end-scan', 'blind-spot-check',
  'after-collision', 'stopping-distance', 'yellow-light', 'high-beams', 'front-curb', 'drive-test-readiness', 'emergency-kit', 'blind-curve',
  'dark-signal', 'freeway-merge', 'roundabout', 'emergency-right-edge', 'three-second-check', 'merging-trailer', 'four-way-stop',
  'blind-bend', 'following-distance', 'school-bus',
];
const STABLE_IDS = [
  'lane-end-scan', 'after-collision', 'emergency-kit', 'front-curb', 'dark-signal', 'emergency-pull-right',
  'emergency-right-edge', 'intersection-right-of-way', 'high-beams', 'passing-bicyclist', 'freeway-entry',
  'freeway-merge', 'drive-test-readiness', 'blind-spot-check', 'blind-curve', 'blind-bend', 'merging-trailer',
  'stopping-distance', 'three-second-check', 'yellow-light', 'roundabout', 'four-way-stop', 'following-distance',
  'school-bus',
];
const hasSim = id => SCENARIOS.some(entry => entry.lessonId === id);

test('the 24 feed lessons keep their stable IDs, each once, in the chosen order', () => {
  assert.deepEqual(CLIPS.map(clip => clip.id), FEED_ORDER);
  assert.deepEqual([...CLIPS.map(clip => clip.id)].sort(), [...STABLE_IDS].sort(), 'no lesson added, dropped or renamed');
});

test('the feed opens with video lessons that have a simulation, each on a different topic', () => {
  const opening = CLIPS.slice(0, 6);
  for (const clip of opening) assert.ok(clip.video && hasSim(clip.id), `${clip.id} is a video with a simulation`);
  assert.equal(new Set(opening.map(clip => topicOf(clip.id))).size, opening.length, 'six different topics');
  assert.ok(SCENARIOS.filter(entry => entry.type === '3d' && opening.some(clip => clip.id === entry.lessonId)).length >= 2, 'at least two 3D simulations up front');
  assert.ok(VIDEO_LESSONS.filter(clip => hasSim(clip.id)).every(clip => opening.includes(clip)), 'every video with a simulation is in the opening');
});

test('every topic gets its first lesson before any topic repeats', () => {
  const topics = CLIPS.map(clip => topicOf(clip.id));
  const firstRepeat = topics.findIndex((topic, index) => topics.indexOf(topic) < index);
  assert.equal(firstRepeat, new Set(topics).size, 'the first repeat comes right after one lesson per topic');
  for (let i = 1; i < topics.length; i++) assert.notEqual(topics[i], topics[i - 1], `${CLIPS[i].id} doesn't repeat the topic right before it`);
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
