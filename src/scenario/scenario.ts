export type ScenarioState = 'loading' | 'approaching' | 'decision' | 'braking' | 'continuing' | 'outcome' | 'replay' | 'complete';
export type Choice = 'brake' | 'continue';
export const SPEED = 9;
export const DECISION_Z = -44;
export const STOP_LINE_Z = -10.6;
export const CAR_FRONT = 2.1;
export const GENTLE_PRESSURE = .55;
export const MAX_DECELERATION = 3;
export const REPLAY_DURATION = 6.5;
export const APPROACH_DURATION = 4;
// The light turns amber well before the panel interrupts, so the change is read on the road.
export const YELLOW_AT = 2.4;
export const RED_AFTER_DECISION = 2.05;
export const CROSS_GREEN_AFTER_DECISION = 3.05;
export const AVAILABLE_DISTANCE = STOP_LINE_Z - DECISION_Z - CAR_FRONT;

type Frame = { time: number; z: number; speed: number; pressure: number };
export function crossPosition(time: number) { return 42 - 9.4 * time; }

export class Scenario {
  state: ScenarioState = 'loading';
  choice: Choice | null = null;
  approachTime = 0;
  actionTime = 0;
  replayTime = 0;
  outcomeTime = 0;
  replayPlaying = true;
  paused = false;
  version = 0;
  brakePressure = 0;
  private z = DECISION_Z;
  private velocity = SPEED;
  private frames: Frame[] = [];
  stoppingDistance: number | null = null;

  get isReplay() { return this.state === 'replay' || this.state === 'complete'; }
  get time() { return this.isReplay ? this.replayTime : this.actionTime; }
  get playerZ() { return this.state === 'approaching' ? -80 + SPEED * this.approachTime : this.isReplay ? this.recordedFrame(this.replayTime).z : this.z; }
  get crossX() { return crossPosition(this.state === 'approaching' ? this.approachTime - APPROACH_DURATION : this.time); }
  get speed() { return this.isReplay ? this.recordedFrame(this.replayTime).speed : this.state === 'approaching' ? SPEED : this.velocity; }
  get recordedPressure() { return this.isReplay ? this.recordedFrame(this.replayTime).pressure : this.brakePressure; }
  get travelledDistance() { return this.z - DECISION_Z; }
  get stopMargin() { return this.stoppingDistance === null ? null : AVAILABLE_DISTANCE - this.stoppingDistance; }
  get safeStop() { return this.stopMargin !== null && this.stopMargin >= 0; }
  get sampleCount() { return this.frames.length; }
  get phase(): 'green' | 'yellow' | 'red' {
    if (this.state === 'approaching') return this.approachTime < YELLOW_AT ? 'green' : 'yellow';
    return this.time < RED_AFTER_DECISION ? 'yellow' : 'red';
  }
  get crossGreen() { return this.time >= CROSS_GREEN_AFTER_DECISION; }
  get worldTime() { return this.state === 'approaching' ? this.approachTime : this.time + APPROACH_DURATION; }
  get distance() { return Math.max(0, STOP_LINE_Z - this.playerZ - CAR_FRONT); }
  get moving() { return !this.paused && !['loading', 'decision', 'outcome', 'complete'].includes(this.state) && (!this.isReplay || this.replayPlaying); }

  private recordedFrame(time: number): Frame {
    if (!this.frames.length) return { time: 0, z: DECISION_Z, speed: SPEED, pressure: 0 };
    let low = 0, high = this.frames.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (this.frames[mid].time <= time) low = mid;
      else high = mid - 1;
    }
    const a = this.frames[low], b = this.frames[Math.min(low + 1, this.frames.length - 1)];
    const mix = b.time === a.time ? 0 : Math.max(0, Math.min(1, (time - a.time) / (b.time - a.time)));
    return { time, z: a.z + (b.z - a.z) * mix, speed: a.speed + (b.speed - a.speed) * mix, pressure: a.pressure };
  }
  transition(state: ScenarioState) { this.state = state; this.version++; }
  start() { this.retry(); }
  retry() {
    this.choice = null;
    this.approachTime = this.actionTime = this.replayTime = this.outcomeTime = this.brakePressure = 0;
    this.z = DECISION_Z;
    this.velocity = SPEED;
    this.stoppingDistance = null;
    this.frames = [];
    this.replayPlaying = true;
    this.paused = false;
    this.transition('approaching');
  }
  choose(choice: Choice) {
    if (this.state !== 'decision') return;
    this.choice = choice;
    this.frames = [{ time: 0, z: this.z, speed: this.velocity, pressure: 0 }];
    this.transition(choice === 'brake' ? 'braking' : 'continuing');
  }
  setBrakePressure(pressure: number) {
    this.brakePressure = this.state === 'braking' && !this.paused && Number.isFinite(pressure)
      ? Math.max(0, Math.min(1, pressure)) : 0;
    // Preserve the input edge even if it falls between render frames.
    if (this.state === 'braking') this.frames.push({ time: this.actionTime, z: this.z, speed: this.velocity, pressure: this.brakePressure });
  }
  replay() {
    if (!this.choice) return;
    this.brakePressure = 0;
    this.replayTime = 0;
    this.replayPlaying = true;
    this.transition('replay');
  }
  seek(time: number) {
    if (!this.isReplay || !Number.isFinite(time)) return;
    this.replayTime = Math.max(0, Math.min(REPLAY_DURATION, time));
    this.replayPlaying = false;
    this.transition(this.replayTime === REPLAY_DURATION ? 'complete' : 'replay');
  }
  togglePlayback() {
    if (!this.isReplay) return;
    if (this.replayTime >= REPLAY_DURATION) this.replayTime = 0;
    this.replayPlaying = !this.replayPlaying;
    this.transition('replay');
  }
  update(dt: number) {
    if (this.paused || !Number.isFinite(dt) || dt <= 0) return;
    if (this.state === 'approaching') {
      this.approachTime = Math.min(APPROACH_DURATION, this.approachTime + dt);
      if (this.approachTime >= APPROACH_DURATION) this.transition('decision');
    } else if (this.state === 'braking' || this.state === 'continuing') {
      let remaining = Math.min(dt, REPLAY_DURATION - this.actionTime);
      while (remaining > 1e-9) {
        const step = Math.min(remaining, 1 / 120);
        const deceleration = this.choice === 'brake' ? this.brakePressure * MAX_DECELERATION : 0;
        // Integrate only until zero speed so the final partial step cannot overshoot.
        const movingTime = deceleration ? Math.min(step, this.velocity / deceleration) : step;
        this.z += this.velocity * movingTime - .5 * deceleration * movingTime * movingTime;
        this.velocity = Math.max(0, this.velocity - deceleration * step);
        if (this.velocity < 1e-8) {
          this.velocity = 0;
          this.stoppingDistance ??= this.z - DECISION_Z;
        }
        this.actionTime += step;
        this.frames.push({ time: this.actionTime, z: this.z, speed: this.velocity, pressure: this.brakePressure });
        remaining -= step;
      }
      if (this.actionTime >= REPLAY_DURATION - 1e-8) {
        this.actionTime = REPLAY_DURATION;
        this.brakePressure = 0;
        this.transition('outcome');
      }
    } else if (this.state === 'outcome') {
      this.outcomeTime += dt;
      if (this.outcomeTime > 1.5) this.replay();
    } else if (this.state === 'replay' && this.replayPlaying) {
      this.replayTime = Math.min(REPLAY_DURATION, this.replayTime + dt * .75);
      if (this.replayTime >= REPLAY_DURATION) { this.replayPlaying = false; this.transition('complete'); }
    }
  }
}
