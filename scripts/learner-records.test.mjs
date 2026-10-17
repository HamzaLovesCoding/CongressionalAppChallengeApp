import test from 'node:test';
import assert from 'node:assert/strict';

let sequence = 0;
async function store(initial = null, { unavailable = false, raw: rawText } = {}) {
  let raw = rawText ?? (initial === null ? null : JSON.stringify(initial));
  let writes = 0;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => raw, setItem: (_key, value) => { if (unavailable) throw new Error('Storage unavailable'); raw = value; writes++; } } });
  const api = await import(`../src/feed/progress.ts?records-${sequence++}`);
  return { api, saved: () => JSON.parse(raw), writes: () => writes };
}
const legacy = { xp: 40, clips: { 'yellow-light': { done: true, tries: 1, firstTry: true }, roundabout: { done: true, tries: 2, firstTry: false } }, daily: { '2026-10-10': 20, '2026-10-11': 20 }, liked: ['yellow-light'], saved: ['roundabout'], dailyGoal: 30, spentXp: 10, ownedAvatars: ['sprout', 'sunny'], selectedAvatar: 'sunny', ownedCars: ['hatchback', 'sedan'], selectedCar: 'sedan', futureField: { kept: true } };

test('old saves load with safe defaults and are not rewritten by reading', async () => {
  const { api, saved, writes } = await store(legacy);
  assert.deepEqual(api.settings(), { permitTestDate: null, displayAlias: null });
  assert.deepEqual(api.reviewQueue(), []);
  assert.deepEqual(api.topicRecord('signals'), { mastery: null, lastPracticedAt: null, attempts: 0, correct: 0, skips: 0, help: 0, retries: 0, reviewAttempts: 0, reviewCorrect: 0 });
  assert.deepEqual(api.videoRecord('lesson-01'), { maxWatchedRatio: 0, keySegmentSeen: false, ended: false, skips: 0, lastWatchedAt: null });
  assert.deepEqual(api.attempts(), []);
  assert.deepEqual(api.simulations(), []);
  assert.equal(api.stats().xpTotal, 40);
  assert.deepEqual(api.avatarState(), { owned: ['sprout', 'sunny'], selected: 'sunny', spent: 10, available: 30 });
  assert.equal(api.carState().selected, 'sedan');
  assert.equal(writes(), 0);
  assert.deepEqual(saved(), legacy);
});

test('new records are added beside every legacy field without loss', async () => {
  const { api, saved } = await store(legacy);
  const at = new Date('2026-10-12T10:00:00Z');
  api.addReviewLater('lesson-01', 'road-awareness', 'menu', at);
  api.recordAttempt({ itemId: 'lesson-01', topicId: 'road-awareness', kind: 'primary', correct: false, activeMs: 12000 }, at);
  api.recordAttempt({ itemId: 'lesson-01', topicId: 'road-awareness', kind: 'similar', correct: true, activeMs: 9000 }, at);
  api.recordHelp('road-awareness');
  api.recordWatch('lesson-01', { watchedRatio: 0.6, keySegmentSeen: false, ended: false }, at);
  api.recordWatch('lesson-01', { watchedRatio: 0.3, keySegmentSeen: true, ended: false }, at);
  api.recordMastery('road-awareness', 0.5, at);
  api.recordMastery('road-awareness', 1, at);
  assert.ok(api.setPermitTestDate('2026-12-01'));
  const after = saved();
  for (const [key, value] of Object.entries(legacy)) assert.deepEqual(after[key], value, `${key} preserved`);
  assert.equal(api.reviewQueue().length, 1);
  const topic = api.topicRecord('road-awareness');
  assert.equal(topic.attempts, 2); assert.equal(topic.correct, 1); assert.equal(topic.retries, 1); assert.equal(topic.help, 1);
  assert.ok(Math.abs(topic.mastery - 0.65) < 1e-9, 'smoothed 0.7·0.5 + 0.3·1');
  assert.deepEqual(api.videoRecord('lesson-01'), { maxWatchedRatio: 0.6, keySegmentSeen: true, ended: false, skips: 0, lastWatchedAt: at.toISOString() });
  assert.equal(api.settings().permitTestDate, '2026-12-01');
});

