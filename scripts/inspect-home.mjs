import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/Users/hamza/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const base = process.env.BASE ?? 'http://127.0.0.1:4173/';
await fs.mkdir('artifacts', { recursive: true });
try {
  for (const [name, viewport] of Object.entries({ portrait: { width: 390, height: 844 }, narrow: { width: 320, height: 740 }, landscape: { width: 844, height: 390 }, desktop: { width: 1440, height: 1000 } })) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: name !== 'desktop', hasTouch: name !== 'desktop' });
    const page = await context.newPage();
    const problems = [];
    page.on('pageerror', error => problems.push(error.message));
    page.on('console', message => { if (message.type() === 'error') problems.push(message.text()); });
    const nav = () => page.getByRole('navigation', { name: 'Main navigation', exact: true });
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('roadloop-progress')));
    const home = async () => { await page.goto(`${base}#/home`); await page.locator('.home-live').waitFor(); };
    const layout = async () => {
      assert.ok(await page.locator('.home-phone').evaluate(el => el.scrollWidth <= el.clientWidth), 'No horizontal overflow');
      assert.ok(await page.locator('.home-content img').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0)));
      assert.ok(await page.locator('.home-live button, .home-live a').evaluateAll(elements => elements.filter(el => el.getClientRects().length).every(el => { const r = el.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })), 'Visible controls meet 44px target size');
    };
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('h1').innerText(), 'Ready for the road?');
    assert.equal(await page.locator('[data-xp]').innerText(), '0');
    assert.equal(await page.locator('[data-completed]').innerText(), '0 / 5');
    assert.equal(await page.locator('.home-continue').getAttribute('href'), '#/feed/yellow-light');
    assert.equal(await page.locator('.home-course-progress progress').evaluate(el => el.value), 0);
    assert.equal(await stored(), null, 'Opening home must not write progress');
    await layout();
    await page.screenshot({ path: `artifacts/home-${name}.png` });

    await page.getByRole('button', { name: 'Edit daily goal' }).click();
    await page.getByRole('radio', { name: '10 XP 1 new lesson', exact: true }).check();
    await page.screenshot({ path: `artifacts/home-goal-${name}.png` });
    await page.getByRole('button', { name: 'Save goal', exact: true }).click();
    assert.equal((await stored()).dailyGoal, 10);
    assert.equal(await page.locator('[data-goal-title]').innerText(), 'Earn 10 XP');
    assert.equal(await page.locator('[data-goal]').evaluate(el => el === document.activeElement), true);
    await page.getByRole('button', { name: 'Edit daily goal' }).click();
    await page.getByRole('radio', { name: '30 XP 3 new lessons', exact: true }).check();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal((await stored()).dailyGoal, 10);
    await page.reload({ waitUntil: 'load' });
    assert.equal(await page.locator('[data-goal-title]').innerText(), 'Earn 10 XP');

    await page.getByRole('button', { name: 'Saved lessons', exact: true }).click();
    assert.match(await page.locator('.home-library-dialog').innerText(), /Save a lesson/);
    await page.getByRole('link', { name: 'Explore lessons' }).click();
    await page.locator('.is-current [data-play]').click();
    await page.locator('.is-current [data-save]').click();
    await page.locator('.is-current').getByRole('link', { name: 'Back to home' }).click();
    await page.getByRole('button', { name: 'Saved lessons', exact: true }).click();
    await page.locator('.home-library-dialog a[href="#/feed/yellow-light"]').waitFor();
    await page.screenshot({ path: `artifacts/home-saved-${name}.png` });
    await page.getByRole('button', { name: 'Remove When the light turns yellow from saved lessons' }).click();
    assert.deepEqual((await stored()).saved, []);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Road lessons Choose a topic' }).click();
    assert.equal(await page.locator('.home-lesson-list a').count(), 5);
    await page.locator('.home-lesson-list a[href="#/feed/roundabout"]').click();
    await page.locator('.is-current [data-play]').click();
    await page.goto(`${base}#/feed/roundabout/quiz`);
    await page.locator('[data-answer="0"]').click();
    await page.locator('[data-continue]').click();
    await home();
    assert.equal(await page.locator('[data-xp]').innerText(), '10');
    assert.equal(await page.locator('[data-streak]').innerText(), '1');
    assert.equal(await page.locator('[data-completed]').innerText(), '1 / 5');
    assert.equal(await page.locator('[data-goal-title]').innerText(), 'Goal reached. Nice work!');
    assert.equal(await page.locator('.home-course-progress progress').evaluate(el => el.value), 1);
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
    assert.equal(await page.locator('.home-menu-dialog').evaluate(el => el.open), false);
    await page.getByRole('link', { name: 'Permit practice Try the written test' }).click();
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
    await page.locator('.home-mascot').waitFor();
    assert.equal(await page.locator('[data-xp]').innerText(), '10');
    assert.equal(await page.locator('[data-goal-title]').innerText(), 'Goal reached. Nice work!');
    await layout();
    await page.getByRole('link', { name: 'Continue lesson', exact: true }).click();
    await page.locator('.is-current [data-play]').click();
    assert.match(page.url(), /feed\/yellow-light$/);
    await page.locator('.is-current').getByRole('link', { name: 'Back to home' }).click();
    assert.deepEqual(await stored(), beforeOffline);
    await context.setOffline(false);

    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('roadloop-progress'));
      state.clips['yellow-light'] = { done: true, firstTry: true, tries: 1 };
      state.xp = 20;
      localStorage.setItem('roadloop-progress', JSON.stringify(state));
    });
    await page.reload({ waitUntil: 'load' });
    assert.equal(await page.locator('.home-continue').getAttribute('href'), '#/feed/four-way-stop');
    await layout();
    await page.screenshot({ path: `artifacts/home-long-title-${name}.png` });
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('roadloop-progress'));
      for (const id of ['yellow-light', 'roundabout', 'four-way-stop', 'following-distance', 'school-bus']) state.clips[id] = { done: true, firstTry: true, tries: 1 };
      state.xp = 50;
      state.dailyGoal = 50;
      localStorage.setItem('roadloop-progress', JSON.stringify(state));
    });
    await page.reload({ waitUntil: 'load' });
    assert.equal(await page.locator('[data-completed]').innerText(), '5 / 5');
    assert.equal(await page.locator('.home-course-progress progress').evaluate(el => el.value / el.max), 1);
    assert.equal(await page.locator('.home-continue').getAttribute('href'), '#/practice');
    assert.equal(await page.locator('[data-goal-title]').innerText(), 'You’re caught up');
    await page.screenshot({ path: `artifacts/home-complete-${name}.png` });
    await page.locator('.home-preview').evaluate(el => { el.scrollTop = el.scrollHeight; });
    await page.screenshot({ path: `artifacts/home-shortcuts-${name}.png` });
    const last = await page.locator('.home-shortcuts [data-saved]').boundingBox();
    const bar = await nav().boundingBox();
    assert.ok(last.y + last.height <= bar.y, 'Last shortcut scrolls clear of floating navigation');
    assert.deepEqual(problems, []);
    console.log(`${name}: real progress, goals, saved lessons, quiz return, practice, navigation, completion, layout and offline passed.`);
    await context.close();
  }
} finally { await browser.close(); }
