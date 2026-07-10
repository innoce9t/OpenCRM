// Runs the API server and the Vite dev server together.
import { spawn } from 'node:child_process';

const procs = [
  spawn('node', ['server/index.js'], { stdio: 'inherit' }),
  spawn('npx', ['vite', 'client'], { stdio: 'inherit' }),
];

for (const p of procs) {
  p.on('exit', (code) => {
    for (const other of procs) if (!other.killed) other.kill();
    process.exit(code ?? 0);
  });
}
