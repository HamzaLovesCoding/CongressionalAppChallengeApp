// Driver coach walkthrough: the Practice card, the full-screen chat, cited handbook pages, follow-up
// context, limits, refusals, retries, stopping an answer and a new chat. Screenshots: artifacts/coach/.
//
// The backend is stood in by Playwright, so no request reaches Supabase or Anthropic. Needs a dev server
// built with a stand-in backend URL (the "fake-backend" entry in .claude/launch.json):
//   VITE_SUPABASE_URL=https://fake-lane.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=test npx vite --port 5175 --strictPort
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const base = process.env.BASE ?? 'http://127.0.0.1:5175/';
const host = 'https://fake-lane.supabase.co';
const out = 'artifacts/coach';
await mkdir(out, { recursive: true });

const FIRST = [
  { type: 'quota', remaining: 29 },
  { type: 'text', text: 'At an all-way stop, **the driver who stops first goes first**. ' },
  { type: 'cite', pages: ['30'], quote: 'Without STOP or YIELD signs: The vehicle that arrives to the intersection first has the right-of-way.' },
  { type: 'text', text: 'If two of you arrive at the same time, **yield to the vehicle on your right**.\n\nA few reminders:\n- Stop at the limit line, or before the crosswalk if there is no line.\n' },
  { type: 'cite', pages: ['26'], quote: 'Make a full stop before entering the crosswalk or at the limit line.' },
  { type: 'cite', pages: ['30'], quote: 'However, if a vehicle, pedestrian, or bicyclist gets to the intersection at the same time as you, give the right-of-way to the vehicle, pedestrian, or bicyclist on your right.' },
  { type: 'text', text: '- Pedestrians in the crosswalk always go first.\n- Never assume the other driver will wait for you.' },
  { type: 'done', stop: 'end_turn' },
];
const QUIZ = [
  { type: 'quota', remaining: 4 },
  { type: 'text', text: 'Here’s one:\n\nYou and another car stop at a four-way stop at the same time. The other car is on your right. Who goes first?\nA) You do\nB) The car on your right\nC) Whoever honks first\n\nReply with A, B or C.' },
  { type: 'done', stop: 'end_turn' },
];
const ndjson = events => events.map(event => JSON.stringify(event)).join('\n') + '\n';

let scenario = 'first';
const asked = [];
async function handle(route) {
  const request = route.request(), url = new URL(request.url());
  assert.equal(url.origin, host, 'never send walkthrough requests to a real backend');
  if (url.pathname === '/auth/v1/signup') return route.fulfill({ json: { access_token: 'learner-token', refresh_token: 'refresh', expires_in: 3600, user: { id: '11111111-1111-4111-8111-111111111111' } } });
  if (url.pathname === '/rest/v1/rpc/sync_learner') return route.fulfill({ json: { syncedAt: new Date().toISOString(), weeklyXp: 0 } });
  if (url.pathname.startsWith('/rest/v1/rpc/')) return route.fulfill({ json: [] });
  if (url.pathname !== '/functions/v1/coach') return route.fulfill({ status: 404, json: {} });
  assert.equal(request.headers().authorization, 'Bearer learner-token');
  asked.push(request.postDataJSON());
  const now = scenario;
  if (now === 'slow') { await new Promise(resolve => setTimeout(resolve, 4000)); return route.fulfill({ body: ndjson(FIRST), contentType: 'application/x-ndjson' }).catch(() => {}); }
  if (now === 'limit') return route.fulfill({ status: 429, json: { error: 'daily-limit' } });
  if (now === 'failed') return route.fulfill({ status: 500, body: 'oops' });
  if (now === 'missing') return route.fulfill({ status: 404, json: { code: 'NOT_FOUND' } });
  if (now === 'refusal') return route.fulfill({ body: ndjson([{ type: 'quota', remaining: 3 }, { type: 'refusal' }]), contentType: 'application/x-ndjson' });
  return route.fulfill({ body: ndjson(now === 'quiz' ? QUIZ : FIRST), contentType: 'application/x-ndjson' });
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/Users/hamza/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
const problems = [];
async function open(viewport, { reducedMotion = 'no-preference', onboarded = true } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion, permissions: ['clipboard-read', 'clipboard-write'] });
  if (onboarded) await context.addInitScript(() => { if (!localStorage.getItem('roadloop-progress')) localStorage.setItem('roadloop-progress', JSON.stringify({ settings: { onboardedAt: '2026-10-16T00:00:00.000Z', termsAcceptedAt: '2026-10-16T00:00:00.000Z', goal: 'permit' } })); });
  await context.route('https://*.supabase.co/**', handle);
  const page = await context.newPage();
  page.on('pageerror', error => problems.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) problems.push(message.text()); });
  return { context, page };
}
// Route changes cross-fade; screenshots wait for the new screen to settle.
const settle = async page => { await page.waitForFunction(() => !document.documentElement.dataset.nav); await page.waitForTimeout(400); };
const noSideScroll = page => page.evaluate(() => [...document.querySelectorAll('.home-phone, .coach-log')].every(el => el.scrollWidth <= el.clientWidth + 1));
const answerCount = page => page.locator('.coach-exchange').count();
const lastAnswer = page => page.locator('.coach-exchange').last().locator('.coach-answer');
const waitStatus = (page, status, count) => page.waitForFunction(([value, total]) => {
  const items = document.querySelectorAll('.coach-exchange');
  return (total === undefined || items.length === total) && items[items.length - 1]?.querySelector('.coach-answer')?.dataset.status === value;
}, [status, count]);
// Sends from the chat's box and waits for that question's answer to settle.
async function send(page, text, status) {
  const count = await answerCount(page);
  const box = page.locator('.coach-dock textarea');
  await box.fill(text);
  await box.press('Enter');
  await waitStatus(page, status, count + 1);
}

