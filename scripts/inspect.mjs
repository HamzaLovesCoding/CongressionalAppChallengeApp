// Development-only browser walkthrough: drives the prototype on phone-sized viewports,
// captures the screenshots used for design review, and fails on any page error.
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { Scenario, AVAILABLE_DISTANCE, CAR_FRONT, DECISION_Z, GENTLE_PRESSURE, REPLAY_DURATION } from '../src/scenario/scenario.ts';

const EXECUTABLE = process.env.CHROMIUM
  ?? '/Users/hamza/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const PRODUCTION = process.env.PRODUCTION === '1';
// The feed owns / now; the simulator lives at #/drive.
const BASE = process.env.BASE ?? (PRODUCTION ? 'http://localhost:4173/#/drive' : 'http://127.0.0.1:5173/?perf=1#/drive');
const VIEWPORTS = {
  portrait: { width: 390, height: 844 },
  landscape: { width: 844, height: 390 },
};
const only = process.argv[2];
const log = [];
const note = (...parts) => { const line = parts.join(' '); log.push(line); console.log(line); };
await fs.mkdir('artifacts', { recursive: true });

// Check physical invariants without letting software rendering determine the input timing.
function drive(pressure, releaseFor = 0, hz = 60) {
  const scenario = new Scenario();
  scenario.start();
  scenario.update(4);
  scenario.choose('brake');
  scenario.update(releaseFor);
  scenario.setBrakePressure(pressure);
  while (scenario.state === 'braking') scenario.update(1 / hz);
  return scenario;
}
const gentle = drive(GENTLE_PRESSURE);
assert.ok(Math.abs(gentle.stopMargin - 6.75454545) < .001, 'steady gentle hold should retain the original stopping margin');
assert.ok(Math.abs(drive(GENTLE_PRESSURE, 0, 24).stoppingDistance - gentle.stoppingDistance) < .001, 'stopping distance must be frame-rate independent');
assert.ok(drive(1).stoppingDistance < gentle.stoppingDistance, 'firm braking must stop sooner');
assert.ok(drive(GENTLE_PRESSURE, 1).stopMargin < 0, 'a late gentle hold must overrun');
assert.equal(drive(0).stoppingDistance, null, 'coasting must not invent a stop');
assert.ok(Math.abs(drive(0).travelledDistance - 58.5) < .001);
gentle.replay();
gentle.seek(REPLAY_DURATION);
assert.ok(Math.abs(gentle.playerZ - DECISION_Z - gentle.stoppingDistance) < .001, 'replay must end at the recorded stop');
gentle.seek(0);
assert.equal(gentle.playerZ, DECISION_Z);
gentle.retry();
assert.equal(gentle.sampleCount, 0);
assert.equal(gentle.stoppingDistance, null);
note('Physics invariants passed: gentle/firm/late/coast, frame-rate independence, recorded replay, retry reset.');
note('DESKTOP SOFTWARE RENDERING ONLY — Chromium + SwiftShader; FPS and load times are not phone benchmarks.');

const browser = await chromium.launch({
  executablePath: EXECUTABLE,
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
});

