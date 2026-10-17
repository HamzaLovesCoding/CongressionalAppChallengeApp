// Applies every Lane migration, in order, to PGlite (Postgres in WASM) with Supabase auth/role shims,
// then checks ownership, idempotency, XP validation, usernames, leaderboard field exposure and
// streak buddies (requests, acceptance, duo streaks, group leaderboard) with three learners.
// Needs PGlite, which is not a project dependency: npm install --no-save @electric-sql/pglite@0.5.8
const { PGlite } = await import(process.env.PGLITE_MODULE ?? '@electric-sql/pglite');
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = new URL('../migrations/', import.meta.url);
const migrations = readdirSync(dir).filter(name => name.endsWith('.sql')).sort().map(name => readFileSync(new URL(name, dir), 'utf8'));
const db = new PGlite();
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222', C = '33333333-3333-4333-8333-333333333333', D = '44444444-4444-4444-8444-444444444444';
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth; create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
  insert into auth.users values ('${A}'), ('${B}'), ('${C}'), ('${D}');
  -- Hosted Supabase grants execute on every new public function to anon and authenticated.
  alter default privileges in schema public grant execute on functions to anon, authenticated;`);
for (const sql of migrations) await db.exec(sql);
const results = [];
const ok = (name) => { results.push(`PASS ${name}`); };
async function as(role, sub, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${sub ?? ''}', false); set role ${role};`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}
async function denied(role, sub, sql, params) {
  try { await as(role, sub, sql, params); return false; } catch (error) { return /permission denied|not signed in|violates row-level/i.test(error.message); }
}
const now = new Date().toISOString();
const payload = {
  profile: { alias: 'Road Runner', carId: 'sedan' },
  settings: { permitTestDate: '2026-11-20', dailyGoal: 30 },
  lessons: [
    { id: 'lane-end-scan', tries: 1, firstTry: true, done: true, completedAt: now, watchedRatio: 0.95, keySegmentSeen: true },
    { id: 'dark-signal', tries: 2, firstTry: false, done: true, completedAt: now },
    { id: 'not-a-lesson', tries: 1, done: true },
    { id: 'front-curb', tries: 1, done: false, watchedRatio: 0.4 },
  ],
  attempts: [
    { id: 'attempt-aaaa-0001', lessonId: 'lane-end-scan', topicId: 'road-awareness', kind: 'primary', correct: true, activeMs: 12000, at: now },
    { id: 'attempt-aaaa-0002', lessonId: 'not-a-lesson', topicId: 'x', kind: 'primary', correct: true, activeMs: 1, at: now },
    { id: 'attempt-aaaa-0003', lessonId: 'dark-signal', topicId: 'right-of-way', kind: 'cheat', correct: true, activeMs: 1, at: now },
    { id: 'attempt-aaaa-0004', lessonId: 'dark-signal', topicId: 'right-of-way', kind: 'similar', correct: true, activeMs: 9000, at: now },
  ],
  simulations: [
    { id: 'sim-aaaa-0001', scenarioId: 'four-way-stop', topicId: 'all-way-stop-right-of-way', outcome: 'unsafe', chosenAction: 'go-first', elapsedSeconds: 6, at: now },
    { id: 'sim-aaaa-0002', scenarioId: 'not-a-sim', topicId: 't', outcome: 'safe', at: now },
  ],
  topics: [{ id: 'road-awareness', mastery: 0.82, attempts: 1, correct: 1 }],
  review: [{ itemId: 'sim:four-way-stop', topicId: 'all-way-stop-right-of-way', reason: 'sim-unsafe', addedAt: now }],
  xp: 9999,
};

// 1. Anonymous (no session) and anon role cannot write or read.
assert.ok(await denied('anon', null, 'select public.sync_learner($1::jsonb)', [JSON.stringify(payload)])); ok('anon role cannot call sync_learner');
assert.ok(await denied('authenticated', null, 'select public.sync_learner($1::jsonb)', [JSON.stringify(payload)])); ok('authenticated without a user id is refused');
assert.ok(await denied('anon', null, 'select * from public.profiles')); ok('anon role cannot read profiles');

