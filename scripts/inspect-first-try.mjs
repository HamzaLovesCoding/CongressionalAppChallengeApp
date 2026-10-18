// Offline regression: each yellow-light check owns its first-try result; legal metadata agrees
// between onboarding and the standalone pages. Run with build:test + preview:test.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { CLIPS } from '../src/feed/clips.ts';
import { LEARNING } from '../src/content/learning.ts';

const base = process.env.BASE ?? 'http://127.0.0.1:4173/';
const out = 'artifacts/first-try';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const errors = [];
const yellow = CLIPS.find(clip => clip.id === 'yellow-light');
const sheet = '.lane-sheet[aria-hidden="false"]';
try {
  for (const [name, miss] of [['perfect', -1], ['first-missed', 0], ['second-missed', 1]]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    await context.route('https://*.supabase.co/**', route => { errors.push('Offline build attempted Supabase: ' + route.request().url()); return route.abort(); });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '#/feed/yellow-light/quiz');
    for (const [i, question] of [yellow, yellow.followUp].entries()) {
      await page.locator(`${sheet} [data-answer="${question.answer}"]`).waitFor();
      if (i === miss) {
        await page.click(`${sheet} [data-answer="${(question.answer + 1) % question.options.length}"]`);
        await page.click(`${sheet} [data-similar]`);
        await page.click(`${sheet} [data-answer="${LEARNING['yellow-light'].similar.answer}"]`);
        assert.match(await page.locator('.lane-feedback').innerText(), /Nice recovery/);
      } else {
        await page.click(`${sheet} [data-answer="${question.answer}"]`);
        assert.match(await page.locator('.lane-feedback').innerText(), /Nailed it\./);
      }
      await page.click(`${sheet} [data-continue]`);
    }
    if (await page.locator('[data-recall-show]').isVisible()) {
      await page.click('[data-recall-show]');
      await page.click('[data-recall-got]');
    }
    await page.locator(`${sheet} [data-next]`).waitFor();
    const stats = await page.locator('.lane-round-stats').innerText();
    assert.match(stats, miss < 0 ? /2\s*\/\s*2/ : /1\s*\/\s*2/);
    assert.equal(await page.locator('.lane-clear-kicker').innerText(), miss < 0 ? 'ALL CHECKS COMPLETE' : 'LESSON COMPLETE');
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('roadloop-progress')));
    assert.equal(state.xp, 10);
    await page.screenshot({ path: `${out}/${name}.png` });
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await context.route('https://*.supabase.co/**', route => { errors.push('Offline build attempted Supabase: ' + route.request().url()); return route.abort(); });
  const page = await context.newPage();
  await page.goto(base + '#/welcome');
  for (const detail of await page.locator('.welcome-doc').all()) {
    await detail.locator('summary').click();
    const text = await detail.innerText();
    for (const expected of ['Hamza Wadera', 'hamza.w.3790@gmail.com', 'October 18, 2026', 'Version 1.0']) assert.ok(text.includes(expected), expected);
    assert.doesNotMatch(text, /legal operator name to be added|Contact details will be added|0\.1 \(draft\)/);
    await detail.locator('summary').click();
  }
  await page.locator('.welcome-doc summary').first().click();
  await page.screenshot({ path: `${out}/onboarding-terms.png` });
  for (const route of ['terms', 'privacy']) {
    await page.goto(base + '#/' + route);
    assert.match(await page.locator('.legal-page').innerText(), /Version 1\.0 · Effective October 18, 2026/);
  }
  await context.close();
  assert.deepEqual(errors, []);
  console.log('First-try and legal walkthrough passed: perfect 2/2, either miss 1/2, 10 XP once, supplied legal details, no Supabase requests.');
} finally { await browser.close(); }
