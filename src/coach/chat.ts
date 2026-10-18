import '../home/home.css';
import '../practice/practice.css';
import './coach.css';
import type { View } from '../navigation';
import { bindComposer, composerHtml } from './composer';
import { COACH } from './content';
import { chatIcon } from './entry';
import { formatAnswer, plainAnswer } from './format';
import { askQuestion, clearConversation, coachState, retry, stopAnswer, subscribeCoach, type Exchange } from './state';

const esc = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const svg = (paths: string, width = 1.8) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const back = svg('<path d="m14 5-7 7 7 7"/>', 2);
const compose = svg('<path d="M12 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V12"/><path d="m17.5 3.5 3 3L12 15l-4 1 1-4Z"/>');
const book = svg('<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v14a1.5 1.5 0 0 0-1.5-1.5h-5A1.5 1.5 0 0 1 4 17Z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v14a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 0 20 17Z"/>', 1.6);
const copy = svg('<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>');
const copied = svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 2.2);
const again = svg('<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>');
const down = svg('<path d="M12 5v14m-6-6 6 6 6-6"/>', 2.2);
const go = svg('<path d="M7 17 17 7M9 7h8v8"/>', 2);
const prompts = () => `<ul class="coach-prompts is-stacked" aria-label="Example questions">${COACH.prompts.map(prompt => `<li><button class="coach-prompt" type="button" data-prompt><span>${esc(prompt)}</span>${go}</button></li>`).join('')}</ul>`;

// The answer bubble's contents. `latest` is the newest exchange while nothing is being answered: only it
// offers Ask again, so asking again never reorders the conversation.
function answerHtml(exchange: Exchange, openPage: string | null, latest: boolean) {
  const { answer, id } = exchange;
  const finished = answer.status !== 'waiting' && answer.status !== 'streaming';
  let html = `<span class="coach-sr">${COACH.coachName}: </span>`;
  if (answer.status === 'waiting') html += `<p class="coach-waiting"><span class="coach-dots" aria-hidden="true"><i></i><i></i><i></i></span>${COACH.waiting}</p>`;
  if (answer.text) html += `<div class="coach-text">${formatAnswer(answer.text)}</div>`;
  if (answer.status === 'cut') html += `<p class="coach-note">${COACH.cut}</p>`;
  if (answer.status === 'stopped') html += `<p class="coach-note">${COACH.stopped}</p>`;
  if (answer.status === 'refused') html += `<p>${COACH.refused}</p>`;
  if (answer.status === 'problem') {
    const problem = answer.problem ?? 'failed';
    html += `<p>${COACH.problems[problem]}</p>${problem === 'daily-limit' || problem === 'unavailable' || problem === 'not-configured' ? '' : `<button class="coach-retry" type="button" data-retry="${id}">${again}${COACH.retry}</button>`}`;
  }
  // Sources and actions appear once the answer is complete, so the row doesn't jump while text streams in.
  const sources = finished && answer.text ? answer.sources : [];
  const canCopy = finished && answer.text !== '' && answer.status !== 'refused';
  const canAsk = latest && (answer.status === 'done' || answer.status === 'cut' || answer.status === 'stopped');
  if (sources.length || canCopy || canAsk) {
    const open = sources.find(source => source.page === openPage);
    html += `<div class="coach-tools">`;
    if (sources.length) html += `<div class="coach-sources"><span class="coach-sources-icon">${book}<span class="coach-sr">${COACH.sources}</span></span>${sources.map(source =>
      `<button class="coach-cite" type="button" data-page="${esc(source.page)}" aria-expanded="${source === open}" aria-controls="coach-quote-${id}" aria-label="${esc(COACH.pageLabel(source.page))}">${esc(COACH.pageChip(source.page))}</button>`).join('')}</div>`;
    html += `<div class="coach-actions">${canCopy ? `<button class="coach-action" type="button" data-copy aria-label="${COACH.copy}">${copy}</button>` : ''}${canAsk ? `<button class="coach-action" type="button" data-again="${id}" aria-label="${COACH.again}">${again}</button>` : ''}</div>`;
    html += `</div>`;
    if (sources.length) html += `<div class="coach-quote" id="coach-quote-${id}"${open ? '' : ' hidden'}>${open ? `${open.quotes.map(quote => `<blockquote>“${esc(quote)}”</blockquote>`).join('')}<p>${esc(COACH.quoteSource(open.page))}</p>` : ''}</div>`;
  }
  return html;
}