// Usernames are claimed through set_username(), never through sync.
assert.equal((await as('authenticated', A, "select public.set_username('Road_Runner') r")).rows[0].r, 'ok'); ok('a learner claims a username');
// 2. Learner A syncs; invalid lesson/attempt/sim rows are dropped; XP comes from the catalog only.
const first = await as('authenticated', A, 'select public.sync_learner($1::jsonb) as r', [JSON.stringify(payload)]);
assert.equal(first.rows[0].r.weeklyXp, 0); ok('no XP until the server has a correct answer for the lesson (client xp field ignored)');
await as('authenticated', A, 'select public.sync_learner($1::jsonb)', [JSON.stringify(payload)]);
const again = await as('authenticated', A, 'select public.sync_learner($1::jsonb) as r', [JSON.stringify(payload)]);
assert.equal(again.rows[0].r.weeklyXp, 20); ok('each completion with a recorded correct answer earns 10 XP, once (idempotent)');
const claimOnly = await as('authenticated', A, 'select public.sync_learner($1::jsonb) as r', [JSON.stringify({ lessons: [{ id: 'front-curb', tries: 1, done: true, completedAt: now }] })]);
assert.equal(claimOnly.rows[0].r.weeklyXp, 20); ok('a lesson marked done with no correct answer earns no XP');
assert.equal((await as('authenticated', A, 'select count(*)::int n from public.learning_events')).rows[0].n, 2); ok('attempt events are idempotent and invalid ones rejected');
assert.equal((await as('authenticated', A, 'select count(*)::int n from public.simulation_attempts')).rows[0].n, 1); ok('simulation events are idempotent and unknown scenarios rejected');
assert.equal((await as('authenticated', A, "select count(*)::int n from public.content_progress where lesson_id = 'not-a-lesson'")).rows[0].n, 0); ok('unknown lessons are not stored');

// 3. Progress never shrinks.
await as('authenticated', A, 'select public.sync_learner($1::jsonb)', [JSON.stringify({ ...payload, lessons: [{ id: 'lane-end-scan', tries: 0, done: false, watchedRatio: 0.1 }] })]);
const kept = (await as('authenticated', A, "select done, watched_ratio from public.content_progress where lesson_id = 'lane-end-scan'")).rows[0];
assert.equal(kept.done, true); assert.ok(kept.watched_ratio > 0.9); ok('empty or older data never overwrites completion or watch coverage');

// 4. Bad usernames and cars are refused or stored as null, never as markup; names are unique.
const bPayload = JSON.stringify({ profile: { alias: '<script>x</script>', carId: 'tank' }, lessons: [{ id: 'school-bus', tries: 1, done: true, completedAt: now }], attempts: [{ id: 'attempt-bbbb-0001', lessonId: 'school-bus', topicId: 'sharing-the-road', kind: 'primary', correct: true, activeMs: 8000, at: now }] });
// Twice: XP for a completion arrives on the backup after its correct answer is stored.
await as('authenticated', B, 'select public.sync_learner($1::jsonb)', [bPayload]);
await as('authenticated', B, 'select public.sync_learner($1::jsonb)', [bPayload]);
const bProfile = (await as('authenticated', B, 'select alias, car_id from public.profiles')).rows[0];
assert.equal(bProfile.alias, null); assert.equal(bProfile.car_id, null); ok('sync never sets a username; an invalid car is stored as null');
assert.equal((await as('authenticated', B, "select public.set_username('<b>x</b>') r")).rows[0].r, 'invalid'); ok('markup or spaces in a username are refused');
assert.equal((await as('authenticated', B, "select public.set_username('road_runner') r")).rows[0].r, 'taken'); ok('usernames are unique ignoring case');

