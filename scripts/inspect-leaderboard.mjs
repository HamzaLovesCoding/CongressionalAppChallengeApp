import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.BASE ?? 'http://127.0.0.1:4173/';
const dev=process.env.DEV_BASE ?? 'http://localhost:5173/';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM ?? '/Users/hamza/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',headless:true});
await fs.mkdir('artifacts',{recursive:true});
try {
  for(const [name,viewport] of Object.entries({portrait:{width:390,height:844},narrow:{width:320,height:740},landscape:{width:844,height:390},desktop:{width:1440,height:1000}})) {
    const context=await browser.newContext({viewport,deviceScaleFactor:2,reducedMotion:'reduce',timezoneId:'America/Los_Angeles'});
    const page=await context.newPage(); const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
    await page.clock.install({time:new Date('2026-10-07T12:00:00-07:00')});
    await page.goto(`${base}#/home`,{waitUntil:'networkidle'});
    assert.equal(await page.locator('[data-board-you] .home-board-xp').innerText(),'0\nXP');
    assert.equal(await page.locator('[data-board-reset]').count(),0);
    assert.equal(await page.evaluate(()=>localStorage.getItem('roadloop-progress')),null);
    await page.evaluate(()=>localStorage.setItem('roadloop-progress',JSON.stringify({xp:140,spentXp:10,ownedAvatars:['sprout','sunny'],selectedAvatar:'sunny',clips:{},daily:{'2026-10-04':100,'2026-10-05':10,'2026-10-06':10,'2026-10-07':20},liked:[],saved:[]})));
    await page.reload({waitUntil:'networkidle'});
    const board=page.locator('.home-leaderboard');
    await board.evaluate(el=>el.scrollIntoView({block:'start'}));
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('[data-board-you] .home-board-xp strong').innerText(),'40');
    assert.equal(await page.locator('[data-board-you] img').count(),0, 'Avatar portraits removed');
    assert.equal(await page.locator('[data-board-you] .home-board-rank').innerText(),'—');
    await page.screenshot({path:`artifacts/leaderboard-group-${name}.png`});
    await page.getByRole('tab',{name:'Group',exact:true}).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('tab',{name:'Global',exact:true}).getAttribute('aria-selected'),'true');
    assert.equal(await page.getByRole('tabpanel').getAttribute('aria-labelledby'),'board-tab-global');
    assert.doesNotMatch(await board.innerText(),/XP earned this week|Resets|friendly competition|Better with friends|coming soon|Preview/);
    await page.screenshot({path:`artifacts/leaderboard-global-${name}.png`});
    await page.keyboard.press('Home');
    assert.equal(await page.getByRole('tab',{name:'Group',exact:true}).getAttribute('aria-selected'),'true');
    await page.keyboard.press('End');
    await page.keyboard.press('Tab');
    assert.equal(await page.getByRole('tabpanel').evaluate(el=>el===document.activeElement),true);
    await page.locator('.home-nav a[href="#/profile"]').click();
    assert.equal(await page.locator('.home-leaderboard').count(),0);
    await page.locator('[data-car="sedan"]').click(); await page.locator('[data-item-action]').click(); await page.locator('[data-confirm]').click();
    await page.waitForFunction(() => !document.querySelector('.profile-item-sheet').open);
    await page.locator('.home-nav a[href="#/home"]').click();
    assert.equal(await page.locator('[data-board-you] .home-board-xp strong').innerText(),'40');
    assert.equal(await page.locator('[data-board-you] img, [data-board-you] [data-car-art]').count(),0);
    await page.clock.fastForward(5*86400000);
    assert.equal(await page.locator('[data-board-you] .home-board-xp strong').innerText(),'0');
    assert.equal(await page.locator('[data-board-reset]').count(),0);
    await page.locator('.home-nav a[href="#/profile"]').click();
    assert.equal(await page.locator('[data-profile-xp]').innerText(),'140');
    await page.locator('.home-nav a[href="#/home"]').click();
    assert.ok(await page.locator('.home-phone').evaluate(el=>el.scrollWidth<=el.clientWidth));
    assert.ok(await page.locator('[role="tab"]').evaluateAll(els=>els.every(el=>el.getBoundingClientRect().height>=44)));
    await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));});
    await context.setOffline(true); await page.reload({waitUntil:'load'});
    await page.getByRole('tab',{name:'Global',exact:true}).click();
    assert.equal(await page.locator('[data-board-you]').count(),1);
    assert.equal(await page.locator('[data-board-you] .home-board-xp strong').innerText(),'0');
    assert.deepEqual(errors,[]); await context.close();
    console.log(`${name}: placement, weekly XP, tabs/keyboard, garage spending, Monday rollover, offline and layout passed.`);
  }
  // Development-only ranked fixtures exercise the future data boundary, never shipped sample users.
  for(const width of [390,320]) {
    const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:2,serviceWorkers:'block',timezoneId:'America/Los_Angeles'});
    const page=await context.newPage();
    await page.goto(`${dev}#/home`,{waitUntil:'networkidle'});
    await page.evaluate(async()=>{
      const {mountLeaderboard}=await import('/src/home/leaderboard.ts');
      const old=document.querySelector('.home-leaderboard');const root=document.createElement('section');root.className='home-leaderboard';old.replaceWith(root);
      mountLeaderboard(root,{global:{entries:[{nickname:'Alex',avatar:'sunny',xp:90,rank:1},{nickname:'Sam',avatar:'cloud',xp:80,rank:2},{nickname:'Jordan',avatar:'peach',xp:70,rank:3},{nickname:'Taylor',avatar:'sprout',xp:60,rank:4},{nickname:'Casey',avatar:'sunny',xp:50,rank:5}],yourRank:42},group:{entries:[{nickname:'Alex',avatar:'sunny',xp:90,rank:1},{nickname:'Stale user label',avatar:'cloud',xp:80,rank:2,isYou:true}],yourRank:2}});
    });
    await page.getByRole('tab',{name:'Global',exact:true}).click();
    await page.locator('.home-leaderboard').evaluate(el=>el.scrollIntoView({block:'start'}));
    assert.equal(await page.locator('.home-board-pinned [data-board-you] .home-board-rank').innerText(),'42');
    assert.equal(await page.locator('.home-board-row').count(),6);
    assert.equal(await page.locator('[data-board-you] .home-board-xp strong').innerText(),'0');
    await page.screenshot({path:`artifacts/leaderboard-global-fixture-${width}.png`});
    await page.getByRole('tab',{name:'Group',exact:true}).click();
    assert.equal(await page.locator('[data-board-you]').count(),1);
    assert.equal(await page.locator('.home-board-pinned').count(),0);
    assert.equal(await page.locator('[data-board-you] .home-board-rank').innerText(),'2');
    assert.equal(await page.locator('[data-board-you] .home-board-xp strong').innerText(),'0');
    await page.screenshot({path:`artifacts/leaderboard-group-fixture-${width}.png`});
    await context.close();
  }
}finally{await browser.close();}
