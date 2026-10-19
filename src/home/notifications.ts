import { CLIPS } from '../feed/clips';
import { carState, groupStandings, markNotificationsSeen, onboarding, record, seenNotifications, setGroupStandings, settings, stats } from '../feed/progress';
import { CARS } from '../profile/cars';
import { nextLessonId } from '../feed/plan';
import { appSync } from '../data/sync';
import { NOTIFICATION_COPY as copy } from './content';
import { icon } from './icons';
import { lessonProgress } from './model';
import { notifications, trackStandings, type GroupStanding, type LaneNotification, type NotificationKind } from './notifications-model';
import { bottomSheet, sheetMarkup } from './sheet';

const esc = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const KIND_ICON: Record<NotificationKind, Parameters<typeof icon>[0]> = { permit: 'calendar', 'permit-date': 'calendar', streak: 'flame', group: 'trophy', passed: 'progress', car: 'car' };
// my_groups has no fixed cap on the client; one board request each, so keep Home's load bounded.
const GROUP_LIMIT = 5;

export const notificationButton = () => `<button class="home-circle home-bell" type="button" aria-haspopup="dialog" aria-label="${copy.button}" data-notifications>${icon('bell')}<span class="home-bell-count" aria-hidden="true" hidden></span></button>`;
export const notificationSheet = () => sheetMarkup('home-notifications', 'home-notifications-title', copy.title, copy.close, '<div data-notes></div>');

/** The bell in Home's toolbar. Everything is worked out from local progress and the group boards the app already reads. */
export function mountNotifications(page: HTMLElement, options: { showGroup(code: string): void }) {
  const button = page.querySelector<HTMLButtonElement>('[data-notifications]')!;
  const count = button.querySelector<HTMLElement>('.home-bell-count')!;
  const dialog = page.querySelector<HTMLDialogElement>('.home-notifications')!;
  const body = dialog.querySelector<HTMLElement>('[data-notes]')!;
  const sheet = bottomSheet(dialog);
  const sync = appSync(CLIPS.map(clip => clip.id));
  let groups: GroupStanding[] = [];
  let disposed = false, version = 0;

  function current() {
    const s = stats();
    const learning = lessonProgress(CLIPS, record, nextLessonId());
    const cars = carState();
    // CARS is in price order, so the first one not owned is the next unlock (Profile's next-unlock card).
    const nextCar = CARS.find(car => !cars.owned.includes(car.id)) ?? null;
    return notifications({
      now: new Date(), goal: onboarding().goal, permitTestDate: settings().permitTestDate, streak: s.streak, practicedToday: s.xpToday > 0,
      allDone: learning.allDone, nextLessonHref: learning.next ? `#/feed/${learning.next.id}` : '#/feed', groups, standings: groupStandings(),
      nextCar, availableXp: cars.available,
    });
  }
  function badge() {
    const seen = seenNotifications();
    const fresh = current().filter(item => !seen.includes(item.id)).length;
    count.hidden = !fresh;
    count.textContent = fresh > 9 ? '9+' : String(fresh);
    button.setAttribute('aria-label', fresh ? copy.buttonNew(fresh) : copy.button);
  }
  const row = (item: LaneNotification, isNew: boolean) => {
    const inner = `<span class="home-note-icon${item.urgent ? ' is-urgent' : ''}">${icon(KIND_ICON[item.kind])}</span>
      <span class="home-note-text"><b>${isNew ? `<span class="home-note-new"><span class="home-sr-only">${copy.newLabel}: </span></span>` : ''}${esc(item.title)}</b><small>${esc(item.detail)}</small></span>${icon('chevron')}`;
    return `<li>${item.href ? `<a class="home-note" href="${esc(item.href)}">${inner}</a>` : `<button class="home-note" type="button" data-note-group="${esc(item.group ?? '')}">${inner}</button>`}</li>`;
  };
  function render(list: LaneNotification[]) {
    const seen = seenNotifications();
    body.innerHTML = list.length
      ? `<ul class="home-notes">${list.map(item => row(item, !seen.includes(item.id))).join('')}</ul>`
      : `<div class="home-notes-empty"><span class="home-note-icon">${icon('bell')}</span><b>${copy.empty}</b><p>${copy.emptyDetail}</p></div>`;
  }
  async function loadGroups() {
    if (!sync.configured) return;
    const mine = ++version;
    const list = await sync.groups();
    if (disposed || mine !== version || !list) return;
    const boards = await Promise.all(list.slice(0, GROUP_LIMIT).map(async group => ({ ...group, rows: await sync.codeGroupLeaderboard(group.code) ?? [] })));
    if (disposed || mine !== version) return;
    groups = boards;
    // Only groups whose boards loaded are compared; a failed request must not read as everyone leaving.
    if (boards.every(group => group.rows.length)) setGroupStandings(trackStandings(groupStandings(), boards, new Date()));
    badge();
  }

  const open = () => {
    const list = current();
    render(list);
    sheet.open();
    // Opening the sheet reads them; the rows keep their New marker until the next open.
    markNotificationsSeen(list.map(item => item.id));
    badge();
  };
  const click = (event: MouseEvent) => {
    const code = (event.target as Element).closest<HTMLElement>('[data-note-group]')?.dataset.noteGroup;
    if (!code) return;
    sheet.close();
    options.showGroup(code);
  };
  const visible = () => { if (!document.hidden) { badge(); void loadGroups(); } };
  button.addEventListener('click', open);
  body.addEventListener('click', click);
  document.addEventListener('visibilitychange', visible);
  const unsubscribe = sync.subscribe(status => { if (status.state === 'synced') void loadGroups(); });
  badge();
  void loadGroups();
  return { dispose() { disposed = true; unsubscribe(); sheet.dispose(); document.removeEventListener('visibilitychange', visible); button.removeEventListener('click', open); body.removeEventListener('click', click); } };
}
