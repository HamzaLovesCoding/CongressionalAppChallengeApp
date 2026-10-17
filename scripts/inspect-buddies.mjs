// Streak buddies end to end, with the real database: the app's Supabase calls are routed to PGlite
// running every migration in supabase/migrations, so the UI exercises the actual SQL functions.
// Two learners in separate browser contexts pick usernames, send and accept a request, practice on
// the same day, and see the duo streak, the Group leaderboard and removal. Screenshots: artifacts/buddies/.
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
const out = 'artifacts/buddies';
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
async function learner(name) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.route(`${host}/**`, handle);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`${name}: ${error.message}`));
  return page;
}
const shot = async (page, label) => { await page.waitForTimeout(600); await page.screenshot({ path: `${out}/${label}.png`, fullPage: true }); };

const a = await learner('A'), b = await learner('B');
// Each learner earns XP today (a finished lesson), so both have a practice day.
for (const page of [a, b]) {
  // Settings, because Home sends a brand-new learner to onboarding first.
  await page.goto(base + '#/settings', { waitUntil: 'load' });
  await page.evaluate(() => { const today = new Date().toLocaleDateString('en-CA'); localStorage.setItem('roadloop-progress', JSON.stringify({ xp: 10, clips: { 'lane-end-scan': { tries: 1, firstTry: true, done: true, completedAt: new Date().toISOString() } }, daily: { [today]: 10 }, liked: [], saved: [] })); });
  await page.reload({ waitUntil: 'load' });
}

// A chooses a username on the buddies page and sends a request.
await a.goto(base + '#/buddies', { waitUntil: 'load' });
await a.locator('#buddy-add').waitFor();
await a.fill('#buddy-add', 'Brake_Light');
await a.click('[data-add-form] button');
await a.waitForFunction(() => /username first/.test(document.querySelector('[data-add-status]')?.textContent ?? ''));
await a.fill('#buddy-username', 'Road Runner');
await a.click('[data-username-form] button');
await a.waitForFunction(() => /Username saved/.test(document.body.textContent));
assert.equal(await a.inputValue('#buddy-username'), 'Road_Runner', 'a space becomes an underscore');

// B takes a username in Settings; a taken name is refused.
await b.goto(base + '#/settings', { waitUntil: 'load' });
await b.fill('#alias', 'road_runner');
await b.click('[data-alias-form] button');
await b.waitForFunction(() => /already has that username/.test(document.querySelector('[data-alias-status]')?.textContent ?? ''));
await b.fill('#alias', 'Brake_Light');
await b.click('[data-alias-form] button');
await b.waitForFunction(() => document.querySelector('[data-alias-status]')?.textContent === 'Saved.');

await a.fill('#buddy-add', 'nobody_here');
await a.click('[data-add-form] button');
await a.waitForFunction(() => /No one has that username/.test(document.body.textContent));
await a.fill('#buddy-add', '@brake_light');
await a.click('[data-add-form] button');
await a.waitForFunction(() => /Request sent to @brake_light/.test(document.body.textContent));
assert.match(await a.locator('.lane-sub').innerText(), /Sent[\s\S]*@Brake_Light[\s\S]*Waiting for them to accept/);
await shot(a, '1-request-sent');

// B sees only the username, accepts, and both see the duo streak.
await b.goto(base + '#/buddies', { waitUntil: 'load' });
await b.locator('[data-accept]').waitFor();
assert.match(await b.locator('.lane-sub').innerText(), /Requests[\s\S]*@Road_Runner[\s\S]*Wants to be your streak buddy/);
await shot(b, '2-incoming');
await b.click('[data-accept]');
await b.waitForFunction(() => /1-day duo streak/.test(document.body.textContent));
assert.match(await b.locator('.lane-sub').innerText(), /@Road_Runner[\s\S]*You both practiced today[\s\S]*10 XP this week/);
await shot(b, '3-buddies');
await a.reload({ waitUntil: 'load' });
await a.waitForFunction(() => /1-day duo streak/.test(document.body.textContent));

// The Group leaderboard on Home shows exactly the two buddies.
await a.goto(base + '#/home', { waitUntil: 'load' });
await a.click('#board-tab-group');
await a.waitForFunction(() => document.querySelectorAll('#board-panel .home-board-row').length === 2);
const group = await a.locator('#board-panel').innerText();
assert.match(group, /You/, "your own row is labeled You"); assert.match(group, /Brake_Light/);
await a.locator('.home-leaderboard').scrollIntoViewIfNeeded();
await a.screenshot({ path: `${out}/4-group-leaderboard.png` });

// Removing asks once, then ends the link for both.
await b.goto(base + '#/buddies', { waitUntil: 'load' });
await b.locator('[data-remove]').waitFor();
await b.click('[data-remove]');
assert.equal(await b.locator('[data-remove]').innerText(), 'Tap again to remove');
await b.click('[data-remove]');
await b.waitForFunction(() => /Add a friend above to start a duo streak/.test(document.body.textContent));
await a.goto(base + '#/buddies', { waitUntil: 'load' });
await a.reload({ waitUntil: 'load' });
await a.waitForFunction(() => /Add a friend above to start a duo streak/.test(document.body.textContent));

