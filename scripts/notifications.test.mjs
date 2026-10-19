import test from 'node:test';
import assert from 'node:assert/strict';
import { notifications, trackStandings } from '../src/home/notifications-model.ts';
process.env.TZ = 'America/Los_Angeles';

// Saturday, October 17, 2026, 2 pm local.
const now = new Date(2026, 9, 17, 14);
const base = { now, goal: 'driver', permitTestDate: null, streak: 0, practicedToday: false, allDone: false, nextLessonHref: '#/feed/a', groups: [], standings: {}, nextCar: null, availableXp: 0 };
const kinds = list => list.map(item => item.kind);
const group = (rows, extra = {}) => ({ code: 'ABC123', name: 'Road crew', members: rows.length, rows, ...extra });

test('a learner with nothing coming up has no notifications', () => {
  assert.deepEqual(notifications(base), []);
});

test('the permit reminder covers the last two weeks and returns only at milestones', () => {
  const at = days => notifications({ ...base, permitTestDate: new Date(2026, 9, 17 + days).toLocaleDateString('en-CA') });
  assert.deepEqual(at(15), [], 'more than two weeks out');
  assert.deepEqual(at(-1), [], 'a past date');
  assert.equal(at(14)[0].title, 'Your permit test is in 14 days');
  assert.equal(at(1)[0].title, 'Your permit test is tomorrow');
  assert.equal(at(0)[0].title, 'Your permit test is today');
  assert.equal(at(0)[0].href, '#/review');
  // One test date, seen on different days: days 8–14 share an id, so the bell stays read until the one-week mark.
  const before = days => notifications({ ...base, permitTestDate: '2026-10-31', now: new Date(2026, 9, 31 - days, 9) })[0].id;
  assert.equal(before(12), before(8));
  assert.notEqual(before(7), before(8));
  assert.equal(at(3)[0].urgent, true);
  assert.equal(at(4)[0].urgent, false);
});

test('a streak with nothing done today warns until midnight', () => {
  const [streak] = notifications({ ...base, streak: 4 });
  assert.equal(streak.title, 'Your 4-day streak ends tonight');
  assert.equal(streak.detail, '10 hours left. Finish one lesson to keep it.');
  assert.equal(streak.href, '#/feed/a');
  assert.equal(streak.urgent, false);
  const late = notifications({ ...base, streak: 4, now: new Date(2026, 9, 17, 23, 30) })[0];
  assert.match(late.detail, /^Less than an hour left/);
  assert.equal(late.urgent, true);
  assert.equal(late.id, streak.id, 'one id per day');
  assert.deepEqual(notifications({ ...base, streak: 4, practicedToday: true }), [], 'already practiced today');
  assert.deepEqual(notifications({ ...base, streak: 4, allDone: true }), [], 'no lesson left to finish');
});

test('group lead uses the server ranks, including ties', () => {
  const lead = notifications({ ...base, groups: [group([{ rank: 1, xp: 50, is_you: true }, { rank: 2, xp: 30, is_you: false }])] });
  assert.equal(lead[0].title, 'You’re leading Road crew');
  assert.equal(lead[0].detail, '20 XP ahead on this week’s group leaderboard.');
  assert.equal(lead[0].group, 'ABC123');
  const tied = notifications({ ...base, groups: [group([{ rank: 1, xp: 30, is_you: false }, { rank: 1, xp: 30, is_you: true }])] });
  assert.equal(tied[0].title, 'You’re tied for first in Road crew');
  assert.notEqual(tied[0].id, lead[0].id, 'breaking a tie is new');
  assert.deepEqual(notifications({ ...base, groups: [group([{ rank: 2, xp: 10, is_you: true }, { rank: 1, xp: 30, is_you: false }])] }), [], 'not first');
  assert.deepEqual(notifications({ ...base, groups: [group([{ rank: 1, xp: 0, is_you: true }, { rank: 1, xp: 0, is_you: false }])] }), [], 'nobody has XP yet');
  assert.deepEqual(notifications({ ...base, groups: [group([{ rank: 1, xp: 40, is_you: true }])] }), [], 'a group of one');
  const nextWeek = notifications({ ...base, now: new Date(2026, 9, 19, 9), groups: [group([{ rank: 1, xp: 50, is_you: true }, { rank: 2, xp: 30, is_you: false }])] });
  assert.notEqual(nextWeek[0].id, lead[0].id, 'a new week is new');
});

test('permit-goal learners without a test date are asked for one', () => {
  const [ask] = notifications({ ...base, goal: 'permit' });
  assert.equal(ask.title, 'Add your permit test date');
  assert.equal(ask.href, '#/settings');
  assert.deepEqual(kinds(notifications({ ...base, goal: 'permit', permitTestDate: '2026-12-20' })), [], 'date set, test far off');
  assert.deepEqual(notifications({ ...base, goal: 'other' }), [], 'other goals are not asked');
});

