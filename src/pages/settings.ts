import { CLIPS } from '../feed/clips';
import { cleanAlias, GOALS, onboarding, setDisplayAlias, setGoal, setPermitTestDate, settings, type Goal } from '../feed/progress';
import { WELCOME_COPY } from './content';
import { appSync, type SyncStatus } from '../data/sync';
import type { View } from '../navigation';
import { subpage } from './subpage';

const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const statusText = (status: SyncStatus) => status.state === 'local-only' ? 'Your progress is saved on this device.'
  : status.state === 'synced' ? `Backed up ${when(status.lastSyncedAt)}.`
  : status.state === 'syncing' ? 'Backing up…'
  : 'Lane couldn’t back up just now. Your progress is safe on this device and will back up later.';

// #/settings, from the Home menu. Profile stays Garage-only (owner direction, 2026-10-14).
export function mountSettings(root: HTMLElement): View {
  const view = subpage(root, { title: 'Settings', back: '#/home', backLabel: 'Back to home', className: 'settings-page' });
  const sync = appSync(CLIPS.map(clip => clip.id));
  const current = settings(), goal = onboarding();
  view.body.innerHTML = `
    <form class="sub-field" data-goal-form>
      <fieldset class="welcome-goals"><legend class="sub-legend">Main goal</legend>
        ${GOALS.map(id => `<label class="welcome-goal"><input type="radio" name="main-goal" value="${id}"${id === goal.goal ? ' checked' : ''}><span>${WELCOME_COPY.goals[id]}</span></label>`).join('')}
      </fieldset>
      <div class="sub-actions"><button class="ui-button" type="submit">Save goal</button></div>
      <p class="sub-status" role="status" data-goal-status></p>
    </form>
    <form class="sub-field" data-date-form>
      <label for="permit-date">Permit test date</label>
      <div class="sub-field-row"><input id="permit-date" type="date" value="${esc(current.permitTestDate ?? '')}"><button class="ui-button" type="submit">Save</button></div>
      <p class="sub-note">Optional. Lane offers a little more review as the date gets close. It doesn’t change your XP or progress.</p>
      <p class="sub-status" role="status" data-date-status></p>
    </form>
    <form class="sub-field" data-alias-form>
      <label for="alias">Username</label>
      <div class="sub-field-row"><input id="alias" type="text" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(current.displayAlias ?? '')}"><button class="ui-button" type="submit">Save</button></div>
      <p class="sub-note">It shows on leaderboards. Skip your real name. Use 3–20 letters, numbers, - or _.</p>
      <p class="sub-status" role="status" data-alias-status></p>
    </form>
    <section class="sub-field" aria-labelledby="sync-title">
      <h2 id="sync-title">Progress</h2>
      <p data-sync-status>${statusText(sync.status())}</p>
      ${sync.configured ? '<div class="sub-actions"><button class="ui-button is-secondary" data-sync-now>Back up now</button><button class="ui-button is-quiet" data-delete-remote>Delete backed-up data</button></div>' : ''}
    </section>
    <h2>About Lane</h2>
    <ul class="sub-list">
      <li><a class="sub-row" href="#/credits"><span><b>Credits & sources</b><small>Videos, handbook and software</small></span><i aria-hidden="true">→</i></a></li>
      <li><a class="sub-row" href="#/privacy"><span><b>Privacy Policy</b></span><i aria-hidden="true">→</i></a></li>
      <li><a class="sub-row" href="#/terms"><span><b>Terms of Service</b></span><i aria-hidden="true">→</i></a></li>
    </ul>
    <p class="sub-note">Lane is for learning. Never use it while driving. Driver readiness, permit test readiness and driver class are estimates from your practice in Lane. They can’t predict a test result or how you will drive.</p>`;
  const body = view.body;
  const dateStatus = body.querySelector<HTMLElement>('[data-date-status]')!, aliasStatus = body.querySelector<HTMLElement>('[data-alias-status]')!;
  const syncLine = body.querySelector<HTMLElement>('[data-sync-status]')!;
  const unsubscribe = sync.subscribe(status => { syncLine.textContent = statusText(status); });
  body.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    if (form.matches('[data-goal-form]')) {
      const value = body.querySelector<HTMLInputElement>('[name="main-goal"]:checked')?.value as Goal;
      body.querySelector<HTMLElement>('[data-goal-status]')!.textContent = setGoal(value, value === 'other' ? goal.goalNote : null) ? 'Saved.' : 'Choose a goal.';
      return;
    }
    if (form.matches('[data-date-form]')) {
      const value = body.querySelector<HTMLInputElement>('#permit-date')!.value;
      dateStatus.textContent = setPermitTestDate(value || null) ? (value ? 'Saved.' : 'Date cleared.') : 'Enter a valid date.';
    } else {
      const input = body.querySelector<HTMLInputElement>('#alias')!;
      // A username is required (onboarding asks for one), so it can be changed but not cleared.
      if (!input.value.trim()) { aliasStatus.textContent = 'Choose a username. It can be changed, not removed.'; return; }
      const name = cleanAlias(input.value);
      if (!name) { aliasStatus.textContent = 'Use 3–20 letters, numbers, - or _.'; return; }
      // With a server, the name is claimed there first so no two learners share it.
      if (!sync.configured) { setDisplayAlias(name); input.value = name; aliasStatus.textContent = 'Saved.'; return; }
      aliasStatus.textContent = 'Saving…';
      void sync.setUsername(name).then(result => {
        if (result === 'ok') { setDisplayAlias(name); input.value = name; }
        aliasStatus.textContent = result === 'ok' ? 'Saved.' : result === 'taken' ? 'Someone already has that username. Try another.' : result === 'invalid' ? 'Use 3–20 letters, numbers, - or _.' : 'Lane couldn’t connect. Try again in a moment.';
      });
    }
  });
  let confirmDelete = false;
  body.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('[data-sync-now]')) void sync.sync();
    const remove = event.target.closest<HTMLButtonElement>('[data-delete-remote]');
    if (remove) {
      // Deleting server data can't be undone, so it asks once on the button itself.
      if (!confirmDelete) { confirmDelete = true; remove.textContent = 'Tap again to delete backed-up data'; return; }
      remove.disabled = true;
      void sync.deleteRemote().then(ok => { syncLine.textContent = ok ? 'Backed-up data deleted. Your progress on this device stays.' : 'Lane couldn’t delete it right now. Try again later.'; remove.disabled = false; remove.textContent = 'Delete backed-up data'; confirmDelete = false; });
    }
  });
  return { dispose() { unsubscribe(); view.dispose(); } };
}