try {
  // 1. Practice: the coach sits under the practice test, above the topic list.
  const { context, page } = await open({ width: 390, height: 844 });
  await page.goto(`${base}#/practice`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const order = await page.evaluate(() => [...document.querySelectorAll('.practice-content > section')].map(section => section.getAttribute('aria-labelledby')));
  assert.deepEqual(order, ['practice-test-title', 'coach-title', 'practice-topics-title'], 'coach section comes right after the practice test');
  assert.equal(await page.locator('.coach-entry .ui-chip').innerText(), 'AI', 'the coach is labelled as AI');
  assert.equal(await page.locator('.coach-entry textarea').count(), 0, 'Practice shows a card, not a question box');
  assert.equal(await page.locator('.coach-card').getAttribute('href'), '#/practice/coach', 'the whole card opens the chat');
  assert.ok(await noSideScroll(page));
  await page.locator('.coach-entry').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/01-practice-section.png` });

  // 2. The card opens the empty chat; a starter question there brings in the cited answer.
  await page.locator('.coach-card').click();
  await page.waitForURL(/#\/practice\/coach$/);
  await page.getByRole('heading', { name: 'Ask the driver coach' }).waitFor();
  assert.equal(asked.length, 0, 'opening the chat asks nothing');
  await page.getByRole('button', { name: 'Who goes first at a four-way stop?' }).click();
  await waitStatus(page, 'done');
  assert.equal(await page.getByRole('navigation', { name: 'Main navigation' }).count(), 0, 'the chat hides app navigation like the practice test');
  assert.equal(asked.at(-1).messages.length, 1);
  assert.deepEqual(asked.at(-1).messages[0], { role: 'user', text: 'Who goes first at a four-way stop?' });
  const answerText = await lastAnswer(page).locator('.coach-text').innerText();
  assert.match(answerText, /the driver who stops first goes first/);
  assert.equal(await lastAnswer(page).locator('.coach-text strong').count(), 2, 'bold renders as bold, not asterisks');
  assert.equal(await lastAnswer(page).locator('.coach-text li').count(), 3, 'the list renders as a list');
  assert.deepEqual(await lastAnswer(page).locator('.coach-cite').allInnerTexts(), ['p. 30', 'p. 26'], 'cited pages in order, each once');
  assert.ok(await noSideScroll(page));
  await settle(page);
  await page.screenshot({ path: `${out}/02-answer.png` });

  // Copy puts the answer on the clipboard as plain text with its handbook pages.
  const copyButton = lastAnswer(page).getByRole('button', { name: 'Copy answer' });
  await copyButton.click();
  await lastAnswer(page).getByRole('button', { name: 'Answer copied' }).waitFor();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(clipboard, /^At an all-way stop, the driver who stops first goes first\./, 'copied without ** marks');
  assert.match(clipboard, /- Pedestrians in the crosswalk always go first\./);
  assert.match(clipboard, /California Driver’s Handbook, pages 30, 26$/);
  await lastAnswer(page).getByRole('button', { name: 'Copy answer' }).waitFor({ timeout: 3000 });

  // 3. A page chip shows what that page says.
  const chip = lastAnswer(page).locator('.coach-cite', { hasText: 'p. 30' });
  await chip.click();
  assert.equal(await chip.getAttribute('aria-expanded'), 'true');
  const quote = lastAnswer(page).locator('.coach-quote');
  assert.equal(await quote.locator('blockquote').count(), 2, 'both passages quoted from page 30');
  assert.match(await quote.innerText(), /California Driver’s Handbook, page 30/);
  await settle(page);
  await page.screenshot({ path: `${out}/03-handbook-quote.png` });
  await chip.click();
  assert.equal(await quote.isHidden(), true, 'the same chip closes it again');

  // 4. A follow-up carries the earlier exchange as context; Enter sends; the remaining count shows when low.
  scenario = 'quiz';
  const box = page.locator('.coach-dock textarea');
  await box.fill('Quiz me on that');
  await box.press('Shift+Enter');
  assert.equal(await box.inputValue(), 'Quiz me on that\n', 'Shift+Enter adds a line');
  await box.press('Enter');
  await waitStatus(page, 'done', 2);
  assert.deepEqual(asked.at(-1).messages.map(message => message.role), ['user', 'assistant', 'user']);
  assert.match(asked.at(-1).messages[1].text, /^At an all-way stop/, 'the earlier answer goes back as context');
  assert.equal(asked.at(-1).messages[2].text, 'Quiz me on that');
  assert.match(await page.locator('.coach-foot').innerText(), /4 questions left today/);
  assert.equal(await box.inputValue(), '', 'the box clears after sending');
  assert.equal(await page.locator('.coach-exchange').first().locator('[data-again]').count(), 0, 'only the latest answer can be asked again');
  await settle(page);
  await page.screenshot({ path: `${out}/04-quiz.png` });
  // Ask again replaces the latest answer in place, with the same context.
  const beforeAgain = asked.length;
  const replaced = await page.locator('.coach-exchange').last().elementHandle();
  await lastAnswer(page).getByRole('button', { name: 'Ask again' }).click();
  await page.waitForFunction(item => !item.isConnected, replaced);
  await waitStatus(page, 'done', 2);
  await lastAnswer(page).getByRole('button', { name: 'Ask again' }).waitFor();
  assert.equal(asked.length, beforeAgain + 1);
  assert.deepEqual(asked.at(-1).messages.map(message => message.text.slice(0, 15)), ['Who goes first ', 'At an all-way s', 'Quiz me on that']);

  // 5. The daily limit: a plain explanation, no retry.
  scenario = 'limit';
  await send(page, 'One more question', 'problem');
  assert.match(await lastAnswer(page).innerText(), /30 questions today/);
  assert.equal(await lastAnswer(page).locator('[data-retry]').count(), 0);
  await settle(page);
  await page.screenshot({ path: `${out}/05-daily-limit.png` });

  // 6. A failed answer can be retried; it leaves the failed exchange out of the context.
  scenario = 'failed';
  await send(page, 'What does a flashing red light mean?', 'problem');
  assert.match(await lastAnswer(page).innerText(), /couldn’t answer just now/);
  scenario = 'first';
  const before = await answerCount(page);
  await lastAnswer(page).getByRole('button', { name: 'Try again' }).click();
  await waitStatus(page, 'done', before);
  assert.equal(await answerCount(page), before, 'the retry replaces the failed exchange');
  assert.deepEqual(asked.at(-1).messages.map(message => message.role), ['user', 'assistant', 'user', 'assistant', 'user'], 'failed and limited exchanges are not context');

  // 7. A declined question.
  scenario = 'refusal';
  await send(page, 'Help me with my math homework', 'refused');
  assert.match(await lastAnswer(page).innerText(), /can’t help with that one/);

  // The jump button appears when reading further up and brings the newest answer back.
  const log = page.locator('.coach-log');
  await page.waitForTimeout(800); // the glide down to the new answer finishes first
  await log.evaluate(el => { el.scrollTop = 0; });
  const jump = page.getByRole('button', { name: 'Show the latest answer' });
  await jump.waitFor();
  await settle(page);
  await page.screenshot({ path: `${out}/05b-jump.png` });
  await jump.click();
  await page.waitForFunction(() => { const el = document.querySelector('.coach-log'); return el.scrollHeight - el.scrollTop - el.clientHeight < 2; });
  await jump.waitFor({ state: 'hidden' });

  // 8. Stopping an answer that hasn't arrived.
  scenario = 'slow';
  await box.fill('How far ahead should I look?');
  await box.press('Enter');
  const stop = page.getByRole('button', { name: 'Stop the answer' });
  await stop.waitFor();
  assert.equal(await page.locator('[data-again]').count(), 0, 'nothing can be asked again while an answer is coming');
  await settle(page);
  await page.screenshot({ path: `${out}/06-waiting.png` });
  await stop.click();
  await waitStatus(page, 'stopped');
  assert.match(await lastAnswer(page).innerText(), /You stopped this answer/);
  await page.getByRole('button', { name: 'Ask the coach' }).waitFor();
  assert.ok(await noSideScroll(page));

  // 9. Back on Practice: continue the chat; a new chat clears it.
  await page.getByRole('link', { name: 'Back to practice' }).click();
  await page.waitForURL(/#\/practice$/);
  assert.match(await page.locator('.coach-card').innerText(), /Continue your chat[\s\S]*How far ahead should I look\?/);
  await settle(page);
  await page.locator('.coach-entry').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/07-practice-continue.png` });
  await page.locator('.coach-card').click();
  await page.waitForURL(/#\/practice\/coach$/);
  await page.getByRole('button', { name: 'New chat' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.coach-exchange').length === 0);
  assert.equal(await page.getByRole('button', { name: 'New chat' }).isHidden(), true, 'nothing to clear in an empty chat');
  await page.getByRole('heading', { name: 'Ask the driver coach' }).waitFor();
  assert.match(await page.locator('.coach-empty').innerText(), /Never use Lane while driving/);
  assert.equal(await page.locator('.coach-dock textarea').getAttribute('placeholder'), 'Ask a driving question');
  await page.locator('.coach-dock textarea').blur();
  await settle(page);
  await page.screenshot({ path: `${out}/08-empty.png` });

  // 10. The coach function not deployed yet.
  scenario = 'missing';
  await send(page, 'Can I turn right on a red light?', 'problem');
  assert.match(await lastAnswer(page).innerText(), /isn’t switched on yet/);
  await context.close();

  // 11. Other phones, reduced motion and the screens that can't ask.
  for (const [name, viewport] of Object.entries({ narrow: { width: 320, height: 640 }, landscape: { width: 844, height: 390 } })) {
    scenario = 'first';
    const { context: other, page: phone } = await open(viewport, { reducedMotion: 'reduce' });
    await phone.goto(`${base}#/practice/coach`, { waitUntil: 'networkidle' });
    await phone.getByRole('heading', { name: 'Ask the driver coach' }).waitFor();
    await phone.screenshot({ path: `${out}/09-empty-${name}.png` });
    await phone.getByRole('button', { name: 'Quiz me on road signs' }).click();
    await phone.waitForFunction(() => document.querySelector('.coach-exchange:last-child .coach-answer')?.dataset.status === 'done');
    assert.ok(await noSideScroll(phone), `${name}: no sideways scrolling`);
    const box = await phone.locator('.coach-dock').boundingBox();
    assert.ok(box && box.y + box.height <= viewport.height + 1, `${name}: the question box stays on screen`);
    const title = await phone.locator('.coach-heading h1').evaluate(el => el.scrollWidth <= el.clientWidth);
    assert.ok(title, `${name}: the screen title fits`);
    await phone.screenshot({ path: `${out}/10-answer-${name}.png` });
    await other.close();
  }
  const { context: fresh, page: first } = await open({ width: 390, height: 844 }, { onboarded: false });
  await first.goto(`${base}#/practice`, { waitUntil: 'networkidle' });
  assert.match(await first.locator('.coach-entry').innerText(), /Finish setting up Lane to use the coach/);
  assert.equal(await first.locator('.coach-card').getAttribute('href'), '#/welcome', 'the card leads to setup before the Terms are agreed');
  await first.locator('.coach-entry').scrollIntoViewIfNeeded();
  await first.screenshot({ path: `${out}/11-practice-setup.png` });
  await fresh.close();

  assert.deepEqual(problems, []);
  console.log(`Coach walkthrough passed (${asked.length} coach requests, all stood in). Screenshots in ${out}/.`);
} finally {
  await browser.close();
}
