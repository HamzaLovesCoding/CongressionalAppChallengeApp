import test from 'node:test';
import assert from 'node:assert/strict';
import { createScrollTimer } from '../src/feed/scrollTimer.ts';

test('visible time accumulates across clips and pauses without counting hidden time', () => {
  const timer = createScrollTimer(100);
  assert.equal(timer.tick(850, true), 0);
  assert.equal(timer.tick(1700, true), 1);
  timer.tick(1800, false);
  assert.equal(timer.tick(61800, false), 1);
  assert.equal(timer.tick(63300, true), 3);
});

test('a new feed visit starts fresh and delayed ticks count actual elapsed time', () => {
  const first = createScrollTimer(0);
  assert.equal(first.tick(65000, true), 65);
  const next = createScrollTimer(65000);
  assert.equal(next.tick(65000, true), 0);
  assert.equal(next.tick(66100, true), 1);
});
