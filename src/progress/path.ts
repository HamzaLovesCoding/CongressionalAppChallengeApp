import './path.css';
import type { View } from '../navigation';
import { CLIPS, type Clip } from '../feed/clips';
import { carState, record, stats, XP_PER_CLIP } from '../feed/progress';
import { homeNavigation } from '../home/tabs';
import { lessonProgress } from '../home/model';
import { PATH_COPY as copy } from './content';
import { carArt } from '../profile/cars';
import { pathIcon } from './artwork';
import { CAR_SCALE, LANE, carY, roadAt, roadKnots, type Knot } from './road';
import { roadScene, trailPath } from './scenery';
import { bottomSheet, sheetMarkup } from '../home/sheet';
import { milestones, completionChange } from './milestones';
import { SCENARIOS } from '../simulation/registry';
import { nextLessonId, PLAN_LESSONS } from '../feed/plan';
import { readiness } from '../learning/scoring';
import { topicRecord } from '../feed/progress';

const esc = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const ease = (t: number) => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
const topicLabel = (topic: string) => topic[0].toUpperCase() + topic.slice(1);
type Stop = 'done' | 'next' | 'ahead';
type Badge = ReturnType<typeof milestones>[number];
// These view-only values animate a return from a completed lesson without storing extra progress.
// They are only committed once the drive and celebration have played, so leaving mid-drive replays them.
let previousPosition: number | undefined;
let previousCompleted: string[] | undefined;

function lessonSign(clip: Clip, index: number, state: Stop) {
  const number = copy.lesson(index + 1);
  const started = Boolean(record(clip.id)?.tries);
  if (state === 'next') {
    const action = started ? copy.continueLesson : copy.startLesson;
    // The next stop is the same sign as Home's: the whole sign starts the lesson.
    return `<a class="path-sign" href="#/feed/${esc(clip.id)}" data-lesson="${index}" aria-current="step" aria-label="${esc(`${action}: ${number}, ${clip.title}`)}">
      <span class="path-sign-tab">${number}</span>
      <span class="path-sign-tags"><span class="path-sign-next">${copy.nextStop}</span><span class="path-sign-reward">${pathIcon('star')}${copy.availableXP(XP_PER_CLIP)}</span></span>
      <span class="path-sign-title">${esc(clip.title)}</span>
      <span class="path-sign-topic">${esc(topicLabel(clip.topic))}</span>
      <span class="path-sign-go ui-button is-split">${action}${pathIcon('arrow')}</span>
    </a>`;
  }
  const done = state === 'done';
  return `<button class="path-sign" type="button" data-lesson="${index}" aria-haspopup="dialog" aria-label="${esc(`${number}: ${clip.title} — ${done ? copy.completed : started ? copy.inProgress : copy.notStarted}`)}">
    <span class="path-sign-meta"><span>${number}</span><span class="path-sign-status">${done ? `<i class="path-sign-check">${pathIcon('check')}</i>${copy.earnedXP(XP_PER_CLIP)}` : `${pathIcon('star')}${copy.availableXP(XP_PER_CLIP)}`}</span></span>
    <span class="path-sign-title">${esc(clip.title)}</span>
  </button>`;
}

// A milestone stands on the road at the lesson that earns it, so the next reward is visible ahead.
const milestoneRow = (badge: Badge) => `<button class="path-mile${badge.earned ? ' is-earned' : ''}" type="button" data-badges data-count="${badge.count}" aria-haspopup="dialog" aria-label="${esc(`${copy.milestone}, ${badge.title}: ${badge.earned ? copy.earned : copy.remaining(badge.remaining)}`)}">
    <span class="path-mile-medal">${pathIcon(badge.icon)}</span>
    <span class="path-mile-text"><small>${copy.milestone} · ${copy.milestoneAt(badge.count)}</small><strong>${esc(badge.title)}</strong>
      <span class="path-mile-status">${badge.earned ? `${pathIcon('check')}${copy.earned}` : copy.remaining(badge.remaining)}</span></span>
  </button>`;

