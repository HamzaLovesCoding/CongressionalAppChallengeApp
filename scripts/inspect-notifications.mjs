import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// Home's bell against stood-in group boards (the fake-backend dev server on 5175; no real Supabase calls).
const base = process.env.DEV_BASE ?? 'http://127.0.0.1:5175/';
const out = 'artifacts/notifications';
await fs.mkdir(out, { recursive: true });
const day = offset => { const date = new Date(); date.setDate(date.getDate() + offset); return date.toLocaleDateString('en-CA'); };
// 30 XP earned, 20 spent: 10 to spend, short of the Sedan (15) until the car check.
const seeded = extra => JSON.stringify({ xp: 30, spentXp: 20, clips: {}, daily: { [day(-1)]: 10, [day(-2)]: 10 }, liked: [], saved: [],
  settings: { displayAlias: 'tester', goal: 'permit', termsAcceptedAt: new Date().toISOString(), onboardedAt: new Date().toISOString() }, ...extra });
const member = (alias, rank, xp) => ({ rank, alias, car_id: 'sedan', xp, is_you: alias === 'tester' });
const BOARDS = {
  LEAD01: [member('tester', 1, 40), member('sam', 2, 25)],
  BEHIND: [member('ana', 1, 90), member('tester', 2, 40), member('kai', 3, 20)],
};
let boards = BOARDS;
let groupList = [{ code: 'LEAD01', name: 'Road crew', members: 2, is_owner: true }, { code: 'BEHIND', name: 'Class 3B', members: 3, is_owner: false }];
// WebKit enforces CORS on stood-in responses too.
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS' };
async function handle(route) {
  const url = new URL(route.request().url());
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  const fulfill = route.fulfill.bind(route);
  const request = route.request();
  route = { request: () => request, fulfill: options => fulfill({ ...options, headers: { ...CORS, ...options.headers } }) };
  if (url.pathname === '/auth/v1/signup') return route.fulfill({ json: { access_token: 't', refresh_token: 'r', expires_in: 3600, user: { id: '11111111-1111-4111-8111-111111111111' } } });
  if (url.pathname === '/rest/v1/rpc/sync_learner') return route.fulfill({ json: { syncedAt: new Date().toISOString(), weeklyXp: 40 } });
  if (url.pathname === '/rest/v1/rpc/my_groups') return route.fulfill({ json: groupList });
  if (url.pathname === '/rest/v1/rpc/code_group_leaderboard') return route.fulfill({ json: boards[JSON.parse(route.request().postData()).group_code] ?? [] });
  if (url.pathname.startsWith('/rest/v1/rpc/')) return route.fulfill({ json: [] });
  return route.fulfill({ status: 404, json: {} });
}
for (const [engine, type] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await type.launch(engine === 'chromium' ? { executablePath: process.env.CHROMIUM ?? '/Users/hamza/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' } : {});
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: engine === 'chromium', hasTouch: true, reducedMotion: 'reduce' });
  await context.route('https://*.supabase.co/**', handle);
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', error => problems.push(`${page.url()} ${error.message}`));
  const bell = page.locator('[data-notifications]');
  const open = async () => { await bell.click(); await page.locator('.home-notifications[open]').waitFor(); await page.waitForTimeout(350); };
  const close = async () => { await page.locator('.home-notifications [data-sheet-close]').click(); await page.locator('.home-notifications:not([open])').waitFor({ state: 'attached' }); await page.waitForTimeout(250); };
  // Waits for the first screen (Home or onboarding) before reloading, so the reload never cuts off a lazy import.
  const load = async state => { await page.goto(`${base}#/home`); await page.locator('.home-live, .welcome-page').first().waitFor(); await page.evaluate(value => localStorage.setItem('roadloop-progress', value), state); await page.reload(); await page.locator('.home-live').waitFor(); };

  boards = BOARDS; groupList = [{ code: 'LEAD01', name: 'Road crew', members: 2, is_owner: true }, { code: 'BEHIND', name: 'Class 3B', members: 3, is_owner: false }];
  // Streak at risk, permit test in 3 days, leading one group and second in another.
  await load(seeded({ settings: { ...JSON.parse(seeded()).settings, permitTestDate: day(3) } }));
  await page.locator('.home-bell-count:not([hidden])').filter({ hasText: '3' }).waitFor();
  assert.equal(await bell.getAttribute('aria-label'), 'Notifications, 3 new');
  await page.screenshot({ path: `${out}/${engine}-bell.png`, clip: { x: 0, y: 0, width: 390, height: 120 } });
  await open();
  const titles = await page.locator('.home-note b').allInnerTexts();
  assert.equal(titles.length, 3, titles.join(' | '));
  assert.ok(titles.some(t => t.includes('You’re leading Road crew')), 'leading group');
  assert.ok(!titles.some(t => t.includes('Class 3B')), 'not first in the other group');
  assert.equal(await page.locator('.home-note-new').count(), 3);
  await page.screenshot({ path: `${out}/${engine}-open.png` });
  await close();
  assert.equal(await page.locator('.home-bell-count').isHidden(), true, 'opening reads them');
  assert.equal(await bell.getAttribute('aria-label'), 'Notifications');
  // Reopened: the same items, no longer new; still read after a reload.
  await open();
  assert.equal(await page.locator('.home-note-new').count(), 0);
  await close();
  await page.reload(); await page.locator('.home-live').waitFor(); await page.waitForTimeout(500);
  assert.equal(await page.locator('.home-bell-count').isHidden(), true, 'read state survives a reload');
  // The group row switches the leaderboard to that group and scrolls to it.
  await open();
  await page.locator('[data-note-group="LEAD01"]').click();
  await page.locator('#board-tab-group[aria-selected="true"]').waitFor();
  await page.locator('.home-board-group-head').filter({ hasText: 'LEAD01' }).waitFor();
  await page.waitForTimeout(400);
  assert.ok(await page.locator('.home-leaderboard').evaluate(el => el.getBoundingClientRect().top < innerHeight), 'leaderboard scrolled into view');
  await page.screenshot({ path: `${out}/${engine}-group.png` });
  // The streak row opens the next lesson.
  await page.evaluate(() => scrollTo(0, 0));
  await open();
  await page.locator('.home-note[href^="#/feed/"]').click();
  await page.waitForURL(/#\/feed\//);

  // kai, behind on the last visit, moves ahead: a pass. The standings saved on the first visit make it news.
  boards = { ...BOARDS, BEHIND: [member('ana', 1, 90), member('kai', 2, 50), member('tester', 3, 40)] };
  await page.goto(`${base}#/home`); await page.locator('.home-live').waitFor();
  await page.locator('.home-bell-count:not([hidden])').filter({ hasText: '1' }).waitFor();
  await open();
  const passed = page.locator('[data-note-group="BEHIND"]');
  assert.match(await passed.innerText(), /kai passed you in Class 3B[\s\S]*10 XP ahead/);
  await page.screenshot({ path: `${out}/${engine}-passed.png` });
  await passed.click();
  await page.locator('.home-board-group-head').filter({ hasText: 'BEHIND' }).waitFor();
  // Level again: the pass is gone.
  boards = { ...BOARDS, BEHIND: [member('ana', 1, 90), member('kai', 2, 50), member('tester', 2, 50)] };
  await page.reload(); await page.locator('.home-live').waitFor(); await page.waitForTimeout(600);
  await open();
  assert.equal(await page.locator('[data-note-group="BEHIND"]').count(), 0);
  await close();

  // A permit-goal learner with no date and enough XP for the Sedan.
  groupList = [];
  await load(seeded({ spentXp: 0 }));
  await open();
  const rows = page.locator('.home-note');
  assert.ok(await rows.filter({ hasText: 'Add your permit test date' }).count(), 'asks for the date');
  const car = rows.filter({ hasText: 'You can unlock the Sedan' });
  assert.match(await car.innerText(), /15 XP, and you have 30 XP/);
  await page.screenshot({ path: `${out}/${engine}-car.png` });
  await car.click();
  await page.waitForURL(/#\/profile/);
  await page.locator('[data-notifications]').waitFor({ state: 'detached' });
  await load(seeded({ spentXp: 0 }));
  await open();
  await rows.filter({ hasText: 'Add your permit test date' }).click();
  await page.waitForURL(/#\/settings/);
  await page.locator('#sub-title').waitFor();

  // Nothing coming up: the empty state.
  await load(JSON.stringify({ xp: 0, clips: {}, daily: {}, liked: [], saved: [], settings: { ...JSON.parse(seeded()).settings, goal: 'driver' } }));
  await page.waitForTimeout(400);
  assert.equal(await page.locator('.home-bell-count').isHidden(), true);
  await open();
  await page.locator('.home-notes-empty').waitFor();
  await page.screenshot({ path: `${out}/${engine}-empty.png` });
  // WebKit only: the backup sent while a page unloads bypasses page routing.
  const harness = /rpc\/sync_learner due to access control checks/;
  assert.deepEqual(problems.filter(problem => !harness.test(problem)), []);
  await browser.close();
  console.log(`${engine}: ok`);
}
