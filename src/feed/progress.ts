import { AVATARS, DEFAULT_AVATAR, avatarById, type AvatarId } from '../profile/avatars.ts';

import { CARS, DEFAULT_CAR, carById, type CarId } from '../profile/cars.ts';
import { smoothMastery } from '../learning/scoring.ts';

export const XP_PER_CLIP = 10;
export const DAILY_GOAL = 50;
export const DAILY_GOALS = [10, 30, 50] as const;

type ClipRecord = { tries: number; firstTry: boolean; done: boolean; completedAt?: string };

export type ReviewReason = 'menu' | 'skip' | 'sim-exit' | 'sim-unsafe' | 'help' | 'missed';
export type ReviewItem = { itemId: string; topicId: string; reason: ReviewReason; addedAt: string; resolvedAt?: string };
export type TopicRecord = { mastery: number | null; lastPracticedAt: string | null; attempts: number; correct: number; skips: number; help: number; retries: number; reviewAttempts: number; reviewCorrect: number };
export type VideoRecord = { maxWatchedRatio: number; keySegmentSeen: boolean; ended: boolean; skips: number; lastWatchedAt: string | null };
// recall: a flashcard the learner rated themselves (Got it / Not yet); glossary: a term card read.
export type AttemptKind = 'primary' | 'followUp' | 'similar' | 'harder' | 'review' | 'recall' | 'glossary';
export type QuizAttempt = { id: string; itemId: string; topicId: string; kind: AttemptKind; correct: boolean; activeMs: number; at: string };
// Derived from the package result: `success` decides safe, never the callback that delivered it.
export type SimOutcome = 'safe' | 'unsafe' | 'timeout' | 'retry' | 'exit';
export type SimRecord = { id: string; scenarioId: string; topicId: string; outcome: SimOutcome; chosenAction?: string; elapsedSeconds?: number; at: string };
export type Settings = { permitTestDate: string | null; displayAlias: string | null };

// Every learner-record field below is optional and validated on read, so saves from older
// versions load unchanged and nothing is written until a feature actually records something.
type Stored = {
  xp: number; clips: Record<string, ClipRecord>; daily: Record<string, number>; liked: string[]; saved: string[];
  dailyGoal?: number; spentXp?: number; ownedAvatars?: AvatarId[]; selectedAvatar?: AvatarId; ownedCars?: CarId[]; selectedCar?: CarId;
  firstSessionCompletedAt?: string; settings?: Partial<Settings & { goal: string; goalNote: string | null; termsAcceptedAt: string; onboardedAt: string }>;
  reviewLater?: ReviewItem[]; topics?: Record<string, Partial<TopicRecord>>; videos?: Record<string, Partial<VideoRecord>>;
  attempts?: QuizAttempt[]; simulations?: SimRecord[];
  // The feed's sound button: true keeps lesson videos muted. A device preference, never synced.
  soundOff?: boolean;
  // The lesson the learner last had on screen, so Home, Progress and the feed resume in one place.
  position?: { lessonId: string; at: string };
};

const KEY = 'roadloop-progress';
export const PROGRESS_EVENT = 'lane-progress';
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
  // Lets the sync boundary (src/data/sync.ts) schedule a backup without feature code knowing about it.
  globalThis.dispatchEvent?.(new Event(PROGRESS_EVENT));
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
    clip.completedAt = new Date().toISOString();
    data.xp += XP_PER_CLIP;
    const today = dayKey(new Date());
    data.daily[today] = (data.daily[today] ?? 0) + XP_PER_CLIP;
  }
  save();
  return clip;
}

