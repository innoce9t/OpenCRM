// Runs the API server and the Vite dev server together.
import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';

const procs = [
  spawn('node', ['server/index.js'], { stdio: 'inherit' }),
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
