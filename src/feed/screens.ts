import { CLIPS, type Clip } from './clips';
import { dailyGoal, record, stats } from './progress';
import type { View } from '../navigation';
import { SCENARIOS } from '../simulation/registry';
import { nextLessonId } from './plan';

function weakSpot() {
  const topics = new Map<string, { attempted: number; right: number; open: Clip[] }>();
  for (const clip of CLIPS) {
    const topic = topics.get(clip.topic) ?? { attempted: 0, right: 0, open: [] };
    const result = record(clip.id);
    if (result?.tries) { topic.attempted++; if (result.firstTry) topic.right++; }
    if (!result?.done) topic.open.push(clip);
    topics.set(clip.topic, topic);
  }
  let weakest: { topic: string; pct: number; attempted: number; open: Clip[] } | null = null;
  for (const [topic, { attempted, right, open }] of topics) {
    if (!attempted || right === attempted) continue;
    const pct = Math.round(right / attempted * 100);
    if (!weakest || pct < weakest.pct) weakest = { topic, pct, attempted, open };
  }
  return weakest;
}

export function mountProgress(root: HTMLElement): View {
  const s = stats();
  const readiness = Math.round(s.done / CLIPS.length * 100);
  const remaining = CLIPS.length - s.done;
  const next = CLIPS.find(clip => clip.id === nextLessonId()) ?? CLIPS.find(clip => !record(clip.id)?.done) ?? CLIPS[0];
  const peak = Math.max(dailyGoal(), ...s.week);
  const weak = weakSpot();
  const stat = (value: string | number, label: string) => `<div class="lane-stat"><strong>${value}</strong><span>${label}</span></div>`;
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
  root.innerHTML = `<main class="rl lane-summary">
    <div class="lane-summary-inner">
      <header class="lane-summary-top ui-page-head"><h1 tabindex="-1">Lesson summary</h1><a href="#/feed" aria-label="Back to feed">×</a></header>
      <section class="lane-readiness" aria-label="Route progress">
        <div class="lane-readiness-heading"><span>Road basics</span><span class="lane-total-xp ui-chip is-accent">${s.xpTotal} XP</span></div>
        <strong>${s.done}<small> / ${CLIPS.length}</small></strong>
        <div class="lane-readiness-track" role="progressbar" aria-valuenow="${readiness}" aria-valuemin="0" aria-valuemax="100" aria-label="Lessons completed"><span style="width:${readiness}%"></span></div>
        <p>${remaining ? `${plural(remaining, 'lesson')} remaining.` : 'All lessons complete.'}</p>
        <a class="lane-resume ui-button is-split" href="#/feed/${next.id}">${s.done ? remaining ? 'Continue learning' : 'Review lessons' : 'Start learning'} <span aria-hidden="true">→</span></a>
      </section>
      <section class="lane-route" aria-label="Choose a lesson"><div class="lane-route-heading"><h2>Your lessons</h2><span>${s.done} / ${CLIPS.length}</span></div>${CLIPS.map((clip, i) => {
        const done = record(clip.id)?.done;
        return `<a class="lane-route-stop${done ? ' is-cleared' : clip.id === next.id ? ' is-next' : ''}" href="#/feed/${clip.id}"><span class="lane-route-node" aria-hidden="true">${done ? '<svg viewBox="0 0 24 24"><path d="m6 12.5 4 4 8-9"/></svg>' : String(i + 1).padStart(2, '0')}</span><span class="lane-route-copy"><small>${done ? 'Complete' : clip.id === next.id ? 'Up next' : `Lesson ${String(i + 1).padStart(2, '0')}`}${SCENARIOS.some(entry => entry.lessonId === clip.id) ? ' · Challenge included' : ''}</small><strong>${clip.title}</strong></span><span aria-hidden="true">${done ? '↻' : '↗'}</span></a>`;
      }).join('')}</section>
      <section class="lane-week" aria-label="XP earned each day this week">
        <h2>This week</h2>
        <div class="lane-week-bars">${s.week.map((xp, i) => `<div class="lane-week-day${i === s.todayIndex ? ' is-today' : ''}"><span style="height:${Math.max(8, Math.round(xp / peak * 74))}px"></span><small aria-label="${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i]}: ${xp} XP">${'MTWTFSS'[i]}</small></div>`).join('')}</div>
      </section>
      <section class="lane-stats" aria-label="Learning statistics">
        ${stat(s.done, 'lessons complete')}
        ${stat(s.attempted ? `${Math.round(s.firstTryRight / s.attempted * 100)}%` : '—', 'right first try')}
        ${stat(s.streak, 'day streak')}
        ${stat(s.xpTotal, 'XP total')}
      </section>
      ${weak ? `<section class="lane-weak"><span>Review topic</span><h2>${weak.topic}</h2><p>${weak.pct}% right first try over ${plural(weak.attempted, 'lesson')}.</p>${weak.open.length ? `<a class="ui-button is-secondary" href="#/feed/${weak.open[0].id}/quiz">Review ${plural(weak.open.length, 'lesson')}</a>` : ''}</section>` : ''}
    </div>
  </main>`;
  root.querySelector<HTMLElement>('h1')?.focus();
  return { dispose() {} };
}
