import './home.css';
import { bindMenu, menuButton, menuSheetMarkup } from './menu';
import type { View } from '../navigation';
import { CLIPS } from '../feed/clips';
import { dailyGoal, onboarding, record, stats, XP_PER_CLIP } from '../feed/progress';
import { goalReadiness } from '../learning/scoring';
import { homeContent as copy } from './content';
import { lessonProgress } from './model';
import { currentReadiness, nextLessonId, savedEntries } from '../feed/plan';
import { icon } from './icons';
import { homeNavigation } from './tabs';
import { lessonStrip } from './strip';
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
  // Bars share one scale, the daily XP target (50 by default), so a full day reads as a full bar.
  const peak = Math.max(dailyGoal(), ...s.week);
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
        <div class="home-section-heading"><h2 id="home-week-title">${copy.week}</h2><span class="home-streak ui-chip ${s.xpToday ? 'is-accent is-lit' : 'is-quiet'}">${icon('flame')}<span data-streak>${copy.streak(s.streak)}</span>${s.streak && !s.xpToday ? `<span class="home-sr-only">. ${copy.streakPending}</span>` : ''}</span></div>
        <div class="home-week-row">
          <ol class="home-week-bars" aria-label="XP earned each day this week">${s.week.map((xp, i) => `<li class="${i === s.todayIndex ? 'is-today' : i > s.todayIndex ? 'is-ahead' : ''}"><span class="home-week-bar" style="--fill:${Math.round(xp / peak * 100)}%"></span><span aria-hidden="true">${copy.days[i][0]}</span><span class="home-sr-only">${copy.days[i]}: ${xp} XP</span></li>`).join('')}</ol>
          <a class="home-goal-summary" href="#/review" aria-label="${esc(`${goal.title}: ${goal.value}. ${goal.detail}`)}"><span class="home-goal-ring" aria-hidden="true"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16"/><circle cx="20" cy="20" r="16" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${100 - goal.score}"/></svg></span><span><span class="home-goal-edit">${goal.title}</span><span data-goal-detail>${esc(goal.value)}</span><small class="home-goal-sub">${esc(goal.detail)}</small></span></a>
        </div>
      </section>
      <section class="home-strip" aria-labelledby="home-strip-title">
        <div class="home-section-heading"><h2 id="home-strip-title">${copy.unit}</h2><span data-completed>${learning.completed} of ${learning.total} done</span></div>
        <ol class="home-strip-track" aria-label="${copy.unit} lessons">${CLIPS.map((clip, index) => {
          const done = record(clip.id)?.done, upNext = !learning.allDone && index === nextIndex;
          return `<li class="home-strip-item"><a class="home-strip-card${done ? ' is-done' : ''}${upNext ? ' is-next' : ''}" href="#/feed/${esc(clip.id)}" draggable="false">
            <span class="home-strip-meta"><span>Lesson ${index + 1}</span>${done ? `${icon('check')}<span class="home-sr-only">Completed</span>` : upNext ? `<span class="home-strip-next">${copy.upNext}</span>` : ''}</span>
            <b>${esc(clip.title)}</b><small>${esc(topic(clip.topic))}</small></a></li>`;
        }).join('')}</ol>
      </section>
      <section class="home-leaderboard" aria-labelledby="home-leaderboard-title"></section>
    </main>
    ${homeNavigation('home')}
    ${menuSheetMarkup()}
  </div>`;
  root.append(page);
  const menu = bindMenu(page);
  const leaderboard = mountLeaderboard(page.querySelector<HTMLElement>('.home-leaderboard')!);
  // Start one card before the next lesson, so the last finished lesson and the upcoming one are both in view.
  const strip = lessonStrip(page.querySelector<HTMLElement>('.home-strip-track')!, learning.allDone ? 0 : Math.max(0, nextIndex - 1));
  return { dispose() { leaderboard.dispose(); strip.dispose(); menu.dispose(); page.remove(); } };
}
