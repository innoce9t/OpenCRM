// OpenCRM desktop shell.
//
// Production (`npm run electron`): starts the Express API in-process on a free
// local port and loads the built client (client/dist) from it.
// Dev (`npm run electron:dev`): loads the Vite dev server (with hot reload);
// the API runs in the separate `npm run dev` process.
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const { pathToFileURL } = require('node:url');

const DEV_URL = process.env.ELECTRON_START_URL; // e.g. http://localhost:5173

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

// Resolve once the URL answers any HTTP response (the server listens only
// after its async boot finishes loading the data store).
function waitFor(url, timeoutMs = 30000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => { res.resume(); resolve(); });
      req.on('error', () => {
        if (Date.now() - started > timeoutMs) reject(new Error(`Timed out waiting for ${url}`));
        else setTimeout(attempt, 200);
      });
    };
    attempt();
  });
}

async function startServer() {
  const port = await freePort();
  process.env.PORT = String(port);
  if (app.isPackaged) {
    // The app bundle is read-only: keep data and config in the per-user
    // app-data folder (%APPDATA%\OpenCRM on Windows) unless overridden.
    const userData = app.getPath('userData');
    process.env.OPENCRM_DATA_DIR ||= path.join(userData, 'data');
    process.env.DOTENV_CONFIG_PATH ||= path.join(userData, '.env');
  }
  // server/index.js is an ES module that boots and listens on import.
  await import(pathToFileURL(path.join(__dirname, '..', 'server', 'index.js')).href);
  const url = `http://localhost:${port}`;
  await waitFor(`${url}/api/auth/config`);
  return url;
}

function createWindow(url) {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'OpenCRM',
    backgroundColor: '#181b34',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());

  // Keep the app on its own origin; open everything else in the system browser.
  const origin = new URL(url).origin;
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (new URL(target).origin !== origin) {
      shell.openExternal(target);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
  win.webContents.on('will-navigate', (event, target) => {
    if (new URL(target).origin !== origin) {
      event.preventDefault();
      shell.openExternal(target);
    }
  });

  win.loadURL(url);
  return win;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  let appUrl = null;

  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    if (!DEV_URL) Menu.setApplicationMenu(null);
    try {
      appUrl = DEV_URL || (await startServer());
    } catch (err) {
      console.error('Failed to start OpenCRM:', err);
      app.quit();
      return;
    }
    createWindow(appUrl);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(appUrl);
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