test('first session ends once and stays ended', async () => {
  const { api, saved } = await store();
  api.completeFirstSession(new Date('2026-10-12T00:00:00Z'));
  api.completeFirstSession(new Date('2027-01-01T00:00:00Z'));
  assert.equal(saved().firstSessionCompletedAt, '2026-10-12T00:00:00.000Z');
});

test('review later is deduplicated and resolving keeps history', async () => {
  const { api } = await store();
  assert.equal(api.addReviewLater('a', 't', 'skip'), true);
  assert.equal(api.addReviewLater('a', 't', 'menu'), false);
  assert.equal(api.resolveReview('a'), true);
  assert.equal(api.reviewQueue().length, 0);
  assert.equal(api.addReviewLater('a', 't', 'menu'), true, 'can be queued again later');
});

test('permit date accepts only real calendar dates or clearing', async () => {
  const { api } = await store();
  for (const bad of ['2026-02-30', '12/01/2026', '2026-13-01', '', 'tomorrow']) assert.equal(api.setPermitTestDate(bad), false, bad);
  assert.equal(api.setPermitTestDate('2028-02-29'), true);
  assert.equal(api.setPermitTestDate(null), true);
  assert.equal(api.settings().permitTestDate, null);
});

test('simulation outcomes follow success, not the callback; unsafe, timeout and exit queue review and are not mastery', async () => {
  const { api } = await store();
  const sim = { scenarioId: 'four-way-stop', topicId: 'all-way-stop-right-of-way' };
  api.recordSimulation({ ...sim, outcome: 'retry' });
  assert.equal(api.reviewQueue().length, 0, 'a retry alone queues nothing');
  api.recordSimulation({ ...sim, outcome: 'unsafe', chosenAction: 'go-first', elapsedSeconds: 6.2 });
  api.recordSimulation({ ...sim, outcome: 'timeout', chosenAction: 'timeout', elapsedSeconds: 7 });
  api.recordSimulation({ ...sim, outcome: 'exit' });
  assert.deepEqual(api.simulations().map(item => item.outcome), ['retry', 'unsafe', 'timeout', 'exit']);
  assert.deepEqual(api.reviewQueue().map(item => [item.itemId, item.reason]), [['sim:four-way-stop', 'sim-unsafe']], 'one review item, not duplicates');
  assert.equal(api.topicRecord('all-way-stop-right-of-way').mastery, null);
  assert.equal(api.stats().xpTotal, 0, 'simulations never award XP');
  api.recordSimulation({ ...sim, outcome: 'safe', chosenAction: 'yield-right', elapsedSeconds: 4 });
  assert.equal(api.reviewQueue().length, 0, 'a safe run resolves the review item');
  api.recordSimulation({ ...sim, outcome: 'exit' });
  assert.equal(api.reviewQueue().length, 0, 'leaving after a safe run does not queue review');
  assert.equal(new Set(api.simulations().map(item => item.id)).size, api.simulations().length, 'each record has its own client event id');
});

test('the username is sanitized to the server rule, limited and optional', async () => {
  const { api } = await store();
  assert.equal(api.setDisplayAlias('  Road  Runner_7 '), true);
  assert.equal(api.settings().displayAlias, 'Road_Runner_7', 'spaces become underscores');
  assert.equal(api.setDisplayAlias('<b>xy</b>'), true);
  assert.equal(api.settings().displayAlias, 'bxyb', 'markup characters are stripped');
  assert.equal(api.setDisplayAlias('<>!'), false, 'nothing usable left');
  assert.equal(api.setDisplayAlias('ab'), false, 'at least 3 characters');
  assert.equal(api.setDisplayAlias('A'.repeat(40)), true);
  assert.equal(api.settings().displayAlias.length, 20);
  assert.equal(api.setDisplayAlias(''), true);
  assert.equal(api.settings().displayAlias, null);
});

