import { HALF_ROAD, LANE, roadAt, roadPath, type Knot } from './road';

// Unit 1 is a quiet neighborhood street: a tree-lined verge on the left, the signs standing on the
// right. Later units get their own verge (downtown, freeway, rural) when their lessons exist; the
// road, checkpoints and work zone stay shared.
export type RoadScene = {
  width: number;
  height: number;
  knots: Knot[];
  stops: number[];
  /** Index of the next lesson's checkpoint, painted ochre; -1 once every lesson is complete. */
  next: number;
  start: number;
  barricade: number;
};

const SIDEWALK = 7;
const VERGE = 28;
const n = (value: number) => +value.toFixed(1);

const tree = (x: number, y: number, r: number) =>
  `<g class="road-tree"><circle cx="${n(x + 2)}" cy="${n(y + 3)}" r="${n(r)}" class="road-tree-shade"/><circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}"/><circle class="road-tree-light" cx="${n(x - r * .3)}" cy="${n(y - r * .3)}" r="${n(r * .48)}"/></g>`;

// The verge: a grass strip along both sides of the road (the signs stand on its right edge), with a
// regular rhythm of trees on the left. It runs past the work zone, where the planned road continues.
function verge(scene: RoadScene) {
  let trees = '';
  for (let y = scene.height - 64, index = 0; y > 16; y -= 78, index++) {
    // Trees shrink to the strip between the map's edge and the sidewalk, so none is cut in half.
    const curb = roadAt(scene.knots, y).x - HALF_ROAD - SIDEWALK, r = Math.min(index % 3 === 1 ? 8 : 11, (curb - 8) / 2);
    if (r >= 6) trees += tree(curb - r - 5, y + (index % 2 ? 6 : -6), r);
  }
  return `<path class="road-verge" d="${roadPath(scene.knots)}" stroke-width="${2 * (HALF_ROAD + SIDEWALK + VERGE)}"/>${trees}`;
}

// Past the last lesson: a taper of cones, a barricade across both lanes, then only planned road.
function workZone(scene: RoadScene) {
  const at = roadAt(scene.knots, scene.barricade);
  const cones = [16, 34, 52].flatMap((distance, i) => {
    const point = roadAt(scene.knots, scene.barricade + distance), inset = HALF_ROAD - 8 - (2 - i) * 4;
    return [point.x - inset, point.x + inset].map(x => `<g class="road-cone"><circle cx="${n(x)}" cy="${n(point.y)}" r="5.5"/><circle cx="${n(x)}" cy="${n(point.y)}" r="2"/></g>`);
  }).join('');
  return `${cones}<g class="road-barricade"><rect x="${n(at.x - HALF_ROAD - 6)}" y="${n(at.y - 6)}" width="${2 * HALF_ROAD + 12}" height="12" rx="3" fill="url(#road-work-stripes)"/></g>`;
}

export function roadScene(scene: RoadScene) {
  const { width, height, knots, stops, next, start, barricade } = scene;
  const road = roadPath(knots), edge = (side: number) => roadPath(knots, side * (HALF_ROAD - 5));
  // A real stop line spans only the driver's own lane: from the centre line to the right edge.
  const stopLine = (y: number, index: number) => { const at = roadAt(knots, y); return `<path class="road-checkpoint${index === next ? ' is-next' : ''}" d="M${n(at.x + 3)} ${n(y)}H${n(at.x + HALF_ROAD - 5)}"/>`; };
  const startAt = roadAt(knots, start);
  return `<svg class="path-road-map" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">
    <defs>
      <pattern id="road-work-stripes" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" class="road-stripe-light"/><rect width="5" height="10" class="road-stripe"/></pattern>
      <pattern id="road-start-check" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" class="road-check-light"/><rect width="4" height="4" class="road-check"/><rect x="4" y="4" width="4" height="4" class="road-check"/></pattern>
      <clipPath id="road-paved"><rect y="${n(barricade)}" width="${width}" height="${n(height - barricade + 40)}"/></clipPath>
      <clipPath id="road-planned"><rect y="-40" width="${width}" height="${n(barricade + 40)}"/></clipPath>
    </defs>
    ${verge(scene)}
    <g clip-path="url(#road-paved)">
      <path class="road-sidewalk-edge" d="${road}" stroke-width="${2 * (HALF_ROAD + SIDEWALK) + 2}"/><path class="road-sidewalk" d="${road}" stroke-width="${2 * (HALF_ROAD + SIDEWALK)}"/>
      <path class="road-curb" d="${road}" stroke-width="${2 * HALF_ROAD + 3}"/><path class="road-asphalt" d="${road}" stroke-width="${2 * HALF_ROAD}"/>
      <path class="road-edge-line" d="${edge(-1)}"/><path class="road-edge-line" d="${edge(1)}"/><path class="road-center-line" d="${road}"/>
      ${stops.map(stopLine).join('')}
      <rect class="road-start" x="${n(startAt.x - HALF_ROAD + 3)}" y="${n(start - 5)}" width="${2 * HALF_ROAD - 6}" height="10"/>
    </g>
    <g clip-path="url(#road-planned)"><path class="road-planned" d="${edge(-1.25)}"/><path class="road-planned" d="${edge(1.25)}"/></g>
    ${workZone(scene)}
  </svg>`;
}

/** Ochre trace of the distance already driven, in the car's lane, ending under the car. */
export const trailPath = (knots: Knot[], until: number) => roadPath(knots, LANE, until);
