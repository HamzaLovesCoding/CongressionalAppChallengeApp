import { carState, settings, weeklyProgress } from '../feed/progress';
import { CLIPS } from '../feed/clips';
import { appSync, type GroupRow, type RemoteRow } from '../data/sync';
import './leaderboard.css';
import { icon } from './icons';
import { carById, carPreview } from '../profile/cars';
import { leaderboardRows, type LeaderboardRow, type LeaderboardSnapshot } from './leaderboard-model';
import { LEADERBOARD_COPY as copy } from './content';

const esc = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
type Scope = 'group' | 'global';
const empty: LeaderboardSnapshot = { entries: [], yourRank: null };
// Global shows verified weekly XP from the backend when one is configured; otherwise only the
// learner's own local row. Group shows a code group the learner made or joined. No sample people ship.
const toSnapshot = (rows: RemoteRow[]): LeaderboardSnapshot => ({
  entries: rows.map(row => ({ nickname: row.alias ?? (row.is_you ? 'You' : 'Anonymous'), avatar: row.car_id ?? '', xp: row.xp, rank: row.rank, isYou: row.is_you })),
  yourRank: rows.find(row => row.is_you)?.rank ?? null,
});
export function mountLeaderboard(root: HTMLElement, snapshots: Partial<Record<Scope, LeaderboardSnapshot>> = {}) {
  let scope: Scope = 'global';
  const sync = appSync(CLIPS.map(clip => clip.id));
  let disposed = false;
  // Code groups: null until the server answers. `picked` survives refreshes within this Home visit.
  let groups: GroupRow[] | null = null, picked: string | null = null, joining = false, busy = false, groupStatus = '';
  const groupBoards = new Map<string, LeaderboardSnapshot>();
  const selected = () => groups?.find(group => group.code === picked) ?? groups?.[0] ?? null;
  root.innerHTML = `<div class="home-section-heading"><h2 id="home-leaderboard-title">${copy.title}</h2></div>
    <div class="home-board-tabs ui-segmented" role="tablist" aria-label="Leaderboard scope">${(['group', 'global'] as const).map(id => `<button id="board-tab-${id}" role="tab" aria-controls="board-panel" aria-selected="${id === scope}" tabindex="${id === scope ? 0 : -1}" data-board-tab="${id}">${copy[id].tab}</button>`).join('')}</div>
    <div class="home-board-card"><div id="board-panel" role="tabpanel" aria-labelledby="board-tab-group" tabindex="0"></div></div>`;
  const panel = root.querySelector<HTMLElement>('[role="tabpanel"]')!;
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const row = (entry: LeaderboardRow) => {
    return `<li class="home-board-row${entry.isYou ? ' is-you' : ''}"${entry.isYou ? ' data-board-you' : ''}>
      <span class="home-board-rank${entry.rank !== null && entry.rank <= 3 ? ` is-place-${entry.rank}` : ''}" aria-label="${entry.rank === null ? copy.noRank : `Rank ${entry.rank}`}">${entry.rank ?? '—'}</span>
      <span class="home-board-person" aria-hidden="true">${carById(entry.avatar) ? carPreview(entry.avatar as never) : icon('profile')}</span>
      <span class="home-board-name"><b>${esc(entry.nickname)}</b></span>
      <span class="home-board-xp"><strong>${entry.xp.toLocaleString('en-US')}</strong><small>XP</small></span></li>`;
  };
  function rankings(snapshot: LeaderboardSnapshot | undefined, label: string) {
    // With remote rankings, the learner's row shows the server-verified XP, not the local total.
    const own = snapshot?.entries.find(entry => entry.isYou);
    const rows = leaderboardRows(snapshot ?? empty, { avatar: carState().selected, xp: own?.xp ?? weeklyProgress().xp });
    return `${rows.top.length ? `<ol class="home-board-list" aria-label="${label}">${rows.top.map(row).join('')}</ol>` : ''}
      ${rows.pinned ? `<div class="home-board-pinned${rows.top.length ? ' is-separated' : ''}"><ol class="home-board-list" aria-label="${copy.yourPlace}">${row(rows.pinned)}</ol></div>` : ''}`;
  }
  function groupHtml() {
    const group = selected();
    const head = group ? `<div class="home-board-group-head">${groups!.length > 1
      ? `<label class="home-sr-only" for="board-group-pick">${copy.pickGroup}</label><select id="board-group-pick" data-group-pick>${groups!.map(g => `<option value="${g.code}"${g.code === group.code ? ' selected' : ''}>${esc(g.name)}</option>`).join('')}</select>`
      : `<b>${esc(group.name)}</b>`}
      <button class="home-board-code" type="button" data-group-share aria-label="${copy.shareCode(group.code)}"><small>${copy.code}</small>${group.code}</button></div>` : '';
    const board = group ? rankings(groupBoards.get(group.code), copy.group.list) : '';
    const actions = joining
      ? `<form class="home-board-join" data-group-join novalidate><label class="home-sr-only" for="board-group-code">${copy.codeLabel}</label>
          <input id="board-group-code" name="code" maxlength="7" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${copy.codePlaceholder}" required>
          <button class="ui-button" type="submit"${busy ? ' disabled' : ''}>${copy.join}</button>
          <button class="ui-button is-quiet" type="button" data-group-cancel>${copy.cancel}</button></form>`
      : `<div class="home-board-actions"><button class="ui-button is-secondary" type="button" data-group-create${busy ? ' disabled' : ''}>${copy.create}</button>
          <button class="ui-button is-secondary" type="button" data-group-open-join>${copy.joinWithCode}</button></div>
          ${group ? `<button class="ui-button is-quiet home-board-leave" type="button" data-group-leave>${copy.leave(group.name)}</button>` : ''}`;
    const intro = groups && !groups.length ? `<p class="home-board-note">${copy.groupIntro}</p>` : '';
    return `${head}${board}${intro}${actions}<p class="home-board-note home-board-status" role="status" data-group-status>${esc(groupStatus)}</p>`;
  }
  function refresh() {
    panel.setAttribute('aria-labelledby', `board-tab-${scope}`);
    // Without a backend there is nothing to rank against, so each tab shows only the learner's row.
    if (scope === 'group' && sync.configured) { panel.innerHTML = groupHtml(); return; }
    const snapshot = scope === 'global' ? snapshots.global : undefined;
    const note = sync.configured && !settings().displayAlias ? `${copy.noAlias}` : '';
    panel.innerHTML = `${rankings(snapshot, copy[scope].list)}${note ? `<p class="home-board-note">${note}</p>` : ''}`;
  }
  async function loadGroups() {
    const list = await sync.groups();
    if (disposed || !list) return;
    groups = list;
    const group = selected();
    if (group) { const rows = await sync.codeGroupLeaderboard(group.code); if (disposed) return; if (rows) groupBoards.set(group.code, toSnapshot(rows)); }
    if (scope === 'group' && !joining) refresh();
  }
  async function loadRemote() {
    const global = await sync.leaderboard();
    if (disposed) return;
    if (global) { snapshots.global = toSnapshot(global); if (scope === 'global') refresh(); }
    await loadGroups();
  }
  const setStatus = (text: string) => { groupStatus = text; const el = panel.querySelector('[data-group-status]'); if (el) el.textContent = text; };
  async function createGroup() {
    busy = true; refresh();
    const result = await sync.createGroup();
    busy = false;
    if (disposed) return;
    if (result.status === 'ok') { picked = result.code; groupStatus = copy.created(result.code); await loadGroups(); refresh(); return; }
    groupStatus = copy.groupErrors[result.status]; refresh();
  }
  async function joinGroup(code: string) {
    busy = true; setStatus(copy.joining);
    const result = await sync.joinGroup(code);
    busy = false;
    if (disposed) return;
    if (result === 'joined' || result === 'already') { joining = false; picked = code.replace(/[\s-]/g, '').toUpperCase(); groupStatus = result === 'joined' ? copy.joined : copy.groupErrors.already; await loadGroups(); refresh(); return; }
    setStatus(copy.groupErrors[result]);
  }
  async function shareCode(code: string) {
    const text = copy.shareText(code);
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(code); setStatus(copy.copied);
    } catch { /* The learner closed the share sheet, or the clipboard is blocked; the code stays on screen. */ }
  }
  function activate(next: Scope) {
    scope = next;
    tabs.forEach(tab => { const active = tab.dataset.boardTab === scope; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; });
    refresh();
  }
  const click = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const id = event.target.closest<HTMLElement>('[data-board-tab]')?.dataset.boardTab;
    if (id === 'group' || id === 'global') { activate(id); return; }
    const button = event.target.closest<HTMLElement>('button');
    if (!button || busy) return;
    if (button.matches('[data-group-create]')) void createGroup();
    else if (button.matches('[data-group-open-join]')) { joining = true; groupStatus = ''; refresh(); panel.querySelector<HTMLInputElement>('#board-group-code')?.focus(); }
    else if (button.matches('[data-group-cancel]')) { joining = false; groupStatus = ''; refresh(); }
    else if (button.matches('[data-group-share]')) void shareCode(selected()!.code);
    else if (button.matches('[data-group-leave]')) {
      const group = selected();
      if (!group || !window.confirm(copy.leaveConfirm(group.name))) return;
      void sync.leaveGroup(group.code).then(left => { if (disposed) return; groupStatus = left ? copy.left : copy.groupErrors.offline; picked = null; void loadGroups().then(refresh); });
    }
  };
  const change = (event: Event) => {
    const pick = event.target instanceof HTMLSelectElement && event.target.matches('[data-group-pick]') ? event.target.value : null;
    if (!pick) return;
    picked = pick; groupStatus = ''; refresh(); void loadGroups();
  };
  const submit = (event: SubmitEvent) => {
    if (!(event.target instanceof HTMLFormElement) || !event.target.matches('[data-group-join]')) return;
    event.preventDefault();
    if (busy) return;
    const code = (event.target.elements.namedItem('code') as HTMLInputElement).value;
    if (!code.trim()) { setStatus(copy.groupErrors.invalid); return; }
    void joinGroup(code);
  };
  const keydown = (event: KeyboardEvent) => {
    if (!(event.target instanceof HTMLElement) || !event.target.matches('[role="tab"]')) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'group' : event.key === 'End' ? 'global' : scope === 'group' ? 'global' : 'group';
    activate(next);
    tabs.find(tab => tab.dataset.boardTab === next)!.focus();
  };
  const visible = () => { if (!document.hidden && !joining) { refresh(); void loadRemote(); } };
  root.addEventListener('click', click);
  root.addEventListener('keydown', keydown);
  root.addEventListener('change', change);
  root.addEventListener('submit', submit);
  document.addEventListener('visibilitychange', visible);
  const timer = window.setInterval(visible, 60_000);
  refresh();
  void loadRemote();
  return { refresh, dispose() { disposed = true; clearInterval(timer); document.removeEventListener('visibilitychange', visible); root.removeEventListener('click', click); root.removeEventListener('keydown', keydown); root.removeEventListener('change', change); root.removeEventListener('submit', submit); } };
}