// 5. Own-row reads only.
const bSees = await as('authenticated', B, 'select user_id from public.content_progress');
assert.ok(bSees.rows.every(row => row.user_id === B)); ok('learner B reads only their own progress rows');
assert.equal((await as('authenticated', B, "select count(*)::int n from public.learning_events where lesson_id <> 'school-bus'")).rows[0].n, 0); ok("learner B cannot read A's events");
assert.equal((await as('authenticated', B, 'select count(*)::int n from public.profiles')).rows[0].n, 1); ok("learner B cannot read A's profile");

// 6. No direct writes, including XP.
assert.ok(await denied('authenticated', B, `insert into public.xp_events (user_id, lesson_id, reason, points) values ('${B}', 'yellow-light', 'lesson_completed', 50)`)); ok('learners cannot insert XP directly');
assert.ok(await denied('authenticated', B, `update public.profiles set alias = 'Hacked' where user_id = '${A}'`)); ok("learners cannot update another learner's profile");
assert.ok(await denied('authenticated', B, `delete from public.content_progress where user_id = '${A}'`)); ok('learners cannot delete rows directly');

// 7. Leaderboard exposes only rank, alias, car, xp, is_you; B without alias still sees own row.
const board = await as('authenticated', B, 'select * from public.weekly_leaderboard(10)');
assert.deepEqual(Object.keys(board.rows[0]).sort(), ['alias', 'car_id', 'is_you', 'rank', 'xp']); ok('leaderboard returns only rank, alias, car_id, xp, is_you');
assert.deepEqual(board.rows.map(row => [row.rank, row.alias, row.xp, row.is_you]), [[1, 'Road_Runner', 20, false], [2, null, 10, true]]); ok('leaderboard ranks by verified weekly XP and pins the caller');
const aBoard = await as('authenticated', A, 'select * from public.weekly_leaderboard(10)');
assert.deepEqual(aBoard.rows.map(row => [row.alias, row.xp, row.is_you]), [['Road_Runner', 20, true], [null, 10, false]]); ok('learners without a username appear to others as an anonymous row with their XP');

