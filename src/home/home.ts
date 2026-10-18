import './home.css';
import { bindMenu, menuButton, menuSheetMarkup } from './menu';
import type { View } from '../navigation';
import { CLIPS } from '../feed/clips';
import { onboarding, record, stats, XP_PER_CLIP } from '../feed/progress';
import { DRIVER_CLASS_STEPS, goalReadiness, nextReadinessStep, STATUS_STEPS } from '../learning/scoring';
import { homeContent as copy } from './content';
import { lessonProgress } from './model';
import { currentReadiness, nextLessonId, savedEntries } from '../feed/plan';
import { icon } from './icons';
import { homeNavigation } from './tabs';
import { mountLeaderboard } from './leaderboard';

const esc = (value: string | number) => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
// The streak emblem's own two-part flame: the 24px line icon reads as a scribble at this size.
const STREAK_FLAME = '<svg viewBox="0 0 24 24"><path class="home-flame-outer" d="M12.6 2c.4 3.4 2.6 5.3 4.3 7.5 1.4 1.8 2.3 3.7 2.3 5.9 0 4-3.2 6.6-7.2 6.6s-7.2-2.6-7.2-6.6c0-2.7 1.4-4.8 3.1-6.4.2 1.7.9 2.9 2.1 3.5-.4-4.2 1.1-7.6 2.6-10.5Z"/><path class="home-flame-inner" d="M12.2 12.6c1 1.5 2.7 2.8 2.7 4.8a2.8 2.8 0 0 1-5.6 0c0-1.4.8-2.3 1.5-3 .1.7.4 1.2 1 1.4-.2-1.2-.1-2.2.4-3.2Z"/></svg>';
// Readiness as a speedometer: a 240° dial over 0–100, with a tick where each label starts.
const DIAL = { cx: 120, cy: 118, r: 96 };
const dialPoint = (value: number, r = DIAL.r) => {
  const angle = (150 + 2.4 * value) * Math.PI / 180;
  return [DIAL.cx + r * Math.cos(angle), DIAL.cy + r * Math.sin(angle)].map(n => n.toFixed(1)).join(' ');
};
function readinessDial(score: number, ticks: readonly number[], label: string) {
  const arc = `M${dialPoint(0)}A${DIAL.r} ${DIAL.r} 0 1 1 ${dialPoint(100)}`;
  const [x, y] = dialPoint(score).split(' ');
  return `<svg class="home-dial" viewBox="0 0 240 176" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${score}">
    <defs><linearGradient id="home-dial-fill" x1="0" x2="1" y1="0" y2="0"><stop offset="0"/><stop offset=".5"/><stop offset=".8"/><stop offset="1"/></linearGradient></defs>
    <path class="home-dial-track" d="${arc}"/>
    <path class="home-dial-fill" d="${arc}" pathLength="100" stroke-dasharray="${score} 200"/>
    ${ticks.map(at => `<path class="home-dial-tick${score >= at ? ' is-passed' : ''}" d="M${dialPoint(at, DIAL.r + 14)}L${dialPoint(at, DIAL.r + 22)}"/>`).join('')}
    <circle class="home-dial-knob" cx="${x}" cy="${y}" r="9"/>
  </svg>`;
}
const topic = (value: string) => value[0].toUpperCase() + value.slice(1);

export function mountHome(root: HTMLElement): View {
  // Saved lessons due for review today (bookmark or Review later).
  const reviewCount = savedEntries().due.length;
  const s = stats();
  // The goal area: readiness worded for the learner's main goal (onboarding or Settings).
  const result = currentReadiness();
  const goal = goalReadiness(onboarding().goal, result);
  const isDriver = onboarding().goal === 'driver';
  const steps = isDriver ? DRIVER_CLASS_STEPS : STATUS_STEPS;
  const step = nextReadinessStep(onboarding().goal, result);
  const nextStep = step ? copy.nextStep(step) : copy.topStep;
  // The status pill warms from ochre to green as the learner passes each label's threshold.
  const passed = isDriver ? steps.filter(([at]) => goal.score >= at).length : (['Needs Foundation', 'Developing', 'Permit Test Ready', 'Highway Confident'] as const).indexOf(result.status);
  const tone = ['start', 'build', 'ready', 'top', 'top'][passed];
  const learning = lessonProgress(CLIPS, record, nextLessonId());
  const next = learning.next;
  const nextIndex = CLIPS.indexOf(next);
  const readinessTitle = isDriver ? copy.readiness : goal.title;
  const readinessDetail = isDriver ? goal.value : goal.detail;
  const daysThisWeek = s.week.filter(xp => xp > 0).length;
  // lit: today already counts. risk: a streak that ends at midnight without a lesson. new: nothing to lose yet.
  const streakState = s.xpToday ? 'lit' : s.streak && !learning.allDone ? 'risk' : 'new';
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
        <div class="home-section-heading"><h2 id="home-week-title">${copy.week}</h2><p class="home-week-count"><span aria-hidden="true"><b>${daysThisWeek}</b>/7 days</span><span class="home-sr-only">${copy.weekCountLabel(daysThisWeek)}</span></p></div>
        <div class="home-streak is-${streakState}">
          <span class="home-streak-emblem" aria-hidden="true">${STREAK_FLAME}</span>
          <div><p class="home-streak-title" data-streak>${learning.allDone && !s.streak ? copy.streakComplete : copy.streak(s.streak)}</p><p class="home-streak-detail">${learning.allDone ? copy.allLessonsDone : s.xpToday ? copy.streakToday(s.streak + 1) : s.streak ? copy.streakPending : copy.streakStart}</p></div>
        </div>
        <ol class="home-week-bars" aria-label="${copy.weekActivity}">${s.week.map((xp, i) => `<li class="${i === s.todayIndex ? 'is-today' : i > s.todayIndex ? 'is-ahead' : ''}${xp ? ' is-done' : ''}"${i === s.todayIndex ? ' aria-current="date"' : ''}><span class="home-week-bar" aria-hidden="true">${copy.days[i][0]}</span><span class="home-sr-only">${copy.days[i]}: ${xp} XP</span></li>`).join('')}</ol>
        <a class="home-goal-summary" href="#/review" aria-label="${esc(`${readinessTitle}: ${goal.score} ${copy.outOf100}. ${readinessDetail}. ${nextStep}. ${copy.lessonCount(learning.completed, learning.total)}. ${copy.viewReadiness}`)}">
          <span class="home-goal-heading"><span>${esc(readinessTitle)}</span><small>${copy.allTime}</small></span>
          <span class="home-dial-wrap">
            ${readinessDial(goal.score, steps.map(([at]) => at), readinessTitle)}
            <span class="home-dial-readout"><strong data-goal-detail>${goal.score}</strong><span>/ 100</span></span>
          </span>
          <span class="home-goal-status is-${tone}">${esc(readinessDetail)}</span>
          <span class="home-goal-next">${esc(nextStep)}</span>
          <span class="home-goal-footer"><span class="home-goal-completed">${copy.lessonCount(learning.completed, learning.total)}</span><span class="home-goal-more">${copy.review}${icon('chevron')}</span></span>
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
