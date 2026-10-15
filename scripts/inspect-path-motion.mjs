import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { CAR_GAP } from '../src/progress/road.ts';
const base = process.env.BASE ?? 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/Users/hamza/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
await fs.mkdir('artifacts/design-rebuild', { recursive: true });
// Car height relative to the first two checkpoints, plus whether it is on screen above the navigation.
const car = page => page.evaluate(() => {
  const atlas = document.querySelector('.path-atlas').getBoundingClientRect();
  const [first, second] = [...document.querySelectorAll('[data-checkpoint]')].map(post => post.getBoundingClientRect().bottom - atlas.top);
  const y = Number(document.querySelector('.path-car').getAttribute('transform').match(/translate\([-\d.]+ ([-\d.]+)\)/)[1]);
  const box = document.querySelector('.path-car').getBoundingClientRect();
  return { y, first, second, visible: box.top >= 0 && box.bottom <= document.querySelector('.home-nav').getBoundingClientRect().top };
});
try {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ viewport:{ width:390,height:844 }, reducedMotion });
    await context.addInitScript(() => localStorage.setItem('roadloop-progress', JSON.stringify({xp:35,spentXp:35,ownedCars:['hatchback','pickup'],selectedCar:'pickup',clips:{},daily:{},liked:[],saved:[]})));
    const page = await context.newPage();
    await page.goto(`${base}#/progress`);
    await page.locator('.path-car [data-car-art="pickup"]').waitFor();
    // Lesson 1 is the first curriculum video lesson; its quick check is answer B.
    await page.goto(`${base}#/feed/lane-end-scan/quiz`);
    await page.locator('[data-answer="1"]').click();
    await page.locator('[data-continue]').click();
    await page.goto(`${base}#/progress`);
    await page.locator('.path-car [data-car-art="pickup"]').waitFor();
    assert.equal(await page.locator('.path-sign[aria-current]').getAttribute('data-lesson'), '1');
    const start = await car(page);
    if (reducedMotion === 'reduce') assert.ok(Math.abs(start.y - start.second - CAR_GAP) < 1, `Reduced motion places the car at once: ${JSON.stringify(start)}`);
    else {
      assert.ok(Math.abs(start.y - start.first - CAR_GAP) < 1, `The drive starts from the previous stop: ${JSON.stringify(start)}`);
      await page.waitForTimeout(800);
      const middle = await car(page);
      assert.ok(middle.y < start.y && middle.y > middle.second + CAR_GAP, `Mid-drive the car is between stops: ${JSON.stringify(middle)}`);
      assert.ok(middle.visible, 'The view follows the car');
      await page.screenshot({ path:'artifacts/design-rebuild/car-driving.png' });
    }
    await page.waitForTimeout(1300);
    const end = await car(page);
    assert.ok(Math.abs(end.y - end.second - CAR_GAP) < 1 && end.visible, `Car stops at the next lesson: ${JSON.stringify(end)}`);
    assert.match(await page.locator('.path-arrival').innerText(), /First checkpoint[\s\S]*10 XP earned/);
    assert.equal(await page.locator('.path-mile.is-earned').count(), 1);
    await page.screenshot({ path:`artifacts/design-rebuild/car-${reducedMotion}.png` });
    await context.close();
    console.log(`${reducedMotion}: completing the actual quiz moves the car to the next stop on ${base}.`);
  }
} finally { await browser.close(); }