let failures = 0;
note(`Browser: ${browser.version()}; mobile emulation, touch enabled, deviceScaleFactor 2`);
for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  if (only && only !== name) continue;
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const problems = [];
  page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') problems.push(`console: ${message.text().slice(0, 400)}`); });
  page.on('requestfailed', request => problems.push(`requestfailed: ${request.url()}`));
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(BASE).origin) problems.push(`external asset request: ${request.url()}`);
  });

  const snapshot = () => page.evaluate(() => window.__amber.snapshot());
  const touch = await page.context().newCDPSession(page);
  const pressBrake = async () => {
    const rect = await page.locator('#brake').boundingBox();
    assert.ok(rect);
    const point = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    return point;
  };
  const releaseBrake = () => touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const shot = async suffix => { await page.screenshot({ path: `artifacts/${suffix}-${name}.png` }); };
  const scrub = async seconds => {
    await page.locator('#timeline').evaluate((el, value) => {
      el.value = String(value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, seconds);
    await page.waitForTimeout(450);
  };
  const until = async (predicate, label, timeout = 30000, argument = null) => {
    try { await page.waitForFunction(predicate, argument, { timeout, polling: 60 }); }
    catch { problems.push(`timeout waiting for ${label}: ${JSON.stringify(await snapshot())}`); throw new Error(label); }
    return snapshot();
  };

  try {
    if (process.env.CHECK === 'overrun') {
      await page.goto(BASE, { waitUntil: 'load' });
      await until(() => window.__amber?.snapshot().state === 'decision', 'overrun decision');
      await page.keyboard.press('KeyB');
      await until(() => window.__amber.snapshot().time >= .85, 'overrun coast');
      await page.keyboard.down('KeyB');
      await until(() => window.__amber.snapshot().state === 'outcome', 'overrun outcome');
      await page.keyboard.up('KeyB');
      await until(() => window.__amber.snapshot().state === 'replay', 'overrun replay');
      await scrub(REPLAY_DURATION);
      await page.waitForTimeout(1100);
      const result = await snapshot();
      if (!(result.stopMargin < 0)) problems.push('targeted run did not produce an overrun');
      const player = await page.locator('#player-label').boundingBox();
      const stop = await page.locator('#stop-label').boundingBox();
      if (!player || !stop || (player.x < stop.x + stop.width && player.x + player.width > stop.x && player.y < stop.y + stop.height && player.y + player.height > stop.y)) problems.push('player and stop-line labels overlap or are hidden');
      await shot('replay-overrun');
      note(`[${name}] overrun label separation passed; margin ${result.stopMargin.toFixed(2)} m`);
    } else if (PRODUCTION) {
      await page.goto(BASE, { waitUntil: 'load' });
      const state = name => page.locator(`.experience[data-state="${name}"]`).waitFor({ timeout: 45000 });
      await state('approaching');
      if (await page.evaluate(() => typeof window.__amber !== 'undefined')) problems.push('development telemetry leaked into production');
      if (await page.locator('#performance-report').isVisible()) problems.push('diagnostics visible without opt-in');
      await page.locator('#mute').tap();
      await page.waitForFunction(() => document.querySelector('#mute').getAttribute('aria-label') === 'Mute sound');
      await state('decision');
      await pressBrake();
      await state('outcome');
      await releaseBrake();
      if (await page.locator('#title').textContent() !== 'Space to stop.') problems.push('production hold failed to stop');
      await state('replay');
      await scrub(REPLAY_DURATION);
      await shot('production-replay-brake');
      await page.locator('#retry').tap();
      await state('decision');
      await page.locator('#continue').tap();
      await state('replay');
      await scrub(4.45);
      await shot('production-replay-continue');
      await page.locator('#mute').tap();
      await page.reload();
      await state('approaching');
      await page.waitForFunction(() => document.querySelector('#mute').getAttribute('aria-label') === 'Unmute sound');
      await page.setViewportSize(name === 'portrait' ? VIEWPORTS.landscape : VIEWPORTS.portrait);
      await page.waitForTimeout(600);
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight)) problems.push('production orientation change caused overflow');
      note(`[${name}] production: both branches, gesture sound, persistent mute, rotation, no dev telemetry or external assets`);
    } else {
    await page.goto(BASE, { waitUntil: 'load' });
    await until(() => (window.__amber?.snapshot() ?? {}).state === 'approaching', 'approaching');
    if ((await snapshot()).audio.state !== 'locked') problems.push('audio context was created before the first gesture');
    await page.locator('#scene').tap();
    await until(() => window.__amber.snapshot().audio.state === 'running', 'audio gesture unlock');
    await page.locator('#mute').tap();
    await until(() => window.__amber.snapshot().audio.muted, 'mute');
    await page.locator('#mute').tap();
    await until(() => !window.__amber.snapshot().audio.muted, 'unmute');

    // 1. The yellow light has to be on screen and readable before the panel interrupts.
    const yellow = await until(
      () => { const s = window.__amber?.snapshot(); return !!s && s.state === 'approaching' && s.phase === 'yellow'; },
      'yellow during approach');
    await shot('approach-yellow');
    note(`[${name}] yellow begins at approachTime ${yellow.approachTime.toFixed(2)}s, z ${yellow.playerZ.toFixed(1)}`);

    const decision = await until(() => (window.__amber?.snapshot() ?? {}).state === 'decision', 'decision');
    await shot('decision');
    note(`[${name}] decision: phase ${decision.phase}, ${decision.fps.toFixed(0)} fps, ${decision.meshCount} meshes, canvas ${decision.width}x${decision.height}`);
    note(`[${name}] yellow lead time ${(decision.approachTime - yellow.approachTime).toFixed(2)}s`);
    if (decision.audio.chimes !== 1) problems.push(`expected one decision chime, got ${decision.audio.chimes}`);

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
    }));
    if (overflow.scrollWidth > overflow.innerWidth) problems.push(`horizontal overflow ${JSON.stringify(overflow)}`);
    note(`[${name}] overflow check ${JSON.stringify(overflow)}`);

    // 2. Brake: controlled stop short of the stop line, then the overhead replay.
    await pressBrake();
    await until(() => (window.__amber?.snapshot() ?? {}).state === 'braking', 'braking');
    await page.waitForTimeout(1400);
    await shot('braking');
    const stopped = await until(() => (window.__amber?.snapshot() ?? {}).state === 'outcome', 'brake outcome');
    await releaseBrake();
    if (Math.abs(stopped.stoppingDistance - 24.5454545) > .02) problems.push(`gentle stopping distance ${stopped.stoppingDistance}`);
    note(`[${name}] brake stops at z ${stopped.playerZ.toFixed(2)} (stop line -10.6, bumper +2.1) → ${(-10.6 - stopped.playerZ - 2.1).toFixed(2)} m short`);
    const braked = await until(() => (window.__amber?.snapshot() ?? {}).state === 'replay', 'brake replay');
    if (braked.camera !== 'overhead') problems.push(`brake replay did not open overhead (camera ${braked.camera})`);
    await page.waitForTimeout(1800);
    await scrub(REPLAY_DURATION);
    const finalStop = await snapshot();
    if (Math.abs(finalStop.annotation.endZ - (finalStop.playerZ + CAR_FRONT)) > .001) problems.push('cyan strip does not end at the recorded front bumper');
    if (Math.abs(finalStop.stopMargin - (AVAILABLE_DISTANCE - finalStop.stoppingDistance)) > .001) problems.push('runtime margin is inconsistent');
    const geometry = await page.evaluate(async () => {
      const { Engine } = await import('/src/scene/babylon.ts');
      const scene = Engine.LastCreatedScene;
      return ['recorded travel distance', 'room to spare', 'braking distance marker'].map(name => {
        const mesh = scene.getMeshByName(name);
        const bounds = mesh.getBoundingInfo().boundingBox;
        return { name, enabled: mesh.isEnabled(), active: scene.getActiveMeshes().data.includes(mesh), minZ: bounds.minimumWorld.z, maxZ: bounds.maximumWorld.z, scaleZ: mesh.scaling.z, centerZ: mesh.position.z };
      });
    });
    note(`[${name}] replay geometry: ${JSON.stringify(geometry)}`);
    if (!geometry[1].active || Math.abs(geometry[1].maxZ + 10.6) > .001) problems.push('spare strip is missing or does not reach the stop line');
    if (Math.abs(geometry[0].maxZ - (finalStop.playerZ + CAR_FRONT)) > .001) problems.push('rendered cyan geometry is not aligned to the bumper');
    await shot('replay-brake');

    // 3. Replay controls: pause, scrub, resume, and camera switch mid-replay.
    await page.locator('#play').tap();
    const paused = await snapshot();
    if (paused.state !== 'replay') problems.push(`play left state ${paused.state}`);
    await scrub(4.6);
    const scrubbed = await snapshot();
    if (Math.abs(scrubbed.time - 4.6) > 0.05) problems.push(`scrub to 4.6 landed at ${scrubbed.time}`);
    note(`[${name}] scrubbed to ${scrubbed.time.toFixed(2)}s, player z ${scrubbed.playerZ.toFixed(1)}`);
    await shot('replay-brake-scrubbed');
    await page.locator('#camera').tap();
    await page.waitForTimeout(900);
    const switched = await snapshot();
    if (switched.camera !== 'driver') problems.push(`camera switch during replay gave ${switched.camera}`);
    await shot('replay-brake-driver-camera');
    await page.locator('#camera').tap();
    await page.waitForTimeout(900);
    await page.locator('#play').tap();
    await page.waitForTimeout(400);
    if (!(await snapshot()).state.match(/replay|complete/)) problems.push('resume broke replay state');

    // 4. Retry, then take the other branch.
    await page.locator('#retry').tap();
    await until(() => (window.__amber?.snapshot() ?? {}).state === 'approaching', 'retry approach');
    await page.waitForTimeout(900);
    const retried = await snapshot();
    if (retried.camera !== 'driver') problems.push(`retry did not return to the driver camera (${retried.camera})`);
    await until(() => (window.__amber?.snapshot() ?? {}).state === 'decision', 'second decision');
    await page.locator('#continue').tap();
    await until(() => (window.__amber?.snapshot() ?? {}).state === 'continuing', 'continuing');

    // The near miss: hold the frame where the cross car is closest to the player.
    const nearMiss = await until(() => {
      const s = window.__amber?.snapshot();
      return !!s && s.state === 'continuing' && s.playerZ > -7.6 && s.playerZ < -4.8;
    }, 'near miss window');
    await shot('near-miss');
    note(`[${name}] near miss frame: player z ${nearMiss.playerZ.toFixed(2)}, cross x ${nearMiss.crossX.toFixed(2)}, gap ${Math.hypot(nearMiss.crossX - 1.85, 1.85 - nearMiss.playerZ).toFixed(2)} m`);

    await until(() => (window.__amber?.snapshot() ?? {}).state === 'replay', 'continue replay');
    await page.waitForTimeout(1200);
    await scrub(4.45);
    await shot('replay-continue');
    const crossReplay = await snapshot();
    note(`[${name}] continue replay at ${crossReplay.time.toFixed(2)}s, camera ${crossReplay.camera}`);
    if (crossReplay.stoppingDistance !== null || crossReplay.annotation.finishVisible || crossReplay.annotation.spareVisible) problems.push('continue replay invented a stop or spare margin');
    if (crossReplay.audio.horns !== 1) problems.push(`expected one live horn, got ${crossReplay.audio.horns}`);
    await scrub(0);
    await scrub(4.45);
    if ((await snapshot()).audio.horns !== 1) problems.push('scrubbing replay retriggered the horn');

    // 5. Retry has to keep working without a reload.
    for (let round = 0; round < 2; round++) {
      await page.locator('#retry').tap();
      await until(() => (window.__amber?.snapshot() ?? {}).state === 'approaching', `retry round ${round + 2}`);
      await until(() => (window.__amber?.snapshot() ?? {}).state === 'decision', `decision round ${round + 2}`);
      if (round === 0) {
        // Release, reapply, and increase pressure with a real captured touch drag.
        await pressBrake();
        await until(() => window.__amber.snapshot().time > .4, 'initial brake hold');
        await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
        await until(() => window.__amber.snapshot().brakePressure === 0, 'touch cancel releases brake');
        const coasting = await snapshot();
        await until(time => window.__amber.snapshot().time > time + .5, 'coast interval', 30000, coasting.time);
        const coastEnd = await snapshot();
        if (Math.abs(coastEnd.speed - coasting.speed) > .001) problems.push('released brake still decelerates');
        const point = await pressBrake();
        await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y - 70 }] });
        await until(() => window.__amber.snapshot().brakePressure === 1, 'firm drag pressure');
        const firm = await until(() => window.__amber.snapshot().state === 'outcome', 'firm stop');
        await releaseBrake();
        if (!(firm.stoppingDistance < stopped.stoppingDistance)) problems.push('firmer input did not shorten the stop');
        note(`[${name}] released/reapplied/firm stop: ${firm.stoppingDistance.toFixed(2)} m, ${firm.stopMargin.toFixed(2)} m spare`);
      } else {
        await page.keyboard.down('KeyB');
        await until(() => window.__amber.snapshot().brakePressure > 0, 'keyboard hold');
        await page.keyboard.up('KeyB');
        await until(() => window.__amber.snapshot().brakePressure === 0, 'keyboard release');
      }
      await until(() => (window.__amber?.snapshot() ?? {}).state === 'replay', `replay round ${round + 2}`, 40000);
      if (round === 1) {
        if ((await snapshot()).stoppingDistance !== null) problems.push('brief tap falsely counted as a stop');
        if (await page.locator('#title').textContent() !== 'Still moving.') problems.push('incomplete braking copy is inaccurate');
        await scrub(REPLAY_DURATION);
        await shot('replay-no-stop');
      }
    }
    await page.locator('#retry').tap();
    await until(() => window.__amber.snapshot().state === 'decision', 'late-braking decision');
    await pressBrake();
    await releaseBrake();
    await until(() => window.__amber.snapshot().time >= .85, 'late-braking coast');
    await page.keyboard.down('KeyB');
    const overrun = await until(() => window.__amber.snapshot().state === 'outcome', 'late-braking outcome');
    await page.keyboard.up('KeyB');
    if (!(overrun.stopMargin < 0) || await page.locator('#title').textContent() !== 'Past the stop line.') problems.push('late stop did not report the overrun honestly');
    await until(() => window.__amber.snapshot().state === 'replay', 'late-braking replay');
    await scrub(REPLAY_DURATION);
    const overrunReplay = await snapshot();
    if (overrunReplay.annotation.spareVisible || Math.abs(overrunReplay.annotation.endZ - overrunReplay.playerZ - CAR_FRONT) > .001) problems.push('overrun annotation is inaccurate');
    await shot('replay-overrun');
    note(`[${name}] late hold stopped ${overrun.stoppingDistance?.toFixed(2)} m from decision; margin ${overrun.stopMargin?.toFixed(2)} m`);
    note(`[${name}] four further runs completed without reload`);
    const final = await snapshot();
    note(`[${name}] final: ${final.renderedFrames} frames, ${final.fps.toFixed(0)} fps, ${final.meshCount} active meshes`);
    await fs.writeFile(`artifacts/desktop-telemetry-${name}.json`, JSON.stringify({ environment: 'Chromium / SwiftShader desktop emulation, not a physical phone', viewport, ...final }, null, 2));
    }
  } catch (error) {
    problems.push(`flow aborted: ${error.message}`);
  }

  if (problems.length) { failures += problems.length; note(`[${name}] PROBLEMS:\n  ${problems.join('\n  ')}`); }
  else note(`[${name}] clean: no page or console errors`);
  await page.close();
}

await browser.close();
await fs.writeFile(`artifacts/${process.env.CHECK === 'overrun' ? 'overrun-' : PRODUCTION ? 'production-' : ''}inspection.log`, `${log.join('\n')}\n`);
process.exit(failures ? 1 : 0);
