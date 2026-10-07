import './practice.css';
import type { View } from '../navigation';
import { go } from '../navigation';
import { homeNavigation } from '../home/tabs';
import { PERMIT_BANK as bank } from './questions';
import { summarize, type TopicResult } from './score';

const esc = (value: string | number) => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const targetPct = Math.round(bank.target * 100);
const check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
const cross = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

export function mountPractice(root: HTMLElement): View {
  const counts = new Map<string, number>();
  for (const q of bank.questions) counts.set(q.topicId, (counts.get(q.topicId) ?? 0) + 1);
  const page = document.createElement('div');
  page.className = 'home-preview practice';
  page.innerHTML = `<div class="home-phone">
    <main class="practice-content" aria-labelledby="practice-title" tabindex="-1">
      <header class="practice-heading"><h1 id="practice-title">Practice</h1><p>Get ready for the California written permit test.</p></header>
      <section class="home-lesson practice-feature" aria-labelledby="practice-test-title">
        <p class="home-eyebrow">Practice test</p>
        <h2 id="practice-test-title">California permit test practice</h2>
        <p class="home-lesson-detail">${plural(bank.questions.length, 'question')} · Aim for ${targetPct}%</p>
        <a class="home-continue" href="#/practice/test">Start test</a>
      </section>
      <section aria-labelledby="practice-topics-title">
        <div class="home-section-heading"><h2 id="practice-topics-title">What’s covered</h2></div>
        <ul class="practice-list">${Object.entries(bank.topics).filter(([id]) => counts.has(id)).map(([id, label]) => `<li><b>${esc(label)}</b><span>${plural(counts.get(id)!, 'question')}</span></li>`).join('')}</ul>
      </section>
      <p class="practice-note">You’ll see whether each answer is right as you go, then your score and the topics to review at the end. This is practice, not an official DMV test.</p>
    </main>
    ${homeNavigation('practice')}
  </div>`;
  root.append(page);
  page.querySelector<HTMLElement>('main')!.focus({ preventScroll: true });
  return { dispose() { page.remove(); } };
}

