// Runs the API server and the Vite dev server together.
import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';

const procs = [
  // The Vite proxy (client/vite.config.js) targets :4000, so pin the API there
  // even if PORT is set in the environment (e.g. by a preview launcher).
  spawn('node', ['server/index.js'], {
    stdio: 'inherit',
    env: { ...process.env, PORT: process.env.API_PORT || '4000' },
  }),
  spawn('npx', ['vite', 'client'], { stdio: 'inherit', shell: isWindows }),
];

for (const p of procs) {
  p.on('error', (err) => {
    console.error(err);
    for (const other of procs) if (!other.killed) other.kill();
    process.exit(1);
  });
  p.on('exit', (code) => {
    for (const other of procs) if (!other.killed) other.kill();
    process.exit(code ?? 0);
  });
}
