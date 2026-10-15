// Video start-up check, run against `npm run build && npm run preview`:
// 1. WebKit (Safari's engine, iPhone 15 viewport): does every lesson clip actually play?
// 2. Chromium on a throttled phone connection: how long until the first frame when the feed opens,
//    and after each swipe while the previous clip played for a few seconds?
// Emulated networks approximate mobile data; a real phone on a real network is still the final check.
import { chromium, webkit, devices } from '@playwright/test';
import fs from 'node:fs/promises';
import { VIDEO_LESSONS } from '../src/feed/curriculum.ts';

const BASE = process.env.BASE ?? 'http://127.0.0.1:4173/';
const CHROMIUM = process.env.CHROMIUM ?? '/Users/hamza/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const LABEL = process.env.LABEL ?? 'current';
const NETWORKS = { 'LTE 9 Mbps': { latency: 70, down: 9e6 }, 'weak 3 Mbps': { latency: 150, down: 3e6 } };
const SWIPES = 6, WATCH_MS = 4000;

// Resolves when the current clip shows moving frames, or reports how it failed.
const started = () => new Promise(resolve => {
  const begin = performance.now();
  const check = () => {
    const media = document.querySelector('.is-current video');
    if (media && !media.paused && media.currentTime > 0.05) return resolve({ ok: true, ms: Math.round(performance.now() - begin), at: Math.round(performance.now()) });
    if (!media || media.error || !media.hasAttribute('src')) return resolve({ ok: false, why: media?.error ? `media error ${media.error.code}` : 'fell back to poster' });
    if (performance.now() - begin > 20000) return resolve({ ok: false, why: `stalled (readyState ${media.readyState})` });
    setTimeout(check, 25);
  };
  check();
});

const report = { label: LABEL, webkit: {}, chromium: {} };

const wk = await webkit.launch();
const wkContext = await wk.newContext({ ...devices['iPhone 15'], serviceWorkers: 'block' });
const wkPage = await wkContext.newPage();
for (const { id } of VIDEO_LESSONS) {
  await wkPage.goto(`${BASE}#/feed/${id}`);
  await wkPage.waitForSelector('.is-current');
  const result = await wkPage.evaluate(started);
  report.webkit[id] = result.ok ? 'plays' : result.why;
}
await wk.close();
const playing = Object.values(report.webkit).filter(result => result === 'plays').length;
console.log(`[${LABEL}] WebKit: ${playing}/${VIDEO_LESSONS.length} clips play`);
for (const [id, result] of Object.entries(report.webkit)) if (result !== 'plays') console.log(`  ✗ ${id}: ${result}`);

const cr = await chromium.launch({ executablePath: CHROMIUM, args: ['--autoplay-policy=no-user-gesture-required'] });
for (const [network, { latency, down }] of Object.entries(NETWORKS)) {
  const context = await cr.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency, downloadThroughput: down / 8, uploadThroughput: 1.5e6 / 8 });
  await page.goto(`${BASE}#/feed/${VIDEO_LESSONS[0].id}`);
  await page.waitForSelector('.is-current');
  // Opening the feed: measured from navigation start, so it includes loading the app itself.
  const open = await page.evaluate(started);
  const runs = [{ clip: VIDEO_LESSONS[0].id, ms: open.ok ? open.at : null, why: open.why }];
  for (let i = 1; i <= SWIPES; i++) {
    await page.waitForTimeout(WATCH_MS);
    // The feed switches clips on its (asynchronous) scroll event, so wait for the new current clip.
    const swipe = await page.evaluate(async () => {
      const feed = document.querySelector('.lane-feed'), from = document.querySelector('.is-current');
      feed.scrollTo({ top: from.nextElementSibling.offsetTop, behavior: 'instant' });
      while (document.querySelector('.is-current') === from) await new Promise(resolve => setTimeout(resolve, 5));
      return document.querySelector('.is-current').dataset.clip;
    });
    const result = await page.evaluate(started);
    runs.push({ clip: swipe, ms: result.ok ? result.ms : null, why: result.why });
  }
  report.chromium[network] = runs;
  console.log(`[${LABEL}] Chromium, ${network}: open feed → first frame ${runs[0].ms ?? runs[0].why} ms; swipes: ${runs.slice(1).map(run => `${run.clip} ${run.ms ?? run.why}${run.ms === null ? '' : 'ms'}`).join(', ')}`);
  await context.close();
}
await cr.close();
await fs.mkdir('artifacts', { recursive: true });
await fs.writeFile(`artifacts/video-load-${LABEL}.json`, JSON.stringify(report, null, 2));