// 8. Streak buddies.
const call = async (who, sql) => (await as('authenticated', who, sql)).rows;
assert.equal((await call(B, "select public.request_buddy('Road_Runner') r"))[0].r, 'need-username'); ok('a learner must pick a username before adding buddies');
await call(B, "select public.set_username('Brake_Light')");
await call(C, "select public.set_username('Curb_Side')");
assert.equal((await call(B, "select public.request_buddy('nobody_here') r"))[0].r, 'not-found'); ok('an unknown username is reported as not found');
assert.equal((await call(B, "select public.request_buddy('brake_light') r"))[0].r, 'self'); ok('a learner cannot add themselves');
assert.equal((await call(B, "select public.request_buddy('road_runner') r"))[0].r, 'sent'); ok('a request is sent by exact username (any case)');
assert.equal((await call(B, "select public.request_buddy('Road_Runner') r"))[0].r, 'already'); ok('a second request to the same learner is not duplicated');
let aList = await call(A, 'select * from public.my_buddies()');
assert.deepEqual(aList.map(row => [row.username, row.relation, row.car_id]), [['Brake_Light', 'incoming', null]]); ok('the other learner sees an incoming request with only a username');
assert.equal((await call(C, 'select count(*)::int n from public.buddy_links'))[0].n, 0); ok('a third learner cannot see the request');
assert.equal((await call(C, `select public.respond_buddy('${aList[0].link_id}', true) r`))[0].r, false); ok('only the addressee can accept');
assert.ok(await denied('authenticated', B, `update public.buddy_links set status = 'accepted'`)); ok('learners cannot accept by writing the table directly');
assert.equal((await call(A, `select public.respond_buddy('${aList[0].link_id}', true) r`))[0].r, true); ok('the addressee accepts');
// Both practiced today and yesterday; A also practiced the day before, B did not.
const day = n => `(select public.lane_today() - ${n})`;
await db.exec(`insert into public.activity_days values ('${A}', ${day(0)}), ('${A}', ${day(1)}), ('${A}', ${day(2)}), ('${B}', ${day(0)}), ('${B}', ${day(1)}), ('${B}', ${day(3)})`);
aList = await call(A, 'select * from public.my_buddies()');
assert.deepEqual(Object.keys(aList[0]).sort(), ['car_id', 'duo_streak', 'link_id', 'relation', 'them_today', 'username', 'weekly_xp', 'you_today']); ok('buddy rows expose only username, car, streak, today flags and weekly XP');
assert.deepEqual(aList.map(row => [row.username, row.relation, row.duo_streak, row.you_today, row.them_today]), [['Brake_Light', 'buddy', 2, true, true]]); ok('the duo streak counts consecutive days both practiced');
const group = await call(B, 'select * from public.group_leaderboard()');
assert.deepEqual(group.map(row => [row.alias, row.is_you]), [['Road_Runner', false], ['Brake_Light', true]]); ok('the group leaderboard holds the learner and accepted buddies only');
assert.deepEqual((await call(C, 'select * from public.group_leaderboard()')).map(row => row.alias), ['Curb_Side']); ok('a learner without buddies sees only themselves');
await call(C, "select public.request_buddy('Brake_Light')");
const bList = await call(B, 'select * from public.my_buddies()');
const incoming = bList.find(row => row.relation === 'incoming');
assert.equal(incoming.username, 'Curb_Side');
await call(B, `select public.respond_buddy('${incoming.link_id}', false)`);
assert.equal((await call(C, 'select count(*)::int n from public.my_buddies()'))[0].n, 0); ok('declining removes the request quietly');
assert.equal((await call(B, `select public.remove_buddy('${aList[0].link_id}') r`))[0].r, true); ok('either buddy can remove the link');
assert.equal((await call(A, 'select count(*)::int n from public.my_buddies()'))[0].n, 0);
assert.equal((await call(A, "select public.request_buddy('Brake_Light') r"))[0].r, 'sent');
assert.equal((await call(B, "select public.request_buddy('Road_Runner') r"))[0].r, 'accepted'); ok('adding someone who already asked you accepts their request');

// Internal helpers stay closed even with Supabase's default execute grant (duo_streak takes any two IDs).
for (const sql of [`select public.duo_streak('${B}', '${C}')`, 'select public.lane_today()', "select public.lane_past('2026-01-01')"]) {
  assert.ok(await denied('authenticated', A, sql), sql); assert.ok(await denied('anon', null, sql), sql);
}
ok('helper functions (duo_streak, lane_today, lane_past) cannot be called directly');