test('corrupt or hostile stored values fall back without crashing', async () => {
  const { api } = await store({ ...legacy, settings: 'x', reviewLater: [null, 3, { itemId: 'ok', topicId: 't', reason: 'menu', addedAt: '2026-10-01T00:00:00Z' }], topics: { t: { mastery: 'high', attempts: -4 } }, videos: { v: { maxWatchedRatio: 9 } }, attempts: 'nope', simulations: [{}] });
  assert.deepEqual(api.settings(), { permitTestDate: null, displayAlias: null });
  assert.deepEqual(api.reviewQueue().map(item => item.itemId), ['ok']);
  assert.equal(api.topicRecord('t').mastery, null);
  assert.equal(api.topicRecord('t').attempts, 0);
  assert.equal(api.videoRecord('v').maxWatchedRatio, 1);
  assert.deepEqual(api.attempts(), []);
  assert.deepEqual(api.simulations(), []);
  const broken = await store(null, { raw: '{not json' });
  assert.equal(broken.api.stats().xpTotal, 0);
});

test('attempt history is capped so storage cannot grow without limit', async () => {
  const { api } = await store();
  for (let i = 0; i < 320; i++) api.recordAttempt({ itemId: `q${i}`, topicId: 't', kind: 'primary', correct: true, activeMs: 1000 });
  assert.equal(api.attempts().length, 300);
  assert.equal(api.attempts()[0].itemId, 'q20');
  assert.equal(api.topicRecord('t').attempts, 320, 'topic totals keep full counts');
});

test('storage-disabled sessions keep records in memory', async () => {
  const { api } = await store(null, { unavailable: true });
  api.addReviewLater('a', 't', 'menu');
  assert.equal(api.reviewQueue().length, 1);
});

test('XP cannot be farmed: replays, recoveries, review answers and simulations add nothing after completion', async () => {
  const { api } = await store();
  api.answer('a', false);
  api.answer('a', true);
  assert.equal(api.stats().xpTotal, 10, 'completion after a miss earns the lesson XP once');
  for (let i = 0; i < 5; i++) api.answer('a', true);
  api.recordAttempt({ itemId: 'a', topicId: 't', kind: 'review', correct: true, activeMs: 3000 });
  api.recordSimulation({ scenarioId: 'four-way-stop', topicId: 't', outcome: 'safe', chosenAction: 'yield-right', elapsedSeconds: 4 });
  assert.equal(api.stats().xpTotal, 10);
  assert.equal(api.stats().xpToday, 10, 'daily goal progress counts the lesson once');
  assert.equal(api.record('a').firstTry, false, 'the earlier miss is not rewritten');
});

test('onboarding: new learners only, goal stored on the device, other words kept short', async () => {
  const fresh = await store();
  assert.equal(fresh.api.needsOnboarding(), true);
  assert.deepEqual(fresh.api.onboarding(), { goal: 'other', goalNote: null, termsAcceptedAt: null, onboardedAt: null });
  assert.equal(fresh.api.completeOnboarding('other', '  get my license before summer  ', new Date('2026-10-16T20:00:00Z')), true);
  assert.deepEqual(fresh.api.onboarding(), { goal: 'other', goalNote: 'get my license before summer', termsAcceptedAt: '2026-10-16T20:00:00.000Z', onboardedAt: '2026-10-16T20:00:00.000Z' });
  assert.equal(fresh.api.needsOnboarding(), false);
  assert.equal(fresh.api.setGoal('driver'), true);
  assert.equal(fresh.api.onboarding().goal, 'driver'); assert.equal(fresh.api.onboarding().goalNote, null, 'the note belongs to "something else"');
  assert.equal(fresh.api.setGoal('pilot'), false);
  assert.equal((await store(legacy)).api.needsOnboarding(), false, 'someone who already practiced is not sent back to onboarding');
});

test('Review later also bookmarks the lesson, and saved lessons merge both', async () => {
  const { api } = await store();
  api.toggleMark('saved', 'roundabout');
  api.addReviewLater('yellow-light', 'signals', 'menu');
  api.addReviewLater('four-way-stop', 'right-of-way', 'missed');
  assert.equal(api.markSaved('yellow-light'), true); assert.equal(api.markSaved('yellow-light'), false);
  assert.deepEqual(api.savedLessonIds().sort(), ['roundabout', 'yellow-light'], 'an automatic miss is not a saved lesson');
});
