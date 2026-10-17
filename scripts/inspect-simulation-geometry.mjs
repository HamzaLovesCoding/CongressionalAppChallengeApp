// Sample the real overhead renderer at early and late decisions; no app state is changed.
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const base = process.env.BASE ?? 'http://127.0.0.1:5173/';
const out = process.env.AUDIT_DIR ?? 'artifacts/simulation-audit';
await mkdir(out, { recursive: true });
const registry = await readFile(new URL('../src/simulation/registry.ts', import.meta.url), 'utf8');
const ids = [...registry.matchAll(/\{ id: '([a-z-]+)', number: \d+, type: '2d'/g)].map(m => m[1]);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(base);
const result = [];
for (const id of ids) {
  const manifest = JSON.parse(await readFile(new URL(`../vendor/lane-simulations/${id}/scenario-manifest.json`, import.meta.url), 'utf8'));
  const config = JSON.parse(await readFile(new URL(`../vendor/lane-simulations/${id}/src/config.json`, import.meta.url), 'utf8'));
  result.push(await page.evaluate(async ({ id, manifest, timer }) => {
    const { createScene } = await import(`/vendor/lane-simulations/${id}/src/scene.ts`);
    document.body.innerHTML = '<div id="geometry" style="position:fixed;inset:0;width:390px;height:844px"></div>';
    const div = document.querySelector('#geometry'), scene = createScene(div);
    const state = { phase: 'deciding', time: 0, worldTime: 1800, resolveTime: 0, decisionWorld: 1800, reduced: true };
    const boxes = () => [...div.querySelectorAll('[data-actor]')].map(el => {
      const b = el.getBBox(), m = el.transform.baseVal.consolidate().matrix;
      const points = [[b.x, b.y], [b.x + b.width, b.y], [b.x + b.width, b.y + b.height], [b.x, b.y + b.height]].map(([x, y]) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }));
      return { id: el.dataset.actor, points };
    });
    const overlap = (a, b) => {
      for (const p of [a.points, b.points]) for (let i = 0; i < 4; i++) {
        const q = p[(i + 1) % 4], n = { x: -(q.y - p[i].y), y: q.x - p[i].x };
        const pa = a.points.map(v => v.x * n.x + v.y * n.y), pb = b.points.map(v => v.x * n.x + v.y * n.y);
        if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
      }
      return true;
    };
    const rows = [];
    for (const decisionWorld of [1800, 1800 + (timer * 1000 - 80) * .08]) {
      for (const choice of manifest.choices) {
        const row = { action: choice.id, safe: choice.isSafe, decisionWorld, continuityJump: 0, collisions: [], clipped: [], samples: 0, impactContact: null };
        scene.update({ ...state, worldTime: decisionWorld });
        const before = JSON.parse(div.dataset.actors);
        scene.update({ ...state, phase: 'resolving', worldTime: decisionWorld, decisionWorld, action: choice.id, success: choice.isSafe });
        const after = JSON.parse(div.dataset.actors);
        row.continuityJump = Math.max(...Object.keys(before).map(k => Math.hypot(after[k].x - before[k].x, after[k].y - before[k].y)));
        for (let r = 0; r <= 5200; r += 16) {
          const feedback = scene.update({ ...state, phase: 'resolving', worldTime: decisionWorld + r, decisionWorld, resolveTime: r, action: choice.id, success: choice.isSafe });
          row.samples++;
          const actors = boxes(), you = actors.find(a => a.id === 'you');
          const contacts = actors.filter(a => a.id !== 'you' && overlap(you, a)).map(a => a.id);
          if (choice.isSafe && contacts.length && row.collisions.length < 5) row.collisions.push({ r, actors: contacts });
          if (choice.isSafe) for (const a of actors) if (a.points.some(p => p.x < 0 || p.x > 360 || p.y < 0 || p.y > 500)) {
            if (row.clipped.length < 5) row.clipped.push({ r, actor: a.id, points: a.points });
          }
          if (feedback?.impact) { row.impactContact = { r, actors: contacts, impact: feedback.impact, poses: JSON.parse(div.dataset.actors) }; break; }
          if (feedback?.finished) break;
        }
        rows.push(row);
      }
    }
    scene.destroy();
    return { id, rows };
  }, { id, manifest, timer: config.timer }));
}
await writeFile(`${out}/geometry.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result.map(s => ({ id: s.id, samples: s.rows.reduce((n, r) => n + r.samples, 0), problems: s.rows.filter(r => r.collisions.length || r.clipped.length || r.continuityJump > 1).map(r => ({ action: r.action, decisionWorld: r.decisionWorld, continuityJump: r.continuityJump, collisions: r.collisions, clipped: r.clipped })) })), null, 2));
await browser.close();
