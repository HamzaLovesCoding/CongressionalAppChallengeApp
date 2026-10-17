import { icon } from './icons';
import { bottomSheet, sheetMarkup, type Sheet } from './sheet';
import { MENU_LINKS } from './content';

// The gear menu (Streak buddies, Settings, Credits & sources). It sits on Home and Profile only.
export const menuButton = () => `<button class="home-circle" aria-label="Settings and more" data-menu>${icon('settings')}</button>`;

export const menuSheetMarkup = () => sheetMarkup('home-menu-sheet', 'home-menu-title', 'Menu', 'Close menu',
  `<nav class="home-menu-links" aria-label="Menu">${MENU_LINKS.map(link => `<a href="${link.href}">${icon(link.icon)}<span>${link.label}</span></a>`).join('')}</nav>`);

// Opens the sheet from the gear and closes it when a link is followed.
export function bindMenu(page: HTMLElement): Sheet {
  const sheet = bottomSheet(page.querySelector<HTMLDialogElement>('.home-menu-sheet')!);
  const onClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('[data-menu]')) sheet.open();
    if (event.target.closest('.home-menu-links a')) sheet.close();
  };
  page.addEventListener('click', onClick);
  return { open: sheet.open, close: sheet.close, dispose() { page.removeEventListener('click', onClick); sheet.dispose(); } };
}
