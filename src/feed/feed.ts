import { CLIPS, clipById, type Clip } from './clips';
import { addReviewLater, answer, completeFirstSession, marked, markSaved, onboarding, record, recordAttempt, recordHelp, recordMastery, recordSimulation, recordVideoSkip, recordWatch, resolveReview, setPosition, setSoundOff, soundOff, stats, toggleMark, topicRecord, XP_PER_CLIP, type AttemptKind } from './progress';
import { learningFor, topicOf, SAFETY_GATE } from '../content/learning';
import { CONTENT_CARDS, glossaryById, type ContentCard } from '../content/cards';
import { rangesFrom, watchSummary } from '../learning/watch';
import { newVisit, visitMastery, type LessonVisit } from '../learning/session';
import { goalReadiness, masteryBand } from '../learning/scoring';
import type { CheckKind, PlanItem } from '../learning/planner';
import { checkKindFor, currentPlan, currentReadiness } from './plan';
import { scenarioById, type ScenarioEntry } from '../simulation/registry';
import { scenarioCallbacks } from '../simulation/outcome';
import type { ScenarioHandle } from '../simulation/contract';
import { FEED_COPY as copy } from './content';
import { lessonProgress } from '../home/model';
import { MILESTONES } from '../progress/milestones';
import { go, type View } from '../navigation';
import { createScrollTimer } from './scrollTimer';
import { roadPoster } from './poster';
import { LOCAL_SOURCE } from './curriculum';
import { commentsSheet } from './comments';
import '../simulation/host.css';
import './minimal.css';

const DEMO_SECONDS = 8;
// Must match VIDEO_CACHE in src/sw.js, which serves these cached files (with byte ranges) offline.
const VIDEO_CACHE = 'amber-videos-h264';
// A first-frame still for each lesson video (see public/images/lessons/posters/README.md), shown
// the moment a clip scrolls in so the screen is never blank while the video starts.
export const videoPoster = (video: string) => video.replace(/^videos\/(.+)\.mp4$/, 'images/lessons/posters/$1.jpg');
const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const bookmark = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>';
const heart = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
const commentIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>';
const shareIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 3-7 18-4-8-8-3 19-7Zm0 0L10 13"/></svg>';
const back = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg>';
const play = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg>';
const check = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
const flame = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2c1 7-6 6-3 12 2-1 3-3 3-5 5 4 6 7 4 11-2 3-8 3-11 0C1 14 6 9 8 7c-1 4 1 4 1 4C8 5 12 5 13 2Z"/></svg>';
const trophy = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8v7a4 4 0 0 1-8 0ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v5m-5 2h10"/></svg>';
const dots = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
const speaker = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6M18 6.8a7.5 7.5 0 0 1 0 10.4"/></svg>';
const speakerOff = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m15.5 9.5 5 5m0-5-5 5"/></svg>';
const lessonNumber = (id: string) => String(CLIPS.findIndex(clip => clip.id === id) + 1).padStart(2, '0');
type Kind = 'primary' | 'similar' | 'harder';
type Question = { question: string; options: string[]; answer: number; explanation: string; source?: string };
export type FeedTarget = { id?: string; quiz?: boolean; sim?: string };

const rail = (clip: Clip) => `<div class="lane-rail"><button class="lane-icon" data-like="${clip.id}" aria-label="${marked('liked', clip.id) ? 'Unlike lesson' : 'Like lesson'}" aria-pressed="${marked('liked', clip.id)}">${heart}</button><button class="lane-icon" data-comments="${clip.id}" aria-label="Comments">${commentIcon}</button><button class="lane-icon" data-save="${clip.id}" aria-label="${marked('saved', clip.id) ? 'Unsave lesson' : 'Save lesson'}" aria-pressed="${marked('saved', clip.id)}">${bookmark}</button><button class="lane-icon" data-share="${clip.id}" aria-label="Share lesson">${shareIcon}</button></div>`;
// A text lesson (no video): a post whose sentences the learner completes one blank at a time.
function textLessonHtml(clip: Clip, index: number, revisit: boolean) {
  return `<article class="lane-clip lane-card lane-text-lesson" data-item="${index}" data-clip="${clip.id}" aria-label="Lesson ${lessonNumber(clip.id)}: ${esc(clip.title)}">
    <div class="lane-top"><a class="lane-home" href="#/home" aria-label="Back to home">${back}</a></div>
    <div class="lane-card-body lane-post"><span class="lane-card-label">${revisit ? `${copy.reviewLabel} · ` : ''}${esc(clip.topic.toUpperCase())} · ${copy.fillLabel}</span><h2>${esc(clip.title)}</h2><ol class="lane-post-steps" data-post-steps></ol><p class="lane-card-status" role="status" data-post-status></p><small class="lane-card-source">Source: ${esc(citation(clip.post!.source))}</small></div>
    ${rail(clip)}
  </article>`;
}
function lessonHtml(clip: Clip, index: number, revisit: boolean) {
  if (clip.post) return textLessonHtml(clip, index, revisit);
  const lesson = clip.lesson;
  // The source and poster are attached only while the clip is near the screen (see paintPreload).
  return `<article class="lane-clip${lesson ? ' has-lesson' : ''}${clip.video ? ' has-video' : ''}" data-item="${index}" data-clip="${clip.id}" aria-label="Lesson ${lessonNumber(clip.id)}: ${esc(clip.title)}">
    <video class="lane-video" ${clip.video ? `data-src="${esc(clip.video)}" data-poster="${esc(videoPoster(clip.video))}"` : ''} playsinline muted preload="none" aria-label="${esc(clip.title)}"></video>
    <div class="lane-poster" aria-hidden="true">${roadPoster(CLIPS.indexOf(clip), clip.poster?.scene)}</div>
    <button class="lane-play-surface" data-play aria-label="Pause clip"></button>
    <div class="lane-top"><a class="lane-home" href="#/home" aria-label="Back to home">${back}</a><div class="lane-top-end">${clip.video ? '<button class="lane-sound" data-sound aria-pressed="false" aria-label="Mute sound"></button>' : ''}<div class="lane-scroll-time" role="timer" aria-label="${copy.videoTime}"><time>0:00</time></div></div></div>
    <div class="lane-meta"><span>${revisit ? `${copy.reviewLabel} · ` : ''}${esc(lesson?.category ?? clip.topic)}</span><h2>${esc(clip.title)}</h2>${lesson ? `<details class="lane-rule"><summary>California rule<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div class="lane-rule-content"><p>${esc(lesson.californiaRule)}</p><small>${esc(lesson.handbook)}</small><button class="lane-about-open" data-about="${clip.id}" aria-haspopup="dialog">About this lesson</button></div></details>` : ''}</div>
    ${rail(clip)}
  </article>`;
}
// What a learner sees as a source: the handbook part of a citation (internal provenance notes stay in the data).
const citation = (source: string) => { const at = source.search(/California Quick Reference/); return at >= 0 ? source.slice(at) : /Aceable/.test(source) ? 'Aceable driver’s ed glossary' : source; };
const cardTop = `<div class="lane-top"><a class="lane-home" href="#/home" aria-label="Back to home">${back}</a></div>`;
function simHtml(entry: ScenarioEntry, index: number) {
  return `<article class="lane-clip lane-card lane-sim-card" data-item="${index}" aria-label="${esc(`${copy.simLabel}: ${entry.title}`)}">${cardTop}
    <div class="lane-card-body" data-sim-body><span class="lane-card-label">${copy.simLabel} · SIM ${String(entry.number).padStart(2, '0')}</span><h2>${esc(entry.title)}</h2><p class="lane-card-rule">${esc(entry.rule)}</p><p class="lane-card-note">${copy.simPitch}</p>
      <div class="lane-card-actions"><button class="ui-button is-split" data-sim-start>${copy.simStart} <span aria-hidden="true">→</span></button><button class="ui-button is-secondary" data-sim-skip>${copy.simSkip}</button></div><p class="lane-card-status" role="status"></p></div>
    <div class="lane-sim-stage sim-stage" data-sim-stage hidden></div></article>`;
}
function contentCardHtml(card: ContentCard, index: number) {
  const body = card.kind === 'glossary' ? `<h2>${esc(card.term)}</h2><p class="lane-card-rule">${esc(card.definition)}</p><div class="lane-card-actions"><button class="ui-button" data-card-got>${copy.gotIt}</button></div>`
    : card.kind === 'flashcard' ? `<h2>${esc(card.front)}</h2><p class="lane-card-note">${copy.recallPrompt}</p><div class="lane-card-answer" data-card-answer hidden><p class="lane-card-rule">${esc(card.back)}</p></div><div class="lane-card-actions" data-card-reveal-row><button class="ui-button" data-card-reveal>${copy.showAnswer}</button></div><div class="lane-card-actions" data-card-rate hidden><button class="ui-button" data-card-got>${copy.gotIt}</button><button class="ui-button is-secondary" data-card-not>${copy.notYet}</button></div>`
    : `<h2>${esc(card.title)}</h2><ul class="lane-card-list">${card.body.map(line => `<li>${esc(line)}</li>`).join('')}</ul>`;
  return `<article class="lane-clip lane-card lane-content-card" data-item="${index}" data-card="${card.id}" aria-label="${esc(copy.cardLabel[card.kind])}">${cardTop}<div class="lane-card-body"><span class="lane-card-label">${copy.cardLabel[card.kind]}</span>${body}<p class="lane-card-status" role="status"></p><small class="lane-card-source">Source: ${esc(citation(card.source))}</small></div></article>`;
}

