// Verify the round UI against real saved progress, including retries and offline replays.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/Users/hamza/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const base = process.env.BASE ?? 'http://localhost:4173/';

// Curriculum video lesson: collapsed California rule, details sheet, playback, the real `ended` event
// opening the quiz, the handbook citation, and offline replay from the watched-video cache.
async function videoLesson(name, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', error => problems.push(error.message));
  page.on('console', message => { if (message.type() === 'error') problems.push(`${message.text()} ${message.location().url ?? ''}`.trim()); });
  const shot = async label => { await page.waitForTimeout(500); await page.screenshot({ path: `artifacts/video-${label}-${name}.png` }); };
  await page.goto(`${base}#/feed`, { waitUntil: 'load' });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
  });
  await page.reload({ waitUntil: 'load' });
  assert.match(page.url(), /feed\/lane-end-scan$/, 'A new learner starts on curriculum lesson 1');
  assert.equal(await page.locator('.lane-clip').count(), 24);
  assert.equal(await page.locator('.lane-clip.has-video video[data-src][data-poster]').count(), 19, 'Every video lesson has a source and a poster');
  // Only the current clip, the next one and the one after attach a source on lesson 1, and the
  // neighbors only once the current clip can play.
  await page.waitForFunction(() => document.querySelectorAll('.lane-clip video[src]').length === 3);
  assert.deepEqual(await page.locator('.lane-clip video[src]').evaluateAll(list => list.map(media => media.closest('.lane-clip').dataset.clip)), ['lane-end-scan', 'after-collision', 'emergency-kit']);
  const current = page.locator('.is-current');
  await current.locator('video').evaluate(media => new Promise(resolve => media.readyState >= 2 ? resolve() : media.addEventListener('loadeddata', resolve, { once: true })));
  assert.equal(await current.locator('video').evaluate(media => media.videoHeight > media.videoWidth), true, 'Clips are vertical');
  assert.equal(await current.locator('.lane-rule').getAttribute('open'), null);
  assert.equal(await current.locator('.lane-rule-content').isVisible(), false);
  assert.equal(await current.locator('.lane-rail button').count(), 3);
  assert.equal(await page.locator('[data-sound]').count(), 0);
  assert.match(await current.locator('.lane-scroll-time').innerText(), /^\d{2}:\d{2}$/);
  const meta = await current.locator('.lane-meta').boundingBox();
  assert.ok(meta.height < viewport.height * .4, 'Collapsed metadata leaves most of the video visible');
  assert.deepEqual(await page.locator('.lane-clip:not(.is-current) video[src]').evaluateAll(list => list.map(media => media.preload)), ['auto', 'metadata'], 'The next clip buffers; the one after loads its header');
  await shot('feed');

  await current.locator('.lane-rule summary').click();
  assert.equal(await current.locator('.lane-rule-content').isVisible(), true);
  assert.match(await current.locator('.lane-rule-content').innerText(), /10 seconds ahead[\s\S]*p\. 44/i);
  await page.waitForFunction(() => document.querySelector('.is-current video').paused);
  const ruleBox = await current.locator('.lane-rule-content').boundingBox();
  assert.ok(ruleBox.y >= 0 && ruleBox.y + ruleBox.height <= viewport.height, 'Expanded rule stays within the screen');
  await shot('rule');

  await current.locator('[data-about]').click();
  const about = page.locator('.lane-about[open]');
  await about.waitFor();
  assert.equal(await current.locator('video').evaluate(media => media.paused), true, 'Details pause the clip');
  assert.match(await about.innerText(), /California rule[\s\S]*p\. 44[\s\S]*Novato[\s\S]*How to Navigate and be Aware of Hazards and Changes/i);
  assert.equal(await about.locator('a').getAttribute('href'), 'https://www.youtube.com/shorts/Y_WfR2eIQHo');
  await shot('about');
  await page.keyboard.press('Escape');
  await page.locator('.lane-about:not([open])').waitFor({ state: 'attached' });
  assert.equal(await current.locator('video').evaluate(media => media.paused), true, 'Rule stays paused after closing details');
  await current.locator('.lane-rule summary').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !document.querySelector('.is-current video').paused);
  assert.equal(await current.locator('.lane-rule-content').isVisible(), false, 'Rule closes with the keyboard');

  await current.locator('video').evaluate(media => { media.currentTime = Math.max(0, media.duration - .4); });
  await page.locator('.lane-sheet[aria-hidden="false"]').waitFor({ timeout: 12000 });
  await page.locator('[data-answer="1"]').click();
  assert.match(await page.locator('.lane-feedback').innerText(), /Nailed it[\s\S]*DL 600X, 2025/);
  await shot('quiz');
  await page.waitForFunction(async () => !!(await (await caches.open('amber-videos-h264')).match(new URL('videos/lane-end-scan.mp4', location.href).href)), null, { timeout: 30000 });

  await context.setOffline(true);
  await page.goto(`${base}#/feed/lane-end-scan`, { waitUntil: 'load' });
  await page.reload({ waitUntil: 'load' });
  const offline = page.locator('.is-current video');
  await offline.evaluate(media => new Promise((resolve, reject) => { if (media.readyState >= 2) resolve(); media.addEventListener('loadeddata', resolve, { once: true }); media.addEventListener('error', () => reject(new Error('offline video failed')), { once: true }); }));
  await page.waitForFunction(() => document.querySelector('.is-current video').currentTime > .3, null, { timeout: 10000 });
  assert.equal(await offline.getAttribute('src'), 'videos/lane-end-scan.mp4', 'Watched clip replays offline');
  assert.deepEqual(problems.filter(problem => !/Failed to load resource/.test(problem)), []);
  console.log(`${name}: video lesson dropdown, details, playback, ended → quiz, citation and offline replay passed.`);
  await context.close();
}

