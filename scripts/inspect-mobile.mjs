// Phone audit: every screen and dialog on real phone viewports, in WebKit (Safari's engine) and
// Chromium, plus an iPhone opened from the home screen with notch and home-indicator insets.
// Run against `npm run build && npm run preview`. Screenshots, contact sheets and a JSON report go to
// artifacts/mobile/. Emulation catches layout faults; it does not prove performance on a real phone.
import { chromium, webkit, devices } from '@playwright/test';
import fs from 'node:fs/promises';
import { CLIPS } from '../src/feed/clips.ts';
import { LEARNING } from '../src/content/learning.ts';

const BASE = process.env.BASE ?? 'http://127.0.0.1:4173/';
const OUT = 'artifacts/mobile';
const CHROMIUM = process.env.CHROMIUM ?? '/Users/hamza/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const ONLY = process.env.PHONES?.split(',');
const PHONES = [
  { name: 'iphone-se', device: 'iPhone SE', engine: 'webkit' },
  { name: 'iphone-13-mini', device: 'iPhone 13 Mini', engine: 'webkit' },
  { name: 'iphone-15', device: 'iPhone 15', engine: 'webkit' },
  { name: 'iphone-16-pro-max', device: 'iPhone 16 Pro Max', engine: 'webkit' },
  // Added to the home screen: the whole screen, with the status bar and home indicator as insets.
  { name: 'iphone-15-home-screen', device: 'iPhone 15', engine: 'webkit', standalone: { width: 393, height: 852, top: 59, bottom: 34 } },
  { name: 'iphone-15-landscape', device: 'iPhone 15 landscape', engine: 'webkit' },
  { name: 'galaxy-s8', device: 'Galaxy S8', engine: 'chromium' },
  { name: 'pixel-7', device: 'Pixel 7', engine: 'chromium' },
  { name: 'galaxy-a55', device: 'Galaxy A55', engine: 'chromium' },
].filter(phone => !ONLY || ONLY.includes(phone.name));

const day = offset => { const date = new Date(); date.setDate(date.getDate() - offset); return date.toLocaleDateString('en-CA'); };
const PROGRESSED = {
  xp: 60, daily: { [day(0)]: 30, [day(1)]: 30 }, dailyGoal: 50,
  clips: Object.fromEntries(['lane-end-scan', 'after-collision', 'emergency-kit', 'front-curb', 'dark-signal', 'emergency-pull-right'].map((id, i) => [id, { tries: i % 2 ? 2 : 1, firstTry: !(i % 2), done: true }])),
  liked: ['lane-end-scan', 'high-beams', 'freeway-entry'], saved: ['after-collision', 'blind-spot-check', 'stopping-distance'],
};

