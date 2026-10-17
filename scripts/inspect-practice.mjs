import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/Users/hamza/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  headless: true,
});
const base = process.env.BASE ?? 'http://127.0.0.1:4173/';
await fs.mkdir('artifacts', { recursive: true });
try {
  for (const [name, viewport] of Object.entries({ portrait: { width: 390, height: 844 }, narrow: { width: 320, height: 740 }, landscape: { width: 844, height: 390 } })) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const problems = [];
    page.on('pageerror', error => problems.push(error.message));
    page.on('console', message => { if (message.type() === 'error') problems.push(message.text()); });
    const shot = file => page.screenshot({ path: `artifacts/practice-${file}-${name}.png`, fullPage: true });
    const noSideScroll = () => page.locator('.home-phone').evaluate(el => el.scrollWidth <= el.clientWidth);
    const saved = () => page.evaluate(() => localStorage.getItem('roadloop-progress'));

    await page.goto(`${base}#/practice`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const initialProgress = await saved();
    await page.getByRole('heading', { name: 'Practice', level: 1 }).waitFor();
    assert.equal(await page.getByRole('navigation', { name: 'Main navigation' }).locator('[aria-current="page"]').innerText(), 'Practice');
    assert.ok(await noSideScroll());
    await shot('tab');

    await page.getByRole('link', { name: 'Start test' }).click();
    await page.waitForURL(/#\/practice\/test$/);
    await page.locator('#pt-question').waitFor();
    assert.equal(await page.getByRole('navigation', { name: 'Main navigation' }).count(), 0, 'The test hides app navigation');
    assert.equal(await page.locator('.pt-count').innerText(), '1 / 46');
    const submit = page.getByRole('button', { name: 'Submit answer' });
    assert.equal(await submit.isDisabled(), true);
    await shot('question');

    // Leaving before any answer needs no confirmation.
    await page.getByRole('button', { name: 'Leave practice test' }).click();
    await page.waitForURL(/#\/practice$/);
    await page.getByRole('link', { name: 'Start test' }).click();

    // Q1 right (c), Q2 wrong (a, sign question), then answer the rest with the first choice.
    await page.getByRole('radio', { name: '3 seconds' }).check();
    await submit.click();
    await page.getByText('Correct', { exact: true }).waitFor();
    assert.equal(await page.locator('.pt-option.is-right').count(), 1);
    assert.equal(await page.getByRole('radio').first().isDisabled(), true, 'Submitted answers are locked');
    await shot('correct');
    await page.waitForTimeout(450); // Next ignores taps within 400 ms of Submit (double-tap guard).
    await page.getByRole('button', { name: 'Next question' }).click();
    await page.locator('.pt-sign img').evaluate(img => img.complete || new Promise(resolve => img.addEventListener('load', resolve, { once: true })));
    assert.ok(await page.locator('.pt-sign img').evaluate(img => img.naturalWidth > 0), 'Sign artwork loads');
    await page.getByRole('radio').first().check();
    await page.getByRole('button', { name: 'Submit answer' }).click();
    await page.getByText('Not quite.').waitFor();
    assert.equal(await page.locator('.pt-option.is-wrong').count(), 1);
    assert.equal(await page.locator('.pt-option.is-right').count(), 0, 'The key is not revealed mid-test');
    await shot('sign-wrong');

    // Mid-test exit asks first; "Keep going" stays on the same question.
    await page.getByRole('button', { name: 'Leave practice test' }).click();
    await page.getByRole('heading', { name: 'Leave the practice test?' }).waitFor();
    await shot('leave-dialog');
    await page.getByRole('button', { name: 'Keep going' }).click();
    assert.match(page.url(), /#\/practice\/test$/);
    assert.equal(await page.locator('.pt-count').innerText(), '2 / 46');

    await page.waitForTimeout(450);
    await page.getByRole('button', { name: 'Next question' }).click();
    for (let i = 3; i <= 46; i++) {
      assert.equal(await page.locator('.pt-count').innerText(), `${i} / 46`);
      await page.getByRole('radio').first().check();
      await page.getByRole('button', { name: 'Submit answer' }).click();
      await page.waitForTimeout(450);
      await page.getByRole('button', { name: i === 46 ? 'See results' : 'Next question' }).click();
    }
    await page.getByRole('heading', { name: 'Your results' }).waitFor();
    assert.match(await page.locator('.pt-score').innerText(), /of 46 correct/);
    assert.ok(await noSideScroll());
    await shot('results');

    await page.getByRole('button', { name: 'Start again' }).click();
    assert.equal(await page.locator('.pt-count').innerText(), '1 / 46');
    await page.reload({ waitUntil: 'load' });
    assert.equal(await page.locator('.pt-count').innerText(), '1 / 46', 'A reload starts a fresh attempt');
    assert.equal(await saved(), initialProgress, 'The practice test does not write lesson progress');
    assert.deepEqual(problems, []);
    console.log(`${name}: practice tab, start, locked answers, sign image, leave confirmation, all 46 questions, results, restart, and reload passed.`);
    await context.close();
  }
} finally { await browser.close(); }
