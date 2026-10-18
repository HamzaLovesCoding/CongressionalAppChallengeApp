// The driver coach's request and response logic, kept free of Deno and network code so the Node tests
// (scripts/coach.test.mjs) can run it. index.ts does the I/O.

import type Anthropic from 'npm:@anthropic-ai/sdk@0.131.0';
import { HANDBOOK_PAGES, HANDBOOK_TEXT, HANDBOOK_TITLE } from './handbook.ts';
import { HANDBOOK_CONTEXT, SYSTEM_PROMPT } from './prompt.ts';

export const MODEL = 'claude-sonnet-5-5';
// Answers are short (the prompt asks for under 120 words); this leaves room for a long list or a quiz
// explanation and for thinking, while capping what one question can cost.
export const MAX_TOKENS = 4096;
export const LIMITS = {
  question: 500, // characters; the app's text box stops here too
  answer: 6000, // an earlier answer sent back as history
  turns: 11, // the last five exchanges and the new question
  messages: 60, // a longer conversation is refused rather than trimmed silently
  body: 64_000, // bytes
};

export type Turn = { role: 'user' | 'assistant'; text: string };

// What the app receives, one JSON object per line (NDJSON). src/coach/client.ts reads the same shapes.
export type CoachEvent =
  | { type: 'quota'; remaining: number }
  | { type: 'text'; text: string }
  | { type: 'cite'; pages: string[]; quote: string }
  | { type: 'done'; stop: string }
  | { type: 'refusal' }
  | { type: 'error'; code: 'busy' | 'failed' };

// Validates the app's conversation: questions and answers alternating, starting and ending with a
// question. Returns the turns the model sees, or null for anything malformed. A long earlier answer
// is shortened rather than refused; it is only context.
export function parseTurns(body: unknown): Turn[] | null {
  const list = body && typeof body === 'object' ? (body as { messages?: unknown }).messages : null;
  if (!Array.isArray(list) || list.length === 0 || list.length > LIMITS.messages) return null;
  const turns: Turn[] = [];
  for (const [index, item] of list.entries()) {
    if (!item || typeof item !== 'object') return null;
    const { role, text } = item as Record<string, unknown>;
    const expected = index % 2 === 0 ? 'user' : 'assistant';
    if (role !== expected || typeof text !== 'string') return null;
    const clean = expected === 'user' ? text.trim() : text.trim().slice(0, LIMITS.answer);
    if (!clean || (expected === 'user' && clean.length > LIMITS.question)) return null;
    turns.push({ role: expected, text: clean });
  }
  if (turns.at(-1)!.role !== 'user') return null;
  return turns.slice(-LIMITS.turns);
}

// The handbook goes first in the first message, with the cache marker, so every request from every
// learner shares one cached prefix: the fixed instructions plus the handbook. Only the conversation
// after it changes.
const HANDBOOK: Anthropic.Beta.Messages.BetaRequestDocumentBlock = {
  type: 'document',
  source: { type: 'text', media_type: 'text/plain', data: HANDBOOK_TEXT },
  title: HANDBOOK_TITLE,
  context: HANDBOOK_CONTEXT,
  citations: { enabled: true },
  cache_control: { type: 'ephemeral' },
};

export function coachRequest(turns: Turn[], learner?: string) {
  const [first, ...rest] = turns;
  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    // Chat: low effort keeps the wait short; the model still thinks when a question needs it.
    output_config: { effort: 'low' },
    // Retries a request the model's safety classifiers decline on a fallback model where one applies.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: [HANDBOOK, { type: 'text', text: first.text }] },
      ...rest.map(turn => ({ role: turn.role, content: turn.text })),
    ],
    // An opaque per-learner ID (a hash, never the account ID) so Anthropic can act on abuse by one learner.
    ...(learner ? { metadata: { user_id: learner } } : {}),
  } satisfies Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
}

// Printed handbook pages a cited character range covers (end is exclusive).
export function pagesFor(start: number, end: number): string[] {
  return HANDBOOK_PAGES.filter(([offset], index) => offset < end && (HANDBOOK_PAGES[index + 1]?.[0] ?? Infinity) > start).map(([, page]) => page);
}

const QUOTE_LIMIT = 400;
function quote(text: string) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > QUOTE_LIMIT ? `${clean.slice(0, QUOTE_LIMIT - 1).trimEnd()}…` : clean;
}

export type StreamState = { stop: string | null; usage: Record<string, number | null> };
export const streamState = (): StreamState => ({ stop: null, usage: {} });

// Turns the model's stream into the app's events. Thinking, fallback markers and anything else the
// app doesn't show are skipped.
export function* translate(event: Anthropic.Beta.Messages.BetaRawMessageStreamEvent, state: StreamState): Generator<CoachEvent> {
  switch (event.type) {
    case 'message_start': {
      const { input_tokens, cache_read_input_tokens, cache_creation_input_tokens } = event.message.usage;
      Object.assign(state.usage, { input_tokens, cache_read_input_tokens, cache_creation_input_tokens });
      break;
    }
    case 'content_block_start':
      if (event.content_block.type === 'text' && event.content_block.text) yield { type: 'text', text: event.content_block.text };
      break;
    case 'content_block_delta':
      if (event.delta.type === 'text_delta') yield { type: 'text', text: event.delta.text };
      else if (event.delta.type === 'citations_delta' && event.delta.citation.type === 'char_location') {
        const { start_char_index, end_char_index, cited_text } = event.delta.citation;
        const pages = pagesFor(start_char_index, end_char_index);
        if (pages.length) yield { type: 'cite', pages, quote: quote(cited_text) };
      }
      break;
    case 'message_delta':
      if (event.delta.stop_reason) state.stop = event.delta.stop_reason;
      state.usage.output_tokens = event.usage.output_tokens;
      break;
    case 'message_stop':
      yield state.stop === 'refusal' ? { type: 'refusal' } : { type: 'done', stop: state.stop ?? 'end_turn' };
      break;
  }
}

export const line = (event: CoachEvent) => `${JSON.stringify(event)}\n`;
