import './home.css';
import { bindMenu, menuButton, menuSheetMarkup } from './menu';
import type { View } from '../navigation';
import { CLIPS } from '../feed/clips';
import { onboarding, record, stats, XP_PER_CLIP } from '../feed/progress';
import { goalReadiness } from '../learning/scoring';
import { homeContent as copy } from './content';
import { lessonProgress } from './model';
import { currentReadiness, nextLessonId, savedEntries } from '../feed/plan';
import { icon } from './icons';
import { homeNavigation } from './tabs';
import { mountLeaderboard } from './leaderboard';

const esc = (value: string | number) => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const topic = (value: string) => value[0].toUpperCase() + value.slice(1);

export function mountHome(root: HTMLElement): View {
  // Saved lessons due for review today (bookmark or Review later).
  const reviewCount = savedEntries().due.length;
  const s = stats();
  // The goal area: readiness worded for the learner's main goal (onboarding or Settings).
  const goal = goalReadiness(onboarding().goal, currentReadiness());
  const learning = lessonProgress(CLIPS, record, nextLessonId());
  const next = learning.next;
  const nextIndex = CLIPS.indexOf(next);
  const readinessTitle = onboarding().goal === 'driver' ? copy.readiness : goal.title;
  const readinessDetail = onboarding().goal === 'driver' ? goal.value : goal.detail;
  const action = learning.allDone ? 'Try permit practice' : learning.completed ? 'Continue lesson' : 'Start lesson';
  const page = document.createElement('div');
  page.className = 'home-preview home-live';
  page.innerHTML = `<div class="home-phone">
    <main class="home-content" aria-labelledby="home-title">
      <header class="home-toolbar">
        <h1 id="home-title" class="home-wordmark"><span class="home-wordmark-art" role="img" aria-label="Lane"></span></h1>
        ${menuButton()}
      </header>
      <section class="home-sign" aria-labelledby="home-sign-title">
        <a class="home-sign-face" href="${learning.allDone ? '#/practice' : `#/feed/${esc(next.id)}`}" aria-label="${learning.allDone ? action : esc(`${action}: ${next.title}`)}">
          <span class="home-sign-tab">${learning.allDone ? copy.unitTab : `Lesson ${nextIndex + 1}`}</span>
          <span class="home-sign-tags"><span class="home-sign-tag">${learning.allDone ? copy.complete : copy.nextStop}</span>${learning.allDone ? '' : `<span class="home-sign-reward">${icon('star')}+${XP_PER_CLIP} XP</span>`}</span>
          <span class="home-sign-title" id="home-sign-title">${learning.allDone ? esc(copy.completeDetail) : esc(next.title)}</span>
          ${learning.allDone ? '' : `<span class="home-sign-topic">${esc(topic(next.topic))}</span>`}
          <span class="home-sign-go ui-button">${action}</span>
        </a>
        <span class="home-sign-posts" aria-hidden="true"></span>
      </section>
      ${reviewCount ? `<a class="home-review-row" href="#/review"><span><b>${copy.reviewTitle}</b><small>${copy.reviewDetail(reviewCount)}</small></span>${icon('chevron')}</a>` : ''}
      <section class="home-week" aria-labelledby="home-week-title">
        <div class="home-section-heading"><h2 id="home-week-title">${copy.week}</h2></div>
        <div class="home-streak ${s.xpToday ? 'is-lit' : ''}">
          <span class="home-streak-emblem" aria-hidden="true">${icon('flame')}</span>
          <div><p class="home-streak-title" data-streak>${learning.allDone && !s.streak ? copy.streakComplete : copy.streak(s.streak)}</p><p class="home-streak-detail">${learning.allDone ? copy.allLessonsDone : s.xpToday ? copy.streakToday : s.streak ? copy.streakPending : copy.streakStart}</p></div>
        </div>
        <ol class="home-week-bars" aria-label="${copy.weekActivity}">${s.week.map((xp, i) => `<li class="${i === s.todayIndex ? 'is-today' : i > s.todayIndex ? 'is-ahead' : ''}${xp ? ' is-done' : ''}"${i === s.todayIndex ? ' aria-current="date"' : ''}><span class="home-week-bar" aria-hidden="true">${xp ? icon('check') : i === s.todayIndex ? '<span class="home-week-dot"></span>' : ''}</span><span aria-hidden="true">${copy.days[i].slice(0, 2)}</span><span class="home-sr-only">${copy.days[i]}: ${xp} XP</span></li>`).join('')}</ol>
        <a class="home-goal-summary" href="#/review" aria-label="${esc(`${readinessTitle}: ${goal.score} ${copy.outOf100}. ${readinessDetail}. ${copy.lessonCount(learning.completed, learning.total)}. ${copy.viewReadiness}`)}">
          <span class="home-goal-heading"><span>${esc(readinessTitle)}</span><small>${copy.allTime}</small></span>
          <span class="home-goal-result"><span class="home-goal-value"><strong data-goal-detail>${goal.score}</strong><span>/ 100</span></span><span class="home-goal-status">${esc(readinessDetail)}${icon('chevron')}</span></span>
          <span class="home-readiness-track" role="progressbar" aria-label="${esc(readinessTitle)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${goal.score}"><span style="width:${goal.score}%"></span></span>
          <span class="home-goal-completed">${copy.lessonCount(learning.completed, learning.total)}</span>
        </a>
      </section>
      <section class="home-leaderboard" aria-labelledby="home-leaderboard-title"></section>
    </main>
    ${homeNavigation('home')}
    ${menuSheetMarkup()}
  </div>`;
  root.append(page);
  const menu = bindMenu(page);
  const leaderboard = mountLeaderboard(page.querySelector<HTMLElement>('.home-leaderboard')!);
  return { dispose() { leaderboard.dispose(); menu.dispose(); page.remove(); } };
}
