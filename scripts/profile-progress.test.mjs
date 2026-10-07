import test from 'node:test';
import assert from 'node:assert/strict';
let sequence = 0;
async function store(initial = null, unavailable = false) {
  let raw = initial === null ? null : JSON.stringify(initial);
  let writes = 0;
  Object.defineProperty(globalThis, 'localStorage', { configurable:true, value:{ getItem:() => raw, setItem:(_key, value) => { if (unavailable) throw new Error('Storage unavailable'); raw = value; writes++; } } });
  const api = await import(`../src/feed/progress.ts?profile-test-${sequence++}`);
  return { api, saved:() => JSON.parse(raw), writes:() => writes };
}
const today = new Date().toLocaleDateString('en-CA');
const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
const legacy = { xp:30, clips:{ a:{done:true,tries:1,firstTry:true}, b:{done:true,tries:2,firstTry:false}, c:{done:true,tries:1,firstTry:true} }, daily:{ [today]:20, [yesterday.toLocaleDateString('en-CA')]:10, '2020-01-01':0 }, liked:['a'], saved:['b'], dailyGoal:30 };

test('new and legacy profiles have a free avatar without rewriting saved progress', async () => {
  const empty = await store();
  assert.deepEqual(empty.api.avatarState(), {owned:['sprout'], selected:'sprout', spent:0, available:0});
  assert.equal(empty.api.stats().firstTryPercentage, null);
  assert.equal(empty.api.stats().daysPracticed, 0);
  assert.equal(empty.writes(), 0);
  const old = await store(legacy);
  assert.equal(old.api.avatarState().available, 30);
  assert.deepEqual(old.saved(), legacy);
  assert.equal(old.writes(), 0);
});
test('a purchase persists ownership and selection while preserving every learning field', async () => {
  const {api, saved} = await store(legacy);
  const before = api.stats();
  assert.equal(api.buyAvatar('sunny'), 'purchased');
  assert.deepEqual(api.stats(), before);
  assert.equal(api.dailyGoal(), 30);
  assert.deepEqual(api.avatarState(), {owned:['sprout','sunny'], selected:'sunny', spent:10, available:20});
  assert.deepEqual(saved(), {...legacy, spentXp:10, ownedAvatars:['sprout','sunny'], selectedAvatar:'sunny'});
  const reload = await store(saved());
  assert.deepEqual(reload.api.avatarState(), api.avatarState());
});
test('duplicate purchases, unknown avatars and overspending cannot deduct XP', async () => {
  const {api, writes} = await store(legacy);
  assert.equal(api.buyAvatar('sunny'), 'purchased');
  const after = api.avatarState();
  assert.equal(api.buyAvatar('sunny'), 'owned');
  assert.equal(api.buyAvatar('sprout'), 'owned');
  assert.equal(api.buyAvatar('__proto__'), 'unknown');
  assert.deepEqual(api.avatarState(), after);
  assert.equal(writes(), 1);
  assert.equal(api.buyAvatar('cloud'), 'purchased');
  assert.equal(api.avatarState().available, 0);
  assert.equal(api.buyAvatar('peach'), 'insufficient');
  assert.equal(api.avatarState().spent, 30);
  assert.equal(writes(), 2);
});
test('only owned avatars can be selected and switching is free', async () => {
  const {api} = await store(legacy);
  assert.equal(api.selectAvatar('peach'), false);
  assert.equal(api.selectAvatar('missing'), false);
  api.buyAvatar('sunny');
  assert.equal(api.selectAvatar('sprout'), true);
  assert.equal(api.avatarState().selected, 'sprout');
  assert.equal(api.selectAvatar('sunny'), true);
  assert.equal(api.avatarState().spent, 10);
  const snapshot = api.avatarState(); snapshot.owned.push('peach');
  assert.equal(api.selectAvatar('peach'), false, 'Returned arrays cannot mutate ownership');
});
test('XP earned after spending adds purchasing power without resetting the ledger', async () => {
  const {api} = await store({...legacy, xp:10});
  api.buyAvatar('sunny');
  api.answer('new-lesson', true);
  assert.equal(api.stats().xpTotal, 20);
  assert.equal(api.avatarState().spent, 10);
  assert.equal(api.avatarState().available, 10);
  api.answer('new-lesson', true);
  assert.equal(api.avatarState().available, 10, 'Reviews do not mint spendable XP');
});
test('days and first-try percentage use positive daily records and actual attempts', async () => {
  const {api} = await store(legacy);
  assert.equal(api.stats().daysPracticed, 2);
  assert.equal(api.stats().firstTryPercentage, 67);
  assert.equal(api.stats().streak, 2);
  api.answer('new-lesson', false);
  assert.equal(api.stats().firstTryPercentage, 50);
  assert.equal(api.stats().daysPracticed, 2);
  const wrong = await store({ ...legacy, clips:{ a:{tries:1,done:false,firstTry:false}, untouched:{tries:0,done:false,firstTry:true} } });
  assert.equal(wrong.api.stats().firstTryPercentage, 0);
});
test('invalid optional avatar fields fall back without damaging older learning data', async () => {
  const {api} = await store({...legacy, spentXp:-100, selectedAvatar:'peach', ownedAvatars:['sprout','sunny','sunny','missing']});
  assert.deepEqual(api.avatarState(), {owned:['sprout','sunny'], selected:'sprout', spent:0, available:30});
  const malformed = await store({...legacy, spentXp:'10', ownedAvatars:'sunny', selectedAvatar:'sunny'});
  assert.deepEqual(malformed.api.avatarState(), {owned:['sprout'], selected:'sprout', spent:0, available:30});
});
test('storage-disabled sessions retain purchases and prevent repeat charges in memory', async () => {
  const {api} = await store(legacy, true);
  assert.equal(api.buyAvatar('sunny'), 'purchased');
  assert.equal(api.buyAvatar('sunny'), 'owned');
  assert.equal(api.avatarState().available, 20);
  assert.equal(api.selectAvatar('sprout'), true);
});
