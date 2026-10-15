import './home.css';
import type { View } from '../navigation';
import { CLIPS } from '../feed/clips';
import { dailyGoal, DAILY_GOALS, record, setDailyGoal, stats, XP_PER_CLIP } from '../feed/progress';
import { homeContent as copy } from './content';
import { lessonProgress } from './model';
import { icon } from './icons';
import { homeNavigation, HOME_TABS } from './tabs';
import { bottomSheet, sheetMarkup } from './sheet';
import { lessonStrip } from './strip';
import { mountLeaderboard } from './leaderboard';

const esc = (value: string | number) => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const topic = (value: string) => value[0].toUpperCase() + value.slice(1);

export function mountHome(root: HTMLElement): View {
  const s = stats();
  const learning = lessonProgress(CLIPS, record);
  const next = learning.next;
  const nextIndex = CLIPS.indexOf(next);
  // Bars share one scale with the goal, so a goal-sized day always reads as a full bar.
  const peak = Math.max(dailyGoal(), ...s.week);
  const action = learning.allDone ? 'Try permit practice' : learning.completed ? 'Continue lesson' : 'Start lesson';
  const page = document.createElement('div');
  page.className = 'home-preview home-live';
  page.innerHTML = `<div class="home-phone">
    <main class="home-content" aria-labelledby="home-title">
      <header class="home-toolbar">
        <h1 id="home-title" class="home-wordmark"><span class="home-wordmark-art" role="img" aria-label="Lane"></span></h1>
        <button class="home-circle" aria-label="Menu" data-menu>${icon('menu')}</button>
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
      <section class="home-week" aria-labelledby="home-week-title">
        <div class="home-section-heading"><h2 id="home-week-title">${copy.week}</h2><span class="home-streak ui-chip ${s.xpToday ? 'is-accent is-lit' : 'is-quiet'}">${icon('flame')}<span data-streak>${copy.streak(s.streak)}</span>${s.streak && !s.xpToday ? `<span class="home-sr-only">. ${copy.streakPending}</span>` : ''}</span></div>
        <div class="home-week-row">
          <ol class="home-week-bars" aria-label="XP earned each day this week">${s.week.map((xp, i) => `<li class="${i === s.todayIndex ? 'is-today' : i > s.todayIndex ? 'is-ahead' : ''}"><span class="home-week-bar" style="--fill:${Math.round(xp / peak * 100)}%"></span><span aria-hidden="true">${copy.days[i][0]}</span><span class="home-sr-only">${copy.days[i]}: ${xp} XP</span></li>`).join('')}</ol>
          <button class="home-goal-summary" data-goal aria-label="Edit daily goal"><span class="home-goal-ring" aria-hidden="true"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16"/><circle cx="20" cy="20" r="16" pathLength="100" stroke-dasharray="100" data-goal-ring/></svg><i>${icon('tick')}</i></span><span><span class="home-goal-edit">Today’s goal</span><span data-goal-detail></span></span></button>
        </div>
        <span class="home-sr-only" role="status" data-goal-status></span>
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
    ${sheetMarkup('home-menu-sheet', 'home-menu-title', 'Menu', 'Close menu', `<nav class="home-menu-links" aria-label="Menu">${HOME_TABS.map(tab => `<a href="#/${tab.id}">${icon(tab.icon)}<span>${tab.label}</span></a>`).join('')}</nav>`)}
    ${sheetMarkup('home-goal-sheet', 'home-edit-title', 'Your daily goal', 'Close goal editor', `<form data-goal-form><p data-goal-title></p><fieldset><legend class="home-sr-only">Daily XP target</legend>${DAILY_GOALS.map(goal => `<label class="home-goal-option"><input type="radio" name="goal" value="${goal}"><span><b>${goal} XP</b><small>${goal / 10} new lesson${goal === 10 ? '' : 's'}</small></span></label>`).join('')}</fieldset><p class="home-goal-note">${esc(copy.goalNote)}</p><button class="home-dialog-done ui-button" type="submit">Save goal</button><button class="home-sheet-cancel" type="button" data-sheet-close>Cancel</button></form>`)}
  </div>`;
  root.append(page);
  const sheets = {
    menu: bottomSheet(page.querySelector<HTMLDialogElement>('.home-menu-sheet')!),
    goal: bottomSheet(page.querySelector<HTMLDialogElement>('.home-goal-sheet')!),
  };
  const leaderboard = mountLeaderboard(page.querySelector<HTMLElement>('.home-leaderboard')!);
  // Start one card before the next lesson, so the last finished lesson and the upcoming one are both in view.
  const strip = lessonStrip(page.querySelector<HTMLElement>('.home-strip-track')!, learning.allDone ? 0 : Math.max(0, nextIndex - 1));

  function renderGoal() {
    const target = dailyGoal();
    page.querySelector('[data-goal-title]')!.textContent = s.xpToday >= target ? 'Goal reached. Nice work!' : learning.allDone ? 'You’re caught up' : `Earn ${target} XP`;
    page.querySelector('[data-goal-detail]')!.textContent = `${s.xpToday} / ${target} XP today`;
    page.querySelector('[data-goal-ring]')!.setAttribute('stroke-dashoffset', String(100 - Math.min(100, s.xpToday / target * 100)));
    page.querySelector('.home-goal-summary')!.classList.toggle('is-met', s.xpToday >= target);
  }
  const onClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const target = event.target;
    if (target.closest('[data-menu]')) sheets.menu.open();
    if (target.closest('.home-menu-links a')) sheets.menu.close();
    if (target.closest('[data-goal]')) {
      page.querySelector<HTMLInputElement>(`input[name="goal"][value="${dailyGoal()}"]`)!.checked = true;
      sheets.goal.open();
    }
  };
  const onSubmit = (event: SubmitEvent) => {
    if (!(event.target instanceof HTMLFormElement) || !event.target.matches('[data-goal-form]')) return;
    event.preventDefault();
    const goal = Number(new FormData(event.target).get('goal'));
    if (setDailyGoal(goal)) {
      renderGoal();
      sheets.goal.close();
      page.querySelector('[data-goal-status]')!.textContent = `Daily goal saved: ${goal} XP.`;
    }
  };
  renderGoal();
  page.addEventListener('click', onClick);
  page.addEventListener('submit', onSubmit);
  return { dispose() { leaderboard.dispose(); strip.dispose(); Object.values(sheets).forEach(sheet => sheet.dispose()); page.removeEventListener('click', onClick); page.removeEventListener('submit', onSubmit); page.remove(); } };
}
