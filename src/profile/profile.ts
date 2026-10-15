import './profile.css';
import type { View } from '../navigation';
import { CLIPS } from '../feed/clips';
import { carState, buyCar, marked, selectCar, stats, toggleMark } from '../feed/progress';
import { homeNavigation } from '../home/tabs';
import { icon } from '../home/icons';
import { bottomSheet, sheetMarkup } from '../home/sheet';
import { CARS, carById, carPreview } from './cars';
import { PROFILE_COPY as copy } from './content';

const esc = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const heart = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 4c-3-2-6-1-8 2-2-3-5-4-8-2-4 3-2 8 1 11l7 6 7-6c3-3 5-8 1-11Z"/></svg>';
const lock = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></svg>';
type Item = typeof CARS[number];
const itemArt = (item: Item) => carPreview(item.id);

export function mountProfile(root: HTMLElement): View {
  const s = stats();
  const page = document.createElement('div');
  page.className = 'home-preview profile-page';
  page.innerHTML = `<div class="home-phone"><main class="profile-content" aria-label="${copy.title}" tabindex="-1">
    <header class="profile-heading ui-page-head"><h1>${copy.title}</h1></header>
    <section class="profile-identity" aria-label="${copy.identityLabel}"><div class="profile-current-car" data-current-car></div><div><p>${copy.carLabel}</p><h2 data-car-name></h2><p class="profile-character-detail">${copy.onHighway}</p><a href="#profile-collection" data-jump="garage">${copy.changeCar} <span aria-hidden="true">↓</span></a></div></section>
    <section class="profile-stats" aria-labelledby="profile-stats-title"><h2 id="profile-stats-title">${copy.stats}</h2>
      <dl class="profile-metrics">
        <div><dt>${copy.totalXp}</dt><dd data-profile-xp>${s.xpTotal}</dd><dd class="profile-stat-note">${copy.earned}</dd></div>
        <div><dt>${copy.balanceLabel}</dt><dd data-available></dd><dd class="profile-stat-note">${copy.available}</dd></div>
        <div><dt>${copy.streak}</dt><dd data-profile-streak>${s.streak}</dd><dd class="profile-stat-note">${copy.days(s.streak)}</dd></div>
        <div><dt>${copy.daysPracticed}</dt><dd data-profile-days>${s.daysPracticed}</dd><dd class="profile-stat-note">${copy.daysNote}</dd></div>
      </dl>
      <div class="profile-accuracy"><span class="profile-accuracy-icon">${icon('check')}</span><div><h3>${copy.accuracy}</h3><p>${s.attempted ? copy.attempts(s.firstTryRight, s.attempted) : copy.accuracyEmpty}</p></div><strong data-profile-accuracy${s.firstTryPercentage === null ? ` aria-label="${copy.noAttempts}"` : ''}>${s.firstTryPercentage === null ? '—' : `${s.firstTryPercentage}%`}</strong></div>
    </section>
    <section class="profile-collection" aria-labelledby="profile-collection" tabindex="-1">
      <div class="profile-section-heading"><h2 id="profile-collection">${copy.garage}</h2><span class="profile-garage-count" data-garage-count></span></div>
      <div id="profile-collection-panel">
        <div class="profile-next" data-next-unlock></div>
        <ul class="profile-tiles" data-item-list></ul>
        <p class="profile-footnote">${copy.balanceNote}</p>
      </div>
      <p class="profile-status" role="status" aria-live="polite" data-garage-status></p>
    </section>
    <section class="profile-likes" aria-label="${copy.library}">
      <div class="profile-library-tabs ui-segmented" role="tablist" aria-label="${copy.library}">${(['liked', 'saved'] as const).map(kind => `<button id="profile-tab-${kind}" role="tab" aria-controls="profile-library-panel" aria-selected="${kind === 'liked'}" tabindex="${kind === 'liked' ? 0 : -1}" data-library-tab="${kind}"><span>${kind === 'liked' ? copy.likesTitle : copy.savedTitle}</span><span class="profile-like-count ui-count" data-library-count="${kind}"></span></button>`).join('')}</div>
      <div id="profile-library-panel" role="tabpanel" aria-labelledby="profile-tab-liked" tabindex="0" data-library-panel></div>
    </section>
  </main>${homeNavigation('profile')}
  ${sheetMarkup('profile-item-sheet', 'profile-item-title', '', copy.closeDetails, '<div data-item-detail></div>')}
  <dialog class="profile-purchase" aria-labelledby="profile-purchase-title"><form method="dialog"><button class="profile-close" aria-label="${copy.closePurchase}">×</button></form><div class="profile-purchase-art" data-purchase-art></div><p>${copy.purchaseTitle}</p><h2 id="profile-purchase-title"></h2><div class="profile-purchase-total"><span>${copy.priceLabel}</span><strong data-purchase-price></strong></div><p data-purchase-balance></p><button class="profile-primary ui-button" data-confirm></button><button class="profile-cancel ui-button is-quiet" data-cancel>${copy.cancel}</button></dialog>
  </div>`;
  root.append(page);
  let library: 'liked' | 'saved' = 'liked';
  let detail: Item | undefined;
  let pending: Item | undefined;
  const dialog = page.querySelector<HTMLDialogElement>('.profile-purchase')!;
  const detailDialog = page.querySelector<HTMLDialogElement>('.profile-item-sheet')!;
  const sheet = bottomSheet(detailDialog);
  let feedbackAnimations: Animation[] = [];
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
  const collectionState = carState;
  const owns = (item: Item) => collectionState().owned.some(id => id === item.id);
  const select = (item: Item) => selectCar(item.id);
  const tile = (item: Item) => page.querySelector<HTMLButtonElement>(`[data-item="${item.id}"]`);

  function renderCollection() {
    const state = carState();
    const car = carById(state.selected)!;
    page.querySelector('[data-current-car]')!.innerHTML = itemArt(car);
    page.querySelector('[data-car-name]')!.textContent = car.name;
    page.querySelector('[data-available]')!.textContent = String(state.available);
    page.querySelector('[data-garage-count]')!.textContent = copy.garageCount(state.owned.length, CARS.length);
    const items = CARS;
    const upcoming = items.filter(item => !owns(item)).sort((a, b) => a.price - b.price)[0];
    const next = page.querySelector<HTMLElement>('[data-next-unlock]')!;
    next.innerHTML = upcoming ? `<div><p><b>${esc(copy.nextUnlock(upcoming.name))}</b><span>${copy.nextProgress(Math.min(state.available, upcoming.price), upcoming.price)}</span></p><div class="profile-next-track" role="progressbar" aria-label="${esc(copy.nextUnlock(upcoming.name))}" aria-valuemin="0" aria-valuemax="${upcoming.price}" aria-valuenow="${Math.min(state.available, upcoming.price)}"><span style="width:${Math.min(1, state.available / upcoming.price) * 100}%"></span></div></div>` : `<p>${copy.collectionComplete}</p>`;
    page.querySelector('[data-item-list]')!.innerHTML = items.map(item => {
      const selected = state.selected === item.id;
      const owned = owns(item);
      const status = selected ? copy.selected : owned ? copy.owned : copy.price(item.price);
      return `<li><button class="profile-tile${selected ? ' is-selected' : ''}" data-item="${item.id}" data-car="${item.id}" aria-haspopup="dialog" aria-label="${esc(`${item.name}, ${status}${owned ? '' : `, ${copy.locked}`}`)}"><span class="profile-tile-art">${itemArt(item)}</span><b>${esc(item.name)}</b><span class="profile-tile-state">${selected ? icon('check') : !owned ? lock : ''}${status}</span></button></li>`;
    }).join('');
  }

  function renderDetail(item: Item) {
    const state = collectionState();
    const selected = state.selected === item.id;
    const shortfall = Math.max(0, item.price - state.available);
    const action = selected ? copy.selected : owns(item) ? copy.use : shortfall ? copy.need(shortfall) : copy.buy(item.price);
    page.querySelector('#profile-item-title')!.textContent = item.name;
    page.querySelector('[data-item-detail]')!.innerHTML = `<div class="profile-detail-art">${itemArt(item)}</div><p>${esc(item.description)}</p><button class="ui-button" data-item-action${selected || (!owns(item) && shortfall) ? ' disabled' : ''}>${action}</button>`;
  }
  function renderLibrary() {
    for (const kind of ['liked', 'saved'] as const) {
      const tab = page.querySelector<HTMLButtonElement>(`[data-library-tab="${kind}"]`)!;
      tab.setAttribute('aria-selected', String(library === kind));
      tab.tabIndex = library === kind ? 0 : -1;
      page.querySelector(`[data-library-count="${kind}"]`)!.textContent = String(CLIPS.filter(clip => marked(kind, clip.id)).length);
    }
    const lessons = CLIPS.filter(clip => marked(library, clip.id));
    const panel = page.querySelector<HTMLElement>('[data-library-panel]')!;
    panel.setAttribute('aria-labelledby', `profile-tab-${library}`);
    const symbol = library === 'liked' ? heart : icon('bookmark');
    panel.innerHTML = lessons.length ? `<ul>${lessons.map(clip => `<li><a href="#/feed/${esc(clip.id)}"><span class="profile-heart">${symbol}</span><span><small>${esc(clip.topic)}</small><b>${esc(clip.title)}</b></span><span aria-hidden="true">→</span></a>${library === 'saved' ? `<button class="profile-unsave" data-unsave="${esc(clip.id)}" aria-label="Remove ${esc(clip.title)} from saved lessons">${icon('bookmark')}</button>` : ''}</li>`).join('')}</ul>` : `<div class="profile-likes-empty">${symbol}<p>${library === 'liked' ? copy.likesEmpty : copy.savedEmpty}</p><a href="#/feed">${copy.explore} <span aria-hidden="true">→</span></a></div>`;
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
  // Rendering replaces the tile. Return focus to its new node once the native sheet closes.
  detailDialog.addEventListener('close', () => { if (detail) tile(detail)?.focus({ preventScroll: true }); });
  dialog.addEventListener('close', () => {
    pending = undefined;
    if (detailDialog.open) detailDialog.querySelector<HTMLButtonElement>('[data-item-action]')?.focus({ preventScroll: true });
  });
  const onClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const kind = event.target.closest<HTMLElement>('[data-library-tab]')?.dataset.libraryTab;
    if (kind === 'liked' || kind === 'saved') { library = kind; renderLibrary(); }
    const remove = event.target.closest<HTMLElement>('[data-unsave]');
    if (remove?.dataset.unsave) {
      toggleMark('saved', remove.dataset.unsave);
      renderLibrary();
      (page.querySelector<HTMLElement>('[data-unsave]') ?? page.querySelector<HTMLElement>('#profile-tab-saved')!).focus({ preventScroll: true });
    }
    if (event.target.closest('[data-jump]')) {
      event.preventDefault();
      const section = page.querySelector<HTMLElement>('.profile-collection')!;
      section.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      section.focus({ preventScroll: true });
    }
    const id = event.target.closest<HTMLElement>('[data-item]')?.dataset.item;
    const item = id ? carById(id) : undefined;
    if (item) { detail = item; renderDetail(item); sheet.open(); }
    if (event.target.closest('[data-item-action]') && detail) {
      if (owns(detail)) {
        if (select(detail)) { renderCollection(); sheet.close(); feedback(detail, false); }
      } else if (collectionState().available >= detail.price) {
        pending = detail;
        page.querySelector('[data-purchase-art]')!.innerHTML = itemArt(detail);
        page.querySelector('#profile-purchase-title')!.textContent = detail.name;
        page.querySelector('[data-purchase-price]')!.textContent = copy.price(detail.price);
        page.querySelector('[data-purchase-balance]')!.textContent = copy.purchaseBalance(collectionState().available - detail.price, s.xpTotal);
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
    const modal = dialog.open ? dialog : detailDialog.open ? detailDialog : undefined;
    if (event.key === 'Tab' && modal) {
      const controls = [...modal.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]')].filter(control => control.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (first && last && (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
      return;
    }
    if (!(event.target instanceof Element) || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    if (event.target.matches('[data-library-tab]')) {
      event.preventDefault();
      library = event.key === 'Home' ? 'liked' : event.key === 'End' ? 'saved' : library === 'liked' ? 'saved' : 'liked';
      renderLibrary();
      page.querySelector<HTMLButtonElement>(`[data-library-tab="${library}"]`)!.focus();

    }
  };
  renderCollection();
  renderLibrary();
  page.addEventListener('click', onClick);
  page.addEventListener('keydown', onKeydown);
  page.querySelector<HTMLElement>('main')!.focus({ preventScroll: true });
  return { dispose() { clearTimeout(feedbackTimer); feedbackAnimations.forEach(animation => animation.cancel()); page.removeEventListener('click', onClick); page.removeEventListener('keydown', onKeydown); dialog.close(); sheet.dispose(); page.remove(); } };
}