// Once every lesson is done the road ends at this sign, where the car parks.
const finishSign = () => `<div class="path-board path-finish"><a class="path-sign" href="#/practice" aria-label="${copy.allDone}: ${copy.practiceShort}">
    <span class="path-sign-tab">${copy.unitSign}</span>
    <span class="path-sign-tags"><span class="path-sign-next">${pathIcon('trophy')}${copy.completed}</span></span>
    <span class="path-sign-title">${copy.allDone}</span>
    <span class="path-sign-go ui-button is-split">${copy.practiceShort}${pathIcon('arrow')}</span>
  </a><i class="path-posts" aria-hidden="true"></i></div>`;

function sheetBody(clip: Clip, index: number, state: Stop) {
  const result = record(clip.id);
  const status = state === 'done' ? `<span class="ui-chip is-success">${pathIcon('check')}${copy.completed}</span>`
    : state === 'next' ? `<span class="ui-chip is-accent">${copy.nextStop}</span>`
      : `<span class="ui-chip is-quiet">${result?.tries ? copy.inProgress : copy.notStarted}</span>`;
  const reward = `<span class="ui-chip${state === 'done' ? ' is-success' : ''}">${pathIcon('star')}${state === 'done' ? copy.earnedXP(XP_PER_CLIP) : copy.availableXP(XP_PER_CLIP)}</span>`;
  // Only the positive record is shown: tries count every submission (two per check on two-check
  // lessons), so a retry count would overstate misses and read as a mark against the learner.
  const firstTry = result?.done && result.firstTry ? `<span class="ui-chip is-accent">${pathIcon('star')}${copy.firstTry}</span>` : '';
  const detail = result?.done ? '' : result?.tries ? copy.started : clip.lesson ? '' : copy.fresh(clip.followUp ? 2 : 1);
  const action = result?.done ? copy.reviewLesson : result?.tries ? copy.continueLesson : copy.startLesson;
  // Optional practice appears only after the lesson's check is done (CLAUDE.md).
  const scenario = result?.done ? SCENARIOS.find(entry => entry.lessonId === clip.id) : undefined;
  return `<p class="path-sheet-meta">${copy.lesson(index + 1)} · ${esc(topicLabel(clip.topic))}</p>
    <p class="path-sheet-chips">${status}${reward}${firstTry}</p>
    ${clip.lesson ? `<p class="path-sheet-summary">${esc(clip.lesson.summary)}</p>` : ''}
    ${detail ? `<p class="path-sheet-result">${detail}</p>` : ''}
    <a class="path-sheet-action ui-button is-split" href="#/feed/${esc(clip.id)}">${action}${pathIcon('arrow')}</a>
    ${scenario ? `<a class="path-sheet-action ui-button is-split is-secondary" href="#/feed/sim/${scenario.id}">${copy.simulator}<small>${copy.optional}</small></a>` : ''}`;
}