// Runs in the page: layout faults that a phone user would see.
function audit() {
  const vw = innerWidth, problems = [];
  const describe = el => {
    const text = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}${text ? ` "${text}"` : ''}`;
  };
  const shown = el => {
    if (el.closest('[inert],[aria-hidden="true"],dialog:not([open])')) return false;
    const details = el.closest('details:not([open])');
    if (details && !el.closest('summary')) return false;
    for (let node = el; node instanceof Element; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  };
  // Inside an open modal, only the modal counts; the page behind it is inert to the user.
  const modal = [...document.querySelectorAll('dialog[open]')].at(-1) ?? document.querySelector('.has-sheet .lane-sheet');
  const scope = modal ?? document.body;
  if (document.scrollingElement.scrollWidth > vw + 1) problems.push(`page scrolls sideways: ${document.scrollingElement.scrollWidth}px wide in a ${vw}px screen`);
  for (const el of scope.querySelectorAll('*')) {
    if (!shown(el) || el.closest('svg')) continue;
    const rect = el.getBoundingClientRect();
    if (rect.right > vw + 1 || rect.left < -1) {
      let clipped = false;
      for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const style = getComputedStyle(parent), box = parent.getBoundingClientRect();
        if (/auto|scroll|hidden|clip/.test(style.overflowX) && box.left >= -1 && box.right <= vw + 1) { clipped = true; break; }
      }
      if (!clipped) problems.push(`off screen sideways (${Math.round(rect.left)}→${Math.round(rect.right)}): ${describe(el)}`);
    }
    const style = getComputedStyle(el);
    const leaf = [...el.childNodes].some(node => node.nodeType === 3 && node.textContent.trim());
    if (leaf && (/hidden|clip/.test(style.overflowX) || style.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1) problems.push(`text cut off: ${describe(el)}`);
  }
  const controls = [...scope.querySelectorAll('a[href],button,[role="tab"],summary,label:has(input)')].filter(shown);
  for (const el of controls) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 43.5 || rect.height < 43.5) problems.push(`tap target ${Math.round(rect.width)}×${Math.round(rect.height)}: ${describe(el)}`);
  }
  for (const el of scope.querySelectorAll('input:not([type=radio]):not([type=checkbox]),select,textarea')) {
    if (shown(el) && parseFloat(getComputedStyle(el).fontSize) < 16) problems.push(`iOS zooms when focusing (font under 16px): ${describe(el)}`);
  }
  return { problems, controls: controls.length };
}

// Scrolls each control to the middle of its scroller and checks that a tap there reaches it,
// which catches controls stuck under the tab bar, a fixed header, or another layer.
async function reachability(page) {
  return page.evaluate(async () => {
    const problems = [];
    const modal = [...document.querySelectorAll('dialog[open]')].at(-1) ?? document.querySelector('.has-sheet .lane-sheet');
    const scope = modal ?? document.body;
    const controls = [...scope.querySelectorAll('a[href],button,[role="tab"],summary,label:has(input)')].filter(el => {
      if (el.closest('[inert],[aria-hidden="true"],dialog:not([open])')) return false;
      if (el.closest('details:not([open])') && !el.closest('summary')) return false;
      const style = getComputedStyle(el);
      return el.getClientRects().length && style.visibility !== 'hidden';
    });
    for (const el of controls) {
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      await new Promise(requestAnimationFrame);
      const rect = el.getBoundingClientRect();
      const x = Math.min(innerWidth - 2, Math.max(1, rect.left + rect.width / 2)), y = Math.min(innerHeight - 2, Math.max(1, rect.top + rect.height / 2));
      if (rect.bottom < 0 || rect.top > innerHeight) { problems.push(`cannot scroll into view: ${el.outerHTML.slice(0, 90)}`); continue; }
      const hit = document.elementFromPoint(x, y);
      if (hit && !el.contains(hit) && !hit.contains(el)) problems.push(`covered by ${hit.tagName.toLowerCase()}.${String(hit.className).split(' ')[0]}: ${(el.getAttribute('aria-label') || el.textContent).trim().replace(/\s+/g, ' ').slice(0, 40)}`);
    }
    return problems;
  });
}

const report = {};
const shots = {};
const browsers = { webkit: await webkit.launch(), chromium: await chromium.launch({ executablePath: CHROMIUM, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] }) };
await fs.mkdir(OUT, { recursive: true });

for (const phone of PHONES) {
  const descriptor = devices[phone.device];
  const viewport = phone.standalone ? { width: phone.standalone.width, height: phone.standalone.height } : descriptor.viewport;
  for (const state of ['fresh', 'progressed']) {
    const context = await browsers[phone.engine].newContext({ ...descriptor, viewport, reducedMotion: 'reduce', serviceWorkers: 'block', timezoneId: 'America/Los_Angeles' });
    if (phone.standalone) {
      // env() insets can't be emulated directly, so the stylesheet gets the iPhone's real values.
      await context.route('**/*.css', async route => {
        const response = await route.fetch();
        const css = (await response.text()).replaceAll('env(safe-area-inset-top)', `${phone.standalone.top}px`).replaceAll('env(safe-area-inset-bottom)', `${phone.standalone.bottom}px`);
        await route.fulfill({ response, body: css });
      });
    }
    await context.addInitScript(([seed]) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); if (seed) localStorage.setItem('roadloop-progress', JSON.stringify(seed)); sessionStorage.setItem('seeded', '1'); } }, [state === 'progressed' ? PROGRESSED : null]);
    // Onboarding has its own captures below; the walkthrough itself starts as a learner who finished it.
    await context.addInitScript((() => { if (!localStorage.getItem('roadloop-progress')) localStorage.setItem('roadloop-progress', JSON.stringify({ settings: { onboardedAt: '2026-10-16T00:00:00.000Z', termsAcceptedAt: '2026-10-16T00:00:00.000Z', goal: 'other' } })); }));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(`page error: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error' && !/videos\/|Failed to load resource/.test(message.text())) errors.push(`console: ${message.text()}`); });
    const key = `${phone.name}/${state}`;
    report[key] = { engine: phone.engine, viewport, screens: {} };
    const settle = async () => { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(350); };
    const capture = async (screen, { reach = false } = {}) => {
      await settle();
      const file = `${OUT}/${phone.name}-${state}-${screen}.png`;
      await page.screenshot({ path: file });
      (shots[screen] ??= []).push({ file: file.replace(`${OUT}/`, ''), label: `${phone.name} ${state}` });
      const result = await page.evaluate(audit);
      if (reach) result.problems.push(...await reachability(page));
      report[key].screens[screen] = result.problems;
    };
    const open = async hash => { await page.goto(`${BASE}${hash}`); await page.waitForSelector('#app > *'); await settle(); };
    const scroller = selector => page.evaluate(sel => { const el = document.querySelector(sel); el.scrollTop = el.scrollHeight; }, selector);
    try {
      await open('#/home');
      await capture('home', { reach: true });
      await page.evaluate(() => document.querySelector('.home-preview').scrollTop = 0);
      await scroller('.home-preview'); await capture('home-bottom');
      await page.locator('[data-menu]').click(); await capture('home-menu', { reach: true });
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      if (state === 'fresh') {
        // Onboarding on a clean device: both steps fit the phone without sideways scrolling.
        const welcome = await (await browsers[phone.engine].newContext({ ...descriptor, viewport, reducedMotion: 'reduce', serviceWorkers: 'block' })).newPage();
        await welcome.goto(`${BASE}#/home`); await welcome.waitForURL(/#\/welcome$/); await welcome.getByRole('heading', { name: 'Welcome to Lane' }).waitFor();
        for (const step of [1, 2]) {
          await welcome.waitForTimeout(350);
          const file = `${OUT}/${phone.name}-${state}-welcome-${step}.png`;
          await welcome.screenshot({ path: file });
          (shots[`welcome-${step}`] ??= []).push({ file: file.replace(`${OUT}/`, ''), label: `${phone.name} ${state}` });
          if (await welcome.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) report[key].screens[`welcome-${step}`] = ['horizontal overflow'];
          if (step === 1) { await welcome.locator('.welcome-check input').check(); await welcome.locator('[data-account] button[type="submit"]').click(); await welcome.getByRole('heading', { name: 'What’s your main goal?' }).waitFor(); }
        }
        await welcome.context().close();
      }

      await open('#/progress');
      const nextSign = await page.evaluate(() => {
        const next = document.querySelector('.path-sign[aria-current="step"]');
        if (!next) return null;
        const box = next.getBoundingClientRect(), panel = document.querySelector('.path-dashboard').getBoundingClientRect(), nav = document.querySelector('.home-nav').getBoundingClientRect();
        return { top: Math.round(box.top), bottom: Math.round(box.bottom), panel: Math.round(panel.bottom), nav: Math.round(nav.top) };
      });
      await capture('progress', { reach: true });
      if (nextSign && (nextSign.top < nextSign.panel || nextSign.bottom > nextSign.nav)) report[key].screens.progress.push(`next sign not fully visible: sign ${nextSign.top}–${nextSign.bottom}, visible road ${nextSign.panel}–${nextSign.nav}`);
      // The next sign starts its lesson directly; any other sign opens lesson details.
      await page.locator('button.path-sign').first().click({ timeout: 5000 }); await page.locator('.path-sheet[open]').waitFor(); await page.waitForTimeout(450); await capture('progress-lesson-sheet', { reach: true });
      await page.keyboard.press('Escape');
      await page.locator('[data-badges]:visible').first().click(); await capture('progress-milestones');
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);

      await open('#/feed/lane-end-scan');
      await capture('feed-video', { reach: true });
      await page.locator('.lane-clip.is-current .lane-rule summary').click(); await capture('feed-rule');
      await page.locator('.lane-clip.is-current .lane-about-open').click(); await capture('feed-about', { reach: true });
      await page.keyboard.press('Escape');
      // Swiping on before the clip ends asks "Are you sure?" (a new learner hasn't finished lesson 1).
      if (state === 'fresh') {
        await page.evaluate(() => { const feed = document.querySelector('.lane-feed'); const current = feed.querySelector('.is-current'); feed.scrollTop = current.offsetTop + current.offsetHeight; });
        await page.locator('.lane-sheet[aria-hidden="false"] [data-gate-stay]').waitFor({ timeout: 5000 }); await page.waitForTimeout(450); await capture('feed-are-you-sure', { reach: true });
        // Keep watching closes it; the open gate holds the /quiz address, so the next step would otherwise be a same-URL visit.
        await page.locator('.lane-sheet[aria-hidden="false"] [data-gate-stay]').click();
        await page.waitForFunction(() => location.hash === '#/feed/lane-end-scan');
      }
      await open('#/feed/lane-end-scan/quiz'); await capture('feed-quiz', { reach: true });
      // Answer wrong first, then the similar question right, to see both feedback states.
      await page.locator(`[data-answer="${(CLIPS[0].answer + 1) % 4}"]`).click(); await capture('feed-quiz-wrong', { reach: true });
      await page.locator('[data-similar]').click(); await capture('feed-quiz-similar', { reach: true });
      await page.locator(`[data-answer="${LEARNING[CLIPS[0].id].similar.answer}"]`).click();
      await capture('feed-quiz-right', { reach: true });
      await page.locator('[data-continue]').click(); await capture('feed-complete', { reach: true });
      await open('#/feed/yellow-light'); await capture('feed-poster');
      await open('#/feed/yellow-light/quiz');
      const yellow = CLIPS.find(clip => clip.id === 'yellow-light');
      for (const answer of [yellow.answer, yellow.followUp.answer]) { await page.locator(`[data-answer="${answer}"]`).click(); await page.locator('[data-continue]').click(); }
      await capture('feed-complete-practice', { reach: true });
      // A lower-stakes lesson is checked with a flashcard; challenges run in their feed card.
      if (state === 'fresh') {
        await open('#/feed/emergency-kit/quiz'); await capture('feed-flashcard', { reach: true });
        await page.locator('[data-recall-show]').click(); await capture('feed-flashcard-back', { reach: true });
      }
      await open('#/feed/school-bus'); await capture('feed-text-lesson', { reach: true });
      await page.locator('.is-current [data-comments]').click(); await page.locator('.lane-comments[open]').waitFor(); await capture('feed-comments', { reach: true });
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      await open('#/buddies'); await capture('buddies', { reach: true });
      await open('#/feed/sim/four-way-stop'); await capture('feed-challenge-card', { reach: true });
      await page.locator('.is-current [data-sim-start]').click(); await page.locator('[data-start]').waitFor({ timeout: 20000 }); await page.waitForTimeout(600); await capture('feed-challenge-running');
      await open('#/review'); await capture('review', { reach: true });
      await open('#/settings'); await capture('settings', { reach: true });
      await open('#/credits'); await capture('credits');
      await open('#/privacy'); await capture('privacy');
      await open('#/feed/sim/railroad-clear-exit');
      await page.evaluate(() => { const feed = document.querySelector('.lane-feed'); feed.scrollTop = feed.scrollHeight; });
      await page.waitForTimeout(500); await capture('feed-end');

      await open('#/lesson-progress'); await capture('summary', { reach: true });
      await scroller('.lane-summary'); await capture('summary-bottom');

      await open('#/practice'); await capture('practice', { reach: true });
      await scroller('.home-preview'); await capture('practice-bottom');
      await open('#/practice/test'); await capture('practice-question', { reach: true });
      await page.locator('.pt-option').first().click(); await page.locator('[data-action]').click(); await capture('practice-feedback', { reach: true });
      await page.locator('[data-exit]').click(); await capture('practice-leave', { reach: true });
      await page.locator('.home-dialog-done').click();
      // Answer the rest to reach results, capturing the first sign question on the way.
      let sign = false;
      while (await page.locator('[data-action]').count()) {
        await page.locator('[data-action]').click();
        if (!await page.locator('.pt-option').count()) break;
        if (!sign && await page.locator('.pt-sign').count()) { await page.waitForFunction(() => document.querySelector('.pt-sign img').complete); await capture('practice-sign'); sign = true; }
        await page.locator('.pt-option').first().click();
        await page.locator('[data-action]').click();
      }
      await capture('practice-results', { reach: true });
      await page.evaluate(() => { const el = document.querySelector('.home-preview'); el.scrollTop = el.scrollHeight; }); await capture('practice-results-bottom');

      await open('#/profile'); await capture('profile', { reach: true });
      await page.evaluate(() => document.querySelector('.profile-collection').scrollIntoView()); await capture('profile-garage');
      await scroller('.home-preview'); await capture('profile-bottom');
      if (state === 'progressed') {
        await page.locator('[data-car="sedan"]').click(); await capture('profile-item', { reach: true });
        await page.locator('[data-item-action]').click(); await capture('profile-purchase', { reach: true });
        await page.locator('[data-cancel]').click();
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('.profile-item-sheet').open);
        await page.locator('[data-jump]').click(); await capture('profile-garage', { reach: true });
        await page.locator('[data-car="pickup"]').click(); await capture('profile-car-detail', { reach: true });
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('.profile-item-sheet').open);
        await page.locator('[data-library-tab="saved"]').click(); await scroller('.home-preview'); await capture('profile-saved');
      }
    } catch (error) {
      errors.push(`walkthrough stopped: ${error.message.split('\n')[0]}`);
      await page.screenshot({ path: `${OUT}/${phone.name}-${state}-FAILED.png` }).catch(() => {});
    }
    report[key].errors = errors;
    await context.close();
    console.log(`${key}: ${Object.values(report[key].screens).flat().length} layout notes, ${errors.length} errors`);
  }
}

