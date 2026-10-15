import { AVATARS, DEFAULT_AVATAR, avatarById, type AvatarId } from '../profile/avatars.ts';

import { CARS, DEFAULT_CAR, carById, type CarId } from '../profile/cars.ts';

export const XP_PER_CLIP = 10;
export const DAILY_GOAL = 50;
export const DAILY_GOALS = [10, 30, 50] as const;

type ClipRecord = { tries: number; firstTry: boolean; done: boolean };
type Stored = { xp: number; clips: Record<string, ClipRecord>; daily: Record<string, number>; liked: string[]; saved: string[]; dailyGoal?: number; spentXp?: number; ownedAvatars?: AvatarId[]; selectedAvatar?: AvatarId; ownedCars?: CarId[]; selectedCar?: CarId };

const KEY = 'roadloop-progress';
const empty = (): Stored => ({ xp: 0, clips: {}, daily: {}, liked: [], saved: [] });

function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) as Partial<Stored> } : empty();
  } catch { return empty(); }
}
const data = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* Storage may be disabled in private browsing; progress then lasts for the session. */ }
}

// en-CA formats as YYYY-MM-DD in local time, so a streak day follows the user's clock, not UTC.
const dayKey = (date: Date) => date.toLocaleDateString('en-CA');

export function record(id: string): ClipRecord | undefined { return data.clips[id]; }

export function dailyGoal() {
  return DAILY_GOALS.some(goal => goal === data.dailyGoal) ? data.dailyGoal! : DAILY_GOAL;
}

export function setDailyGoal(goal: number) {
  if (!DAILY_GOALS.some(option => option === goal)) return false;
  data.dailyGoal = goal;
  save();
  return true;
}

export function answer(id: string, correct: boolean, complete = true) {
  const clip = data.clips[id] ??= { tries: 0, firstTry: false, done: false };
  if (clip.done) return clip;
  clip.tries++;
  if (clip.tries === 1) clip.firstTry = correct;
  else if (!correct) clip.firstTry = false;
  if (correct && complete) {
    clip.done = true;
    data.xp += XP_PER_CLIP;
    const today = dayKey(new Date());
    data.daily[today] = (data.daily[today] ?? 0) + XP_PER_CLIP;
  }
  save();
  return clip;
}

export function marked(list: 'liked' | 'saved', id: string) { return data[list].includes(id); }
export function toggleMark(list: 'liked' | 'saved', id: string) {
  const on = !marked(list, id);
  data[list] = on ? [...data[list], id] : data[list].filter(item => item !== id);
  save();
  return on;
}

function wallet() {
  const spent = typeof data.spentXp === 'number' && Number.isSafeInteger(data.spentXp) && data.spentXp >= 0 ? data.spentXp : 0;
  return { spent, available: Math.max(0, data.xp - spent) };
}

export function avatarState() {
  const owned = AVATARS.filter(avatar => avatar.id === DEFAULT_AVATAR || (Array.isArray(data.ownedAvatars) && data.ownedAvatars.includes(avatar.id))).map(avatar => avatar.id);
  const selected = owned.find(id => id === data.selectedAvatar) ?? DEFAULT_AVATAR;
  return { owned, selected, ...wallet() };
}

export function buyAvatar(id: string): 'purchased' | 'owned' | 'insufficient' | 'unknown' {
  const avatar = avatarById(id);
  if (!avatar) return 'unknown';
  const state = avatarState();
  if (state.owned.includes(avatar.id)) return 'owned';
  if (state.available < avatar.price) return 'insufficient';
  // Lifetime XP and daily totals describe learning, so purchases only change this ledger.
  data.spentXp = state.spent + avatar.price;
  data.ownedAvatars = [...state.owned, avatar.id];
  data.selectedAvatar = avatar.id;
  save();
  return 'purchased';
}

export function selectAvatar(id: string) {
  const selected = avatarState().owned.find(owned => owned === id);
  if (!selected) return false;
  data.selectedAvatar = selected;
  save();
  return true;
}

export function carState() {
  const owned = CARS.filter(car => car.id === DEFAULT_CAR || (Array.isArray(data.ownedCars) && data.ownedCars.includes(car.id))).map(car => car.id);
  const selected = owned.find(id => id === data.selectedCar) ?? DEFAULT_CAR;
  return { owned, selected, ...wallet() };
}

export function buyCar(id: string): 'purchased' | 'owned' | 'insufficient' | 'unknown' {
  const car = carById(id);
  if (!car) return 'unknown';
  const state = carState();
  if (state.owned.includes(car.id)) return 'owned';
  if (state.available < car.price) return 'insufficient';
  data.spentXp = state.spent + car.price;
  data.ownedCars = [...state.owned, car.id];
  data.selectedCar = car.id;
  save();
  return 'purchased';
}

export function selectCar(id: string) {
  const selected = carState().owned.find(owned => owned === id);
  if (!selected) return false;
  data.selectedCar = selected;
  save();
  return true;
}

// Use the same local calendar as daily XP. Spending never changes these earned totals.
export function weeklyProgress(now = new Date()) {
  const dayIndex = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - dayIndex);
  let xp = 0;
  for (let index = 0; index <= dayIndex; index++) {
    const day = new Date(monday);
    day.setDate(day.getDate() + index);
    xp += data.daily[dayKey(day)] ?? 0;
  }
  const resetsAt = new Date(monday);
  resetsAt.setDate(resetsAt.getDate() + 7);
  return { xp, resetsAt, daysUntilReset: 7 - dayIndex };
}

export function stats() {
  const now = new Date();
  const today = data.daily[dayKey(now)] ?? 0;
  // A streak survives until the end of the day after the last practice.
  const cursor = new Date(now);
  if (!today) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (data.daily[dayKey(cursor)]) { streak++; cursor.setDate(cursor.getDate() - 1); }
  const monday = new Date(now);
  monday.setDate(now.getDate() - (now.getDay() + 6) % 7);
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return data.daily[dayKey(day)] ?? 0;
  });
  const attempted = Object.values(data.clips).filter(clip => clip.tries > 0);
  return {
    xpTotal: data.xp, xpToday: today, streak, week, todayIndex: (now.getDay() + 6) % 7,
    attempted: attempted.length,
    firstTryRight: attempted.filter(clip => clip.firstTry).length,
    firstTryPercentage: attempted.length ? Math.round(attempted.filter(clip => clip.firstTry).length / attempted.length * 100) : null,
    daysPracticed: Object.values(data.daily).filter(xp => xp > 0).length,
    done: attempted.filter(clip => clip.done).length,
  };
}