// #/practice/coach: the conversation over the full screen, like the practice test, with the question box
// floating at the bottom. It follows the visual viewport so the box stays above a phone's keyboard.
export function mountCoach(root: HTMLElement): View {
  const page = document.createElement('div');
  page.className = 'home-preview practice coach-page';
  page.innerHTML = `<div class="home-phone coach-screen">
    <header class="coach-top">
      <a class="coach-round" href="#/practice" aria-label="${COACH.back}">${back}</a>
      <div class="coach-heading"><h1 id="coach-chat-title" tabindex="-1">${COACH.title}</h1><span class="ui-chip is-quiet">${COACH.tag}</span></div>
      <button class="coach-round coach-new" type="button" data-new aria-label="${COACH.newChat}" hidden>${compose}</button>
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
      <button class="coach-jump" type="button" data-jump aria-label="${COACH.jump}" hidden>${down}</button>
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
  const jump = page.querySelector<HTMLButtonElement>('[data-jump]')!;
  const remainingNote = page.querySelector<HTMLElement>('[data-remaining]')!;
  const status = page.querySelector<HTMLElement>('[data-status]')!;
  const input = page.querySelector<HTMLTextAreaElement>('.coach-dock textarea')!;
  const composer = bindComposer(page.querySelector<HTMLElement>('.coach-dock')!, question => { void askQuestion(question); }, stopAnswer);
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Scrolling: the newest message stays in view while the learner is at the bottom (`follow`). Reading
  // further up stops that and shows the jump button; sending a question glides back down.
  const nearBottom = () => log.scrollHeight - log.scrollTop - log.clientHeight < 96;
  let follow = true, gliding = false, glideTimer = 0;
  const endGlide = () => { gliding = false; clearTimeout(glideTimer); };
  function toBottom(glide: boolean) {
    // The empty chat's welcome reads from the top.
    if (!thread.childElementCount) return;
    if (glide && !still()) {
      gliding = true;
      clearTimeout(glideTimer);
      // `scrollend` isn't everywhere yet; the timer ends a glide that never reports finishing.
      glideTimer = window.setTimeout(() => { endGlide(); if (follow) log.scrollTop = log.scrollHeight; }, 700);
      log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' });
    } else if (!gliding) log.scrollTop = log.scrollHeight;
  }
  const showJump = () => { jump.hidden = follow || nearBottom() || thread.childElementCount === 0; };
  // A glide only ever moves down, so any upward scroll is the learner taking over (keyboard, scrollbar).
  let lastTop = 0;
  log.addEventListener('scroll', () => {
    if (gliding && log.scrollTop < lastTop - 1) endGlide();
    lastTop = log.scrollTop;
    if (!gliding) follow = nearBottom();
    showJump();
  }, { passive: true });
  log.addEventListener('scrollend', () => { if (gliding) { endGlide(); if (follow) toBottom(false); } });
  // A finger or wheel takes the scroll back mid-glide.
  for (const type of ['touchstart', 'wheel'] as const) log.addEventListener(type, () => { if (gliding) { endGlide(); follow = nearBottom(); } }, { passive: true });

  const nodes = new Map<number, { item: HTMLElement; answer: HTMLElement; signature: string; openPage: string | null; status: string }>();
  // Screen readers hear each answer once, when it starts and when it ends, not every streamed word.
  const announcement = ({ answer }: Exchange) => answer.status === 'done' || answer.status === 'cut' ? COACH.answered
    : answer.status === 'stopped' ? COACH.stopped : answer.status === 'refused' ? COACH.refused
    : answer.status === 'problem' ? COACH.problems[answer.problem ?? 'failed'] : answer.status === 'streaming' ? COACH.answering : '';
  let mounted = false;
  function render() {
    const { exchanges, remaining, busy } = coachState();
    let added = false;
    for (const [id, node] of nodes) if (!exchanges.some(exchange => exchange.id === id)) { node.item.remove(); nodes.delete(id); }
    for (const exchange of exchanges) {
      let node = nodes.get(exchange.id);
      if (!node) {
        const item = document.createElement('li');
        // Only messages that arrive while the screen is open animate in; a returning thread just appears.
        item.className = `coach-exchange${mounted ? ' is-new' : ''}`;
        item.innerHTML = `<div class="coach-question"><span class="coach-sr">${COACH.you}: </span>${esc(exchange.question)}</div><div class="coach-answer"></div>`;
        thread.append(item);
        node = { item, answer: item.querySelector<HTMLElement>('.coach-answer')!, signature: '', openPage: null, status: mounted ? 'new' : exchange.answer.status };
        nodes.set(exchange.id, node);
        added = true;
      }
      const { answer } = exchange;
      const latest = !busy && exchange === exchanges.at(-1);
      const signature = `${answer.status}|${answer.text.length}|${answer.sources.map(source => `${source.page}:${source.quotes.length}`).join()}|${node.openPage}|${latest}`;
      if (signature !== node.signature) {
        node.answer.innerHTML = answerHtml(exchange, node.openPage, latest);
        node.answer.dataset.status = answer.status;
        node.answer.classList.toggle('is-notice', answer.status === 'problem' || answer.status === 'refused');
        node.signature = signature;
      }
      if (answer.status !== node.status && answer.status !== 'waiting') status.textContent = announcement(exchange);
      node.status = answer.status;
    }
    empty.hidden = exchanges.length > 0;
    fresh.hidden = exchanges.length === 0;
    input.placeholder = exchanges.length ? COACH.followUp : COACH.placeholder;
    remainingNote.textContent = remaining !== null && remaining <= 5 ? ` ${COACH.remaining(remaining)}.` : '';
    composer.setBusy(busy);
    if (!exchanges.length) { follow = true; log.scrollTop = 0; }
    else if (added && mounted) { follow = true; toBottom(true); }
    else if (follow) toBottom(false);
    mounted = true;
    showJump();
  }

  // Streamed text arrives many times a second; draw at most once per frame.
  let frame = 0;
  const unsubscribe = subscribeCoach(() => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; render(); }); });

  let copiedTimer = 0;
  async function copyAnswer(button: HTMLElement) {
    const exchange = coachState().exchanges.find(item => nodes.get(item.id)?.answer.contains(button));
    if (!exchange) return;
    const pages = exchange.answer.sources.map(source => source.page);
    const text = plainAnswer(exchange.answer.text) + (pages.length ? `\n\n${COACH.copySource(pages)}` : '');
    try {
      await navigator.clipboard.writeText(text);
      button.innerHTML = copied;
      button.classList.add('is-done');
      button.setAttribute('aria-label', COACH.copied);
      status.textContent = `${COACH.copied}.`;
      clearTimeout(copiedTimer);
      copiedTimer = window.setTimeout(() => {
        button.innerHTML = copy;
        button.classList.remove('is-done');
        button.setAttribute('aria-label', COACH.copy);
      }, 1600);
    } catch {
      status.textContent = `${COACH.copyFailed}.`;
    }
  }

  page.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const prompt = target.closest<HTMLElement>('[data-prompt]');
    if (prompt) { void askQuestion(prompt.textContent ?? ''); return; }
    const retryButton = target.closest<HTMLElement>('[data-retry]') ?? target.closest<HTMLElement>('[data-again]');
    if (retryButton) { retry(Number(retryButton.dataset.retry ?? retryButton.dataset.again)); return; }
    const copyButton = target.closest<HTMLElement>('[data-copy]');
    if (copyButton) { void copyAnswer(copyButton); return; }
    if (target.closest('[data-jump]')) { follow = true; toBottom(true); return; }
    if (target.closest('[data-new]')) { clearConversation(); composer.focus(); return; }
    const chip = target.closest<HTMLElement>('[data-page]');
    if (chip) {
      const item = chip.closest<HTMLElement>('.coach-exchange');
      const node = [...nodes.values()].find(entry => entry.item === item);
      if (!node) return;
      node.openPage = node.openPage === chip.dataset.page ? null : chip.dataset.page ?? null;
      // Opening a quote near the bottom shouldn't drag the view down to the end.
      follow = false;
      render();
      node.answer.querySelector<HTMLElement>(`[data-page="${CSS.escape(chip.dataset.page ?? '')}"]`)?.focus();
    }
  });

  // Keeps the screen inside the visible area: when a phone keyboard opens, the box stays above it.
  const viewport = window.visualViewport;
  const fit = () => {
    if (!viewport) return;
    screen.style.setProperty('--coach-height', `${viewport.height}px`);
    screen.style.setProperty('--coach-top', `${viewport.offsetTop}px`);
    if (follow) toBottom(false);
  };
  viewport?.addEventListener('resize', fit);
  viewport?.addEventListener('scroll', fit);
  fit();

  render();
  page.querySelector<HTMLElement>('h1')!.focus({ preventScroll: true });
  return {
    dispose() {
      unsubscribe();
      cancelAnimationFrame(frame);
      clearTimeout(glideTimer);
      clearTimeout(copiedTimer);
      viewport?.removeEventListener('resize', fit);
      viewport?.removeEventListener('scroll', fit);
      page.remove();
    },
  };
}
