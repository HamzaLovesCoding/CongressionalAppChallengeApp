import './feed/feed.css';
import { clipById } from './feed/clips';
import { mountFeed } from './feed/feed';
import { mountProgress } from './feed/screens';
import { mountDrive } from './drive';
import type { View } from './navigation';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('App root not found');

// Hash routes keep every screen on the one precached index.html, so deep links work offline:
// #/feed/:clip[/quiz], #/drive[/:clip], #/progress. Old answered links open the quiz.
let view: View | null = null;
const route = () => {
  view?.dispose();
  root.replaceChildren();
  const [name, id, part] = location.hash.replace(/^#\/?/, '').split('/');
  const clip = clipById(id);
  if (name === 'drive') view = mountDrive(root, clip?.id);
  else if (name === 'answered' && clip) view = mountFeed(root, { id: clip.id, quiz: true });
  else if (name === 'progress') view = mountProgress(root);
  else view = mountFeed(root, clip && { id: clip.id, quiz: part === 'quiz' });
};
window.addEventListener('hashchange', route);
route();

// Dev is left uncached so the service worker never serves a stale build while iterating.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}
