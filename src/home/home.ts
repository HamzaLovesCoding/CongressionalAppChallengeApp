import './home.css';
import type { View } from '../navigation';
import { CLIPS } from '../feed/clips';
import { dailyGoal, DAILY_GOALS, marked, record, setDailyGoal, stats, toggleMark } from '../feed/progress';
import { homeContent as copy } from './content';
import { lessonProgress } from './model';
import { icon } from './icons';
import { homeNavigation, HOME_TABS } from './tabs';

const esc = (value: string | number) => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const roadArt = `<svg viewBox="0 0 104 100" aria-hidden="true"><path d="M28 96 48 6h15l26 90" fill="#ffffff12"/><path d="M32 96 51 6m32 90L60 6" fill="none" stroke="#bce798" stroke-width="2"/><path d="m57 14 1 11m1 9 2 15m2 12 3 24" stroke="#f0f8dc" stroke-width="3" stroke-linecap="round"/><rect x="35" y="54" width="24" height="35" rx="9" transform="rotate(12 47 72)" fill="#c7ed87"/><path d="m41 63 12 3-2 9-12-3Z" fill="#244f17"/></svg>`;

export function mountHome(root: HTMLElement): View {
  const s = stats();
  const learning = lessonProgress(CLIPS, record);
  const next = learning.next;
  const page = document.createElement('div');
  page.className = 'home-preview home-live';
  page.innerHTML = `<div class="home-phone">
    <main class="home-content" aria-labelledby="home-title">
      <header class="home-toolbar">
        <button class="home-circle" aria-label="Menu" data-menu>${icon('menu')}</button>
        <span class="home-wordmark">lane<span>${esc(copy.intro)}</span></span>
        <button class="home-circle" aria-label="Saved lessons" data-saved>${icon('bookmark')}</button>
      </header>
      <section class="home-greeting"><div><h1 id="home-title">${esc(copy.title)}</h1><p>${esc(copy.greeting)}</p></div><img class="home-mascot" src="/images/home/mascot.png" alt="" /></section>
      <section class="home-stats" aria-label="Learning stats">
        <div class="home-stat"><span class="home-stat-art home-streak-art">${icon('flame')}</span><span>Streak</span><strong data-streak>${s.streak}</strong><small>${s.streak === 1 ? 'day' : 'days'}</small></div>
        <div class="home-stat"><span class="home-stat-art home-xp-art">${icon('progress')}</span><span>Total XP</span><strong data-xp>${s.xpTotal}</strong><small>earned</small></div>
        <div class="home-stat"><span class="home-stat-art home-done-art">${icon('check')}</span><span>Lessons</span><strong data-completed>${learning.completed} / ${learning.total}</strong><small>completed</small></div>
      </section>
      <section class="home-lesson" aria-labelledby="home-lesson-title">
        <p class="home-eyebrow">${learning.allDone ? 'Keep it fresh' : learning.completed ? esc(copy.continue) : esc(copy.start)}</p>
        <h2 id="home-lesson-title">${learning.allDone ? esc(copy.complete) : esc(next.title)}</h2>
        <p class="home-lesson-detail">${learning.allDone ? esc(copy.completeDetail) : `Lesson ${CLIPS.indexOf(next) + 1} · ${esc(next.topic)}`}</p>
        <div class="home-course-progress"><div class="home-progress-label"><span>Lessons completed</span><span>${learning.completed} / ${learning.total}</span></div><progress class="home-progress" aria-label="Lessons completed" value="${learning.completed}" max="${learning.total}">${learning.percentage}%</progress></div>
        <a class="home-continue" href="${learning.allDone ? '#/practice' : `#/feed/${esc(next.id)}`}">${learning.allDone ? 'Try permit practice' : learning.completed ? 'Continue lesson' : 'Start lesson'}<span aria-hidden="true">→</span></a>
        <div class="home-road-art">${roadArt}</div>
      </section>
      <section class="home-goal" aria-labelledby="home-goal-title">
        <div class="home-section-heading"><h2 id="home-goal-title">Today’s goal</h2><button class="home-text-button home-edit" data-goal aria-label="Edit daily goal">Edit goal</button></div>
        <div class="home-goal-card"><span class="home-clock">${icon('clock')}</span><div class="home-goal-copy"><h3 data-goal-title></h3><p data-goal-detail></p><progress class="home-progress" aria-label="Daily XP goal" value="0" max="50"></progress></div></div>
        <p class="home-goal-note">${esc(learning.allDone ? copy.caughtUpNote : copy.goalNote)}</p><span class="home-sr-only" role="status" data-goal-status></span>
      </section>
      <section class="home-practice" aria-labelledby="home-practice-title">
        <div class="home-section-heading"><h2 id="home-practice-title">Make your next move</h2></div>
        <div class="home-shortcuts">${copy.shortcuts.map(item => {
          const inside = `<span class="home-shortcut-icon">${icon(item.icon)}</span><span><b>${esc(item.title)}</b><small>${esc(item.detail)}</small></span><span class="home-shortcut-arrow" aria-hidden="true">→</span>`;
          return 'href' in item ? `<a class="home-shortcut" href="${item.href}">${inside}</a>` : `<button class="home-shortcut" data-${item.action}>${inside}</button>`;
        }).join('')}</div>
      </section>
    </main>
    ${homeNavigation('home')}
    <dialog class="home-dialog home-menu-dialog" aria-labelledby="home-menu-title"><form method="dialog"><button class="home-dialog-close" aria-label="Close menu">×</button><h2 id="home-menu-title">Menu</h2><nav class="home-menu-links" aria-label="Menu">${HOME_TABS.map(tab => `<a href="#/${tab.id}">${icon(tab.icon)}<span>${tab.label}</span></a>`).join('')}</nav></form></dialog>
    <dialog class="home-dialog home-goal-dialog" aria-labelledby="home-edit-title"><form data-goal-form><button class="home-dialog-close" type="button" data-close aria-label="Close goal editor">×</button><h2 id="home-edit-title">Your daily goal</h2><p>Choose a small step for today. You can change it anytime.</p><fieldset><legend class="home-sr-only">Daily XP target</legend>${DAILY_GOALS.map(goal => `<label class="home-goal-option"><input type="radio" name="goal" value="${goal}"><span><b>${goal} XP</b><small>${goal / 10} new lesson${goal === 10 ? '' : 's'}</small></span></label>`).join('')}</fieldset><p>${esc(copy.goalNote)}</p><button class="home-dialog-done" type="submit">Save goal</button><button class="home-text-button home-dialog-cancel" type="button" data-close>Cancel</button></form></dialog>
    <dialog class="home-dialog home-library-dialog" aria-labelledby="home-library-title"><button class="home-dialog-close" data-close aria-label="Close lessons">×</button><h2 id="home-library-title"></h2><div data-library></div></dialog>
  </div>`;
  root.append(page);
  const menu = page.querySelector<HTMLDialogElement>('.home-menu-dialog')!;
  const goalDialog = page.querySelector<HTMLDialogElement>('.home-goal-dialog')!;
  const library = page.querySelector<HTMLDialogElement>('.home-library-dialog')!;

  function renderGoal() {
    const target = dailyGoal();
    page.querySelector('[data-goal-title]')!.textContent = s.xpToday >= target ? 'Goal reached. Nice work!' : learning.allDone ? 'You’re caught up' : `Earn ${target} XP`;
    page.querySelector('[data-goal-detail]')!.textContent = `${s.xpToday} / ${target} XP today`;
    const progress = page.querySelector<HTMLProgressElement>('[aria-label="Daily XP goal"]')!;
    progress.max = target;
    progress.value = Math.min(s.xpToday, target);
    progress.setAttribute('aria-valuetext', `${s.xpToday} of ${target} XP today`);
  }
  let savedOnly = false;
  function renderLibrary() {
    const lessons = CLIPS.filter(clip => !savedOnly || marked('saved', clip.id));
    library.querySelector('h2')!.textContent = savedOnly ? 'Saved lessons' : 'Road lessons';
    library.querySelector('[data-library]')!.innerHTML = lessons.length ? `<ul class="home-lesson-list">${lessons.map(clip => `<li><a href="#/feed/${esc(clip.id)}"><small>${record(clip.id)?.done ? 'Completed · Review' : esc(clip.topic)}</small><b>${esc(clip.title)}</b></a>${savedOnly ? `<button data-unsave="${esc(clip.id)}" aria-label="Remove ${esc(clip.title)} from saved lessons">${icon('bookmark')}</button>` : ''}</li>`).join('')}</ul>` : `<p>${esc(copy.savedEmpty)}</p><a class="home-dialog-done" href="#/feed">Explore lessons</a>`;
  }
  const onClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const target = event.target;
    if (target.closest('[data-menu]')) menu.showModal();
    if (target.closest('.home-menu-links a')) menu.close();
    if (target.closest('[data-close]')) target.closest('dialog')?.close();
    if (target.closest('[data-goal]')) {
      page.querySelector<HTMLInputElement>(`input[name="goal"][value="${dailyGoal()}"]`)!.checked = true;
      goalDialog.showModal();
    }
    if (target.closest('[data-saved], [data-lessons]')) {
      savedOnly = !!target.closest('[data-saved]');
      renderLibrary();
      library.showModal();
    }
    const remove = target.closest<HTMLElement>('[data-unsave]');
    if (remove?.dataset.unsave) {
      toggleMark('saved', remove.dataset.unsave);
      renderLibrary();
      (library.querySelector<HTMLElement>('[data-unsave]') ?? library.querySelector<HTMLElement>('[data-close]'))!.focus();
    }
  };
  const onSubmit = (event: SubmitEvent) => {
    if (!(event.target instanceof HTMLFormElement) || !event.target.matches('[data-goal-form]')) return;
    event.preventDefault();
    const goal = Number(new FormData(event.target).get('goal'));
    if (setDailyGoal(goal)) {
      renderGoal();
      goalDialog.close();
      page.querySelector('[data-goal-status]')!.textContent = `Daily goal saved: ${goal} XP.`;
    }
  };
  renderGoal();
  page.addEventListener('click', onClick);
  page.addEventListener('submit', onSubmit);
  return { dispose() { page.removeEventListener('click', onClick); page.removeEventListener('submit', onSubmit); page.remove(); } };
}
