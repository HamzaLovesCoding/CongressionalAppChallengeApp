import test from 'node:test';
import assert from 'node:assert/strict';
import { configFromEnv, createClient } from '../src/data/supabase.ts';

let sequence = 0;
// Fresh store + sync modules over a fake localStorage, so every test starts from known data.
async function setup(initial = {}) {
  const items = new Map(Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)]));
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) } });
  const n = sequence++;
  const progress = await import(`../src/feed/progress.ts?sync-${n}`);
  const sync = await import(`../src/data/sync.ts?sync-${n}`);
  return { progress, sync, read: key => JSON.parse(items.get(key) ?? 'null') };
}
// A fake Supabase that records requests.
function fakeClient({ fail } = {}) {
  const calls = [];
  return { calls, client: {
    async signInAnonymously() { calls.push('signup'); return { accessToken: 'a1', refreshToken: 'r1', expiresAt: Date.now() + 3600_000, userId: 'u1' }; },
    async refresh() { calls.push('refresh'); return { accessToken: 'a2', refreshToken: 'r2', expiresAt: Date.now() + 3600_000, userId: 'u1' }; },
    async rpc(_session, fn, args) {
      calls.push(fn);
      if (fail) { const { RemoteError } = await import('../src/data/supabase.ts'); throw new RemoteError(fail, 'nope'); }
      return fn === 'sync_learner' ? { syncedAt: '2026-10-15T20:00:00.000Z', weeklyXp: 10, payload: args.payload } : [];
    },
  } };
}

