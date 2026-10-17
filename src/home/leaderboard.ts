import { settings, weeklyProgress } from '../feed/progress';
import { CLIPS } from '../feed/clips';
import { appSync, type RemoteRow } from '../data/sync';
import './leaderboard.css';
import { icon } from './icons';
import { leaderboardRows, type LeaderboardRow, type LeaderboardSnapshot } from './leaderboard-model';
import { LEADERBOARD_COPY as copy } from './content';

const esc = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
type Scope = 'group' | 'global';
const empty: LeaderboardSnapshot = { entries: [], yourRank: null };
// Global shows verified weekly XP from the backend when one is configured; otherwise only the
// learner's own local row. Group shows the learner and accepted streak buddies. No sample people ship.
const toSnapshot = (rows: RemoteRow[]): LeaderboardSnapshot => ({
  entries: rows.map(row => ({ nickname: row.alias ?? 'You', avatar: row.car_id ?? '', xp: row.xp, rank: row.rank, isYou: row.is_you })),
  yourRank: rows.find(row => row.is_you)?.rank ?? null,
});
export function mountLeaderboard(root: HTMLElement, snapshots: Partial<Record<Scope, LeaderboardSnapshot>> = {}) {
  let scope: Scope = 'global';
  const sync = appSync(CLIPS.map(clip => clip.id));
  let disposed = false;
  root.innerHTML = `<div class="home-section-heading"><h2 id="home-leaderboard-title">${copy.title}</h2></div>
    <div class="home-board-tabs ui-segmented" role="tablist" aria-label="Leaderboard scope">${(['group', 'global'] as const).map(id => `<button id="board-tab-${id}" role="tab" aria-controls="board-panel" aria-selected="${id === scope}" tabindex="${id === scope ? 0 : -1}" data-board-tab="${id}">${copy[id].tab}</button>`).join('')}</div>
    <div class="home-board-card"><div id="board-panel" role="tabpanel" aria-labelledby="board-tab-group" tabindex="0"></div></div>`;
  const panel = root.querySelector<HTMLElement>('[role="tabpanel"]')!;
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const row = (entry: LeaderboardRow) => {
    return `<li class="home-board-row${entry.isYou ? ' is-you' : ''}"${entry.isYou ? ' data-board-you' : ''}>
      <span class="home-board-rank${entry.rank !== null && entry.rank <= 3 ? ` is-place-${entry.rank}` : ''}" aria-label="${entry.rank === null ? copy.noRank : `Rank ${entry.rank}`}">${entry.rank ?? '—'}</span>
      <span class="home-board-person" aria-hidden="true">${icon('profile')}</span>
      <span class="home-board-name"><b>${esc(entry.nickname)}</b></span>
      <span class="home-board-xp"><strong>${entry.xp.toLocaleString('en-US')}</strong><small>XP</small></span></li>`;
  };
  function refresh() {
    panel.setAttribute('aria-labelledby', `board-tab-${scope}`);
    if (scope === 'group' && !sync.configured) { panel.innerHTML = `<p class="home-board-note">${copy.comingSoon}</p>`; return; }
    const snapshot = snapshots[scope];
    // With remote rankings, the learner's row shows the server-verified XP, not the local total.
    const own = snapshot?.entries.find(entry => entry.isYou);
    const rows = leaderboardRows(snapshot ?? empty, { avatar: '', xp: own?.xp ?? weeklyProgress().xp });
    const alone = scope === 'group' && (snapshot?.entries.length ?? 0) <= 1;
    const note = !sync.configured ? copy.comingSoon : !settings().displayAlias ? copy.noAlias : alone ? `${copy.groupEmpty} <a href="#/buddies">${copy.groupAdd}</a>` : '';
    panel.innerHTML = `${rows.top.length ? `<ol class="home-board-list" aria-label="${copy[scope].list}">${rows.top.map(row).join('')}</ol>` : ''}
      ${rows.pinned ? `<div class="home-board-pinned${rows.top.length ? ' is-separated' : ''}"><ol class="home-board-list" aria-label="${copy.yourPlace}">${row(rows.pinned)}</ol></div>` : ''}${note ? `<p class="home-board-note">${note}</p>` : ''}`;
  }
  async function loadRemote() {
    const [global, group] = await Promise.all([sync.leaderboard(), sync.groupLeaderboard()]);
    if (disposed) return;
    if (global) snapshots.global = toSnapshot(global);
    if (group) snapshots.group = toSnapshot(group);
    if (global || group) refresh();
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
  const visible = () => { if (!document.hidden) { refresh(); void loadRemote(); } };
  root.addEventListener('click', click);
  root.addEventListener('keydown', keydown);
  document.addEventListener('visibilitychange', visible);
  const timer = window.setInterval(visible, 60_000);
  refresh();
  void loadRemote();
  return { refresh, dispose() { disposed = true; clearInterval(timer); document.removeEventListener('visibilitychange', visible); root.removeEventListener('click', click); root.removeEventListener('keydown', keydown); } };
}
