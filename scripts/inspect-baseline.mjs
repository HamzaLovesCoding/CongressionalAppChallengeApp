// Visual baseline: every route at the five review viewports, fresh learner, no service worker.
// Run against `npm run build && npm run preview`; screenshots go to artifacts/baseline/<label>/.
import { chromium, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
// Onboarding is covered by inspect-home.mjs; this walkthrough starts as a learner who finished it.

const base = process.env.BASE ?? 'http://127.0.0.1:4173/';
const label = process.env.LABEL ?? 'before';
const out = `artifacts/baseline/${label}`;
const VIEWPORTS = [[360, 800], [390, 844], [375, 812], [768, 1024], [1366, 768]];
const ROUTES = [
  ['home', '#/home'],
  ['progress', '#/progress'],
  ['feed', '#/feed/lane-end-scan'],
  ['feed-rule-open', '#/feed/lane-end-scan', page => page.click('.lane-rule summary')],
  ['feed-poster-lesson', '#/feed/yellow-light'],
  ['practice', '#/practice'],
  ['practice-test', '#/practice/test'],
  ['profile', '#/profile'],
  ['lesson-progress', '#/lesson-progress'],
  ['review', '#/review'],
  ['settings', '#/settings'],
  ['credits', '#/credits'],
  ['privacy', '#/privacy'],
  ['terms', '#/terms'],
  ['home-menu', '#/home', page => page.click('[data-menu]')],
  ['quiz-menu', '#/feed/dark-signal/quiz', page => page.click('.lane-sheet [data-menu]')],
  ['feed-flashcard', '#/feed/emergency-kit/quiz'],
  ['sim-card', '#/feed/sim/four-way-stop'],
  ['sim-2d', '#/feed/sim/four-way-stop', async page => { await page.click('.is-current [data-sim-start]'); await page.waitForTimeout(1500); }],
  ['sim-3d', '#/feed/sim/freeway-entrance-merge', async page => { await page.click('.is-current [data-sim-start]'); await page.waitForTimeout(3000); }],
];

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const notes = [];
for (const [width, height] of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block', hasTouch: width < 800, isMobile: width < 800 });
  await context.addInitScript((() => { if (!localStorage.getItem('roadloop-progress')) localStorage.setItem('roadloop-progress', JSON.stringify({ settings: { onboardedAt: '2026-10-16T00:00:00.000Z', termsAcceptedAt: '2026-10-16T00:00:00.000Z', goal: 'other' } })); }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [name, hash, act] of ROUTES) {
    await page.goto(base + hash, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    if (act) await act(page).catch(error => errors.push(`${name}: ${error.message}`));
    await page.waitForTimeout(300);
    const facts = await page.evaluate(() => ({
      hash: location.hash,
      nav: Boolean(document.querySelector('nav[aria-label], .tabs, .lane-tabs, [role="navigation"]')),
      overflowX: document.documentElement.scrollWidth > innerWidth,
      // On-screen controls under 44px (DESIGN.md); inline text links and inert panels are excluded.
      smallTargets: [...document.querySelectorAll('button, a[href], input, [role="tab"]')].filter(el => { const r = (el.matches('input') && el.closest('label') || el).getBoundingClientRect(); return r.width && r.height && r.bottom > 0 && r.top < innerHeight && (r.width < 44 || r.height < 44) && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[inert], p, small, [aria-hidden="true"]'); }).map(el => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30)),
      blur: [...document.querySelectorAll('*')].some(el => /blur/.test(getComputedStyle(el).backdropFilter + getComputedStyle(el).filter)),
      heading: document.querySelector('h1, h2')?.textContent?.trim().slice(0, 60) ?? '',
    }));
    notes.push({ viewport: `${width}x${height}`, route: name, ...facts });
    await page.screenshot({ path: `${out}/${width}x${height}-${name}.png` });
  }
  if (errors.length) notes.push({ viewport: `${width}x${height}`, errors });
  await context.close();
}
await browser.close();

// WebKit at the narrowest phone: nothing on the menu screens may run past the column. The app column
// clips overflow, so the page-level check above cannot see it (a 20-character text input once pushed
// Settings' Save button off screen in Safari only).
const wk = await webkit.launch();
const narrow = await wk.newPage({ viewport: { width: 320, height: 568 } });
for (const hash of ['#/settings', '#/review', '#/credits', '#/privacy']) {
  await narrow.goto(base + hash, { waitUntil: 'load' });
  await narrow.waitForTimeout(500);
  const clipped = await narrow.evaluate(() => [...document.querySelectorAll('.sub-content *')].filter(el => el.getBoundingClientRect().right > innerWidth + 0.5).map(el => el.tagName + '.' + el.className).slice(0, 5));
  notes.push({ viewport: 'webkit-320x568', route: hash, clipped });
  if (clipped.length) throw new Error(`${hash} clips in WebKit at 320px: ${clipped.join(', ')}`);
}
await wk.close();
await writeFile(`${out}/notes.json`, JSON.stringify(notes, null, 2));
console.log(`${notes.length} records → ${out}/notes.json`);
