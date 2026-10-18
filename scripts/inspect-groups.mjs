// Code groups end to end, with the real database (PGlite running every migration).
// Two learners finish onboarding (the username is required), A makes a group on Home, B joins with
// its code, both see the group's weekly board, and B leaves. Screenshots: artifacts/groups/.
//
// Needs: a dev server built with a stand-in backend URL, and PGlite (not a project dependency):
//   VITE_SUPABASE_URL=https://fake-lane.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=test npx vite --port 5174
//   npm install --no-save @electric-sql/pglite@0.5.8   (or PGLITE_MODULE=/path/to/pglite/dist/index.js)
import { chromium } from 'playwright';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const { PGlite } = await import(process.env.PGLITE_MODULE ?? '@electric-sql/pglite');
const base = process.env.BASE ?? 'http://127.0.0.1:5174/';
const host = 'https://fake-lane.supabase.co';
const out = 'artifacts/groups';
await mkdir(out, { recursive: true });

const db = new PGlite();
await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth; create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;`);
const dir = new URL('../supabase/migrations/', import.meta.url);
for (const name of (await readdir(dir)).filter(file => file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(name, dir), 'utf8'));

// Function → argument types and whether it returns rows (a table) or one value.
const FUNCTIONS = {
  sync_learner: { args: { payload: 'jsonb' } }, set_username: { args: { new_name: 'text' } }, weekly_leaderboard: { args: { max_rows: 'integer' }, table: true },
  group_leaderboard: { args: {}, table: true }, my_buddies: { args: {}, table: true }, request_buddy: { args: { username: 'text' } },
  respond_buddy: { args: { link_id: 'uuid', accept: 'boolean' } }, remove_buddy: { args: { link_id: 'uuid' } }, delete_my_data: { args: {} },
  lesson_comments_list: { args: { lesson: 'text' }, table: true }, post_comment: { args: { lesson: 'text', message: 'text' } },
  vote_comment: { args: { comment: 'uuid', vote: 'integer' } }, delete_comment: { args: { comment: 'uuid' } },
  my_groups: { args: {}, table: true }, create_group: { args: {} }, join_group: { args: { group_code: 'text' } }, leave_group: { args: { group_code: 'text' } },
  code_group_leaderboard: { args: { group_code: 'text' }, table: true },
};
async function handle(route) {
  const request = route.request(), url = new URL(request.url());
  if (url.pathname === '/auth/v1/signup') {
    const id = randomUUID();
    await db.query('insert into auth.users values ($1)', [id]);
    return route.fulfill({ json: { access_token: id, refresh_token: id, expires_in: 3600, user: { id } } });
  }
  const fn = url.pathname.replace('/rest/v1/rpc/', ''), spec = FUNCTIONS[fn];
  if (!spec) return route.fulfill({ status: 404, json: {} });
  const user = request.headers().authorization?.replace('Bearer ', '');
  const body = request.postDataJSON() ?? {};
  const names = Object.keys(spec.args).filter(name => name in body);
  const params = names.map(name => spec.args[name] === 'jsonb' ? JSON.stringify(body[name]) : body[name]);
  const call = `public.${fn}(${names.map((name, i) => `${name} => $${i + 1}::${spec.args[name]}`).join(', ')})`;
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user}', false); set role authenticated;`);
  try {
    const result = await db.query(spec.table ? `select * from ${call}` : `select ${call} as value`, params);
    return route.fulfill({ json: spec.table ? result.rows : result.rows[0].value });
  } catch (error) { return route.fulfill({ status: 400, json: { message: error.message } }); }
  finally { await db.exec('reset role'); }
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const errors = [];
// The auth shim uses one database session; keep concurrent browser requests in their own role.
let requests = Promise.resolve();
async function learner(name) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.route('https://*.supabase.co/**', route => {
    assert.equal(new URL(route.request().url()).origin, host, 'never send walkthrough requests to the live project');
    requests = requests.then(() => handle(route));
    return requests;
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`${name}: ${error.message}`));
  return page;
}
const shot = async (page, label) => { await page.waitForTimeout(600); const board = page.locator(".home-leaderboard"); await (await board.count() ? board : page).screenshot({ path: `${out}/${label}.png` }); };


