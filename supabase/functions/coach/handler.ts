// The driver coach's HTTP handler, shared by the deployed Edge Function (index.ts) and the local runner
// (scripts/coach-local.ts). The app posts the conversation; this checks the allowance, asks Claude with
// the handbook attached, and streams the answer back as NDJSON. Nothing the learner types is stored or
// logged; the logs get token counts and error types only.

import Anthropic from 'npm:@anthropic-ai/sdk@0.131.0';
import { coachRequest, type CoachEvent, LIMITS, line, parseTurns, streamState, translate } from './coach.ts';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
export const json = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export type Allowance = { status: 'ok'; remaining: number; learner?: string } | { status: 'daily' | 'busy' };
// Checks who is asking and counts the question. A Response (such as 401) is sent back as it is.
export type TakeTurn = (request: Request) => Promise<Allowance | Response>;

export function coachHandler(client: () => Anthropic | null | Promise<Anthropic | null>, takeTurn: TakeTurn) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST') return json(405, { error: 'method' });
    const anthropic = await client();
    if (!anthropic) return json(503, { error: 'not-configured' });

    const raw = await request.text();
    if (raw.length > LIMITS.body) return json(413, { error: 'invalid' });
    let turns = null;
    try { turns = parseTurns(JSON.parse(raw)); } catch { /* not JSON */ }
    if (!turns) return json(400, { error: 'invalid' });

    const allowance = await takeTurn(request);
    if (allowance instanceof Response) return allowance;
    if (allowance.status === 'daily') return json(429, { error: 'daily-limit' });
    if (allowance.status !== 'ok') return json(429, { error: 'busy' });

    const learner = allowance.learner ? await hash(allowance.learner) : undefined;
    // Not tied to request.signal: the hosted edge runtime aborts it as soon as the streamed Response is returned,
    // which cancelled every answer. cancel() below still stops the request when the learner closes the app.
    const stream = anthropic.beta.messages.stream(coachRequest(turns, learner));
    const state = streamState();
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        // The learner may close the app mid-answer; writing to a cancelled stream throws.
        const send = (event: CoachEvent) => { try { controller.enqueue(encoder.encode(line(event))); } catch { /* cancelled */ } };
        send({ type: 'quota', remaining: allowance.remaining });
        try {
          for await (const event of stream) for (const out of translate(event, state)) send(out);
          console.log(JSON.stringify({ coach: 'answered', stop: state.stop, ...state.usage }));
        } catch (error) {
          const status = error instanceof Anthropic.APIError ? error.status ?? null : null;
          // The SDK's error classes all report name "Error", so log the class (e.g. APIUserAbortError, APIConnectionError).
          console.error(JSON.stringify({ coach: 'failed', status, error: error instanceof Error ? error.constructor.name : 'unknown' }));
          send({ type: 'error', code: status === 429 || status === 503 || status === 529 ? 'busy' : 'failed' });
        }
        try { controller.close(); } catch { /* cancelled */ }
      },
      cancel() { stream.abort(); },
    });
    return new Response(body, { headers: { ...CORS, 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' } });
  };
}

// Anthropic gets a one-way hash of the account ID, never the ID itself.
async function hash(id: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`lane-coach:${id}`));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
