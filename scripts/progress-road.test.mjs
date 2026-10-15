import test from 'node:test';
import assert from 'node:assert/strict';
import { APPROACH, CAR_GAP, carY, roadAt, roadKnots, roadPath } from '../src/progress/road.ts';

const stops = [900, 700, 500];
const knots = roadKnots(stops, 116, 1000);

test('the road runs from the bottom edge, through every checkpoint, to the top edge', () => {
  assert.ok(knots[0].y > 1000 && knots.at(-1).y < 0);
  assert.ok(stops.every(stop => knots.some(knot => knot.y === stop)), 'every stop line is a knot');
  assert.ok(knots.every((knot, i) => i === 0 || knot.y < knots[i - 1].y), 'the trip only heads upward');
  // The signs stand just right of the road, so bends must stay within 8px of the base line.
  assert.ok(knots.every(knot => Math.abs(knot.x - 116) <= 8), 'bends stay gentle and clear of the signs');
});

test('the waiting car sits square to its stop line, and bends stay gentle between stops', () => {
  for (let index = 0; index < stops.length; index++) {
    for (const y of [stops[index], carY(stops, index), stops[index] + APPROACH - 1]) {
      assert.equal(roadAt(knots, y).angle, 0, `straight at ${y} for stop ${index + 1}`);
    }
  }
  const middle = roadAt(knots, 800 - APPROACH / 2);
  assert.ok(middle.x !== roadAt(knots, 900).x || middle.x !== roadAt(knots, 700).x, 'the road still bends between stops');
  for (let y = 1000; y > 0; y -= 5) assert.ok(Math.abs(roadAt(knots, y).angle) < 12, `no sharp bend at ${y}`);
  assert.equal(roadAt(knots, 800, 14).x, roadAt(knots, 800).x + 14, 'lanes are offset from the center line');
  assert.equal(roadAt(knots, 5000).x, knots[0].x, 'positions beyond the ends clamp to the road');
});

test('stops packed closer than the approach still give a continuous, upward road', () => {
  const tight = roadKnots([300, 260, 220], 60, 400);
  assert.ok(tight.every((knot, i) => i === 0 || knot.y < tight[i - 1].y));
  for (let y = 400; y > 0; y -= 2) assert.ok(Number.isFinite(roadAt(tight, y).x) && Math.abs(roadAt(tight, y).angle) < 12);
});

test('the car waits before the next checkpoint and parks past the last one', () => {
  assert.equal(carY(stops, 0), 900 + CAR_GAP);
  assert.equal(carY(stops, 2), 500 + CAR_GAP);
  assert.ok(carY(stops, 3) < 500, 'all complete parks beyond the final line');
  assert.equal(carY(stops, 3, 260), 260, 'with a finish sign it parks beside that sign');
  assert.equal(roadAt(knots, 260).angle, 0, 'the road runs straight past the last stop');
  assert.equal(carY(stops, 0.5), (carY(stops, 0) + carY(stops, 1)) / 2);
});

test('a trail can stop partway along a bend on the same curve', () => {
  const segments = knots.length - 1;
  assert.match(roadPath(knots), new RegExp(`^M[\\d.]+ 1024(C[-\\d. ]+){${segments}}$`));
  const until = 800 - APPROACH / 2;
  const partial = roadPath(knots, 14, until);
  assert.equal(partial.split('C').length - 1, knots.filter(knot => knot.y > until).length, 'every full segment below, plus the split one');
  const end = partial.trim().split(' ').slice(-2).map(Number);
  assert.ok(Math.abs(end[0] - roadAt(knots, until, 14).x) < .01 && Math.abs(end[1] - until) < .01);
  assert.equal(roadPath(knots, 0, 2000), `M${knots[0].x} 1024`, 'a trail that has not started is just its start point');
});
