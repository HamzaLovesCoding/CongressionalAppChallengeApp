import { CLIPS, clipById, nextClip, type Clip } from './clips';
import { answer, marked, record, stats, toggleMark, XP_PER_CLIP } from './progress';
import { preloadDrive } from '../drive';
import { go, type View } from '../navigation';

const DEMO_SECONDS = 8;
const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const bookmark = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>';
const pause = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>';
const play = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg>';
const check = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
const roundNumber = (index: number) => String(index + 1).padStart(2, '0');
function runHud(index: number) {
  const s = stats();
  return `<div class="lane-run-score"><span>ROUND ${roundNumber(index)}</span><span>${s.streak ? `${s.streak} DAY STREAK` : 'LET’S GET ROLLING'}</span><strong>${s.xpTotal} XP</strong></div><div class="lane-run-track" aria-label="${s.done} of ${CLIPS.length} rounds cleared">${CLIPS.map((clip, i) => `<i class="${record(clip.id)?.done ? 'is-cleared' : i === index ? 'is-active' : ''}"></i>`).join('')}</div>`;
}
function clipHtml(clip: Clip, index: number) {
  const { lines, caption, background, foreground } = clip.poster;
  return `<article class="lane-clip" data-clip="${clip.id}" style="--clip-bg:${background};--clip-fg:${foreground}" aria-label="Lesson ${index + 1}: ${esc(clip.title)}">
    <video class="lane-video" ${clip.video ? `src="${esc(clip.video)}"` : ''} playsinline muted preload="metadata" aria-label="${esc(clip.title)}"></video>
    <div class="lane-poster" aria-hidden="true"><span class="lane-poster-label">${clip.video ? 'VIDEO LESSON' : 'DEMO CLIP / 08 SEC'}</span><strong class="lane-poster-title">${lines.map(line => `<span>${esc(line)}</span>`).join('')}</strong><span class="lane-poster-rule"></span><span class="lane-poster-caption">${esc(caption)}</span></div>
    <div class="lane-top"><span class="lane-wordmark">lane</span><span class="lane-for-you">Your run</span><a class="lane-position" href="#/progress" aria-label="Your progress">${roundNumber(index)} / ${String(CLIPS.length).padStart(2, '0')} ↗</a></div>
    <div class="lane-run-hud">${runHud(index)}</div>
    <div class="lane-meta"><span>${esc(clip.topic.toUpperCase())}</span><h2>${esc(clip.title)}</h2><div class="lane-stage-path" aria-label="Watch, quick check${clip.simulator ? ', driving practice' : ''}"><span class="is-active"><i>01</i> WATCH</span><b>→</b><span><i>02</i> CHECK</span>${clip.simulator ? '<b>→</b><span><i>03</i> DRIVE</span>' : ''}</div></div>
    <div class="lane-rail"><button class="lane-icon" data-save="${clip.id}" aria-label="Save lesson" aria-pressed="${marked('saved', clip.id)}">${bookmark}<small>Save</small></button><button class="lane-icon" data-share="${clip.id}" aria-label="Share lesson"><span class="lane-share" aria-hidden="true">↗</span><small>Share</small></button></div>
    <div class="lane-controls"><button class="lane-icon lane-play" data-play="${clip.id}" aria-label="Pause clip">${pause}</button><span class="lane-time">00:00 / 00:08</span><span>SWIPE UP</span></div>
    <div class="lane-progress"><span></span></div>
  </article>`;
}

