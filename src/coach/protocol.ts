// The driver coach's answer arrives as one JSON object per line (supabase/functions/coach/coach.ts
// writes the same shapes). Text comes in pieces; each citation names the handbook pages it quotes.
export type CoachEvent =
  | { type: 'quota'; remaining: number }
  | { type: 'text'; text: string }
  | { type: 'cite'; pages: string[]; quote: string }
  | { type: 'done'; stop: string }
  | { type: 'refusal' }
  | { type: 'error'; code: 'busy' | 'failed' };

// Anything that isn't one of the shapes above is skipped, not trusted.
export function parseEvent(line: string): CoachEvent | null {
  let value: Record<string, unknown>;
  try { value = JSON.parse(line); } catch { return null; }
  if (!value || typeof value !== 'object') return null;
  switch (value.type) {
    case 'quota': return typeof value.remaining === 'number' ? { type: 'quota', remaining: value.remaining } : null;
    case 'text': return typeof value.text === 'string' ? { type: 'text', text: value.text } : null;
    case 'cite': return Array.isArray(value.pages) && value.pages.every(page => typeof page === 'string') && typeof value.quote === 'string'
      ? { type: 'cite', pages: value.pages as string[], quote: value.quote } : null;
    case 'done': return { type: 'done', stop: typeof value.stop === 'string' ? value.stop : 'end_turn' };
    case 'refusal': return { type: 'refusal' };
    case 'error': return { type: 'error', code: value.code === 'busy' ? 'busy' : 'failed' };
    default: return null;
  }
}

// A line can arrive split across network chunks.
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<CoachEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let end: number;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const event = parseEvent(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
        if (event) yield event;
      }
      if (done) break;
    }
    const last = parseEvent(buffer);
    if (last) yield last;
  } finally {
    reader.releaseLock();
  }
}
