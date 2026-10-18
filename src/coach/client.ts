import { appSync } from '../data/sync';
import { RemoteError } from '../data/supabase';
import { CLIPS } from '../feed/clips';
import { readEvents, type CoachEvent } from './protocol';

export type CoachProblem = 'offline' | 'daily-limit' | 'busy' | 'not-configured' | 'unavailable' | 'local-key' | 'failed';
export type CoachMessage = { role: 'user' | 'assistant'; text: string };

// `npm run coach:local` runs the coach on this computer (scripts/coach-local.ts) and the app talks to it
// directly. Development builds only: a production build always goes through Lane's server.
const LOCAL_COACH: string | undefined = import.meta.env.DEV ? import.meta.env.VITE_COACH_LOCAL_URL || undefined : undefined;
export const coachAvailable = () => !!LOCAL_COACH || appSync(CLIPS.map(clip => clip.id)).configured;

async function post(messages: CoachMessage[], signal: AbortSignal) {
  if (!LOCAL_COACH) return appSync(CLIPS.map(clip => clip.id)).coach(messages, signal);
  try { return await fetch(LOCAL_COACH, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages }), signal }); }
  catch (error) { if (signal.aborted) throw error; throw new RemoteError('server', 'Local coach not running'); }
}

// Asks the coach and hands each event to onEvent. Resolves with a problem when there's no answer to
// read (offline, limits, server errors); errors inside an answer arrive as events. Throws when aborted.
export async function askCoach(messages: CoachMessage[], signal: AbortSignal, onEvent: (event: CoachEvent) => void): Promise<CoachProblem | null> {
  if (!coachAvailable()) return 'unavailable';
  if (navigator.onLine === false) return 'offline';
  let response: Response;
  try { response = await post(messages, signal); }
  catch (error) {
    if (signal.aborted) throw error;
    return error instanceof RemoteError && error.reason === 'offline' ? 'offline' : 'failed';
  }
  if (!response.ok || !response.body) {
    const body: { error?: string } = await response.json().catch(() => ({}));
    if (response.status === 429) return body.error === 'daily-limit' ? 'daily-limit' : 'busy';
    // 404: the function isn't deployed yet; 503 not-configured: it has no API key.
    if (response.status === 404 || body.error === 'not-configured') return LOCAL_COACH ? 'local-key' : 'not-configured';
    return 'failed';
  }
  for await (const event of readEvents(response.body)) onEvent(event);
  return null;
}