export function marked(list: 'liked' | 'saved', id: string) { return data[list].includes(id); }
// Saves a lesson without toggling (Review later uses this, so it appears under the bookmark too).
export function markSaved(id: string) {
  if (marked('saved', id)) return false;
  data.saved = [...data.saved, id];
  save();
  return true;
}
export function toggleMark(list: 'liked' | 'saved', id: string) {
  const on = !marked(list, id);
  data[list] = on ? [...data[list], id] : data[list].filter(item => item !== id);
  // Unsaving also clears the learner's own Review later save, so Home and Review agree with Profile.
  // Missed answers stay queued: those weren't the learner's choice to save.
  if (list === 'saved' && !on) {
    const at = isoNow(new Date());
    data.reviewLater = reviewList().map(item => item.itemId === id && !item.resolvedAt && (item.reason === 'menu' || item.reason === 'skip') ? { ...item, resolvedAt: at } : item);
  }
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

// Longest run of consecutive calendar days (YYYY-MM-DD keys).
function longestRun(days: string[]) {
  const sorted = [...days].sort();
  let best = 0, run = 0, previous: Date | null = null;
  for (const key of sorted) {
    const date = new Date(key + 'T00:00:00');
    run = previous && Math.round((date.getTime() - previous.getTime()) / 86_400_000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }
  return best;
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
    longestStreak: longestRun(Object.keys(data.daily).filter(key => data.daily[key] > 0)),
    done: attempted.filter(clip => clip.done).length,
  };
}

// ---- Learner records (local-first; src/data/sync.ts can send these to a backend later) ----

const ATTEMPT_LIMIT = 300;
const SIMULATION_LIMIT = 200;
const ALIAS_MAX = 20;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
const ratio = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
const text = (value: unknown) => typeof value === 'string' && value.length > 0 ? value : null;
const isoNow = (now = new Date()) => now.toISOString();
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function newId() {
  const crypto = globalThis.crypto as Crypto | undefined;
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// The learner's identity is the backend's anonymous session (src/data/sync.ts), created only when sync
// is configured; there is no separate device ID. First completion is recorded for learner_settings.
export function completeFirstSession(now = new Date()) {
  if (text(data.firstSessionCompletedAt)) return;
  data.firstSessionCompletedAt = isoNow(now);
  save();
}

// Letters, numbers, spaces, hyphens and underscores only; never a requirement to use a real name.
// A username: 3–20 English letters, numbers, hyphens or underscores (the server's rule).
// Spaces become underscores; anything else is dropped.
export function cleanAlias(value: string) {
  const alias = value.normalize('NFKC').trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_-]/g, '').slice(0, ALIAS_MAX);
  return alias.length >= 3 ? alias : null;
}
export function settings(): Settings {
  const stored = isRecord(data.settings) ? data.settings : {};
  const date = typeof stored.permitTestDate === 'string' && validDate(stored.permitTestDate) ? stored.permitTestDate : null;
  const alias = typeof stored.displayAlias === 'string' ? cleanAlias(stored.displayAlias) : null;
  return { permitTestDate: date, displayAlias: alias };
}
function validDate(value: string) {
  if (!DATE_ONLY.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
export function setPermitTestDate(value: string | null) {
  if (value !== null && !validDate(value)) return false;
  data.settings = { ...(isRecord(data.settings) ? data.settings : {}), permitTestDate: value };
  save();
  return true;
}
// Main goal from onboarding. It only changes how Home words the readiness goal; it stays on this
// device (the free-text answer included) and is never part of a backup.
export type Goal = 'permit' | 'driver' | 'other';
export const GOALS: Goal[] = ['permit', 'driver', 'other'];
export type Onboarding = { goal: Goal; goalNote: string | null; termsAcceptedAt: string | null; onboardedAt: string | null };
export function onboarding(): Onboarding {
  const stored = isRecord(data.settings) ? data.settings : {};
  return {
    goal: GOALS.includes(stored.goal as Goal) ? stored.goal as Goal : 'other',
    goalNote: typeof stored.goalNote === 'string' && stored.goalNote.trim() ? stored.goalNote.trim().slice(0, 80) : null,
    termsAcceptedAt: text(stored.termsAcceptedAt), onboardedAt: text(stored.onboardedAt),
  };
}
export function setGoal(goal: Goal, note: string | null = null) {
  if (!GOALS.includes(goal)) return false;
  data.settings = { ...(isRecord(data.settings) ? data.settings : {}), goal, goalNote: goal === 'other' && note?.trim() ? note.trim().slice(0, 80) : null };
  save();
  return true;
}
export function completeOnboarding(goal: Goal, note: string | null, now = new Date()) {
  if (!setGoal(goal, note)) return false;
  data.settings = { ...(isRecord(data.settings) ? data.settings : {}), termsAcceptedAt: isoNow(now), onboardedAt: isoNow(now) };
  save();
  return true;
}
// Onboarding is for someone opening Lane for the first time; a learner who already practiced keeps going.
export function needsOnboarding() {
  if (onboarding().onboardedAt) return false;
  const used = Object.keys(data.clips ?? {}).length || data.xp || attempts().length || data.liked.length || data.saved.length || simulations().length;
  return !used;
}
export function setDisplayAlias(value: string | null) {
  const alias = value === null || value.trim() === '' ? null : cleanAlias(value);
  if (value !== null && value.trim() !== '' && !alias) return false;
  data.settings = { ...(isRecord(data.settings) ? data.settings : {}), displayAlias: alias };
  save();
  return true;
}

function reviewList(): ReviewItem[] {
  return Array.isArray(data.reviewLater) ? data.reviewLater.filter(item => isRecord(item) && text(item.itemId) && text(item.topicId) && text(item.addedAt)) : [];
}
export function reviewQueue() { return reviewList().filter(item => !item.resolvedAt); }
export function reviewHistory() { return reviewList(); }
// What the learner chose to save (⋯ → Review later, or Review later on "Are you sure?"). Missed answers and
// unfinished challenges are queued too, but they come back through today's review without being listed as saved.
export function savedForLater() { return reviewQueue().filter(item => item.reason === 'menu' || item.reason === 'skip'); }
// Everything the learner saved: bookmarked lessons plus ones saved with Review later.
export function savedLessonIds() { return [...new Set([...data.saved, ...savedForLater().map(item => item.itemId)])]; }
export function isQueuedForReview(itemId: string) { return reviewQueue().some(item => item.itemId === itemId); }
// Review Later never removes a topic forever: it stays queued until it is reviewed.
export function addReviewLater(itemId: string, topicId: string, reason: ReviewReason, now = new Date()) {
  if (isQueuedForReview(itemId)) return false;
  data.reviewLater = [...reviewList(), { itemId, topicId, reason, addedAt: isoNow(now) }];
  save();
  return true;
}
export function resolveReview(itemId: string, now = new Date()) {
  let changed = false;
  data.reviewLater = reviewList().map(item => item.itemId === itemId && !item.resolvedAt ? (changed = true, { ...item, resolvedAt: isoNow(now) }) : item);
  if (changed) save();
  return changed;
}

export function topicRecord(topicId: string): TopicRecord {
  const stored = isRecord(data.topics) && isRecord(data.topics[topicId]) ? data.topics[topicId]! : {};
  const mastery = typeof stored.mastery === 'number' && Number.isFinite(stored.mastery) ? ratio(stored.mastery) : null;
  return {
    mastery, lastPracticedAt: text(stored.lastPracticedAt), attempts: count(stored.attempts), correct: count(stored.correct),
    skips: count(stored.skips), help: count(stored.help), retries: count(stored.retries),
    reviewAttempts: count(stored.reviewAttempts), reviewCorrect: count(stored.reviewCorrect),
  };
}
export function topicIds() { return isRecord(data.topics) ? Object.keys(data.topics) : []; }
function updateTopic(topicId: string, change: (record: TopicRecord) => void) {
  const record = topicRecord(topicId);
  change(record);
  data.topics = { ...(isRecord(data.topics) ? data.topics : {}), [topicId]: record };
}

export function attempts(): QuizAttempt[] {
  return Array.isArray(data.attempts) ? data.attempts.filter(item => isRecord(item) && text(item.itemId) && typeof item.correct === 'boolean').map(item => text(item.id) ? item : { ...item, id: `${item.itemId}:${item.at}` }) : [];
}
export function recordAttempt(attempt: Omit<QuizAttempt, 'at' | 'activeMs' | 'id'> & { activeMs: number }, now = new Date()) {
  const entry: QuizAttempt = { ...attempt, id: newId(), activeMs: Math.max(0, Math.round(Number.isFinite(attempt.activeMs) ? attempt.activeMs : 0)), at: isoNow(now) };
  data.attempts = [...attempts(), entry].slice(-ATTEMPT_LIMIT);
  updateTopic(attempt.topicId, record => {
    record.attempts++;
    if (attempt.correct) record.correct++;
    if (attempt.kind === 'similar' && attempt.correct) record.retries++;
    if (attempt.kind === 'review') { record.reviewAttempts++; if (attempt.correct) record.reviewCorrect++; }
    record.lastPracticedAt = entry.at;
  });
  save();
  return entry;
}
export function recordHelp(topicId: string) { updateTopic(topicId, record => { record.help++; }); save(); }
// Session mastery is computed by src/learning/; the store keeps the smoothed value.
export function recordMastery(topicId: string, session: number, now = new Date()) {
  let next = 0;
  updateTopic(topicId, record => { next = smoothMastery(record.mastery, session); record.mastery = next; record.lastPracticedAt = isoNow(now); });
  save();
  return next;
}

export function videoRecord(lessonId: string): VideoRecord {
  const stored = isRecord(data.videos) && isRecord(data.videos[lessonId]) ? data.videos[lessonId]! : {};
  return { maxWatchedRatio: ratio(stored.maxWatchedRatio), keySegmentSeen: stored.keySegmentSeen === true, ended: stored.ended === true, skips: count(stored.skips), lastWatchedAt: text(stored.lastWatchedAt) };
}
// Watch data only ever grows: rewatching part of a lesson never erases what was seen before.
export function recordWatch(lessonId: string, watch: { watchedRatio: number; keySegmentSeen: boolean; ended: boolean }, now = new Date()) {
  const record = videoRecord(lessonId);
  const next: VideoRecord = { ...record, maxWatchedRatio: Math.max(record.maxWatchedRatio, ratio(watch.watchedRatio)), keySegmentSeen: record.keySegmentSeen || watch.keySegmentSeen, ended: record.ended || watch.ended, lastWatchedAt: isoNow(now) };
  data.videos = { ...(isRecord(data.videos) ? data.videos : {}), [lessonId]: next };
  save();
  return next;
}
export function recordVideoSkip(lessonId: string, topicId: string, now = new Date()) {
  const record = videoRecord(lessonId);
  data.videos = { ...(isRecord(data.videos) ? data.videos : {}), [lessonId]: { ...record, skips: record.skips + 1, lastWatchedAt: isoNow(now) } };
  updateTopic(topicId, topic => { topic.skips++; });
  save();
}

const SIM_OUTCOMES: SimOutcome[] = ['safe', 'unsafe', 'timeout', 'retry', 'exit'];
export function simulations(): SimRecord[] {
  return Array.isArray(data.simulations) ? data.simulations.filter((item): item is SimRecord => isRecord(item) && !!text(item.scenarioId) && SIM_OUTCOMES.includes(item.outcome as SimOutcome)) : [];
}
export const hasSafeRun = (scenarioId: string) => simulations().some(item => item.scenarioId === scenarioId && item.outcome === 'safe');
// Outcomes are evidence, never XP. Exit, unsafe and timeout queue the scenario for review unless
// the learner has already made the safe choice; a later safe run resolves it.
export function recordSimulation(result: Omit<SimRecord, 'at' | 'id'>, now = new Date()) {
  const entry: SimRecord = { ...result, id: newId(), at: isoNow(now) };
  const itemId = `sim:${result.scenarioId}`;
  const safeBefore = hasSafeRun(result.scenarioId);
  data.simulations = [...simulations(), entry].slice(-SIMULATION_LIMIT);
  if (result.outcome === 'safe') resolveReviewIn(itemId, entry.at);
  else if (result.outcome !== 'retry' && !safeBefore && !isQueuedForReview(itemId)) {
    data.reviewLater = [...reviewList(), { itemId, topicId: result.topicId, reason: result.outcome === 'exit' ? 'sim-exit' : 'sim-unsafe', addedAt: entry.at }];
  }
  save();
  return entry;
}
function resolveReviewIn(itemId: string, at: string) {
  data.reviewLater = reviewList().map(item => item.itemId === itemId && !item.resolvedAt ? { ...item, resolvedAt: at } : item);
}

// Days with earned XP in the last 60 days (local calendar days).
export function activeDays(now = new Date()) {
  const oldest = new Date(now); oldest.setDate(oldest.getDate() - 60);
  return Object.entries(data.daily).filter(([day, xp]) => xp > 0 && day >= dayKey(oldest) && day <= dayKey(now)).map(([day]) => day).sort().reverse();
}

export const soundOff = () => data.soundOff === true;
export function setSoundOff(value: boolean) { data.soundOff = value; save(); }

// Where the learner left off. Written whenever a lesson comes on screen in the feed.
export function lastPosition(): { lessonId: string; at: string } | null {
  const stored = data.position;
  return isRecord(stored) && text(stored.lessonId) && text(stored.at) ? { lessonId: stored.lessonId, at: stored.at } : null;
}
export function setPosition(lessonId: string, now = new Date()) {
  if (lastPosition()?.lessonId === lessonId) return;
  data.position = { lessonId, at: isoNow(now) };
  save();
}

// A plain copy of everything stored locally, for the sync adapter and for export.
export function exportLearnerState() { return JSON.parse(JSON.stringify(data)) as Stored; }