test('without configuration the app is local-only and makes no requests', async () => {
  const { progress, sync } = await setup();
  const app = sync.createSync(null, ['a'], progress);
  assert.equal(app.configured, false);
  assert.deepEqual(app.status(), { state: 'local-only' });
  assert.deepEqual(await app.sync(), { state: 'local-only' });
  assert.equal(await app.leaderboard(), null);
  assert.equal(configFromEnv({}), null);
  assert.equal(configFromEnv({ VITE_SUPABASE_URL: 'http://insecure.example', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' }), null, 'https only');
  assert.deepEqual(configFromEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co/', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' }), { url: 'https://x.supabase.co', key: 'k' });
});

test('payload carries progress, events and settings but no XP total, likes or purchases', async () => {
  const { progress, sync } = await setup({ 'roadloop-progress': { xp: 999, clips: { a: { tries: 1, firstTry: true, done: true, completedAt: '2026-10-15T10:00:00.000Z' } }, daily: { [new Date().toLocaleDateString('en-CA')]: 10, '2000-01-01': 10 }, liked: ['a'], saved: [], spentXp: 15, ownedCars: ['hatchback', 'sedan'], selectedCar: 'sedan' } });
  progress.setDisplayAlias('Road_Runner');
  progress.recordAttempt({ itemId: 'a', topicId: 't', kind: 'primary', correct: true, activeMs: 5000 });
  progress.recordSimulation({ scenarioId: 'four-way-stop', topicId: 't', outcome: 'exit' });
  progress.addReviewLater('b', 't', 'menu'); progress.resolveReview('b'); progress.addReviewLater('b', 't', 'skip');
  const payload = sync.buildPayload(progress, ['a', 'b']);
  assert.deepEqual(payload.profile, { carId: 'sedan' }, 'the username is claimed separately, never through sync');
  assert.deepEqual(payload.activeDays, [new Date().toLocaleDateString('en-CA')], 'only recent practice days are sent');
  assert.deepEqual(payload.lessons.map(l => [l.id, l.done, l.completedAt]), [['a', true, '2026-10-15T10:00:00.000Z']]);
  assert.equal(payload.attempts.length, 1); assert.match(payload.attempts[0].id, /\S{8,}/);
  assert.deepEqual(payload.simulations.map(s => s.outcome), ['exit']);
  assert.deepEqual(payload.review.filter(r => r.itemId === 'b').map(r => [r.reason, r.resolvedAt]), [['skip', null]], 'latest review entry per item');
  const text = JSON.stringify(payload);
  for (const leak of ['"xp"', 'liked', 'spentXp', 'ownedCars', 'Road_Runner']) assert.ok(!text.includes(leak), `${leak} is not sent`);
});

test('a successful sync signs in once, records the time and keeps local data', async () => {
  const { progress, sync, read } = await setup();
  progress.answer('a', true);
  const { client, calls } = fakeClient();
  const app = sync.createSync(client, ['a'], progress);
  assert.equal((await app.sync()).state, 'synced');
  await app.sync();
  assert.deepEqual(calls, ['signup', 'sync_learner', 'sync_learner'], 'one anonymous session is reused');
  assert.equal(read('lane-auth').lastSyncedAt, '2026-10-15T20:00:00.000Z');
  assert.equal(progress.stats().xpTotal, 10);
});

test('offline or server failure leaves local progress untouched and reports not synced', async () => {
  const { progress, sync } = await setup();
  progress.answer('a', true);
  const { client } = fakeClient({ fail: 'offline' });
  const app = sync.createSync(client, ['a'], progress);
  assert.deepEqual(await app.sync(), { state: 'error', reason: 'offline', lastSyncedAt: null });
  assert.equal(progress.record('a').done, true);
  assert.equal(progress.stats().xpTotal, 10);
});

test('an expired access token is renewed once and the call retried, keeping the same learner', async () => {
  const { progress, sync, read } = await setup({ 'lane-auth': { session: { accessToken: 'old', refreshToken: 'r', expiresAt: Date.now() + 3600_000, userId: 'u1' } } });
  const calls = [];
  const { RemoteError } = await import('../src/data/supabase.ts');
  const client = {
    async signInAnonymously() { calls.push('signup'); return { accessToken: 'new-account', refreshToken: 'x', expiresAt: Date.now() + 3600_000, userId: 'u2' }; },
    async refresh(session) { calls.push('refresh:' + session.refreshToken); return { accessToken: 'a2', refreshToken: 'r2', expiresAt: Date.now() + 3600_000, userId: 'u1' }; },
    async rpc(session, fn) { calls.push(fn + ':' + session.accessToken); if (session.accessToken === 'old') throw new RemoteError('unauthorized', 'HTTP 401'); return { syncedAt: '2026-10-16T00:00:00.000Z' }; },
  };
  const app = sync.createSync(client, [], progress);
  assert.equal((await app.sync()).state, 'synced');
  assert.deepEqual(calls, ['sync_learner:old', 'refresh:r', 'sync_learner:a2']);
  assert.equal(read('lane-auth').session.userId, 'u1', 'no new anonymous account');
});

test('a rejected renewal starts a new session instead of failing forever', async () => {
  const { progress, sync, read } = await setup({ 'lane-auth': { session: { accessToken: 'a', refreshToken: 'used', expiresAt: Date.now() - 1000, userId: 'u1' } } });
  const { RemoteError } = await import('../src/data/supabase.ts');
  const calls = [];
  const client = {
    async signInAnonymously() { calls.push('signup'); return { accessToken: 'b', refreshToken: 'rb', expiresAt: Date.now() + 3600_000, userId: 'u2' }; },
    async refresh() { calls.push('refresh'); throw new RemoteError('unauthorized', 'Refresh token rejected'); },
    async rpc(_session, fn) { calls.push(fn); return []; },
  };
  const app = sync.createSync(client, [], progress);
  assert.deepEqual(await app.comments('lane-end-scan'), []);
  assert.deepEqual(calls, ['refresh', 'signup', 'lesson_comments_list']);
  assert.equal(read('lane-auth').session.userId, 'u2');
});

test('simultaneous calls share one renewal, and a session renewed in another tab is reused', async () => {
  const stale = { accessToken: 'a', refreshToken: 'r1', expiresAt: Date.now() - 1000, userId: 'u1' };
  const { progress, sync } = await setup({ 'lane-auth': { session: stale } });
  const calls = [];
  const client = {
    async signInAnonymously() { calls.push('signup'); throw new Error('should not sign up'); },
    async refresh(session) { calls.push('refresh:' + session.refreshToken); await new Promise(resolve => setTimeout(resolve, 20)); return { accessToken: 'a2', refreshToken: 'r2', expiresAt: Date.now() + 3600_000, userId: 'u1' }; },
    async rpc(session, fn) { calls.push(fn + ':' + session.accessToken); return []; },
  };
  const app = sync.createSync(client, [], progress);
  await Promise.all([app.comments('a'), app.leaderboard(), app.groupLeaderboard()]);
  assert.deepEqual(calls.filter(call => call.startsWith('refresh')), ['refresh:r1'], 'one renewal for three calls');
  assert.ok(calls.filter(call => !call.startsWith('refresh')).every(call => call.endsWith(':a2')));
  // Another tab renews and saves; this tab, holding the old session, picks up the saved one.
  const other = await setup({ 'lane-auth': { session: stale } });
  const tabCalls = [];
  const tab = other.sync.createSync({ ...client, async refresh() { tabCalls.push('refresh'); return stale; }, async rpc(session, fn) { tabCalls.push(fn + ':' + session.accessToken); return []; } }, [], other.progress);
  localStorage.setItem('lane-auth', JSON.stringify({ session: { accessToken: 'from-other-tab', refreshToken: 'r9', expiresAt: Date.now() + 3600_000, userId: 'u1' } }));
  await tab.comments('a');
  assert.deepEqual(tabCalls, ['lesson_comments_list:from-other-tab'], 'no second renewal with an already-used token');
});

test('concurrent sync calls share one request', async () => {
  const { progress, sync } = await setup();
  const { client, calls } = fakeClient();
  const app = sync.createSync(client, [], progress);
  await Promise.all([app.sync(), app.sync(), app.sync()]);
  assert.equal(calls.filter(call => call === 'sync_learner').length, 1);
});

test('the fetch client sends the publishable key and bearer token, never anything else', async () => {
  const seen = [];
  const fetcher = async (url, init) => { seen.push({ url, init }); return new Response(JSON.stringify(url.includes('signup') ? { access_token: 't', refresh_token: 'r', expires_in: 3600, user: { id: 'u' } } : { ok: true }), { status: 200 }); };
  const client = createClient({ url: 'https://x.supabase.co', key: 'pub' }, fetcher, () => 0);
  const session = await client.signInAnonymously();
  await client.rpc(session, 'sync_learner', { payload: {} });
  assert.equal(seen[0].url, 'https://x.supabase.co/auth/v1/signup');
  assert.equal(seen[1].url, 'https://x.supabase.co/rest/v1/rpc/sync_learner');
  assert.equal(seen[1].init.headers.apikey, 'pub');
  assert.equal(seen[1].init.headers.Authorization, 'Bearer t');
  const failing = createClient({ url: 'https://x.supabase.co', key: 'pub' }, async () => { throw new TypeError('offline'); });
  await assert.rejects(failing.signInAnonymously(), error => error.reason === 'offline');
});

test('buddy calls use the validated functions and fail quietly without a connection', async () => {
  const { sync } = await setup();
  const calls = [];
  const client = {
    async signInAnonymously() { return { accessToken: 't', refreshToken: 'r', expiresAt: Date.now() + 3600_000, userId: 'u' }; },
    async refresh(session) { return session; },
    async rpc(_session, fn, args) { calls.push([fn, args]); if (fn === 'sync_learner') return { syncedAt: new Date().toISOString() }; if (fn === 'request_buddy') return 'sent'; if (fn === 'set_username') return 'taken'; if (fn === 'my_buddies') return []; return true; },
  };
  const instance = sync.createSync(client, ['a']);
  assert.equal(await instance.setUsername('Road_Runner'), 'taken');
  assert.equal(await instance.requestBuddy('Brake_Light'), 'sent');
  assert.deepEqual(await instance.buddies(), []);
  assert.deepEqual(calls.map(([fn]) => fn), ['set_username', 'request_buddy', 'sync_learner', 'my_buddies'], 'buddies syncs first so streaks are current');
  assert.deepEqual(calls[1][1], { username: 'Brake_Light' });
  const local = sync.createSync(null, ['a']);
  assert.equal(await local.requestBuddy('x'), 'offline');
  assert.equal(await local.buddies(), null);
});

test('comment calls use the validated functions and fail quietly without a connection', async () => {
  const { sync } = await setup();
  const calls = [];
  const client = {
    async signInAnonymously() { return { accessToken: 't', refreshToken: 'r', expiresAt: Date.now() + 3600_000, userId: 'u' }; },
    async refresh(session) { return session; },
    async rpc(_session, fn, args) { calls.push([fn, args]); if (fn === 'lesson_comments_list') return [{ id: 'c1', author: null, body: 'Hi', created_at: '2026-10-16T20:00:00Z', score: 0, my_vote: null, is_mine: true }]; if (fn === 'post_comment') return 'ok'; return true; },
  };
  const instance = sync.createSync(client, ['a']);
  assert.equal((await instance.comments('lane-end-scan'))[0].author, null);
  assert.equal(await instance.postComment('lane-end-scan', 'Scan ahead'), 'ok');
  assert.equal(await instance.voteComment('c1', -1), 'ok');
  assert.equal(await instance.deleteComment('c1'), 'ok');
  assert.deepEqual(calls, [['lesson_comments_list', { lesson: 'lane-end-scan' }], ['post_comment', { lesson: 'lane-end-scan', message: 'Scan ahead' }], ['vote_comment', { comment: 'c1', vote: -1 }], ['delete_comment', { comment: 'c1' }]]);
  const failing = sync.createSync({ ...client, async rpc() { throw new Error('offline'); } }, ['a']);
  assert.equal(await failing.comments('x'), null);
  assert.equal(await failing.postComment('x', 'y'), 'offline');
  assert.equal(await failing.voteComment('c1', 1), 'offline');
  const refusing = sync.createSync({ ...client, async rpc() { return false; } }, ['a']);
  assert.equal(await refusing.voteComment('c1', -1), 'refused', 'a turned-down vote is not reported as a connection problem');
  assert.equal(await refusing.deleteComment('c1'), 'refused');
  const local = sync.createSync(null, ['a']);
  assert.equal(await local.postComment('x', 'y'), 'offline');
  assert.equal(await local.comments('x'), null);
});

test('the fetch client reports a rejected renewal token as unauthorized', async () => {
  const client = createClient({ url: 'https://example.supabase.co', key: 'k' }, async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }));
  await assert.rejects(client.refresh({ accessToken: 'a', refreshToken: 'used', expiresAt: 0, userId: 'u' }), error => error.reason === 'unauthorized');
});

