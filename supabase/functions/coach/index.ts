// Supabase Edge Function: Lane's driver coach (the request handling is in handler.ts).
// The Anthropic API key lives only here, as the ANTHROPIC_API_KEY secret (supabase/README.md).

import Anthropic from 'npm:@anthropic-ai/sdk@0.131.0';
import { type Allowance, coachHandler, json } from './handler.ts';

const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
const anthropic = apiKey ? new Anthropic({ apiKey, maxRetries: 1, timeout: 90_000 }) : null;

// Counts the question against the learner's daily allowance (supabase/migrations/…_lane_driver_coach.sql).
// It runs as the learner, so it also proves the token belongs to a signed-in Lane account.
async function takeTurn(request: Request): Promise<Allowance | Response> {
  const authorization = request.headers.get('authorization');
  const apikey = request.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY');
  if (!authorization?.startsWith('Bearer ') || !apikey) return json(401, { error: 'unauthorized' });
  try {
    const quota = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/coach_take_turn`, {
      method: 'POST', headers: { apikey, Authorization: authorization, 'Content-Type': 'application/json' }, body: '{}',
    });
    if (quota.status === 401 || quota.status === 403) return json(401, { error: 'unauthorized' });
    if (!quota.ok) return json(503, { error: 'unavailable' });
    return await quota.json();
  } catch {
    return json(503, { error: 'unavailable' });
  }
}

Deno.serve(coachHandler(() => anthropic, takeTurn));