export function mountFeed(root: HTMLElement, target?: { id: string; quiz: boolean }): View {
  const initial = Math.max(0, CLIPS.findIndex(clip => clip.id === target?.id));
  const { done } = stats();
  root.innerHTML = `<main class="rl lane-shell">
    <h1 class="rl-visually-hidden">Lane driving lessons</h1>
    <div class="lane-feed" tabindex="0" aria-label="Vertical video lessons"><div class="lane-track">${CLIPS.map(clipHtml).join('')}<section class="lane-end"><span>ALL CAUGHT UP</span><h2>Keep your eyes on the road.</h2><p>${done} of ${CLIPS.length} lessons completed.</p><a href="#/progress">See your progress</a></section></div></div>
    <div class="lane-scrim" hidden></div><section class="lane-sheet" role="dialog" aria-modal="true" aria-label="Quick check" aria-hidden="true"><div class="lane-sheet-grab"></div><div class="lane-sheet-content"></div></section>
    <div class="lane-toast" role="status" aria-live="polite"></div>
  </main>`;
  const shell = root.querySelector<HTMLElement>('.lane-shell')!;
  const feed = root.querySelector<HTMLElement>('.lane-feed')!;
  const track = root.querySelector<HTMLElement>('.lane-track')!;
  const panels = [...root.querySelectorAll<HTMLElement>('.lane-clip')];
  const sheet = root.querySelector<HTMLElement>('.lane-sheet')!;
  const content = root.querySelector<HTMLElement>('.lane-sheet-content')!;
  const scrim = root.querySelector<HTMLElement>('.lane-scrim')!;
  const toast = root.querySelector<HTMLElement>('.lane-toast')!;
  const controller = new AbortController();
  let active = initial, questionIndex = 0, questionAnswered = false, sheetOpen = false;
  let questionMissed = false, firstTryCount = 0, earnedXP = 0;
  let scrollTarget: number | null = null;
  let playing = true, elapsed = 0, lastTick = performance.now(), toastTimeout = 0;
  const current = () => CLIPS[active];
  const panel = () => panels[active];
  const video = () => {
    const media = panel().querySelector<HTMLVideoElement>('video');
    return media?.hasAttribute('src') ? media : null;
  };
  const questions = () => {
    const clip = current();
    return [{ question: clip.question, options: clip.options, answer: clip.answer, explanation: clip.explanation }, ...(clip.followUp ? [clip.followUp] : [])];
  };
  const updateUrl = () => history.replaceState(null, '', `#/feed/${current().id}${sheetOpen ? '/quiz' : ''}`);
  const announce = (message: string) => { toast.textContent = message; toast.classList.add('is-visible'); clearTimeout(toastTimeout); toastTimeout = window.setTimeout(() => toast.classList.remove('is-visible'), 1800); };

  function paintPlayback() {
    const button = panel().querySelector<HTMLButtonElement>('[data-play]')!;
    button.innerHTML = playing ? pause : play;
    button.setAttribute('aria-label', playing ? 'Pause clip' : elapsed >= DEMO_SECONDS ? 'Replay clip' : 'Play clip');
  }
  function setPlaying(value: boolean) {
    playing = value;
    const media = video();
    if (media) {
      if (value) void media.play().catch(() => {
        if (media.hasAttribute('src')) { playing = false; paintPlayback(); }
        else setPlaying(true);
      });
      else media.pause();
    }
    paintPlayback();
  }
  function setActive(index: number, scroll = true) {
    const next = Math.max(0, Math.min(CLIPS.length - 1, index));
    if (next !== active) video()?.pause();
    active = next; elapsed = 0; questionIndex = 0; firstTryCount = 0; earnedXP = 0;
    panels.forEach((item, i) => { item.classList.toggle('is-current', i === active); item.inert = i !== active; });
    if (scroll) {
      scrollTarget = active;
      feed.scrollTo({ top: panel().offsetTop, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
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
  const header = (label: string) => `<div class="lane-sheet-head"><span class="lane-round-label">ROUND ${roundNumber(active)} <b>/</b> ${label}</span><button class="lane-close" aria-label="Close quiz">×</button></div>`;
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
  function renderComplete() {
    const clip = current();
    sheet.classList.add('is-round-complete');
    content.innerHTML = `${header('COMPLETE')}<div class="lane-clear-emblem" aria-hidden="true"><div>${check}</div>${Array.from({ length: 8 }, (_, i) => `<i style="--ray:${i}"></i>`).join('')}</div><p class="lane-clear-kicker">${firstTryCount === questions().length ? 'CLEAN RUN' : 'WAY TO STICK WITH IT'}</p><h2 class="lane-result" tabindex="-1">Round cleared.</h2><div class="lane-round-stats"><div><strong>${earnedXP ? `+${earnedXP}` : '✓'}<small>${earnedXP ? ' XP' : ''}</small></strong><span>${earnedXP ? 'ADDED TO YOUR RUN' : 'PRACTICE COMPLETE'}</span></div><div><strong>${firstTryCount}<small> / ${questions().length}</small></strong><span>RIGHT FIRST TRY</span></div></div>${clip.simulator ? '<div class="lane-next-mission"><span class="lane-practice-label">NEXT CHECKPOINT / DRIVE</span><h3>Take the wheel.</h3><p>Put that yellow-light decision into practice.</p></div><button class="lane-sheet-action" data-drive>Start driving practice <span aria-hidden="true">↗</span></button><button class="lane-sheet-action secondary" data-next>Next round <span aria-hidden="true">→</span></button>' : `<p class="lane-result-copy">${nextClip(clip.id) ? 'One more road skill in your pocket.' : 'You’ve reached the end of this route.'}</p><button class="lane-sheet-action" data-next>${nextClip(clip.id) ? 'Next round' : 'See your run'} <span aria-hidden="true">→</span></button>`}`;
    sheet.scrollTop = 0;
    content.querySelector<HTMLElement>('.lane-result')?.focus({ preventScroll: true });
  }
  function finishClip() {
    if (sheetOpen) return;
    const media = video();
    if (media) media.pause();
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
    feedback.innerHTML = `<strong>${questionMissed ? 'Nice recovery.' : 'Nailed it.'}<small>${questionMissed ? 'CHECK CLEARED' : 'FIRST TRY'}</small></strong><span>${esc(q.explanation)}</span>`;
    const more = questionIndex < questions().length - 1;
    content.querySelector<HTMLElement>('.lane-answer-action')!.innerHTML = `<button class="lane-sheet-action" data-continue>${more ? 'Next check' : 'Finish round'} <span aria-hidden="true">→</span></button>`;
    panels.forEach((item, i) => { item.querySelector('.lane-run-hud')!.innerHTML = runHud(i); });
    root.querySelector('.lane-end p')!.textContent = `${stats().done} of ${CLIPS.length} rounds cleared.`;
    content.querySelector<HTMLButtonElement>('[data-continue]')?.focus({ preventScroll: true });
    // Scroll only the sheet: scrollIntoView can also shift the paused feed beneath it.
    const action = content.querySelector<HTMLElement>('.lane-answer-action')!;
    sheet.scrollTop = Math.max(0, action.offsetTop + action.offsetHeight - sheet.clientHeight + 20);
    if (!more && current().simulator) void preloadDrive();
  }
  function next() {
    closeSheet();
    if (nextClip(current().id)) { setActive(active + 1); announce(`Round ${roundNumber(active)} · Let’s go`); }
    else { feed.scrollTo({ top: track.scrollHeight, behavior: 'smooth' }); go('#/progress'); }
  }
  function replay() {
    closeSheet(); elapsed = 0;
    const media = video();
    if (media) media.currentTime = 0;
    setPlaying(true);
  }
  function updateProgress() {
    const media = video();
    const duration = media && Number.isFinite(media.duration) && media.duration > 0 ? media.duration : DEMO_SECONDS;
    const time = media ? media.currentTime : elapsed;
    panel().querySelector<HTMLElement>('.lane-progress span')!.style.transform = `scaleX(${Math.min(1, time / duration)})`;
    panel().querySelector<HTMLElement>('.lane-time')!.textContent = `${clock(time)} / ${clock(duration)}`;
  }
  feed.addEventListener('scroll', () => {
    if (sheetOpen) return;
    // Intermediate frames of a "Next round" animation are not a new round selection.
    if (scrollTarget !== null) {
      if (Math.abs(feed.scrollTop - panels[scrollTarget].offsetTop) > 1) return;
      scrollTarget = null;
    }
    const index = Math.round(feed.scrollTop / feed.clientHeight);
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
    const playback = target.closest<HTMLButtonElement>('[data-play]');
    if (playback) { if (!playing && elapsed >= DEMO_SECONDS) replay(); else setPlaying(!playing); return; }
    const save = target.closest<HTMLButtonElement>('[data-save]');
    if (save) { const on = toggleMark('saved', save.dataset.save!); save.setAttribute('aria-pressed', String(on)); save.setAttribute('aria-label', on ? 'Unsave lesson' : 'Save lesson'); announce(on ? 'Saved for later' : 'Removed from saved'); return; }
    const share = target.closest<HTMLButtonElement>('[data-share]');
    if (share) {
      const clip = clipById(share.dataset.share);
      if (clip) { const url = `${location.origin}${location.pathname}#/feed/${clip.id}`; void (navigator.share ? navigator.share({ title: clip.title, url }) : navigator.clipboard.writeText(url).then(() => announce('Link copied'))).catch(() => {}); }
    }
  }, { signal: controller.signal });
  root.addEventListener('ended', event => { if (event.target === video()) finishClip(); }, { signal: controller.signal, capture: true });
  root.addEventListener('error', event => {
    if (event.target instanceof HTMLVideoElement && event.target === video()) {
      event.target.removeAttribute('src');
      elapsed = 0;
      setPlaying(true);
      announce('Video unavailable. Playing the lesson preview.');
    }
  }, { signal: controller.signal, capture: true });
  root.addEventListener('keydown', event => {
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
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive(active + (event.key === 'ArrowDown' ? 1 : -1)); }
  }, { signal: controller.signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { video()?.pause(); lastTick = performance.now(); } else if (playing && !sheetOpen) setPlaying(true); }, { signal: controller.signal });
  const ticker = window.setInterval(() => {
    const now = performance.now(), delta = Math.min((now - lastTick) / 1000, .2);
    lastTick = now;
    if (playing && !sheetOpen && !document.hidden && !video()) { elapsed = Math.min(DEMO_SECONDS, elapsed + delta); if (elapsed >= DEMO_SECONDS) finishClip(); }
    updateProgress();
  }, 100);
  setActive(initial, false); feed.scrollTop = panel().offsetTop;
  if (target?.quiz) { renderQuestion(); openSheet(); }
  return { dispose() { controller.abort(); clearInterval(ticker); clearTimeout(toastTimeout); video()?.pause(); } };
}
