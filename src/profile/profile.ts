import './profile.css';
import type { View } from '../navigation';
import { CLIPS } from '../feed/clips';
import { carState, buyCar, marked, onboarding, record, selectCar, settings, stats, toggleMark } from '../feed/progress';
import { homeNavigation } from '../home/tabs';
import { icon } from '../home/icons';
import { bottomSheet, sheetMarkup } from '../home/sheet';
import { milestones } from '../progress/milestones';
import { CARS, carArt, carById, carPreview } from './cars';
import { PROFILE_COPY as copy } from './content';
import { medalArt } from './medals';

const esc = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const svg = (paths: string, width = 1.6) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const heart = svg('<path d="M20 4c-3-2-6-1-8 2-2-3-5-4-8-2-4 3-2 8 1 11l7 6 7-6c3-3 5-8 1-11Z"/>');
const lock = svg('<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>', 1.8);
const carIcon = svg('<path d="M5 16h14M6.5 16 8 9.5A2 2 0 0 1 10 8h4a2 2 0 0 1 2 1.5l1.5 6.5"/><rect x="3.5" y="12" width="17" height="6" rx="2"/><path d="M6 18v2m12-2v2"/>');
const calendar = svg('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4m8-4v4"/>');
type Item = typeof CARS[number];
const itemArt = (item: Item) => carPreview(item.id);
// The same car cropped closer so it fills the small next-unlock tile without overflowing it.
const closeArt = (item: Item) => `<svg class="profile-car-art" viewBox="-25 -25 50 50" aria-hidden="true" focusable="false"><g transform="rotate(-28)">${carArt(item.id)}</g></svg>`;
const shortDate = (value: string, options: Intl.DateTimeFormatOptions) => {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', options);
};

