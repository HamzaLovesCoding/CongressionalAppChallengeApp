import '../home/home.css';
import './pages.css';
import type { View } from '../navigation';

const back = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg>';

// The shell for screens reached from the Home menu (Review, Settings, Credits, Privacy, Terms):
// the same page, column and return control as the practice test, with no tab bar.
// Options are fixed app strings, never learner data.
export function subpage(root: HTMLElement, options: { title: string; back: string; backLabel: string; className: string }): View & { body: HTMLElement } {
  const page = document.createElement('div');
  page.className = `home-preview lane-sub ${options.className}`;
  page.innerHTML = `<div class="home-phone"><main class="sub-content" aria-labelledby="sub-title" tabindex="-1">
    <header class="sub-top"><a class="home-circle" href="${options.back}" aria-label="${options.backLabel}">${back}</a><h1 id="sub-title">${options.title}</h1></header>
    <div class="sub-body"></div>
  </main></div>`;
  root.append(page);
  const main = page.querySelector<HTMLElement>('main')!;
  main.focus({ preventScroll: true });
  return { body: page.querySelector<HTMLElement>('.sub-body')!, dispose() { page.remove(); } };
}
