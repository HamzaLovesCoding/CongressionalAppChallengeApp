// Spring physics for gesture-driven UI (sheets, the lesson strip). No imports, so node --test can load it directly.
// Parameters follow Apple's designer-facing pair rather than mass/stiffness/damping:
// damping ratio (1 = no overshoot) and response (seconds to reach the target, not a fixed duration).

export type SpringConfig = { damping: number; response: number };
export type SpringState = { value: number; velocity: number };

/** Critically damped: the default for anything that moved because of a tap rather than a throw. */
export const SETTLE: SpringConfig = { damping: 1, response: 0.35 };
/** Slight overshoot, only after a gesture released with momentum (Apple ships 0.8 / 0.3 for drawers). */
export const THROWN: SpringConfig = { damping: 0.8, response: 0.3 };

/** Advances a spring by dt seconds using small semi-implicit Euler steps, which stay stable at any frame rate. */
export function springStep(state: SpringState, target: number, config: SpringConfig, dt: number): SpringState {
  const stiffness = (2 * Math.PI / config.response) ** 2;
  const friction = 4 * Math.PI * config.damping / config.response;
  let { value, velocity } = state;
  for (let left = Math.min(dt, 0.064); left > 0; left -= 1 / 240) {
    const step = Math.min(left, 1 / 240);
    velocity += (-stiffness * (value - target) - friction * velocity) * step;
    value += velocity * step;
  }
  return { value, velocity };
}

export const atRest = (state: SpringState, target: number) => Math.abs(state.value - target) < 0.5 && Math.abs(state.velocity) < 20;

/**
 * Where a throw would come to rest, using the exponential decay that scrolling uses
 * (Apple's Designing Fluid Interfaces sample code). Velocity is px/s.
 */
export const project = (velocity: number, decelerationRate = 0.998) => velocity / 1000 * decelerationRate / (1 - decelerationRate);

/** Resistance past an edge: follows the finger less the further it goes, never a hard stop. */
export const rubberband = (overshoot: number, dimension: number, constant = 0.55) =>
  overshoot * dimension * constant / (dimension + constant * Math.abs(overshoot));

/** The snap point closest to where a throw would land. */
export const nearest = (points: number[], landing: number) =>
  points.reduce((best, point) => Math.abs(point - landing) < Math.abs(best - landing) ? point : best, points[0]);

/** Velocity in px/s from recent pointer samples, ignoring anything older than 100ms so a pause before release reads as still. */
export function velocityOf(samples: { t: number; v: number }[]) {
  const last = samples[samples.length - 1];
  const recent = samples.filter(sample => last.t - sample.t <= 100);
  const first = recent[0];
  return last.t > first.t ? (last.v - first.v) / (last.t - first.t) * 1000 : 0;
}

/**
 * Runs a spring on the display clock. It starts from the current value and velocity, so a new call
 * mid-flight (a grab, a reversal) continues the motion instead of jumping. stop() returns the live state.
 */
export function animateSpring(from: SpringState, target: number, config: SpringConfig, onUpdate: (value: number) => void, onRest?: () => void) {
  let state = from, last = 0, frame = 0;
  const tick = (now: number) => {
    state = springStep(state, target, config, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    if (atRest(state, target)) { state = { value: target, velocity: 0 }; onUpdate(target); onRest?.(); return; }
    onUpdate(state.value);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return { stop() { cancelAnimationFrame(frame); return state; } };
}
