export const XP_PER_CLIP = 10;
export const DAILY_GOAL = 50;

type ClipRecord = { tries: number; firstTry: boolean; done: boolean };
type Stored = { xp: number; clips: Record<string, ClipRecord>; daily: Record<string, number>; liked: string[]; saved: string[] };

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
    done: attempted.filter(clip => clip.done).length,
  };
}