test('a username chosen offline is claimed before the next backup, once', async () => {
  const { progress, sync } = await setup({});
  const calls = [];
  const client = {
    async signInAnonymously() { return { accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 3600_000, userId: 'u1' }; },
    async refresh() { throw new Error('unused'); },
    async rpc(_session, fn, args) { calls.push(fn === 'set_username' ? `${fn}:${args.new_name}` : fn); return fn === 'sync_learner' ? { syncedAt: new Date().toISOString() } : 'ok'; },
  };
  const app = sync.createSync(client, [], progress);
  app.claimLater('Road_Runner');
  await app.sync();
  await app.sync();
  assert.deepEqual(calls, ['set_username:Road_Runner', 'sync_learner', 'sync_learner']);
});

// A fake server for username tests: set_username answers from `answers`, everything else succeeds.
function usernameClient(calls, answers = {}) {
  return {
    async signInAnonymously() { return { accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 3600_000, userId: 'u1' }; },
    async refresh() { throw new Error('unused'); },
    async rpc(_session, fn, args) {
      calls.push(fn === 'set_username' ? `${fn}:${args.new_name}` : fn);
      if (fn === 'set_username') return answers[args.new_name] ?? 'ok';
      return fn === 'sync_learner' ? { syncedAt: new Date().toISOString() } : null;
    },
  };
}

