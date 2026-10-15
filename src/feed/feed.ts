import { CLIPS, clipById, nextClip, type Clip } from './clips';
import { answer, dailyGoal, marked, record, stats, toggleMark, XP_PER_CLIP } from './progress';
import { preloadDrive } from '../drive';
import { lessonProgress } from '../home/model';
import { MILESTONES } from '../progress/milestones';
import { go, type View } from '../navigation';
import { createScrollTimer } from './scrollTimer';
import { roadPoster } from './poster';
import { LOCAL_SOURCE } from './curriculum';
import './minimal.css';

const DEMO_SECONDS = 8;
// Must match VIDEO_CACHE in src/sw.js, which serves these cached files (with byte ranges) offline.
const VIDEO_CACHE = 'amber-videos-h264';
// A first-frame still for each lesson video (see public/images/lessons/posters/README.md), shown
// the moment a clip scrolls in so the screen is never blank while the video starts.
export const videoPoster = (video: string) => video.replace(/^videos\/(.+)\.mp4$/, 'images/lessons/posters/$1.jpg');
const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const bookmark = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>';
const heart = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
const shareIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 3-7 18-4-8-8-3 19-7Zm0 0L10 13"/></svg>';
const back = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg>';
const play = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg>';
const check = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
const flame = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2c1 7-6 6-3 12 2-1 3-3 3-5 5 4 6 7 4 11-2 3-8 3-11 0C1 14 6 9 8 7c-1 4 1 4 1 4C8 5 12 5 13 2Z"/></svg>';
const trophy = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8v7a4 4 0 0 1-8 0ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v5m-5 2h10"/></svg>';
const roundNumber = (index: number) => String(index + 1).padStart(2, '0');
function clipHtml(clip: Clip, index: number) {
  const lesson = clip.lesson;
  // The source and poster are attached only while the clip is near the screen (see paintPreload).
  return `<article class="lane-clip${lesson ? ' has-lesson' : ''}${clip.video ? ' has-video' : ''}" data-clip="${clip.id}" aria-label="Lesson ${index + 1}: ${esc(clip.title)}">
    <video class="lane-video" ${clip.video ? `data-src="${esc(clip.video)}" data-poster="${esc(videoPoster(clip.video))}"` : ''} playsinline muted preload="none" aria-label="${esc(clip.title)}"></video>
    <div class="lane-poster" aria-hidden="true">${roadPoster(index, clip.poster?.scene)}</div>
    <button class="lane-play-surface" data-play="${clip.id}" aria-label="Pause clip"></button>
    <div class="lane-top"><a class="lane-home" href="#/home" aria-label="Back to home">${back}</a><div class="lane-scroll-time" role="timer" aria-label="Time spent scrolling"><time>00:00</time></div></div>
    <div class="lane-meta"><span>${esc(lesson?.category ?? clip.topic)}</span><h2>${esc(clip.title)}</h2>${lesson ? `<details class="lane-rule"><summary>California rule<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div class="lane-rule-content"><p>${esc(lesson.californiaRule)}</p><small>${esc(lesson.handbook)}</small><button class="lane-about-open" data-about="${clip.id}" aria-haspopup="dialog">About this lesson</button></div></details>` : ''}</div>
    <div class="lane-rail"><button class="lane-icon" data-like="${clip.id}" aria-label="${marked('liked', clip.id) ? 'Unlike lesson' : 'Like lesson'}" aria-pressed="${marked('liked', clip.id)}">${heart}</button><button class="lane-icon" data-save="${clip.id}" aria-label="${marked('saved', clip.id) ? 'Unsave lesson' : 'Save lesson'}" aria-pressed="${marked('saved', clip.id)}">${bookmark}</button><button class="lane-icon" data-share="${clip.id}" aria-label="Share lesson">${shareIcon}</button></div>
  </article>`;
}

