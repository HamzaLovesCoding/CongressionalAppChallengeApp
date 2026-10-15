// Keep icon exports tied to the owner's artwork without an image-processing dependency.
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/Users/hamza/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  headless: true,
});
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const source = await fs.readFile('AppMaterial/testappicon.png');
  const dataUrl = `data:image/png;base64,${source.toString('base64')}`;
  await page.setContent(`<img src="${dataUrl}" />`);
  const bounds = await page.evaluate(async () => {
    const image = document.querySelector('img');
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let left = canvas.width, top = canvas.height, right = 0, bottom = 0;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const offset = (y * canvas.width + x) * 4;
        if (Math.max(...[0, 1, 2].map(channel => Math.abs(data[offset + channel] - data[channel]))) < 40) continue;
        left = Math.min(left, x); top = Math.min(top, y);
        right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
    }
    return { left: left - 4, top: top - 4, width: right - left + 9, height: bottom - top + 9,
      imageWidth: canvas.width, imageHeight: canvas.height,
      background: `rgb(${data[0]},${data[1]},${data[2]})` };
  });
  for (const [filename, width] of [['icon.svg', 440], ['icon-maskable.svg', 352]]) {
    // The narrower maskable artwork stays inside Android's circular safe area.
    const height = width * bounds.height / bounds.width;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${bounds.background}"/><svg x="${(512 - width) / 2}" y="${(512 - height) / 2}" width="${width}" height="${height}" viewBox="${bounds.left} ${bounds.top} ${bounds.width} ${bounds.height}"><image width="${bounds.imageWidth}" height="${bounds.imageHeight}" href="${dataUrl}"/></svg></svg>\n`;
    await fs.writeFile(`public/${filename}`, svg);
  }
  for (const [source, size, output] of [
    ['icon.svg', 192, 'icon-192.png'], ['icon.svg', 512, 'icon-512.png'],
    ['icon.svg', 180, 'apple-touch-icon.png'], ['icon-maskable.svg', 512, 'icon-maskable-512.png'],
  ]) {
    await page.setViewportSize({ width: size, height: size });
    const svg = await fs.readFile(`public/${source}`, 'utf8');
    await page.setContent(`<style>body{margin:0;background:#f0e4ce}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
    await page.screenshot({ path: `public/${output}` });
  }
} finally { await browser.close(); }
