// All choices + timeout through Lane's production integration. No backend or fixture writes.
// ENGINE=webkit optionally uses the locally installed WebKit via WEBKIT=.../pw_run.sh.
import { chromium, webkit } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const engine = process.env.ENGINE ?? 'chromium';
const base = process.env.BASE ?? 'http://127.0.0.1:4173/';
const width = Number(process.env.WIDTH ?? 390), height = Number(process.env.HEIGHT ?? 844);
const out = `${process.env.AUDIT_DIR ?? 'artifacts/simulation-audit'}/${engine}-${width}x${height}`;
await mkdir(out, { recursive: true });
const registry = await readFile(new URL('../src/simulation/registry.ts', import.meta.url), 'utf8');
const ids = [...registry.matchAll(/\{ id: '([a-z-]+)', number: (\d+)/g)].map(([, id, n]) => ({ id, n: Number(n) }))
  .filter(s => !process.env.ONLY || process.env.ONLY.split(',').includes(s.id));
const browser = await (engine === 'webkit' ? webkit : chromium).launch(engine === 'webkit'
  ? { executablePath: process.env.WEBKIT }
  : { executablePath: process.env.CHROMIUM ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { engine, width, height, scenarios: [], failures: [] };
const persist = () => writeFile(`${out}/results.json`, JSON.stringify(report, null, 2));

for (const { id, n } of ids) {
  const manifest = JSON.parse(await readFile(new URL(`../vendor/lane-simulations/${id}/scenario-manifest.json`, import.meta.url), 'utf8'));
  const row = { id, cases: [], layouts: [], errors: [], consoleErrors: [], failedRequests: [] };
  report.scenarios.push(row);
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.on('pageerror', e => row.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') row.consoleErrors.push(m.text()); });
  page.on('requestfailed', r => { if (!r.failure()?.errorText.includes('ABORTED') && !r.url().includes('/videos/')) row.failedRequests.push({ url: r.url(), error: r.failure()?.errorText }); });
  const data = () => page.evaluate(() => JSON.parse(localStorage.getItem('roadloop-progress') ?? '{}'));
  const shot = name => page.screenshot({ path: `${out}/${n}-${id}-${name}.png` });
  const layout = async phase => {
    const info = await page.locator('[data-sim-stage] .shell').evaluate(shell => {
      const rect = el => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom }; };
      const root = shell.getRootNode(), viewport = root.querySelector('.viewport'), panel = root.querySelector('.controls');
      const buttons = [...root.querySelectorAll('button')].filter(b => b.getBoundingClientRect().height > 0).map(b => ({ text: b.textContent, ...rect(b), scrollWidth: b.scrollWidth, clientWidth: b.clientWidth }));
      return { shell: rect(shell), visual: rect(viewport), panel: rect(panel), buttons, viewport: { width: innerWidth, height: innerHeight }, documentOverflow: document.documentElement.scrollWidth > innerWidth, renderer: root.querySelector('.visual')?.dataset.renderer };
    });
    row.layouts.push({ phase, ...info });
    assert.ok(info.visual.height > 0, `${id} ${phase}: scene has height`);
    assert.ok(info.visual.bottom <= info.panel.y + 1 || info.visual.right <= info.panel.x + 1, `${id} ${phase}: scene clear of controls`);
    if (info.viewport.width >= 520 && info.viewport.height <= 540 && info.viewport.width > info.viewport.height) assert.ok(info.visual.height >= 240, `${id} ${phase}: useful landscape scene height`);
    assert.equal(info.documentOverflow, false, `${id} ${phase}: no page overflow`);
    for (const b of info.buttons) {
      assert.ok(b.width >= 43.5 && b.height >= 43.5, `${id} ${phase}: ${b.text} has a 44px target`);
      assert.ok(b.x >= -1 && b.right <= info.viewport.width + 1 && b.y >= -1 && b.bottom <= info.viewport.height + 1, `${id} ${phase}: ${b.text} fits viewport`);
      assert.ok(b.scrollWidth <= b.clientWidth + 1, `${id} ${phase}: ${b.text} text fits`);
    }
    return info;
  };
  try {
    await page.goto(`${base}#/feed/sim/${id}`, { waitUntil: 'load' });
    await page.locator('.is-current [data-sim-start]').click();
    await page.locator('[data-start]').waitFor({ timeout: 20000 });
    const ready = await layout('ready');
    assert.equal(ready.renderer, manifest.type === '3d' ? 'webgl' : 'svg', `${id}: real renderer, no silent fallback`);
    await shot('ready');
    let expected = [];
    const branches = [...manifest.choices.filter(c => !c.isSafe), { id: 'timeout', isSafe: false }, ...manifest.choices.filter(c => c.isSafe)];
    for (const [i, choice] of branches.entries()) {
      if (i === 0) await page.locator('[data-start]').click();
      else { await page.locator('[data-retry]').click(); expected.push('retry'); }
      await page.locator('[data-choice]').first().waitFor({ timeout: 15000 });
      await layout(`decision-${choice.id}`);
      if (i === 0) await shot('decision');
      const firstWorld = await page.locator('.visual').evaluate(v => Number(v.dataset.world));
      const firstClock = Number(await page.locator('[data-clock]').textContent());
      await page.waitForTimeout(220);
      const nextWorld = await page.locator('.visual').evaluate(v => Number(v.dataset.world));
      assert.ok(nextWorld >= firstWorld, `${id}: world moves forward`);
      if (choice.id !== 'timeout') await page.locator(`[data-choice="${choice.id}"]`).click();
      await page.locator(choice.isSafe ? '[data-continue]' : '[data-retry]').waitFor({ timeout: 20000 });
      await shot(choice.id);
      await layout(`outcome-${choice.id}`);
      if (id === 'yellow-light-stop' && choice.isSafe) {
        // Inspect the actual rendered red lamp so camera clipping cannot pass as a safe result.
        const lamp = await page.locator('canvas').evaluate(canvas => {
          const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
          const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, pixels = new Uint8Array(w * h * 4);
          gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          let count = 0, top = h, bottom = 0;
          for (let y = 0; y < h; y++) for (let x = Math.floor(w * .4); x < w * .6; x++) {
            const p = (y * w + x) * 4, r = pixels[p], g = pixels[p + 1], b = pixels[p + 2];
            if (r > 120 && r > g * 1.8 && r > b * 1.8) { count++; top = Math.min(top, h - 1 - y); bottom = Math.max(bottom, h - 1 - y); }
          }
          return { count, top, bottom, height: h };
        });
        assert.ok(lamp.count >= 8 && lamp.top > 4 && lamp.bottom < lamp.height - 4, `${id}: red signal remains inside the rendered view`);
        row.signalFraming = lamp;
      }
      expected.push(choice.id === 'timeout' ? 'timeout' : choice.isSafe ? 'safe' : 'unsafe');
      const saved = await data();
      assert.deepEqual(saved.simulations.map(s => s.outcome), expected, `${id} ${choice.id}: exactly one result per attempt`);
      const record = saved.simulations.at(-1);
      assert.equal(record.chosenAction, choice.id);
      assert.ok(Number.isFinite(record.elapsedSeconds) && record.elapsedSeconds >= 1.8 && record.elapsedSeconds < 12, `${id}: finite active elapsed seconds`);
      assert.equal(saved.xp ?? 0, 0, `${id}: no XP`);
      assert.equal((saved.reviewLater ?? []).filter(r => r.itemId === `sim:${id}` && !r.resolvedAt).length, choice.isSafe ? 0 : 1, `${id}: review queued/resolved`);
      assert.equal(await page.locator(choice.isSafe ? '[data-retry]' : '[data-continue]').count(), 0, `${id}: correct result action`);
      if (!choice.isSafe) assert.equal(await page.locator('.impact').isVisible(), true, `${id}: unsafe consequence visible`);
      row.cases.push({ action: choice.id, outcome: record.outcome, seconds: record.elapsedSeconds, firstClock, worldDelta: nextWorld - firstWorld, feedback: await page.locator('.result').innerText() });
      if (process.env.CHECK_LANDSCAPE) {
        for (const [landscapeWidth, landscapeHeight] of [[568, 320], [844, 390]]) {
          await page.setViewportSize({ width: landscapeWidth, height: landscapeHeight });
          await page.waitForTimeout(100);
          await layout(`outcome-${choice.id}-${landscapeWidth}x${landscapeHeight}`);
          await shot(`${choice.id}-${landscapeWidth}x${landscapeHeight}`);
        }
        if (!choice.isSafe) {
          await page.setViewportSize({ width, height });
          await page.waitForTimeout(100);
        }
      }
      await persist();
    }
    await page.locator('[data-continue]').click();
    await page.waitForFunction(id => location.hash !== `#/feed/sim/${id}`, id);
    assert.equal((await data()).simulations.length, expected.length, `${id}: Continue records no duplicate`);
    assert.equal(await page.locator('[data-sim-stage] .shell').count(), 0, `${id}: destroyed after Continue`);
    if (process.env.CHECK_LANDSCAPE) assert.equal(await page.locator('.lane-track').evaluate(e => e.clientWidth), 430, `${id}: Continue restores the ordinary feed column`);
    assert.deepEqual(row.errors, [], `${id}: no runtime errors`);
    row.passed = true;
    console.log(`${engine} ${width} ${id}: ${row.cases.length} outcomes + retries + Continue PASS`);
  } catch (e) {
    row.failure = e.message;
    report.failures.push({ id, message: e.message });
    await shot('FAIL').catch(() => {});
    console.log(`${engine} ${width} ${id}: FAIL ${e.message}`);
  }
  await context.close();
  await persist();
}
await browser.close();
console.log(JSON.stringify({ scenarios: report.scenarios.length, outcomes: report.scenarios.reduce((n, s) => n + s.cases.length, 0), failures: report.failures }, null, 2));
process.exitCode = report.failures.length ? 1 : 0;