export function mountFeed(root: HTMLElement, target?: { id: string; quiz: boolean }): View {
  const initial = Math.max(0, CLIPS.findIndex(clip => clip.id === target?.id));
  const { done } = stats();
  root.innerHTML = `<main class="rl lane-shell">
    <h1 class="rl-visually-hidden">Lane driving lessons</h1>
    <div class="lane-feed" tabindex="0" aria-label="Vertical video lessons"><div class="lane-track">${CLIPS.map(clipHtml).join('')}<section class="lane-end"><span>ALL CAUGHT UP</span><h2>You’ve reached the end.</h2><p>${done} of ${CLIPS.length} lessons completed.</p><a class="ui-button" href="#/lesson-progress">See your progress</a><a class="ui-button is-secondary" href="#/home">Back to home</a></section></div></div>
    <div class="lane-scrim" hidden></div><section class="lane-sheet" role="dialog" aria-modal="true" aria-label="Quick check" aria-hidden="true"><div class="lane-sheet-grab"></div><div class="lane-sheet-content"></div></section>
    <div class="lane-toast" role="status" aria-live="polite"></div>
    <dialog class="lane-about" aria-labelledby="lane-about-title"></dialog>
  </main>`;
  const shell = root.querySelector<HTMLElement>('.lane-shell')!;
  const feed = root.querySelector<HTMLElement>('.lane-feed')!;
  const track = root.querySelector<HTMLElement>('.lane-track')!;
  const panels = [...root.querySelectorAll<HTMLElement>('.lane-clip')];
  const sheet = root.querySelector<HTMLElement>('.lane-sheet')!;
  const content = root.querySelector<HTMLElement>('.lane-sheet-content')!;
  const scrim = root.querySelector<HTMLElement>('.lane-scrim')!;
  const toast = root.querySelector<HTMLElement>('.lane-toast')!;
  const about = root.querySelector<HTMLDialogElement>('.lane-about')!;
  const controller = new AbortController();
  let resumeAfterAbout = false, resumeAfterRule = false;
  let active = initial, questionIndex = 0, questionAnswered = false, sheetOpen = false;
  let questionMissed = false, firstTryCount = 0, earnedXP = 0;
  let scrollTarget: number | null = null;
  // Neighbors whose preload failed (often a dropped connection) wait for the next swipe to retry.
  const failedPreloads = new Set<HTMLVideoElement>();
  let playing = true, elapsed = 0, lastTick = performance.now(), toastTimeout = 0, loadingTimeout = 0;
  const scrollTimer = createScrollTimer(lastTick);
  const timers = [...root.querySelectorAll<HTMLElement>('.lane-scroll-time time')];
  let displayedSeconds = -1;
  const current = () => CLIPS[active];
  const panel = () => panels[active];
  // A clip loses has-video when its file fails, and then plays as a timed poster instead.
  const video = () => panel().classList.contains('has-video') ? panel().querySelector<HTMLVideoElement>('video') : null;
  const questions = (): { question: string; options: string[]; answer: number; explanation: string; source?: string }[] => {
    const clip = current();
    return [{ question: clip.question, options: clip.options, answer: clip.answer, explanation: clip.explanation, source: clip.source }, ...(clip.followUp ? [clip.followUp] : [])];
  };
  const updateUrl = () => history.replaceState(null, '', `#/feed/${current().id}${sheetOpen ? '/quiz' : ''}`);
  const announce = (message: string) => { toast.textContent = message; toast.classList.add('is-visible'); clearTimeout(toastTimeout); toastTimeout = window.setTimeout(() => toast.classList.remove('is-visible'), 1800); };

  function paintPlayback() {
    const button = panel().querySelector<HTMLButtonElement>('[data-play]')!;
    button.innerHTML = playing ? '' : play;
    panel().classList.toggle('is-paused', !playing);
    button.setAttribute('aria-label', panel().querySelector('.lane-rule[open]') ? 'Close California rule' : playing ? video()?.muted ? 'Play clip with sound' : 'Pause clip' : elapsed >= DEMO_SECONDS ? 'Replay clip' : 'Play clip');
  }
  function setPlaying(value: boolean) {
    playing = value;
    const media = video();
    if (media) {
      if (value) {
        media.muted = false;
        void media.play().catch(() => {
          if (media !== video() || !playing) return;
          // Autoplay may require muted audio until the learner taps the video.
          media.muted = true;
          paintPlayback();
          void media.play().catch(() => {
            // Still blocked (for example iOS Low Power Mode): show the play button for a tap.
            // A file that failed instead is handled by the error listener, which switches to the poster.
            if (media !== video() || !playing) return;
            playing = false; paintPlayback(); paintLoading();
          });
        });
      } else media.pause();
    }
    paintPlayback();
    paintLoading();
  }
  // The current and next clips buffer, so a swipe starts without waiting; the previous one keeps its
  // header for a swipe back. Neighbors wait until the current clip can play, so on a slow connection
  // they never compete with the clip on screen. Farther clips drop their source, so a long session
  // never holds dozens of decoded videos in a phone's memory.
  function paintPreload() {
    const onScreen = video();
    // Offline, unwatched neighbors can't load, so they aren't attempted.
    const neighbors = navigator.onLine && (!onScreen || onScreen.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA);
    panels.forEach((item, i) => {
      const media = item.querySelector<HTMLVideoElement>('video')!;
      const src = media.dataset.src, distance = i - active;
      if (!src || !item.classList.contains('has-video')) return;
      if (distance < -1 || distance > 2) {
        if (media.hasAttribute('src')) { media.pause(); media.removeAttribute('src'); media.load(); }
        return;
      }
      // Posters are small and cached for offline use, so every nearby clip shows one right away.
      if (!media.hasAttribute('poster')) media.poster = media.dataset.poster!;
      if (distance !== 0 && !media.hasAttribute('src') && (!neighbors || failedPreloads.has(media))) return;
      // preload is set before src so the new load already follows it.
      media.preload = distance === 0 || distance === 1 ? 'auto' : 'metadata';
      if (!media.hasAttribute('src')) media.src = src;
    });
  }
  // A spinner only while the current clip is trying to play but has no data yet; the short delay
  // keeps it from flashing when a clip starts quickly.
  function paintLoading() {
    clearTimeout(loadingTimeout);
    const media = video();
    const waiting = () => !!media && media === video() && !media.paused && !sheetOpen && media.readyState < HTMLMediaElement.HAVE_FUTURE_DATA;
    panels.forEach(item => { if (item !== panel() || !waiting()) item.classList.remove('is-loading'); });
    if (waiting()) loadingTimeout = window.setTimeout(() => panel().classList.toggle('is-loading', waiting()), 300);
  }
  // A clip is saved for offline replay only after it has been watched to the end.
  function cacheWatched(media: HTMLVideoElement) {
    if (!navigator.serviceWorker?.controller || !('caches' in window)) return;
    const url = media.currentSrc || media.src;
    void caches.open(VIDEO_CACHE).then(async cache => { if (!await cache.match(url)) await cache.add(url); }).catch(() => {});
  }
  // Web Share and the clipboard both need https; on a plain-http page neither exists, so say so instead of failing silently.
  async function shareClip(clip: Clip) {
    const url = `${location.origin}${location.pathname}#/feed/${clip.id}`;
    if (navigator.share) { await navigator.share({ title: clip.title, url }).catch(() => {}); return; }
    try { await navigator.clipboard.writeText(url); announce('Link copied'); }
    catch { announce('Sharing isn’t available here'); }
  }
  function openAbout(clip: Clip) {
    const lesson = clip.lesson;
    if (!lesson || about.open) return;
    resumeAfterAbout = playing;
    setPlaying(false);
    about.innerHTML = `<div class="lane-about-panel">
      <div class="lane-sheet-head"><span class="lane-round-label">${esc(lesson.category.toUpperCase())}</span><form method="dialog"><button class="lane-close" aria-label="Close lesson details">×</button></form></div>
      <h2 id="lane-about-title">${esc(clip.title)}</h2>
      <p>${esc(lesson.summary)}</p>
      <section class="lane-about-rule"><h3>California rule</h3><p>${esc(lesson.californiaRule)}</p><small>${esc(lesson.handbook)}</small></section>
      <section><h3>Why it matters here</h3><p>${esc(lesson.local)}</p><small>${esc(LOCAL_SOURCE)}. Counts are fatal-and-injury crashes, not all crashes.</small></section>
      <section><h3>Original video</h3><p><a href="${esc(lesson.credit.url)}" target="_blank" rel="noopener noreferrer">${esc(lesson.credit.title)}</a></p><small>Licensed for use in Lane. Where the video differs from California law, follow the California rule above.</small></section>
    </div>`;
    about.showModal();
    about.querySelector<HTMLElement>('.lane-close')?.focus();
  }
  function setActive(index: number, scroll = true) {
    const next = Math.max(0, Math.min(CLIPS.length - 1, index));
    if (next !== active) video()?.pause();
    resumeAfterRule = false;
    panels.forEach(item => { const rule = item.querySelector<HTMLDetailsElement>('.lane-rule'); if (rule) rule.open = false; });
    active = next; elapsed = 0; questionIndex = 0; firstTryCount = 0; earnedXP = 0;
    failedPreloads.clear();
    panels.forEach((item, i) => { item.classList.toggle('is-current', i === active); item.inert = i !== active; });
    if (scroll) {
      scrollTarget = active;
      feed.scrollTo({ top: panel().offsetTop, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
    paintPreload();
    const media = video();
    if (media) media.currentTime = 0;
    setPlaying(true); updateUrl();
  }
  function openSheet() {
    if (sheetOpen) return;
    sheetOpen = true; setPlaying(false); feed.inert = true;
    shell.classList.add('has-sheet'); scrim.hidden = false;
    sheet.setAttribute('aria-hidden', 'false'); updateUrl();
    sheet.querySelector<HTMLElement>('.lane-question')?.focus({ preventScroll: true });
  }
  function closeSheet() {
    if (!sheetOpen) return;
    sheetOpen = false; feed.inert = false;
    shell.classList.remove('has-sheet'); sheet.setAttribute('aria-hidden', 'true');
    updateUrl(); feed.focus({ preventScroll: true });
    window.setTimeout(() => { if (!sheetOpen) scrim.hidden = true; }, 420);
  }
  const header = (label: string) => `<div class="lane-sheet-head"><span class="lane-round-label">LESSON ${roundNumber(active)} <b>/</b> ${label}</span><button class="lane-close" aria-label="Close quiz">×</button></div>`;
  function paintCheckpoints() {
    const count = questionIndex + (questionAnswered ? 1 : 0);
    const meter = content.querySelector<HTMLElement>('.lane-checkpoints');
    if (!meter) return;
    meter.setAttribute('aria-label', `${count} of ${questions().length} checks complete`);
    meter.innerHTML = questions().map((_, i) => `<span class="${i < count ? 'is-done' : i === count ? 'is-active' : ''}">${i < count ? check : `<b>${i + 1}</b>`}<small>${i < count ? 'DONE' : `CHECK ${i + 1}`}</small></span>`).join('');
  }
  function renderQuestion() {
    questionAnswered = false; questionMissed = false;
    sheet.classList.remove('is-round-complete');
    const q = questions()[questionIndex];
    content.innerHTML = `${header('QUICK CHECK')}<div class="lane-checkpoints"></div><h2 class="lane-question" tabindex="-1">${esc(q.question)}</h2><div class="lane-choices">${q.options.map((option, i) => `<button class="lane-choice" data-answer="${i}"><span class="lane-choice-key">${'ABCD'[i]}</span><span class="lane-choice-copy">${esc(option)}</span><span class="lane-choice-status" aria-hidden="true"></span></button>`).join('')}</div><div class="lane-feedback" role="status" aria-live="polite"></div><div class="lane-answer-action"></div><button class="lane-replay">↻ Replay this clip</button>`;
    paintCheckpoints();
    sheet.scrollTop = 0;
    if (sheetOpen) content.querySelector<HTMLElement>('.lane-question')?.focus({ preventScroll: true });
  }
  // The lesson's ending: today's goal and streak from real totals, plus a milestone only on the completion that earned it.
  function todaySummary() {
    const s = stats(), goal = dailyGoal();
    const badge = earnedXP ? MILESTONES.find(milestone => milestone.count === lessonProgress(CLIPS, record).completed) : undefined;
    return `<section class="lane-today" aria-label="Today’s progress">
      <div class="lane-today-row"><span>Today’s goal</span><b>${s.xpToday} / ${goal} XP</b></div>
      <div class="lane-today-track" role="progressbar" aria-label="Daily goal" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${Math.min(s.xpToday, goal)}"><span style="width:${Math.round(Math.min(1, s.xpToday / goal) * 100)}%"></span></div>
      ${s.xpToday >= goal || s.streak ? `<div class="lane-today-chips">${s.xpToday >= goal ? `<span class="ui-chip is-success">${check}Daily goal reached</span>` : ''}${s.streak ? `<span class="ui-chip is-accent">${flame}${s.streak}-day streak</span>` : ''}</div>` : ''}
    </section>${badge ? `<div class="lane-milestone"><span class="lane-milestone-icon">${trophy}</span><span><small>Milestone earned</small><b>${esc(badge.title)}</b></span></div>` : ''}`;
  }
  function renderComplete() {
    const clip = current();
    sheet.classList.add('is-round-complete');
    content.innerHTML = `${header('COMPLETE')}<div class="lane-clear-emblem ui-burst" aria-hidden="true"><div>${check}</div>${Array.from({ length: 8 }, (_, i) => `<i style="--ray:${i}"></i>`).join('')}</div><p class="lane-clear-kicker">${firstTryCount === questions().length ? 'ALL CHECKS COMPLETE' : 'CHECKS COMPLETE'}</p><h2 class="lane-result" tabindex="-1">Lesson complete.</h2><div class="lane-round-stats"><div><strong>${earnedXP ? `+${earnedXP}` : '✓'}<small>${earnedXP ? ' XP' : ''}</small></strong><span>${earnedXP ? 'XP EARNED' : 'PRACTICE COMPLETE'}</span></div><div><strong>${firstTryCount}<small> / ${questions().length}</small></strong><span>RIGHT FIRST TRY</span></div></div>${todaySummary()}${clip.simulator ? '<div class="lane-next-mission"><span class="lane-practice-label">OPTIONAL PRACTICE</span><h3>Practice this decision</h3><p>Put that yellow-light decision into practice.</p></div><button class="lane-sheet-action ui-button is-split" data-drive>Start driving practice <span aria-hidden="true">↗</span></button><button class="lane-sheet-action secondary ui-button is-split is-secondary" data-next>Next lesson <span aria-hidden="true">→</span></button>' : `<p class="lane-result-copy">${nextClip(clip.id) ? 'Your progress has been saved.' : 'All lessons complete.'}</p><button class="lane-sheet-action ui-button is-split" data-next>${nextClip(clip.id) ? 'Next lesson' : 'View summary'} <span aria-hidden="true">→</span></button>`}`;
    sheet.scrollTop = 0;
    content.querySelector<HTMLElement>('.lane-result')?.focus({ preventScroll: true });
  }
  function finishClip() {
    if (sheetOpen) return;
    const media = video();
    if (media) { media.pause(); cacheWatched(media); }
    elapsed = media && Number.isFinite(media.duration) && media.duration > 0 ? media.duration : DEMO_SECONDS;
    setPlaying(false); questionIndex = 0; firstTryCount = 0; earnedXP = 0; renderQuestion(); openSheet();
  }
  function choose(index: number) {
    if (questionAnswered) return;
    const q = questions()[questionIndex];
    const button = content.querySelector<HTMLButtonElement>(`[data-answer="${index}"]`)!;
    const feedback = content.querySelector<HTMLElement>('.lane-feedback')!;
    const correct = index === q.answer;
    const wasComplete = record(current().id)?.done;
    answer(current().id, correct, correct && questionIndex === questions().length - 1);
    if (!correct) {
      questionMissed = true; button.classList.add('is-wrong'); button.disabled = true;
      button.querySelector('.lane-choice-status')!.textContent = '×';
      feedback.className = 'lane-feedback is-retry';
      feedback.innerHTML = '<strong>Keep going.</strong><span>That one’s not it. Try another answer.</span>';
      return;
    }
    if (!questionMissed) firstTryCount++;
    if (!wasComplete && record(current().id)?.done) earnedXP = XP_PER_CLIP;
    questionAnswered = true; button.classList.add('is-right');
    button.querySelector('.lane-choice-status')!.innerHTML = check;
    paintCheckpoints();
    content.querySelectorAll<HTMLButtonElement>('[data-answer]').forEach(choice => { choice.disabled = true; });
    feedback.className = 'lane-feedback is-correct';
    feedback.innerHTML = `<strong>${questionMissed ? 'Nice recovery.' : 'Nailed it.'}<small>${questionMissed ? 'CHECK CLEARED' : 'FIRST TRY'}</small>${earnedXP ? `<span class="lane-xp-pop ui-chip is-accent">+${earnedXP} XP</span>` : ''}</strong><span>${esc(q.explanation)}</span>${q.source ? `<small class="lane-source">${esc(q.source)}</small>` : ''}`;
    const more = questionIndex < questions().length - 1;
    content.querySelector<HTMLElement>('.lane-answer-action')!.innerHTML = `<button class="lane-sheet-action ui-button is-split" data-continue>${more ? 'Next check' : 'Finish lesson'} <span aria-hidden="true">→</span></button>`;
    root.querySelector('.lane-end p')!.textContent = `${stats().done} of ${CLIPS.length} lessons completed.`;
    content.querySelector<HTMLButtonElement>('[data-continue]')?.focus({ preventScroll: true });
    // Scroll only the sheet: scrollIntoView can also shift the paused feed beneath it.
    const action = content.querySelector<HTMLElement>('.lane-answer-action')!;
    sheet.scrollTop = Math.max(0, action.offsetTop + action.offsetHeight - sheet.clientHeight + 20);
    if (!more && current().simulator) void preloadDrive();
  }
  function next() {
    closeSheet();
    if (nextClip(current().id)) { setActive(active + 1); }
    else { feed.scrollTo({ top: track.scrollHeight, behavior: 'smooth' }); go('#/lesson-progress'); }
  }
  function replay() {
    closeSheet(); elapsed = 0;
    const media = video();
    if (media) media.currentTime = 0;
    setPlaying(true);
  }
  feed.addEventListener('scroll', () => {
    if (sheetOpen) return;
    // Intermediate frames of a "Next lesson" animation are not a new round selection.
    if (scrollTarget !== null) {
      if (Math.abs(feed.scrollTop - panels[scrollTarget].offsetTop) > 1) return;
      scrollTarget = null;
    }
    // Clips have a minimum height, so on a very short screen a clip can be taller than the feed itself.
    const index = Math.round(feed.scrollTop / panels[0].offsetHeight);
    if (index !== active && index < CLIPS.length) setActive(index, false);
  }, { signal: controller.signal, passive: true });
  for (const event of ['pointerdown', 'wheel']) feed.addEventListener(event, () => { scrollTarget = null; }, { signal: controller.signal, passive: true });
  root.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const target = event.target;
    if (target.closest('[data-answer]')) { choose(Number(target.closest<HTMLElement>('[data-answer]')!.dataset.answer)); return; }
    if (target.closest('[data-continue]')) { if (++questionIndex < questions().length) renderQuestion(); else renderComplete(); return; }
    if (target.closest('[data-next]')) { next(); return; }
    if (target.closest('[data-drive]')) { go(`#/drive/${current().id}`); return; }
    if (target.closest('.lane-close, .lane-scrim')) { closeSheet(); return; }
    if (target.closest('.lane-replay')) { replay(); return; }
    const aboutButton = target.closest<HTMLButtonElement>('[data-about]');
    if (aboutButton) { const clip = clipById(aboutButton.dataset.about); if (clip) openAbout(clip); return; }
    if (target === about) { about.close(); return; }
    const playback = target.closest<HTMLButtonElement>('[data-play]');
    const expandedRule = panel().querySelector<HTMLDetailsElement>('.lane-rule[open]');
    if (playback && expandedRule) { expandedRule.open = false; return; }
    if (playback && playing && video()?.muted) { setPlaying(true); return; }
    if (playback) { if (!playing && elapsed >= DEMO_SECONDS) replay(); else setPlaying(!playing); return; }
    const like = target.closest<HTMLButtonElement>('[data-like]');
    if (like) { const on = toggleMark('liked', like.dataset.like!); like.classList.toggle('is-popped', on); like.setAttribute('aria-pressed', String(on)); like.setAttribute('aria-label', on ? 'Unlike lesson' : 'Like lesson'); return; }
    const save = target.closest<HTMLButtonElement>('[data-save]');
    if (save) { const on = toggleMark('saved', save.dataset.save!); save.classList.toggle('is-popped', on); save.setAttribute('aria-pressed', String(on)); save.setAttribute('aria-label', on ? 'Unsave lesson' : 'Save lesson'); return; }
    const share = target.closest<HTMLButtonElement>('[data-share]');
    if (share) {
      const clip = clipById(share.dataset.share);
      if (clip) void shareClip(clip);
    }
  }, { signal: controller.signal });
  root.addEventListener('toggle', event => {
    const rule = event.target;
    if (!(rule instanceof HTMLDetailsElement) || !panel().contains(rule)) return;
    if (rule.open) { resumeAfterRule = playing; setPlaying(false); }
    else { if (resumeAfterRule && !sheetOpen && !about.open) setPlaying(true); resumeAfterRule = false; }
    paintPlayback();
  }, { signal: controller.signal, capture: true });
  root.addEventListener('ended', event => { if (event.target === video()) finishClip(); }, { signal: controller.signal, capture: true });
  // A preloading neighbor that fails releases its source and is retried after the next swipe, so a
  // dropped connection never leaves it as an unplayable video. Only the clip on screen falls back to
  // its timed poster when its file can't play.
  root.addEventListener('error', event => {
    const media = event.target;
    if (!(media instanceof HTMLVideoElement) || !media.hasAttribute('src')) return;
    const item = media.closest('.lane-clip')!;
    media.removeAttribute('src');
    if (item !== panel()) { failedPreloads.add(media); return; }
    item.classList.remove('has-video', 'is-loading');
    elapsed = 0;
    paintPreload();
    setPlaying(true);
    announce('Video unavailable. Playing the lesson preview.');
  }, { signal: controller.signal, capture: true });
  for (const type of ['waiting', 'playing', 'canplay', 'pause', 'emptied']) root.addEventListener(type, event => { if (event.target === video()) paintLoading(); }, { signal: controller.signal, capture: true });
  // Once the clip on screen can play, its neighbors may start loading.
  root.addEventListener('canplay', event => { if (event.target === video()) paintPreload(); }, { signal: controller.signal, capture: true });
  about.addEventListener('close', () => { if (resumeAfterAbout && !sheetOpen) setPlaying(true); resumeAfterAbout = false; feed.focus({ preventScroll: true }); }, { signal: controller.signal });
  root.addEventListener('keydown', event => {
    if (about.open) return;
    if (event.key === 'Escape' && sheetOpen) { closeSheet(); return; }
    if (sheetOpen) {
      if (event.key === 'Tab') {
        const buttons = [...sheet.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
      return;
    }
    if (event.target instanceof Element && event.target.closest('.lane-rule')) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive(active + (event.key === 'ArrowDown' ? 1 : -1)); }
  }, { signal: controller.signal });
  document.addEventListener('visibilitychange', () => { scrollTimer.tick(performance.now(), false); if (document.hidden) { video()?.pause(); lastTick = performance.now(); } else if (playing && !sheetOpen) setPlaying(true); }, { signal: controller.signal });
  const ticker = window.setInterval(() => {
    const now = performance.now(), delta = Math.min((now - lastTick) / 1000, .2);
    lastTick = now;
    if (playing && !sheetOpen && !document.hidden && !video()) { elapsed = Math.min(DEMO_SECONDS, elapsed + delta); if (elapsed >= DEMO_SECONDS) finishClip(); }
    const seconds = scrollTimer.tick(now, !document.hidden);
    if (seconds !== displayedSeconds) { timers.forEach(timer => { timer.textContent = clock(seconds); }); displayedSeconds = seconds; }
  }, 100);
  setActive(initial, false); feed.scrollTop = panel().offsetTop;
  if (target?.quiz) { renderQuestion(); openSheet(); }
  return { dispose() {
    controller.abort(); if (about.open) about.close(); clearInterval(ticker); clearTimeout(toastTimeout); clearTimeout(loadingTimeout);
    // Detached videos can keep downloading, so leaving the feed releases every source.
    panels.forEach(item => { const media = item.querySelector('video')!; if (media.hasAttribute('src')) { media.pause(); media.removeAttribute('src'); media.load(); } });
  } };
}