export function mountLearningPath(root: HTMLElement): View {
  const progress = lessonProgress(CLIPS, record, nextLessonId());
  // Driver readiness (owner formula) over every lesson topic; a topic not practiced yet counts as 0,
  // so two good lessons can't read as ready for the whole test.
  const masteries = [...new Set(PLAN_LESSONS.map(lesson => lesson.topicId))].map(id => topicRecord(id).mastery);
  const scored = masteries.filter(value => value !== null);
  const ready = readiness(masteries.map(value => value ?? 0));
  // Road position: the index of the lesson the car waits at, or CLIPS.length once it has parked past the last one.
  const position = progress.allDone ? CLIPS.length : CLIPS.indexOf(progress.next);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const from = !reduced && previousPosition !== undefined && previousPosition < position ? previousPosition : position;
  const states = CLIPS.map((clip, index): Stop => record(clip.id)?.done ? 'done' : !progress.allDone && index === position ? 'next' : 'ahead');
  const completedIds = CLIPS.filter(clip => record(clip.id)?.done).map(clip => clip.id);
  const change = completionChange(previousCompleted, completedIds);
  const newlyDone = previousCompleted ? completedIds.filter(id => !previousCompleted!.includes(id)) : [];
  const doneFrom = from === position ? progress.completed : progress.completed - newlyDone.length;
  const commit = () => { previousPosition = position; previousCompleted = completedIds; };
  const badges = milestones(progress.completed);
  const earnedBadges = badges.filter(badge => badge.earned).length;
  const totalXP = stats().xpTotal;
  const car = carState().selected;
  const total = CLIPS.length;
  const page = document.createElement('div');
  page.className = 'home-preview learning-path';
  page.innerHTML = `<div class="home-phone path-phone">
    <main class="path-content" aria-label="${copy.title}" tabindex="-1">
      <header class="path-dashboard">
        <h1>${copy.title}</h1>
        <div class="path-chips">
          <button class="path-chip-button path-trophies" type="button" data-badges aria-haspopup="dialog" aria-label="${copy.milestonesEarned(earnedBadges, badges.length)}"><span class="ui-chip">${pathIcon('trophy')}${earnedBadges}/${badges.length}<small>${copy.milestonesShort}</small></span></button>
          <span class="path-xp ui-chip is-accent">${pathIcon('star')}<span aria-hidden="true">${totalXP}<small>XP</small></span><span class="home-sr-only">${copy.totalXP(totalXP)}</span></span>
        </div>
        <div class="path-trip">
          <p class="path-trip-label"><strong>${copy.course}</strong><span>${copy.completeOf(progress.completed, total)}</span></p>
          <div class="path-meter" role="progressbar" aria-label="${copy.lessonsComplete}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${progress.completed}" aria-valuetext="${copy.completeOf(progress.completed, total)}" style="--at:${doneFrom / total}">
            <i class="path-meter-fill"></i>
            ${badges.map(badge => `<i class="path-meter-pin${badge.earned ? ' is-earned' : ''}" data-count="${badge.count}" style="--pin:${badge.count / total}"></i>`).join('')}
            <svg class="path-meter-car" viewBox="-16 -9 32 18" aria-hidden="true" focusable="false"><g transform="rotate(90) scale(.68)">${carArt(car)}</g></svg>
          </div>
          <a class="path-readiness" href="#/review">${scored.length ? copy.readiness(ready.score, ready.status) : copy.readinessEmpty}</a>
        </div>
      </header>
      <div class="path-atlas">
        <div class="path-scene"></div>
        <svg class="path-car-layer" aria-hidden="true" focusable="false"><defs><clipPath id="path-trail-clip"><rect class="path-trail-clip" x="-40" y="-40" width="0" height="0"/></clipPath></defs><path class="path-trail" clip-path="url(#path-trail-clip)"/><g class="path-car">${carArt(car)}</g></svg>
        <div class="path-start"><p class="path-unit-sign"><span>${copy.unitSign}</span><strong>${copy.course}</strong><small>${copy.lessonCount(total)}</small></p><i class="path-start-line" data-start-line aria-hidden="true"></i></div>
        <ol class="path-lessons" aria-label="${copy.course} lessons">${CLIPS.map((clip, index) => {
          const badge = badges.find(item => item.count === index + 1);
          const last = index === total - 1;
          return `<li class="path-stop is-${states[index]}" data-stop>
            <div class="path-board">${lessonSign(clip, index, states[index])}<i class="path-posts" data-checkpoint aria-hidden="true"></i></div>
            ${badge ? milestoneRow(badge) : ''}
            ${last && progress.allDone ? finishSign() : ''}
          </li>`;
        }).join('')}</ol>
        <section class="path-roadwork" aria-label="${copy.roadAhead}: ${copy.comingSoon}"><p class="path-roadwork-sign"><span>${copy.comingSoon}</span><strong>${copy.roadAhead}</strong><small>${copy.roadAheadDetail}</small></p><i class="path-posts" data-barricade aria-hidden="true"></i></section>
      </div>
    </main>
    <button class="path-locate" type="button" data-locate aria-label="${copy.findCar}" hidden><svg class="path-locate-car" viewBox="-12 -21 24 42" aria-hidden="true" focusable="false"><g transform="scale(.9)">${carArt(car)}</g></svg><span class="path-locate-arrow"></span></button>
    <p class="path-arrival" role="status" aria-live="polite"></p>
    ${homeNavigation('progress')}
    ${sheetMarkup('path-milestones', 'path-milestones-title', copy.milestones, copy.closeMilestones, `<p>${copy.badgeDetail}</p><ol class="path-medals">${badges.map(badge => `<li class="${badge.earned ? 'is-earned' : ''}" data-count="${badge.count}"><span class="path-medal">${pathIcon(badge.icon)}</span><div><h3>${badge.title}</h3><p>${badge.detail}</p><strong>${badge.earned ? `${pathIcon('check')}${copy.earned}` : copy.remaining(badge.remaining)}</strong></div></li>`).join('')}</ol>${progress.allDone ? `<a class="path-sheet-action ui-button is-split" href="#/practice">${copy.practice}${pathIcon('arrow')}</a>` : ''}`)}
    ${sheetMarkup('path-sheet', 'path-sheet-title', '', copy.closeDetails, '<div class="path-sheet-content"></div>')}
  </div>`;
  root.append(page);

  const atlas = page.querySelector<HTMLElement>('.path-atlas')!;
  const scene = page.querySelector<HTMLElement>('.path-scene')!;
  const carLayer = page.querySelector<SVGSVGElement>('.path-car-layer')!;
  const carMark = carLayer.querySelector<SVGGElement>('.path-car')!;
  const trail = carLayer.querySelector<SVGPathElement>('.path-trail')!;
  const trailClip = carLayer.querySelector<SVGRectElement>('.path-trail-clip')!;
  const meter = page.querySelector<HTMLElement>('.path-meter')!;
  const dashboard = page.querySelector<HTMLElement>('.path-dashboard')!;
  const nav = page.querySelector<HTMLElement>('.home-nav')!;
  const locate = page.querySelector<HTMLButtonElement>('[data-locate]')!;
  const main = page.querySelector<HTMLElement>('main')!;
  // The view keeps the sign the car is heading for in sight: the next lesson, or the finish once all are done.
  const destination = page.querySelector<HTMLElement>('.path-sign[aria-current], .path-finish .path-sign');
  const finish = page.querySelector<HTMLElement>('.path-finish .path-sign');
  let knots: Knot[] = [], stops: number[] = [], park: number | undefined, current = from;
  // The fixed panel's height changes with the notch inset, text size and wrapping, so the road starts
  // below its measured height rather than a guess.
  const fitPanel = () => page.style.setProperty('--path-panel', `${Math.ceil(dashboard.getBoundingClientRect().height)}px`);

  // The signs are ordinary flow content, so text size and wrapping decide where each checkpoint
  // sits; the road is then drawn to pass those exact heights.
  const draw = () => {
    const box = atlas.getBoundingClientRect();
    const at = (selector: string) => [...atlas.querySelectorAll<HTMLElement>(selector)].map(element => element.getBoundingClientRect().bottom - box.top);
    const width = Math.round(box.width), height = Math.round(box.height);
    const start = atlas.querySelector('[data-start-line]')!.getBoundingClientRect().top - box.top;
    stops = at('[data-checkpoint]');
    // All complete, the car parks level with the middle of the finish sign.
    const finishBox = finish?.getBoundingClientRect();
    park = finishBox && (finishBox.top + finishBox.bottom) / 2 - box.top;
    knots = roadKnots(stops, parseFloat(getComputedStyle(atlas).getPropertyValue('--road-x')), height);
    scene.innerHTML = roadScene({ width, height, knots, stops, next: progress.allDone ? -1 : position, start, barricade: at('[data-barricade]')[0] });
    carLayer.setAttribute('width', String(width));
    carLayer.setAttribute('height', String(height));
    // Distance driven is counted from the start line, not from the bottom of the map.
    trailClip.setAttribute('width', String(width + 80));
    trailClip.setAttribute('height', String(Math.max(0, start + 40)));
    placeCar();
  };
  const placeCar = () => {
    const y = carY(stops, current, park), at = roadAt(knots, y, LANE);
    carMark.setAttribute('transform', `translate(${at.x.toFixed(1)} ${y.toFixed(1)}) rotate(${at.angle.toFixed(1)}) scale(${CAR_SCALE})`);
    trail.setAttribute('d', trailPath(knots, y));
  };
  // The road visible between the fixed panel and the tab bar, in page coordinates.
  const band = () => {
    const view = page.getBoundingClientRect();
    return { top: dashboard.getBoundingClientRect().bottom - view.top, bottom: nav.getBoundingClientRect().top - view.top };
  };
  // Keep the car a little below the middle of the visible road, so more road ahead shows than behind.
  // The sign the car is heading for comes first: its top (and lesson tab) never hides under the panel.
  const showCar = () => {
    const view = page.getBoundingClientRect(), box = atlas.getBoundingClientRect(), { top, bottom } = band();
    const y = carY(stops, current, park);
    let at = Math.min(top + (bottom - top) * (page.clientHeight <= 500 ? .7 : .62), bottom - 36);
    if (destination) {
      const signTop = destination.getBoundingClientRect().top - box.top - (destination.querySelector('.path-sign-tab')?.getBoundingClientRect().height ?? 0);
      at = Math.max(at, top + 12 + y - signTop);
    }
    page.scrollTop = box.top - view.top + page.scrollTop + y - at;
  };
  // Find my car appears only once the car has left the visible road, pointing the way back to it.
  const updateLocate = () => {
    const car = carMark.getBoundingClientRect(), view = page.getBoundingClientRect(), { top, bottom } = band();
    const above = car.bottom - view.top < top, below = car.top - view.top > bottom;
    locate.hidden = !(above || below);
    locate.dataset.direction = above ? 'up' : 'down';
    locate.querySelector('.path-locate-arrow')!.innerHTML = pathIcon(above ? 'up' : 'down');
  };
  const setMeter = (done: number) => meter.style.setProperty('--at', String(done / total));

  fitPanel();
  draw();
  showCar();
  updateLocate();
  const resize = new ResizeObserver(entries => { if (entries.some(entry => entry.target === dashboard)) fitPanel(); draw(); updateLocate(); });
  resize.observe(atlas);
  resize.observe(dashboard);
  let live = true, explored = false, scrollFrame = 0;
  for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) page.addEventListener(type, () => { explored = true; }, { passive: true, once: true });
  page.addEventListener('scroll', () => { cancelAnimationFrame(scrollFrame); scrollFrame = requestAnimationFrame(updateLocate); }, { passive: true });
  // Text that re-wraps once the web font arrives moves the signs; re-center unless the learner already
  // started exploring (a drive animation keeps following the car on its own).
  void document.fonts.ready.then(() => { if (!live) return; draw(); if (!explored && from === position) showCar(); updateLocate(); });

  const arrival = page.querySelector<HTMLElement>('.path-arrival')!;
  let arrivalTimer = 0;
  const celebrate = () => {
    commit();
    if (!change.added) return;
    const unlocked = change.unlocked.at(-1);
    arrival.innerHTML = `<span class="path-arrival-icon">${pathIcon(unlocked ? unlocked.icon : 'check')}</span><span><strong>${unlocked ? esc(unlocked.title) : copy.celebration(change.added)}</strong><small>${unlocked ? `${copy.milestoneEarned} · ` : ''}${copy.earnedXP(change.added * XP_PER_CLIP)}</small></span>`;
    arrival.classList.add('is-visible');
    newlyDone.forEach(id => page.querySelector(`.path-sign[data-lesson="${CLIPS.findIndex(clip => clip.id === id)}"]`)?.classList.add('is-new'));
    change.unlocked.forEach(badge => page.querySelectorAll(`.path-mile[data-count="${badge.count}"], .path-meter-pin[data-count="${badge.count}"]`).forEach(element => element.classList.add('is-new')));
    // The message is a moment, not a fixture: it leaves after a few seconds (screen readers already heard it).
    arrivalTimer = window.setTimeout(() => arrival.classList.remove('is-visible'), 5000);
  };
  let frame = 0, follow = true;
  // A live region filled in the same task that inserts it is not reliably announced, so a celebration
  // without a drive waits a moment; nothing is committed until it has played.
  if (from === position) { if (change.added) arrivalTimer = window.setTimeout(celebrate, 400); else commit(); }
  else {
    // Any deliberate scroll or tap hands the view back to the learner mid-drive.
    for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) page.addEventListener(type, () => { follow = false; }, { passive: true, once: true });
    const duration = Math.min(1800, 800 + (position - from) * 300);
    let begin: number | undefined;
    const step = (now: number) => {
      begin ??= now + 350; // let the tab transition finish so the drive is actually seen
      const t = Math.min(1, Math.max(0, (now - begin) / duration)), eased = ease(t);
      current = from + (position - from) * eased;
      placeCar();
      setMeter(doneFrom + (progress.completed - doneFrom) * eased);
      if (follow) showCar();
      updateLocate();
      if (t < 1) frame = requestAnimationFrame(step);
      else celebrate();
    };
    frame = requestAnimationFrame(step);
  }

  locate.addEventListener('click', () => {
    follow = true;
    const focused = document.activeElement === locate;
    showCar();
    updateLocate();
    // The button hides once the car is back in view, so keyboard focus moves to the sign the car is heading for.
    if (focused) (destination ?? main).focus({ preventScroll: true });
    if (!reduced) carMark.animate([{ opacity: .35 }, { opacity: 1 }], { duration: 350 });
  });
  // Both sheets return focus to the control that opened them (Safari does not restore it for <dialog>).
  const badgeDialog = page.querySelector<HTMLDialogElement>('.path-milestones')!;
  const badgeSheet = bottomSheet(badgeDialog);
  let badgeOpener: HTMLElement | null = null;
  page.querySelectorAll<HTMLButtonElement>('[data-badges]').forEach(button => button.addEventListener('click', () => { badgeOpener = button; badgeSheet.open(); }));
  badgeDialog.addEventListener('close', () => badgeOpener?.focus({ preventScroll: true }));
  const lessonDialog = page.querySelector<HTMLDialogElement>('.path-sheet')!;
  const lessonSheet = bottomSheet(lessonDialog);
  let opener: HTMLElement | null = null;
  page.querySelectorAll<HTMLButtonElement>('button[data-lesson]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.lesson);
    lessonDialog.querySelector('h2')!.textContent = CLIPS[index].title;
    lessonDialog.querySelector('.path-sheet-content')!.innerHTML = sheetBody(CLIPS[index], index, states[index]);
    opener = button;
    lessonSheet.open();
  }));
  lessonDialog.addEventListener('close', () => opener?.focus({ preventScroll: true }));
  main.focus({ preventScroll: true });
  return { dispose() { live = false; cancelAnimationFrame(frame); cancelAnimationFrame(scrollFrame); clearTimeout(arrivalTimer); resize.disconnect(); badgeSheet.dispose(); lessonSheet.dispose(); page.remove(); } };
}