const a = await learner('A'), b = await learner('B');
async function onboard(page, name) {
  await page.goto(base + '#/home', { waitUntil: 'load' });
  await page.waitForURL(/#\/welcome/);
  await page.check('[name="terms"]');
  await page.click('[data-account] button[type="submit"]');
  assert.match(await page.locator('[data-status]').innerText(), /Choose a username/, 'onboarding refuses an empty username');
  if (name === 'Road_Runner') await shot(page, '01-username-required');
  await page.fill('#welcome-name', name);
  await page.click('[data-account] button[type="submit"]');
  await page.locator('[data-goal]').waitFor();
  await page.check('[name="goal"][value="permit"]');
  await page.click('[data-goal] button[type="submit"]');
  await page.waitForURL(/#\/home/);
}
await onboard(a, 'Road_Runner');
await onboard(b, 'Brake_Light');
// Use the app's backup path once; Home must update immediately, without a reload or its minute timer.
async function completeAndSync(page, lessons) {
  await page.evaluate(async lessons => {
    const store = await import('/src/feed/progress.ts');
    const { appSync } = await import('/src/data/sync.ts');
    const { CLIPS } = await import('/src/feed/clips.ts');
    for (const id of lessons) {
      store.answer(id, true);
      store.recordAttempt({ itemId: id, topicId: 'road-awareness', kind: 'primary', correct: true, activeMs: 9000 });
    }
    await appSync(CLIPS.map(clip => clip.id)).sync();
  }, lessons);
}
for (const [page, lessons] of [[a, ['lane-end-scan', 'dark-signal']], [b, ['lane-end-scan']]]) {
  await completeAndSync(page, lessons);
  await page.waitForFunction(xp => document.querySelector('[data-board-you] .home-board-xp strong')?.textContent === String(xp), lessons.length * 10, { timeout: 5000 });
}

// The Global tab no longer says rankings are coming soon.
await a.reload({ waitUntil: 'load' });
const board = a.locator('.home-leaderboard');
await board.scrollIntoViewIfNeeded();
assert.doesNotMatch(await board.innerText(), /coming soon/i);
await a.click('[data-board-tab="group"]');
await a.locator('[data-group-create]').waitFor();
assert.doesNotMatch(await board.innerText(), /coming soon/i);
await shot(a, '02-group-empty');
await a.click('[data-group-create]');
const codeButton = a.locator('[data-group-share]');
await codeButton.waitFor();
const code = (await codeButton.innerText()).replace(/^Code\s*/, '').trim();
assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/, 'the new group shows its code');
await shot(a, '03-group-created');

await b.reload({ waitUntil: 'load' });
await b.locator('.home-leaderboard').scrollIntoViewIfNeeded();
await b.click('[data-board-tab="group"]');
await b.click('[data-group-open-join]');
await b.fill('#board-group-code', 'ZZZZZZ');
await b.click('[data-group-join] button[type="submit"]');
await b.waitForFunction(() => /No group has that code/.test(document.querySelector('[data-group-status]')?.textContent ?? ''));
await b.fill('#board-group-code', code.toLowerCase());
await b.click('[data-group-join] button[type="submit"]');
await b.locator('[data-group-share]').waitFor();
await b.waitForFunction(() => document.querySelectorAll('#board-panel .home-board-row').length === 2);
const names = await b.locator('#board-panel .home-board-name').allInnerTexts();
assert.deepEqual(names, ['Road_Runner', 'You'], 'the joined group ranks both members by weekly XP');
await shot(b, '04-group-joined');

await a.reload({ waitUntil: 'load' });
await a.locator('.home-leaderboard').scrollIntoViewIfNeeded();
await a.click('[data-board-tab="group"]');
await a.waitForFunction(() => document.querySelectorAll('#board-panel .home-board-row').length === 2);
await shot(a, '05-owner-sees-friend');

await completeAndSync(a, ['after-collision']);
await a.waitForFunction(() => document.querySelector('[data-board-you] .home-board-xp strong')?.textContent === '30', null, { timeout: 5000 });
await a.click('[data-board-tab="global"]');
assert.equal(await a.locator('[data-board-you] .home-board-xp strong').innerText(), '30', 'both boards refresh after backup');
await shot(a, '05b-xp-after-one-backup');

b.on('dialog', dialog => dialog.accept());
await b.click('[data-group-leave]');
await b.waitForFunction(() => /You left the group/.test(document.querySelector('[data-group-status]')?.textContent ?? ''));
await b.locator('[data-group-create]').waitFor();
assert.equal(await b.locator('[data-group-share]').count(), 0, 'after leaving, the learner is in no group');
await shot(b, '06-left');

assert.deepEqual(errors, []);
await browser.close();
console.log(`Groups walkthrough passed (code ${code}). Screenshots in ${out}/`);
