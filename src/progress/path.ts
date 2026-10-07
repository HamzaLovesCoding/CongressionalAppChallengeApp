import './path.css';
import type { View } from '../navigation';
import { CLIPS } from '../feed/clips';
import { record, stats } from '../feed/progress';
import { homeNavigation } from '../home/tabs';
import { lessonProgress } from '../home/model';
import { PATH_COPY as copy } from './content';
import { landscape, pathIcon } from './artwork';

const esc = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const lessonIcons = ['star', 'book', 'wheel', 'road', 'car'] as const;

export function mountLearningPath(root: HTMLElement): View {
  const progress = lessonProgress(CLIPS, record);
  const page = document.createElement('div');
  page.className = 'home-preview learning-path';
  page.innerHTML = `<div class="home-phone path-phone">
    <main class="path-content" aria-label="Progress" tabindex="-1">
      <header class="path-toolbar">
        <a class="path-back" href="#/home" aria-label="Back to home">${pathIcon('back')}</a>
        <h1>${copy.title}</h1>
        <span class="path-xp" aria-label="${stats().xpTotal} total XP">${pathIcon('star')}<span>${stats().xpTotal}<small>XP</small></span></span>
      </header>
      <section class="path-unit" aria-label="${copy.unit}">
        <button class="path-unit-select" data-path-details aria-label="Choose a road lesson"><span>${copy.course} ${pathIcon('chevron')}</span><small>${copy.unit}</small></button>
        <button class="path-unit-summary" data-path-details aria-label="View unit progress">${pathIcon('clipboard')}</button>
      </section>
      <div class="path-map">
        <div class="path-cloud path-cloud-one" aria-hidden="true"></div>
        <div class="path-cloud path-cloud-two" aria-hidden="true"></div>
        <div class="path-cloud path-cloud-three" aria-hidden="true"></div>
        <ol class="path-lessons" aria-label="Road basics lessons">${CLIPS.map((clip, index) => {
          const done = record(clip.id)?.done;
          const current = !progress.allDone && clip.id === progress.next?.id;
          const label = done ? copy.completed : current ? copy.continue : copy.available;
          return `<li class="path-step${current ? ' is-next' : ''}${done ? ' is-complete' : ''}">
            <a class="path-node" href="#/feed/${esc(clip.id)}" aria-label="${esc(`${clip.title} — ${label}`)}"${current ? ' aria-current="step"' : ''}>
              ${current ? `<span class="path-start">${progress.completed ? copy.continue : copy.start}</span>` : ''}
              ${done ? pathIcon('check') : index === 0 ? '<img src="/images/home/reward.png" alt="" width="64" height="64">' : pathIcon(lessonIcons[index % lessonIcons.length])}
            </a>
            <span class="path-node-label" aria-hidden="true">${esc(clip.title)}</span>
          </li>`;
        }).join('')}</ol>
        <section class="path-upcoming" aria-label="${copy.nextUnit}: ${copy.comingSoon}">
          <div class="path-divider"><span>${copy.nextUnit}</span></div>
          <div class="path-locked" aria-hidden="true">${pathIcon('lock')}</div>
          <p>${copy.comingSoon}</p><small>${copy.upcoming}</small>
        </section>
      </div>
      ${landscape}
    </main>
    ${homeNavigation('progress')}
    <dialog class="path-dialog" aria-labelledby="path-dialog-title">
      <form method="dialog"><button class="path-dialog-close" aria-label="Close unit progress">×</button></form>
      <p class="path-dialog-eyebrow">${copy.unit}</p><h2 id="path-dialog-title">${copy.summary}</h2>
      <p>${progress.allDone ? copy.allDone : copy.summaryDetail}</p>
      <div class="path-completion"><span>${progress.completed} of ${progress.total} lessons complete</span><progress value="${progress.completed}" max="${progress.total}" aria-label="Lessons complete"></progress></div>
      <ol>${CLIPS.map((clip, index) => `<li><a href="#/feed/${esc(clip.id)}"><span class="path-list-number">${record(clip.id)?.done ? pathIcon('check') : index + 1}</span><span>${esc(clip.title)}<small>${record(clip.id)?.done ? copy.review : copy.available}</small></span>${pathIcon('chevron')}</a></li>`).join('')}</ol>
    </dialog>
  </div>`;
  root.append(page);
  const dialog = page.querySelector<HTMLDialogElement>('dialog')!;
  page.querySelectorAll<HTMLButtonElement>('[data-path-details]').forEach(button => button.addEventListener('click', () => dialog.showModal()));
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  page.querySelector<HTMLElement>('main')!.focus({ preventScroll: true });
  return { dispose() { dialog.close(); page.remove(); } };
}
