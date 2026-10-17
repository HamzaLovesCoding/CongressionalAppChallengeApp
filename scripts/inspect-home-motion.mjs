import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
// Onboarding is covered by inspect-home.mjs; this walkthrough starts as a learner who finished it.
// Gesture physics on Home with motion enabled: sheet drag/flick/rubber-band/interrupt.
const base = process.env.BASE ?? 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/Users/hamza/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
await fs.mkdir('artifacts', { recursive: true });
const offset = page => page.locator('.home-menu-sheet .home-sheet-panel').evaluate(panel => new DOMMatrix(getComputedStyle(panel).transform).m42);
const isOpen = page => page.locator('.home-menu-sheet').evaluate(dialog => dialog.open);
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await context.addInitScript((() => { if (!localStorage.getItem('roadloop-progress')) localStorage.setItem('roadloop-progress', JSON.stringify({ settings: { onboardedAt: '2026-10-16T00:00:00.000Z', termsAcceptedAt: '2026-10-16T00:00:00.000Z', goal: 'other' } })); }));
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', error => problems.push(error.message));
  page.on('console', message => { if (message.type() === 'error') problems.push(message.text()); });
  await page.goto(`${base}#/home`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('roadloop-progress', JSON.stringify({ xp: 20, clips: { 'lane-end-scan': { done: true, tries: 1, firstTry: true }, 'after-collision': { done: true, tries: 1, firstTry: true } }, daily: {}, liked: [], saved: [] })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  // Opens on a spring: offscreen first, then settled at rest.
  await page.locator('[data-menu]').click();
  const early = await offset(page);
  await page.waitForTimeout(700);
  assert.ok(early > 10, `starts below its resting place (${early})`);
  assert.equal(Math.round(await offset(page)), 0);
  const grab = await page.locator('.home-menu-sheet .home-sheet-grab').boundingBox();
  const x = grab.x + grab.width / 2, y = grab.y + grab.height / 2;

  // 1:1 tracking from the grab point, then a slow release short of halfway springs back open.
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x, y + 60, { steps: 6 });
  assert.ok(Math.abs(await offset(page) - 60) < 2, 'the sheet follows the pointer exactly');
  await page.waitForTimeout(200); // pause so the release carries no throw
  await page.mouse.up();
  await page.waitForTimeout(700);
  assert.equal(Math.round(await offset(page)), 0, 'a short, slow drag returns');
  assert.equal(await isOpen(page), true);

  // Pulling up meets resistance instead of a hard stop.
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x, y - 120, { steps: 8 });
  const pulled = await offset(page);
  assert.ok(pulled < 0 && pulled > -60, `rubber-bands past the top (${pulled})`);
  await page.mouse.up();
  await page.waitForTimeout(700);
  assert.equal(Math.round(await offset(page)), 0);

  // A quick, short flick closes it even though it travelled well under half its height.
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x, y + 30, { steps: 1 });
  await page.mouse.move(x, y + 90, { steps: 2 });
  await page.mouse.up();
  await page.waitForTimeout(900);
  assert.equal(await isOpen(page), false, 'a flick dismisses');
  assert.equal(await page.locator('[data-menu]').evaluate(el => el === document.activeElement), true, 'focus returns to the gear button');

  // A sheet caught mid-close follows the pointer instead of finishing its exit.
  await page.locator('[data-menu]').click();
  await page.waitForTimeout(700);
  await page.locator('.home-menu-sheet .home-sheet-close').click();
  await page.waitForTimeout(60);
  const caught = await offset(page);
  // Press the middle of the still-moving panel so the press can't miss it, then push it back up.
  const moving = await page.locator('.home-menu-sheet .home-sheet-panel').boundingBox();
  const cy = moving.y + Math.min(moving.height / 2, (844 - moving.y) / 2);
  await page.mouse.move(x, cy); await page.mouse.down();
  await page.mouse.move(x, cy - 160, { steps: 8 });
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.waitForTimeout(800);
  assert.ok(caught > 0, 'it was mid-flight when caught');
  assert.equal(await isOpen(page), true, 'catching and pushing it back up keeps it open');
  assert.equal(Math.round(await offset(page)), 0);
  await page.screenshot({ path: 'artifacts/home-sheet-motion.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  assert.equal(await isOpen(page), false, 'Escape plays the exit');

  assert.deepEqual(problems, []);
  console.log('sheet: spring open, 1:1 drag, return, rubber-band, flick dismiss, catch mid-close, Escape.');
  await context.close();
} finally { await browser.close(); }
