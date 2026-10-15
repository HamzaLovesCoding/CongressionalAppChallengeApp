import type { Scenario } from '../scenario/scenario';
import { AVAILABLE_DISTANCE, GENTLE_PRESSURE, REPLAY_DURATION } from '../scenario/scenario';
import type { CameraMode } from '../scene/cameras';
import type { DrivingAudio } from '../audio/drivingAudio';

export function mountControls(root: HTMLElement, scenario: Scenario, onCamera: () => void, audio: DrivingAudio, onExit?: () => void) {
  root.innerHTML = `
    <main class="experience" data-state="loading">
      <div class="world"><canvas id="scene" aria-label="Real-time 3D suburban intersection" tabindex="0"></canvas><div class="vignette"></div></div>
      <header class="header">
        <a class="brand" href="./" aria-label="Lane driving practice"><span class="sim-wordmark" aria-hidden="true"></span></a>
        <div class="chapter"><span class="chapter-number">01</span><span>The yellow light<small>CEDAR AVE × MAPLE ST</small></span></div>
        <div class="header-actions">${onExit ? '<button class="icon-button exit-button" id="exit" aria-label="Back to feed" title="Back to feed (Esc)"><span aria-hidden="true">←</span><span class="exit-label">Feed</span></button>' : ''}<button class="icon-button sound-button" id="mute" aria-label="Enable sound" title="Enable sound">Sound<small id="sound-state">Off</small></button><button class="icon-button camera-button" id="camera" aria-label="Switch Camera" title="Switch Camera (C)"><span class="camera-icon"></span><span class="camera-label">Switch camera</span></button></div>
      </header>
      <div class="scene-meta"><span class="live-dot"></span><span id="scene-mode">LIVE SCENARIO</span><span class="meta-divider">/</span><span>CEDAR CROSSING</span></div>
      <div class="signal-status" id="signal-status"><span class="signal-dot green"></span><span id="signal-text">Green light</span></div>
      <div class="road-hud" id="road-hud"><div class="speed"><strong id="speed">20</strong><span>MPH</span></div><div class="hud-separator"></div><div class="distance"><strong><span id="distance">67</span> <small>m</small></strong><span>TO STOP LINE</span></div></div>
      <div class="world-label player-label" id="player-label">YOU</div>
      <div class="world-label cross-label" id="cross-label">CROSS TRAFFIC</div>
      <div class="world-label stop-label" id="stop-label">STOP LINE</div>
      <div class="replay-key" id="replay-key" hidden><span><i class="key-needed"></i><span id="key-distance"></span></span><span id="key-margin-row"><i class="key-spare"></i><span id="key-margin"></span></span><span><i class="key-line"></i>Stop line</span></div>
      <section class="bottom-panel" aria-label="Scenario controls">
        <div class="panel-top"><span class="eyebrow" id="eyebrow">READ THE ROAD</span><span class="step-count" id="step-count">01 / 03</span></div>
        <div class="panel-copy" aria-live="polite" aria-atomic="true"><h1 id="title">Approaching the intersection.</h1><p id="description">You're approaching Cedar Avenue. Watch the light and be ready to choose.</p></div>
        <div class="approach-status" id="approach-status"><span class="motion-dot"></span><span>Driving automatically</span><span class="ahead-arrow">↗</span></div>
        <div class="decision-actions" id="decision-actions" hidden>
          <button class="choice brake" id="brake" aria-pressed="false"><span class="button-symbol">Ⅱ</span><span id="brake-copy">Hold to brake<small>Release to coast</small></span><kbd>B</kbd></button>
          <button class="choice continue" id="continue"><span class="button-symbol">↑</span><span>Continue<small>Keep going</small></span><kbd>G</kbd></button>
        </div>
        <div class="replay-controls" id="replay-controls" hidden>
          <div class="timeline-row"><button class="play-button" id="play" aria-label="Pause replay">Ⅱ</button><div class="timeline"><input id="timeline" type="range" min="0" max="${REPLAY_DURATION}" step="0.01" value="0" aria-label="Replay timeline"/><div class="timeline-labels"><span>Yellow</span><span>Red</span><span>Crossing</span></div></div><span class="timecode" id="timecode">0.0s</span></div>
          <div class="replay-actions"><button class="retry" id="retry"><span>↻</span> Try again</button><span class="replay-hint">Try both decisions.</span></div>
        </div>
        <div class="panel-foot"><span class="progress-dots" aria-label="Practice checkpoints"><i class="active" title="Observe"></i><i title="Decide"></i><i title="Review"></i></span><span id="foot-text">OBSERVE → DECIDE → REVIEW</span></div>
      </section>
      <div class="prototype-note">INTERACTIVE 3D STUDY <span>•</span> 01</div>
      <div class="paused-banner" id="paused-banner" hidden>Paused <span>Press Space to resume</span></div>
      <div class="loading" id="loading" role="status"><span class="loading-mark">lane</span><span class="eyebrow">DRIVING PRACTICE</span><h2>Loading the intersection</h2><p id="loading-message">Preparing the driving scene…</p><div class="loading-track"><div id="loading-progress"></div></div><span id="loading-percent">0%</span></div>
      <pre class="performance" id="performance" hidden></pre>
      <details class="performance-report" id="performance-report" hidden><summary>Device measurements</summary><textarea id="performance-results" readonly aria-label="Device performance results"></textarea><small>Long-press to select and copy. FPS is measured on this browser; thermal state needs a manual check.</small></details>
    </main>`;
  const element = <T extends HTMLElement>(id: string) => {
    const value = root.querySelector<T>(`#${id}`);
    if (!value) throw new Error(`Missing control: ${id}`);
    return value;
  };
  const els = {
    experience: root.querySelector<HTMLElement>('.experience')!,
    title: element('title'), description: element('description'), eyebrow: element('eyebrow'), step: element('step-count'),
    approach: element('approach-status'), decisions: element('decision-actions'), replays: element('replay-controls'),
    speed: element('speed'), distance: element('distance'), signal: element('signal-status'), signalText: element('signal-text'),
    mode: element('scene-mode'), hud: element('road-hud'), key: element('replay-key'),
    timeline: element<HTMLInputElement>('timeline'), play: element<HTMLButtonElement>('play'), time: element('timecode'),
    camera: element<HTMLButtonElement>('camera'), paused: element('paused-banner'),
    brake: element<HTMLButtonElement>('brake'), continue: element<HTMLButtonElement>('continue'), brakeCopy: element('brake-copy'),
    mute: element<HTMLButtonElement>('mute'), soundState: element('sound-state'),
    foot: element('foot-text'),
  };
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  let pointer: number | null = null;
  let pointerY = 0;
  let pointerPressure = 0;
  let keyPressure = 0;
  let latched = false;
  const applyBrake = () => scenario.setBrakePressure(Math.max(pointerPressure, keyPressure, latched ? GENTLE_PRESSURE : 0));
  const releaseBrake = () => {
    const captured = pointer;
    pointer = null;
    pointerPressure = keyPressure = 0;
    latched = false;
    if (captured !== null && els.brake.hasPointerCapture(captured)) els.brake.releasePointerCapture(captured);
    applyBrake();
  };
  const beginBrake = () => { if (scenario.state === 'decision') scenario.choose('brake'); };
  els.brake.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pointer !== null || scenario.paused) return;
    event.preventDefault();
    beginBrake();
    if (scenario.state !== 'braking') return;
    pointer = event.pointerId;
    pointerY = event.clientY;
    pointerPressure = GENTLE_PRESSURE;
    els.brake.setPointerCapture(pointer);
    applyBrake();
  }, options);
  els.brake.addEventListener('pointermove', event => {
    if (event.pointerId !== pointer) return;
    pointerPressure = Math.max(.2, Math.min(1, GENTLE_PRESSURE + (pointerY - event.clientY) / 100));
    applyBrake();
  }, options);
  const pointerRelease = (event: PointerEvent) => {
    if (event.pointerId !== pointer) return;
    pointer = null;
    pointerPressure = 0;
    applyBrake();
  };
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) els.brake.addEventListener(event, pointerRelease, options);
  els.brake.addEventListener('click', event => {
    // Screen readers activate buttons with a virtual click, without holding a pointer.
    if (event.detail !== 0) return;
    beginBrake();
    latched = !latched;
    applyBrake();
  }, options);
  els.continue.addEventListener('click', () => scenario.choose('continue'));
  element('retry').addEventListener('click', () => { releaseBrake(); scenario.retry(); });
  els.mute.addEventListener('click', () => audio.toggle());
  const gesture = (event: Event) => {
    if (event.target instanceof Element && event.target.closest('#mute')) return;
    void audio.unlock();
  };
  for (const event of ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click']) window.addEventListener(event, gesture, { ...options, capture: true });
  els.play.addEventListener('click', () => scenario.togglePlayback());
  els.timeline.addEventListener('input', () => scenario.seek(Number(els.timeline.value)));
  els.camera.addEventListener('click', onCamera);
  if (onExit) element('exit').addEventListener('click', onExit, options);
  const keyboard = (event: KeyboardEvent) => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    const tag = (event.target as HTMLElement)?.tagName;
    if (tag === 'INPUT') return;
    if (event.code === 'KeyB' || (event.target === els.brake && ['Space', 'Enter'].includes(event.code))) {
      event.preventDefault();
      beginBrake();
      keyPressure = event.shiftKey ? 1 : GENTLE_PRESSURE;
      applyBrake();
      return;
    }
    if (event.code === 'KeyG') scenario.choose('continue');
    if (event.code === 'KeyC') onCamera();
    if (event.code === 'Escape' && onExit) onExit();
    if (event.code === 'KeyR' && scenario.state !== 'loading') { releaseBrake(); scenario.retry(); }
    if (event.code === 'Space' && tag !== 'BUTTON' && tag !== 'A') {
      event.preventDefault();
      if (scenario.isReplay) scenario.togglePlayback();
      else if (!['loading', 'decision'].includes(scenario.state)) { releaseBrake(); scenario.paused = !scenario.paused; }
    }
  };
  window.addEventListener('keydown', keyboard, options);
  window.addEventListener('keyup', event => {
    if (['KeyB', 'Space', 'Enter'].includes(event.code)) {
      if (event.target === els.brake) event.preventDefault();
      keyPressure = 0;
      applyBrake();
    }
  }, options);
  window.addEventListener('blur', releaseBrake, options);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseBrake(); }, options);
  let previous = '';
  return {
    canvas: element<HTMLCanvasElement>('scene'),
    performance: element('performance'),
    performanceReport(report: string) {
      element('performance-report').hidden = false;
      const results = element<HTMLTextAreaElement>('performance-results');
      if (document.activeElement !== results) results.value = report;
    },
    labels: { player: element('player-label'), cross: element('cross-label'), stop: element('stop-label') },
    progress(percent: number, message: string) {
      element('loading-progress').style.width = `${percent}%`;
      element('loading-percent').textContent = `${percent}%`;
      element('loading-message').textContent = message;
    },
    ready() { element('loading').classList.add('loaded'); },
    fail(message: string) { element('loading-message').textContent = message; element('loading-percent').textContent = 'Reload to try again'; },
    update(cameraMode: CameraMode) {
      els.experience.dataset.state = scenario.state;
      els.experience.dataset.camera = cameraMode;
      els.camera.setAttribute('aria-label', `Switch Camera — currently ${cameraMode}`);
      els.mode.textContent = scenario.isReplay ? 'ROUND REVIEW' : 'DRIVING PRACTICE';
      els.speed.textContent = Math.round(scenario.speed * 2.23694).toString();
      els.distance.textContent = Math.round(scenario.distance).toString();
      els.signalText.textContent = `${scenario.phase[0].toUpperCase()}${scenario.phase.slice(1)} light`;
      els.signal.querySelector('.signal-dot')!.className = `signal-dot ${scenario.phase}`;
      els.paused.hidden = !scenario.paused;
      els.key.hidden = !(scenario.isReplay && cameraMode === 'overhead');
      els.hud.hidden = scenario.isReplay;
      const pressed = scenario.brakePressure > 0;
      els.brake.setAttribute('aria-pressed', String(pressed));
      els.brake.classList.toggle('pressed', pressed);
      els.brake.style.setProperty('--pressure', `${scenario.brakePressure * 100}%`);
      els.brakeCopy.innerHTML = pressed ? `Braking<small>${Math.round(scenario.brakePressure * 100)}% · slide up for firmer</small>` : 'Hold to brake<small>Release to coast</small>';
      const soundLabel = audio.unavailable ? 'Sound unavailable' : audio.muted ? 'Unmute sound' : audio.unlocked ? 'Mute sound' : 'Enable sound';
      els.mute.setAttribute('aria-label', soundLabel);
      els.mute.setAttribute('title', soundLabel);
      els.mute.setAttribute('aria-pressed', String(audio.muted));
      els.mute.disabled = audio.unavailable;
      els.soundState.textContent = audio.unavailable ? 'N/A' : audio.muted || !audio.unlocked ? 'Off' : 'On';
      if (scenario.isReplay) {
        els.timeline.value = scenario.replayTime.toFixed(2);
        els.timeline.style.setProperty('--progress', `${scenario.replayTime / REPLAY_DURATION * 100}%`);
        els.time.textContent = `${scenario.replayTime.toFixed(1)}s`;
        els.play.textContent = scenario.replayPlaying ? 'Ⅱ' : '▶';
        els.play.setAttribute('aria-label', scenario.replayPlaying ? 'Pause replay' : 'Play replay');
      }
      const signature = `${scenario.state}-${scenario.choice}`;
      if (signature === previous) return;
      previous = signature;
      els.experience.dataset.result = scenario.isReplay || scenario.state === 'outcome' ? scenario.safeStop ? 'clear' : 'retry' : '';
      const replay = scenario.isReplay;
      const decision = scenario.state === 'decision';
      const outcome = scenario.state === 'outcome';
      const braking = scenario.state === 'braking';
      els.decisions.hidden = !decision && !braking;
      els.continue.hidden = braking;
      els.replays.hidden = !replay;
      els.approach.hidden = decision || replay || braking;
      els.step.textContent = replay ? '03 / 03' : decision || scenario.choice ? '02 / 03' : '01 / 03';
      root.querySelectorAll('.progress-dots i').forEach((dot, index) => {
        const stage = replay ? 2 : decision || scenario.choice ? 1 : 0;
        dot.classList.toggle('active', index === stage);
        dot.classList.toggle('cleared', index < stage);
      });
      els.foot.textContent = decision ? 'TIME PAUSED. MAKE YOUR CALL.' : replay ? 'ROUND REVIEW · SCRUB TO EXPLORE' : 'OBSERVE → DECIDE → REVIEW';
      if (decision) {
        els.eyebrow.textContent = 'CHECKPOINT / YOUR CALL';
        els.title.textContent = 'The light just changed.';
        els.description.textContent = `You're ${Math.round(AVAILABLE_DISTANCE)} m from the stop line. What do you do?`;
      } else if (replay || outcome) {
        const stopped = scenario.stoppingDistance !== null;
        const margin = scenario.stopMargin ?? 0;
        els.eyebrow.textContent = scenario.safeStop ? '✓ SAFE STOP' : '↻ ROOM TO IMPROVE';
        els.title.textContent = scenario.safeStop ? 'Space to stop.' : stopped ? 'Past the stop line.' : scenario.choice === 'brake' ? 'Still moving.' : 'That was too close.';
        els.description.textContent = stopped
          ? `${scenario.stoppingDistance!.toFixed(1)} m to stop. ${Math.abs(margin).toFixed(1)} m ${margin >= 0 ? 'to spare. You stayed clear of the stop line.' : 'past the line. Hold earlier or brake more firmly.'}`
          : scenario.choice === 'brake' ? `${scenario.travelledDistance.toFixed(1)} m travelled without stopping. Keep holding to slow down; releasing lets you coast.`
          : 'You entered on red. Cross traffic passed just ahead. That space disappears quickly.';
        element('key-distance').textContent = `${stopped ? 'Distance to stop' : 'Travelled · no stop'} · ${(scenario.stoppingDistance ?? scenario.travelledDistance).toFixed(1)} m`;
        element('key-margin-row').hidden = !stopped;
        element('key-margin-row').querySelector('i')!.className = margin >= 0 ? 'key-spare' : 'key-needed';
        element('key-margin').textContent = `${margin >= 0 ? 'Room to spare' : 'Past the line'} · ${Math.abs(margin).toFixed(1)} m`;
        els.approach.innerHTML = '<span class="motion-dot"></span><span>Opening overhead replay</span><span class="ahead-arrow">↗</span>';
      } else if (scenario.choice) {
        els.eyebrow.textContent = 'DECISION IN MOTION';
        els.title.textContent = scenario.choice === 'brake' ? 'You control the stop.' : 'Watch the crossing.';
        els.description.textContent = scenario.choice === 'brake' ? 'Hold the brake to slow down. Slide up to brake harder. Release to coast.' : 'The signal is changing. The other lane is about to move.';
        els.approach.innerHTML = `<span class="motion-dot"></span><span>${scenario.choice === 'brake' ? 'Slowing to a stop' : 'Continuing at 20 mph'}</span><span class="ahead-arrow">↗</span>`;
      } else {
        els.eyebrow.textContent = 'READ THE ROAD';
        els.title.innerHTML = 'Approaching the intersection.';
        els.description.textContent = "You're approaching Cedar Avenue. Watch the light and be ready to choose.";
        els.approach.innerHTML = '<span class="motion-dot"></span><span>Driving automatically</span><span class="ahead-arrow">↗</span>';
      }
    },
    dispose() { releaseBrake(); listeners.abort(); },
  };
}
