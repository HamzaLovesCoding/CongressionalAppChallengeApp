import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { CLIPS } from '../src/feed/clips.ts';
import { topicOf } from '../src/content/learning.ts';

const base = process.env.BASE ?? 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/Users/hamza/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
try {
  for (const goal of ['permit', 'driver', 'other']) {
    const context = await browser.newContext({ viewport: { width: 320, height: 740 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const seed = {
      settings: { onboardedAt: '2026-10-16', termsAcceptedAt: '2026-10-16', goal },
      clips: Object.fromEntries(CLIPS.slice(0, 12).map(clip => [clip.id, { done: true, tries: 1, firstTry: true }])),
      topics: Object.fromEntries(CLIPS.map(clip => [topicOf(clip.id), { mastery: 0.6, attempts: 1, correct: 1 }])),
    };
    await context.addInitScript(state => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('roadloop-progress', JSON.stringify(state));
        sessionStorage.setItem('seeded', '1');
      }
    }, seed);
    await page.goto(`${base}#/home`);
    await page.locator('.home-week').waitFor();
    assert.equal(await page.locator('[data-goal-detail]').innerText(), '52');
    assert.match(await page.locator('[data-goal-lessons]').innerText(), /12 out of 24/);
    if (goal === 'driver') {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('.home-week').scrollIntoViewIfNeeded();
      await page.screenshot({ path: 'artifacts/home-readiness-52.png' });
      await page.setViewportSize({ width: 320, height: 740 });
    }
    await page.locator('.home-goal-summary').click();
    await page.locator('.review-page').waitFor();
    assert.match(await page.locator('.review-page').innerText(), /Driver readiness 52/);
    await page.goto(`${base}#/progress`);
    await page.locator('.path-dashboard').waitFor();
    assert.equal(await page.locator('.path-readiness').count(), 0, 'Progress leaves readiness to Home and Review (owner, 2026-10-18)');

    await page.goto(`${base}#/feed/roundabout/quiz`);
    await page.locator('[data-answer="0"]').click();
    await page.locator('[data-continue]').click();
    if (await page.locator('[data-recall-show]').count()) {
      await page.locator('[data-recall-show]').click();
      await page.locator('[data-recall-got]').click();
    }
    await page.locator('.lane-today-track').waitFor();
    const afterLesson = await page.locator('.lane-today-track').getAttribute('aria-valuenow');
    assert.ok(Number(afterLesson) > 52, 'completing a lesson raises the shared score');
    await page.goto(`${base}#/home`); await page.locator('.home-week').waitFor();
    assert.equal(await page.locator('[data-goal-detail]').innerText(), afterLesson, 'Home agrees with the lesson-complete summary');
    assert.match(await page.locator('[data-goal-lessons]').innerText(), /13 out of 24/);

    // Old records outside the curriculum must not inflate the score; completion counts even without mastery.
    await page.evaluate(ids => {
      const state = JSON.parse(localStorage.getItem('roadloop-progress'));
      state.clips = Object.fromEntries([...ids, 'retired-lesson'].map(id => [id, { done: true, tries: 1, firstTry: true }]));
      state.topics = {};
      state.daily = {};
      localStorage.setItem('roadloop-progress', JSON.stringify(state));
    }, CLIPS.map(clip => clip.id));
    await page.goto(`${base}#/home`); await page.reload();
    await page.locator('.home-week').waitFor();
    assert.equal(await page.locator('[data-goal-detail]').innerText(), '80');

    await page.evaluate(ids => {
      const state = JSON.parse(localStorage.getItem('roadloop-progress'));
      state.topics = Object.fromEntries(ids.map(id => [id, { mastery: 1, attempts: 1, correct: 1 }]));
      localStorage.setItem('roadloop-progress', JSON.stringify(state));
    }, CLIPS.map(clip => topicOf(clip.id)));
    await page.goto(`${base}#/home`); await page.reload(); await page.locator('.home-week').waitFor();
    assert.equal(await page.locator('[data-goal-detail]').innerText(), '100');
    assert.match(await page.locator('[data-goal-lessons]').innerText(), /24 out of 24/);
    assert.equal(await page.locator('[data-streak]').innerText(), 'Every lesson completed');
    await page.addStyleTag({ content: ':root { --fs-caption:18px; --fs-body:22.5px; --fs-title:30px; --fs-display:39px; --fs-hero:72px; }' });
    await page.locator('.home-goal-summary').scrollIntoViewIfNeeded();
    const overflow = await page.locator('.home-week *').evaluateAll(elements => elements.filter(el => !el.closest('svg') && !el.classList.contains('home-sr-only') && el.scrollWidth > el.clientWidth + 1).map(el => el.className));
    assert.deepEqual(overflow, [], `${goal}: no clipping at 320px and 150% type`);
    await page.screenshot({ path: `artifacts/home-large-text-${goal}.png` });
    await context.close();
    console.log(`${goal}: shared 52/100 score, actual lesson completion and summary parity, legacy completions 80/100, catalog filtering, 100/100 and large text passed.`);
  }
} finally { await browser.close(); }
