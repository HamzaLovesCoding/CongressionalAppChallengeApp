import test from 'node:test';
import assert from 'node:assert/strict';
import { SETTLE, THROWN, nearest, project, rubberband, springStep, atRest, velocityOf } from '../src/home/spring.ts';

const run = (config, from = { value: 0, velocity: 0 }, target = 100, seconds = 2) => {
  let state = from, peak = -Infinity, settledAt = null;
  for (let t = 0; t < seconds; t += 1 / 60) {
    state = springStep(state, target, config, 1 / 60);
    peak = Math.max(peak, state.value);
    if (settledAt === null && atRest(state, target)) settledAt = t;
  }
  return { state, peak, settledAt };
};

test('a critically damped spring reaches its target without overshooting', () => {
  const { state, peak, settledAt } = run(SETTLE);
  assert.ok(Math.abs(state.value - 100) < 0.5);
  assert.ok(peak <= 100.5, `peak ${peak}`);
  assert.ok(settledAt !== null && settledAt < 1, 'settles well inside a second');
});

test('the thrown spring overshoots a little, then settles', () => {
  const { state, peak } = run(THROWN);
  assert.ok(peak > 100.5 && peak < 115, `peak ${peak}`);
  assert.ok(Math.abs(state.value - 100) < 0.5);
});

test('velocity carries into the spring instead of restarting from rest', () => {
  const still = springStep({ value: 0, velocity: 0 }, 100, SETTLE, 1 / 60);
  const moving = springStep({ value: 0, velocity: 2000 }, 100, SETTLE, 1 / 60);
  assert.ok(moving.value > still.value);
  // Large frame gaps (a backgrounded tab) stay stable rather than exploding.
  const gap = springStep({ value: 0, velocity: 0 }, 100, SETTLE, 5);
  assert.ok(Number.isFinite(gap.value) && Math.abs(gap.value) < 200);
});

test('projection, rubber-banding, snapping and velocity follow the documented formulas', () => {
  assert.equal(project(0), 0);
  assert.ok(Math.abs(project(1000) - 499) < 1, 'a 1000px/s throw travels about 499px at the scroll rate');
  assert.ok(project(-500) < 0);
  const small = rubberband(10, 400), large = rubberband(400, 400);
  assert.ok(small > 0 && small < 10, 'past the edge the element follows less than the finger');
  assert.ok(large < 400 / 2 && rubberband(1e6, 400) < 400, 'and approaches the dimension without passing it');
  assert.equal(rubberband(-10, 400), -small);
  assert.equal(nearest([0, 260, 520], 300), 260);
  assert.equal(nearest([0, 260, 520], 9999), 520);
  assert.equal(velocityOf([{ t: 0, v: 0 }, { t: 50, v: 25 }, { t: 100, v: 50 }]), 500);
  assert.equal(velocityOf([{ t: 0, v: 0 }, { t: 400, v: 50 }]), 0, 'a pause before release reads as still');
});