// Lesson comments.
const list = async (who, lesson = 'lane-end-scan') => call(who, `select * from public.lesson_comments_list('${lesson}')`);
const post = async (who, text, lesson = 'lane-end-scan') => (await as('authenticated', who, 'select public.post_comment($1, $2) r', [lesson, text])).rows[0].r;
assert.equal(await post(A, '  Scan   ten seconds ahead!  '), 'ok'); ok('a learner posts a comment');
assert.equal(await post(A, '   '), 'invalid'); assert.equal(await post(A, 'x'.repeat(301)), 'invalid'); assert.equal(await post(A, 'hi', 'not-a-lesson'), 'invalid');
ok('empty, over 300 characters or unknown-lesson comments are refused');
let commentRows = await list(B);
assert.deepEqual(Object.keys(commentRows[0]).sort(), ['author', 'body', 'created_at', 'id', 'is_mine', 'my_vote', 'score']); ok('comments expose only username, text, time, score, your vote and whether it is yours');
assert.equal(commentRows[0].author, 'Road_Runner'); assert.equal(commentRows[0].body, 'Scan ten seconds ahead!'); assert.equal(commentRows[0].is_mine, false); assert.equal(commentRows[0].score, 0); assert.equal(commentRows[0].my_vote, null);
assert.equal((await list(A))[0].is_mine, true); ok('comments show the author username and mark your own');
await call(C, "select public.set_username(null)");
assert.equal(await post(C, 'Good reminder'), 'ok');
assert.equal((await list(B)).find(row => row.body === 'Good reminder').author, null); ok('a learner without a username shows as Anonymous (null author)');
await call(C, "select public.set_username('Curb_Side')");
const commentId = commentRows[0].id;
assert.equal((await call(B, `select public.vote_comment('${commentId}', 1) r`))[0].r, true);
assert.equal((await call(C, `select public.vote_comment('${commentId}', -1) r`))[0].r, true);
assert.equal((await list(A)).find(row => row.id === commentId).score, 0);
await call(C, `select public.vote_comment('${commentId}', 1)`);
assert.equal((await list(B)).find(row => row.id === commentId).score, 2); assert.equal((await list(B)).find(row => row.id === commentId).my_vote, 1); ok('up and down votes count once per learner and can change');
await call(B, `select public.vote_comment('${commentId}', 0)`);
assert.equal((await list(A)).find(row => row.id === commentId).score, 1); ok('a vote can be cleared');
assert.equal((await call(A, `select public.vote_comment('${commentId}', -1) r`))[0].r, false); ok('no downvoting your own comment');
assert.equal((await call(A, `select public.vote_comment('${commentId}', 1) r`))[0].r, true);
assert.equal((await call(A, `select public.vote_comment('${commentId}', 1) r`))[0].r, true);
assert.equal((await list(B)).find(row => row.id === commentId).score, 2); assert.equal((await list(A)).find(row => row.id === commentId).my_vote, 1); ok('one self-upvote on your own comment, counted once');
await call(A, `select public.vote_comment('${commentId}', 0)`);
assert.equal((await list(B)).find(row => row.id === commentId).score, 1); ok('a self-upvote can be cleared');
assert.equal((await call(B, `select public.vote_comment('${commentId}', 5) r`))[0].r, false); assert.equal((await call(B, `select public.vote_comment(gen_random_uuid(), 1) r`))[0].r, false); ok('votes are only -1, 0 or 1, on comments that exist');
assert.equal((await call(B, `select public.delete_comment('${commentId}') r`))[0].r, false); ok("a learner can't delete someone else's comment");
assert.equal((await call(A, `select public.delete_comment('${commentId}') r`))[0].r, true);
assert.equal((await list(B)).some(row => row.id === commentId), false); ok('the author deletes their comment and its votes go with it');
for (let i = 0; i < 29; i++) await post(C, `note ${i}`, 'high-beams');
assert.equal(await post(C, 'one more', 'high-beams'), 'limit'); ok('30 comments per learner per day');
for (const sql of ["select * from public.lesson_comments_list('lane-end-scan')", "select public.post_comment('lane-end-scan', 'hi')"]) assert.ok(await denied('anon', null, sql), sql);
assert.ok(await denied('authenticated', B, 'select * from public.lesson_comments')); assert.ok(await denied('authenticated', B, "insert into public.comment_votes values (gen_random_uuid(), gen_random_uuid(), 1)"));
ok('comments need a signed-in learner and the tables have no direct access');
assert.equal(await post(A, 'Before deleting my data'), 'ok');

