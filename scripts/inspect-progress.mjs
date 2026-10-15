import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { VIDEO_LESSONS } from '../src/feed/curriculum.ts';
import { CAR_GAP } from '../src/progress/road.ts';
const base = process.env.BASE ?? 'http://127.0.0.1:4173/';
// Vite dev has no service worker; use OFFLINE=0 when checking the current app on 5173.
const offline = process.env.OFFLINE !== '0';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/Users/hamza/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', headless: true });
await fs.mkdir('artifacts', { recursive: true });
// Where the road was drawn relative to the signs: every checkpoint line must meet its sign's posts.
const road = page => page.evaluate(() => {
  const atlas = document.querySelector('.path-atlas').getBoundingClientRect();
  const posts = [...document.querySelectorAll('[data-checkpoint]')].map(post => post.getBoundingClientRect().bottom - atlas.top);
  // Each stop line spans the driver's lane only: from just right of the centre line to the right edge line.
  const lines = [...document.querySelectorAll('.road-checkpoint')].map(line => line.getAttribute('d').match(/^M([-\d.]+) ([-\d.]+)H([-\d.]+)$/).slice(1).map(Number));
  const checkpoints = lines.map(([, y]) => y);
  const [, x, y] = document.querySelector('.path-car').getAttribute('transform').match(/translate\(([-\d.]+) ([-\d.]+)\)/).map(Number);
  const signs = [...document.querySelectorAll('.path-sign')].map(sign => sign.getBoundingClientRect());
  return { posts, checkpoints, lines, car: { x, y }, carBox: document.querySelector('.path-car').getBoundingClientRect().toJSON(), overlaps: signs.slice(1).some((sign, i) => sign.bottom > signs[i].top) };
});
const seed = (page, done, xp) => page.evaluate(([done, xp]) => localStorage.setItem('roadloop-progress', JSON.stringify({ xp, clips:Object.fromEntries(done.map((id, i) => [id, { done:true, tries:i ? 2 : 1, firstTry:!i }])), daily:{}, liked:[], saved:[] })), [done, xp]);
// The 19 curriculum video lessons come first, then the five original lessons.
const LESSONS = [...VIDEO_LESSONS.map(lesson => lesson.id), 'yellow-light','roundabout','four-way-stop','following-distance','school-bus'];
const TOTAL = LESSONS.length, YELLOW = LESSONS.indexOf('yellow-light'), SPACING = LESSONS.indexOf('following-distance');
try {
  for (const [name, viewport] of Object.entries({ portrait: { width:390, height:844 }, narrow:{ width:320, height:740 }, landscape:{ width:844, height:390 }, desktop:{ width:1440, height:1000 } })) {
    const context = await browser.newContext({ viewport, deviceScaleFactor:2, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(`${base}#/progress`, { waitUntil:'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('.path-sign').count(), TOTAL);
    assert.equal(await page.locator('.path-sign[aria-current]').getAttribute('data-lesson'), '0');
    assert.equal(await page.locator('.path-xp .home-sr-only').innerText(), '0 total XP');
    assert.equal(await page.locator('.path-car').count(), 1);
    assert.equal(await page.locator('.path-roadwork-sign').innerText().then(text => /coming soon/i.test(text)), true, 'Future units are marked as coming soon');
    assert.equal(await page.evaluate(() => localStorage.getItem('roadloop-progress')), null);
    let state = await road(page);
    assert.equal(state.checkpoints.length, TOTAL);
    state.posts.forEach((post, i) => assert.ok(Math.abs(post - state.checkpoints[i]) < 1.5, `Checkpoint ${i + 1} meets its sign`));
    assert.ok(Math.abs(state.car.y - state.posts[0] - CAR_GAP) < 1, 'A new learner waits before the first checkpoint');
    assert.equal(state.overlaps, false);
    assert.ok(await page.locator('.path-phone').evaluate(el => el.scrollWidth <= el.clientWidth));
    assert.ok(await page.locator('.learning-path a, .learning-path button').evaluateAll(els => els.filter(el => el.getClientRects().length).every(el => { const r = el.getBoundingClientRect(); return r.width >=44 && r.height >=44; })));
    const nav = await page.locator('.home-nav').boundingBox();
    assert.ok(state.carBox.top >= 0 && state.carBox.bottom <= nav.y, 'The page opens with the car in view');
    await page.screenshot({ path:`artifacts/progress-${name}.png` });

    assert.equal(await page.locator('.path-meter').getAttribute('aria-valuenow'), '0');
    assert.equal(await page.locator('.path-mile').count(), 4, 'Each milestone stands on the road');
    assert.equal(await page.locator('[data-locate]').isHidden(), true, 'Find my car stays out of the way while the car is in view');
    const trophies = page.getByRole('button', { name:'0/4 milestones earned', exact:true });
    await trophies.click();
    await page.locator('.path-milestones[open]').waitFor();
    await page.waitForTimeout(300);
    await page.screenshot({ path:`artifacts/progress-milestones-sheet-${name}.png` });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.path-milestones').open);
    assert.equal(await trophies.evaluate(el => el === document.activeElement), true);
    // The next sign is Home's sign: one tap starts that lesson.
    await page.locator('.path-sign[aria-current]').click();
    await page.waitForFunction(() => location.hash === '#/feed/lane-end-scan');
    await page.locator('.lane-feed').waitFor();

    // Each sign opens lesson details; Start goes to that lesson and the optional simulator only appears where one exists.
    await page.goto(`${base}#/progress`);
    await page.locator(`.path-sign[data-lesson="${SPACING}"]`).click();
    await page.locator('.path-sheet[open]').waitFor();
    assert.match(await page.locator('.path-sheet').innerText(), /The three-second rule[\s\S]*Not started[\s\S]*Start lesson/);
    assert.equal(await page.locator('.path-sheet a[href^="#/drive"]').count(), 0);
    await page.waitForTimeout(450);
    await page.screenshot({ path:`artifacts/progress-sheet-${name}.png` });
    await page.keyboard.press('Escape');
    await page.waitForFunction(index => document.activeElement?.matches(`.path-sign[data-lesson="${index}"]`), SPACING);
    await page.locator(`.path-sign[data-lesson="${YELLOW}"]`).click();
    // The simulator is offered after the lesson's quiz, never before it.
    assert.equal(await page.locator('.path-sheet a[href="#/drive/yellow-light"]').count(), 0);
    assert.match(await page.locator('.path-sheet').innerText(), /2 quick questions/);
    await page.locator('.path-sheet a[href="#/feed/yellow-light"]').click();
    await page.locator('.lane-feed').waitFor();

    await page.goto(`${base}#/progress`);
    await seed(page, LESSONS.slice(0, 2), 20);
    await page.reload({ waitUntil:'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('.path-stop.is-done').count(), 2);
    assert.equal(await page.locator('.path-sign[aria-current]').getAttribute('data-lesson'), '2');
    state = await road(page);
    assert.ok(Math.abs(state.car.y - state.posts[2] - CAR_GAP) < 1, 'The car waits at the next unfinished lesson');
    assert.ok(state.car.x > state.lines[2][0] && state.car.x < state.lines[2][2], 'The car drives in the right-hand lane');
    assert.equal(await page.locator('.road-checkpoint.is-next').count(), 1, 'The next stop line is painted ochre');
    assert.match(await page.locator('.path-trail').getAttribute('d'), /^M[\d.]+ [\d.]+C/, 'Distance driven is traced behind the car');
    await page.locator('.path-sign[data-lesson="1"]').click();
    assert.match(await page.locator('.path-sheet').innerText(), /Completed[\s\S]*10 XP earned[\s\S]*Review lesson/);
    assert.doesNotMatch(await page.locator('.path-sheet').innerText(), /First try/, 'Only a real first-try result is shown');
    await page.keyboard.press('Escape');
    await page.screenshot({ path:`artifacts/progress-started-${name}.png` });
    await page.locator('.learning-path').evaluate(el => el.scrollTop = el.scrollHeight);
    await page.screenshot({ path:`artifacts/progress-bottom-${name}.png` });
    const end = await page.locator('.path-unit-sign').boundingBox();
    assert.ok(end.y + end.height < nav.y, 'Final content clears navigation');
    await page.locator('.learning-path').evaluate(el => el.scrollTop = 0);
    await page.screenshot({ path:`artifacts/progress-top-${name}.png` });

    if (offline) await page.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once:true })); });
    if (offline) await context.setOffline(true);
    await page.reload({ waitUntil:'load' });
    await page.locator('.path-sign').first().waitFor();
    assert.equal(await page.locator('.path-stop.is-done').count(), 2);
    assert.equal(await page.locator('.path-xp .home-sr-only').innerText(), '20 total XP');
    assert.equal(await page.locator('.path-mile.is-earned').count(), 1, 'Earned badges survive offline reload');
    await page.locator('.home-nav a[href="#/home"]').click();
    await page.locator('.home-live').waitFor();
    await page.locator('.home-nav a[href="#/progress"]').click();
    await page.locator('.path-lessons').waitFor();
    await context.setOffline(false);

    await seed(page, LESSONS, 50);
    await page.reload({ waitUntil:'load' });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('.path-stop.is-done').count(), TOTAL);
    assert.equal(await page.locator('.path-mile.is-earned').count(), 4);
    assert.equal(await page.locator('.path-milestones a[href="#/practice"]').count(), 1);
    assert.equal(await page.locator('.path-sign[aria-current]').count(), 0);
    assert.equal(await page.locator('.path-finish a[href="#/practice"]').count(), 1, 'All complete offers Practice at the end of the road');
    state = await road(page);
    assert.ok(state.car.y < state.posts[TOTAL - 1], 'All complete parks the car past the last checkpoint');
    const finish = await page.locator('.path-finish .path-sign').boundingBox();
    assert.ok(state.carBox.top < finish.y + finish.height && state.carBox.bottom > finish.y, 'The car parks beside the finish sign');
    const panel = await page.locator('.path-dashboard').boundingBox();
    assert.ok(finish.y - 26 >= panel.y + panel.height, 'The finish sign and its tab open clear of the trip panel');
    assert.ok(state.carBox.top >= panel.y + panel.height && state.carBox.bottom <= nav.y, 'The parked car opens in view');
    await page.locator(`.path-sign[data-lesson="${YELLOW}"]`).click();
    assert.equal(await page.locator('.path-sheet a[href="#/drive/yellow-light"]').count(), 1, 'A completed lesson with a simulator offers it');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.path-sheet').open);
    await page.screenshot({ path:`artifacts/progress-complete-${name}.png` });
    assert.equal(await page.locator('.path-meter').getAttribute('aria-valuenow'), String(TOTAL));
    assert.match(await page.locator('.path-finish').innerText(), /Road basics complete/);
    if (name === 'narrow') {
      // Larger text grows the signs; the road must be redrawn to keep meeting them without overlaps.
      await page.addStyleTag({ content:'.path-dashboard h1 { font-size:36px; } .path-trip-label { font-size:18px!important; } .path-sign-title { font-size:22px!important; } .path-sign-meta, .path-mile-text small { font-size:16px; }' });
      await page.waitForTimeout(200);
      state = await road(page);
      state.posts.forEach((post, i) => assert.ok(Math.abs(post - state.checkpoints[i]) < 1.5, `Checkpoint ${i + 1} follows larger text`));
      assert.equal(state.overlaps, false);
      assert.ok(await page.locator('.path-phone').evaluate(el => el.scrollWidth <= el.clientWidth));
      await page.screenshot({ path:'artifacts/progress-larger-text.png' });
    }
    assert.deepEqual(errors, []);
    console.log(`${name}: road layout, checkpoints, car position, lesson sheet, milestones, focus return, completion${offline ? ' and offline' : ''} passed on ${base}.`);
    await context.close();
  }
} finally { await browser.close(); }
