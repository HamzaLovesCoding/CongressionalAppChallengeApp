// Every vendored simulation, inside the feed (npm run build && npm run preview): its card opens at
// #/feed/sim/:id, Start challenge mounts the package in the card and locks the feed; safe choice →
// "safe" record → Continue moves to the next feed item; unsafe → "unsafe" + Review Later; Retry →
// "retry"; letting the countdown run out → "timeout"; Exit → one "exit" record and the learner
// stays on the same card. No XP ever. #/sim/... links redirect into the feed.
// Also: a WebGL-less browser shows the package's own fallback instead of a blank screen.
// Screenshots: artifacts/simulations/. ONLY=four-way-stop,... limits the run.
import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.env.BASE ?? 'http://127.0.0.1:4173/';
const out = 'artifacts/simulations';
await mkdir(out, { recursive: true });
const registry = await readFile(new URL('../src/simulation/registry.ts', import.meta.url), 'utf8');
const entries = [...registry.matchAll(/\{ id: '([a-z-]+)', number: (\d+), type: '(\dd)'[\s\S]*?lessonId: ('[a-z-]+'|null)/g)]
  .map(([, id, number, type, lesson]) => ({ id, number: Number(number), type, lessonId: lesson === 'null' ? null : lesson.slice(1, -1) }))
  .filter(entry => !process.env.ONLY || process.env.ONLY.split(',').includes(entry.id));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];

for (const entry of entries) {
  const manifest = JSON.parse(await readFile(new URL(`../vendor/lane-simulations/${entry.id}/scenario-manifest.json`, import.meta.url), 'utf8'));
  const unsafe = manifest.choices.find(choice => !choice.isSafe).id;
  const card = `#/feed/sim/${entry.id}`;
  // Each phase gets a fresh browser context, so it starts with empty storage and no earlier page alive.
  let browserContext, page;
  const errors = [];
  const fresh = async () => { await browserContext?.close(); browserContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); page = await browserContext.newPage(); page.on('pageerror', error => errors.push(error.message)); };
  const records = () => page.evaluate(() => JSON.parse(localStorage.getItem('roadloop-progress') ?? '{}'));
  const open = async (legacy = false) => {
    await page.goto(legacy ? `${base}#/sim/${entry.id}/review` : base + card, { waitUntil: 'load' });
    await page.waitForFunction(hash => location.hash === hash, card, { timeout: 10000 });
    await page.locator('.is-current [data-sim-start]').click();
    await page.locator('[data-start]').waitFor({ timeout: 20000 });
    // While a challenge runs, a swipe can't move the feed.
    const before = await page.evaluate(() => document.querySelector('.lane-feed').scrollTop);
    await page.mouse.move(195, 300);
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => document.querySelector('.lane-feed').scrollTop), before, `${entry.id} feed locked`);
  };
  const start = async () => { await page.locator('[data-start]').click(); await page.locator('[data-choice]:not([disabled])').first().waitFor({ timeout: 15000 }); };

  // Safe run.
  await fresh();
  await open();
  await page.screenshot({ path: `${out}/${entry.number}-${entry.id}-ready.png` });
  await start();
  await page.locator(`[data-choice="${manifest.safeChoiceId}"]`).click();
  await page.locator('[data-continue]').waitFor({ timeout: 20000 });
  await page.screenshot({ path: `${out}/${entry.number}-${entry.id}-safe.png` });
  let data = await records();
  assert.deepEqual(data.simulations.map(s => [s.outcome, s.chosenAction]), [['safe', manifest.safeChoiceId]], `${entry.id} safe record`);
  await page.locator('[data-continue]').click();
  await page.waitForFunction(hash => location.hash !== hash, card, { timeout: 10000 });
  assert.ok(await page.isHidden(`[data-sim-stage]`), `${entry.id} stage closed`);
  assert.equal((await records()).simulations.length, 1, `${entry.id} Continue adds no second record`);

  // Unsafe → Retry → timeout → Exit, from fresh storage so review queuing is visible.
  await fresh();
  await open(true);
  await start();
  await page.locator(`[data-choice="${unsafe}"]`).click();
  await page.locator('[data-retry]').waitFor({ timeout: 20000 });
  await page.screenshot({ path: `${out}/${entry.number}-${entry.id}-unsafe.png` });
  await page.locator('[data-retry]').click();
  await page.locator('[data-choice]:not([disabled])').first().waitFor({ timeout: 15000 });
  await page.locator('[data-retry]').waitFor({ timeout: 30000 }); // countdown runs out
  await page.locator('[data-exit]').click();
  await page.locator('.is-current [data-sim-body]').waitFor({ state: 'visible', timeout: 10000 });
  assert.equal(await page.evaluate(() => location.hash), card, `${entry.id} Exit stays on the same card`);
  assert.match(await page.textContent('.is-current .lane-card-status'), /Review later/);
  data = await records();
  assert.deepEqual(data.simulations.map(s => s.outcome), ['unsafe', 'retry', 'timeout', 'exit'], `${entry.id} outcome sequence`);
  assert.equal(data.simulations[2].chosenAction, 'timeout');
  assert.deepEqual((data.reviewLater ?? []).filter(item => !item.resolvedAt).map(item => item.itemId), [`sim:${entry.id}`], `${entry.id} one review item`);
  assert.equal(data.xp ?? 0, 0, `${entry.id} awards no XP`);
  assert.deepEqual(errors, [], `${entry.id} page errors`);
  results.push(`${entry.number}. ${entry.id} (${entry.type}): in-feed load, feed locked, safe, continue → next item, unsafe, retry, timeout, exit (stays) passed`);
  await browserContext.close();
}

// Without WebGL, a 3D package must show its own fallback text and choices, never a blank stage.
const noGl = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--disable-webgl', '--disable-3d-apis'] });
const flat = await noGl.newPage({ viewport: { width: 390, height: 844 } });
await flat.goto(`${base}#/feed/sim/yellow-light-stop`, { waitUntil: 'load' });
await flat.locator('.is-current [data-sim-start]').click();
await flat.getByText('Scene unavailable', { exact: false }).waitFor({ timeout: 20000 });
await flat.screenshot({ path: `${out}/no-webgl-fallback.png` });
results.push('no-WebGL: 3D package shows its fallback text');
await noGl.close();

await browser.close();
console.log(results.join('\n'));
