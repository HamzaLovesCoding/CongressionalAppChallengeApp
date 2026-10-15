import './theme.css';
import './motion.css';
import './ui.css';
import './feed/feed.css';
import { clipById } from './feed/clips';
import { mountFeed } from './feed/feed';
import { mountProgress } from './feed/screens';
import { mountDrive } from './drive';
import { mountHome } from './home/home';
import { mountProfile } from './profile/profile';
import { mountLearningPath } from './progress/path';
import { mountPractice, mountPracticeTest } from './practice/practice';
import type { View } from './navigation';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('App root not found');

// Hash routes keep every screen on the one precached index.html, so deep links work offline:
// Home and tabs share this shell; full-screen lessons and driving retain their deep links.
let view: View | null = null;
const route = () => {
  view?.dispose();
  root.replaceChildren();
  const [name, id, part] = location.hash.replace(/^#\/?/, '').split('/');
  const clip = clipById(id);
  if (!name || name === 'home') view = mountHome(root);
  else if (name === 'drive') view = mountDrive(root, clip?.id);
  else if (name === 'answered' && clip) view = mountFeed(root, { id: clip.id, quiz: true });
  else if (name === 'practice') view = id === 'test' ? mountPracticeTest(root) : mountPractice(root);
  else if (name === 'progress') view = mountLearningPath(root);
  else if (name === 'profile') view = mountProfile(root);
  else if (name === 'lesson-progress') view = mountProgress(root);
  else view = mountFeed(root, clip && { id: clip.id, quiz: part === 'quiz' });
};

// Depth separates a push (tab → lesson/test) from a pop; tabs at the same depth slide by their order.
const TAB_ORDER = ['home', 'progress', 'practice', 'profile'];
function place(hash: string) {
  const [name = '', id] = hash.replace(/^#\/?/, '').split('/');
  const tab = TAB_ORDER.indexOf(name || 'home');
  if (name === 'drive') return { depth: 2, tab: -1 };
  if (tab < 0 || (name === 'practice' && id === 'test')) return { depth: 1, tab: -1 };
  return { depth: 0, tab };
}
// iOS swipe-back already animates the page; a second transition on top of it looks broken.
let systemAnimated = false;
window.addEventListener('popstate', event => { systemAnimated = event.hasUAVisualTransition; });
let transition: ViewTransition | null = null;
window.addEventListener('hashchange', event => {
  const from = place(new URL(event.oldURL).hash), to = place(location.hash);
  const skip = systemAnimated || !document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches
    // The simulator is WebGL plus a page-wide stylesheet; snapshotting it costs more than it shows.
    || from.depth === 2 || to.depth === 2;
  systemAnimated = false;
  if (skip) { route(); return; }
  const html = document.documentElement;
  html.dataset.nav = to.depth > from.depth ? 'push' : to.depth < from.depth ? 'pop'
    : to.tab >= 0 && from.tab >= 0 && to.tab !== from.tab ? (to.tab > from.tab ? 'next' : 'previous') : 'fade';
  const current = transition = document.startViewTransition(route);
  current.ready.catch(() => {});
  const clear = () => { if (transition === current) { delete html.dataset.nav; transition = null; } };
  current.finished.then(clear, clear);
});
route();

// Dev is left uncached so the service worker never serves a stale build while iterating.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(registration => {
      // A build installed during an earlier visit otherwise waits until every tab is closed, which on a
      // phone can take several launches. This page has only just loaded, so it switches now and reloads
      // once into the new build; the hash keeps the same screen.
      // Registration can come back empty where service workers are blocked (some test browsers, embedded views).
      if (!registration?.waiting || !navigator.serviceWorker.controller) return;
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
      registration.waiting.postMessage('skip-waiting');
    });
  });
}
