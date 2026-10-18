import './coach.css';
import { needsOnboarding } from '../feed/progress';
import { go } from '../navigation';
import { coachAvailable } from './client';
import { bindComposer, composerHtml } from './composer';
import { COACH } from './content';
import { askQuestion, coachState, keepDraft } from './state';

const esc = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
export const chatIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5Z"/><path d="M8.5 8h7m-7 3.5h4.5"/></svg>';

// The coach on Practice, under the practice test: one question box and three starters. Asking opens the
// full-screen chat (#/practice/coach) with the answer coming in.
export function coachSection() {
  const { exchanges } = coachState();
  const last = exchanges.at(-1);
  let body: string;
  if (!coachAvailable()) body = `<p class="coach-note">${COACH.problems.unavailable}</p>`;
  // Nothing goes to the server before the learner has agreed to the Terms during setup.
  else if (needsOnboarding()) body = `<p class="coach-note">${COACH.needsSetup} <a href="#/welcome">${COACH.setupLink}</a></p>`;
  else body = `${last ? `<a class="coach-continue" href="#/practice/coach"><span class="coach-continue-icon">${chatIcon}</span><span><b>${COACH.continueTitle}</b><small>${esc(last.question)}</small></span><i aria-hidden="true">›</i></a>` : ''}
    ${composerHtml('coach-question', COACH.placeholder)}
    <ul class="coach-prompts" aria-label="Example questions">${COACH.prompts.map(prompt => `<li><button class="coach-prompt" type="button" data-prompt>${esc(prompt)}</button></li>`).join('')}</ul>`;
  return `<section class="coach-entry" aria-labelledby="coach-title">
    <div class="home-section-heading"><h2 id="coach-title">${COACH.title}</h2><span class="ui-chip is-quiet">${COACH.tag}</span></div>
    <p class="coach-lede">${COACH.lede}</p>
    ${body}
  </section>`;
}

export function bindCoachSection(page: HTMLElement) {
  const section = page.querySelector<HTMLElement>('.coach-entry');
  if (!section?.querySelector('[data-composer]')) return;
  const ask = (question: string) => {
    if (coachState().busy) keepDraft(question); else void askQuestion(question);
    go('#/practice/coach');
  };
  bindComposer(section, ask);
  section.addEventListener('click', event => {
    const prompt = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-prompt]') : null;
    if (prompt) ask(prompt.textContent ?? '');
  });
}