test('a name saved later replaces one waiting from offline onboarding', async () => {
  const { progress, sync } = await setup({});
  const calls = [];
  const app = sync.createSync(usernameClient(calls), [], progress);
  app.claimLater('Old_Name');
  assert.equal(await app.setUsername('New_Name'), 'ok');
  await app.sync();
  assert.deepEqual(calls, ['set_username:New_Name', 'sync_learner'], 'the stale name is never sent');
});

test('a waiting name someone else took is dropped on this device too', async () => {
  const { progress, sync } = await setup({});
  progress.setDisplayAlias('Taken_Name');
  const app = sync.createSync(usernameClient([], { Taken_Name: 'taken' }), [], progress);
  app.claimLater('Taken_Name');
  await app.sync();
  assert.equal(progress.settings().displayAlias, null);
});

test('after deleting backed-up data, the next backup reclaims the username', async () => {
  const { progress, sync } = await setup({});
  progress.setDisplayAlias('Road_Runner');
  const calls = [];
  const app = sync.createSync(usernameClient(calls), [], progress);
  await app.sync();
  assert.equal(await app.deleteRemote(), true);
  await app.sync();
  assert.deepEqual(calls, ['sync_learner', 'delete_my_data', 'set_username:Road_Runner', 'sync_learner']);
});

test('ensureUsername claims the local name, and clears it when taken', async () => {
  const { progress, sync } = await setup({});
  progress.setDisplayAlias('Mine');
  assert.equal(await sync.createSync(usernameClient([]), [], progress).ensureUsername(), 'ok');
  assert.equal(progress.settings().displayAlias, 'Mine');
  assert.equal(await sync.createSync(usernameClient([], { Mine: 'taken' }), [], progress).ensureUsername(), 'taken');
  assert.equal(progress.settings().displayAlias, null);
});
