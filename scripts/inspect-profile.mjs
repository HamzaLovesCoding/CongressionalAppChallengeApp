import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base = process.env.BASE ?? 'http://127.0.0.1:4173/';
// Vite dev has no service worker; use OFFLINE=0 when checking the current app on 5173.
const offline = process.env.OFFLINE !== '0';
const browser = await chromium.launch({ executablePath:process.env.CHROMIUM ?? '/Users/hamza/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', headless:true, args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
await fs.mkdir('artifacts', {recursive:true});
try {
  for (const [name, viewport] of Object.entries({portrait:{width:390,height:844}, narrow:{width:320,height:740}, landscape:{width:844,height:390}, desktop:{width:1440,height:1000}})) {
    const context = await browser.newContext({viewport, deviceScaleFactor:2, reducedMotion: 'reduce'});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {if(message.type() === 'error') errors.push(message.text());});
    const shot = async suffix => { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300); await page.screenshot({path:`artifacts/profile-${suffix}-${name}.png`}); };
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('roadloop-progress')));
    const layout = async () => {
      assert.ok(await page.locator('.home-phone').evaluate(el => el.scrollWidth <= el.clientWidth), 'No horizontal overflow');
      assert.equal(await page.locator('.profile-tiles [data-car-art]').count(), 6, 'Six SVG models render');
      assert.equal(await page.locator('[data-avatar], [data-current-avatar]').count(), 0, 'No avatar UI remains');
      assert.ok(await page.locator('.profile-page button, .profile-page a').evaluateAll(elements => elements.filter(el => el.getClientRects().length).every(el => {const r=el.getBoundingClientRect(); return r.width >=44 && r.height >=44;})), 'Touch targets at least 44px');
    };
    await page.goto(`${base}#/profile`, {waitUntil:'networkidle'});
    assert.equal(await page.locator('[data-car-name]').innerText(), 'Hatchback');
    assert.equal(await page.locator('[data-profile-xp]').innerText(), '0');
    assert.equal(await page.locator('[data-profile-streak]').innerText(), '0');
    assert.equal(await page.locator('[data-profile-days]').innerText(), '0');
    assert.equal(await page.locator('[data-profile-accuracy]').innerText(), '—');
    assert.equal(await page.locator('[data-car][aria-label$="locked"]').count(), 5);
    assert.equal(await saved(), null, 'Opening Profile does not rewrite old progress');
    assert.equal(await page.locator('.home-leaderboard').count(), 0, 'Leaderboard moved to Home');
    await page.getByRole('tab', {name:'Lessons you like 0',exact:true}).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#profile-tab-saved').getAttribute('aria-selected'), 'true');
    assert.match(await page.locator('[data-library-panel]').innerText(), /Save a lesson/);
    await page.keyboard.press('Home');
    assert.equal(await page.locator('#profile-tab-liked').getAttribute('aria-selected'), 'true');
    await layout(); await shot('empty');
    assert.equal(await page.locator('.profile-next-track').getAttribute('aria-valuenow'), '0');
    await page.locator('[data-reward-item]').click();
    assert.equal(await page.locator('[data-item-action]').isDisabled(), true);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement?.matches('[data-reward-item]'));
    // The gear menu lives on Home and Profile only.
    await page.getByRole('button', {name:'Settings and more',exact:true}).click();
    assert.deepEqual(await page.getByRole('navigation', {name:'Menu',exact:true}).getByRole('link').allInnerTexts(), ['Settings', 'Credits & sources']);
    await page.waitForTimeout(450); await shot('gear-menu');
    await page.getByRole('button', {name:'Close menu'}).click();
    await page.waitForTimeout(450);
    for (const hash of ['#/progress', '#/practice']) { await page.goto(base + hash); await page.waitForSelector('.home-nav'); assert.equal(await page.locator('[data-menu]').count(), 0, hash + ' has no gear'); }
    await page.goto(base + '#/profile'); await page.waitForSelector('[data-car-name]');
    await page.locator('[data-jump="garage"]').click();
    assert.ok(page.url().endsWith('#/profile'), 'Garage shortcut preserves hash router');
    assert.equal(await page.locator('.profile-collection').evaluate(el => el === document.activeElement), true);
    await shot('locked');
    await page.locator('[data-car="sedan"]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.profile-purchase').evaluate(el => el.open), false);
    assert.equal(await saved(), null);
    assert.equal(await page.locator('[data-item-action]').innerText(), 'Need 15 more XP');
    assert.equal(await page.locator('[data-item-action]').isDisabled(), true);
    // The shared native sheet traps keyboard focus and returns it to the tile.
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      assert.ok(await page.evaluate(() => !!document.activeElement.closest('.profile-item-sheet')));
    }
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement?.matches('[data-car="sedan"]'));
    await page.locator('.profile-likes-empty a').click();
    await page.locator('.is-current [data-play]').click();
    await page.locator('.is-current [data-like]').click();
    await page.goto(`${base}#/profile`);
    // A same-document hash change renders after the view-transition snapshot, one frame later.
    await page.locator('.profile-page').waitFor();
    assert.equal(await page.locator('.profile-likes li').count(), 1);
    await page.locator('.profile-likes li a').click();
    assert.match(page.url(), /feed\/lane-end-scan$/);
    await page.locator('.is-current [data-like]').click();
    await page.goto(`${base}#/profile`);
    await page.locator('.profile-likes-empty').waitFor();
    await page.locator('#profile-tab-saved').click();
    await page.locator('.profile-likes-empty a').click();
    await page.locator('.is-current [data-play]').click();
    await page.locator('.is-current [data-save]').click();
    await page.goto(`${base}#/profile`);
    await page.locator('#profile-tab-saved').click();
    assert.equal(await page.locator('[data-library-count="saved"]').innerText(), '1');
    await page.locator('.profile-likes li a').click();
    assert.match(page.url(), /feed\/lane-end-scan$/);
    await page.goto(`${base}#/profile`);
    await page.locator('#profile-tab-saved').click();
    await shot('saved-from-feed');
    const beforeUnsave = await saved();
    await page.getByRole('button', {name:'Remove Scanning Ahead for Lane-End Warnings from saved lessons'}).click();
    assert.deepEqual(await saved(), {...beforeUnsave, saved:[], reviewLater: beforeUnsave.reviewLater ?? []}, 'Removing a save preserves other progress');
    assert.equal(await page.locator('#profile-tab-saved').evaluate(el=>el===document.activeElement), true);
    assert.equal(await page.locator('[data-library-count="saved"]').innerText(), '0');
    await page.evaluate(() => {
      const today=new Date(), yesterday=new Date(); yesterday.setDate(today.getDate()-1);
      localStorage.setItem('roadloop-progress', JSON.stringify({xp:30, clips:{'yellow-light':{done:true,tries:1,firstTry:true},roundabout:{done:true,tries:2,firstTry:false},'four-way-stop':{done:true,tries:1,firstTry:true}}, daily:{[today.toLocaleDateString('en-CA')]:20,[yesterday.toLocaleDateString('en-CA')]:10}, dailyGoal:30, liked:['yellow-light','four-way-stop','removed-lesson'], saved:['roundabout']}));
    });
    await page.reload({waitUntil:'networkidle'});
    const learningBefore = await saved();
    assert.equal(await page.locator('[data-profile-xp]').innerText(), '30');
    assert.equal(await page.locator('[data-profile-streak]').innerText(), '2');
    assert.equal(await page.locator('[data-profile-days]').innerText(), '2');
    assert.equal(await page.locator('[data-profile-accuracy]').innerText(), '67%');
    assert.equal(await page.locator('.profile-next-track').getAttribute('aria-valuenow'), '15');
    assert.match(await page.locator('[data-reward-item]').innerText(), /Ready to buy/);
    assert.equal(await page.locator('.profile-likes li').count(), 2);
    await shot('active');
    await page.locator('[data-jump]').click(); await shot('garage');
    await page.locator('[data-car="sedan"]').click();
    await page.locator('[data-item-action]').click();
    await page.locator('[data-cancel]').click();
    assert.deepEqual(await saved(), learningBefore, 'Cancel never spends');
    assert.equal(await page.locator('[data-item-action]').evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement?.matches('[data-car="sedan"]'));
    await page.locator('[data-reward-item="sedan"]').click();
    await page.locator('[data-item-action]').click(); await shot('purchase');
    await page.locator('[data-confirm]').click();
    await page.waitForFunction(() => !document.querySelector('.profile-item-sheet').open);
    assert.equal((await saved()).spentXp,15);
    assert.equal((await saved()).selectedCar,'sedan');
    assert.equal(await page.locator('[data-available]').innerText(),'15');
    assert.equal(await page.locator('[data-reward-item]').getAttribute('data-reward-item'), 'wagon');
    assert.equal(await page.locator('.profile-next-track').getAttribute('aria-valuenow'), '15');
    assert.equal(await page.locator('.profile-next-track').getAttribute('aria-valuemax'), '25');
    await page.waitForFunction(() => document.activeElement?.matches('[data-reward-item="wagon"]'));
    const {spentXp, ownedCars, selectedCar, ...after} = await saved();
    assert.deepEqual(after, learningBefore, 'Buying preserves every learning record');
    assert.deepEqual(ownedCars,['hatchback','sedan']);
    await page.locator('.home-nav a[href="#/progress"]').click();
    await page.locator('.path-car [data-car-art="sedan"]').waitFor(); await shot('sedan-highway');
    await page.locator('.home-nav a[href="#/profile"]').click();
    assert.equal(await page.locator('[data-car-name]').innerText(),'Sedan');
    await page.reload({waitUntil:'networkidle'});
    assert.equal(await page.locator('[data-current-car] [data-car-art="sedan"]').count(),1);
    if (offline) {
      await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));});
      await context.setOffline(true);
      await page.reload({waitUntil:'load'});
      await page.locator('[data-current-car] [data-car-art="sedan"]').waitFor();
      await page.locator('.home-nav a[href="#/progress"]').click();
      await page.locator('.path-car [data-car-art="sedan"]').waitFor();
      await context.setOffline(false);
      await page.locator('.home-nav a[href="#/profile"]').click();
    }
    // A legacy avatar purchase remains in the ledger when the avatar UI is retired.
    await page.evaluate(() => {
      const data=JSON.parse(localStorage.getItem('roadloop-progress'));
      Object.assign(data,{xp:240,spentXp:25,ownedAvatars:['sprout','sunny'],selectedAvatar:'sunny'});
      localStorage.setItem('roadloop-progress',JSON.stringify(data));
    });
    await page.reload({waitUntil:'networkidle'});
    assert.equal(await page.locator('[data-available]').innerText(),'215');
    // Visit Progress before each switch: a previously rendered car must never stick.
    for (const id of ['wagon','pickup','minivan','classic-coupe','hatchback']) {
      await page.locator('[data-car="'+id+'"]').click();
      await shot(id+'-detail');
      await page.locator('[data-item-action]').click();
      if (id !== 'hatchback') await page.locator('[data-confirm]').click();
      await page.waitForFunction(() => !document.querySelector('.profile-item-sheet').open);
      await page.locator('[data-current-car] [data-car-art="'+id+'"]').waitFor();
      await page.locator('.home-nav a[href="#/progress"]').click();
      await page.locator('.path-car [data-car-art="'+id+'"]').waitFor();
      assert.equal(await page.locator('.path-car [data-car-art]').count(),1);
      await shot(id+'-highway');
      await page.locator('.home-nav a[href="#/profile"]').click();
    }
    assert.equal((await saved()).spentXp,190);
    assert.equal((await saved()).xp,240);
    assert.equal(await page.locator('[data-garage-count]').innerText(),'6 / 6 owned');
    assert.equal(await page.locator('[data-next-unlock]').innerText(),'Collection complete');
    assert.equal(await page.locator('.profile-next-track, [data-reward-item]').count(), 0);
    await page.locator('[data-jump]').click(); await shot('complete-garage');
    await page.locator('#profile-tab-saved').click();
    assert.equal(await page.locator('.profile-likes li a').getAttribute('href'),'#/feed/roundabout');
    await layout();
    if (name === 'narrow') {
      await page.addStyleTag({content:'.profile-tile b,.profile-likes li b {font-size:21px!important}'});
      await layout(); await shot('larger-text');
    }
    assert.deepEqual(errors,[]);
    console.log(`${name}: garage-only Profile, six cars on Progress, purchase/cancel, legacy XP, reload${offline ? ', offline' : ''}, library, keyboard and layout passed on ${base}.`);
    await context.close();
  }
} finally { await browser.close(); }