// One contact sheet per screen, so every phone can be compared side by side.
const sheetPage = await (await browsers.chromium.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
for (const [screen, list] of Object.entries(shots)) {
  const html = `<body style="margin:0;background:#888;font:12px system-ui"><div style="display:flex;flex-wrap:wrap;gap:10px;padding:10px;align-items:flex-start">${list.map(shot => `<figure style="margin:0;background:#fff;padding:4px"><img src="file://${process.cwd()}/${OUT}/${shot.file}" style="height:420px;display:block"><figcaption>${shot.label}</figcaption></figure>`).join('')}</div></body>`;
  await fs.writeFile(`${OUT}/sheet-${screen}.html`, html);
  await sheetPage.goto(`file://${process.cwd()}/${OUT}/sheet-${screen}.html`);
  await sheetPage.screenshot({ path: `${OUT}/sheet-${screen}.png`, fullPage: true });
}
await fs.writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));
await Promise.all(Object.values(browsers).map(browser => browser.close()));

// Summarize unique problems across phones.
const tally = new Map();
for (const [key, entry] of Object.entries(report)) {
  for (const [screen, problems] of Object.entries(entry.screens)) for (const problem of problems) {
    const id = `${screen}: ${problem}`;
    tally.set(id, [...(tally.get(id) ?? []), key]);
  }
  for (const error of entry.errors) tally.set(`ERROR ${error}`, [...(tally.get(`ERROR ${error}`) ?? []), key]);
}
for (const [problem, where] of [...tally].sort()) console.log(`- ${problem}  [${where.length}: ${[...new Set(where.map(w => w.split('/')[0]))].join(', ')}]`);
