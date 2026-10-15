// Geometry for the Progress road. Pure (no DOM) so it can be tested with node --test.
// Units are CSS px inside the road map; y grows downward and the trip runs bottom → top.

export type Knot = { x: number; y: number };

// Small, irregular nudges keep the road gently bending instead of zig-zagging between sides.
// They stay within ±8px so the road never reaches the column of signs beside it.
const BENDS = [0, 8, -5, 6, -8, 3];
export const HALF_ROAD = 33;
// The right-hand lane's center, between the yellow center line and the edge line; Lane drives on the right like California.
export const LANE = 15;
// The selected car is drawn larger than the Garage's base scale so it reads as the page's hero.
export const CAR_SCALE = 1.18;
// The car waits just before the next checkpoint line, nose clear of it.
export const CAR_GAP = 38;
const PARKED_GAP = 50;
// A straight run under every stop line, long enough for the waiting car, so it sits square to the line.
export const APPROACH = CAR_GAP + 28;
// Rows can be short, so a bend may shift the road at most this many px per px of travel (about 11°).
const MAX_SHIFT = .13;

/**
 * Knots run from the bottom edge, through each checkpoint (first lesson lowest), to the top edge.
 * Each stop has a knot at its line and one at the end of its straight approach; the road bends only
 * between a stop and the next approach, and runs straight from the last stop to the top.
 */
export function roadKnots(stops: number[], base: number, height: number): Knot[] {
  const knots: Knot[] = [{ x: base + BENDS[0], y: height + 24 }];
  stops.forEach((y, index) => {
    const previous = knots[knots.length - 1];
    const approach = y + APPROACH < previous.y - 8 ? y + APPROACH : undefined;
    const shift = MAX_SHIFT * (previous.y - (approach ?? y));
    const x = previous.x + Math.max(-shift, Math.min(shift, base + BENDS[index % BENDS.length] - previous.x));
    if (approach !== undefined) knots.push({ x, y: approach });
    knots.push({ x, y });
  });
  knots.push({ x: knots[knots.length - 1].x, y: -24 });
  return knots;
}

// Controls a third of the way along y make y linear in t and x a smoothstep, so the road is
// vertical at every knot (the car sits straight at each stop) and readable without measuring the SVG.
function segment(knots: Knot[], y: number) {
  let index = knots.findIndex((knot, i) => i > 0 && knot.y <= y);
  if (index < 0) index = knots.length - 1;
  const a = knots[Math.max(index, 1) - 1], b = knots[Math.max(index, 1)];
  const u = Math.min(1, Math.max(0, (a.y - y) / (a.y - b.y)));
  return { a, b, u };
}

/** Point on the road (or a lane, via offset) at height y, with the heading in degrees clockwise from straight up. */
export function roadAt(knots: Knot[], y: number, offset = 0) {
  const { a, b, u } = segment(knots, y);
  const x = a.x + (b.x - a.x) * (3 * u * u - 2 * u * u * u) + offset;
  const slope = (b.x - a.x) * (6 * u - 6 * u * u) / (a.y - b.y);
  return { x, y: a.y + (b.y - a.y) * u, angle: Math.atan(slope) * 180 / Math.PI };
}

const point = (x: number, y: number) => `${+x.toFixed(2)} ${+y.toFixed(2)}`;

/** SVG path along the road, optionally stopping at height `until` (used for the distance-driven trail). */
export function roadPath(knots: Knot[], offset = 0, until = -Infinity) {
  let d = `M${point(knots[0].x + offset, knots[0].y)}`;
  for (let i = 1; i < knots.length; i++) {
    const a = knots[i - 1], b = knots[i], third = (a.y - b.y) / 3;
    const p = [[a.x, a.y], [a.x, a.y - third], [b.x, b.y + third], [b.x, b.y]];
    if (b.y < until) {
      if (a.y <= until) break;
      // de Casteljau split keeps the partial bend on exactly the same curve.
      const t = (a.y - until) / (a.y - b.y), mix = (m: number[], n: number[]) => [m[0] + (n[0] - m[0]) * t, m[1] + (n[1] - m[1]) * t];
      const p01 = mix(p[0], p[1]), p12 = mix(p[1], p[2]), p23 = mix(p[2], p[3]), p012 = mix(p01, p12), end = mix(p012, mix(p12, p23));
      return `${d}C${point(p01[0] + offset, p01[1])} ${point(p012[0] + offset, p012[1])} ${point(end[0] + offset, end[1])}`;
    }
    d += `C${point(p[1][0] + offset, p[1][1])} ${point(p[2][0] + offset, p[2][1])} ${point(b.x + offset, b.y)}`;
  }
  return d;
}

/**
 * Where the car rests for a road position: 0…n-1 waits at that lesson's checkpoint, n parks past
 * the last one (beside `park` when the page gives a finish sign to park at). Fractions fall between,
 * which is how the drive animation moves along the road.
 */
export function carY(stops: number[], position: number, park?: number) {
  const rest = (index: number) => index < stops.length ? stops[index] + CAR_GAP : park ?? stops[stops.length - 1] - PARKED_GAP;
  const low = Math.floor(position), high = Math.ceil(position);
  return rest(low) + (rest(high) - rest(low)) * (position - low);
}
