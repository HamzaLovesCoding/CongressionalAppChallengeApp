import '../feed/minimal.css';
import { CLIPS, clipById } from '../feed/clips';
import { hasSafeRun, record, recordAttempt, resolveReview, simulations, topicRecord } from '../feed/progress';
import { learningFor, topicOf } from '../content/learning';
import { pickChallenges, TOPIC_BANDS, topicBand, type SavedEntry } from '../learning/review';
import { SCENARIOS } from '../simulation/registry';
import { currentReadiness, PLAN_LESSONS, savedEntries } from '../feed/plan';
import type { View } from '../navigation';
import { subpage } from './subpage';
import { TOPIC_NAMES } from './content';

const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const check = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
const day = (date: Date) => date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

// #/review: today's review is the lessons the learner saved (bookmark or Review later). Each is checked
// with its similar question; a right answer moves it to Saved for later until its next review day.
// Answers update topic evidence, never XP.
export function mountReview(root: HTMLElement): View {
  const view = subpage(root, { title: 'Review', back: '#/home', backLabel: 'Back to home', className: 'review-page' });
  const body = view.body;
  const { due, later } = savedEntries();
  const questions = due.filter(entry => learningFor(entry.id)?.similar);
  let index = 0, answered = false, shownAt = 0;

  const lessonRow = (entry: SavedEntry) => {
    const clip = clipById(entry.id)!;
    const note = entry.due ? (entry.nextReview ? 'Due for review' : 'Saved') : `Next review ${day(entry.nextReview!)}`;
    return `<li><a class="sub-row" href="#/feed/${esc(clip.id)}"><span><b>${esc(clip.title)}</b><small>${note}</small></span><i aria-hidden="true">→</i></a></li>`;
  };

  // Topics with answers, weakest first: the band comes from mastery, the note from the actual answers.
  const topicIds = [...new Set(PLAN_LESSONS.map(lesson => lesson.topicId))];
  const score = currentReadiness();
  const topics = topicIds.map(topicId => ({ topicId, record: topicRecord(topicId), title: TOPIC_NAMES[topicId] ?? topicId.replace(/-/g, ' ') }))
    .filter(entry => entry.record.mastery !== null).sort((a, b) => a.record.mastery! - b.record.mastery!);
  const topicRow = (entry: typeof topics[number]) => {
    const band = topicBand(entry.record.mastery!), label = TOPIC_BANDS[band].label, filled = TOPIC_BANDS.length - band;
    const answers = entry.record.attempts ? `${entry.record.correct} of ${entry.record.attempts} ${entry.record.attempts === 1 ? 'answer' : 'answers'} right` : 'Checked with a flashcard';
    return `<li class="sub-row review-topic"><span><b>${esc(entry.title)}</b><small>${label} · ${answers}</small></span><span class="review-band" role="img" aria-label="${label}: ${filled} of ${TOPIC_BANDS.length}">${TOPIC_BANDS.map((_, i) => `<i${i < filled ? ' class="is-on"' : ''}></i>`).join('')}</span></li>`;
  };

  // Three challenges picked from how the learner is doing; the mix changes every other day.
  const runs = simulations();
  const completed = CLIPS.filter(clip => record(clip.id)?.done).length;
  const picks = pickChallenges(SCENARIOS.map(scenario => ({
    id: scenario.id, safe: hasSafeRun(scenario.id), tried: runs.some(run => run.scenarioId === scenario.id),
    lessonDone: scenario.lessonId ? !!record(scenario.lessonId)?.done : completed >= 4,
    mastery: scenario.lessonId ? topicRecord(topicOf(scenario.lessonId)).mastery : null,
  })), new Date());
  const challengeRow = (id: string) => {
    const scenario = SCENARIOS.find(entry => entry.id === id)!, tried = runs.some(run => run.scenarioId === id);
    const note = hasSafeRun(id) ? 'Safe choice made · practice again' : tried ? 'Try it again' : 'Not tried yet';
    return `<li><a class="sub-row" href="#/feed/sim/${scenario.id}"><span><b>${esc(scenario.title)}</b><small>${note}</small></span><i aria-hidden="true">→</i></a></li>`;
  };

  function overview() {
    const saved = due.length + later.length;
    body.innerHTML = `<h2>Today’s review</h2>
      ${due.length ? `<div class="sub-actions"><button class="ui-button" data-start>Start review · ${questions.length} ${questions.length === 1 ? 'question' : 'questions'}</button></div><ul class="sub-list">${due.map(lessonRow).join('')}</ul>`
        : `<p class="sub-note">${saved ? 'You’re caught up for today.' : 'Nothing saved yet.'}</p>`}
      ${later.length ? `<h2>Saved for later</h2><ul class="sub-list">${later.map(lessonRow).join('')}</ul>` : ''}
      <h2>Your topics</h2><p class="sub-note">Driver readiness ${score.score} · ${score.status}.</p>
      ${topics.length ? `<ul class="sub-list">${topics.map(topicRow).join('')}</ul>` : '<p class="sub-note">Answer a lesson check to see your topics.</p>'}
      <h2>Practice challenges</h2><ul class="sub-list">${picks.map(challengeRow).join('')}</ul>`;
  }
  function question() {
    answered = false;
    const entry = questions[index], q = learningFor(entry.id)!.similar;
    body.innerHTML = `<p class="review-progress">${index + 1} of ${questions.length} · ${esc(clipById(entry.id)!.title)}</p>
      <h2 class="review-question" tabindex="-1">${esc(q.question)}</h2>
      <div class="lane-choices">${q.options.map((option, i) => `<button class="lane-choice" data-answer="${i}"><span class="lane-choice-key">${'ABCD'[i]}</span><span class="lane-choice-copy">${esc(option)}</span><span class="lane-choice-status" aria-hidden="true"></span></button>`).join('')}</div>
      <div class="lane-feedback" role="status" aria-live="polite"></div><div class="sub-actions" data-after></div>`;
    body.querySelector<HTMLElement>('.review-question')!.focus({ preventScroll: true });
    shownAt = performance.now();
  }
  function choose(choice: number) {
    if (answered) return;
    answered = true;
    const entry = questions[index], q = learningFor(entry.id)!.similar, correct = choice === q.answer;
    recordAttempt({ itemId: entry.id, topicId: topicOf(entry.id), kind: 'review', correct, activeMs: performance.now() - shownAt });
    // A right answer clears a Review later entry; the bookmark stays, so it returns on its next review day.
    if (correct) resolveReview(entry.id);
    body.querySelectorAll<HTMLButtonElement>('[data-answer]').forEach(button => { button.disabled = true; });
    const button = body.querySelector<HTMLElement>(`[data-answer="${choice}"]`)!;
    button.classList.add(correct ? 'is-right' : 'is-wrong');
    button.querySelector('.lane-choice-status')!.innerHTML = correct ? check : '×';
    const feedback = body.querySelector<HTMLElement>('.lane-feedback')!;
    feedback.className = `lane-feedback ${correct ? 'is-correct' : 'is-retry'}`;
    feedback.innerHTML = `<strong>${correct ? 'Correct.' : 'Almost. Here is the rule that changes the answer.'}</strong><span>${esc(q.explanation)}</span><small class="lane-source">${esc(q.source)}</small>`;
    const last = index === questions.length - 1;
    body.querySelector<HTMLElement>('[data-after]')!.innerHTML = `<button class="ui-button is-split" data-next>${last ? 'Finish review' : 'Next question'} <span aria-hidden="true">→</span></button>`;
    body.querySelector<HTMLButtonElement>('[data-next]')!.focus({ preventScroll: true });
  }
  function done() {
    body.innerHTML = `<p><b>That’s today’s review.</b></p><p>You are getting closer to being permit-test ready.</p><div class="sub-actions"><a class="ui-button" href="#/home">Back to home</a><a class="ui-button is-secondary" href="#/feed">Go to the feed</a></div>`;
  }
  body.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('[data-start]')) { index = 0; question(); return; }
    const pickButton = event.target.closest<HTMLElement>('[data-answer]');
    if (pickButton) { choose(Number(pickButton.dataset.answer)); return; }
    if (event.target.closest('[data-next]')) { if (++index < questions.length) question(); else done(); }
  });
  overview();
  return view;
}
