import type { ScenarioState } from '../scenario/scenario';

type Stage = 'approach' | 'continue' | 'overheadReplay';
type WindowSample = { stage: Stage; atSeconds: number; frames: number; ms: number };

// Wall-clock intervals must stay separate from the simulation's capped timestep.
export function createPerformanceProbe() {
  const samples: WindowSample[] = [];
  let firstFrameMs: number | null = null;
  let startedAt = 0;
  let activeMs = 0;
  let stage: Stage | null = null;
  let frames = 0;
  let ms = 0;
  const flush = () => {
    if (stage && ms >= 250) samples.push({ stage, atSeconds: activeMs / 1000, frames, ms });
    frames = ms = 0;
  };
  const summary = (name: Stage, after = 0, before = Infinity) => {
    const selected = samples.filter(s => s.stage === name && s.atSeconds >= after && s.atSeconds < before);
    const duration = selected.reduce((total, s) => total + s.ms, 0);
    return duration ? {
      fps: +(selected.reduce((total, s) => total + s.frames, 0) * 1000 / duration).toFixed(1),
      sampledSeconds: +(duration / 1000).toFixed(1),
    } : null;
  };
  return {
    firstFrame() { firstFrameMs = Math.round(performance.now()); startedAt = performance.now(); },
    frame(elapsedMs: number, state: ScenarioState, overhead: boolean, moving: boolean) {
      activeMs += elapsedMs;
      const next = !moving ? null : state === 'approaching' ? 'approach'
        : state === 'continuing' ? 'continue' : state === 'replay' && overhead ? 'overheadReplay' : null;
      if (next !== stage) { flush(); stage = next; }
      if (stage) { frames++; ms += elapsedMs; if (ms >= 1000) flush(); }
    },
    suspend() { flush(); stage = null; },
    snapshot() {
      const phases = (after = 0, before = Infinity) => Object.fromEntries(
        (['approach', 'continue', 'overheadReplay'] as const).map(name => [name, summary(name, after, before)]));
      return {
        firstFrameMs, elapsedSeconds: Math.round((performance.now() - startedAt) / 1000),
        foregroundSeconds: Math.round(activeMs / 1000),
        phases: phases(), firstMinute: phases(0, 60), afterTwoMinutes: phases(120),
        thermal: 'Not exposed by browsers; report warmth and compare early/late FPS manually.',
      };
    },
  };
}
