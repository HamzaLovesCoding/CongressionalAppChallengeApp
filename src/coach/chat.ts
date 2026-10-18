import '../home/home.css';
import '../practice/practice.css';
import './coach.css';
import type { View } from '../navigation';
import { bindComposer, composerHtml } from './composer';
import { COACH } from './content';
import { chatIcon } from './entry';
import { formatAnswer } from './format';
import { askQuestion, clearConversation, coachState, retry, stopAnswer, subscribeCoach, takeDraft, type Exchange } from './state';

const esc = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const back = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg>';
const compose = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V12"/><path d="m17.5 3.5 3 3L12 15l-4 1 1-4Z"/></svg>';
const prompts = () => `<ul class="coach-prompts is-stacked" aria-label="Example questions">${COACH.prompts.map(prompt => `<li><button class="coach-prompt" type="button" data-prompt>${esc(prompt)}</button></li>`).join('')}</ul>`;

function answerHtml(exchange: Exchange, openPage: string | null) {
  const { answer, id } = exchange;
  const finished = answer.status !== 'waiting' && answer.status !== 'streaming';
  let html = `<p class="coach-label"><span class="coach-mark">${chatIcon}</span>${COACH.coachName}</p>`;
  if (answer.status === 'waiting') html += `<p class="coach-waiting">${COACH.waiting}<span aria-hidden="true"><i></i><i></i><i></i></span></p>`;
  if (answer.text) html += `<div class="coach-text">${formatAnswer(answer.text)}</div>`;
  // Sources appear once the answer is complete, so the row doesn't jump while text streams in.
  if (finished && answer.text && answer.sources.length) {
    const open = answer.sources.find(source => source.page === openPage);
    html += `<div class="coach-sources"><span class="coach-sources-label">${COACH.sources}</span>${answer.sources.map(source =>
      `<button class="coach-cite" type="button" data-page="${esc(source.page)}" aria-expanded="${source === open}" aria-controls="coach-quote-${id}" aria-label="${esc(COACH.pageLabel(source.page))}">${esc(COACH.pageChip(source.page))}</button>`).join('')}</div>`;
    html += `<div class="coach-quote" id="coach-quote-${id}"${open ? '' : ' hidden'}>${open ? `${open.quotes.map(quote => `<blockquote>“${esc(quote)}”</blockquote>`).join('')}<p>${esc(COACH.quoteSource(open.page))}</p>` : ''}</div>`;
  }
  if (answer.status === 'cut') html += `<p class="coach-note">${COACH.cut}</p>`;
  if (answer.status === 'stopped') html += `<p class="coach-note">${COACH.stopped}</p>`;
  if (answer.status === 'refused') html += `<p class="coach-problem">${COACH.refused}</p>`;
  if (answer.status === 'problem') {
    const problem = answer.problem ?? 'failed';
    html += `<div class="coach-problem"><p>${COACH.problems[problem]}</p>${problem === 'daily-limit' || problem === 'unavailable' || problem === 'not-configured' ? '' : `<button class="coach-retry" type="button" data-retry="${id}">${COACH.retry}</button>`}</div>`;
  }
  return html;
}

