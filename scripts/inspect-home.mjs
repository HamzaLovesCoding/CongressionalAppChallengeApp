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
    const goalArea = () => page.locator('.home-goal-summary').innerText();
    // A first launch starts with onboarding: a required username and the Terms, then the main goal.
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForURL(/#\/welcome$/);
    await page.getByRole('heading', { name: 'Welcome to Lane', level: 1 }).waitFor();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    assert.match(await page.locator('[data-status]').innerText(), /Agree to the Terms/);
    await page.locator('.welcome-doc summary').first().click();
    assert.match(await page.locator('.welcome-doc').first().innerText(), /Never use Lane while driving/);
    await page.getByLabel('I agree to the Terms of Service and Privacy Policy.').check();
    if (name === 'portrait') await page.screenshot({ path: 'artifacts/onboarding-1.png', fullPage: true });
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    assert.match(await page.locator('[data-status]').innerText(), /Choose a username/, 'the username is required');
    await page.getByLabel('Username', { exact: true }).fill('Road_Runner');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('heading', { name: 'What’s your main goal?', level: 1 }).waitFor();
    await page.getByRole('button', { name: 'Start Lane', exact: true }).click();
    assert.match(await page.locator('[data-status]').innerText(), /Choose a goal/);
    await page.getByLabel('Prepare for the permit test, then for driving').check();
    if (name === 'portrait') await page.screenshot({ path: 'artifacts/onboarding-2.png', fullPage: true });
    await page.getByRole('button', { name: 'Start Lane', exact: true }).click();
    await page.locator('.home-live').waitFor();
    assert.ok(page.url().endsWith('#/home'));
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.getByRole('heading', { name:'Lane', exact:true }).count(), 1);
    assert.equal(await page.locator('.home-sign-face').getAttribute('href'), '#/feed/freeway-entry');
    assert.equal(await page.getByRole('link', { name: 'Start lesson: Entering a Freeway', exact: true }).count(), 1);
    assert.equal(await page.locator('.home-strip, .home-strip-card').count(), 0, 'the lesson strip is gone (Progress lists every lesson)');
    assert.equal(await page.locator('.home-week-bars li').count(), 7);
    assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), '0');
    assert.match(await goalArea(), /0 out of 24 lessons completed/);
    assert.equal(await page.locator('[data-streak]').innerText(), 'Start a streak today');
    const fresh = await stored();
    assert.equal(fresh.xp ?? 0, 0); assert.deepEqual(Object.keys(fresh.clips ?? {}), [], 'onboarding writes no progress');
    assert.equal(fresh.settings.goal, 'permit'); assert.ok(fresh.settings.termsAcceptedAt); assert.equal(fresh.settings.displayAlias, 'Road_Runner');
    assert.match(await goalArea(), /Permit test readiness\s+All time\s+0\s*\/ 100\s+Needs Foundation/);
    assert.equal(await page.locator('.home-goal-summary').getAttribute('href'), '#/review');
    assert.equal(await page.locator('.home-goal-sheet, [data-goal]').count(), 0, 'the daily XP goal editor is gone');
    assert.equal(await page.locator('.home-mascot, .home-greeting, .home-stats, [data-saved], .home-library-sheet').count(), 0, 'Saved lessons live on Profile');
    assert.equal(await page.locator('.home-leaderboard').count(), 1, 'Leaderboard lives on Home');
    await layout();
    await page.screenshot({ path: `artifacts/home-${name}.png` });

    // Roundabout is a text lesson; going straight to its check returns to Home afterwards.
    await page.goto(`${base}#/feed/roundabout`);
    await page.locator('.is-current [data-post-choice]').first().waitFor();
    await page.goto(`${base}#/feed/roundabout/quiz`);
    await page.locator('[data-answer="0"]').click();
    await page.locator('[data-continue]').click();
    await home();
    assert.match(await goalArea(), /Permit test readiness\s+All time\s+[1-9]\d*\s*\/ 100/, 'a right answer raises readiness');
    assert.equal(await page.locator('[data-streak]').innerText(), '1-day streak');
    assert.equal(await page.locator('.home-week-bars .is-today.is-done').count(), 1);
    assert.match(await goalArea(), /1 out of 24 lessons completed/);
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
    assert.equal(await page.locator('[data-menu]').count(), 0, 'Home has no gear; Settings is a card on Profile');
    await nav().getByRole('link', { name: 'Profile', exact: true }).click();
    await page.getByRole('navigation', { name: 'Settings and credits', exact: true }).getByRole('link', { name: /^Settings/ }).click();
    await page.getByRole('heading', { name: 'Settings', level: 1 }).waitFor();
    // Settings changes the main goal, and Home rewords the readiness goal to match.
    await page.getByLabel('Sharpen my driving skills and learn safer habits').check();
    await page.getByRole('button', { name: 'Save goal', exact: true }).click();
    assert.equal(await page.locator('[data-goal-status]').innerText(), 'Saved.');
    if (name === 'narrow') await page.screenshot({ path: 'artifacts/settings-goal-narrow.png', fullPage: true });
    await page.goto(`${base}#/home`); await page.locator('.home-live').waitFor();
    assert.match(await goalArea(), /Driver readiness score\s+All time\s+\d+\s*\/ 100\s+(Learner|Class [A-C]\+?)/);
    await page.goto(`${base}#/settings`); await page.getByLabel('Prepare for the permit test, then for driving').check();
    await page.getByRole('button', { name: 'Save goal', exact: true }).click();
    await page.goto(`${base}#/home`);
    await page.locator('.home-live').waitFor();
    await nav().getByRole('link', { name: 'Practice', exact: true }).click();
    await page.getByRole('link', { name: 'Start test', exact: true }).click();
    await page.locator('#pt-question').waitFor();
    await page.getByRole('button', { name: 'Leave practice test' }).click();
    await nav().getByRole('link', { name: 'Home', exact: true }).click();
    if (name === 'portrait') {
      // A challenge runs inside the feed; leaving it must not leave the page locked.
      await page.goto(`${base}#/feed/sim/four-way-stop`);
      await page.locator('.is-current [data-sim-start]').click();
      await page.locator('[data-exit]').waitFor({ timeout: 30000 });
      await page.goto(`${base}#/home`);
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
    assert.match(await goalArea(), /Permit test readiness/);
    await layout();
    // Home names the lesson the learner will resume (the shared resume point), and opens exactly it.
    const sign = page.locator('.home-sign-face');
    const resume = await sign.getAttribute('href');
    assert.match(await sign.getAttribute('aria-label'), /^Continue lesson: /);
    await sign.click();
    await page.locator('.is-current [data-play]').click();
    assert.ok(page.url().endsWith(resume), `${page.url()} opens ${resume}`);
    await page.locator('.is-current').getByRole('link', { name: 'Back to home' }).click();
    // Opening a lesson updates only the resume point; no progress changes offline.
    const { position: _after, ...after } = await stored(), { position: _before, ...before } = beforeOffline;
    assert.deepEqual(after, before);
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
      state.settings = { ...state.settings, goal: 'driver' };
      localStorage.setItem('roadloop-progress', JSON.stringify(state));
    }, VIDEO_IDS);
    await page.reload({ waitUntil: 'load' });
    assert.equal(await page.locator('.home-sign-face').getAttribute('href'), '#/practice');
    assert.match(await goalArea(), /Driver readiness score\s+All time\s+\d+\s*\/ 100\s+(Learner|Class [A-C]\+?)/, 'the driver goal shows a score out of 100 and its class');
    await page.screenshot({ path: `artifacts/home-complete-${name}.png` });
    await page.locator('.home-preview').evaluate(el => { el.scrollTop = el.scrollHeight; });
    await page.screenshot({ path: `artifacts/home-shortcuts-${name}.png` });
    const last = await page.locator('.home-leaderboard').boundingBox();
    const bar = await nav().boundingBox();
    assert.ok(last.y + last.height <= bar.y, 'Leaderboard scrolls clear of navigation');
    assert.deepEqual(failed.filter(url => !url.includes('/videos/')), []);
    assert.deepEqual(problems.filter(problem => !/^Failed to load resource/.test(problem)), []);
    console.log(`${name}: signpost, week row, onboarding, readiness goal, no gear (Settings via Profile), leaderboard placement, quiz return, practice, navigation, completion, layout and offline passed.`);
    await context.close();
  }
} finally { await browser.close(); }
