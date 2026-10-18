// Walks the quiz flow and simulation handoff in the built app (npm run build:test && npm run preview:test):
// wrong → rule → similar → second miss → recovery + Review Later; options menu; I already know this;
// lesson completion → the challenge card follows → package mounts in the feed → Exit records once,
// queues review and stays put; "Are you sure?" on an early swipe; old #/drive and #/sim links redirect. Screenshots: artifacts/learning-flow/.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.env.BASE ?? 'http://127.0.0.1:4173/';
const out = 'artifacts/learning-flow';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, args: ['--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', hasTouch: true, isMobile: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const shot = name => page.screenshot({ path: `${out}/${name}.png` });
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('roadloop-progress') ?? '{}'));
const sheet = '.lane-sheet[aria-hidden="false"]';
// Correct indexes come from the source files, so the walkthrough never guesses.
const { CLIPS } = await import('../src/feed/clips.ts');
const { LEARNING } = await import('../src/content/learning.ts');
const correctIndex = (lessonId, kind) => kind === 'primary' ? CLIPS.find(c => c.id === lessonId).answer : LEARNING[lessonId][kind].answer;
const wrongIndex = (lessonId, kind) => (correctIndex(lessonId, kind) + 1) % 3;
const pick = async index => { await page.click(`${sheet} [data-answer="${index}"]`); await page.waitForTimeout(150); };

// 1. Wrong → rule → similar → wrong → recovery
await page.goto(base + '#/feed/lane-end-scan/quiz', { waitUntil: 'load' });
await page.waitForSelector(sheet);
assert.ok(await page.isVisible(`${sheet} [data-menu]`), 'options menu replaces close on an open check');
assert.equal(await page.isVisible(`${sheet} .lane-close:not([data-menu])`), false, 'no silent close on an open check');
await pick(wrongIndex('lane-end-scan', 'primary'));
assert.match(await page.textContent(`${sheet} .lane-feedback`), /Almost\. Here is the rule/);
await shot('01-wrong-rule');
await page.click(`${sheet} [data-similar]`);
assert.match(await page.textContent(`${sheet} .lane-round-label`), /ONE MORE TRY/);
assert.notEqual(await page.textContent(`${sheet} .lane-question`), CLIPS[0].question, 'similar, not identical');
await shot('02-similar');
await pick(wrongIndex('lane-end-scan', 'similar'));
await page.waitForSelector(`${sheet} [data-read-rule]`);
await shot('03-recovery');
let data = await stored();
assert.deepEqual(data.reviewLater.map(item => [item.itemId, item.reason]), [['lane-end-scan', 'missed']]);
assert.equal(data.clips['lane-end-scan'].done, false, 'two misses are not completion');
assert.equal(data.xp, 0, 'no XP from misses');
assert.deepEqual(data.attempts.map(a => [a.kind, a.correct]), [['primary', false], ['similar', false]]);
assert.ok(typeof data.topics['road-awareness'].mastery === 'number', 'topic evidence recorded');
// A missed lesson comes back in today's review, but it was not saved, so Home shows no Review later row
// and the gear menu has no Review later link.
await page.goto(base + '#/home', { waitUntil: 'load' });
assert.equal(await page.locator('.home-review-row').count(), 0, 'automatic picks are not listed as saved');
await page.click('[data-menu]');
assert.deepEqual(await page.locator('.home-menu-links a').allInnerTexts(), ['Settings', 'Credits & sources']);
await page.waitForTimeout(500);
await shot('03b-gear-menu');
await page.goto(base + '#/review', { waitUntil: 'load' });
const reviewText = await page.locator('.review-page').innerText();
assert.match(reviewText, /Today’s review\s+Nothing saved yet\./);
assert.doesNotMatch(reviewText, /Missed twice|Saved for later/, 'an automatic miss is not listed as saved');
assert.match(reviewText, /Your topics\s+Driver readiness \d+ · [A-Za-z ]+\.\s+Road awareness\s+(Needs the lesson again|Needs support|Developing|Strong) · \d+ of \d+ answers? right/, 'the topic shows its band and actual answers');
assert.equal(await page.locator('.review-page h2:text("Practice challenges") + ul > li').count(), 3, 'three practice challenges at a time');

// 2. Options menu: I already know this → harder correct completes with XP
await page.goto(base + '#/feed/dark-signal/quiz', { waitUntil: 'load' });
await page.waitForSelector(sheet);
await page.click(`${sheet} [data-menu]`);
await shot('04-menu');
assert.ok(await page.isVisible(`${sheet} [data-know]`));
assert.ok(await page.isVisible(`${sheet} [data-review-later]`));
assert.ok(await page.isVisible(`${sheet} [data-help]`));
await page.click(`${sheet} [data-help]`);
await shot('05-help');
await page.click(`${sheet} [data-back-to-question]`);
await page.click(`${sheet} [data-menu]`);
await page.click(`${sheet} [data-know]`);
assert.match(await page.textContent(`${sheet} .lane-round-label`), /PROVE IT/);
await pick(correctIndex('dark-signal', 'harder'));
await page.click(`${sheet} [data-finish]`);
data = await stored();
assert.equal(data.clips['dark-signal'].done, true);
assert.equal(data.xp, 10);

