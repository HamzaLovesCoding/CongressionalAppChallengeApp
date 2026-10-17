import { CLIPS } from '../feed/clips';
import { setDisplayAlias, settings } from '../feed/progress';
import { appSync, type BuddyRow, type RequestResult, type UsernameResult } from '../data/sync';
import type { View } from '../navigation';
import { subpage } from './subpage';
import { BUDDY_COPY as copy } from './content';

const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const flame = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2c1 7-6 6-3 12 2-1 3-3 3-5 5 4 6 7 4 11-2 3-8 3-11 0C1 14 6 9 8 7c-1 4 1 4 1 4C8 5 12 5 13 2Z"/></svg>';

// #/buddies, from the Home menu: add a friend by username, accept requests, and keep a duo streak
// (days you both practiced). Buddies see only username, car, weekly XP and today's practice.
export function mountBuddies(root: HTMLElement): View {
  const view = subpage(root, { title: copy.title, back: '#/home', backLabel: 'Back to home', className: 'buddies-page' });
  const body = view.body;
  const sync = appSync(CLIPS.map(clip => clip.id));
  let rows: BuddyRow[] = [], loaded = false, disposed = false, confirmRemove = '';

  const usernameForm = (status = '') => `<form class="sub-field" data-username-form>
      <label for="buddy-username">${copy.yourUsername}</label>
      <div class="sub-field-row"><input id="buddy-username" type="text" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(settings().displayAlias ?? '')}"><button class="ui-button" type="submit">${copy.save}</button></div>
      <p class="sub-note">${copy.usernameNote}</p><p class="sub-status" role="status" data-username-status>${status}</p></form>`;
  const streak = (row: BuddyRow) => `<span class="buddy-streak${row.duo_streak ? ' is-lit' : ''}">${flame}${copy.streak(row.duo_streak)}</span>`;
  const today = (row: BuddyRow) => row.you_today && row.them_today ? copy.bothToday : row.you_today ? copy.waitingOn(esc(row.username)) : row.them_today ? copy.yourTurn(esc(row.username)) : copy.neitherToday;
  function render(status = '', usernameStatus = '') {
    if (!sync.configured) { body.innerHTML = `<p>${copy.intro}</p><p class="sub-note">${copy.comingSoon}</p>`; return; }
    const incoming = rows.filter(row => row.relation === 'incoming'), buddies = rows.filter(row => row.relation === 'buddy'), outgoing = rows.filter(row => row.relation === 'outgoing');
    body.innerHTML = `<p>${copy.intro}</p>
      ${usernameForm(usernameStatus)}
      <form class="sub-field" data-add-form>
        <label for="buddy-add">${copy.addLabel}</label>
        <div class="sub-field-row"><input id="buddy-add" type="text" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${copy.addPlaceholder}"><button class="ui-button" type="submit">${copy.send}</button></div>
        <p class="sub-status" role="status" data-add-status>${status}</p>
      </form>
      ${incoming.length ? `<h2>${copy.requests}</h2><ul class="sub-list">${incoming.map(row => `<li class="sub-row buddy-row"><span><b>@${esc(row.username)}</b><small>${copy.wantsToBuddy}</small></span><span class="buddy-actions"><button class="ui-button" data-accept="${esc(row.link_id)}">${copy.accept}</button><button class="ui-button is-secondary" data-decline="${esc(row.link_id)}">${copy.decline}</button></span></li>`).join('')}</ul>` : ''}
      <h2>${copy.yourBuddies}</h2>
      ${!loaded ? `<p class="sub-note">${copy.loading}</p>` : buddies.length ? `<ul class="sub-list">${buddies.map(row => `<li class="sub-row buddy-row"><span><b>@${esc(row.username)}</b>${streak(row)}<small>${today(row)} · ${copy.weekly(row.weekly_xp)}</small></span><button class="ui-button is-quiet" data-remove="${esc(row.link_id)}">${confirmRemove === row.link_id ? copy.confirmRemove : copy.remove}</button></li>`).join('')}</ul>` : `<p class="sub-note">${copy.none}</p>`}
      ${outgoing.length ? `<h2>${copy.sent}</h2><ul class="sub-list">${outgoing.map(row => `<li class="sub-row buddy-row"><span><b>@${esc(row.username)}</b><small>${copy.waiting}</small></span><button class="ui-button is-quiet" data-remove="${esc(row.link_id)}">${copy.cancel}</button></li>`).join('')}</ul>` : ''}
      <p class="sub-note">${copy.privacy}</p>`;
  }
  async function load() {
    const result = await sync.buddies();
    if (disposed) return;
    loaded = true;
    if (result) rows = result;
    render(result ? '' : copy.offline);
  }
  const usernameMessage: Record<UsernameResult, string> = { ok: copy.usernameSaved, taken: copy.usernameTaken, invalid: copy.usernameRule, offline: copy.offline };
  const requestMessage = (result: RequestResult, name: string): string => ({
    sent: copy.sentTo(esc(name)), accepted: copy.nowBuddies(esc(name)), already: copy.already(esc(name)), 'not-found': copy.notFound, self: copy.self,
    'need-username': copy.needUsername, limit: copy.limit, invalid: copy.usernameRule, offline: copy.offline,
  })[result];

  body.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    if (form.matches('[data-username-form]')) {
      const input = body.querySelector<HTMLInputElement>('#buddy-username')!;
      const status = body.querySelector<HTMLElement>('[data-username-status]')!;
      const clean = input.value.trim() ? input.value.trim().replace(/\s+/g, '_') : null;
      if (clean && !/^[A-Za-z0-9_-]{3,20}$/.test(clean)) { status.textContent = copy.usernameRule; return; }
      status.textContent = copy.saving;
      void sync.setUsername(clean).then(result => {
        if (disposed) return;
        if (result === 'ok') setDisplayAlias(clean);
        render('', usernameMessage[result]);
      });
      return;
    }
    const input = body.querySelector<HTMLInputElement>('#buddy-add')!;
    const status = body.querySelector<HTMLElement>('[data-add-status]')!;
    const name = input.value.trim().replace(/^@/, '');
    if (!name) return;
    status.textContent = copy.sending;
    void sync.requestBuddy(name).then(async result => {
      if (disposed) return;
      if (result === 'sent' || result === 'accepted') { const next = await sync.buddies(); if (next) rows = next; }
      render(requestMessage(result, name));
    });
  });
  body.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const accept = event.target.closest<HTMLElement>('[data-accept]'), decline = event.target.closest<HTMLElement>('[data-decline]'), remove = event.target.closest<HTMLElement>('[data-remove]');
    const done = async (ok: boolean) => { const next = await sync.buddies(); if (disposed) return; if (next) rows = next; render(ok ? '' : copy.offline); };
    if (accept) { void sync.respondBuddy(accept.dataset.accept!, true).then(done); return; }
    if (decline) { void sync.respondBuddy(decline.dataset.decline!, false).then(done); return; }
    if (remove) {
      const id = remove.dataset.remove!, isBuddy = rows.some(row => row.link_id === id && row.relation === 'buddy');
      // Removing a buddy ends the shared streak, so it asks once on the button itself.
      if (isBuddy && confirmRemove !== id) { confirmRemove = id; render(); return; }
      confirmRemove = '';
      void sync.removeBuddy(id).then(done);
    }
  });
  render();
  // A friend may accept while this page is open: refresh when the app comes back and every 30 s,
  // but never while the learner is typing.
  const refresh = () => { if (!document.hidden && !body.contains(document.activeElement as Node | null)) void load(); };
  const timer = sync.configured ? window.setInterval(refresh, 30_000) : 0;
  if (sync.configured) { void load(); document.addEventListener('visibilitychange', refresh); }
  return { dispose() { disposed = true; clearInterval(timer); document.removeEventListener('visibilitychange', refresh); view.dispose(); } };
}