try {
  for (const [name, viewport] of Object.entries({ portrait: { width: 390, height: 844 }, landscape: { width: 844, height: 390 } })) {
    if (process.argv[2] && process.argv[2] !== name) continue;
    await videoLesson(name, viewport);
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: name === 'portrait' ? 'light' : 'dark' });
    const page = await context.newPage();
    const problems = [];
    page.on('pageerror', error => problems.push(error.message));
    page.on('console', message => { if (message.type() === 'error') problems.push(`${message.text()} ${message.location().url ?? ''}`.trim()); });
    const shot = async label => {
      await page.waitForTimeout(500);
      await page.screenshot({ path: `artifacts/game-${label}-${name}.png` });
    };
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('roadloop-progress')));
    await page.goto(`${base}#/feed/yellow-light`, { waitUntil: 'load' });
    await page.locator('.is-current [data-play]').click();
    await page.evaluate(() => document.fonts.ready);
    await shot('feed');
    assert.equal(await page.locator('.is-current .lane-rail button').count(), 3);
    assert.match(await page.locator('.is-current').innerText(), /^\d+:\d+\s+signals\s+When the light turns yellow$/i);
    const seconds = async () => (await page.locator('.is-current time').innerText()).split(':').reduce((total, part) => total * 60 + Number(part), 0);
    const started = await seconds();
    await page.waitForTimeout(1100);
    assert.ok(await seconds() > started, 'Scrolling timer keeps counting while playback is paused');
    for (const kind of ['like', 'save']) {
      await page.locator(`.is-current [data-${kind}]`).click();
      assert.equal(await page.locator(`.is-current [data-${kind}]`).getAttribute('aria-pressed'), 'true');
    }
    await page.evaluate(() => Object.defineProperty(navigator, 'share', { configurable: true, value: async data => { window.sharedLesson = data; } }));
    await page.locator('.is-current [data-share]').click();
    assert.match((await page.evaluate(() => window.sharedLesson)).url, /#\/feed\/yellow-light$/);
    const beforeScroll = await seconds();
    await page.locator('.lane-feed').evaluate(el => el.scrollTo({ top: el.querySelector('[data-clip="roundabout"]').offsetTop, behavior: 'instant' }));
    await page.waitForURL(/feed\/roundabout$/);
    assert.ok(await seconds() >= beforeScroll, 'Changing lessons does not reset the scrolling timer');
    await page.locator('.lane-feed').evaluate(el => el.scrollTo({ top: el.querySelector('[data-clip="yellow-light"]').offsetTop, behavior: 'instant' }));
    await page.waitForURL(/feed\/yellow-light$/);
    await page.reload({ waitUntil: 'load' });
    await page.locator('.is-current [data-play]').click();
    for (const kind of ['like', 'save']) {
      assert.equal(await page.locator(`.is-current [data-${kind}]`).getAttribute('aria-pressed'), 'true', `${kind} survives reload`);
      await page.locator(`.is-current [data-${kind}]`).click();
      assert.equal(await page.locator(`.is-current [data-${kind}]`).getAttribute('aria-pressed'), 'false');
    }
    assert.equal(await seconds(), 0, 'A fresh visit resets the scrolling timer');
    await page.locator('.is-current [data-play]').click();
    await shot('playing');
    await page.locator('.lane-sheet[aria-hidden="false"]').waitFor({ timeout: 12000 });
    assert.match(await page.locator('.lane-checkpoints').getAttribute('aria-label'), /0 of 2/);
    await shot('quiz');
    await page.locator('[data-answer="0"]').click();
    assert.match(await page.locator('.lane-feedback').innerText(), /Keep going/);
    await page.locator('[data-answer="1"]').click();
    assert.match(await page.locator('.lane-feedback').innerText(), /Nice recovery/);
    await shot('feedback');
    assert.equal((await stored()).xp, 0, 'No XP before the second check');
    await page.locator('[data-continue]').click();
    assert.match(await page.locator('.lane-checkpoints').getAttribute('aria-label'), /1 of 2/);
    await page.locator('[data-answer="1"]').click();
    await page.locator('[data-continue]').click();
    assert.match(await page.locator('.lane-round-stats').innerText(), /\+10/);
    assert.match(await page.locator('.lane-round-stats').innerText(), /1\s*\/\s*2/);
    assert.equal((await stored()).xp, 10);
    assert.equal((await stored()).clips['yellow-light'].firstTry, false);
    await page.waitForTimeout(800);
    await shot('cleared');
    await page.locator('[data-drive]').click();
    await page.locator('.experience[data-state="decision"]').waitFor({ timeout: 30000 });
    await shot('drive');
    await page.locator('#exit').click();
    assert.match(page.url(), /feed\/roundabout$/);
    await page.goto(`${base}#/lesson-progress`);
    assert.match(await page.locator('.lane-total-xp').innerText(), /10 XP/);
    assert.equal(await page.locator('.lane-route-stop.is-cleared').count(), 1);
    await shot('progress');
    // Reload through the service worker, then complete a one-question round offline.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    });
    await context.setOffline(true);
    await page.reload({ waitUntil: 'load' });
    await page.locator('.lane-route-stop[href="#/feed/roundabout"]').click();
    await page.locator('.lane-sheet[aria-hidden="false"]').waitFor({ timeout: 12000 });
    await page.locator('[data-answer="0"]').click();
    await page.locator('[data-continue]').click();
    assert.match(await page.locator('.lane-clear-kicker').innerText(), /ALL CHECKS COMPLETE/);
    assert.equal(await page.locator('[data-drive]').count(), 0);
    assert.equal((await stored()).xp, 20);
    await page.locator('[data-next]').click();
    await page.waitForURL(/feed\/four-way-stop$/);
    assert.match(page.url(), /feed\/four-way-stop$/);
    await page.goto(`${base}#/feed/yellow-light/quiz`, { waitUntil: 'load' });
    await page.locator('[data-answer="1"]').click();
    await page.locator('[data-continue]').click();
    await page.locator('[data-answer="1"]').click();
    await page.locator('[data-continue]').click();
    assert.match(await page.locator('.lane-round-stats').innerText(), /PRACTICE COMPLETE/);
    assert.doesNotMatch(await page.locator('.lane-round-stats').innerText(), /\+10/);
    assert.equal((await stored()).xp, 20, 'Replays must not award duplicate XP');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.lane-clear-emblem>div').evaluate(el => getComputedStyle(el).animationName), 'none');
    // Offline, a neighboring lesson video that was never watched can't preload; the feed retries it after
    // the next swipe, but the browser still logs the failed request.
    assert.deepEqual(problems.filter(problem => !/^Failed to load resource: .*\/videos\/[\w-]+\.mp4$/.test(problem)), []);
    console.log(`${name}: timed finish, retries, checkpoints, actual XP, simulator return, route map, offline round, replay, and reduced motion passed.`);
    await context.close();
  }
} finally { await browser.close(); }
