import { daysUntil } from '../learning/review.ts';
import { NOTIFICATION_COPY as copy } from './content.ts';

export type NotificationKind = 'permit' | 'permit-date' | 'streak' | 'group' | 'passed' | 'car';
// `id` changes whenever the news changes (a new permit milestone, a new day, a new week), so the bell
// marks it new again; the same news keeps its id and stays read.
export type LaneNotification = { id: string; kind: NotificationKind; title: string; detail: string; urgent: boolean; href?: string; group?: string };
export type GroupStanding = { code: string; name: string; members: number; rows: { rank: number; alias: string | null; xp: number; is_you: boolean }[] };
// What the device remembers about a group between visits: who ranked behind the learner this week, and who has
// since moved ahead. Usernames only, already shown on that group's board.
export type StandingRecord = { week: string; behind: string[]; passedBy: string[] };
export type NotificationInput = {
  now: Date;
  goal: 'permit' | 'driver' | 'other';
  permitTestDate: string | null;
  streak: number;
  practicedToday: boolean;
  allDone: boolean;
  nextLessonHref: string;
  groups: GroupStanding[];
  standings: Record<string, StandingRecord>;
  // The cheapest car not yet owned, and the XP left to spend.
  nextCar: { id: string; name: string; price: number } | null;
  availableXp: number;
};

const dayKey = (date: Date) => date.toLocaleDateString('en-CA');
export const weekKey = (now: Date) => { const monday = new Date(now); monday.setDate(now.getDate() - (now.getDay() + 6) % 7); return dayKey(monday); };
// The permit reminder comes back at these milestones rather than every day of the last two weeks.
const PERMIT_WINDOW = 14;
const permitStep = (days: number) => [0, 1, 3, 7, 14].find(step => days <= step)!;

/**
 * Compares each group's board with the one seen last time this week. Someone who ranked behind the learner and now
 * ranks ahead has passed them; they stay listed until the learner is level or ahead again, or the week ends.
 * The first look at a group (or a new week) only records the board, so joining never reports a pass.
 */
export function trackStandings(previous: Record<string, StandingRecord>, groups: GroupStanding[], now: Date): Record<string, StandingRecord> {
  const week = weekKey(now);
  const next: Record<string, StandingRecord> = {};
  for (const group of groups) {
    const you = group.rows.find(row => row.is_you);
    if (!you) continue;
    const others = group.rows.filter((row): row is typeof row & { alias: string } => !row.is_you && !!row.alias);
    const ahead = new Set(others.filter(row => row.rank < you.rank).map(row => row.alias));
    const before = previous[group.code]?.week === week ? previous[group.code] : null;
    const passed = before ? [...new Set([...before.passedBy, ...before.behind])].filter(alias => ahead.has(alias)) : [];
    next[group.code] = { week, behind: others.filter(row => row.rank > you.rank).map(row => row.alias), passedBy: passed };
  }
  return next;
}

export function notifications(input: NotificationInput): LaneNotification[] {
  const list: LaneNotification[] = [];
  const days = daysUntil(input.permitTestDate, input.now);
  if (days !== null && days >= 0 && days <= PERMIT_WINDOW) {
    list.push({ id: `permit:${input.permitTestDate}:${permitStep(days)}`, kind: 'permit', title: copy.permitTitle(days), detail: days <= 1 ? copy.permitSoon : copy.permitDetail, urgent: days <= 3, href: '#/review' });
  }
  if (input.goal === 'permit' && !input.permitTestDate) {
    list.push({ id: 'permit-date:missing', kind: 'permit-date', title: copy.permitDateTitle, detail: copy.permitDateDetail, urgent: false, href: '#/settings' });
  }
  // Same rule as Home's streak row: a streak with nothing today ends at midnight, unless every lesson is done.
  if (input.streak > 0 && !input.practicedToday && !input.allDone) {
    const midnight = new Date(input.now); midnight.setHours(24, 0, 0, 0);
    const hours = Math.ceil((midnight.getTime() - input.now.getTime()) / 3_600_000);
    list.push({ id: `streak:${dayKey(input.now)}`, kind: 'streak', title: copy.streakTitle(input.streak), detail: copy.streakDetail(hours), urgent: hours <= 4, href: input.nextLessonHref });
  }
  const week = weekKey(input.now);
  for (const group of input.groups) {
    const you = group.rows.find(row => row.is_you);
    if (!you) continue;
    const others = group.rows.filter(row => !row.is_you);
    // Leading an empty week or a group of one isn't news.
    if (you.rank === 1 && you.xp > 0 && group.members >= 2 && others.length) {
      const tied = others.some(row => row.rank === 1);
      list.push({
        id: `group:${group.code}:${week}:${tied ? 'tie' : 'lead'}`, kind: 'group', urgent: false, group: group.code,
        title: tied ? copy.groupTiedTitle(group.name) : copy.groupLeadTitle(group.name),
        detail: tied ? copy.groupTiedDetail : copy.groupLeadDetail(you.xp - Math.max(0, ...others.map(row => row.xp))),
      });
    }
    const standing = input.standings[group.code];
    const passers = standing?.week === week ? others.filter(row => row.alias && standing.passedBy.includes(row.alias) && row.rank < you.rank) : [];
    if (passers.length) {
      const names = passers.map(row => row.alias!).sort();
      list.push({
        id: `passed:${group.code}:${week}:${names.join(',')}`, kind: 'passed', urgent: false, group: group.code,
        title: names.length === 1 ? copy.passedTitle(names[0], group.name) : copy.passedManyTitle(names.length, group.name),
        detail: names.length === 1 ? copy.passedDetail(passers[0].xp - you.xp) : copy.passedManyDetail(you.rank),
      });
    }
  }
  if (input.nextCar && input.nextCar.price > 0 && input.availableXp >= input.nextCar.price) {
    list.push({ id: `car:${input.nextCar.id}`, kind: 'car', title: copy.carTitle(input.nextCar.name), detail: copy.carDetail(input.nextCar.price, input.availableXp), urgent: false, href: '#/profile' });
  }
  // Time-sensitive items first; otherwise the order above.
  return list.sort((a, b) => Number(b.urgent) - Number(a.urgent));
}
