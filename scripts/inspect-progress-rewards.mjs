import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
// Onboarding is covered by inspect-home.mjs; this walkthrough starts as a learner who finished it.
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/Users/hamza/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
try {
  for (const [name, viewport] of Object.entries({ portrait:{width:390,height:844}, narrow:{width:320,height:740}, landscape:{width:844,height:390} })) {
    const context = await browser.newContext({ viewport, reducedMotion:'no-preference' });
    await context.addInitScript((() => { if (!localStorage.getItem('roadloop-progress')) localStorage.setItem('roadloop-progress', JSON.stringify({ settings: { onboardedAt: '2026-10-16T00:00:00.000Z', termsAcceptedAt: '2026-10-16T00:00:00.000Z', goal: 'other' } })); }));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4173/#/progress');
    const trigger = page.locator('.path-trophies');
    await trigger.click();
    await page.locator('.path-milestones[open]').waitFor();
    await page.waitForTimeout(650);
    assert.equal(await page.locator('.path-medals .is-earned').count(), 0);
    await page.screenshot({path:`artifacts/progress-milestones-${name}.png`});
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.path-milestones').open);
    assert.ok(await trigger.evaluate(el => el === document.activeElement));
    await page.goto('http://127.0.0.1:4173/#/feed/yellow-light/quiz');
    for (let i = 0; i < 2; i++) { await page.locator('[data-answer="1"]').click(); await page.locator('[data-continue]').click(); }
    await page.goto('http://127.0.0.1:4173/#/progress');
    await page.locator('.path-arrival.is-visible').waitFor();
    assert.match(await page.locator('.path-arrival').innerText(), /First checkpoint[\s\S]*10 XP earned/);
    assert.equal(await page.locator('.path-mile.is-earned').count(), 1);
    assert.equal(await page.locator('.path-meter').getAttribute('aria-valuenow'), '1');
    await page.screenshot({path:`artifacts/progress-reward-${name}.png`});
    await page.locator('.learning-path').evaluate(el => el.scrollTop = 0);
    // Find my car appears once the car leaves the visible road, pointing back down toward it.
    await page.locator('[data-locate][data-direction="down"]').waitFor();
    await page.locator('[data-locate]').click();
    await page.locator('[data-locate]').waitFor({ state:'hidden' });
    const visible = await page.evaluate(() => {
      const car = document.querySelector('.path-car').getBoundingClientRect();
      return car.top > document.querySelector('.path-dashboard').getBoundingClientRect().bottom && car.bottom < document.querySelector('.home-nav').getBoundingClientRect().top;
    });
    assert.ok(visible, 'Find my car returns to an unobscured car');
    await trigger.click();
    await page.waitForTimeout(650);
    assert.equal(await page.locator('.path-medals .is-earned').count(), 1);
    await page.screenshot({path:`artifacts/progress-milestones-earned-${name}.png`});
    if (name === 'portrait') {
      const handle = await page.locator('.path-milestones .home-sheet-grab').boundingBox();
      await page.mouse.move(handle.x + 100, handle.y + 10);
      await page.mouse.down();
      await page.mouse.move(handle.x + 100, handle.y + 340, {steps:12});
      await page.mouse.up();
    } else await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.path-milestones').open);
    await page.goto('http://127.0.0.1:4173/#/home');
    await page.locator('.home-live').waitFor();
    await page.goto('http://127.0.0.1:4173/#/progress');
    await page.locator('.path-car').waitFor();
    assert.equal(await page.locator('.path-arrival.is-visible').count(), 0, 'Revisits do not repeat celebrations');
    assert.deepEqual(errors, []);
    console.log(`${name}: milestones, real completion reward, recenter, sheet dismissal and non-repeating celebration passed.`);
    await context.close();
  }
} finally { await browser.close(); }
