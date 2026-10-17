// Verify the round UI against real saved progress, including retries and offline replays.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { CLIPS } from '../src/feed/clips.ts';

const answerOf = id => CLIPS.find(clip => clip.id === id).answer;
// Finishes whatever check the planner chose for a lesson (quiz, flashcard or glossary term), plus the
// optional quick-recall card a "developing" score adds, and stops on the completion sheet.
async function completeCheck(page, id) {
  for (let step = 0; step < 8; step++) {
    if (await page.locator('.lane-sheet .lane-result').count()) return;
    if (await page.isVisible('.lane-sheet [data-recall-show]')) { await page.click('.lane-sheet [data-recall-show]'); continue; }
    if (await page.isVisible('.lane-sheet [data-recall-got]')) { await page.click('.lane-sheet [data-recall-got]'); continue; }
    if (await page.isVisible('.lane-sheet [data-glossary-got]')) { await page.click('.lane-sheet [data-glossary-got]'); continue; }
    if (await page.isVisible('.lane-sheet [data-continue]')) { await page.click('.lane-sheet [data-continue]'); continue; }
    const clip = CLIPS.find(entry => entry.id === id);
    const index = (await page.locator('.lane-checkpoints span.is-done').count()) ? clip.followUp.answer : clip.answer;
    await page.click(`.lane-sheet [data-answer="${index}"]`);
  }
  throw new Error('check did not complete for ' + id);
}

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
  assert.equal(await page.locator('[data-clip]').count(), 24, 'All 24 lessons are in a new learner\'s feed');
  assert.equal(await page.locator('[data-item="1"].lane-sim-card').count(), 1, 'Lesson 1 is followed by its challenge');
  assert.equal(await page.locator('.lane-clip.has-video video[data-src][data-poster]').count(), 19, 'Every video lesson has a source and a poster');
  // Only clips within two feed items ahead (and one behind) attach a source, and the neighbors only once
  // the current clip can play. Item 1 is lesson 1's challenge card, so lesson 2 (item 2) is the neighbor.
  await page.waitForFunction(() => document.querySelectorAll('.lane-clip video[src]').length === 2);
  assert.deepEqual(await page.locator('.lane-clip video[src]').evaluateAll(list => list.map(media => media.closest('.lane-clip').dataset.clip)), ['lane-end-scan', 'after-collision']);
  const current = page.locator('.is-current');
  await current.locator('video').evaluate(media => new Promise(resolve => media.readyState >= 2 ? resolve() : media.addEventListener('loadeddata', resolve, { once: true })));
  assert.equal(await current.locator('video').evaluate(media => media.videoHeight > media.videoWidth), true, 'Clips are vertical');
  assert.equal(await current.locator('.lane-rule').getAttribute('open'), null);
  assert.equal(await current.locator('.lane-rule-content').isVisible(), false);
  assert.deepEqual(await current.locator('.lane-rail button').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label'))), ['Like lesson', 'Comments', 'Save lesson', 'Share lesson'], 'heart, comments, bookmark, share');
  // Without a backend the comments sheet says so, and the lesson resumes when it closes.
  await current.locator('[data-comments]').click();
  assert.match(await page.locator('.lane-comments[open]').innerText(), /Comments are coming soon/);
  await page.locator('.lane-comments .lane-close').click();
  await page.waitForFunction(() => !document.querySelector('.lane-comments').open);
  await page.waitForTimeout(600);
  // The sound button sits beside the clip time, shows the real state (autoplay may start muted),
  // toggles it, and remembers the choice.
  const startedMuted = await current.locator('video').evaluate(media => media.muted);
  assert.equal(await current.locator('[data-sound]').getAttribute('aria-pressed'), String(startedMuted));
  if (!startedMuted) await current.locator('[data-sound]').click();
  assert.equal(await current.locator('video').evaluate(media => media.muted), true);
  assert.equal(await current.locator('[data-sound]').getAttribute('aria-label'), 'Turn sound on');
  await current.locator('[data-sound]').click();
  assert.equal(await current.locator('video').evaluate(media => media.muted), false, 'The button turns sound on');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('roadloop-progress')).soundOff), false);
  await current.locator('[data-sound]').click();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('roadloop-progress')).soundOff), true, 'Muting is remembered');
  await current.locator('[data-sound]').click();
  assert.match(await current.locator('.lane-scroll-time').innerText(), /^\d{2}:\d{2}$/, 'The corner timer shows time in the feed');
  const meta = await current.locator('.lane-meta').boundingBox();
  assert.ok(meta.height < viewport.height * .4, 'Collapsed metadata leaves most of the video visible');
  assert.deepEqual(await page.locator('.lane-clip:not(.is-current) video[src]').evaluateAll(list => list.map(media => media.preload)), ['metadata'], 'A clip two items ahead loads only its header');
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
  assert.equal(await about.locator('a[target="_blank"]').getAttribute('href'), 'https://www.youtube.com/shorts/Y_WfR2eIQHo');
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
  assert.match(await current.locator('.lane-scroll-time').innerText(), /^\d{2}:\d{2}$/, 'The feed timer keeps counting after the clip ends');
  await page.locator(`[data-answer="${answerOf('lane-end-scan')}"]`).click();
  assert.match(await page.locator('.lane-feedback').innerText(), /Nailed it[\s\S]*DL 600X, 2025[\s\S]*p\. 44/);
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
    // The yellow-light lesson has no video: it is a text post filled one blank at a time.
    await page.goto(`${base}#/feed/yellow-light`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await shot('feed');
    assert.deepEqual(await page.locator('.is-current .lane-rail button').evaluateAll(buttons => buttons.map(button => button.dataset.like ? 'like' : button.dataset.comments ? 'comments' : button.dataset.save ? 'save' : 'share')), ['like', 'comments', 'save', 'share'], 'text lessons have comments too');
    assert.equal(await page.locator('.is-current [data-play], .is-current time').count(), 0, 'A text lesson has no timer or play control');
    assert.match(await page.locator('.is-current .lane-post').innerText(), /FILL IN THE BLANKS[\s\S]*When the light turns yellow/i);
    for (const kind of ['like', 'save']) {
      await page.locator(`.is-current [data-${kind}]`).click();
      assert.equal(await page.locator(`.is-current [data-${kind}]`).getAttribute('aria-pressed'), 'true');
    }
    await page.evaluate(() => Object.defineProperty(navigator, 'share', { configurable: true, value: async data => { window.sharedLesson = data; } }));
    await page.locator('.is-current [data-share]').click();
    assert.match((await page.evaluate(() => window.sharedLesson)).url, /#\/feed\/yellow-light$/);
    // Swiping on with blanks still empty asks "Are you sure?" on an important lesson; Keep going stays.
    await page.locator('.lane-feed').evaluate(el => el.scrollTo({ top: el.querySelector('.is-current').offsetTop + el.querySelector('.is-current').offsetHeight, behavior: 'instant' }));
    assert.match(await page.locator('.lane-sheet[aria-hidden="false"] .lane-question').innerText(), /blanks/);
    await page.locator('.lane-sheet[aria-hidden="false"] [data-gate-stay]').click();
    assert.match(page.url(), /feed\/yellow-light$/);
    await page.goto(`${base}#/feed/roundabout`, { waitUntil: 'load' });
    await page.goto(`${base}#/feed/yellow-light`, { waitUntil: 'load' });
    // Reload only once yellow-light is on screen and the page transition has ended, or the reload can catch the previous lesson.
    await page.waitForFunction(() => document.querySelector('.is-current')?.dataset.clip === 'yellow-light' && !document.documentElement.dataset.nav && location.hash === '#/feed/yellow-light');
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('.is-current')?.dataset.clip === 'yellow-light');
    for (const kind of ['like', 'save']) {
      assert.equal(await page.locator(`.is-current [data-${kind}]`).getAttribute('aria-pressed'), 'true', `${kind} survives reload`);
      await page.locator(`.is-current [data-${kind}]`).click();
      assert.equal(await page.locator(`.is-current [data-${kind}]`).getAttribute('aria-pressed'), 'false');
    }
    // A wrong word is marked; the right word fills the blank and shows why; then the check opens.
    const yellow = CLIPS.find(clip => clip.id === 'yellow-light');
    for (const [i, step] of yellow.post.steps.entries()) {
      if (i === 0) {
        const wrong = (step.answer + 1) % step.choices.length;
        await page.locator(`.is-current [data-post-choice="${wrong}"]`).click();
        assert.ok(await page.locator(`.is-current [data-post-choice="${wrong}"].is-wrong`).count(), 'a wrong word is marked');
        assert.match(await page.locator('.is-current [data-post-status]').innerText(), /Not quite/);
      }
      await page.locator(`.is-current [data-post-choice="${step.answer}"]`).click();
    }
    assert.equal(await page.locator('.is-current .lane-post-steps li.is-filled').count(), yellow.post.steps.length);
    await shot('playing');
    await page.locator('.lane-sheet[aria-hidden="false"]').waitFor({ timeout: 12000 });
    assert.match(await page.locator('.lane-checkpoints').getAttribute('aria-label'), /0 of 2/);
    await shot('quiz');
    // A miss explains the rule, then asks a similar (not identical) question.
    await page.locator('[data-answer="0"]').click();
    assert.match(await page.locator('.lane-feedback').innerText(), /Almost\. Here is the rule/);
    await page.locator('[data-similar]').click();
    await page.locator('[data-answer="1"]').click();
    assert.match(await page.locator('.lane-feedback').innerText(), /Nice recovery/);
    await shot('feedback');
    assert.equal((await stored()).xp, 0, 'No XP before the second check');
    await page.locator('[data-continue]').click();
    assert.match(await page.locator('.lane-checkpoints').getAttribute('aria-label'), /1 of 2/);
    await page.locator('[data-answer="1"]').click();
    await completeCheck(page, 'yellow-light');
    assert.match(await page.locator('.lane-round-stats').innerText(), /\+10/);
    assert.match(await page.locator('.lane-round-stats').innerText(), /1\s*\/\s*2/);
    assert.equal((await stored()).xp, 10);
    assert.equal((await stored()).clips['yellow-light'].firstTry, false);
    await page.waitForTimeout(800);
    await shot('cleared');
    assert.match(await page.locator('.lane-sheet [data-next]').innerText(), /30-second challenge/);
    await page.locator('.lane-sheet [data-next]').click();
    await page.waitForURL(/feed\/sim\/yellow-light-stop$/);
    await page.locator('.is-current [data-sim-start]').click();
    await page.locator('[data-exit]').waitFor({ timeout: 30000 });
    await shot('simulation');
    await page.locator('[data-exit]').click();
    await page.locator('.is-current [data-sim-body]').waitFor({ state: 'visible' });
    assert.match(page.url(), /feed\/sim\/yellow-light-stop$/, 'Exit returns to the same feed position');
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
    await page.waitForURL(/feed\/roundabout$/);
    // The hash changes before the page transition starts, so wait for the feed itself to mount and the
    // transition to end; tapping mid-fade makes Playwright scroll the feed to retry, which reads as a swipe.
    await page.waitForFunction(() => document.querySelector('.lane-feed') && !document.documentElement.dataset.nav);
    for (const step of CLIPS.find(clip => clip.id === 'roundabout').post.steps) await page.locator(`.is-current [data-post-choice="${step.answer}"]`).click();
    await page.locator('.lane-sheet[aria-hidden="false"]').waitFor({ timeout: 12000 });
    await completeCheck(page, 'roundabout');
    assert.match(await page.locator('.lane-clear-kicker').innerText(), /ALL CHECKS COMPLETE/);
    assert.match(await page.locator('.lane-sheet [data-next]').innerText(), /30-second challenge/, 'roundabout is followed by its challenge');
    assert.equal((await stored()).xp, 20);
    await page.locator('[data-next]').click();
    await page.waitForURL(/feed\/sim\/roundabout-entry$/);
    // A repeat visit gets a lighter check chosen by topic mastery, and never a second 10 XP.
    await page.goto(`${base}#/feed/yellow-light/quiz`, { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelector('.lane-sheet[aria-hidden="false"] .lane-round-label')?.textContent.includes('LESSON 20') && !document.querySelector('.lane-sheet .lane-result'));
    await completeCheck(page, 'yellow-light');
    assert.match(await page.locator('.lane-round-stats').innerText(), /ALREADY EARNED/);
    assert.doesNotMatch(await page.locator('.lane-round-stats').innerText(), /\+10/);
    assert.equal((await stored()).xp, 20, 'Replays must not award duplicate XP');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.lane-clear-emblem>div').evaluate(el => getComputedStyle(el).animationName), 'none');
    // Offline, a neighboring lesson video that was never watched can't preload; the feed retries it after
    // the next swipe, but the browser still logs the failed request.
    assert.deepEqual(problems.filter(problem => !/^Failed to load resource: .*\/videos\/[\w-]+\.mp4$/.test(problem)), []);
    console.log(`${name}: timed finish, clip timer, "Are you sure?", checkpoints, actual XP, similar-question recovery, in-feed challenge and Exit, route map, offline round, repeat visit, and reduced motion passed.`);
    await context.close();
  }
} finally { await browser.close(); }