// 8c. Code groups.
const created = (await call(A, 'select public.create_group() r'))[0].r;
assert.equal(created.status, 'ok'); assert.match(created.code, /^[A-HJ-NP-Z2-9]{6}$/); ok('a learner with a username makes a group and gets a 6-character code');
const code = created.code;
assert.ok(await denied('authenticated', B, 'select * from public.code_groups')); assert.ok(await denied('authenticated', B, 'select * from public.code_group_members'));
assert.ok(await denied('authenticated', B, `insert into public.code_group_members select id, '${B}' from public.code_groups`)); ok('group tables have no direct reads or writes');
assert.ok(await denied('anon', null, `select public.join_group('${code}')`)); ok('anon role cannot join a group');
assert.equal((await call(B, `select public.join_group('${code.toLowerCase().slice(0, 3)} ${code.slice(3)}') r`))[0].r, 'joined'); ok('a friend joins by code (any case, spaces ignored)');
assert.equal((await call(B, `select public.join_group('${code}') r`))[0].r, 'already'); ok('joining twice is reported, not duplicated');
assert.equal((await call(B, "select public.join_group('ZZZZZZ') r"))[0].r, 'not-found'); ok('an unknown code is not found');
assert.equal((await call(B, "select public.join_group('IO01') r"))[0].r, 'invalid'); ok('a malformed code is invalid');
const gBoard = await call(B, `select * from public.code_group_leaderboard('${code}')`);
assert.deepEqual(Object.keys(gBoard[0]).sort(), ['alias', 'car_id', 'is_you', 'rank', 'xp']); ok('group leaderboard returns only rank, alias, car_id, xp, is_you');
assert.deepEqual(gBoard.map(row => [row.alias, row.is_you]), [['Road_Runner', false], ['Brake_Light', true]]); ok('the group leaderboard ranks its members by weekly XP');
assert.equal((await call(C, `select * from public.code_group_leaderboard('${code}')`)).length, 0); ok('a non-member cannot read a group leaderboard');
assert.deepEqual((await call(B, 'select * from public.my_groups()')).map(row => [row.code, row.name, row.members, row.is_owner]), [[code, "Road_Runner's group", 2, false]]); ok('my_groups lists the code, name, size and ownership');
assert.equal((await call(A, 'select public.leave_group($$' + code + '$$) r'))[0].r, true);
assert.deepEqual((await call(B, `select * from public.code_group_leaderboard('${code}')`)).map(row => row.alias), ['Brake_Light']); ok('a member who leaves drops off the board; the group stays');
assert.equal((await call(B, `select public.leave_group('${code}') r`))[0].r, true);
assert.equal((await call(C, `select public.join_group('${code}') r`))[0].r, 'not-found'); ok('the last member out deletes the group and its code stops working');
assert.equal((await call(D, 'select public.create_group() r'))[0].r.status, 'need-username'); assert.equal((await call(D, `select public.join_group('ABCDEF') r`))[0].r, 'need-username'); ok('a username is required to make or join a group');
for (let i = 0; i < 5; i++) await call(C, 'select public.create_group()');
assert.equal((await call(C, 'select public.create_group() r'))[0].r.status, 'limit'); ok('making groups is rate limited');
const keptCode = (await call(C, 'select * from public.my_groups()'))[0].code;
assert.equal((await call(A, `select public.join_group('${keptCode}') r`))[0].r, 'joined');

// 9. Delete my data.
await as('authenticated', A, 'select public.delete_my_data()');
assert.equal((await as('authenticated', A, 'select count(*)::int n from public.xp_events')).rows[0].n, 0); ok('delete_my_data erases the caller rows');
assert.equal((await as('authenticated', B, 'select count(*)::int n from public.xp_events')).rows[0].n, 1); ok("delete_my_data leaves other learners' rows");
assert.equal((await as('authenticated', B, 'select count(*)::int n from public.buddy_links')).rows[0].n, 0); ok('delete_my_data removes buddy links on both sides');
assert.equal((await as('authenticated', A, 'select count(*)::int n from public.activity_days')).rows[0].n, 0); ok('delete_my_data removes practice days');
assert.equal((await list(B)).some(row => row.body === 'Before deleting my data'), false); ok('delete_my_data removes the learner comments');
assert.deepEqual((await call(C, `select * from public.code_group_leaderboard('${keptCode}')`)).map(row => row.alias), ['Curb_Side']); ok('delete_my_data leaves every group');

console.log(results.join('\n'));
console.log(`${results.length} checks passed on ${(await db.query('select version() v')).rows[0].v.split(' on ')[0]}`);
