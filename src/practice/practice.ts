import './practice.css';
import { icon } from '../home/icons';
import type { View } from '../navigation';
import { go } from '../navigation';
import { homeNavigation } from '../home/tabs';
import { PERMIT_BANK as bank } from './questions';
import { lessonsToRevisit, summarize, type TopicResult } from './score';
import { CONCEPT_LESSONS } from './lessons';
import { clipById } from '../feed/clips';
import { topicRecord } from '../feed/progress';
import { LEARNING, topicOf } from '../content/learning';
import { reviewPriority, smoothMastery } from '../learning/scoring';
import { bindCoachSection, coachSection } from '../coach/entry';

const esc = (value: string | number) => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const targetPct = Math.round(bank.target * 100);
const check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
const cross = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';
// This test's accuracy updates the lesson topic's mastery for ranking only; nothing is saved.
const priorityOf = (id: string, accuracy: number) => {
  const t = topicRecord(topicOf(id));
  const days = t.lastPracticedAt ? (Date.now() - Date.parse(t.lastPracticedAt)) / 864e5 : 0;
  return reviewPriority({ mastery: smoothMastery(t.mastery, accuracy), daysSincePractice: days, skips: t.skips, safety: LEARNING[id]?.safety ?? 0.5 });
};
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
// One small icon per bank topic so the list scans at a glance; an unknown topic falls back to the clipboard.
const topicPaths: Record<string, string> = {
  signs: '<path d="M12 2.5 21.5 12 12 21.5 2.5 12Z"/><path d="M12 8v5m0 3v.01"/>',
  safe: '<path d="M3.5 16.5a8.5 8.5 0 0 1 17 0"/><path d="m12 16.5 4-5"/><circle cx="12" cy="16.5" r="1" fill="currentColor"/>',
  lanes: '<path d="M7 21V12a4 4 0 0 1 4-4h8"/><path d="m16 5 3 3-3 3"/>',
  yield: '<path d="M3 4.5h18L12 20Z"/>',
  parking: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M10 17V8h3a2.5 2.5 0 0 1 0 5h-3"/>',
  duties: '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="11" r="2"/><path d="M6 16c1-2 5-2 6 0m3-6h3m-3 3h3"/>',
};
const topicIcon = (id: string) => `<span class="practice-topic-icon">${topicPaths[id] ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${topicPaths[id]}</svg>` : icon('practice')}</span>`;

export function mountPractice(root: HTMLElement): View {
  const counts = new Map<string, number>();
  for (const q of bank.questions) counts.set(q.topicId, (counts.get(q.topicId) ?? 0) + 1);
  const page = document.createElement('div');
  page.className = 'home-preview practice';
  page.innerHTML = `<div class="home-phone">
    <main class="practice-content" aria-labelledby="practice-title" tabindex="-1">
      <header class="practice-heading ui-page-head"><h1 id="practice-title">Practice</h1></header>
      <section class="home-lesson practice-feature" aria-labelledby="practice-test-title">
        <div class="practice-feature-top"><span class="practice-test-label">Written test</span><span class="practice-test-art" aria-hidden="true">${icon('practice')}</span></div>
        <h2 id="practice-test-title">Put your knowledge<br>to the test.</h2>
        <div class="practice-test-facts"><span><b>${bank.questions.length}</b> questions</span><span><b>${targetPct}%</b> target</span></div>
        <a class="home-continue ui-button is-split" href="#/practice/test">Start test <span aria-hidden="true">→</span></a>
      </section>
      ${coachSection()}
      <section aria-labelledby="practice-topics-title">
        <div class="home-section-heading"><h2 id="practice-topics-title">What’s covered</h2></div>
        <ul class="practice-list">${Object.entries(bank.topics).filter(([id]) => counts.has(id)).map(([id, label]) => `<li>${topicIcon(id)}<b>${esc(label)}</b><span>${plural(counts.get(id)!, 'question')}</span></li>`).join('')}</ul>
      </section>
      <p class="practice-note">You’ll see whether each answer is right as you go, then your score and the topics to review at the end. These are Lane practice questions. The DMV test uses its own.</p>
    </main>
    ${homeNavigation('practice')}
  </div>`;
  root.append(page);
  bindCoachSection(page);
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
    <dialog class="home-dialog pt-leave" aria-labelledby="pt-leave-title"><form method="dialog"><h2 id="pt-leave-title">Leave the practice test?</h2><div>Your answers so far won’t be saved.</div><button class="home-dialog-done ui-button" value="stay" autofocus>Keep going</button><button class="pt-dialog-leave ui-button is-secondary" value="leave">Leave test</button></form></dialog>
  </div>`;
  root.append(page);
  const main = page.querySelector<HTMLElement>('main')!;
  const leave = page.querySelector<HTMLDialogElement>('.pt-leave')!;
  const top = (status: string) => `<header class="pt-top"><button class="home-circle pt-exit" type="button" aria-label="Leave practice test" data-exit>${cross}</button><span class="pt-title">${esc(bank.title)}</span><span class="pt-count">${status}</span></header>`;
  const topicList = (topics: TopicResult[]) => `<ul class="practice-list">${topics.map(t => `<li>${topicIcon(t.id)}<b>${esc(t.label)}</b></li>`).join('')}</ul>`;

  function renderResults() {
    const result = summarize(bank, responses);
    const review = result.topics.filter(t => t.status === 'review');
    const limited = result.topics.filter(t => t.status === 'limited');
    const picks = lessonsToRevisit(bank, responses, CONCEPT_LESSONS, priorityOf);
    main.innerHTML = `${top('Complete')}
      <p class="pt-eyebrow">Practice complete</p><h1 class="pt-results-title" tabindex="-1">Your results</h1>
      <section class="home-lesson pt-score${result.meetsTarget ? ' is-met' : ''}" aria-label="Score">
        <div class="pt-score-main">
          <div class="pt-score-ring" aria-hidden="true"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52"/>${result.percentage ? `<circle class="pt-score-arc" cx="60" cy="60" r="52" pathLength="100" stroke-dasharray="${result.percentage} 100"/>` : ''}<line x1="103" y1="60" x2="119" y2="60" transform="rotate(${targetPct * 3.6} 60 60)"/></svg>${result.meetsTarget ? `<span class="pt-score-star">${icon('star')}</span>` : ''}</div>
          <div><p class="home-eyebrow">Score</p><p class="pt-score-value">${result.percentage}%</p><p class="home-lesson-detail">${result.correct} of ${result.total} correct</p></div>
        </div>
        <p class="pt-score-status">${result.meetsTarget ? `${check}<span>You reached the ${targetPct}% practice target.</span>` : `<span>Keep practicing to reach the ${targetPct}% target.</span>`}</p>
      </section>
      <section class="pt-section"><h2>Areas to improve</h2>${review.length ? topicList(review) : '<p class="pt-detail">No topics stood out for review in this attempt.</p>'}</section>
      ${picks.length ? `<section class="pt-section"><h2>Lessons to revisit</h2><ul class="practice-list pt-lessons">${picks.map(p => `<li><a href="#/feed/${esc(p.lessonId)}"><span class="practice-topic-icon">${icon('feed')}</span><b>${esc(clipById(p.lessonId)!.title)}</b><span>${p.missed} missed</span></a></li>`).join('')}</ul><p class="pt-detail">Picked from the questions you missed.</p></section>` : ''}
      ${limited.length ? `<section class="pt-section"><h2>More practice to assess</h2>${topicList(limited)}<p class="pt-detail">This test covers too few different rules in these topics to judge them yet.</p></section>` : ''}
      <footer class="pt-bottom"><button class="pt-action ui-button" type="button" data-restart>Start again</button><a class="pt-secondary ui-button is-secondary" href="#/practice">Back to practice</a><p class="pt-caption">Practice target: ${targetPct}%. These are Lane practice questions. The DMV test uses its own.</p></footer>`;
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
      <footer class="pt-bottom is-sticky"><p class="pt-feedback" role="status" aria-live="polite" aria-atomic="true"></p><button class="pt-action ui-button" type="button" data-action disabled>Submit answer</button><p class="pt-caption">Choose one answer</p></footer>`;
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

  // Back mid-test would silently drop the attempt, so one same-URL history entry catches it and
  // asks first, like the leave button.
  let guarded = false;
  function guard() {
    if (guarded) return;
    history.pushState({ practiceGuard: true }, '', location.href);
    guarded = true;
  }
  function onPop() {
    if (!guarded || location.hash !== '#/practice/test') return;
    guarded = false;
    if (phase === 'results' || !responses.length) return;
    guard();
    if (!leave.open) leave.showModal();
  }
  window.addEventListener('popstate', onPop);

  // Submit turns into Next in place, so a quick second tap would skip the feedback.
  let answeredAt = 0;
  function submit() {
    const q = bank.questions[index];
    if (selected === null || !imageReady) return;
    const correct = selected === q.correctChoiceId;
    responses.push(correct);
    guard();
    answeredAt = performance.now();
    phase = 'feedback';
    main.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.disabled = true; });
    // Only the learner's own choice is marked; the bank deliberately doesn't reveal the key mid-test.
    const chosen = main.querySelector<HTMLInputElement>(`input[value="${CSS.escape(selected)}"]`)!.closest('.pt-option')!;
    chosen.classList.add(correct ? 'is-right' : 'is-wrong');
    chosen.querySelector('.pt-option-status')!.innerHTML = correct ? check : cross;
    const feedback = main.querySelector<HTMLElement>('.pt-feedback')!;
    feedback.className = `pt-feedback ${correct ? 'is-good' : 'is-bad'}`;
    // Consecutive correct answers ending with this one, from this attempt only; never stored.
    const run = correct ? responses.length - 1 - responses.lastIndexOf(false) : 0;
    feedback.innerHTML = correct ? `${check}<span><strong>Correct</strong></span>${run >= 2 ? `<span class="pt-run ui-chip is-accent">${icon('flame')}${run} in a row</span>` : ''}` :`${cross}<span><strong>Not quite.</strong> Keep going. You’ll see which topics to review at the end.</span>`;
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
      if (performance.now() - answeredAt < 400) return;
      index++; selected = null;
      phase = index === bank.questions.length ? 'results' : 'answer';
      // Nothing is left to lose on the results screen, so drop the guard entry and let Back leave in one press.
      if (phase === 'results' && guarded) { guarded = false; history.back(); }
      render(true);
    }
  });
  // Leaving from the guard entry replaces it, so Back afterwards doesn't land on the test twice.
  leave.addEventListener('close', () => { if (leave.returnValue === 'leave') go('#/practice', guarded); leave.returnValue = ''; });
  render(true);
  main.classList.add('is-live');
  return { dispose() { window.removeEventListener('popstate', onPop); page.remove(); } };
}