export function mountProfile(root: HTMLElement): View {
  const s = stats();
  const learner = onboarding();
  const { displayAlias, permitTestDate } = settings();
  const goalLine = learner.goal === 'other' && learner.goalNote ? learner.goalNote : copy.goals[learner.goal];
  // One dated fact beside the car: the permit test when it is set, otherwise when the learner joined.
  const dated = permitTestDate ? copy.permitTest(shortDate(permitTestDate, { month: 'short', day: 'numeric' }))
    : learner.onboardedAt ? copy.joined(new Date(learner.onboardedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })) : '';
  const completed = CLIPS.filter(clip => record(clip.id)?.done).length;
  const badges = milestones(completed);
  const nextBadge = badges.find(badge => !badge.earned);
  const page = document.createElement('div');
  page.className = 'home-preview profile-page';
  page.innerHTML = `<div class="home-phone"><main class="profile-content" aria-label="${copy.title}" tabindex="-1">
    <header class="profile-cover"><h1>${copy.title}</h1></header>
    <section class="profile-identity" aria-label="${copy.identityLabel}">
      <div class="profile-who">
        <button class="profile-avatar" type="button" data-jump="garage" data-current-car></button>
        <div class="profile-who-text"><h2 data-profile-name>${esc(displayAlias ?? copy.noName)}</h2><p class="profile-goal">${esc(goalLine)}</p></div>
      </div>
      <ul class="profile-meta"><li>${carIcon}<span data-car-name></span></li>${dated ? `<li>${calendar}<span>${dated}</span></li>` : ''}</ul>
      <div class="profile-milestones">
        <p class="profile-label-row"><span>${copy.milestones}</span><b data-milestone-count>${copy.milestoneCount(badges.filter(badge => badge.earned).length, badges.length)}</b></p>
        <ol class="profile-medals">${badges.map((badge, index) => {
          const state = badge.earned ? 'earned' : badge === nextBadge ? 'next' : 'locked';
          return `<li class="is-${state} is-tier-${index + 1}"><span class="profile-medal" role="img" aria-label="${esc(copy.medalLabel(badge.title, badge.earned, badge.remaining))}">${medalArt(badge.icon, state, completed / badge.count)}</span><small aria-hidden="true">${state === 'next' ? copy.medalProgress(completed, badge.count) : copy.medalCount(badge.count)}</small></li>`;
        }).join('')}</ol>
        <p class="profile-medal-next">${nextBadge ? copy.nextMilestone(esc(nextBadge.title), nextBadge.remaining) : copy.allMilestones}</p>
      </div>
    </section>
    <div class="profile-next" data-next-unlock></div>
    <section class="profile-collection" aria-labelledby="profile-collection" tabindex="-1">
      <div class="profile-section-heading"><h2 id="profile-collection">${copy.garage}</h2><span class="profile-garage-count" data-garage-count></span></div>
      <ul class="profile-tiles" data-item-list></ul>
      <p class="profile-footnote">${copy.balanceNote}</p>
      <p class="profile-status" role="status" aria-live="polite" data-garage-status></p>
    </section>
    <section class="profile-list" aria-label="${copy.library}"><ul>
      ${(['saved', 'liked'] as const).map(kind => `<li><button class="profile-row" type="button" data-library="${kind}" aria-haspopup="dialog"><span class="profile-row-icon is-${kind}">${kind === 'liked' ? heart : icon('bookmark')}</span><span class="profile-row-label">${kind === 'liked' ? copy.likesTitle : copy.savedTitle}</span><span class="profile-row-value" data-library-count="${kind}"></span><span class="profile-row-go">${icon('chevron')}</span></button></li>`).join('')}
    </ul></section>
    <nav class="profile-links" aria-label="${copy.more}">${copy.links.map(link => `<a class="profile-link-card" href="${link.href}"><span class="profile-link-top"><span class="profile-row-icon">${icon(link.icon)}</span>${icon('chevron')}</span><b>${link.title}</b><small>${link.detail}</small></a>`).join('')}</nav>
  </main>${homeNavigation('profile')}
  ${sheetMarkup('profile-item-sheet', 'profile-item-title', '', copy.closeDetails, '<div data-item-detail></div>')}
  ${sheetMarkup('profile-library-sheet', 'profile-library-title', '', copy.closeLibrary, '<div class="profile-library" data-library-panel></div>')}
  <dialog class="profile-purchase" aria-labelledby="profile-purchase-title"><form method="dialog"><button class="profile-close" aria-label="${copy.closePurchase}">×</button></form><div class="profile-purchase-art" data-purchase-art></div><p>${copy.purchaseTitle}</p><h2 id="profile-purchase-title"></h2><div class="profile-purchase-total"><span>${copy.priceLabel}</span><strong data-purchase-price></strong></div><p data-purchase-balance></p><button class="profile-primary ui-button" data-confirm></button><button class="profile-cancel ui-button is-quiet" data-cancel>${copy.cancel}</button></dialog>
  </div>`;
  root.append(page);
  let library: 'liked' | 'saved' = 'saved';
  let detail: Item | undefined;
  let detailFromReward = false;
  let pending: Item | undefined;
  const dialog = page.querySelector<HTMLDialogElement>('.profile-purchase')!;
  const detailDialog = page.querySelector<HTMLDialogElement>('.profile-item-sheet')!;
  const libraryDialog = page.querySelector<HTMLDialogElement>('.profile-library-sheet')!;
  const sheet = bottomSheet(detailDialog);
  const librarySheet = bottomSheet(libraryDialog);
  let feedbackAnimations: Animation[] = [];
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
  const owns = (item: Item) => carState().owned.some(id => id === item.id);
  const tile = (item: Item) => page.querySelector<HTMLButtonElement>(`[data-item="${item.id}"]`);

  function renderCollection() {
    const state = carState();
    const car = carById(state.selected)!;
    const avatar = page.querySelector<HTMLElement>('[data-current-car]')!;
    avatar.innerHTML = itemArt(car);
    avatar.setAttribute('aria-label', copy.avatarLabel(car.name));
    page.querySelector('[data-car-name]')!.textContent = car.name;
    page.querySelector('[data-garage-count]')!.textContent = copy.garageCount(state.owned.length, CARS.length);
    const upcoming = CARS.filter(item => !owns(item)).sort((a, b) => a.price - b.price)[0];
    const shortfall = upcoming ? Math.max(0, upcoming.price - state.available) : 0;
    const wallet = `<span class="profile-unlock-wallet"><b data-available>${state.available}</b> ${copy.wallet} · <b data-profile-xp>${s.xpTotal}</b> ${copy.earned}</span>`;
    // The featured surface: the next car and its price, the real balance toward it and, once affordable, the one ochre action.
    page.querySelector('[data-next-unlock]')!.innerHTML = upcoming ? `<button class="profile-unlock${shortfall ? '' : ' is-ready'}" type="button" data-reward-item="${upcoming.id}" aria-haspopup="dialog" aria-label="${esc(`${copy.viewCar(upcoming.name)}. ${copy.carProgress(state.available, upcoming.price)}`)}">
        <span class="profile-unlock-top">
          <span class="profile-unlock-art">${closeArt(upcoming)}</span>
          <span class="profile-unlock-name"><small>${copy.nextCar}</small><b>${esc(upcoming.name)}</b></span>
          <span class="profile-unlock-price">${copy.price(upcoming.price)}${icon('chevron')}</span>
        </span>
        <span class="profile-next-track" role="progressbar" aria-label="${esc(copy.nextUnlock(upcoming.name))}" aria-valuemin="0" aria-valuemax="${upcoming.price}" aria-valuenow="${Math.min(state.available, upcoming.price)}" aria-valuetext="${copy.carProgress(state.available, upcoming.price)}">${state.available ? `<span style="width:${Math.min(1, state.available / upcoming.price) * 100}%"></span>` : ''}</span>
        ${wallet}
        ${shortfall ? '' : `<span class="profile-unlock-cta">${copy.unlockFor(upcoming.price)}</span>`}
      </button>` : `<div class="profile-unlock is-complete"><span class="profile-unlock-top"><span class="profile-unlock-art">${icon('check')}</span><span class="profile-unlock-name"><b>${copy.collectionComplete}</b><small>${copy.collectionNote}</small></span></span>${wallet}</div>`;
    page.querySelector('[data-item-list]')!.innerHTML = CARS.map(item => {
      const selected = state.selected === item.id;
      const owned = owns(item);
      const status = selected ? copy.selected : owned ? copy.owned : copy.price(item.price);
      return `<li><button class="profile-tile${selected ? ' is-selected' : owned ? '' : ' is-locked'}" data-item="${item.id}" data-car="${item.id}" aria-haspopup="dialog" aria-label="${esc(`${item.name}, ${status}${owned ? '' : `, ${copy.locked}`}`)}"><span class="profile-tile-art">${itemArt(item)}</span><b>${esc(item.name)}</b><span class="profile-tile-state">${selected ? icon('check') : !owned ? lock : ''}${status}</span></button></li>`;
    }).join('');
  }

  function renderDetail(item: Item) {
    const state = carState();
    const selected = state.selected === item.id;
    const shortfall = Math.max(0, item.price - state.available);
    const action = selected ? copy.selected : owns(item) ? copy.use : shortfall ? copy.need(shortfall) : copy.buy(item.price);
    page.querySelector('#profile-item-title')!.textContent = item.name;
    page.querySelector('[data-item-detail]')!.innerHTML = `<div class="profile-detail-art">${itemArt(item)}</div><p>${esc(item.description)}</p><button class="ui-button" data-item-action${selected || (!owns(item) && shortfall) ? ' disabled' : ''}>${action}</button>`;
  }
  function renderCounts() {
    for (const kind of ['liked', 'saved'] as const) {
      const count = CLIPS.filter(clip => marked(kind, clip.id)).length;
      page.querySelector(`[data-library-count="${kind}"]`)!.textContent = String(count);
      page.querySelector(`[data-library="${kind}"]`)!.classList.toggle('has-items', count > 0);
    }
  }
  function renderLibrary() {
    renderCounts();
    const lessons = CLIPS.filter(clip => marked(library, clip.id));
    const symbol = library === 'liked' ? heart : icon('bookmark');
    page.querySelector('#profile-library-title')!.textContent = library === 'liked' ? copy.likesTitle : copy.savedTitle;
    page.querySelector('[data-library-panel]')!.innerHTML = lessons.length ? `<ul>${lessons.map(clip => `<li><a href="#/feed/${esc(clip.id)}"><span class="profile-row-icon is-${library}">${symbol}</span><span><small>${esc(clip.topic)}</small><b>${esc(clip.title)}</b></span>${icon('chevron')}</a>${library === 'saved' ? `<button class="profile-unsave" data-unsave="${esc(clip.id)}" aria-label="${esc(copy.removeSaved(clip.title))}">${icon('bookmark')}</button>` : ''}</li>`).join('')}</ul>` : `<div class="profile-library-empty"><span class="profile-row-icon is-${library}">${symbol}</span><p>${library === 'liked' ? copy.likesEmpty : copy.savedEmpty}</p><a class="ui-button is-secondary" href="#/feed">${copy.explore}</a></div>`;
  }
  function feedback(item: Item, unlocked: boolean) {
    clearTimeout(feedbackTimer);
    feedbackAnimations.forEach(animation => animation.cancel());
    feedbackAnimations = [];
    const status = page.querySelector<HTMLElement>('[data-garage-status]')!;
    status.classList.toggle('is-unlock', unlocked);
    status.innerHTML = unlocked
      ? `${icon('check')}<span><strong>${esc(copy.unlocked(item.name))}</strong><span>${esc(copy.purchaseMessage(item.name))}</span></span>`
      : esc(copy.selectedMessage(item.name));
    feedbackTimer = setTimeout(() => { status.classList.remove('is-unlock'); status.textContent = ''; }, 4000);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const card = tile(item)!;
    feedbackAnimations.push(card.querySelector('.profile-tile-art')!.animate([
      { transform: 'translateY(3px) scale(.92)' },
      { transform: 'translateY(-4px) scale(1.04)', offset: .55 },
      { transform: 'translateY(0) scale(1)' },
    ], { duration: unlocked ? 520 : 340, easing: 'cubic-bezier(.2,.7,.3,1)' }));
    if (unlocked) feedbackAnimations.push(card.animate([
      { outline: '3px solid transparent', outlineOffset: '0px' },
      { outline: '3px solid var(--lane-accent)', outlineOffset: '4px', offset: .35 },
      { outline: '3px solid transparent', outlineOffset: '8px' },
    ], { duration: 650, easing: 'ease-out' }));
  }
  // Purchasing replaces the opener. Restore focus to the updated reward control or tile.
  detailDialog.addEventListener('close', () => {
    const target = detailFromReward ? page.querySelector<HTMLElement>('[data-reward-item]') ?? page.querySelector<HTMLElement>('.profile-collection') : detail ? tile(detail) : undefined;
    target?.focus({ preventScroll: true });
  });
  libraryDialog.addEventListener('close', () => page.querySelector<HTMLElement>(`[data-library="${library}"]`)?.focus({ preventScroll: true }));
  dialog.addEventListener('close', () => {
    pending = undefined;
    if (detailDialog.open) detailDialog.querySelector<HTMLButtonElement>('[data-item-action]')?.focus({ preventScroll: true });
  });
  const onClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const kind = event.target.closest<HTMLElement>('[data-library]')?.dataset.library;
    if (kind === 'liked' || kind === 'saved') { library = kind; renderLibrary(); librarySheet.open(); }
    const remove = event.target.closest<HTMLElement>('[data-unsave]');
    if (remove?.dataset.unsave) {
      toggleMark('saved', remove.dataset.unsave);
      renderLibrary();
      (libraryDialog.querySelector<HTMLElement>('[data-unsave]') ?? libraryDialog.querySelector<HTMLElement>('#profile-library-title')!).focus({ preventScroll: true });
    }
    if (event.target.closest('[data-jump]')) {
      const section = page.querySelector<HTMLElement>('.profile-collection')!;
      section.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      section.focus({ preventScroll: true });
    }
    const reward = event.target.closest<HTMLElement>('[data-reward-item]');
    const id = reward?.dataset.rewardItem ?? event.target.closest<HTMLElement>('[data-item]')?.dataset.item;
    const item = id ? carById(id) : undefined;
    if (item) { detailFromReward = !!reward; detail = item; renderDetail(item); sheet.open(); }
    if (event.target.closest('[data-item-action]') && detail) {
      if (owns(detail)) {
        if (selectCar(detail.id)) { renderCollection(); sheet.close(); feedback(detail, false); }
      } else if (carState().available >= detail.price) {
        pending = detail;
        page.querySelector('[data-purchase-art]')!.innerHTML = itemArt(detail);
        page.querySelector('#profile-purchase-title')!.textContent = detail.name;
        page.querySelector('[data-purchase-price]')!.textContent = copy.price(detail.price);
        page.querySelector('[data-purchase-balance]')!.textContent = copy.purchaseBalance(carState().available - detail.price, s.xpTotal);
        page.querySelector('[data-confirm]')!.textContent = copy.buyAndUse(detail.price);
        dialog.showModal();
      }
    }
    if (event.target.closest('[data-cancel]')) dialog.close();
    if (event.target.closest('[data-confirm]') && pending) {
      const purchased = pending;
      const result = buyCar(purchased.id);
      dialog.close();
      renderCollection();
      sheet.close();
      if (result === 'purchased') feedback(purchased, true);
      else page.querySelector('[data-garage-status]')!.textContent = result === 'owned' ? copy.alreadyOwned : copy.insufficient;
    }
  };
  const onKeydown = (event: KeyboardEvent) => {
    const modal = dialog.open ? dialog : detailDialog.open ? detailDialog : libraryDialog.open ? libraryDialog : undefined;
    if (event.key !== 'Tab' || !modal) return;
    const controls = [...modal.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]')].filter(control => control.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (first && last && (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  };
  renderCollection();
  renderCounts();
  page.addEventListener('click', onClick);
  page.addEventListener('keydown', onKeydown);
  page.querySelector<HTMLElement>('main')!.focus({ preventScroll: true });
  return { dispose() { clearTimeout(feedbackTimer); feedbackAnimations.forEach(animation => animation.cancel()); page.removeEventListener('click', onClick); page.removeEventListener('keydown', onKeydown); dialog.close(); sheet.dispose(); librarySheet.dispose(); page.remove(); } };
}
