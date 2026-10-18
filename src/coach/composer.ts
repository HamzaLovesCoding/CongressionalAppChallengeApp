import { COACH } from './content';

// The chat's question box: a growing text area with one send button.
export const QUESTION_LIMIT = 500; // supabase/functions/coach/coach.ts LIMITS.question
const WARN_AT = 400;
const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg>';
const square = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/></svg>';

export const composerHtml = (id: string, placeholder: string) => `<form class="coach-composer" data-composer novalidate>
    <label class="coach-sr" for="${id}">${COACH.inputLabel}</label>
    <textarea id="${id}" rows="1" maxlength="${QUESTION_LIMIT}" placeholder="${placeholder}" enterkeyhint="send" autocomplete="off" autocapitalize="sentences"></textarea>
    <button class="coach-send" type="submit" aria-label="${COACH.send}" disabled>${arrow}</button>
  </form>
  <p class="coach-count" data-count></p>`;

export type Composer = { setBusy(busy: boolean): void; focus(): void; fill(text: string): void };

// onAsk gets the trimmed question; onStop runs when the button is a stop button (while answering).
export function bindComposer(scope: HTMLElement, onAsk: (question: string) => void, onStop?: () => void): Composer {
  const form = scope.querySelector<HTMLFormElement>('[data-composer]')!;
  const input = form.querySelector('textarea')!;
  const button = form.querySelector<HTMLButtonElement>('.coach-send')!;
  const count = scope.querySelector<HTMLElement>('[data-count]')!;
  let busy = false;
  const update = () => {
    // Grows with the question up to about five lines, then scrolls.
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 132)}px`;
    const left = QUESTION_LIMIT - input.value.length;
    count.textContent = input.value.length >= WARN_AT ? COACH.charactersLeft(left) : '';
    if (busy) return;
    button.disabled = !input.value.trim();
  };
  const submit = () => {
    if (busy) { onStop?.(); return; }
    const question = input.value.trim();
    if (!question) return;
    input.value = '';
    update();
    onAsk(question);
  };
  input.addEventListener('input', update);
  // Enter sends (the keyboard's Send key on phones); Shift+Enter starts a new line.
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); submit(); }
  });
  form.addEventListener('submit', event => { event.preventDefault(); submit(); });
  return {
    setBusy(next) {
      busy = next && !!onStop;
      button.classList.toggle('is-stop', busy);
      button.innerHTML = busy ? square : arrow;
      button.setAttribute('aria-label', busy ? COACH.stop : COACH.send);
      button.disabled = busy ? false : !input.value.trim();
    },
    focus() { input.focus(); },
    fill(text) { input.value = text; update(); },
  };
}
