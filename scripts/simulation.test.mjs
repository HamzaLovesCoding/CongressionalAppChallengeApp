import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { outcomeOf, scenarioCallbacks } from '../src/simulation/outcome.ts';
import { CLIPS } from '../src/feed/clips.ts';

// registry.ts holds dynamic imports of the vendored packages, which Node cannot run, so its data is
// read as text and compared with each package's manifest.
const registry = readFileSync(new URL('../src/simulation/registry.ts', import.meta.url), 'utf8');
const vendor = new URL('../vendor/lane-simulations/', import.meta.url);
const packages = readdirSync(vendor).filter(name => existsSync(new URL(`${name}/scenario-manifest.json`, vendor)));
const field = (id, name) => registry.match(new RegExp(`id: '${id}'[\\s\\S]*?${name}: ('[^']*'|null)`))?.[1];

test('all ten V4 packages are vendored with their runtime files', () => {
  assert.equal(packages.length, 10);
  for (const id of packages) for (const file of ['src/index.ts', 'src/scene.ts', 'src/config.json', 'src/styles.css', 'thumbnail.png', 'tokens.css', 'README.md']) {
    assert.ok(existsSync(new URL(`${id}/${file}`, vendor)), `${id}/${file}`);
  }
});

test('the registry mirrors every manifest and keeps the review status visible', () => {
  for (const id of packages) {
    const manifest = JSON.parse(readFileSync(new URL(`${id}/scenario-manifest.json`, vendor), 'utf8'));
    assert.equal(field(id, 'title'), `'${manifest.title}'`, `${id} title`);
    assert.equal(field(id, 'topicId'), `'${manifest.topicId}'`, `${id} topic`);
    assert.equal(field(id, 'type'), `'${manifest.type}'`, `${id} type`);
    assert.equal(field(id, 'fallback'), `'${manifest.fallback.message}'`, `${id} fallback`);
    assert.equal(manifest.contentStatus, 'draft-needs-human-handbook-review', `${id} stays a draft`);
    assert.match(registry, new RegExp(`import\\('../../vendor/lane-simulations/${id}/src/index.ts'\\)`), `${id} is lazy-loaded`);
  }
});

test('each lesson-linked scenario points at a real lesson, and each lesson has at most one', () => {
  const lessons = packages.map(id => field(id, 'lessonId')).filter(value => value !== 'null').map(value => value.slice(1, -1));
  for (const lessonId of lessons) assert.ok(CLIPS.some(clip => clip.id === lessonId), lessonId);
  assert.equal(new Set(lessons).size, lessons.length);
});

test('outcome comes from success, not the callback name', () => {
  const base = { scenarioId: 'four-way-stop', topicId: 't', elapsedSeconds: 5 };
  assert.equal(outcomeOf({ ...base, success: true, chosenAction: 'yield-right' }), 'safe');
  assert.equal(outcomeOf({ ...base, success: false, chosenAction: 'go-first' }), 'unsafe');
  assert.equal(outcomeOf({ ...base, success: false, chosenAction: 'timeout' }), 'timeout');
});

test('callbacks record each attempt once, continue adds nothing, exit records once', () => {
  const records = [], events = [];
  const callbacks = scenarioCallbacks({ id: 'four-way-stop', topicId: 't' }, record => records.push(record), { continued: () => events.push('continued'), exited: () => events.push('exited') });
  const result = { scenarioId: 'four-way-stop', topicId: 't', elapsedSeconds: 5 };
  callbacks.onComplete({ ...result, success: false, chosenAction: 'go-first' });
  callbacks.onRetry();
  callbacks.onComplete({ ...result, success: true, chosenAction: 'yield-right' });
  callbacks.onContinue({ ...result, success: true, chosenAction: 'yield-right' });
  callbacks.leave();
  assert.deepEqual(records.map(record => record.outcome), ['unsafe', 'retry', 'safe'], 'leaving after Continue records no exit');
  assert.deepEqual(events, ['continued']);

  const exits = [];
  const other = scenarioCallbacks({ id: 'x', topicId: 't' }, record => exits.push(record.outcome), { continued() {}, exited() {} });
  other.onExit(); other.leave(); other.onExit();
  assert.deepEqual(exits, ['exit'], 'package Exit and host Back together record one exit');
});