test('the next car shows once it is affordable, and only the cheapest one not owned', () => {
  const wagon = { id: 'wagon', name: 'Wagon', price: 25 };
  assert.deepEqual(notifications({ ...base, nextCar: wagon, availableXp: 24 }), []);
  const [car] = notifications({ ...base, nextCar: wagon, availableXp: 30 });
  assert.equal(car.title, 'You can unlock the Wagon');
  assert.equal(car.detail, 'It costs 25 XP, and you have 30 XP to spend.');
  assert.equal(car.id, 'car:wagon');
  assert.equal(car.href, '#/profile');
  assert.deepEqual(notifications({ ...base, nextCar: null, availableXp: 300 }), [], 'collection complete');
});

test('a pass is someone who ranked behind and now ranks ahead, this week', () => {
  const board = rows => [group(rows.map(([alias, rank, xp]) => ({ alias, rank, xp, is_you: alias === 'me' })))];
  const monday = board([['me', 1, 30], ['sam', 2, 20], ['ana', 3, 10]]);
  const first = trackStandings({}, monday, now);
  assert.deepEqual(first.ABC123, { week: '2026-10-12', behind: ['sam', 'ana'], passedBy: [] }, 'first look records, never reports');
  const later = board([['sam', 1, 40], ['me', 2, 30], ['ana', 3, 10]]);
  const standings = trackStandings(first, later, now);
  assert.deepEqual(standings.ABC123.passedBy, ['sam']);
  const passed = notifications({ ...base, groups: later, standings }).find(item => item.kind === 'passed');
  assert.equal(passed.title, 'sam passed you in Road crew');
  assert.equal(passed.detail, 'They’re 10 XP ahead this week.');
  assert.equal(passed.group, 'ABC123');
  // Still ahead on the next visit: still listed, same id.
  const again = trackStandings(standings, later, now);
  assert.deepEqual(again.ABC123.passedBy, ['sam']);
  assert.equal(notifications({ ...base, groups: later, standings: again }).find(item => item.kind === 'passed').id, passed.id);
  // Level again: gone.
  const level = board([['sam', 1, 40], ['me', 1, 40], ['ana', 3, 10]]);
  const caught = trackStandings(again, level, now);
  assert.deepEqual(caught.ABC123.passedBy, []);
  assert.equal(notifications({ ...base, groups: level, standings: caught }).some(item => item.kind === 'passed'), false);
  // Two at once.
  const both = board([['sam', 1, 40], ['ana', 2, 35], ['me', 3, 30]]);
  const many = notifications({ ...base, groups: both, standings: trackStandings(first, both, now) }).find(item => item.kind === 'passed');
  assert.equal(many.title, '2 people passed you in Road crew');
  assert.equal(many.detail, 'You’re rank 3 this week.');
  // A new week starts over, and anonymous members (no username) are never named.
  assert.deepEqual(trackStandings(standings, later, new Date(2026, 9, 19, 9)).ABC123.passedBy, []);
  const anonymous = board([['me', 1, 30], [null, 2, 20]]);
  assert.deepEqual(trackStandings({}, anonymous, now).ABC123.behind, []);
  assert.deepEqual(trackStandings(first, [], now), {}, 'groups left are forgotten');
});

test('urgent items come first', () => {
  const list = notifications({ ...base, now: new Date(2026, 9, 17, 21), streak: 2, permitTestDate: '2026-10-27', groups: [group([{ rank: 1, xp: 50, is_you: true }, { rank: 2, xp: 30, is_you: false }])] });
  assert.deepEqual(kinds(list), ['streak', 'permit', 'group']);
});

test('seen notifications are stored on the device, deduplicated and capped', async () => {
  let saved = JSON.stringify({ xp: 0, daily: {}, clips: {}, saved: [], liked: [], notificationsSeen: ['a', 7] });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => saved, setItem: (_key, value) => { saved = value; } } });
  const progress = await import('../src/feed/progress.ts?notifications');
  assert.deepEqual(progress.seenNotifications(), ['a'], 'invalid entries are ignored');
  progress.markNotificationsSeen(['a', 'b']);
  assert.deepEqual(JSON.parse(saved).notificationsSeen, ['a', 7, 'b'].filter(id => typeof id === 'string'));
  progress.markNotificationsSeen(Array.from({ length: 50 }, (_, index) => `n${index}`));
  const stored = JSON.parse(saved).notificationsSeen;
  assert.equal(stored.length, 40);
  assert.equal(stored.at(-1), 'n49');
});

test('group standings are validated on read and written only when they change', async () => {
  let saved = JSON.stringify({ xp: 0, daily: {}, clips: {}, saved: [], liked: [], groupStandings: { OK: { week: '2026-10-12', behind: ['sam', 3], passedBy: [] }, BAD: { week: 'soon' }, ALSO: 'x' } });
  let writes = 0;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => saved, setItem: (_key, value) => { saved = value; writes++; } } });
  const progress = await import('../src/feed/progress.ts?standings');
  assert.deepEqual(progress.groupStandings(), { OK: { week: '2026-10-12', behind: ['sam'], passedBy: [] } });
  progress.setGroupStandings({ OK: { week: '2026-10-12', behind: ['sam'], passedBy: [] } });
  assert.equal(writes, 0, 'an unchanged record is not written');
  progress.setGroupStandings({});
  assert.equal(writes, 1);
  assert.deepEqual(JSON.parse(saved).groupStandings, {});
});
