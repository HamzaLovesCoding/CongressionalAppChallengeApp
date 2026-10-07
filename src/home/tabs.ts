import './home.css';
import type { View } from '../navigation';
import { icon } from './icons';

export const HOME_TABS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'feed', label: 'Feed', icon: 'book' },
  { id: 'practice', label: 'Practice', icon: 'practice' },
  { id: 'progress', label: 'Progress', icon: 'progress' },
  { id: 'profile', label: 'Profile', icon: 'profile' },
] as const;

type Tab = typeof HOME_TABS[number]['id'];

// The home and blank tabs share navigation so labels and destinations stay in sync.
export function homeNavigation(active: Tab) {
  return `<nav class="home-nav" aria-label="Main navigation">${HOME_TABS.map(tab => `<a href="#/${tab.id}"${tab.id === active ? ' aria-current="page"' : ''}>${icon(tab.icon)}<span>${tab.label}</span></a>`).join('')}</nav>`;
}

export function mountBlankTab(root: HTMLElement, tab: 'profile'): View {
  const label = HOME_TABS.find(item => item.id === tab)!.label;
  const page = document.createElement('div');
  page.className = 'home-preview';
  page.innerHTML = `<div class="home-phone"><main class="home-empty" aria-label="${label}" tabindex="-1"></main>${homeNavigation(tab)}</div>`;
  root.append(page);
  page.querySelector<HTMLElement>('main')!.focus({ preventScroll: true });
  return { dispose() { page.remove(); } };
}
