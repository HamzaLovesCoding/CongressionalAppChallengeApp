import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const base = process.env.BASE ?? 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/Users/hamza/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
try {
  for (const reducedMotion of ['no-preference','reduce']) {
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion});
    await context.addInitScript(() => localStorage.setItem('roadloop-progress',JSON.stringify({xp:40,clips:{},daily:{},liked:[],saved:[]})));
    const page=await context.newPage();
    await page.goto(`${base}#/profile`);
    await page.locator('[data-car="pickup"]').click();
    await page.locator('[data-item-action]').click();
    await page.locator('[data-confirm]').click();
    assert.match(await page.locator('[data-garage-status]').innerText(),/Pickup unlocked/);
    const count=await page.locator('[data-car="pickup"] .profile-tile-art').evaluate(el=>el.getAnimations().length);
    assert.equal(count,reducedMotion==='reduce'?0:1);
    await page.waitForFunction(()=>!document.querySelector('.profile-item-sheet').open);
    await page.waitForTimeout(700);
    await page.screenshot({path:`artifacts/garage-unlock-${reducedMotion}.png`});
    await page.locator('[data-car="pickup"]').click();
    assert.equal(await page.locator('[data-item-action]').isDisabled(),true);
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.querySelector('.profile-item-sheet').open);
    assert.equal(await page.locator('[data-car="pickup"] .profile-tile-art').evaluate(el=>el.getAnimations().length),0);
    console.log(`${reducedMotion}: Garage unlock and selected-state feedback passed.`);
    await context.close();
  }
} finally {await browser.close();}
