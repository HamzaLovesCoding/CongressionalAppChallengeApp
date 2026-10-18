import { askCoach, type CoachMessage, type CoachProblem } from './client';
import type { CoachEvent } from './protocol';

// The current coach conversation, in memory only: it survives moving between Practice and the chat,
// and is gone when Lane closes or reloads. Nothing here is saved to the device.

export type Source = { page: string; quotes: string[] };
export type AnswerStatus = 'waiting' | 'streaming' | 'done' | 'cut' | 'stopped' | 'refused' | 'problem';
export type Answer = { text: string; sources: Source[]; status: AnswerStatus; problem?: CoachProblem };
export type Exchange = { id: number; question: string; answer: Answer };

// The server keeps the last five exchanges as context (supabase/functions/coach/coach.ts LIMITS.turns).
const CONTEXT_EXCHANGES = 5;
const ANSWER_CONTEXT = 6000;
const QUOTES_PER_PAGE = 3;

let exchanges: Exchange[] = [];
let remaining: number | null = null;
let running: AbortController | null = null;
let nextId = 1;
// A question typed on Practice while an answer was still coming in; the chat puts it back in its box.
let draft = '';
export function keepDraft(text: string) { draft = text; }
export function takeDraft() { const text = draft; draft = ''; return text; }
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

export const coachState = () => ({ exchanges, remaining, busy: running !== null });
export function subscribeCoach(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

// Only finished answers are context; a failed or stopped one is left out so the next question can follow.
const answered = (exchange: Exchange) => (exchange.answer.status === 'done' || exchange.answer.status === 'cut') && exchange.answer.text.trim() !== '';
function history(): CoachMessage[] {
  return exchanges.filter(answered).slice(-CONTEXT_EXCHANGES)
    .flatMap(exchange => [{ role: 'user', text: exchange.question }, { role: 'assistant', text: exchange.answer.text.slice(0, ANSWER_CONTEXT) }]);
}

function apply(exchange: Exchange, event: CoachEvent) {
  const answer = exchange.answer;
  switch (event.type) {
    case 'quota': remaining = event.remaining; break;
    case 'text': answer.text += event.text; answer.status = 'streaming'; break;
    case 'cite':
      for (const page of event.pages) {
        let source = answer.sources.find(item => item.page === page);
        if (!source) answer.sources.push(source = { page, quotes: [] });
        if (event.quote && !source.quotes.includes(event.quote) && source.quotes.length < QUOTES_PER_PAGE) source.quotes.push(event.quote);
      }
      break;
    case 'done': answer.status = event.stop === 'max_tokens' ? 'cut' : 'done'; break;
    // A declined answer may have started; none of it is kept.
    case 'refusal': answer.text = ''; answer.sources = []; answer.status = 'refused'; break;
    case 'error': answer.status = 'problem'; answer.problem = event.code; break;
  }
  notify();
}

export async function askQuestion(question: string) {
  const text = question.trim();
  if (!text || running) return;
  const context = history();
  const exchange: Exchange = { id: nextId++, question: text, answer: { text: '', sources: [], status: 'waiting' } };
  exchanges = [...exchanges, exchange];
  const controller = running = new AbortController();
  notify();
  try {
    const problem = await askCoach([...context, { role: 'user', text }], controller.signal, event => apply(exchange, event));
    if (problem) Object.assign(exchange.answer, { status: 'problem', problem });
    // The stream ended without saying how; treat it as a failed answer rather than a finished one.
    else if (exchange.answer.status === 'waiting' || exchange.answer.status === 'streaming') Object.assign(exchange.answer, { status: 'problem', problem: 'failed' });
  } catch {
    if (controller.signal.aborted) exchange.answer.status = 'stopped';
    else Object.assign(exchange.answer, { status: 'problem', problem: 'failed' });
  } finally {
    if (running === controller) running = null;
    notify();
  }
}

// Asks the same question again in place of a failed answer.
export function retry(id: number) {
  const exchange = exchanges.find(item => item.id === id);
  if (!exchange || running) return;
  exchanges = exchanges.filter(item => item !== exchange);
  void askQuestion(exchange.question);
}

export function stopAnswer() { running?.abort(); }

export function clearConversation() {
  running?.abort();
  running = null;
  exchanges = [];
  notify();
}
