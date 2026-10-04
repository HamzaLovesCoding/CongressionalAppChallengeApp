import { defineConfig, type Plugin, type ResolvedConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Babylon lazy-loads dozens of hashed shader chunks, so offline only works if the
// service worker precaches every emitted file, not just what the first visit fetched.
function serviceWorker(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'amber-service-worker',
    apply: 'build',
    configResolved(resolved) { config = resolved; },
    async closeBundle() {
      const outDir = path.resolve(config.root, config.build.outDir);
      const entries = await readdir(outDir, { recursive: true, withFileTypes: true });
      const files = entries
        .filter((entry) => entry.isFile() && entry.name !== 'sw.js')
        .map((entry) => path.relative(outDir, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
        .sort();
      const hash = createHash('sha256');
      for (const file of files) hash.update(file).update(await readFile(path.join(outDir, file)));
      const template = await readFile(path.resolve(config.root, 'src/sw.js'), 'utf8');
      const sw = template
        .replace('__CACHE_VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__PRECACHE__', JSON.stringify(['./', ...files]));
      await writeFile(path.join(outDir, 'sw.js'), sw);
    },
  };
}

export default defineConfig({
  plugins: [serviceWorker()],
});