// Lesson comments: username or Anonymous, date and time, votes, delete your own from ⋯, no editing.
const openComments = async (page, lesson = 'lane-end-scan') => {
  await page.goto(base + `#/feed/${lesson}`, { waitUntil: 'load' }); await page.reload({ waitUntil: 'load' });
  await page.locator('.is-current [data-comments]').click();
  await page.locator('.lane-comments[open] [data-comment-list]').waitFor();
  await page.waitForFunction(() => !/Loading/.test(document.querySelector('[data-comment-list]').textContent));
};
const commentText = page => page.locator('.lane-comments[open] [data-comment-list]').innerText();
await openComments(a);
assert.match(await commentText(a), /No comments yet/);
assert.deepEqual(await a.locator('.is-current .lane-rail button').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label'))), ['Like lesson', 'Comments', 'Save lesson', 'Share lesson'], 'comments sit under the heart, above the bookmark');
assert.match(await a.locator('.lane-comments-as').innerText(), /Posting as Road_Runner/);
assert.equal(await a.locator('.is-current video').evaluate(video => video.paused), true, 'the lesson pauses while comments are open');
await a.fill('#lane-comment-input', 'Scan ten seconds ahead, not two blocks.');
await a.click('[data-comment-form] button');
await a.waitForFunction(() => /Scan ten seconds ahead/.test(document.querySelector('[data-comment-list]').textContent));
assert.match(await commentText(a), /Road_Runner\s+\w{3} \d{1,2}, \d{4}, \d{1,2}:\d{2}\s?[AP]M[\s\S]*Scan ten seconds ahead, not two blocks\.\s+0/, 'username, date and time, text and score');
// Your own comment: one upvote allowed, no downvote.
assert.equal(await a.locator('.lane-comment [data-vote="-1"]').isDisabled(), true, 'no downvoting your own comment');
await a.click('.lane-comment [data-vote="1"]');
await a.waitForFunction(() => document.querySelector('.lane-comment-votes span')?.textContent === '1');
await a.click('.lane-comment [data-vote="1"]');
await a.waitForFunction(() => document.querySelector('.lane-comment-votes span')?.textContent === '0');
await a.click('.lane-comment [data-vote="1"]');
await a.waitForFunction(() => document.querySelector('.lane-comment-votes span')?.textContent === '1');
await shot(a, '5-comment-posted');
await openComments(b);
assert.match(await commentText(b), /Road_Runner[\s\S]*Scan ten seconds ahead/);
assert.equal(await b.locator('[data-comment-menu]').count(), 0, "no delete menu on someone else's comment");
await b.click('.lane-comment [data-vote="1"]');
await b.waitForFunction(() => document.querySelector('.lane-comment-votes span')?.textContent === '2');
await b.fill('#lane-comment-input', 'Good reminder for the freeway too.');
await b.click('[data-comment-form] button');
await b.waitForFunction(() => document.querySelectorAll('.lane-comment').length === 2);
const c = await learner('C');
await c.goto(base + '#/settings', { waitUntil: 'load' });
await c.evaluate(() => localStorage.setItem('roadloop-progress', JSON.stringify({ xp: 0, clips: {}, daily: {}, liked: ['lane-end-scan'], saved: [], settings: { onboardedAt: new Date().toISOString(), goal: 'other' } })));
await openComments(c);
assert.match(await c.locator('.lane-comments-as').innerText(), /Posting as Anonymous/);
await c.fill('#lane-comment-input', 'Thanks!'); await c.click('[data-comment-form] button');
await c.waitForFunction(() => /Thanks!/.test(document.querySelector('[data-comment-list]').textContent));
assert.match(await commentText(c), /Anonymous[\s\S]*Thanks!/, 'a learner without a username shows as Anonymous');
await shot(c, '6-comments-three-learners');
await openComments(a);
assert.match(await commentText(a), /Scan ten seconds ahead[^]*?\b2\b/, 'your upvote and a buddy upvote both count');
await a.locator('[data-comment-menu]').click();
assert.deepEqual(await a.locator('.lane-comment-menu button').allInnerTexts(), ['Delete comment'], '⋯ offers delete only, no editing');
await a.locator('[data-comment-delete]').click();
await a.waitForFunction(() => !/Scan ten seconds ahead/.test(document.querySelector('[data-comment-list]').textContent));
await openComments(b);
assert.doesNotMatch(await commentText(b), /Scan ten seconds ahead/, 'deleted for everyone');

await browser.close();
assert.deepEqual(errors, []);
console.log('buddies: usernames (unique, cleaned), request by exact name, not-found, incoming request, accept, duo streak, today status, weekly XP, Group leaderboard, two-tap remove, and lesson comments (post, username or Anonymous, date and time, one self-upvote, one vote on others, delete own, no edit) passed with the real SQL functions');
