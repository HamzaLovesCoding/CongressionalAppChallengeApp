import './theme.css';
import './motion.css';
import './ui.css';
import './feed/feed.css';
import { CLIPS, clipById } from './feed/clips';
import { needsOnboarding, PROGRESS_EVENT } from './feed/progress';
import { appSync } from './data/sync';
import { mountFeed } from './feed/feed';
import { mountProgress } from './feed/screens';
import { go } from './navigation';
import { mountHome } from './home/home';
import { mountProfile } from './profile/profile';
import { mountLearningPath } from './progress/path';
import { mountPractice, mountPracticeTest } from './practice/practice';
import type { View } from './navigation';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('App root not found');

// Hash routes keep every screen on the one precached index.html, so deep links work offline:
// Home and tabs share this shell; full-screen lessons, simulations and menu screens keep their deep links.
let view: View | null = null;
// Menu screens load on first visit, so they add nothing to the first page load.
function lazy(load: () => Promise<(root: HTMLElement) => View>): View {
  let mounted: View | null = null, disposed = false;
  void load().then(mount => { if (!disposed) mounted = mount(root!); });
  return { dispose() { disposed = true; mounted?.dispose(); } };
}
const route = () => {
  view?.dispose();
  root.replaceChildren();
  const [name, id, part] = location.hash.replace(/^#\/?/, '').split('/');
  const clip = clipById(id);
  // A first launch starts with onboarding; shared lesson links still open directly.
  if ((!name || name === 'home') && needsOnboarding()) { go('#/welcome', true); return; }
  if (!name || name === 'home') view = mountHome(root);
  else if (name === 'welcome') { if (!needsOnboarding()) { go('#/home', true); return; } view = lazy(() => import('./pages/welcome').then(m => m.mountWelcome)); }
  // Simulations run inside the feed (owner direction, 2026-10-15); older links open them there.
  // The built-in yellow-light scene was replaced by the SIM-08 package.
  else if (name === 'sim') { go(`#/feed/sim/${id ?? ''}`, true); return; }
  else if (name === 'drive') { go('#/feed/sim/yellow-light-stop', true); return; }
  else if (name === 'answered' && clip) view = mountFeed(root, { id: clip.id, quiz: true });
  else if (name === 'practice' && id === 'coach') view = lazy(() => import('./coach/chat').then(m => m.mountCoach));
  else if (name === 'practice') view = id === 'test' ? mountPracticeTest(root) : mountPractice(root);
  else if (name === 'progress') view = mountLearningPath(root);
  else if (name === 'profile') view = mountProfile(root);
  else if (name === 'lesson-progress') view = mountProgress(root);
  else if (name === 'review') view = lazy(() => import('./pages/review').then(m => m.mountReview));
  else if (name === 'settings') view = lazy(() => import('./pages/settings').then(m => m.mountSettings));
  // Streak buddies were removed (owner, 2026-10-17); old links land on Home, where the Group board is.
  else if (name === 'buddies') { go('#/home', true); return; }
  else if (name === 'credits') view = lazy(() => import('./pages/legal').then(m => m.mountCredits));
  else if (name === 'privacy') view = lazy(() => import('./pages/legal').then(m => m.mountPrivacy));
  else if (name === 'terms') view = lazy(() => import('./pages/legal').then(m => m.mountTerms));
  else view = mountFeed(root, id === 'sim' ? { sim: part } : clip ? { id: clip.id, quiz: part === 'quiz' } : {});
};

// Depth separates a push (tab → lesson/test) from a pop; tabs at the same depth slide by their order.
const TAB_ORDER = ['home', 'progress', 'practice', 'profile'];
function place(hash: string) {
  const [name = '', id] = hash.replace(/^#\/?/, '').split('/');
  const tab = TAB_ORDER.indexOf(name || 'home');
  if (tab < 0 || (name === 'practice' && (id === 'test' || id === 'coach'))) return { depth: 1, tab: -1 };
  return { depth: 0, tab };
}
// iOS swipe-back already animates the page; a second transition on top of it looks broken.
let systemAnimated = false;
window.addEventListener('popstate', event => { systemAnimated = event.hasUAVisualTransition; });
let transition: ViewTransition | null = null;
window.addEventListener('hashchange', event => {
  const from = place(new URL(event.oldURL).hash), to = place(location.hash);
  const skip = systemAnimated || !document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches;
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

// Backs up progress when a backend is configured (no-op otherwise): at launch, shortly after
// progress changes, and when the app goes to the background.
const sync = appSync(CLIPS.map(clip => clip.id));
if (sync.configured) {
  let pending = 0;
  // Nothing reaches the server before the learner has agreed to the Terms in onboarding.
  const backup = () => { if (!needsOnboarding()) void sync.sync(); };
  backup();
  window.addEventListener(PROGRESS_EVENT, () => { clearTimeout(pending); pending = window.setTimeout(backup, 10_000); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearTimeout(pending); backup(); } });
}

// Dev is left uncached so the service worker never serves a stale build while iterating.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(registration => {
      // A build installed during an earlier visit otherwise waits until every tab is closed, which on a
      // phone can take several launches. This page has only just loaded, so it switches now and reloads
      // once into the new build; the hash keeps the same screen.
      // Registration can come back empty where service workers are blocked (some test browsers, embedded views).
      if (!registration?.waiting || !navigator.serviceWorker.controller) return;
      // Some browsers hand over only once the old worker is idle, which can be half a minute into a lesson;
      // a reload that late would throw away an answer in progress, so the new build then waits for the next launch.
      const asked = performance.now();
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (performance.now() - asked < 3000) location.reload(); }, { once: true });
      registration.waiting.postMessage('skip-waiting');
    });
  });
}
