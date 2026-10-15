import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { VIDEO_LESSONS } from '../src/feed/curriculum.ts';

// The 19 curriculum video lessons come first, then the five original lessons.
const VIDEO_IDS = VIDEO_LESSONS.map(lesson => lesson.id);
const TOTAL = VIDEO_IDS.length + 5;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/Users/hamza/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const base = process.env.BASE ?? 'http://127.0.0.1:4173/';
await fs.mkdir('artifacts', { recursive: true });
try {
  for (const [name, viewport] of Object.entries({ portrait: { width: 390, height: 844 }, narrow: { width: 320, height: 740 }, landscape: { width: 844, height: 390 }, desktop: { width: 1440, height: 1000 } })) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: name !== 'desktop', hasTouch: name !== 'desktop', reducedMotion: 'reduce' });
    const page = await context.newPage();
    const problems = [];
    page.on('pageerror', error => problems.push(error.message));
    page.on('console', message => { if (message.type() === 'error') problems.push(message.text()); });
    // Offline, an unwatched lesson video can't load and falls back to its poster; any other failed request is a problem.
    const failed = [];
    page.on('requestfailed', request => failed.push(request.url()));
    const nav = () => page.getByRole('navigation', { name: 'Main navigation', exact: true });
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('roadloop-progress')));
    const home = async () => { await page.goto(`${base}#/home`); await page.locator('.home-live').waitFor(); };
    // Sheets fade in under reduced motion; screenshots wait for that to finish.
    const settled = selector => page.waitForFunction(sel => document.querySelector(sel).open && document.querySelector(sel).getAnimations().length === 0, selector);
    const layout = async () => {
      assert.ok(await page.locator('.home-phone').evaluate(el => el.scrollWidth <= el.clientWidth), 'No horizontal overflow');
      assert.ok(await page.locator('.home-content img').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0)));
      assert.ok(await page.locator('.home-live button, .home-live a').evaluateAll(elements => elements.filter(el => el.getClientRects().length).every(el => { const r = el.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })), 'Visible controls meet 44px target size');
    };
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.getByRole('heading', { name:'Lane', exact:true }).count(), 1);
    assert.equal(await page.locator('[data-completed]').innerText(), `0 of ${TOTAL} done`);
    assert.equal(await page.locator('.home-sign-face').getAttribute('href'), '#/feed/lane-end-scan');
    assert.equal(await page.getByRole('link', { name: 'Start lesson: Scanning Ahead for Lane-End Warnings', exact: true }).count(), 1);
    assert.equal(await page.locator('.home-strip-card').count(), TOTAL);
    assert.equal(await page.locator('.home-strip-card.is-done').count(), 0);
    assert.equal(await page.locator('.home-week-bars li').count(), 7);
    assert.equal(await page.locator('[data-streak]').innerText(), 'Start a streak today');
    assert.equal(await stored(), null, 'Opening home must not write progress');
    assert.equal(await page.locator('.home-mascot, .home-greeting, .home-stats, [data-saved], .home-library-sheet').count(), 0, 'Saved lessons live on Profile');
    assert.equal(await page.locator('.home-leaderboard').count(), 1, 'Leaderboard lives on Home');
    await layout();
    await page.screenshot({ path: `artifacts/home-${name}.png` });

    await page.getByRole('button', { name: 'Edit daily goal' }).click();
    await page.getByRole('radio', { name: '10 XP 1 new lesson', exact: true }).check();
    await settled('.home-goal-sheet');
    await page.screenshot({ path: `artifacts/home-goal-${name}.png` });
    await page.getByRole('button', { name: 'Save goal', exact: true }).click();
    assert.equal((await stored()).dailyGoal, 10);
    assert.equal(await page.locator('[data-goal-title]').textContent(), 'Earn 10 XP');
    // The sheet plays its exit before closing; focus then returns to the goal ring.
    await page.waitForFunction(() => !document.querySelector('.home-goal-sheet').open && document.activeElement?.matches('[data-goal]'));
    await page.getByRole('button', { name: 'Edit daily goal' }).click();
    await page.getByRole('radio', { name: '30 XP 3 new lessons', exact: true }).check();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.home-goal-sheet').open);
    assert.equal((await stored()).dailyGoal, 10);
    await page.reload({ waitUntil: 'load' });
    assert.equal(await page.locator('[data-goal-title]').textContent(), 'Earn 10 XP');

    await page.locator('.home-strip-card[href="#/feed/roundabout"]').click();
    await page.locator('.is-current [data-play]').click();
    await page.goto(`${base}#/feed/roundabout/quiz`);
    await page.locator('[data-answer="0"]').click();
    await page.locator('[data-continue]').click();
    await home();
    assert.equal(await page.locator('[data-completed]').innerText(), `1 of ${TOTAL} done`);
    assert.equal(await page.locator('[data-goal-title]').textContent(), 'Goal reached. Nice work!');
    assert.equal(await page.locator('.home-strip-card.is-done').count(), 1);
    assert.equal(await page.locator('[data-streak]').innerText(), '1-day streak');
    assert.equal(await page.locator('.home-week-bars .is-today .home-sr-only').innerText().then(text => text.endsWith(': 10 XP')), true);
    await page.screenshot({ path: `artifacts/home-progress-${name}.png` });

    for (const title of ['Practice', 'Progress', 'Profile']) {
      await nav().getByRole('link', { name: title, exact: true }).click();
      if (title === 'Practice') await page.locator('#practice-title').waitFor();
      else if (title === 'Progress') await page.locator('.path-lessons').waitFor();
      else await page.locator('.profile-identity').waitFor();
      assert.equal(await nav().locator('[aria-current="page"]').innerText(), title);
    }
    await page.goBack();
    await page.getByRole('main', { name: 'Progress', exact: true }).waitFor();
    await page.goForward();
    await page.getByRole('main', { name: 'Profile', exact: true }).waitFor();
    await nav().getByRole('link', { name: 'Home', exact: true }).click();
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('navigation', { name: 'Menu', exact: true }).getByRole('link', { name: 'Home', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.home-menu-sheet').open);
    await nav().getByRole('link', { name: 'Practice', exact: true }).click();
    await page.getByRole('link', { name: 'Start test', exact: true }).click();
    await page.locator('#pt-question').waitFor();
    await page.getByRole('button', { name: 'Leave practice test' }).click();
    await nav().getByRole('link', { name: 'Home', exact: true }).click();
    if (name === 'portrait') {
      await page.goto(`${base}#/drive`);
      await page.locator('#exit').click();
      await page.locator('.home-live').waitFor();
      assert.equal(await page.evaluate(() => getComputedStyle(document.body).touchAction), 'auto');
      await layout();
      await page.screenshot({ path: 'artifacts/home-after-simulator.png' });
    }
    const beforeOffline = await stored();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    });
    await context.setOffline(true);
    await page.reload({ waitUntil: 'load' });
    await page.locator('.home-week').waitFor();
    assert.equal(await page.locator('[data-goal-title]').textContent(), 'Goal reached. Nice work!');
    await layout();
    await page.getByRole('link', { name: 'Continue lesson: Scanning Ahead for Lane-End Warnings', exact: true }).click();
    await page.locator('.is-current [data-play]').click();
    assert.match(page.url(), /feed\/lane-end-scan$/);
    await page.locator('.is-current').getByRole('link', { name: 'Back to home' }).click();
    assert.deepEqual(await stored(), beforeOffline);
    await context.setOffline(false);

    await page.evaluate(ids => {
      const state = JSON.parse(localStorage.getItem('roadloop-progress'));
      for (const id of [...ids, 'yellow-light']) state.clips[id] = { done: true, firstTry: true, tries: 1 };
      state.xp = 20;
      localStorage.setItem('roadloop-progress', JSON.stringify(state));
    }, VIDEO_IDS);
    await page.reload({ waitUntil: 'load' });
    assert.equal(await page.locator('.home-sign-face').getAttribute('href'), '#/feed/four-way-stop');
    await layout();
    await page.screenshot({ path: `artifacts/home-long-title-${name}.png` });
    await page.evaluate(ids => {
      const state = JSON.parse(localStorage.getItem('roadloop-progress'));
      for (const id of [...ids, 'yellow-light', 'roundabout', 'four-way-stop', 'following-distance', 'school-bus']) state.clips[id] = { done: true, firstTry: true, tries: 1 };
      state.xp = 50;
      state.dailyGoal = 50;
      localStorage.setItem('roadloop-progress', JSON.stringify(state));
    }, VIDEO_IDS);
    await page.reload({ waitUntil: 'load' });
    assert.equal(await page.locator('[data-completed]').innerText(), `${TOTAL} of ${TOTAL} done`);
    assert.equal(await page.locator('.home-strip-card.is-done').count(), TOTAL);
    assert.equal(await page.locator('.home-strip-next').count(), 0);
    assert.equal(await page.locator('.home-sign-face').getAttribute('href'), '#/practice');
    assert.equal(await page.locator('[data-goal-title]').textContent(), 'You’re caught up');
    await page.screenshot({ path: `artifacts/home-complete-${name}.png` });
    await page.locator('.home-preview').evaluate(el => { el.scrollTop = el.scrollHeight; });
    await page.screenshot({ path: `artifacts/home-shortcuts-${name}.png` });
    const last = await page.locator('.home-leaderboard').boundingBox();
    const bar = await nav().boundingBox();
    assert.ok(last.y + last.height <= bar.y, 'Leaderboard scrolls clear of navigation');
    assert.deepEqual(failed.filter(url => !url.includes('/videos/')), []);
    assert.deepEqual(problems.filter(problem => !/^Failed to load resource/.test(problem)), []);
    console.log(`${name}: signpost, week row, lesson strip, goal/menu sheets, leaderboard placement, quiz return, practice, navigation, completion, layout and offline passed.`);
    await context.close();
  }
} finally { await browser.close(); }
