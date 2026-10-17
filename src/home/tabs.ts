import './home.css';
import { icon } from './icons';

export const HOME_TABS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'progress', label: 'Progress', icon: 'progress' },
  { id: 'feed', label: 'Feed', icon: 'feed' },
  { id: 'practice', label: 'Practice', icon: 'practice' },
  { id: 'profile', label: 'Profile', icon: 'profile' },
] as const;

type Tab = typeof HOME_TABS[number]['id'];

// Every tab shares this navigation so labels and destinations stay in sync.
export function homeNavigation(active: Tab) {
  return `<nav class="home-nav" aria-label="Main navigation">${HOME_TABS.map(tab => `<a href="#/${tab.id}"${tab.id === active ? ' aria-current="page"' : ''}><span class="home-nav-icon">${tab.id === active ? '<i class="home-nav-pill" aria-hidden="true"></i>' : ''}${icon(tab.icon)}</span><span>${tab.label}</span></a>`).join('')}</nav>`;
}