// 3. Correct first try on a lesson with a simulation → the challenge is the next feed card → Exit stays
await page.goto(base + '#/feed/four-way-stop/quiz', { waitUntil: 'load' });
await page.waitForSelector(sheet);
await pick(correctIndex('four-way-stop', 'primary'));
await page.click(`${sheet} [data-finish]`);
// The algorithm may add one quick recall card first (developing band).
if (await page.isVisible(`${sheet} [data-recall-show]`)) { await page.click(`${sheet} [data-recall-show]`); await page.click(`${sheet} [data-recall-got]`); }
await page.waitForSelector(`${sheet} [data-next]`);
assert.match(await page.textContent(`${sheet} [data-next]`), /30-second challenge/);
await page.waitForTimeout(700);
await shot('06-complete-challenge-next');
data = await stored();
assert.equal(data.xp, 20);
await page.click(`${sheet} [data-next]`);
await page.waitForFunction(() => location.hash === '#/feed/sim/four-way-stop');
await page.click('.is-current [data-sim-start]');
await page.locator('[data-start]').waitFor({ timeout: 15000 });
await page.waitForTimeout(800);
await shot('07-sim-in-feed');
await page.locator('[data-exit]').click();
await page.locator('.is-current [data-sim-body]').waitFor({ state: 'visible' });
assert.equal(await page.evaluate(() => location.hash), '#/feed/sim/four-way-stop', 'Exit returns to the same feed position');
data = await stored();
assert.deepEqual(data.simulations.map(s => s.outcome), ['exit']);
assert.ok(data.reviewLater.some(item => item.itemId === 'sim:four-way-stop' && item.reason === 'sim-exit'));
assert.equal(data.xp, 20, 'simulations never add XP');

// 4. Old #/drive and #/sim links open the challenge inside the feed
await page.goto(base + '#/drive/yellow-light', { waitUntil: 'load' });
await page.waitForFunction(() => location.hash === '#/feed/sim/yellow-light-stop');
await page.goto(base + '#/sim/right-turn-scan/review', { waitUntil: 'load' });
await page.waitForFunction(() => location.hash === '#/feed/sim/right-turn-scan');
await shot('08-sim-card');

// 5. Leaving an important lesson before its video ends asks "Are you sure?"
await page.goto(base + '#/feed/emergency-pull-right', { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.focus('.lane-feed');
await page.keyboard.press('ArrowDown');
await page.waitForSelector(`${sheet} [data-gate-stay]`, { timeout: 3000 });
assert.match(await page.textContent(`${sheet} .lane-question`), /Are you sure/);
assert.ok(await page.isVisible(`${sheet} [data-know]`) && await page.isVisible(`${sheet} [data-key]`), 'quiz me and important part offered');
await page.waitForTimeout(700);
await shot('09-are-you-sure');
await page.click(`${sheet} [data-gate-later]`);
await page.waitForTimeout(500);
data = await stored();
assert.ok(data.reviewLater.some(item => item.itemId === 'emergency-pull-right' && item.reason === 'skip'));
assert.notEqual(await page.evaluate(() => location.hash), '#/feed/sim/emergency-vehicle-yield', 'a lesson saved for later skips its own challenge');
// Lessons the learner chose to save are what Home counts and what Review lists as saved.
await page.goto(base + '#/home', { waitUntil: 'load' });
assert.match(await page.locator('.home-review-row').innerText(), /Review later\s+\d+ saved lessons?/);
await page.goto(base + '#/review', { waitUntil: 'load' });
assert.ok(data.saved.includes('emergency-pull-right'), 'Review later also turns on the bookmark');
assert.match(await page.locator('.review-page').innerText(), /Today’s review\s+Start review · 1 question\s+When an Emergency Vehicle Approaches\s+Saved/);
await shot('10-review-saved');
// Reviewing it right moves it to Saved for later until its next review day.
await page.click('[data-start]');
await page.click(`[data-answer="${LEARNING['emergency-pull-right'].similar.answer}"]`);
assert.match(await page.locator('.lane-feedback').innerText(), /Correct/);
await page.click('[data-next]');
await page.reload({ waitUntil: 'load' });
assert.match(await page.locator('.review-page').innerText(), /Today’s review\s+You’re caught up for today\.[\s\S]*Saved for later\s+When an Emergency Vehicle Approaches\s+Next review/);
await page.goto(base + '#/home', { waitUntil: 'load' });
assert.equal(await page.locator('.home-review-row').count(), 0, 'nothing left to review today');
await shot('11-review-done');

await browser.close();
assert.deepEqual(errors, [], `page errors: ${errors.join('; ')}`);
console.log('learning flow walkthrough passed');