// #/practice/coach: the conversation over the full screen, like the practice test, with the question box
// pinned to the bottom. It follows the visual viewport so the box stays above a phone's keyboard.
export function mountCoach(root: HTMLElement): View {
  const page = document.createElement('div');
  page.className = 'home-preview practice coach-page';
  page.innerHTML = `<div class="home-phone coach-screen">
    <header class="coach-top">
      <a class="home-circle" href="#/practice" aria-label="${COACH.back}">${back}</a>
      <div class="coach-heading"><h1 id="coach-chat-title" tabindex="-1">${COACH.title}</h1><span class="ui-chip is-quiet">${COACH.tag}</span></div>
      <button class="coach-new" type="button" data-new hidden>${compose}<span>${COACH.newChat}</span></button>
    </header>
    <main class="coach-log" aria-labelledby="coach-chat-title">
      <section class="coach-empty" data-empty aria-labelledby="coach-empty-title">
        <span class="coach-empty-icon">${chatIcon}</span>
        <h2 id="coach-empty-title">${COACH.heading}</h2>
        <p>${COACH.intro}</p>
        ${prompts()}
        <p class="coach-safety">${COACH.driving}</p>
      </section>
      <ol class="coach-thread" aria-label="Conversation" data-thread></ol>
    </main>
    <div class="coach-dock">
      ${composerHtml('coach-chat-question', COACH.followUp)}
      <p class="coach-foot">${COACH.footnote}<span data-remaining></span></p>
    </div>
    <p class="coach-sr" aria-live="polite" data-status></p>
  </div>`;
  root.append(page);

  const screen = page.querySelector<HTMLElement>('.coach-screen')!;
  const log = page.querySelector<HTMLElement>('.coach-log')!;
  const thread = page.querySelector<HTMLElement>('[data-thread]')!;
  const empty = page.querySelector<HTMLElement>('[data-empty]')!;
  const fresh = page.querySelector<HTMLButtonElement>('[data-new]')!;
  const remainingNote = page.querySelector<HTMLElement>('[data-remaining]')!;
  const status = page.querySelector<HTMLElement>('[data-status]')!;
  const input = page.querySelector<HTMLTextAreaElement>('.coach-dock textarea')!;
  const composer = bindComposer(page.querySelector<HTMLElement>('.coach-dock')!, question => { void askQuestion(question); }, stopAnswer);

  const nodes = new Map<number, { item: HTMLElement; answer: HTMLElement; signature: string; openPage: string | null; status: string }>();
  const nearBottom = () => log.scrollHeight - log.scrollTop - log.clientHeight < 96;
  // Screen readers hear each answer once, when it starts and when it ends, not every streamed word.
  const announcement = ({ answer }: Exchange) => answer.status === 'done' || answer.status === 'cut' ? COACH.answered
    : answer.status === 'stopped' ? COACH.stopped : answer.status === 'refused' ? COACH.refused
    : answer.status === 'problem' ? COACH.problems[answer.problem ?? 'failed'] : answer.status === 'streaming' ? COACH.answering : '';
  let mounted = false;
  function render(scroll: 'follow' | 'end' = 'follow') {
    const { exchanges, remaining, busy } = coachState();
    const follow = scroll === 'end' || nearBottom();
    for (const [id, node] of nodes) if (!exchanges.some(exchange => exchange.id === id)) { node.item.remove(); nodes.delete(id); }
    for (const exchange of exchanges) {
      let node = nodes.get(exchange.id);
      if (!node) {
        const item = document.createElement('li');
        item.className = 'coach-exchange';
        item.innerHTML = `<div class="coach-question"><span class="coach-sr">${COACH.you}: </span>${esc(exchange.question)}</div><div class="coach-answer"></div>`;
        thread.append(item);
        node = { item, answer: item.querySelector<HTMLElement>('.coach-answer')!, signature: '', openPage: null, status: mounted ? 'new' : exchange.answer.status };
        nodes.set(exchange.id, node);
      }
      const { answer } = exchange;
      const signature = `${answer.status}|${answer.text.length}|${answer.sources.map(source => `${source.page}:${source.quotes.length}`).join()}|${node.openPage}`;
      if (signature !== node.signature) {
        node.answer.innerHTML = answerHtml(exchange, node.openPage);
        node.answer.dataset.status = answer.status;
        node.signature = signature;
      }
      if (answer.status !== node.status && answer.status !== 'waiting') status.textContent = announcement(exchange);
      node.status = answer.status;
    }
    mounted = true;
    empty.hidden = exchanges.length > 0;
    fresh.hidden = exchanges.length === 0;
    input.placeholder = exchanges.length ? COACH.followUp : COACH.placeholder;
    remainingNote.textContent = remaining !== null && remaining <= 5 ? ` ${COACH.remaining(remaining)}.` : '';
    composer.setBusy(busy);
    if (follow) log.scrollTop = log.scrollHeight;
  }

  // Streamed text arrives many times a second; draw at most once per frame.
  let frame = 0;
  const unsubscribe = subscribeCoach(() => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; render(); }); });

  page.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const prompt = target.closest<HTMLElement>('[data-prompt]');
    if (prompt) { void askQuestion(prompt.textContent ?? ''); return; }
    const retryButton = target.closest<HTMLElement>('[data-retry]');
    if (retryButton) { retry(Number(retryButton.dataset.retry)); return; }
    if (target.closest('[data-new]')) { clearConversation(); composer.focus(); return; }
    const chip = target.closest<HTMLElement>('[data-page]');
    if (chip) {
      const item = chip.closest<HTMLElement>('.coach-exchange');
      const node = [...nodes.values()].find(entry => entry.item === item);
      if (!node) return;
      node.openPage = node.openPage === chip.dataset.page ? null : chip.dataset.page ?? null;
      render('follow');
      node.answer.querySelector<HTMLElement>(`[data-page="${CSS.escape(chip.dataset.page ?? '')}"]`)?.focus();
    }
  });

  // Keeps the screen inside the visible area: when a phone keyboard opens, the box stays above it.
  const viewport = window.visualViewport;
  const fit = () => {
    if (!viewport) return;
    screen.style.setProperty('--coach-height', `${viewport.height}px`);
    screen.style.setProperty('--coach-top', `${viewport.offsetTop}px`);
    if (nearBottom()) log.scrollTop = log.scrollHeight;
  };
  viewport?.addEventListener('resize', fit);
  viewport?.addEventListener('scroll', fit);
  fit();

  render('end');
  const draft = takeDraft();
  if (draft) composer.fill(draft);
  page.querySelector<HTMLElement>('h1')!.focus({ preventScroll: true });
  return {
    dispose() {
      unsubscribe();
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', fit);
      viewport?.removeEventListener('scroll', fit);
      page.remove();
    },
  };
}