export function mountPracticeTest(root: HTMLElement): View {
  let index = 0, selected: string | null = null, phase: 'answer' | 'feedback' | 'results' = 'answer', imageReady = true;
  let responses: boolean[] = [];
  const page = document.createElement('div');
  page.className = 'home-preview practice';
  page.innerHTML = `<div class="home-phone practice-quiet">
    <main class="pt" tabindex="-1"></main>
    <dialog class="home-dialog pt-leave" aria-labelledby="pt-leave-title"><form method="dialog"><h2 id="pt-leave-title">Leave the practice test?</h2><div>Your answers so far won’t be saved.</div><button class="home-dialog-done" value="stay" autofocus>Keep going</button><button class="pt-dialog-leave" value="leave">Leave test</button></form></dialog>
  </div>`;
  root.append(page);
  const main = page.querySelector<HTMLElement>('main')!;
  const leave = page.querySelector<HTMLDialogElement>('.pt-leave')!;
  const top = (status: string) => `<header class="pt-top"><button class="home-circle pt-exit" type="button" aria-label="Leave practice test" data-exit>${cross}</button><span class="pt-title">${esc(bank.title)}</span><span class="pt-count">${status}</span></header>`;
  const topicList = (topics: TopicResult[]) => `<ul class="practice-list">${topics.map(t => `<li><b>${esc(t.label)}</b></li>`).join('')}</ul>`;

  function renderResults() {
    const result = summarize(bank, responses);
    const review = result.topics.filter(t => t.status === 'review');
    const limited = result.topics.filter(t => t.status === 'limited');
    main.innerHTML = `${top('Complete')}
      <p class="pt-eyebrow">Practice complete</p><h1 class="pt-results-title" tabindex="-1">Your results</h1>
      <section class="home-lesson pt-score" aria-label="Score">
        <p class="home-eyebrow">Score</p>
        <p class="pt-score-value">${result.percentage}%</p>
        <p class="home-lesson-detail">${result.correct} of ${result.total} correct</p>
        <div class="pt-score-track" aria-hidden="true"><span style="width:${result.percentage}%"></span><i style="left:${targetPct}%"></i></div>
        <p class="pt-score-status">${result.meetsTarget ? `${check}<span>You reached the ${targetPct}% practice target.</span>` : `<span>Keep practicing to reach the ${targetPct}% target.</span>`}</p>
      </section>
      <section class="pt-section"><h2>Areas to improve</h2>${review.length ? topicList(review) : '<p class="pt-detail">No topics stood out for review in this attempt.</p>'}</section>
      ${limited.length ? `<section class="pt-section"><h2>More practice to assess</h2>${topicList(limited)}<p class="pt-detail">This test covers too few different rules in these topics to judge them yet.</p></section>` : ''}
      <footer class="pt-bottom"><button class="pt-action" type="button" data-restart>Start again</button><a class="pt-secondary" href="#/practice">Back to practice</a><p class="pt-caption">Practice target: ${targetPct}%. This is practice, not an official DMV test.</p></footer>`;
  }

  function renderQuestion() {
    const q = bank.questions[index];
    imageReady = !q.image;
    main.innerHTML = `${top(`${index + 1} / ${bank.questions.length}`)}
      <div class="pt-progress" role="progressbar" aria-label="Questions completed" aria-valuemin="0" aria-valuemax="${bank.questions.length}" aria-valuenow="${index}"><span style="width:${index / bank.questions.length * 100}%"></span></div>
      <section class="pt-body">
        <p class="pt-eyebrow">Question ${index + 1}</p><h1 id="pt-question" tabindex="-1">${esc(q.prompt)}</h1>
        ${q.image ? `<div class="pt-sign"><img width="132" height="132" alt="${esc(q.image.alt)}"></div>` : ''}
        <fieldset aria-labelledby="pt-question">${q.choices.map(c => `<label class="pt-option"><input type="radio" name="answer" value="${esc(c.id)}"><span class="pt-option-text">${esc(c.text)}</span><span class="pt-option-status" aria-hidden="true"></span></label>`).join('')}</fieldset>
      </section>
      <footer class="pt-bottom"><p class="pt-feedback" role="status" aria-live="polite" aria-atomic="true"></p><button class="pt-action" type="button" data-action disabled>Submit answer</button><p class="pt-caption">Choose one answer</p></footer>`;
    const image = main.querySelector<HTMLImageElement>('.pt-sign img');
    if (image && q.image) {
      const action = main.querySelector<HTMLButtonElement>('[data-action]')!;
      // Answering a sign question without seeing the sign would be a guess.
      image.onload = () => { imageReady = true; action.disabled = selected === null; };
      image.onerror = () => {
        imageReady = false; action.disabled = true;
        const feedback = main.querySelector<HTMLElement>('.pt-feedback')!;
        feedback.className = 'pt-feedback is-bad'; feedback.textContent = 'The sign could not load. Reload to try again.';
      };
      image.src = q.image.src;
    }
  }

  function render(focus: boolean) {
    if (phase === 'results') renderResults(); else renderQuestion();
    page.scrollTop = 0;
    if (focus) main.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
  }

  function submit() {
    const q = bank.questions[index];
    if (selected === null || !imageReady) return;
    const correct = selected === q.correctChoiceId;
    responses.push(correct);
    phase = 'feedback';
    main.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.disabled = true; });
    // Only the learner's own choice is marked; the bank deliberately doesn't reveal the key mid-test.
    const chosen = main.querySelector<HTMLInputElement>(`input[value="${CSS.escape(selected)}"]`)!.closest('.pt-option')!;
    chosen.classList.add(correct ? 'is-right' : 'is-wrong');
    chosen.querySelector('.pt-option-status')!.innerHTML = correct ? check : cross;
    const feedback = main.querySelector<HTMLElement>('.pt-feedback')!;
    feedback.className = `pt-feedback ${correct ? 'is-good' : 'is-bad'}`;
    feedback.innerHTML = correct ? `${check}<span><strong>Correct</strong></span>` : `${cross}<span><strong>Not quite.</strong> Keep going. You’ll see which topics to review at the end.</span>`;
    const action = main.querySelector<HTMLButtonElement>('[data-action]')!;
    action.textContent = index === bank.questions.length - 1 ? 'See results' : 'Next question';
    main.querySelector('.pt-caption')!.textContent = 'Answer recorded';
    const progress = main.querySelector<HTMLElement>('.pt-progress')!;
    progress.setAttribute('aria-valuenow', String(index + 1));
    progress.querySelector('span')!.style.width = `${(index + 1) / bank.questions.length * 100}%`;
    action.focus({ preventScroll: true });
  }

  function restart() { index = 0; selected = null; phase = 'answer'; responses = []; render(true); }

  page.addEventListener('change', event => {
    if (phase !== 'answer' || !(event.target instanceof HTMLInputElement)) return;
    selected = event.target.value;
    main.querySelector<HTMLButtonElement>('[data-action]')!.disabled = !imageReady;
  });
  page.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('[data-exit]')) {
      // Nothing is lost before the first answer or after results, so only confirm mid-test.
      if (phase !== 'results' && responses.length) leave.showModal(); else go('#/practice');
      return;
    }
    if (event.target.closest('[data-restart]')) { restart(); return; }
    if (!event.target.closest('[data-action]')) return;
    if (phase === 'answer') submit();
    else if (phase === 'feedback') {
      index++; selected = null;
      phase = index === bank.questions.length ? 'results' : 'answer';
      render(true);
    }
  });
  leave.addEventListener('close', () => { if (leave.returnValue === 'leave') go('#/practice'); leave.returnValue = ''; });
  render(true);
  return { dispose() { page.remove(); } };
}
