import { avatarState, weeklyProgress } from '../feed/progress';
import './leaderboard.css';
import { avatarById, AVATARS } from '../profile/avatars';
import { leaderboardRows, type LeaderboardRow, type LeaderboardSnapshot } from './leaderboard-model';
import { LEADERBOARD_COPY as copy } from './content';

const esc = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
type Scope = 'group' | 'global';
const empty: LeaderboardSnapshot = { entries: [], yourRank: null };
// Ranked snapshots can be supplied when accounts arrive; no sample people ship in the app.
export function mountLeaderboard(root: HTMLElement, snapshots: Partial<Record<Scope, LeaderboardSnapshot>> = {}) {
  let scope: Scope = 'group';
  root.innerHTML = `<div class="home-section-heading"><h2 id="home-leaderboard-title">${copy.title}</h2></div>
    <div class="home-board-card">
    <div class="home-board-tabs" role="tablist" aria-label="Leaderboard scope">${(['group', 'global'] as const).map(id => `<button id="board-tab-${id}" role="tab" aria-controls="board-panel" aria-selected="${id === scope}" tabindex="${id === scope ? 0 : -1}" data-board-tab="${id}">${copy[id].tab}</button>`).join('')}</div>
    <div id="board-panel" role="tabpanel" aria-labelledby="board-tab-group" tabindex="0"></div></div>`;
  const panel = root.querySelector<HTMLElement>('[role="tabpanel"]')!;
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const row = (entry: LeaderboardRow) => {
    const avatar = avatarById(entry.avatar) ?? AVATARS[0];
    return `<li class="home-board-row${entry.isYou ? ' is-you' : ''}"${entry.isYou ? ' data-board-you' : ''}>
      <span class="home-board-rank${entry.rank !== null && entry.rank <= 3 ? ` is-place-${entry.rank}` : ''}" aria-label="${entry.rank === null ? copy.noRank : `Rank ${entry.rank}`}">${entry.rank ?? '—'}</span>
      <img src="${esc(avatar.image)}" width="40" height="40" alt="${entry.isYou ? esc(`${avatar.name}, your selected avatar`) : ''}">
      <span class="home-board-name"><b>${esc(entry.nickname)}</b></span>
      <span class="home-board-xp"><strong>${entry.xp.toLocaleString('en-US')}</strong><small>XP</small></span></li>`;
  };
  function refresh() {
    const week = weeklyProgress();
    const rows = leaderboardRows(snapshots[scope] ?? empty, { avatar: avatarState().selected, xp: week.xp });
    panel.setAttribute('aria-labelledby', `board-tab-${scope}`);
    panel.innerHTML = `${rows.top.length ? `<ol class="home-board-list" aria-label="${copy[scope].list}">${rows.top.map(row).join('')}</ol>` : ''}
      ${rows.pinned ? `<div class="home-board-pinned${rows.top.length ? ' is-separated' : ''}"><ol class="home-board-list" aria-label="${copy.yourPlace}">${row(rows.pinned)}</ol></div>` : ''}`;
  }
  function activate(next: Scope) {
    scope = next;
    tabs.forEach(tab => { const active = tab.dataset.boardTab === scope; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; });
    refresh();
  }
  const click = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const id = event.target.closest<HTMLElement>('[data-board-tab]')?.dataset.boardTab;
    if (id === 'group' || id === 'global') activate(id);
  };
  const keydown = (event: KeyboardEvent) => {
    if (!(event.target instanceof HTMLElement) || !event.target.matches('[role="tab"]')) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'group' : event.key === 'End' ? 'global' : scope === 'group' ? 'global' : 'group';
    activate(next);
    tabs.find(tab => tab.dataset.boardTab === next)!.focus();
  };
  const visible = () => { if (!document.hidden) refresh(); };
  root.addEventListener('click', click);
  root.addEventListener('keydown', keydown);
  document.addEventListener('visibilitychange', visible);
  const timer = window.setInterval(visible, 60_000);
  refresh();
  return { refresh, dispose() { clearInterval(timer); document.removeEventListener('visibilitychange', visible); root.removeEventListener('click', click); root.removeEventListener('keydown', keydown); } };
}