export function mountFeed(root: HTMLElement, target: FeedTarget = {}): View {
  const startClip = clipById(target.id);
  const items: PlanItem[] = currentPlan({ lessonId: startClip?.id, scenarioId: scenarioById(target.sim)?.id });
  const itemHtml = (item: PlanItem, index: number) => {
    if (item.kind === 'lesson') return lessonHtml(clipById(item.id)!, index, item.revisit);
    if (item.kind === 'sim') return simHtml(scenarioById(item.id)!, index);
    return contentCardHtml(CONTENT_CARDS.find(card => card.id === item.id)!, index);
  };
  root.innerHTML = `<main class="rl lane-shell">
    <h1 class="rl-visually-hidden">Lane driving lessons</h1>
    <div class="lane-feed" tabindex="0" aria-label="Lessons, practice and review"><div class="lane-track">${items.map(itemHtml).join('')}<section class="lane-end"><span>ALL CAUGHT UP</span><h2>That’s everything for now.</h2><p data-end-done></p><p data-end-time></p><a class="ui-button" href="#/review">Daily review</a><a class="ui-button is-secondary" href="#/home">Back to home</a></section></div></div>
    <div class="lane-scrim" hidden></div><section class="lane-sheet" role="dialog" aria-modal="true" aria-label="Quick check" aria-hidden="true"><div class="lane-sheet-grab"></div><div class="lane-sheet-content"></div></section>
    <div class="lane-toast" role="status" aria-live="polite"></div>
    <dialog class="lane-about" aria-labelledby="lane-about-title"></dialog>
    <dialog class="lane-comments" aria-labelledby="lane-comments-title"></dialog>
  </main>`;
  const shell = root.querySelector<HTMLElement>('.lane-shell')!;
  const feed = root.querySelector<HTMLElement>('.lane-feed')!;
  const track = root.querySelector<HTMLElement>('.lane-track')!;
  const panels = [...root.querySelectorAll<HTMLElement>('[data-item]')];
  const sheet = root.querySelector<HTMLElement>('.lane-sheet')!;
  const content = root.querySelector<HTMLElement>('.lane-sheet-content')!;
  const scrim = root.querySelector<HTMLElement>('.lane-scrim')!;
  const toast = root.querySelector<HTMLElement>('.lane-toast')!;
  const about = root.querySelector<HTMLDialogElement>('.lane-about')!;
  const commentsDialog = root.querySelector<HTMLDialogElement>('.lane-comments')!;
  const comments = commentsSheet(commentsDialog);
  // Like every off-screen panel, the end card is inactive until the learner reaches it.
  const endCard = root.querySelector<HTMLElement>('.lane-end')!;
  endCard.inert = true;
  const controller = new AbortController();
  let resumeAfterAbout = false, resumeAfterRule = false, resumeAfterComments = false;
  let active = 0, questionIndex = 0, questionAnswered = false, sheetOpen = false;
  let questionMissed = false, firstTryCount = 0, earnedXP = 0;
  let kind: Kind = 'primary', checkKind: CheckKind = 'quiz', questionShownAt = 0, activityPicked = -1, activityThen: 'question' | 'next' = 'question';
  let pendingTarget: number | null = null, savedStage = '';
  // "Watch the important part": the clip plays only its key segment, then the check comes back.
  let keyStop: number | null = null, afterKey: 'question' | 'stage' = 'question';
  // A running simulation locks the feed so a vertical swipe can't skip its decision.
  let simHandle: ScenarioHandle | null = null, simLeave: (() => void) | null = null;
  // Only a finished lesson (or one without learning data) can be closed; an open check cannot.
  const dismissable = () => !!content.querySelector('.lane-close:not([data-menu])');
  // Evidence for each lesson during this feed visit; scored once into topic mastery.
  const visits = new Map<string, LessonVisit>(), scored = new Set<string>(), gatePassed = new Set<string>(), checked = new Set<string>();
  // Text lessons: how many blanks are filled, and how many wrong taps it took (engagement evidence).
  const postFilled = new Map<string, number>(), postMisses = new Map<string, number>();
  const visit = (id: string) => { let entry = visits.get(id); if (!entry) visits.set(id, entry = newVisit()); return entry; };
  let scrollTarget: number | null = null;
  // Neighbors whose preload failed (often a dropped connection) wait for the next swipe to retry.
  const failedPreloads = new Set<HTMLVideoElement>();
  let playing = true, elapsed = 0, lastTick = performance.now(), toastTimeout = 0, loadingTimeout = 0;
  const sessionTimer = createScrollTimer(lastTick);
  const item = (index = active) => items[index];
  const lessonAt = (index: number) => { const entry = items[index]; return entry?.kind === 'lesson' ? clipById(entry.id)! : null; };
  // Lesson functions below run only while a lesson is on screen.
  const current = () => lessonAt(active)!;
  const isLesson = () => item()?.kind === 'lesson';
  const panel = () => panels[active];
  // A clip loses has-video when its file fails, and then plays as a timed poster instead.
  const videoAt = (index: number) => panels[index]?.classList.contains('has-video') ? panels[index].querySelector<HTMLVideoElement>('video') : null;
  const video = () => isLesson() ? videoAt(active) : null;
  const questions = (): Question[] => {
    const clip = current();
    return [{ question: clip.question, options: clip.options, answer: clip.answer, explanation: clip.explanation, source: clip.source }, ...(clip.followUp ? [clip.followUp] : [])];
  };
  const learning = () => learningFor(current().id);
  const topic = () => topicOf(current().id);
  const reviewing = () => checkKind === 'review-quiz';
  const currentQuestion = (): Question => kind === 'similar' ? learning()!.similar : kind === 'harder' ? learning()!.harder : questions()[questionIndex];
  const updateUrl = () => {
    const entry = item();
    const path = !entry ? '#/feed' : entry.kind === 'lesson' ? `#/feed/${entry.id}${sheetOpen ? '/quiz' : ''}` : entry.kind === 'sim' ? `#/feed/sim/${entry.id}` : '#/feed';
    history.replaceState(null, '', path);
  };
  const announce = (message: string) => { toast.textContent = message; toast.classList.add('is-visible'); clearTimeout(toastTimeout); toastTimeout = window.setTimeout(() => toast.classList.remove('is-visible'), 2200); };

  // The sound button shows whether the clip on screen is actually muted (autoplay can force it).
  function paintSound() {
    const button = isLesson() ? panel().querySelector<HTMLButtonElement>('[data-sound]') : null, media = video();
    if (!button) return;
    const muted = media ? media.muted : soundOff();
    button.innerHTML = muted ? speakerOff : speaker;
    button.setAttribute('aria-pressed', String(muted));
    button.setAttribute('aria-label', muted ? 'Turn sound on' : 'Mute sound');
  }
  function paintPlayback() {
    if (!isLesson()) return;
    paintSound();
    const button = panel().querySelector<HTMLButtonElement>('[data-play]');
    if (!button) return;
    button.innerHTML = playing ? '' : play;
    panel().classList.toggle('is-paused', !playing);
    button.setAttribute('aria-label', panel().querySelector('.lane-rule[open]') ? 'Close California rule' : playing ? video()?.muted ? 'Play clip with sound' : 'Pause clip' : 'Play clip');
  }
  // Counts taps on the sound button, so a late autoplay fallback never overrides a choice made since.
  let soundChanges = 0;
  function setPlaying(value: boolean) {
    playing = value;
    const media = video();
    if (media) {
      if (value) {
        media.muted = soundOff();
        const attempt = soundChanges;
        void media.play().catch(() => {
          if (media !== video() || !playing || attempt !== soundChanges) return;
          // Autoplay may require muted audio until the learner taps the video.
          media.muted = true;
          paintPlayback();
          void media.play().catch(() => {
            // Still blocked (for example iOS Low Power Mode): show the play button for a tap.
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
  // header for a swipe back. Farther clips drop their source, so a long session never holds dozens
  // of decoded videos in a phone's memory.
  function paintPreload() {
    const onScreen = video();
    const neighbors = navigator.onLine && (!onScreen || onScreen.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA);
    panels.forEach((entry, i) => {
      const media = entry.querySelector<HTMLVideoElement>('video');
      const src = media?.dataset.src, distance = i - active;
      if (!media || !src || !entry.classList.contains('has-video')) return;
      if (distance < -1 || distance > 2) {
        if (media.hasAttribute('src')) { media.pause(); media.removeAttribute('src'); media.load(); }
        return;
      }
      if (!media.hasAttribute('poster')) media.poster = media.dataset.poster!;
      if (distance !== 0 && !media.hasAttribute('src') && (!neighbors || failedPreloads.has(media))) return;
      media.preload = distance === 0 || distance === 1 ? 'auto' : 'metadata';
      if (!media.hasAttribute('src')) media.src = src;
    });
  }
  function paintLoading() {
    clearTimeout(loadingTimeout);
    const media = video();
    const waiting = () => !!media && media === video() && !media.paused && !sheetOpen && media.readyState < HTMLMediaElement.HAVE_FUTURE_DATA;
    panels.forEach(entry => { if (entry !== panel() || !waiting()) entry.classList.remove('is-loading'); });
    if (waiting()) loadingTimeout = window.setTimeout(() => panel().classList.toggle('is-loading', waiting()), 300);
  }
  // The corner timer is the clip's own time; it stops when the clip ends.
  function paintTime() {
    if (!isLesson()) return;
    const time = panel().querySelector('.lane-scroll-time time');
    if (!time) return;
    const media = video();
    time.textContent = media ? `${clock(media.currentTime || 0)} / ${clock(Number.isFinite(media.duration) ? media.duration : 0)}` : `${clock(elapsed)} / ${clock(DEMO_SECONDS)}`;
  }
  function cacheWatched(media: HTMLVideoElement) {
    if (!navigator.serviceWorker?.controller || !('caches' in window)) return;
    const url = media.currentSrc || media.src;
    void caches.open(VIDEO_CACHE).then(async cache => { if (!await cache.match(url)) await cache.add(url); }).catch(() => {});
  }
  // Real watch coverage from the played ranges, saved whenever a lesson ends or is left.
  function watchOf(index: number) {
    const clip = lessonAt(index), media = videoAt(index);
    if (!clip || !media || !media.hasAttribute('src') || !(media.duration > 0)) return null;
    return watchSummary(rangesFrom(media.played), media.duration, learningFor(clip.id)?.keySegment);
  }
  function saveWatch(index: number, ended = false) {
    const summary = watchOf(index), clip = lessonAt(index);
    if (!summary || !clip) return;
    visit(clip.id).watch = summary;
    recordWatch(clip.id, { ...summary, ended });
  }
  // Scores the visit once into topic mastery and returns this session's score.
  function scoreVisit() {
    const clip = current(), entry = visits.get(clip.id);
    if (!entry || scored.has(clip.id)) return null;
    // A text lesson's "watching" is filling its blanks; misses lower its engagement.
    if (clip.post && !entry.watch) { const filled = postFilled.get(clip.id) ?? 0, total = clip.post.steps.length; entry.watch = { watchedRatio: filled / total, keySegmentSeen: filled >= total, engagement: total / (total + (postMisses.get(clip.id) ?? 0)) }; }
    const mastery = visitMastery(entry, topicRecord(topic()));
    if (mastery === null) return null;
    scored.add(clip.id);
    recordMastery(topic(), mastery);
    return mastery;
  }
  // Before the video ends, leaving an important unfinished lesson asks "Are you sure?" once.
  function videoUnfinished() {
    const post = current().post;
    if (post) return (postFilled.get(current().id) ?? 0) < post.steps.length;
    const media = video();
    if (media) return !media.ended && !(media.duration > 0 && media.currentTime >= media.duration - 0.5);
    return elapsed < DEMO_SECONDS;
  }
  function needsGate() {
    if (!isLesson()) return false;
    const entry = item() as Extract<PlanItem, { kind: 'lesson' }>, clip = current();
    return !sheetOpen && !entry.revisit && !gatePassed.has(clip.id) && !checked.has(clip.id) && !record(clip.id)?.done
      && (learning()?.safety ?? 0) >= SAFETY_GATE && videoUnfinished();
  }
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
      <section><h3>Why it matters here</h3><p>${esc(lesson.local)}</p><small>${esc(LOCAL_SOURCE)}. Counts include only crashes where someone was killed or injured.</small></section>
      <section><h3>Source & credits</h3><p><a href="${esc(lesson.credit.url)}" target="_blank" rel="noopener noreferrer">${esc(lesson.credit.title)}</a></p><small>Used under Creative Commons; see <a href="#/credits">Credits & sources</a>. Where the video differs from California law, follow the California rule above.</small></section>
    </div>`;
    about.showModal();
    about.querySelector<HTMLElement>('.lane-close')?.focus();
  }
  function setActive(index: number, scroll = true) {
    const nextIndex = Math.max(0, Math.min(items.length - 1, index));
    if (simHandle) { feed.scrollTo({ top: panel().offsetTop, behavior: 'instant' }); return; }
    if (nextIndex > active && needsGate()) { openGate(nextIndex); return; }
    if (nextIndex !== active && isLesson()) {
      const clip = current();
      saveWatch(active);
      // Moving on from an unfinished lesson without its check counts as a skip, so it returns sooner.
      if (nextIndex > active && !record(clip.id)?.done && !checked.has(clip.id) && !gatePassed.has(clip.id)) recordVideoSkip(clip.id, topic());
      video()?.pause();
    }
    kind = 'primary'; keyStop = null;
    resumeAfterRule = false;
    panels.forEach(entry => { const rule = entry.querySelector<HTMLDetailsElement>('.lane-rule'); if (rule) rule.open = false; });
    active = nextIndex; elapsed = 0; questionIndex = 0; firstTryCount = 0; earnedXP = 0;
    failedPreloads.clear();
    panels.forEach((entry, i) => { entry.classList.toggle('is-current', i === active); entry.inert = i !== active; });
    endCard.inert = true;
    if (scroll) {
      scrollTarget = active;
      scrollToCard(active, !matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
    paintPreload();
    if (isLesson()) {
      setPosition(current().id);
      const media = video();
      if (media) media.currentTime = 0;
      if (current().post) { playing = false; renderPost(); } else setPlaying(true);
    } else playing = false;
    paintTime(); updateUrl();
  }
  // Moves the feed to a card with snapping paused. Snapping comes back only once the feed has arrived,
  // so it can't pull the screen back to the old card mid-animation (iOS does) while the new card plays;
  // if the feed still ended up elsewhere without the learner touching it, it is put on the active card.
  let snapFrame = 0, snapTimer = 0, pendingSettle: ((event?: Event) => void) | null = null;
  function scrollToCard(index: number, smooth: boolean) {
    cancelAnimationFrame(snapFrame); clearTimeout(snapTimer);
    if (pendingSettle) feed.removeEventListener('scrollend', pendingSettle);
    feed.style.scrollSnapType = 'none';
    const top = panels[index].offsetTop;
    feed.scrollTo({ top, behavior: smooth ? 'smooth' : 'instant' });
    const started = performance.now();
    const settle = (event?: Event) => {
      // A scrollend left over from an earlier instant jump is not this animation ending.
      if (event && performance.now() - started < 200 && Math.abs(feed.scrollTop - top) > 1) return;
      feed.removeEventListener('scrollend', settle); clearTimeout(snapTimer); pendingSettle = null;
      if (index === active && (scrollTarget === index || !smooth) && Math.abs(feed.scrollTop - top) > 1) feed.scrollTo({ top, behavior: 'instant' });
      if (scrollTarget === index) scrollTarget = null;
      snapFrame = requestAnimationFrame(() => { feed.style.scrollSnapType = ''; });
    };
    if (smooth) { pendingSettle = settle; feed.addEventListener('scrollend', settle); snapTimer = window.setTimeout(settle, 900); }
    else settle();
  }
  // Puts the current card back in view; the paused snap also clears the card a swipe still in motion was heading for.
  function holdPosition() { scrollToCard(active, false); }
  function openSheet() {
    if (sheetOpen) return;
    sheetOpen = true; setPlaying(false); feed.inert = true;
    // Stops any swipe momentum while a sheet is open.
    feed.style.overflowY = 'hidden'; holdPosition();
    shell.classList.add('has-sheet'); scrim.hidden = false;
    sheet.setAttribute('aria-hidden', 'false'); updateUrl();
    sheet.querySelector<HTMLElement>('.lane-question')?.focus({ preventScroll: true });
  }
  function closeSheet() {
    if (!sheetOpen) return;
    sheetOpen = false; feed.inert = false; scrollTarget = null;
    feed.style.overflowY = ''; holdPosition();
    shell.classList.remove('has-sheet'); sheet.setAttribute('aria-hidden', 'true');
    updateUrl(); feed.focus({ preventScroll: true });
    window.setTimeout(() => { if (!sheetOpen) scrim.hidden = true; }, 420);
  }
  // An open check can't be dismissed silently: its header holds the options menu, not a close button.
  const header = (label: string, control: 'menu' | 'close' | 'none' = 'menu') => `<div class="lane-sheet-head"><span class="lane-round-label">LESSON ${lessonNumber(current().id)} <b>/</b> ${label}</span>${control === 'close' ? '<button class="lane-close" aria-label="Close quiz">×</button>' : control === 'menu' ? `<button class="lane-close lane-menu-open" data-menu aria-label="${copy.menuLabel}">${dots}</button>` : ''}</div>`;
  const action = (label: string, data: string, secondary = false) => `<button class="lane-sheet-action ui-button is-split${secondary ? ' secondary is-secondary' : ''}" ${data}>${label} <span aria-hidden="true">→</span></button>`;
  const keyAction = (secondary = true, then: 'question' | 'stage' = 'question') => learning()?.keySegment && current().video ? action(copy.keyPart, `data-key data-then="${then}"`, secondary) : current().video ? action(copy.rewatch, 'data-rewatch', secondary) : '';
  const showStage = (html: string) => {
    sheet.classList.remove('is-round-complete');
    content.innerHTML = html;
    sheet.scrollTop = 0;
    if (sheetOpen) content.querySelector<HTMLElement>('.lane-question')?.focus({ preventScroll: true });
  };
  function paintCheckpoints() {
    const count = questionIndex + (questionAnswered ? 1 : 0);
    const meter = content.querySelector<HTMLElement>('.lane-checkpoints');
    if (!meter) return;
    meter.setAttribute('aria-label', `${count} of ${questions().length} checks complete`);
    meter.innerHTML = questions().map((_, i) => `<span class="${i < count ? 'is-done' : i === count ? 'is-active' : ''}">${i < count ? check : `<b>${i + 1}</b>`}<small>${i < count ? 'DONE' : `CHECK ${i + 1}`}</small></span>`).join('');
  }
  function renderQuestion() {
    questionAnswered = false; questionMissed = false;
    const q = currentQuestion();
    const label = kind === 'similar' ? copy.similarLabel : kind === 'harder' ? copy.harderLabel : reviewing() ? copy.reviewLabel : 'QUICK CHECK';
    showStage(`${header(label, learning() ? 'menu' : 'close')}${kind === 'primary' && !reviewing() ? '<div class="lane-checkpoints"></div>' : ''}<h2 class="lane-question" tabindex="-1">${esc(q.question)}</h2><div class="lane-choices">${q.options.map((option, i) => `<button class="lane-choice" data-answer="${i}"><span class="lane-choice-key">${'ABCD'[i]}</span><span class="lane-choice-copy">${esc(option)}</span><span class="lane-choice-status" aria-hidden="true"></span></button>`).join('')}</div><div class="lane-feedback" role="status" aria-live="polite"></div><div class="lane-answer-action"></div>${learning()?.keySegment && current().video ? `<button class="lane-replay" data-key data-then="question">↻ ${copy.keyPart}</button>` : current().video ? '<button class="lane-replay" data-rewatch>↻ Replay this clip</button>' : ''}`);
    paintCheckpoints();
    questionShownAt = performance.now();
  }
  // Active recall: think first, then reveal and rate yourself. Used as the check on lower-stakes
  // lessons and repeat visits, and as a short reinforcement when the algorithm says "developing".
  function renderRecall(mode: 'check' | 'reinforce', revealed = false) {
    const card = learning()!.recall!;
    showStage(`${header(mode === 'reinforce' ? copy.reinforceLabel : copy.recallLabel, mode === 'check' ? 'menu' : 'none')}<h2 class="lane-question" tabindex="-1">${esc(card.front)}</h2>
      ${revealed ? `<div class="lane-feedback is-correct lane-recall-back" role="status"><span>${esc(card.back)}</span><small class="lane-source">${esc(card.source)}</small></div>${action(copy.gotIt, `data-recall-got data-mode="${mode}"`)}${action(copy.notYet, `data-recall-not data-mode="${mode}"`, true)}`
        : `<p class="lane-help-small">${copy.recallPrompt}</p>${action(copy.showAnswer, `data-recall-show data-mode="${mode}"`)}`}`);
    if (!revealed) questionShownAt = performance.now();
  }
  function renderGlossaryCheck() {
    const card = glossaryById(learning()?.glossary)!;
    showStage(`${header(copy.glossaryLabel, 'none')}<h2 class="lane-question" tabindex="-1">${esc(card.term)}</h2><div class="lane-help-copy"><p>${esc(card.definition)}</p><small class="lane-source">${esc(card.source)}</small></div>${action(copy.gotIt, 'data-glossary-got')}`);
    questionShownAt = performance.now();
  }
  function renderMenu() {
    const know = kind === 'primary' && !record(current().id)?.done;
    showStage(`${header(copy.menuTitle, 'none')}<h2 class="lane-question" tabindex="-1">${copy.menuPrompt}</h2><div class="lane-menu">
      ${know ? `<button class="lane-menu-item" data-know><b>${copy.knowIt}</b><small>${copy.knowItDetail}</small></button>` : ''}
      <button class="lane-menu-item" data-review-later><b>${copy.reviewLater}</b><small>${copy.reviewLaterDetail}</small></button>
      <button class="lane-menu-item" data-help><b>${copy.needHelp}</b><small>${copy.needHelpDetail}</small></button>
    </div>${action(copy.backToQuestion, 'data-back-to-question', true)}`);
  }
  const ruleText = () => { const clip = current(); return clip.lesson ? `<p>${esc(clip.lesson.californiaRule)}</p><small class="lane-source">${esc(clip.lesson.handbook)}</small>` : `<p>${esc(currentQuestion().explanation)}</p>`; };
  function renderHelp() {
    recordHelp(topic()); visit(current().id).openedHelp = true;
    const clip = current(), activity = learning()?.activity;
    showStage(`${header(copy.helpLabel, 'none')}<h2 class="lane-question" tabindex="-1">${esc(clip.title)}</h2><div class="lane-help-copy">${clip.lesson ? `<p>${esc(clip.lesson.summary)}</p>` : ''}${ruleText()}</div>
      ${action(copy.backToQuestion, 'data-back-to-question')}${keyAction(true, 'stage')}${activity ? action(copy.tryActivity, 'data-activity data-then="question"', true) : ''}`);
  }
  // A second miss (the "high need for instruction" band): the rule again, the lesson saved for
  // review, and one useful thing to do now: the key part, a decision activity, or the rule.
  function renderRecovery() {
    addReviewLater(current().id, topic(), 'missed');
    gatePassed.add(current().id);
    scoreVisit();
    const activity = learning()?.activity;
    showStage(`${header(copy.recoveryLabel, 'none')}<h2 class="lane-question" tabindex="-1">${copy.recoveryTitle}</h2><div class="lane-help-copy">${ruleText()}<p class="lane-help-small">${copy.recoveryQueued}</p></div>
      ${activity ? action(copy.tryActivity, 'data-activity data-then="next"') : ''}${keyAction(!!activity, 'question')}${action(copy.readRule, 'data-read-rule', true)}`);
  }
  function renderActivity() {
    const activity = learning()!.activity!, picked = activity.choices[activityPicked];
    visit(current().id).activityAssigned = true;
    showStage(`${header(copy.activityLabel, 'none')}<h2 class="lane-question" tabindex="-1">${esc(activity.prompt)}</h2><div class="lane-choices">${activity.choices.map((choice, i) => `<button class="lane-choice${i === activityPicked ? choice.safe ? ' is-right' : ' is-wrong' : ''}" data-choice="${i}"${picked ? ' disabled' : ''}><span class="lane-choice-copy">${esc(choice.label)}</span><span class="lane-choice-status" aria-hidden="true">${i === activityPicked ? choice.safe ? check : '×' : ''}</span></button>`).join('')}</div>
      ${picked ? `<div class="lane-feedback ${picked.safe ? 'is-correct' : 'is-retry'}" role="status"><strong>${picked.safe ? copy.safeChoice : copy.unsafeChoice}</strong><span>${esc(picked.feedback)}</span></div>${picked.safe ? action(copy.continueOn, 'data-activity-done') : action(copy.tryAgain, `data-activity data-then="${activityThen}"`)}` : ''}
      <p class="lane-help-small">${copy.source}: ${esc(citation(activity.source))}</p>`);
  }
  function openGate(targetIndex: number) {
    pendingTarget = targetIndex;
    // No scroll target, or the next real swipe would be ignored; openSheet snaps back to this card.
    scrollTarget = null;
    savedStage = '';
    const text = !!current().post;
    showStage(`${header(copy.gateLabel, 'none')}<h2 class="lane-question" tabindex="-1">${text ? copy.gateTitlePost : copy.gateTitle}</h2><div class="lane-help-copy"><p>${copy.gateDetail}</p></div>
      ${action(text ? copy.gateStayPost : copy.gateStay, 'data-gate-stay')}${action(copy.gateKnow, 'data-know data-from-gate', true)}${learning()?.keySegment && current().video ? action(copy.gateWatch, 'data-key data-then="question"', true) : ''}${action(copy.reviewLater, 'data-gate-later', true)}`);
    openSheet();
  }
  // The lesson's ending: the readiness goal (worded as on Home) and the streak from real totals, plus a
  // milestone only on the completion that earned it.
  function todaySummary() {
    const s = stats(), goal = goalReadiness(onboarding().goal, currentReadiness());
    const badge = earnedXP ? MILESTONES.find(milestone => milestone.count === lessonProgress(CLIPS, record).completed) : undefined;
    return `<section class="lane-today" aria-label="Today’s progress">
      <div class="lane-today-row"><span>${goal.title}</span><b>${esc(goal.value)}</b></div>
      <div class="lane-today-track" role="progressbar" aria-label="${goal.title}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${goal.score}"><span style="width:${goal.score}%"></span></div>
      ${s.streak ? `<div class="lane-today-chips"><span class="ui-chip is-accent">${flame}${s.streak}-day streak</span></div>` : ''}
    </section>${badge ? `<div class="lane-milestone"><span class="lane-milestone-icon">${trophy}</span><span><small>Milestone earned</small><b>${esc(badge.title)}</b></span></div>` : ''}`;
  }
  function nextPreview() {
    const upcoming = item(active + 1);
    if (!upcoming) return { label: 'View summary', html: `<p class="lane-result-copy">${copy.endSession(0)}</p>` };
    if (upcoming.kind === 'sim') {
      const entry = scenarioById(upcoming.id)!;
      return { label: copy.nextSim, html: `<div class="lane-next-mission"><span class="lane-practice-label">${copy.nextUp}</span><h3>${esc(entry.title)}</h3><p>${copy.simPitch}</p></div>` };
    }
    if (upcoming.kind === 'lesson') return { label: 'Next lesson', html: `<div class="lane-next-mission"><span class="lane-practice-label">${copy.nextUp}</span><h3>${esc(clipById(upcoming.id)!.title)}</h3></div>` };
    return { label: 'Continue', html: '' };
  }
  function renderComplete() {
    const clip = current();
    scoreVisit(); resolveReview(clip.id); completeFirstSession(); gatePassed.add(clip.id); checked.add(clip.id);
    sheet.classList.add('is-round-complete');
    const upcoming = nextPreview();
    const quizzed = checkKind === 'quiz';
    content.innerHTML = `${header('COMPLETE', 'close')}<div class="lane-clear-emblem ui-burst" aria-hidden="true"><div>${check}</div>${Array.from({ length: 8 }, (_, i) => `<i style="--ray:${i}"></i>`).join('')}</div><p class="lane-clear-kicker">${reviewing() || checkKind === 'glossary' ? 'REVIEW COMPLETE' : quizzed && firstTryCount === questions().length ? 'ALL CHECKS COMPLETE' : 'LESSON COMPLETE'}</p><h2 class="lane-result" tabindex="-1">${reviewing() || checkKind === 'glossary' ? 'Nice refresher.' : 'Lesson complete.'}</h2><div class="lane-round-stats"><div><strong>${earnedXP ? `+${earnedXP}` : '✓'}<small>${earnedXP ? ' XP' : ''}</small></strong><span>${earnedXP ? 'XP EARNED' : record(clip.id)?.done ? 'ALREADY EARNED' : 'SAVED'}</span></div>${quizzed ? `<div><strong>${firstTryCount}<small> / ${questions().length}</small></strong><span>RIGHT FIRST TRY</span></div>` : ''}</div>${todaySummary()}${upcoming.html}<button class="lane-sheet-action ui-button is-split" data-next>${upcoming.label} <span aria-hidden="true">→</span></button>`;
    sheet.scrollTop = 0;
    content.querySelector<HTMLElement>('.lane-result')?.focus({ preventScroll: true });
    paintEnd();
  }
  // After a correct finish, the session score decides: strong → done; developing → one quick recall.
  function finishLesson() {
    const mastery = scoreVisit();
    if (checkKind === 'quiz' && mastery !== null && masteryBand(mastery) === 'developing' && learning()?.recall) { renderRecall('reinforce'); return; }
    renderComplete();
  }
  // The current sentence shows its blank and choices; finished sentences show the filled word and why.
  function renderPost() {
    const clip = current(), post = clip.post!, filled = postFilled.get(clip.id) ?? (record(clip.id)?.done ? post.steps.length : 0);
    postFilled.set(clip.id, filled);
    panel().querySelector('[data-post-steps]')!.innerHTML = post.steps.slice(0, filled + 1).map((step, i) => i < filled
      ? `<li class="is-filled"><p>${esc(step.before)}<b>${esc(step.choices[step.answer])}</b>${esc(step.after)}</p><small>${esc(step.why)}</small></li>`
      : `<li class="is-current"><p>${esc(step.before)}<span class="lane-blank" aria-label="blank">${'\u2002'.repeat(6)}</span>${esc(step.after)}</p><div class="lane-post-choices">${step.choices.map((choice, c) => `<button class="lane-chip" data-post-choice="${c}">${esc(choice)}</button>`).join('')}</div></li>`).join('');
    panel().querySelector('[data-post-status]')!.textContent = filled >= post.steps.length ? copy.postDone : '';
  }
  function choosePost(choice: number, button: HTMLButtonElement) {
    const clip = current(), post = clip.post!, filled = postFilled.get(clip.id) ?? 0, step = post.steps[filled];
    if (!step) return;
    if (choice !== step.answer) {
      postMisses.set(clip.id, (postMisses.get(clip.id) ?? 0) + 1);
      button.classList.add('is-wrong'); button.disabled = true;
      panel().querySelector('[data-post-status]')!.textContent = copy.postTryAgain;
      return;
    }
    postFilled.set(clip.id, filled + 1);
    renderPost();
    // Every blank filled: the lesson's check comes next.
    if (filled + 1 >= post.steps.length && !checked.has(clip.id)) window.setTimeout(() => { if (isLesson() && current().id === clip.id) finishClip(); }, 900);
  }
  function finishClip() {
    if (sheetOpen || !isLesson()) return;
    const media = video();
    if (media) { media.pause(); cacheWatched(media); saveWatch(active, true); }
    elapsed = DEMO_SECONDS; keyStop = null;
    setPlaying(false); paintTime();
    openCheck();
  }
  function openCheck() {
    const clip = current();
    checked.add(clip.id);
    questionIndex = 0; firstTryCount = 0; earnedXP = 0; kind = 'primary';
    checkKind = checkKindFor(clip.id);
    if (checkKind === 'recall' && learning()?.recall) renderRecall('check');
    else if (checkKind === 'glossary' && glossaryById(learning()?.glossary)) renderGlossaryCheck();
    else { if (checkKind !== 'review-quiz') checkKind = 'quiz'; renderQuestion(); }
    openSheet();
  }
  function choose(index: number) {
    if (questionAnswered) return;
    questionAnswered = true;
    const clip = current(), q = currentQuestion(), entry = visit(clip.id);
    const button = content.querySelector<HTMLButtonElement>(`[data-answer="${index}"]`)!;
    const feedback = content.querySelector<HTMLElement>('.lane-feedback')!;
    const correct = index === q.answer;
    const activeMs = performance.now() - questionShownAt;
    const wasComplete = record(clip.id)?.done;
    // "I already know this" proves the whole lesson; otherwise the last check completes it.
    const finishing = kind === 'harder' || questionIndex === questions().length - 1;
    answer(clip.id, correct, correct && finishing);
    const attemptKind: AttemptKind = reviewing() && kind === 'primary' ? 'review' : kind === 'primary' ? (questionIndex ? 'followUp' : 'primary') : kind;
    recordAttempt({ itemId: clip.id, topicId: topic(), kind: attemptKind, correct, activeMs });
    if (entry.firstCorrect === null) { entry.firstCorrect = correct; entry.firstAnswerMs = activeMs; }
    if (kind === 'similar') entry.correctionCorrect = correct;
    content.querySelectorAll<HTMLButtonElement>('[data-answer]').forEach(choice => { choice.disabled = true; });
    const answerAction = content.querySelector<HTMLElement>('.lane-answer-action')!;
    if (!correct) {
      questionMissed = true; button.classList.add('is-wrong');
      button.querySelector('.lane-choice-status')!.textContent = '×';
      if (kind === 'similar' || !learning()) { renderRecovery(); return; }
      feedback.className = 'lane-feedback is-retry';
      feedback.innerHTML = `<strong>${copy.almost}</strong><span>${esc(q.explanation)}</span>${q.source ? `<small class="lane-source">${esc(q.source)}</small>` : ''}`;
      // A similar, not identical, question follows the explanation; a missed harder check returns to the lesson check.
      answerAction.innerHTML = kind === 'harder' ? action(copy.backToCheck, 'data-back-to-check') : action(copy.trySimilar, 'data-similar');
    } else {
      if (!questionMissed && kind === 'primary') firstTryCount++;
      if (!wasComplete && record(clip.id)?.done) earnedXP = XP_PER_CLIP;
      button.classList.add('is-right');
      button.querySelector('.lane-choice-status')!.innerHTML = check;
      paintCheckpoints();
      const title = kind === 'harder' ? copy.provedIt : kind === 'similar' ? 'Nice recovery.' : 'Nailed it.';
      const tag = kind === 'harder' ? 'SKIP EARNED' : kind === 'similar' ? 'CHECK CLEARED' : 'FIRST TRY';
      feedback.className = 'lane-feedback is-correct';
      feedback.innerHTML = `<strong>${title}<small>${tag}</small>${earnedXP ? `<span class="lane-xp-pop ui-chip is-accent">+${earnedXP} XP</span>` : ''}</strong><span>${esc(q.explanation)}</span>${q.source ? `<small class="lane-source">${esc(q.source)}</small>` : ''}`;
      answerAction.innerHTML = action(finishing ? 'Finish lesson' : 'Next check', `data-continue${finishing ? ' data-finish' : ''}`);
    }
    answerAction.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    // Scroll only the sheet: scrollIntoView can also shift the paused feed beneath it.
    sheet.scrollTop = Math.max(0, answerAction.offsetTop + answerAction.offsetHeight - sheet.clientHeight + 20);
  }
  function recall(got: boolean, mode: 'check' | 'reinforce') {
    const clip = current(), entry = visit(clip.id);
    const wasComplete = record(clip.id)?.done;
    recordAttempt({ itemId: clip.id, topicId: topic(), kind: 'recall', correct: got, activeMs: performance.now() - questionShownAt });
    if (mode === 'reinforce') { if (!got) addReviewLater(clip.id, topic(), 'missed'); renderComplete(); return; }
    if (entry.firstCorrect === null) { entry.firstCorrect = got; entry.firstAnswerMs = performance.now() - questionShownAt; }
    if (got) {
      // On a first visit the flashcard is the lesson's check, so remembering it completes the lesson.
      answer(clip.id, true, true);
      if (!wasComplete && record(clip.id)?.done) earnedXP = XP_PER_CLIP;
      renderComplete();
      return;
    }
    addReviewLater(clip.id, topic(), 'missed');
    showStage(`${header(copy.recallLabel, 'none')}<h2 class="lane-question" tabindex="-1">${copy.notYetTitle}</h2><div class="lane-help-copy">${ruleText()}<p class="lane-help-small">${copy.recoveryQueued}</p></div>
      ${action(copy.takeQuiz, 'data-take-quiz')}${keyAction(true, 'stage')}${action(copy.readRule, 'data-read-rule', true)}`);
  }
  // A lesson saved for later also defers its challenge: practice comes after the quiz, not instead of it.
  // Review later also turns on the lesson's bookmark, so it shows as saved everywhere.
  function saveForLater(id: string) {
    markSaved(id);
    const button = panel().querySelector<HTMLButtonElement>(`[data-save="${id}"]`);
    if (button) { button.setAttribute('aria-pressed', 'true'); button.setAttribute('aria-label', 'Unsave lesson'); }
  }
  function pastOwnSim(index: number) {
    const following = item(index);
    return following?.kind === 'sim' && isLesson() && following.lessonId === current().id ? index + 1 : index;
  }
  function next(skipOwnSim = false) {
    closeSheet();
    const destination = skipOwnSim ? pastOwnSim(active + 1) : active + 1;
    if (item(destination)) setActive(destination);
    else { endCard.inert = false; feed.scrollTo({ top: track.scrollHeight, behavior: 'smooth' }); }
  }
  function replay() {
    closeSheet(); elapsed = 0; keyStop = null;
    const media = video();
    if (media) media.currentTime = 0;
    setPlaying(true);
  }
  function playKeyPart(then: 'question' | 'stage') {
    const segment = learning()?.keySegment, media = video();
    if (!segment || !media) { replay(); return; }
    if (then === 'stage') savedStage = content.innerHTML;
    afterKey = then;
    closeSheet();
    media.currentTime = segment.start;
    keyStop = segment.end;
    setPlaying(true);
    announce('Playing the important part');
  }
  function keyPartDone() {
    keyStop = null;
    setPlaying(false); paintTime();
    if (afterKey === 'stage' && savedStage) { content.innerHTML = savedStage; openSheet(); content.querySelector<HTMLElement>('.lane-question')?.focus({ preventScroll: true }); }
    else { checked.add(current().id); kind = 'primary'; questionIndex = 0; if (checkKind !== 'review-quiz') checkKind = 'quiz'; renderQuestion(); openSheet(); }
  }
  // Simulations run inside their feed card. The package draws its own countdown, choices, Retry,
  // Continue and Exit; the feed records results and returns to the same place.
  function startSim() {
    const entry = item();
    if (entry?.kind !== 'sim' || simHandle) return;
    const scenario = scenarioById(entry.id)!;
    const card = panel(), stage = card.querySelector<HTMLElement>('[data-sim-stage]')!, body = card.querySelector<HTMLElement>('[data-sim-body]')!;
    const status = card.querySelector<HTMLElement>('.lane-card-status')!;
    const finish = (outcome: 'continue' | 'exit') => {
      simHandle?.destroy(); simHandle = null; simLeave = null;
      stage.innerHTML = ''; stage.hidden = true; body.hidden = false;
      shell.classList.remove('is-sim-active');
      status.textContent = outcome === 'continue' ? copy.simDone : copy.simSaved;
      if (outcome === 'continue') next();
    };
    const callbacks = scenarioCallbacks(scenario, recordSimulation, { continued: () => finish('continue'), exited: () => finish('exit') });
    simLeave = callbacks.leave;
    body.hidden = true; stage.hidden = false;
    shell.classList.add('is-sim-active');
    simHandle = { destroy() {} };
    scenario.load()
      .then(module => { if (simLeave === callbacks.leave) simHandle = module.startScenario(stage, callbacks); })
      .catch(error => {
        console.error('Simulation failed to load', error);
        if (simLeave !== callbacks.leave) return;
        simHandle = null; simLeave = null; shell.classList.remove('is-sim-active');
        stage.hidden = true; body.hidden = false;
        status.textContent = `${copy.simUnavailable} ${scenario.fallback}`;
      });
  }
  function rateCard(got: boolean) {
    const entry = item();
    if (entry?.kind !== 'card') return;
    const card = CONTENT_CARDS.find(candidate => candidate.id === entry.id)!;
    recordAttempt({ itemId: card.id, topicId: card.topicId, kind: card.kind === 'glossary' ? 'glossary' : 'recall', correct: got, activeMs: 0 });
    if (!got) addReviewLater(card.id, card.topicId, 'missed');
    panel().querySelectorAll<HTMLButtonElement>('[data-card-got],[data-card-not]').forEach(button => { button.disabled = true; });
    panel().querySelector('.lane-card-status')!.textContent = got ? 'Saved. Keep scrolling.' : copy.savedForReview;
  }
  function paintEnd() {
    root.querySelector('[data-end-done]')!.textContent = `${lessonProgress(CLIPS, record).completed} of ${CLIPS.length} lessons completed.`;
    root.querySelector('[data-end-time]')!.textContent = copy.endSession(Math.floor(sessionTimer.tick(performance.now(), !document.hidden) / 60));
  }
  feed.addEventListener('scroll', () => {
    if (sheetOpen) { if (Math.abs(feed.scrollTop - panel().offsetTop) > 1) holdPosition(); return; }
    if (scrollTarget !== null) {
      if (Math.abs(feed.scrollTop - panels[scrollTarget].offsetTop) > 1) return;
      scrollTarget = null;
    }
    const index = Math.round(feed.scrollTop / panels[0].offsetHeight);
    if (index >= items.length) { paintEnd(); if (isLesson() && needsGate()) openGate(active); else endCard.inert = false; return; }
    if (index !== active) setActive(index, false);
  }, { signal: controller.signal, passive: true });
  for (const event of ['pointerdown', 'wheel']) feed.addEventListener(event, () => { scrollTarget = null; }, { signal: controller.signal, passive: true });
  root.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const target = event.target;
    const mode = (target.closest<HTMLElement>('[data-mode]')?.dataset.mode ?? 'check') as 'check' | 'reinforce';
    if (target.closest('[data-answer]')) { choose(Number(target.closest<HTMLElement>('[data-answer]')!.dataset.answer)); return; }
    if (target.closest('[data-continue]')) {
      if (target.closest('[data-finish]')) finishLesson(); else { questionIndex++; kind = 'primary'; renderQuestion(); }
      return;
    }
    if (target.closest('[data-recall-show]')) { renderRecall(mode, true); return; }
    if (target.closest('[data-recall-got]')) { recall(true, mode); return; }
    if (target.closest('[data-recall-not]')) { recall(false, mode); return; }
    if (target.closest('[data-glossary-got]')) {
      const entry = visit(current().id);
      if (entry.firstCorrect === null) { entry.firstCorrect = true; entry.firstAnswerMs = performance.now() - questionShownAt; }
      recordAttempt({ itemId: current().id, topicId: topic(), kind: 'glossary', correct: true, activeMs: performance.now() - questionShownAt });
      renderComplete(); return;
    }
    if (target.closest('[data-take-quiz]')) { kind = 'primary'; questionIndex = 0; checkKind = 'quiz'; renderQuestion(); return; }
    if (target.closest('[data-similar]')) { visit(current().id).correctionAssigned = true; kind = 'similar'; renderQuestion(); return; }
    if (target.closest('[data-back-to-check]')) { kind = 'primary'; questionIndex = 0; renderQuestion(); return; }
    if (target.closest('[data-menu]')) { savedStage = content.innerHTML; renderMenu(); return; }
    if (target.closest('[data-know]')) {
      if (target.closest('[data-from-gate]')) { gatePassed.add(current().id); checked.add(current().id); pendingTarget = null; checkKind = 'quiz'; }
      kind = 'harder'; renderQuestion(); return;
    }
    if (target.closest('[data-help]')) { renderHelp(); return; }
    // Returns to the exact state the learner left, so the menu never resets an answered question.
    if (target.closest('[data-back-to-question]')) { content.innerHTML = savedStage; content.querySelector<HTMLElement>('.lane-question')?.focus({ preventScroll: true }); return; }
    if (target.closest('[data-review-later]')) { addReviewLater(current().id, topic(), 'menu'); saveForLater(current().id); gatePassed.add(current().id); announce(copy.savedForReview); next(true); return; }
    const activityStart = target.closest<HTMLElement>('[data-activity]');
    if (activityStart) { activityThen = activityStart.dataset.then === 'next' ? 'next' : 'question'; activityPicked = -1; renderActivity(); return; }
    const activityChoice = target.closest<HTMLElement>('[data-choice]');
    if (activityChoice) { activityPicked = Number(activityChoice.dataset.choice); renderActivity(); return; }
    if (target.closest('[data-activity-done]')) {
      visit(current().id).activityCompleted = true;
      if (activityThen === 'next') next(); else { content.innerHTML = savedStage; content.querySelector<HTMLElement>('.lane-question')?.focus({ preventScroll: true }); }
      return;
    }
    if (target.closest('[data-read-rule]')) { next(); return; }
    if (target.closest('[data-gate-stay]')) { pendingTarget = null; closeSheet(); if (!current().post) setPlaying(true); return; }
    if (target.closest('[data-gate-later]')) {
      addReviewLater(current().id, topic(), 'skip'); saveForLater(current().id); gatePassed.add(current().id);
      announce(copy.savedForReview);
      const destination = pastOwnSim(pendingTarget ?? active + 1); pendingTarget = null;
      closeSheet();
      if (destination >= items.length) { endCard.inert = false; feed.scrollTo({ top: track.scrollHeight, behavior: 'smooth' }); paintEnd(); } else setActive(destination);
      return;
    }
    const keyButton = target.closest<HTMLElement>('[data-key]');
    if (keyButton) { if (pendingTarget !== null) { gatePassed.add(current().id); pendingTarget = null; } playKeyPart(keyButton.dataset.then === 'stage' ? 'stage' : 'question'); return; }
    if (target.closest('[data-next]')) { next(); return; }
    if (target.closest('[data-rewatch]')) { pendingTarget = null; replay(); return; }
    if (target.closest('[data-sound]')) {
      const media = video(), muted = media ? !media.muted : !soundOff();
      soundChanges++;
      setSoundOff(muted);
      if (media) { media.muted = muted; if (!muted && playing) void media.play().catch(() => {}); }
      paintSound(); announce(muted ? 'Sound off' : 'Sound on'); return;
    }
    const postChoice = target.closest<HTMLButtonElement>('[data-post-choice]');
    if (postChoice) { choosePost(Number(postChoice.dataset.postChoice), postChoice); return; }
    if (target.closest('[data-sim-start]')) { startSim(); return; }
    if (target.closest('[data-sim-skip]')) { next(); return; }
    if (target.closest('[data-card-reveal]')) {
      panel().querySelector<HTMLElement>('[data-card-answer]')!.hidden = false;
      panel().querySelector<HTMLElement>('[data-card-reveal-row]')!.hidden = true;
      panel().querySelector<HTMLElement>('[data-card-rate]')!.hidden = false;
      return;
    }
    if (target.closest('[data-card-got]')) { rateCard(true); return; }
    if (target.closest('[data-card-not]')) { rateCard(false); return; }
    if (target.closest('.lane-close, .lane-scrim')) { if (dismissable()) closeSheet(); return; }
    const commentButton = target.closest<HTMLButtonElement>('[data-comments]');
    if (commentButton) { resumeAfterComments = playing; setPlaying(false); comments.open(commentButton.dataset.comments!); return; }
    const aboutButton = target.closest<HTMLButtonElement>('[data-about]');
    if (aboutButton) { const clip = clipById(aboutButton.dataset.about); if (clip) openAbout(clip); return; }
    if (target === about) { about.close(); return; }
    const playback = target.closest<HTMLButtonElement>('[data-play]');
    const expandedRule = isLesson() ? panel().querySelector<HTMLDetailsElement>('.lane-rule[open]') : null;
    if (playback && expandedRule) { expandedRule.open = false; return; }
    if (playback && playing && video()?.muted) { setPlaying(true); return; }
    if (playback) {
      // A finished clip opens its check if it hasn't been answered yet; otherwise it plays again.
      if (!playing && !videoUnfinished()) { if (!checked.has(current().id)) openCheck(); else replay(); return; }
      setPlaying(!playing); return;
    }
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
  root.addEventListener('ended', event => { if (event.target === video()) { if (keyStop !== null && afterKey === 'stage') keyPartDone(); else finishClip(); } }, { signal: controller.signal, capture: true });
  root.addEventListener('timeupdate', event => {
    const media = video();
    if (!media || event.target !== media) return;
    paintTime();
    if (keyStop !== null && media.currentTime >= keyStop) keyPartDone();
  }, { signal: controller.signal, capture: true });
  // A preloading neighbor that fails releases its source and is retried after the next swipe. Only
  // the clip on screen falls back to its timed poster when its file can't play.
  root.addEventListener('error', event => {
    const media = event.target;
    if (!(media instanceof HTMLVideoElement) || !media.hasAttribute('src')) return;
    const entry = media.closest('.lane-clip')!;
    media.removeAttribute('src');
    if (entry !== panel()) { failedPreloads.add(media); return; }
    entry.classList.remove('has-video', 'is-loading');
    elapsed = 0;
    paintPreload();
    setPlaying(true);
    announce('Video unavailable. Playing the lesson preview.');
  }, { signal: controller.signal, capture: true });
  for (const type of ['waiting', 'playing', 'canplay', 'pause', 'emptied', 'loadedmetadata', 'volumechange']) root.addEventListener(type, event => { if (event.target === video()) { paintLoading(); paintTime(); paintSound(); } }, { signal: controller.signal, capture: true });
  root.addEventListener('canplay', event => { if (event.target === video()) paintPreload(); }, { signal: controller.signal, capture: true });
  commentsDialog.addEventListener('close', () => { if (resumeAfterComments && !sheetOpen && !about.open) setPlaying(true); resumeAfterComments = false; feed.focus({ preventScroll: true }); }, { signal: controller.signal });
  about.addEventListener('close', () => { if (resumeAfterAbout && !sheetOpen) setPlaying(true); resumeAfterAbout = false; feed.focus({ preventScroll: true }); }, { signal: controller.signal });
  root.addEventListener('keydown', event => {
    if (about.open || commentsDialog.open) return;
    if (event.key === 'Escape' && sheetOpen) {
      if (dismissable()) closeSheet();
      else if (content.querySelector('[data-menu]')) { savedStage = content.innerHTML; renderMenu(); }
      return;
    }
    if (sheetOpen) {
      if (event.key === 'Tab') {
        const buttons = [...sheet.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')];
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
      return;
    }
    if (simHandle || (event.target instanceof Element && event.target.closest('.lane-rule'))) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive(active + (event.key === 'ArrowDown' ? 1 : -1)); }
  }, { signal: controller.signal });
  document.addEventListener('visibilitychange', () => { sessionTimer.tick(performance.now(), false); if (document.hidden) { video()?.pause(); lastTick = performance.now(); } else if (playing && !sheetOpen) setPlaying(true); }, { signal: controller.signal });
  // Poster lessons (no video) play for a fixed time, then their check opens.
  const ticker = window.setInterval(() => {
    const now = performance.now(), delta = Math.min((now - lastTick) / 1000, .2);
    lastTick = now;
    sessionTimer.tick(now, !document.hidden);
    if (isLesson() && !current().post && playing && !sheetOpen && !document.hidden && !video() && elapsed < DEMO_SECONDS) { elapsed = Math.min(DEMO_SECONDS, elapsed + delta); paintTime(); if (elapsed >= DEMO_SECONDS) finishClip(); }
  }, 100);
  setActive(0, false); feed.scrollTop = panel().offsetTop; paintEnd();
  if (target.quiz && isLesson()) openCheck();
  return { dispose() {
    if (isLesson()) saveWatch(active);
    // Leaving the feed during a running simulation counts as its Exit.
    simLeave?.(); simHandle?.destroy();
    controller.abort(); if (about.open) about.close(); if (commentsDialog.open) commentsDialog.close(); clearInterval(ticker); clearTimeout(toastTimeout); clearTimeout(loadingTimeout); clearTimeout(snapTimer); cancelAnimationFrame(snapFrame);
    // Detached videos can keep downloading, so leaving the feed releases every source.
    panels.forEach(entry => { const media = entry.querySelector('video'); if (media?.hasAttribute('src')) { media.pause(); media.removeAttribute('src'); media.load(); } });
  } };
}
