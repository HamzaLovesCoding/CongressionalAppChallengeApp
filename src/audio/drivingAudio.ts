import type { Scenario } from '../scenario/scenario';

export function createDrivingAudio() {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let motor: OscillatorNode | null = null;
  let motorGain: GainNode | null = null;
  let rollGain: GainNode | null = null;
  let roll: AudioBufferSourceNode | null = null;
  let muted = false;
  let unavailable = false;
  let disposed = false;
  let lastState = '';
  let pendingChime = false;
  let hornPlayed = false;
  let chimes = 0;
  let horns = 0;
  const voices = new Set<OscillatorNode>();
  try { muted = localStorage.getItem('amber-muted') === 'true'; } catch { /* Storage may be disabled in private browsing. */ }

  function tone(frequency: number, delay: number, duration: number, volume: number, type: OscillatorType = 'sine') {
    if (!context || !master || muted || document.hidden || context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const at = context.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + .025);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(gain).connect(master);
    voices.add(oscillator);
    oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(at);
    oscillator.stop(at + duration + .02);
  }
  function chime() {
    if (!context || context.state !== 'running' || muted) return;
    tone(659.25, 0, .45, .11);
    tone(880, .12, .6, .075);
    chimes++;
    pendingChime = false;
  }
  function silenceVoices() {
    for (const voice of voices) { voice.stop(); voice.disconnect(); }
    voices.clear();
  }
  function volume(active = true) {
    if (!context || !master) return;
    master.gain.setTargetAtTime(muted || !active || document.hidden ? 0 : .55, context.currentTime, .025);
  }
  async function unlock() {
    if (disposed || unavailable) return;
    try {
      // Constructing and resuming here keeps the graph inside a real user gesture.
      if (!context) {
        context = new AudioContext();
        master = context.createGain();
        master.gain.value = 0;
        master.connect(context.destination);
        motor = context.createOscillator();
        motor.type = 'triangle';
        motorGain = context.createGain();
        motorGain.gain.value = 0;
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 260;
        motor.connect(filter).connect(motorGain).connect(master);
        motor.start();
        const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        roll = context.createBufferSource();
        roll.buffer = buffer;
        roll.loop = true;
        const roadFilter = context.createBiquadFilter();
        roadFilter.type = 'bandpass';
        roadFilter.frequency.value = 650;
        roadFilter.Q.value = .65;
        rollGain = context.createGain();
        rollGain.gain.value = 0;
        roll.connect(roadFilter).connect(rollGain).connect(master);
        roll.start();
      }
      if (context.state !== 'running') await context.resume();
      if (disposed) return;
      volume();
      if (pendingChime) chime();
    } catch {
      // A denied resume is retried on the next gesture; absent WebAudio stays silent.
      unavailable = !context;
    }
  }
  return {
    unlock,
    get muted() { return muted; },
    get unlocked() { return context?.state === 'running'; },
    get unavailable() { return unavailable; },
    toggle() {
      if (!context && !muted) { void unlock(); return; }
      muted = !muted;
      try { localStorage.setItem('amber-muted', String(muted)); } catch { /* The control still works without persistence. */ }
      if (muted) { pendingChime = false; silenceVoices(); }
      volume();
      if (!muted) void unlock();
    },
    suspend() {
      silenceVoices();
      volume(false);
      if (context?.state === 'running') void context.suspend().catch(() => {});
    },
    update(scenario: Scenario) {
      if (scenario.state !== lastState) {
        if (scenario.state === 'approaching') { hornPlayed = false; pendingChime = false; silenceVoices(); }
        if (scenario.state === 'decision') { pendingChime = !muted; chime(); }
        if (scenario.isReplay || scenario.state === 'outcome') pendingChime = false;
        lastState = scenario.state;
      }
      const active = !scenario.paused && !document.hidden;
      volume(active);
      if (!active) silenceVoices();
      if (!context || !motor || !motorGain || !rollGain) return;
      const moving = scenario.moving;
      const ratio = Math.max(0, Math.min(1, scenario.speed / 9));
      motor.frequency.setTargetAtTime(42 + ratio * 48, context.currentTime, .1);
      motorGain.gain.setTargetAtTime(moving ? .055 + ratio * .08 : 0, context.currentTime, .08);
      rollGain.gain.setTargetAtTime(moving ? ratio * .1 : 0, context.currentTime, .08);
      // Only the live near-miss sounds a horn; seeking a replay never fires cues.
      if (scenario.state === 'continuing' && scenario.actionTime >= 4.05 && !hornPlayed && active) {
        tone(349.23, 0, .38, .1, 'triangle');
        tone(440, 0, .38, .07, 'triangle');
        hornPlayed = true;
        if (!muted && context.state === 'running') horns++;
      }
    },
    snapshot: () => ({ state: context?.state ?? 'locked', muted, unavailable, chimes, horns, volume: master?.gain.value ?? 0 }),
    dispose() {
      disposed = true;
      silenceVoices();
      motor?.stop();
      roll?.stop();
      if (context && context.state !== 'closed') void context.close().catch(() => {});
    },
  };
}

export type DrivingAudio = ReturnType<typeof createDrivingAudio>;
