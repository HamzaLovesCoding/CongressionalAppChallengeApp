import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { CARS } from '../src/profile/cars.ts';
import { CLIPS } from '../src/feed/clips.ts';

const base = process.env.BASE ?? 'http://127.0.0.1:4173/';
// The identity card, next unlock and lesson list across real learner states, engines and text sizes.
const out = 'artifacts/profile-states';
await fs.mkdir(out, { recursive: true });
const browsers = {
  chromium: await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/Users/hamza/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' }),
  webkit: await webkit.launch({ executablePath: process.env.WEBKIT ?? '/Users/hamza/Library/Caches/ms-playwright/webkit-2359/pw_run.sh' }),
};
const day = ago => { const date = new Date(); date.setDate(date.getDate() - ago); return date.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }); };
const records = Object.fromEntries(CLIPS.slice(0, 3).map((clip, index) => [clip.id, { done: true, tries: index ? 1 : 2, firstTry: !!index }]));
const cases = [
  { name: 'fresh', seed: {}, badges: 0, balance: 0, value: 0, max: 15, next: 'sedan' },
  { name: 'pending', seed: { xp: 10, daily: { [day(1)]: 10 }, clips: records }, badges: 1, balance: 10, value: 10, max: 15, next: 'sedan' },
  { name: 'active', seed: { xp: 30, daily: { [day(0)]: 10, [day(1)]: 10, [day(2)]: 10 }, clips: records, settings: { displayAlias: 'road_runner_2026', goal: 'permit', permitTestDate: day(-30) } }, badges: 1, balance: 30, value: 15, max: 15, next: 'sedan' },
  { name: 'legacy-spending', seed: { xp: 40, spentXp: 25, ownedCars: ['hatchback', 'sedan'], ownedAvatars: ['sprout', 'sunny'], daily: { [day(3)]: 40 } }, badges: 0, balance: 15, value: 15, max: 25, next: 'wagon' },
  { name: 'last-car', seed: { xp: 180, spentXp: 120, ownedCars: CARS.slice(0, -1).map(car => car.id) }, badges: 0, balance: 60, value: 60, max: 60, next: 'classic-coupe' },
  { name: 'all-owned', seed: { xp: 240, spentXp: 180, ownedCars: CARS.map(car => car.id), clips: Object.fromEntries(CLIPS.map(clip => [clip.id, { done: true, tries: 1, firstTry: true }])), settings: { goal: 'other', goalNote: 'Help my little brother study' } }, badges: 4, balance: 60 },
];
try {
  for (const [name, engine, viewport] of [
    ['narrow', 'chromium', { width: 320, height: 740 }],
    ['safari', 'webkit', { width: 390, height: 844 }],
    ['landscape', 'webkit', { width: 844, height: 390 }],
  ]) {
    for (const example of cases) {
      const context = await browsers[engine].newContext({ viewport, reducedMotion: example.name === 'active' ? 'no-preference' : 'reduce', timezoneId: 'America/Los_Angeles' });
      await context.addInitScript(seed => localStorage.setItem('roadloop-progress', JSON.stringify(seed)), example.seed);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}#/profile`);
      await page.locator('.profile-next').waitFor();
      assert.equal(await page.locator('[data-profile-name]').innerText(), example.name === 'active' ? 'road_runner_2026' : 'Learner');
      assert.equal(await page.locator('.profile-medals .is-earned').count(), example.badges);
      assert.equal(await page.locator('[data-milestone-count]').innerText(), `${example.badges} of 4`);
      assert.equal(await page.locator('[data-profile-streak], .profile-stats').count(), 0, 'streak stays on Home');
      assert.equal(await page.locator('[data-available]').innerText(), String(example.balance));
      if (example.next) {
        assert.equal(await page.locator('[data-reward-item]').getAttribute('data-reward-item'), example.next);
        assert.equal(await page.locator('.profile-next-track').getAttribute('aria-valuenow'), String(example.value));
        assert.equal(await page.locator('.profile-next-track').getAttribute('aria-valuemax'), String(example.max));
      } else {
        assert.equal(await page.locator('.profile-next-track, [data-reward-item]').count(), 0);
        assert.match(await page.locator('[data-next-unlock]').innerText(), /^Collection complete/);
      }
      await page.evaluate(() => document.fonts.ready);
      if (example.name === 'all-owned') assert.equal(await page.locator('.profile-goal').innerText(), 'Help my little brother study');
      if (example.name === 'active') assert.match(await page.locator('.profile-meta').innerText(), /Permit test/);
      const audit = async () => {
        assert.ok(await page.locator('.home-phone').evaluate(el => el.scrollWidth <= el.clientWidth), 'no page overflow');
        assert.deepEqual(await page.locator(':is(.profile-identity,.profile-next,.profile-list) *').evaluateAll(elements => elements.filter(el => !el.closest('svg') && !el.matches('.profile-avatar') && el.scrollWidth > el.clientWidth + 1).map(el => el.className)), [], 'no text clipping');
      };
      await audit();
      await page.screenshot({ path: `${out}/${name}-${example.name}.png` });
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('roadloop-progress'))), example.seed, 'reading Profile never rewrites progress');
      if (example.name === 'last-car') {
        await page.locator('[data-reward-item]').click();
        await page.locator('[data-item-action]').click();
        await page.locator('[data-confirm]').click();
        await page.waitForFunction(() => !document.querySelector('.profile-item-sheet').open);
        assert.equal(await page.locator('[data-available]').innerText(), '0');
        assert.match(await page.locator('[data-next-unlock]').innerText(), /^Collection complete/);
        assert.equal(await page.locator('[data-reward-item], .profile-next-track').count(), 0);
        await page.waitForFunction(() => document.activeElement?.matches('.profile-collection'));
      }
      if (name === 'narrow') {
        await page.addStyleTag({ content: '.profile-content { --fs-caption:18px; --fs-body:22.5px; --fs-title:30px; --fs-display:39px; --fs-hero:72px; }' });
        await audit();
        await page.locator('.profile-next').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${out}/${name}-${example.name}-large-text.png` });
      }
      if (example.name !== 'active') {
        assert.equal(await page.locator('.profile-content').evaluate(el => el.getAnimations({ subtree: true }).length), 0, 'Profile stays still under reduced motion');
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log(`${name}: fresh, pending, active, legacy spending, last car and full Garage states, milestones, identity and text layout passed.`);
  }
} finally { await Promise.all(Object.values(browsers).map(browser => browser.close())); }
