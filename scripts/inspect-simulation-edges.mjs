// Layout, lifecycle, fallback and accessibility checks beyond the ordinary outcome walkthrough.
import { chromium, webkit } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.BASE ?? 'http://127.0.0.1:4173/';
const engine = process.env.ENGINE ?? 'chromium';
const out = `${process.env.AUDIT_DIR ?? 'artifacts/simulation-audit'}/edges${engine === 'webkit' ? '-webkit' : ''}${process.env.ONLY ? `-${process.env.ONLY}` : ''}`;
await mkdir(out, { recursive: true });
const registry = await readFile(new URL('../src/simulation/registry.ts', import.meta.url), 'utf8');
const entries = [...registry.matchAll(/\{ id: '([a-z-]+)', number: (\d+), type: '(\dd)'/g)].map(([, id, n, type]) => ({ id, n: Number(n), type })).filter(e=>!process.env.ONLY||process.env.ONLY.split(',').includes(e.id));
const launch = extra => engine === 'webkit' ? webkit.launch({ executablePath: process.env.WEBKIT }) : chromium.launch({ executablePath: process.env.CHROMIUM ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...extra] });
const browser = await launch([]), results = [], issues = [];
const save = () => writeFile(`${out}/results.json`, JSON.stringify({ results, issues }, null, 2));
const records = page => page.evaluate(() => JSON.parse(localStorage.getItem('roadloop-progress') ?? '{}'));
const open = async (page, id) => {
  await page.goto(`${base}#/feed/sim/${id}`);
  await page.locator('.is-current [data-sim-start]').click();
  await page.locator('[data-start]').waitFor({ timeout: 20000 });
};
const audit = async (page, id, phase) => {
  const row = await page.locator('.shell').evaluate(shell => {
    const root = shell.getRootNode(), rect = e => { const r = e.getBoundingClientRect(); return { x:r.x, y:r.y, w:r.width, h:r.height, right:r.right, bottom:r.bottom }; };
    const vp = rect(root.querySelector('.viewport')), controls = rect(root.querySelector('.controls'));
    const mirror = root.querySelector('.mirror-frame span'), note = root.querySelector('.scene-note');
    const btns = [...root.querySelectorAll('button')].filter(b => b.getBoundingClientRect().height).map(b => ({ text:b.textContent, ...rect(b), overflow: b.scrollWidth > b.clientWidth + 1 }));
    return { width:innerWidth, height:innerHeight, vp, controls, btns, mirror:mirror ? rect(mirror) : null, note:note ? rect(note) : null, overflow:document.documentElement.scrollWidth > innerWidth };
  });
  const problems = [];
  if (row.vp.h < 60) problems.push('Scene has less than 60px height');
  if (row.vp.bottom > row.controls.y + 1 && row.vp.right > row.controls.x + 1) problems.push('Scene overlaps decision panel');
  if (row.width >= 520 && row.height <= 540 && row.width > row.height && row.vp.h < 240) problems.push('Landscape scene is too short to inspect hazards');
  if (row.mirror && row.note && row.mirror.y < row.note.bottom + 2 && row.mirror.right > row.note.x && row.mirror.x < row.note.right) problems.push('Mirror caption overlaps scene caption');
  if (row.overflow) problems.push('Page horizontal overflow');
  for (const b of row.btns) {
    if (b.w < 43.5 || b.h < 43.5) problems.push(`Small target: ${b.text} (${b.w}x${b.h})`);
    if (b.x < -1 || b.right > row.width + 1 || b.y < -1 || b.bottom > row.height + 1) problems.push(`Offscreen control: ${b.text}`);
    if (b.overflow) problems.push(`Clipped choice text: ${b.text}`);
  }
  const result = { id, phase, ...row, problems };
  results.push(result);
  if (problems.length) issues.push({ id, phase, width:row.width, height:row.height, problems });
};
for (const entry of entries) {
  const {id,n} = entry;
  const context = await browser.newContext({ viewport:{width:390,height:844}, hasTouch:true,isMobile:true,serviceWorkers:'block', reducedMotion:'reduce' });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await open(page,id);
    // Exit before Start, then remount and cancel a pending consequence.
    await page.locator('[data-exit]').click();
    assert.deepEqual((await records(page)).simulations.map(r=>r.outcome), ['exit']);
    await page.locator('.is-current [data-sim-start]').click();
    await page.locator('[data-start]').waitFor();
    await page.locator('[data-start]').focus();
    await page.keyboard.press('Enter');
    await page.locator('[data-choice]').first().waitFor();
    assert.equal(await page.locator('[data-choice]').first().evaluate(e=>e.getRootNode().activeElement===e),true,'decision keyboard focus');
    // Resize the actual mounted integration at the active decision, without waiting for a timeout.
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now()+100));
    await page.locator('.is-current [data-sim-stage]').evaluate(e=>e.style.transform='translateY(200vh)');
    await page.waitForTimeout(100);
    await page.clock.runFor(250);
    const clockBefore = await page.locator('[data-clock]').textContent();
    await page.clock.fastForward(9000);
    assert.equal(await page.locator('[data-clock]').textContent(),clockBefore,'offscreen countdown pauses');
    await page.locator('.is-current [data-sim-stage]').evaluate(e=>e.style.removeProperty('transform'));
    await page.waitForTimeout(100);
    await page.clock.runFor(100);
    const visibleClock = await page.locator('[data-clock]').textContent();
    // Drive the visibility listener deterministically; this is not a native phone background test.
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
    await page.clock.fastForward(9000);
    assert.equal(await page.locator('[data-clock]').textContent(),visibleClock,'hidden-document event pauses countdown');
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    for (const [width,height] of [[320,568],[360,800],[390,844],[568,320],[667,375],[844,390],[768,1024]]) {
      await page.setViewportSize({width,height});
      await page.waitForTimeout(80);
      await audit(page,id,'decision');
      await page.screenshot({path:`${out}/${n}-${id}-${width}x${height}.png`});
    }
    await page.setViewportSize({width:390,height:844});
    const manifest = JSON.parse(await readFile(new URL(`../vendor/lane-simulations/${id}/scenario-manifest.json`,import.meta.url),'utf8'));
    await page.locator(`[data-choice="${manifest.choices.find(c=>!c.isSafe).id}"]`).click();
    await page.locator('[data-exit]').click();
    await page.clock.fastForward(6500);
    assert.deepEqual((await records(page)).simulations.map(r=>r.outcome),['exit','exit'],'Exit cancels pending completion');
    assert.equal(await page.locator('.shell').count(),0,'no abandoned scene');
    // Babylon's asynchronous readiness callbacks need the clock to run when remounting.
    await page.clock.resume();
    await page.locator('.is-current [data-sim-start]').click();
    await page.locator('[data-start]').waitFor();
    // A route change destroys the newly mounted scene and records exactly one Exit.
    await page.evaluate(()=>{location.hash='#/review';});
    await page.locator('[data-sim-stage]').waitFor({state:'detached'});
    await page.clock.fastForward(10000);
    assert.deepEqual((await records(page)).simulations.map(r=>r.outcome),['exit','exit','exit']);
    await page.goto(`${base}#/feed/sim/${id}`);
    for(const phase of ['watching','deciding']){
      await page.locator('.is-current [data-sim-start]').click();
      await page.locator('[data-start]').waitFor();
      await page.locator('[data-start]').click();
      await page.locator(phase==='watching'?'.shell[data-phase="watching"]':'[data-choice]').first().waitFor();
      await page.locator('[data-exit]').click();
    }
    await page.clock.fastForward(6500);
    assert.deepEqual((await records(page)).simulations.map(r=>r.outcome),Array(5).fill('exit'),'every interrupted phase records only Exit');
    assert.deepEqual(errors,[]);
    results.push({id,lifecycle:'PASS',keyboard:'PASS',reducedMotion:true,offscreenPause:'PASS',visibilityListenerPause:'PASS',exitPhases:['intro','watching','deciding','resolving','route-change']});
    console.log(`${id}: layout + keyboard + reduced motion + exit cancellation + route cleanup checked`);
  } catch(e) { issues.push({id,failure:e.message}); console.log(`${id}: ERROR ${e.message}`); }
  await context.close(); await save();
}
await browser.close();
// WebGL loss is separate from a failed initial scene load.
for (const entry of entries.filter(e=>e.type==='3d'&&!process.env.SKIP_FALLBACK)) {
  for (const mode of ['no-webgl','context-loss']) {
    const b = await launch(mode==='no-webgl'?['--disable-webgl','--disable-3d-apis']:[]);
    const context = await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}), page = await context.newPage();
    try {
      await open(page,entry.id);
      if(mode==='context-loss')await page.locator('canvas').evaluate(c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
      await page.getByText('Scene unavailable.',{exact:false}).waitFor();
      await page.locator('[data-start]').click();
      await page.locator('[data-choice]').first().waitFor();
      const manifest=JSON.parse(await readFile(new URL(`../vendor/lane-simulations/${entry.id}/scenario-manifest.json`,import.meta.url),'utf8'));
      await page.locator(`[data-choice="${manifest.safeChoiceId}"]`).click();
      await page.locator('[data-continue]').waitFor();
      assert.equal((await records(page)).simulations.at(-1).outcome,'safe');
      await page.screenshot({path:`${out}/${entry.id}-${mode}.png`});
      results.push({id:entry.id,mode,result:'PASS'});
    } catch(e){issues.push({id:entry.id,mode,failure:e.message});}
    await b.close();await save();
  }
}
console.log(JSON.stringify({checks:results.length,issues:issues.length}));
process.exitCode = issues.length ? 1 : 0;
