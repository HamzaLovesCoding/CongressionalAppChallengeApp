// Runs the driver coach's server code on this computer so it can be tried before it's deployed.
// Started by `npm run coach:local` (scripts/coach-local.mjs) with Deno. It reads ANTHROPIC_API_KEY from
// supabase/functions/.env on every question, so a key pasted there works without a restart. There is no
// sign-in and no Supabase here: a per-run question cap stands in for the daily limits.

import Anthropic from 'npm:@anthropic-ai/sdk@0.131.0';
import { coachHandler } from '../supabase/functions/coach/handler.ts';

const ENV_FILE = new URL('../supabase/functions/.env', import.meta.url);
const PORT = 8788;
const QUESTIONS = 100;

let asked = 0;
let client: Anthropic | null = null, clientKey = '';
async function anthropic() {
  let key = '';
  try { key = (await Deno.readTextFile(ENV_FILE)).match(/^ANTHROPIC_API_KEY=(.*)$/m)?.[1].trim() ?? ''; } catch { /* no file */ }
  if (!key) { console.log('Coach: no key yet. Paste it into supabase/functions/.env after ANTHROPIC_API_KEY= and ask again.'); return null; }
  if (key !== clientKey) { client = new Anthropic({ apiKey: key, maxRetries: 1, timeout: 90_000 }); clientKey = key; }
  return client;
}

Deno.serve({ hostname: '127.0.0.1', port: PORT, onListen: () => console.log(`Coach server on http://127.0.0.1:${PORT} (local only; up to ${QUESTIONS} questions per run).`) },
  coachHandler(anthropic, async () => (++asked > QUESTIONS ? { status: 'daily' } : { status: 'ok', remaining: QUESTIONS - asked })));
