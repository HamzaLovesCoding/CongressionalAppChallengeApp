import './profile.css';
import type { View } from '../navigation';
import { CLIPS } from '../feed/clips';
import { avatarState, buyAvatar, marked, selectAvatar, stats } from '../feed/progress';
import { homeNavigation } from '../home/tabs';
import { icon } from '../home/icons';
import { AVATARS, avatarById } from './avatars';
import { PROFILE_COPY as copy } from './content';

const esc = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const heart = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 4c-3-2-6-1-8 2-2-3-5-4-8-2-4 3-2 8 1 11l7 6 7-6c3-3 5-8 1-11Z"/></svg>';
const lock = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></svg>';

export function mountProfile(root: HTMLElement): View {
  const s = stats();
  const liked = CLIPS.filter(clip => marked('liked', clip.id));
  const page = document.createElement('div');
  page.className = 'home-preview profile-page';
  page.innerHTML = `<div class="home-phone"><main class="profile-content" aria-label="Profile" tabindex="-1">
    <header class="profile-heading"><h1>${copy.title}</h1><p>${copy.intro}</p></header>
    <section class="profile-identity" aria-label="Current avatar"><div class="profile-avatar-halo"><img data-current-avatar width="116" height="116"></div><div><p>${copy.avatarLabel}</p><h2 data-avatar-name></h2><a href="#profile-avatars" data-jump>Change avatar <span aria-hidden="true">↓</span></a></div></section>
    <section class="profile-stats" aria-labelledby="profile-stats-title"><h2 id="profile-stats-title">${copy.stats}</h2>
      <dl class="profile-metrics">
        <div><dt>${icon('progress')}Total XP</dt><dd data-profile-xp>${s.xpTotal}</dd><span>earned</span></div>
        <div><dt>${icon('flame')}Streak</dt><dd data-profile-streak>${s.streak}</dd><span>${s.streak === 1 ? 'day' : 'days'}</span></div>
        <div><dt>${icon('clock')}Days practiced</dt><dd data-profile-days>${s.daysPracticed}</dd><span>in total</span></div>
      </dl>
      <div class="profile-accuracy"><span class="profile-accuracy-icon">${icon('check')}</span><div><h3>${copy.accuracy}</h3><p>${s.attempted ? `${s.firstTryRight} of ${s.attempted} lesson${s.attempted === 1 ? '' : 's'} attempted` : copy.accuracyEmpty}</p></div><strong data-profile-accuracy${s.firstTryPercentage === null ? ' aria-label="No attempts yet"' : ''}>${s.firstTryPercentage === null ? '—' : `${s.firstTryPercentage}%`}</strong></div>
      <p class="profile-footnote">${copy.daysNote}</p>
      ${!s.attempted && !s.xpTotal ? `<div class="profile-new"><p>${copy.empty}</p><a href="#/feed">${copy.start} <span aria-hidden="true">→</span></a></div>` : ''}
    </section>
    <section class="profile-collection" aria-labelledby="profile-avatars" tabindex="-1">
      <div class="profile-section-heading"><div><h2 id="profile-avatars">${copy.shopTitle}</h2><p>${copy.shopDetail}</p></div></div>
      <div class="profile-wallet"><span>${copy.balanceLabel}</span><strong data-available></strong></div>
      <ul class="profile-avatars" data-avatar-list></ul>
      <p class="profile-footnote">${copy.balanceNote}</p>
      <p class="profile-status" role="status" aria-live="polite" data-avatar-status></p>
    </section>
    <section class="profile-likes" aria-labelledby="profile-likes-title"><div class="profile-section-heading"><h2 id="profile-likes-title">${copy.likesTitle}</h2><span class="profile-like-count">${liked.length}</span></div>
      ${liked.length ? `<ul>${liked.map(clip => `<li><a href="#/feed/${esc(clip.id)}"><span class="profile-heart">${heart}</span><span><small>${esc(clip.topic)}</small><b>${esc(clip.title)}</b></span><span aria-hidden="true">→</span></a></li>`).join('')}</ul>` : `<div class="profile-likes-empty">${heart}<p>${copy.likesEmpty}</p><a href="#/feed">${copy.explore} <span aria-hidden="true">→</span></a></div>`}
    </section>
  </main>${homeNavigation('profile')}
  <dialog class="profile-purchase" aria-labelledby="profile-purchase-title"><form method="dialog"><button class="profile-close" aria-label="Close avatar purchase">×</button></form><img data-purchase-image width="120" height="120" alt=""><p>${copy.purchaseTitle}</p><h2 id="profile-purchase-title"></h2><p data-purchase-description></p><div class="profile-purchase-total"><span>Price</span><strong data-purchase-price></strong></div><p data-purchase-balance></p><p class="profile-footnote">${copy.purchaseNote}</p><button class="profile-primary" data-confirm></button><button class="profile-cancel" data-cancel>Maybe later</button></dialog>
  </div>`;
  root.append(page);
  const dialog = page.querySelector<HTMLDialogElement>('.profile-purchase')!;
  let pending: string | undefined;
  let opener: string | undefined;

  function renderAvatars() {
    const state = avatarState();
    const current = avatarById(state.selected)!;
    const image = page.querySelector<HTMLImageElement>('[data-current-avatar]')!;
    image.src = current.image;
    image.alt = `${current.name}, your selected avatar`;
    page.querySelector('[data-avatar-name]')!.textContent = current.name;
    page.querySelector('[data-available]')!.textContent = `${state.available} XP`;
    page.querySelector('[data-avatar-list]')!.innerHTML = AVATARS.map(avatar => {
      const owned = state.owned.includes(avatar.id);
      const selected = state.selected === avatar.id;
      const locked = !owned && state.available < avatar.price;
      return `<li class="profile-avatar-card${selected ? ' is-selected' : ''}${locked ? ' is-unaffordable' : ''}">
        <div class="profile-avatar-art"><img src="${avatar.image}" alt="" width="88" height="88">${selected ? `<span class="profile-avatar-badge">${icon('check')}</span>` : locked ? `<span class="profile-avatar-badge">${lock}</span>` : ''}</div>
        <h3>${avatar.name}</h3><p>${owned ? avatar.price ? `Owned · ${avatar.price} XP` : 'Free · Owned' : `${avatar.price} XP`}</p>
        <button data-avatar="${avatar.id}"${owned ? ` aria-pressed="${selected}"` : ''}${locked ? ' aria-disabled="true"' : ''} aria-label="${selected ? `${avatar.name}, selected` : owned ? `Use ${avatar.name}` : locked ? `${avatar.name}, ${avatar.price} XP. Need ${avatar.price - state.available} more XP` : `Buy ${avatar.name} for ${avatar.price} XP`}">${selected ? 'Selected' : owned ? 'Use avatar' : locked ? `Need ${avatar.price - state.available} XP` : `Buy · ${avatar.price} XP`}</button>
      </li>`;
    }).join('');
  }
  const focusAvatar = () => { if (opener) page.querySelector<HTMLButtonElement>(`[data-avatar="${opener}"]`)?.focus({ preventScroll: true }); };
  dialog.addEventListener('close', () => { pending = undefined; focusAvatar(); });
  const onClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('[data-jump]')) {
      event.preventDefault();
      const collection = page.querySelector<HTMLElement>('.profile-collection')!;
      collection.scrollIntoView({ block: 'start' });
      collection.focus({ preventScroll: true });
    }
    if (event.target.closest('[data-cancel]')) dialog.close();
    const button = event.target.closest<HTMLButtonElement>('[data-avatar]');
    const avatar = button?.dataset.avatar ? avatarById(button.dataset.avatar) : undefined;
    if (avatar) {
      const state = avatarState();
      if (state.owned.includes(avatar.id)) {
        selectAvatar(avatar.id);
        opener = avatar.id;
        renderAvatars();
        focusAvatar();
        page.querySelector('[data-avatar-status]')!.textContent = `${avatar.name} is your avatar.`;
      } else if (state.available >= avatar.price) {
        pending = avatar.id;
        opener = avatar.id;
        page.querySelector<HTMLImageElement>('[data-purchase-image]')!.src = avatar.image;
        page.querySelector('#profile-purchase-title')!.textContent = avatar.name;
        page.querySelector('[data-purchase-description]')!.textContent = avatar.description;
        page.querySelector('[data-purchase-price]')!.textContent = `${avatar.price} XP`;
        page.querySelector('[data-purchase-balance]')!.textContent = `${state.available - avatar.price} XP available after purchase. Your ${s.xpTotal} earned XP stays the same.`;
        page.querySelector('[data-confirm]')!.textContent = `Buy & use · ${avatar.price} XP`;
        dialog.showModal();
      } else page.querySelector('[data-avatar-status]')!.textContent = copy.insufficient;
    }
    if (event.target.closest('[data-confirm]') && pending) {
      const purchased = avatarById(pending)!;
      const result = buyAvatar(pending);
      renderAvatars();
      dialog.close();
      page.querySelector('[data-avatar-status]')!.textContent = result === 'purchased' ? `${purchased.name} is yours and selected. ${avatarState().available} XP left to spend.` : result === 'owned' ? 'You already own this avatar.' : copy.insufficient;
    }
  };
  renderAvatars();
  page.addEventListener('click', onClick);
  page.querySelector<HTMLElement>('main')!.focus({ preventScroll: true });
  return { dispose() { page.removeEventListener('click', onClick); dialog.close(); page.remove(); } };
}
