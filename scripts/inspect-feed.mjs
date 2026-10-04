// Verify the round UI against real saved progress, including retries and offline replays.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/Users/hamza/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const base = process.env.BASE ?? 'http://localhost:4173/';
try {
  for (const [name, viewport] of Object.entries({ portrait: { width: 390, height: 844 }, landscape: { width: 844, height: 390 } })) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: name === 'portrait' ? 'light' : 'dark' });
    const page = await context.newPage();
    const problems = [];
    page.on('pageerror', error => problems.push(error.message));
    page.on('console', message => { if (message.type() === 'error') problems.push(message.text()); });
    const shot = async label => {
      await page.waitForTimeout(500);
      await page.screenshot({ path: `artifacts/game-${label}-${name}.png` });
    };
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('roadloop-progress')));
    await page.goto(base, { waitUntil: 'load' });
    await page.locator('.is-current [data-play]').click();
    await page.evaluate(() => document.fonts.ready);
    await shot('feed');
    await page.locator('.is-current [data-play]').click();
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
    await page.locator('.is-current .lane-position').click();
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
    assert.match(await page.locator('.lane-clear-kicker').innerText(), /CLEAN RUN/);
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
    assert.deepEqual(problems, []);
    console.log(`${name}: timed finish, retries, checkpoints, actual XP, simulator return, route map, offline round, replay, and reduced motion passed.`);
    await context.close();
  }
} finally { await browser.close(); }
