// Try the driver coach on this computer with your own Anthropic key, before deploying anything:
//   1. Paste the key into supabase/functions/.env after ANTHROPIC_API_KEY= (gitignored).
//   2. npm run coach:local, then open http://127.0.0.1:5180/#/practice
// Starts the coach server (scripts/coach-local.ts, run with Deno, which npx downloads on first use) and
// the app with no Supabase settings, so nothing reaches the live project; only Anthropic is called.
import { spawn } from 'node:child_process';

const coach = spawn('npx', ['--yes', 'deno@2.9.6', 'run', '--no-config', '--no-lock', '--node-modules-dir=none',
  '--allow-net=127.0.0.1:8788,api.anthropic.com', '--allow-env', '--allow-read=supabase/functions/.env', 'scripts/coach-local.ts'], { stdio: 'inherit' });
const app = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', '5180', '--strictPort'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_COACH_LOCAL_URL: 'http://127.0.0.1:8788', VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_SUPABASE_ANON_KEY: '' },
});
const stop = () => { coach.kill(); app.kill(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
coach.on('exit', code => { if (code) console.error('The coach server stopped; see the message above.'); });
app.on('exit', code => { coach.kill(); process.exit(code ?? 0); });
