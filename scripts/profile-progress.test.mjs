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

test('new and legacy saves get the default Hatchback without writes or losing avatar spending', async () => {
  const fresh = await store();
  assert.deepEqual(fresh.api.carState(), {owned:['hatchback'], selected:'hatchback', spent:0, available:0});
  assert.equal(fresh.writes(), 0);
  const old = {...legacy, spentXp:10, ownedAvatars:['sprout','sunny'], selectedAvatar:'sunny'};
  const migrated = await store(old);
  assert.deepEqual(migrated.api.carState(), {owned:['hatchback'], selected:'hatchback', spent:10, available:20});
  assert.deepEqual(migrated.saved(), old);
  assert.equal(migrated.writes(), 0);
});
test('car purchases persist and only deduct spendable XP, preserving learning and weekly totals', async () => {
  const {api, saved} = await store(legacy);
  const before = api.stats(), week = api.weeklyProgress();
  assert.equal(api.buyCar('sedan'), 'purchased');
  assert.deepEqual(api.carState(), {owned:['hatchback','sedan'], selected:'sedan', spent:15, available:15});
  assert.deepEqual(api.stats(), before);
  assert.deepEqual(api.weeklyProgress(), week);
  assert.equal(api.dailyGoal(), 30);
  assert.deepEqual(saved(), {...legacy, spentXp:15, ownedCars:['hatchback','sedan'], selectedCar:'sedan'});
  const reload = await store(saved());
  assert.deepEqual(reload.api.carState(), api.carState());
});
test('insufficient XP, duplicate cars and unknown cars are rejected without writes', async () => {
  const {api, writes} = await store(legacy);
  assert.equal(api.buyCar('pickup'), 'insufficient');
  assert.equal(api.buyCar('__proto__'), 'unknown');
  assert.equal(api.buyCar('hatchback'), 'owned');
  assert.equal(writes(), 0);
  assert.equal(api.buyCar('sedan'), 'purchased');
  const state = api.carState();
  assert.equal(api.buyCar('sedan'), 'owned');
  assert.equal(api.buyCar('wagon'), 'insufficient');
  assert.deepEqual(api.carState(), state);
  assert.equal(writes(), 1);
});
test('selecting cars requires ownership and is free, with no mutable ownership leak', async () => {
  const {api, writes} = await store(legacy);
  assert.equal(api.selectCar('pickup'), false);
  assert.equal(api.selectCar('unknown'), false);
  assert.equal(writes(), 0);
  api.buyCar('sedan');
  assert.equal(api.selectCar('hatchback'), true);
  assert.equal(api.carState().selected, 'hatchback');
  assert.equal(api.selectCar('sedan'), true);
  assert.equal(api.carState().spent, 15);
  api.carState().owned.push('pickup');
  assert.equal(api.selectCar('pickup'), false);
});
test('cars and avatars spend one pool in either purchase order', async () => {
  const {api} = await store({...legacy, xp:40});
  assert.equal(api.buyAvatar('sunny'), 'purchased');
  assert.equal(api.carState().available, 30);
  assert.equal(api.buyCar('wagon'), 'purchased');
  assert.equal(api.avatarState().available, 5);
  assert.equal(api.buyAvatar('cloud'), 'insufficient');
  assert.equal(api.buyCar('sedan'), 'insufficient');
  api.answer('new-lesson', true);
  assert.equal(api.buyCar('sedan'), 'purchased');
  assert.equal(api.avatarState().available, 0);
  const reverse = await store(legacy);
  assert.equal(reverse.api.buyCar('sedan'), 'purchased');
  assert.equal(reverse.api.buyAvatar('sunny'), 'purchased');
  assert.equal(reverse.api.carState().available, 5);
  const state = reverse.api.carState();
  reverse.api.toggleMark('liked', 'a');
  reverse.api.toggleMark('saved', 'a');
  assert.deepEqual(reverse.api.carState(), state, 'Social marks cannot earn or spend car XP');
});
test('invalid optional car fields fall back and storage-disabled purchases remain safe', async () => {
  const {api} = await store({...legacy, ownedCars:['sedan','sedan','unknown'], selectedCar:'pickup'});
  assert.deepEqual(api.carState().owned, ['hatchback','sedan']);
  assert.equal(api.carState().selected, 'hatchback');
  const malformed = await store({...legacy, ownedCars:'sedan', selectedCar:'sedan'});
  assert.deepEqual(malformed.api.carState().owned, ['hatchback']);
  assert.equal(malformed.api.carState().selected, 'hatchback');
  const disabled = await store(legacy, true);
  assert.equal(disabled.api.buyCar('sedan'), 'purchased');
  assert.equal(disabled.api.buyCar('sedan'), 'owned');
  assert.equal(disabled.api.carState().available, 15);
});
