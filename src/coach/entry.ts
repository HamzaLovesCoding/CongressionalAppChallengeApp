import './coach.css';
import { needsOnboarding } from '../feed/progress';
import { coachAvailable } from './client';
import { COACH } from './content';
import { coachState } from './state';

const esc = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
export const chatIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5Z"/><path d="M8.5 8h7m-7 3.5h4.5"/></svg>';
const search = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>';
const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';

// The coach on Practice, under the practice test: one card that opens the full-screen chat
// (#/practice/coach). Questions are only asked there.
export function coachSection() {
  const last = coachState().exchanges.at(-1);
  const available = coachAvailable();
  // Nothing goes to the server before the learner has agreed to the Terms during setup, so the card leads there first.
  const setup = available && needsOnboarding();
  const lede = !available ? COACH.problems.unavailable : setup ? COACH.needsSetup : last ? COACH.continueTitle : COACH.lede;
  const field = setup ? COACH.setupLink : last ? esc(last.question) : COACH.placeholder;
  const inner = `<span class="coach-card-top"><span class="coach-card-mark">${chatIcon}</span><h2 id="coach-title">${COACH.title}</h2><span class="ui-chip is-quiet">${COACH.tag}</span></span>
    <span class="coach-card-lede">${lede}</span>
    ${available ? `<span class="coach-card-field${last || setup ? ' is-filled' : ''}">${setup ? '' : `<span class="coach-card-search">${search}</span>`}<span class="coach-card-text">${field}</span><span class="coach-card-go">${arrow}</span></span>` : ''}`;
  return `<section class="coach-entry" aria-labelledby="coach-title">
    ${available ? `<a class="coach-card" href="${setup ? '#/welcome' : '#/practice/coach'}">${inner}</a>` : `<div class="coach-card is-off">${inner}</div>`}
  </section>`;
}
