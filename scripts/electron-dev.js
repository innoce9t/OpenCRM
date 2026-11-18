// Runs the API + Vite dev servers (scripts/dev.js) and opens them in Electron
// with hot reload. Closing the Electron window stops everything.
import { spawn } from 'node:child_process';
import http from 'node:http';
import electronPath from 'electron';

const DEV_URL = 'http://localhost:5173';

const dev = spawn(process.execPath, ['scripts/dev.js'], { stdio: 'inherit' });

function waitFor(url, timeoutMs = 60000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => { res.resume(); resolve(); });
      req.on('error', () => {
        if (Date.now() - started > timeoutMs) reject(new Error(`Timed out waiting for ${url}`));
        else setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

const stopAll = (code) => {
  if (!dev.killed) dev.kill();
  process.exit(code ?? 0);
};

dev.on('exit', (code) => process.exit(code ?? 0));

waitFor(DEV_URL).then(() => {
  const electron = spawn(electronPath, ['.'], {
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_START_URL: DEV_URL },
  });
  electron.on('exit', stopAll);
}).catch((err) => {
  console.error(err.message);
  stopAll(1);
});
