import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedDatabase, DEFAULT_STATUS_LABELS, PRIORITY_LABELS, DEFAULT_DROPDOWN_LABELS, defaultSubitemColumns, seedChannels, defaultQuickReplies, seedWorkspaces } from './seed.js';
import { createStore, fileStore } from './store.js';
import { hashPassword, verifyPassword, newToken, sanitizeUser } from './auth.js';
import { verifyFirebaseToken, firebaseWebConfig } from './firebaseAuth.js';

// Auth is enforced by default; set REQUIRE_AUTH=false to run fully open (legacy).
const REQUIRE_AUTH = process.env.REQUIRE_AUTH !== 'false';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;
// Items returned per group on the initial board load. Large groups are paged;
// clients fetch the rest via the group-items endpoint. High enough that normal
// boards load whole, so aggregate views (kanban/dashboard/etc.) stay complete.
const PAGE_SIZE = Number(process.env.OPENCRM_PAGE_SIZE) || 200;

// ---------------------------------------------------------------- storage

// The active data set, held in memory and flushed to the configured store
// (JSON file or Firestore — see store.js). Populated by boot() before listen.
let db = { users: [], boards: [], notifications: [], channels: [], quickReplies: [], calls: [] };
let store = null;

// Dirty tracking so a flush writes only what changed, not the whole dataset.
const dirtyBoards = new Set();
const dirtyChannels = new Set();
const deletedBoardIds = new Set();
let dirtyMeta = false; // users / notifications / quickReplies

// Backfill fields added after data was first written, so upgrades don't crash.
function ensureShape() {
  if (!Array.isArray(db.notifications)) db.notifications = [];
  if (!Array.isArray(db.channels)) db.channels = seedChannels(db.users);
  if (!Array.isArray(db.quickReplies)) db.quickReplies = defaultQuickReplies();
  if (!Array.isArray(db.calls)) db.calls = [];
  if (!Array.isArray(db.workspaces) || !db.workspaces.length) db.workspaces = seedWorkspaces(db.users);
  if (!db.sessions || typeof db.sessions !== 'object') db.sessions = {};
  // Migrate users that predate auth: give them an email, a role, and a demo password.
  db.users.forEach((u, i) => {
    if (!u.email) u.email = `${(u.name || u.id).split(' ')[0].toLowerCase()}@opencrm.app`;
    if (!u.role) u.role = i === 0 ? 'admin' : 'member';
    if (!u.pwHash) { const { salt, hash } = hashPassword('opencrm'); u.pwSalt = salt; u.pwHash = hash; }
  });
  const wsIds = new Set(db.workspaces.map((w) => w.id));
  for (const b of db.boards) {
    if (!Array.isArray(b.activity)) b.activity = [];
    if (!Array.isArray(b.automations)) b.automations = [];
    if (!Array.isArray(b.views)) b.views = [];
    if (!Array.isArray(b.subitemColumns)) b.subitemColumns = defaultSubitemColumns();
    for (const g of b.groups) for (const it of g.items) {
      if (!Array.isArray(it.updates)) it.updates = [];
      if (!Array.isArray(it.subitems)) it.subitems = [];
    }
  }
  for (const c of db.channels) if (!Array.isArray(c.messages)) c.messages = [];
  const defaultWs = db.workspaces[0]?.id;
  for (const b of db.boards) {
    if (!b.workspaceId || !wsIds.has(b.workspaceId)) b.workspaceId = defaultWs;
    if (!Array.isArray(b.sharedWith)) b.sharedWith = [];
  }
}

let saveTimer = null;
function scheduleFlush() {
  if (!store) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 250);
}
async function flush() {
  const opts = {
    boards: [...dirtyBoards].map((id) => db.boards.find((b) => b.id === id)).filter(Boolean),
    channels: [...dirtyChannels].map((id) => db.channels.find((c) => c.id === id)).filter(Boolean),
    deletedBoardIds: [...deletedBoardIds],
    meta: dirtyMeta,
  };
  dirtyBoards.clear(); dirtyChannels.clear(); deletedBoardIds.clear(); dirtyMeta = false;
  try { await store.saveAll(db, opts); } catch (err) { console.error('persist failed:', err); }
}

// Mark a board dirty (pass the board) and schedule a flush. Board-mutating
// handlers call persist(board); meta-only changes use persistMeta(). Each also
// broadcasts a change event so other connected clients live-refresh.
function persist(board) { if (board) { dirtyBoards.add(board.id); broadcast({ type: 'board', id: board.id }); } scheduleFlush(); }
function persistChannel(channel) { if (channel) { dirtyChannels.add(channel.id); broadcast({ type: 'channel', id: channel.id }); } scheduleFlush(); }
function persistMeta() { dirtyMeta = true; broadcast({ type: 'meta' }); scheduleFlush(); }

// ---- Server-Sent Events: live sync between open clients.
const sseClients = new Set();
function broadcast(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of sseClients) { try { res.write(data); } catch { /* dropped */ } }
}

let counter = 1;
const uid = (prefix) => `${prefix}_${(counter++).toString(36)}${Date.now().toString(36)}`;

const GROUP_COLORS = ['#579bfc', '#00c875', '#a25ddc', '#e2445c', '#fdab3d', '#66ccff', '#bb3354', '#7f5347'];

// ---------------------------------------------------------------- helpers

function findBoard(req, res) {
  const board = db.boards.find((b) => b.id === req.params.boardId);
  if (!board) { res.status(404).json({ error: 'board not found' }); return null; }
  if (!canAccessBoard(req.user, board)) { res.status(403).json({ error: 'forbidden' }); return null; }
  return board;
}

function findGroup(board, groupId, res) {
  const group = board.groups.find((g) => g.id === groupId);
  if (!group) res.status(404).json({ error: 'group not found' });
  return group;
}

// Locate an item anywhere in the board, returning it plus its containing group.
function findItemDeep(board, itemId) {
  for (const group of board.groups) {
    const item = group.items.find((i) => i.id === itemId);
    if (item) return { group, item };
  }
  return { group: null, item: null };
}

// The acting user for activity/notifications — resolved by the auth middleware.
function actorId(req) {
  return req.user?.id || req.header('x-user-id') || (db.users[0] && db.users[0].id) || null;
}

// Can this user see/use this board? Admins see all; otherwise the board must be
// in one of the user's workspaces or explicitly shared with them.
function canAccessBoard(user, board) {
  if (!REQUIRE_AUTH) return true;
  if (!user) return false;
  if (user.role === 'admin') return true;
  const ws = db.workspaces.find((w) => w.id === board.workspaceId);
  if (ws && (ws.memberIds || []).includes(user.id)) return true;
  return (board.sharedWith || []).includes(user.id);
}

function boardsForUser(user) {
  return db.boards.filter((b) => canAccessBoard(user, b));
}

function canUseWorkspace(user, ws) {
  if (!REQUIRE_AUTH || !user) return true;
  return user.role === 'admin' || (ws?.memberIds || []).includes(user.id);
}

function logActivity(board, entry) {
  board.activity.unshift({ id: uid('act'), at: new Date().toISOString(), ...entry });
  board.activity.length = Math.min(board.activity.length, 200);
}

function notify(userId, entry) {
  if (!userId) return;
  db.notifications.unshift({ id: uid('ntf'), userId, read: false, at: new Date().toISOString(), ...entry });
  db.notifications.length = Math.min(db.notifications.length, 500);
  dirtyMeta = true; // notifications live in the meta doc
  broadcast({ type: 'meta' });
}

const userName = (id) => db.users.find((u) => u.id === id)?.name || 'Someone';

// Run any enabled automation whose trigger matches a just-changed column value.
// Returns extra value changes applied so the caller can report the final item.
function runAutomations(board, group, item, changedKeys, actor) {
  for (const auto of board.automations) {
    if (!auto.enabled) continue;
    const t = auto.trigger || {};
    if (!changedKeys.includes(t.columnId)) continue;
    if (item.values[t.columnId] !== t.labelId) continue;

    const a = auto.action || {};
    const labelText = board.columns.find((c) => c.id === t.columnId)?.labels?.find((l) => l.id === t.labelId)?.text || t.labelId;

    if (a.type === 'notify') {
      const target = a.userId === '__owner' ? ownerOf(board, item) : a.userId;
      notify(target, {
        boardId: board.id, itemId: item.id, itemName: item.name,
        text: `Automation: “${item.name}” is now ${labelText}`,
      });
    } else if (a.type === 'set' && a.columnId) {
      if (item.values[a.columnId] !== a.value) {
        item.values[a.columnId] = a.value;
        logActivity(board, { actorId: actor, itemId: item.id, itemName: item.name, kind: 'automation', text: `set by automation` });
      }
    } else if (a.type === 'move' && a.groupId && group.id !== a.groupId) {
      const dest = board.groups.find((g) => g.id === a.groupId);
      if (dest) {
        const idx = group.items.findIndex((i) => i.id === item.id);
        if (idx !== -1) { group.items.splice(idx, 1); dest.items.push(item); }
      }
    } else if (a.type === 'webhook' && a.url) {
      // Generic outbound webhook (works with Zapier/Make catch hooks, etc.)
      fireWebhook(a.url, {
        event: 'automation', board: board.name, trigger: labelText,
        item: { id: item.id, name: item.name, values: item.values },
      });
    } else if (a.type === 'slack' && a.url) {
      // Slack incoming webhook expects { text }.
      fireWebhook(a.url, { text: `OpenCRM · *${item.name}* is now *${labelText}* (${board.name})` });
    }
  }
}

// Fire-and-forget outbound POST for webhook/Slack automation actions.
function fireWebhook(url, payload) {
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
    .catch((err) => console.error('webhook failed:', err.message));
}

// Best-effort "owner": value of the first person-type column, if any.
function ownerOf(board, item) {
  const personCol = board.columns.find((c) => c.type === 'person');
  return personCol ? item.values[personCol.id] : null;
}

// ---------------------------------------------------------------- app

const app = express();
app.use(cors());
app.use(express.json({ limit: '12mb' })); // allow small media data-URLs in chat

// ---- auth middleware: resolve req.user, enforce access.
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  const open = req.path.startsWith('/api/auth/') || req.path === '/api/events'
    || req.path === '/api/crm/call-logs' || req.path === '/api/crm/ai-notes';
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const token = bearer || req.query.token;
  req.token = token;
  req.user = (token && db.sessions[token]) ? db.users.find((u) => u.id === db.sessions[token]) : null;
  // Legacy fallback (only when auth is disabled) so x-user-id still works.
  if (!req.user && !REQUIRE_AUTH && req.headers['x-user-id']) req.user = db.users.find((u) => u.id === req.headers['x-user-id']);
  if (REQUIRE_AUTH && !open && !req.user) return res.status(401).json({ error: 'unauthorized' });
  // Guests are read-only on data routes.
  if (REQUIRE_AUTH && req.user?.role === 'guest' && req.method !== 'GET' && !open && req.path !== '/api/ai/query') {
    return res.status(403).json({ error: 'guests are read-only' });
  }
  next();
});

// ---- auth routes
app.post('/api/auth/signup', (req, res) => {
  // Email/password signup is disabled for now; re-enable with ALLOW_SIGNUP=true.
  if (process.env.ALLOW_SIGNUP !== 'true') return res.status(403).json({ error: 'signups are disabled' });
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  if (!name || !email || password.length < 4) return res.status(400).json({ error: 'name, email and a 4+ char password are required' });
  if (db.users.some((u) => u.email?.toLowerCase() === email)) return res.status(409).json({ error: 'email already in use' });
  const initials = name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  const palette = ['#0073ea', '#00c875', '#a25ddc', '#e2445c', '#fdab3d', '#66ccff'];
  const { salt, hash } = hashPassword(password);
  const user = { id: uid('u'), name, email, initials, color: palette[db.users.length % palette.length], role: 'member', pwSalt: salt, pwHash: hash };
  db.users.push(user);
  db.workspaces[0]?.memberIds.push(user.id);
  const token = newToken();
  db.sessions[token] = user.id;
  persistMeta();
  res.status(201).json({ token, user: sanitizeUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const user = db.users.find((u) => u.email?.toLowerCase() === email);
  if (!user || !verifyPassword(req.body.password || '', user.pwSalt, user.pwHash)) {
    return res.status(401).json({ error: 'invalid email or password' });
  }
  const token = newToken();
  db.sessions[token] = user.id;
  persistMeta();
  res.json({ token, user: sanitizeUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  if (req.token) delete db.sessions[req.token];
  persistMeta();
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  res.json({ user: sanitizeUser(req.user) });
});

// Tells the client which auth options are available (e.g. Google sign-in).
app.get('/api/auth/config', (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null, firebaseConfig: firebaseWebConfig() });
});

// Sign in / sign up with Firebase (Google provider). The client does the popup
// via the Firebase SDK and sends the resulting ID token, which we verify with
// the Firebase Admin SDK. First-time users are created (Google signup).
app.post('/api/auth/firebase', async (req, res) => {
  const idToken = req.body.idToken;
  if (!idToken) return res.status(400).json({ error: 'missing idToken' });
  let decoded;
  try {
    decoded = await verifyFirebaseToken(idToken);
  } catch (err) {
    console.error('Firebase verify failed:', err.message);
    return res.status(401).json({ error: 'could not verify Firebase token' });
  }
  if (decoded.email_verified === false) return res.status(401).json({ error: 'email not verified' });
  const email = (decoded.email || '').toLowerCase();
  let user = db.users.find((u) => u.firebaseUid === decoded.uid || (email && u.email?.toLowerCase() === email));
  if (!user) {
    const name = decoded.name || decoded.displayName || (email ? email.split('@')[0] : 'User');
    const initials = name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
    const palette = ['#0073ea', '#00c875', '#a25ddc', '#e2445c', '#fdab3d', '#66ccff'];
    user = { id: uid('u'), name, email, initials, color: palette[db.users.length % palette.length], role: 'member', firebaseUid: decoded.uid, avatarUrl: decoded.picture };
    db.users.push(user);
    db.workspaces[0]?.memberIds.push(user.id);
  } else if (!user.firebaseUid) {
    user.firebaseUid = decoded.uid; // link Firebase identity to an existing email account
  }
  const token = newToken();
  db.sessions[token] = user.id;
  persistMeta();
  res.json({ token, user: sanitizeUser(user) });
});

// Sign in with Google. The client sends the ID token (credential) from Google
// Identity Services; we verify it via Google's tokeninfo endpoint (no extra dep).
app.post('/api/auth/google', async (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(400).json({ error: 'Google sign-in is not configured' });
  const credential = req.body.credential;
  if (!credential) return res.status(400).json({ error: 'missing credential' });

  let payload;
  try {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!r.ok) throw new Error(`tokeninfo ${r.status}`);
    payload = await r.json();
  } catch (err) {
    console.error('Google verify failed:', err.message);
    return res.status(401).json({ error: 'could not verify Google token' });
  }
  if (payload.aud !== clientId) return res.status(401).json({ error: 'token audience mismatch' });
  if (payload.email_verified !== true && payload.email_verified !== 'true') return res.status(401).json({ error: 'email not verified by Google' });

  const email = (payload.email || '').toLowerCase();
  let user = db.users.find((u) => u.googleId === payload.sub || u.email?.toLowerCase() === email);
  if (!user) {
    const name = payload.name || email.split('@')[0];
    const initials = name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
    const palette = ['#0073ea', '#00c875', '#a25ddc', '#e2445c', '#fdab3d', '#66ccff'];
    user = { id: uid('u'), name, email, initials, color: palette[db.users.length % palette.length], role: 'member', googleId: payload.sub, avatarUrl: payload.picture };
    db.users.push(user);
    db.workspaces[0]?.memberIds.push(user.id);
  } else if (!user.googleId) {
    user.googleId = payload.sub; // link Google to an existing email account
  }
  const token = newToken();
  db.sessions[token] = user.id;
  persistMeta();
  res.json({ token, user: sanitizeUser(user) });
});

app.get('/api/users', (req, res) => res.json(db.users.map(sanitizeUser)));

// ---- workspaces
app.get('/api/workspaces', (req, res) => {
  const list = req.user?.role === 'admin' ? db.workspaces : db.workspaces.filter((w) => (w.memberIds || []).includes(req.user?.id));
  res.json(list);
});

app.post('/api/workspaces', (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'admin only' });
  const ws = { id: uid('ws'), name: (req.body.name || '').trim() || 'New workspace', color: req.body.color || '#0073ea', memberIds: req.body.memberIds || db.users.map((u) => u.id) };
  db.workspaces.push(ws);
  persistMeta();
  res.status(201).json(ws);
});

// Live-update stream. Clients open this and refetch on change events.
app.get('/api/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders?.();
  res.write(': connected\n\n');
  sseClients.add(res);
  const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* ignore */ } }, 25000);
  req.on('close', () => { clearInterval(ping); sseClients.delete(res); });
});

app.get('/api/boards', (req, res) => {
  res.json(boardsForUser(req.user).map((b) => ({
    id: b.id,
    name: b.name,
    description: b.description,
    workspaceId: b.workspaceId,
    sharedWith: b.sharedWith || [],
    itemCount: b.groups.reduce((n, g) => n + g.items.length, 0),
  })));
});

app.get('/api/boards/:boardId', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  // Page each group's items; the client can load more via the items endpoint.
  const out = {
    ...board,
    groups: board.groups.map((g) => ({
      ...g,
      total: g.items.length,
      hasMore: g.items.length > PAGE_SIZE,
      items: g.items.slice(0, PAGE_SIZE),
    })),
  };
  res.json(out);
});

// Fetch a page of items for one group (used for "load more" on large groups).
app.get('/api/boards/:boardId/groups/:groupId/items', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  const group = findGroup(board, req.params.groupId, res);
  if (!group) return;
  const offset = Number(req.query.offset) || 0;
  const limit = Number(req.query.limit) || PAGE_SIZE;
  res.json({
    items: group.items.slice(offset, offset + limit),
    total: group.items.length,
    hasMore: offset + limit < group.items.length,
  });
});

app.post('/api/boards', (req, res) => {
  const name = (req.body.name || '').trim() || 'New Board';
  // Place the board in a workspace the user belongs to (or their first one).
  const myWs = db.workspaces.find((w) => w.id === req.body.workspaceId && canUseWorkspace(req.user, w))
    || db.workspaces.find((w) => canUseWorkspace(req.user, w));
  const board = {
    id: uid('board'),
    name,
    description: req.body.description || '',
    workspaceId: myWs?.id || db.workspaces[0]?.id,
    sharedWith: [],
    columns: [
      { id: 'owner', title: 'Owner', type: 'person' },
      { id: 'status', title: 'Status', type: 'status', labels: DEFAULT_STATUS_LABELS },
      { id: 'date', title: 'Date', type: 'date' },
    ],
    groups: [
      { id: uid('grp'), title: 'Group Title', color: GROUP_COLORS[0], collapsed: false, items: [] },
    ],
    subitemColumns: defaultSubitemColumns(),
    automations: [],
    views: [],
    activity: [],
  };
  db.boards.push(board);
  persist(board);
  res.status(201).json(board);
});

app.patch('/api/boards/:boardId', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  if (typeof req.body.name === 'string' && req.body.name.trim()) board.name = req.body.name.trim();
  if (typeof req.body.description === 'string') board.description = req.body.description;
  if (Array.isArray(req.body.sharedWith)) board.sharedWith = req.body.sharedWith.filter((id) => db.users.some((u) => u.id === id));
  if (typeof req.body.workspaceId === 'string' && db.workspaces.some((w) => w.id === req.body.workspaceId)) board.workspaceId = req.body.workspaceId;
  persist(board);
  res.json(board);
});

app.delete('/api/boards/:boardId', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  const idx = db.boards.findIndex((b) => b.id === board.id);
  db.boards.splice(idx, 1);
  deletedBoardIds.add(board.id);
  scheduleFlush();
  res.json({ ok: true });
});

// ---- groups

app.post('/api/boards/:boardId/groups', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  const group = {
    id: uid('grp'),
    title: (req.body.title || '').trim() || 'New Group',
    color: req.body.color || GROUP_COLORS[board.groups.length % GROUP_COLORS.length],
    collapsed: false,
    items: [],
  };
  board.groups.push(group);
  persist(board);
  res.status(201).json(group);
});

app.patch('/api/boards/:boardId/groups/:groupId', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  const group = findGroup(board, req.params.groupId, res);
  if (!group) return;
  if (typeof req.body.title === 'string' && req.body.title.trim()) group.title = req.body.title.trim();
  if (typeof req.body.color === 'string') group.color = req.body.color;
  if (typeof req.body.collapsed === 'boolean') group.collapsed = req.body.collapsed;
  persist(board);
  res.json(group);
});

app.delete('/api/boards/:boardId/groups/:groupId', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  const idx = board.groups.findIndex((g) => g.id === req.params.groupId);
  if (idx === -1) return res.status(404).json({ error: 'group not found' });
  board.groups.splice(idx, 1);
  persist(board);
  res.json({ ok: true });
});

// ---- items

app.post('/api/boards/:boardId/groups/:groupId/items', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  const group = findGroup(board, req.params.groupId, res);
  if (!group) return;
  const item = {
    id: uid('item'),
    name: (req.body.name || '').trim() || 'New Item',
    values: req.body.values || {},
    updates: [],
    subitems: [],
  };
  if (req.body.position === 'top') group.items.unshift(item);
  else group.items.push(item);
  logActivity(board, { actorId: actorId(req), itemId: item.id, itemName: item.name, kind: 'create', text: `created item in ${group.title}` });
  persist(board);
  res.status(201).json(item);
});

app.patch('/api/boards/:boardId/items/:itemId', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  const { group, item } = findItemDeep(board, req.params.itemId);
  if (item) {
    if (typeof req.body.name === 'string' && req.body.name.trim()) item.name = req.body.name.trim();
    let changedKeys = [];
    if (req.body.values && typeof req.body.values === 'object') {
      changedKeys = Object.keys(req.body.values);
      Object.assign(item.values, req.body.values);
      // null clears a value
      for (const [k, v] of Object.entries(item.values)) if (v === null) delete item.values[k];
      for (const key of changedKeys) {
        const col = board.columns.find((c) => c.id === key);
        if (col) logActivity(board, { actorId: actorId(req), itemId: item.id, itemName: item.name, kind: 'update', text: `changed ${col.title}` });
      }
      runAutomations(board, group, item, changedKeys, actorId(req));
    }
    persist(board);
    return res.json(item);
  }
  res.status(404).json({ error: 'item not found' });
});

// move item between groups (used by kanban drag & drop and table)
app.post('/api/boards/:boardId/items/:itemId/move', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  const target = findGroup(board, req.body.groupId, res);
  if (!target) return;
  for (const group of board.groups) {
    const idx = group.items.findIndex((i) => i.id === req.params.itemId);
    if (idx === -1) continue;
    const [item] = group.items.splice(idx, 1);
    target.items.push(item);
    persist(board);
    return res.json(item);
  }
  res.status(404).json({ error: 'item not found' });
});

// duplicate an item (inserted right after the original)
app.post('/api/boards/:boardId/items/:itemId/duplicate', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  for (const group of board.groups) {
    const idx = group.items.findIndex((i) => i.id === req.params.itemId);
    if (idx === -1) continue;
    const src = group.items[idx];
    const copy = {
      id: uid('item'),
      name: `${src.name} (copy)`,
      values: structuredClone(src.values || {}),
      updates: [],
      subitems: (src.subitems || []).map((s) => ({ ...structuredClone(s), id: uid('sub') })),
    };
    group.items.splice(idx + 1, 0, copy);
    logActivity(board, { actorId: actorId(req), itemId: copy.id, itemName: copy.name, kind: 'create', text: 'duplicated an item' });
    persist(board);
    return res.status(201).json(copy);
  }
  res.status(404).json({ error: 'item not found' });
});

app.delete('/api/boards/:boardId/items/:itemId', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  for (const group of board.groups) {
    const idx = group.items.findIndex((i) => i.id === req.params.itemId);
    if (idx === -1) continue;
    group.items.splice(idx, 1);
    persist(board);
    return res.json({ ok: true });
  }
  res.status(404).json({ error: 'item not found' });
});

// ---- columns

const COLUMN_PRESETS = {
  text: () => ({ type: 'text', title: 'Text' }),
  longtext: () => ({ type: 'longtext', title: 'Notes' }),
  number: () => ({ type: 'number', title: 'Numbers', unit: '' }),
  status: () => ({ type: 'status', title: 'Status', labels: clone(DEFAULT_STATUS_LABELS) }),
  priority: () => ({ type: 'status', title: 'Priority', labels: clone(PRIORITY_LABELS) }),
  dropdown: () => ({ type: 'dropdown', title: 'Dropdown', labels: clone(DEFAULT_DROPDOWN_LABELS) }),
  date: () => ({ type: 'date', title: 'Date' }),
  timeline: () => ({ type: 'timeline', title: 'Timeline' }),
  person: () => ({ type: 'person', title: 'People' }),
  checkbox: () => ({ type: 'checkbox', title: 'Done' }),
  rating: () => ({ type: 'rating', title: 'Rating' }),
  email: () => ({ type: 'email', title: 'Email' }),
  phone: () => ({ type: 'phone', title: 'Phone' }),
  link: () => ({ type: 'link', title: 'Link' }),
  files: () => ({ type: 'files', title: 'Files' }),
  location: () => ({ type: 'location', title: 'Location' }),
  autonumber: () => ({ type: 'autonumber', title: 'Item ID' }),
  vote: () => ({ type: 'vote', title: 'Vote' }),
  button: () => ({ type: 'button', title: 'Action', config: { label: 'Run', targetColumnId: '', targetValue: '' } }),
  formula: () => ({ type: 'formula', title: 'Formula', config: { expression: '' } }),
  connect: () => ({ type: 'connect', title: 'Connected', config: { boardId: '' } }),
  mirror: () => ({ type: 'mirror', title: 'Mirror', config: { connectColumnId: '', columnId: '' } }),
  dependency: () => ({ type: 'dependency', title: 'Dependency' }),
};

const clone = (v) => JSON.parse(JSON.stringify(v));

app.post('/api/boards/:boardId/columns', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  const preset = COLUMN_PRESETS[req.body.type];
  if (!preset) return res.status(400).json({ error: 'unknown column type' });
  const column = { id: uid('col'), ...preset() };
  if (typeof req.body.title === 'string' && req.body.title.trim()) column.title = req.body.title.trim();
  board.columns.push(column);
  persist(board);
  res.status(201).json(column);
});

app.patch('/api/boards/:boardId/columns/:columnId', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  const column = board.columns.find((c) => c.id === req.params.columnId);
  if (!column) return res.status(404).json({ error: 'column not found' });
  if (typeof req.body.title === 'string' && req.body.title.trim()) column.title = req.body.title.trim();
  if (typeof req.body.unit === 'string') column.unit = req.body.unit;
  if (Array.isArray(req.body.labels)) column.labels = req.body.labels;
  if (req.body.config && typeof req.body.config === 'object') column.config = { ...(column.config || {}), ...req.body.config };
  persist(board);
  res.json(column);
});

app.delete('/api/boards/:boardId/columns/:columnId', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  const idx = board.columns.findIndex((c) => c.id === req.params.columnId);
  if (idx === -1) return res.status(404).json({ error: 'column not found' });
  const [removed] = board.columns.splice(idx, 1);
  for (const group of board.groups) {
    for (const item of group.items) delete item.values[removed.id];
  }
  persist(board);
  res.json({ ok: true });
});

// ---- item updates (comments) + mentions

app.post('/api/boards/:boardId/items/:itemId/updates', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  const { item } = findItemDeep(board, req.params.itemId);
  if (!item) return res.status(404).json({ error: 'item not found' });
  const author = actorId(req);
  const text = (req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'empty update' });
  const mentions = Array.isArray(req.body.mentions) ? req.body.mentions : [];
  const update = { id: uid('upd'), userId: author, text, mentions, at: new Date().toISOString() };
  item.updates.push(update);
  logActivity(board, { actorId: author, itemId: item.id, itemName: item.name, kind: 'update-post', text: 'posted an update' });
  for (const m of mentions) {
    if (m === author) continue;
    notify(m, { boardId: board.id, itemId: item.id, itemName: item.name, text: `${userName(author)} mentioned you on “${item.name}”` });
  }
  persist(board);
  res.status(201).json(update);
});

app.delete('/api/boards/:boardId/items/:itemId/updates/:updateId', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  const { item } = findItemDeep(board, req.params.itemId);
  if (!item) return res.status(404).json({ error: 'item not found' });
  item.updates = item.updates.filter((u) => u.id !== req.params.updateId);
  persist(board);
  res.json({ ok: true });
});

// ---- subitems

app.post('/api/boards/:boardId/items/:itemId/subitems', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  const { item } = findItemDeep(board, req.params.itemId);
  if (!item) return res.status(404).json({ error: 'item not found' });
  const sub = { id: uid('sub'), name: (req.body.name || '').trim() || 'New Subitem', values: req.body.values || {} };
  item.subitems.push(sub);
  persist(board);
  res.status(201).json(sub);
});

app.patch('/api/boards/:boardId/items/:itemId/subitems/:subId', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  const { item } = findItemDeep(board, req.params.itemId);
  if (!item) return res.status(404).json({ error: 'item not found' });
  const sub = item.subitems.find((s) => s.id === req.params.subId);
  if (!sub) return res.status(404).json({ error: 'subitem not found' });
  if (typeof req.body.name === 'string' && req.body.name.trim()) sub.name = req.body.name.trim();
  if (req.body.values && typeof req.body.values === 'object') {
    Object.assign(sub.values, req.body.values);
    for (const [k, v] of Object.entries(sub.values)) if (v === null) delete sub.values[k];
  }
  persist(board);
  res.json(sub);
});

app.delete('/api/boards/:boardId/items/:itemId/subitems/:subId', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  const { item } = findItemDeep(board, req.params.itemId);
  if (!item) return res.status(404).json({ error: 'item not found' });
  item.subitems = item.subitems.filter((s) => s.id !== req.params.subId);
  persist(board);
  res.json({ ok: true });
});

// ---- board activity log

app.get('/api/boards/:boardId/activity', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  res.json(board.activity);
});

// ---- notifications (per user)

app.get('/api/notifications', (req, res) => {
  const userId = req.query.userId || actorId(req);
  res.json(db.notifications.filter((n) => n.userId === userId));
});

app.post('/api/notifications/:id/read', (req, res) => {
  const n = db.notifications.find((x) => x.id === req.params.id);
  if (!n) return res.status(404).json({ error: 'not found' });
  n.read = true;
  persistMeta();
  res.json(n);
});

app.post('/api/notifications/read-all', (req, res) => {
  const userId = req.body.userId || actorId(req);
  for (const n of db.notifications) if (n.userId === userId) n.read = true;
  persistMeta();
  res.json({ ok: true });
});

// ---- automations

app.get('/api/boards/:boardId/automations', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  res.json(board.automations);
});

app.post('/api/boards/:boardId/automations', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  const auto = {
    id: uid('auto'),
    enabled: req.body.enabled !== false,
    trigger: req.body.trigger || {},
    action: req.body.action || {},
  };
  board.automations.push(auto);
  persist(board);
  res.status(201).json(auto);
});

app.patch('/api/boards/:boardId/automations/:autoId', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  const auto = board.automations.find((a) => a.id === req.params.autoId);
  if (!auto) return res.status(404).json({ error: 'automation not found' });
  if (typeof req.body.enabled === 'boolean') auto.enabled = req.body.enabled;
  if (req.body.trigger) auto.trigger = req.body.trigger;
  if (req.body.action) auto.action = req.body.action;
  persist(board);
  res.json(auto);
});

app.delete('/api/boards/:boardId/automations/:autoId', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  board.automations = board.automations.filter((a) => a.id !== req.params.autoId);
  persist(board);
  res.json({ ok: true });
});

// ---- saved views

app.post('/api/boards/:boardId/views', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  const view = {
    id: uid('view'),
    name: (req.body.name || '').trim() || 'New View',
    type: req.body.type || 'table',
    filters: req.body.filters || [],
    sorts: req.body.sorts || [],
  };
  board.views.push(view);
  persist(board);
  res.status(201).json(view);
});

app.patch('/api/boards/:boardId/views/:viewId', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  const view = board.views.find((v) => v.id === req.params.viewId);
  if (!view) return res.status(404).json({ error: 'view not found' });
  for (const k of ['name', 'type', 'filters', 'sorts']) if (k in req.body) view[k] = req.body[k];
  persist(board);
  res.json(view);
});

app.delete('/api/boards/:boardId/views/:viewId', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  board.views = board.views.filter((v) => v.id !== req.params.viewId);
  persist(board);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- chat

const CHANNEL_TYPES = new Set(['group', 'broadcast', 'dm', 'ai']);
// Cap per-attachment size so a channel document stays well under Firestore's
// 1 MiB limit. ~900 KB of base64 ≈ 675 KB of binary — fine for short voice/
// video notes and images, not for long videos.
const MAX_ATTACHMENT_BYTES = 900_000;

function findChannel(req, res) {
  const ch = db.channels.find((c) => c.id === req.params.channelId);
  if (!ch) res.status(404).json({ error: 'channel not found' });
  return ch;
}

function channelSummary(c) {
  const last = c.messages[c.messages.length - 1];
  return {
    id: c.id, type: c.type, private: !!c.private, name: c.name, description: c.description, members: c.members,
    messageCount: c.messages.length,
    lastMessage: last ? { text: last.text || `[${last.type}]`, userId: last.userId, at: last.at } : null,
  };
}

app.get('/api/channels', (req, res) => res.json(db.channels.map(channelSummary)));

app.get('/api/channels/:channelId', (req, res) => {
  const ch = findChannel(req, res);
  if (ch) res.json(ch);
});

app.post('/api/channels', (req, res) => {
  const type = CHANNEL_TYPES.has(req.body.type) ? req.body.type : 'group';
  const ch = {
    id: uid('ch'),
    type,
    private: !!req.body.private,
    name: (req.body.name || '').trim() || (type === 'dm' ? '' : 'new-channel'),
    description: req.body.description || '',
    members: Array.isArray(req.body.members) && req.body.members.length ? req.body.members : db.users.map((u) => u.id),
    messages: [],
  };
  db.channels.push(ch);
  persistChannel(ch);
  res.status(201).json(channelSummary(ch));
});

app.delete('/api/channels/:channelId', (req, res) => {
  const idx = db.channels.findIndex((c) => c.id === req.params.channelId);
  if (idx === -1) return res.status(404).json({ error: 'channel not found' });
  db.channels.splice(idx, 1);
  // Channel docs are removed on next full save; for the file backend the whole
  // file is rewritten anyway. Fire a meta flush to persist promptly.
  persistMeta();
  res.json({ ok: true });
});

function validateAttachments(attachments) {
  if (!Array.isArray(attachments)) return [];
  const out = [];
  for (const a of attachments.slice(0, 10)) {
    if (!a || typeof a.url !== 'string') continue;
    if (a.url.length > MAX_ATTACHMENT_BYTES) throw new Error('attachment too large');
    out.push({ name: a.name || 'file', url: a.url, mime: a.mime || '', kind: a.kind || 'file' });
  }
  return out;
}

app.post('/api/channels/:channelId/messages', async (req, res) => {
  const ch = findChannel(req, res);
  if (!ch) return;
  const author = actorId(req);
  let attachments;
  try { attachments = validateAttachments(req.body.attachments); }
  catch { return res.status(413).json({ error: 'attachment too large (max ~675 KB each)' }); }

  const text = (req.body.text || '').trim();
  const mentions = Array.isArray(req.body.mentions) ? req.body.mentions : [];
  if (!text && !attachments.length && !req.body.taskRef) return res.status(400).json({ error: 'empty message' });

  const message = {
    id: uid('msg'),
    userId: author,
    type: req.body.type || (attachments[0]?.kind) || 'text',
    text,
    attachments,
    mentions,
    taskRef: req.body.taskRef || null,
    at: new Date().toISOString(),
  };
  ch.messages.push(message);

  // Notify human @mentions.
  for (const m of mentions) {
    if (m === author || m === 'ai') continue;
    notify(m, { channelId: ch.id, text: `${userName(author)} mentioned you in #${ch.name}` });
  }

  // If this is the AI channel, or the AI was @mentioned, generate a reply.
  let aiReply = null;
  const wantsAi = ch.type === 'ai' || mentions.includes('ai') || /(^|\s)@ai(\s|$)/i.test(text);
  if (wantsAi && text) {
    const answer = await aiRespond(text, author);
    aiReply = { id: uid('msg'), userId: 'ai', type: 'ai', text: answer, attachments: [], mentions: [], at: new Date().toISOString() };
    ch.messages.push(aiReply);
  }

  persistChannel(ch);
  res.status(201).json({ message, aiReply });
});

app.delete('/api/channels/:channelId/messages/:msgId', (req, res) => {
  const ch = findChannel(req, res);
  if (!ch) return;
  ch.messages = ch.messages.filter((m) => m.id !== req.params.msgId);
  persistChannel(ch);
  res.json({ ok: true });
});

// ---- quick replies

app.get('/api/quick-replies', (req, res) => res.json(db.quickReplies));

app.post('/api/quick-replies', (req, res) => {
  const text = (req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'empty' });
  db.quickReplies.push(text);
  persistMeta();
  res.status(201).json(db.quickReplies);
});

app.delete('/api/quick-replies', (req, res) => {
  const text = req.body.text;
  db.quickReplies = db.quickReplies.filter((q) => q !== text);
  persistMeta();
  res.json(db.quickReplies);
});

// ---- AI assistant (asks about tasks). Uses Claude when ANTHROPIC_API_KEY is
// set, otherwise a local intent engine that reads the boards directly.

app.post('/api/ai/query', async (req, res) => {
  const text = (req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'empty query' });
  const answer = await aiRespond(text, actorId(req));
  res.json({ answer });
});

// Flatten every item across boards into a queryable shape.
function gatherItems() {
  const out = [];
  for (const b of db.boards) {
    for (const g of b.groups) {
      for (const it of g.items) {
        const statusCol = b.columns.find((c) => c.type === 'status');
        const personCol = b.columns.find((c) => c.type === 'person');
        const numberCol = b.columns.find((c) => c.type === 'number');
        const dateCols = b.columns.filter((c) => c.type === 'date' || c.type === 'timeline');
        const statusLabel = statusCol ? statusCol.labels.find((l) => l.id === it.values[statusCol.id])?.text : null;
        const dates = [];
        for (const dc of dateCols) {
          const v = it.values[dc.id];
          if (dc.type === 'date' && v) dates.push(v);
          else if (dc.type === 'timeline' && v?.end) dates.push(v.end);
        }
        out.push({
          board: b.name, group: g.title, name: it.name,
          status: statusLabel, statusColTitle: statusCol?.title,
          owner: personCol ? userName(it.values[personCol.id]) : null,
          ownerId: personCol ? it.values[personCol.id] : null,
          amount: numberCol ? it.values[numberCol.id] : null,
          amountUnit: numberCol?.unit || '',
          dates,
        });
      }
    }
  }
  return out;
}

const GEMINI_API_KEY = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

// System prompt with the CRM data inlined, shared by every LLM provider.
function aiSystemPrompt(actor) {
  const context = JSON.stringify(gatherItems()).slice(0, 60_000);
  const me = userName(actor);
  return `You are OpenCRM's assistant. Answer questions about the user's CRM tasks/deals using ONLY the JSON data provided. Be concise and use short bullet lists. The current user is "${me}". Today is ${new Date().toISOString().slice(0, 10)}.\n\nDATA:\n${context}`;
}

// Pick a provider: an explicit AI_PROVIDER wins, otherwise auto-detect by which
// API key is present (Gemini preferred), falling back to the local engine.
function aiProvider() {
  const forced = (process.env.AI_PROVIDER || '').toLowerCase();
  if (forced) return forced;
  if (GEMINI_API_KEY()) return 'gemini';
  if (process.env.ANTHROPIC_API_KEY) return 'claude';
  return 'local';
}

async function aiRespond(text, actor) {
  const provider = aiProvider();
  try {
    if (provider === 'gemini' && GEMINI_API_KEY()) return await aiRespondGemini(text, actor);
    if (provider === 'claude' && process.env.ANTHROPIC_API_KEY) return await aiRespondClaude(text, actor);
  } catch (err) {
    console.error(`${provider} call failed, using local AI:`, err.message);
  }
  return aiRespondLocal(text, actor);
}

async function aiRespondGemini(text, actor) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = {
    system_instruction: { parts: [{ text: aiSystemPrompt(actor) }] },
    contents: [{ role: 'user', parts: [{ text }] }],
    generationConfig: { maxOutputTokens: 600, temperature: 0.2 },
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY() },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Gemini ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const data = await resp.json();
  const answer = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text).join('').trim();
  return answer || 'No answer.';
}

async function aiRespondClaude(text, actor) {
  const body = {
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
    max_tokens: 600,
    system: aiSystemPrompt(actor),
    messages: [{ role: 'user', content: text }],
  };
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Anthropic ${resp.status}`);
  const data = await resp.json();
  return (data.content || []).map((c) => c.text).join('').trim() || 'No answer.';
}

// Deterministic fallback: understands the common "ask about tasks" questions.
function aiRespondLocal(text, actor) {
  const q = text.toLowerCase();
  const items = gatherItems();
  const today = new Date().toISOString().slice(0, 10);
  const isOpen = (it) => !/(done|won|lost|closed)/i.test(it.status || '');
  const money = (n, unit) => `${unit || ''}${Number(n).toLocaleString()}`;
  const list = (arr, fmt) => arr.slice(0, 12).map((it) => `• ${fmt(it)}`).join('\n') + (arr.length > 12 ? `\n…and ${arr.length - 12} more` : '');

  // overdue / late
  if (/overdue|past due|late/.test(q)) {
    const od = items.filter((it) => isOpen(it) && it.dates.some((d) => d < today));
    if (!od.length) return 'Nothing is overdue.';
    return `${od.length} overdue item${od.length > 1 ? 's' : ''}:\n` + list(od, (it) => `${it.name} (${it.board}) — due ${it.dates.filter((d) => d < today).sort()[0]}${it.owner ? `, ${it.owner}` : ''}`);
  }

  // due this week / soon
  if (/due|deadline|this week|upcoming|soon/.test(q)) {
    const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const soon = items.filter((it) => isOpen(it) && it.dates.some((d) => d >= today && d <= in7));
    if (!soon.length) return 'Nothing due in the next 7 days.';
    return `Due within 7 days (${soon.length}):\n` + list(soon, (it) => `${it.name} (${it.board}) — ${it.dates.filter((d) => d >= today && d <= in7).sort()[0]}`);
  }

  // assigned to me / a person
  let who = null;
  if (/\b(me|my|mine|i)\b/.test(q)) who = actor;
  else {
    const named = db.users.find((u) => q.includes(u.name.toLowerCase()) || q.includes(u.name.split(' ')[0].toLowerCase()));
    if (named && /(assigned|owns?|working on|has|task|deal)/.test(q)) who = named.id;
  }
  if (who) {
    const mine = items.filter((it) => it.ownerId === who);
    const open = mine.filter(isOpen);
    if (!mine.length) return `No items are assigned to ${userName(who)}.`;
    return `${userName(who)} has ${mine.length} item${mine.length > 1 ? 's' : ''} (${open.length} open):\n` + list(mine, (it) => `${it.name} — ${it.status || 'no status'} (${it.board})`);
  }

  // count by a status label mentioned in the query
  for (const b of db.boards) {
    const sc = b.columns.find((c) => c.type === 'status');
    if (!sc) continue;
    for (const l of sc.labels) {
      if (q.includes(l.text.toLowerCase())) {
        const matched = items.filter((it) => (it.status || '').toLowerCase() === l.text.toLowerCase());
        return `${matched.length} item${matched.length !== 1 ? 's' : ''} are “${l.text}”:\n` + list(matched, (it) => `${it.name} (${it.board})${it.owner ? ` — ${it.owner}` : ''}`);
      }
    }
  }

  // totals / pipeline value
  if (/total|sum|value|pipeline|worth|revenue/.test(q)) {
    const withAmt = items.filter((it) => typeof it.amount === 'number');
    const sum = withAmt.reduce((a, it) => a + it.amount, 0);
    const openSum = withAmt.filter(isOpen).reduce((a, it) => a + it.amount, 0);
    const unit = withAmt[0]?.amountUnit || '';
    return `Total across ${withAmt.length} items: ${money(sum, unit)} (open: ${money(openSum, unit)}).`;
  }

  // summary / overview
  if (/summary|overview|status|how.*doing|standup/.test(q)) {
    const lines = db.boards.map((b) => {
      const n = b.groups.reduce((a, g) => a + g.items.length, 0);
      return `• ${b.name}: ${n} items`;
    });
    return `Here's the overview:\n${lines.join('\n')}\nAsk me about overdue items, what's due this week, totals, or what's assigned to someone.`;
  }

  return "I can answer questions about your tasks — try:\n• “what's overdue?”\n• “what's due this week?”\n• “what's assigned to me?”\n• “how many deals are in negotiation?”\n• “total pipeline value?”\n• “give me a summary”";
}

// ---------------------------------------------------------------- companion dialer (call logs)

const normalizePhone = (s) => String(s || '').replace(/\D/g, '').slice(-10);

// Find a board item whose phone (then email) column matches — the "contact".
function findContactForCall(payload) {
  const cd = payload.call_details || {};
  const target = normalizePhone(cd.phone_number);
  if (target) {
    for (const board of db.boards) {
      const cols = board.columns.filter((c) => c.type === 'phone');
      if (!cols.length) continue;
      for (const g of board.groups) for (const item of g.items) {
        for (const c of cols) if (normalizePhone(item.values[c.id]) === target) return { board, item };
      }
    }
  }
  const email = String(payload.contact_identification?.email || '').toLowerCase();
  if (email) {
    for (const board of db.boards) {
      const cols = board.columns.filter((c) => c.type === 'email');
      if (!cols.length) continue;
      for (const g of board.groups) for (const item of g.items) {
        for (const c of cols) if (String(item.values[c.id] || '').toLowerCase() === email) return { board, item };
      }
    }
  }
  return null;
}

// Ingestion endpoint for the Android companion dialer. Authenticated with a
// shared Bearer key (CRM_INGEST_KEY), separate from user sessions.
app.post('/api/crm/call-logs', (req, res) => {
  const key = process.env.CRM_INGEST_KEY;
  if (!key) return res.status(503).json({ error: 'call-log ingestion not configured (set CRM_INGEST_KEY)' });
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (token !== key) return res.status(401).json({ error: 'invalid or missing API key' });

  const body = req.body || {};
  const cd = body.call_details || {};
  if (!cd.phone_number) return res.status(400).json({ error: 'missing call_details.phone_number' });

  // Idempotency: a retried request (same client-generated key) must not create a
  // duplicate call, update, or notification.
  const idem = body.idempotency_key || cd.client_id || null;
  if (idem) {
    const existing = db.calls.find((c) => c.idempotencyKey === idem);
    if (existing) return res.status(200).json({ success: true, id: existing.id, matched: !!existing.matchedItemId, deduped: true });
  }

  const match = findContactForCall(body);
  const call = {
    id: uid('call'),
    idempotencyKey: idem,
    at: new Date().toISOString(),
    agent: body.user_profile || null,
    phone: cd.phone_number,
    direction: cd.direction === 'INCOMING' ? 'INCOMING' : 'OUTGOING',
    durationSeconds: Number(cd.duration_seconds) || 0,
    timestamp: Number(cd.timestamp) || Date.now(),
    status: cd.status || 'COMPLETED',
    hasRecording: !!cd.has_recording,
    recordingPath: cd.local_recording_path || null,
    contact: body.contact_identification || null,
    transcript: body.ai_insights?.transcript || null,
    summary: body.ai_insights?.summary || null,
    matchedBoardId: match?.board.id || null,
    matchedItemId: match?.item.id || null,
    matchedItemName: match?.item.name || null,
  };
  db.calls.unshift(call);
  db.calls.length = Math.min(db.calls.length, 2000);

  // Log the call on the matched contact and notify its owner.
  if (match) {
    const mins = Math.floor(call.durationSeconds / 60);
    const dur = `${mins}m ${call.durationSeconds % 60}s`;
    const dir = call.direction === 'INCOMING' ? 'Incoming' : 'Outgoing';
    const text = `${dir} call · ${dur} · ${call.status.toLowerCase()}${call.summary ? `\n\n${call.summary}` : ''}`;
    match.item.updates = match.item.updates || [];
    match.item.updates.push({ id: uid('upd'), userId: 'ai', text, mentions: [], at: call.at, callId: call.id });
    logActivity(match.board, { actorId: 'ai', itemId: match.item.id, itemName: match.item.name, kind: 'call', text: `logged a ${dir.toLowerCase()} call` });
    notify(ownerOf(match.board, match.item), { boardId: match.board.id, itemId: match.item.id, itemName: match.item.name, text: `${dir} call logged for “${match.item.name}”` });
    persist(match.board);
  }
  dirtyMeta = true;
  broadcast({ type: 'calls' });
  persistMeta();
  res.status(200).json({ success: true, id: call.id, matched: !!match, message: 'call log ingested' });
});

// List call logs for the webapp (requires a normal user session).
app.get('/api/calls', (req, res) => res.json(db.calls));

// Generate call transcript + summary server-side so the dialer never has to
// embed a Gemini key in the APK. Same Bearer-key auth as the log endpoint.
app.post('/api/crm/ai-notes', async (req, res) => {
  const key = process.env.CRM_INGEST_KEY;
  if (!key) return res.status(503).json({ error: 'not configured (set CRM_INGEST_KEY)' });
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (token !== key) return res.status(401).json({ error: 'invalid or missing API key' });
  const notes = await generateCallNotes(req.body || {});
  res.json(notes);
});

// Ask Gemini for a JSON object; throws if not configured or on error.
async function geminiJson(prompt) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY() },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.7, maxOutputTokens: 2048 },
    }),
  });
  if (!resp.ok) throw new Error(`Gemini ${resp.status}: ${(await resp.text()).slice(0, 160)}`);
  const data = await resp.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text).join('');
  return JSON.parse(text);
}

async function generateCallNotes(m) {
  const meta = {
    agent: `${m.agent_name || 'Agent'} (${m.agent_role || 'Rep'} at ${m.agent_company || 'the company'})`,
    contact: `${m.contact_name || 'the contact'} (${m.contact_role || 'Customer'} at ${m.contact_company || 'their company'})`,
    direction: m.direction || 'OUTGOING',
    duration: m.duration_seconds || 0,
    topic: m.topic || 'general discussion',
    notes: m.notes || '',
  };
  if (GEMINI_API_KEY()) {
    try {
      const prompt = `Create a professional business call transcript and a separate CRM summary.\n\n` +
        `CALL METADATA:\n- Agent: ${meta.agent}\n- Contact: ${meta.contact}\n- Direction: ${meta.direction}\n` +
        `- Duration: ${meta.duration} seconds\n- Topic/Goal: ${meta.topic}\n- Agent's quick notes: ${meta.notes}\n\n` +
        `Output a raw JSON object EXACTLY: {"transcript": "speaker-by-speaker conversation with natural sales questions, objections and agreements, line breaks between turns", "summary": "executive summary with objectives met, customer sentiment, and a bulleted list of action items"}. No markdown fences.`;
      const j = await geminiJson(prompt);
      if (j && (j.transcript || j.summary)) return { transcript: j.transcript || '', summary: j.summary || '' };
    } catch (err) {
      console.error('call-notes gemini failed, using fallback:', err.message);
    }
  }
  // Deterministic fallback (offline / no key).
  const transcript = `[${m.agent_name || 'Agent'}]: Hi ${m.contact_name || ''}, thanks for taking my call about ${meta.topic}.\n` +
    `[${m.contact_name || 'Contact'}]: Of course — I was just reviewing the details.\n` +
    `[${m.agent_name || 'Agent'}]: Great, we've incorporated your feedback. Let's line up next steps.\n\n[Generated summary — real transcription unavailable.]`;
  const summary = `Objective: ${meta.topic}.\n\nKey points:\n- Reviewed details with ${m.contact_name || 'the contact'}.\n- Quick notes: ${meta.notes || 'none'}.\n\nAction items:\n1. Send follow-up materials.\n2. Schedule the next call.`;
  return { transcript, summary };
}

// ---------------------------------------------------------------- static client (production build)

const DIST = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

async function boot() {
  store = await createStore();
  let loaded;
  try {
    loaded = await store.loadAll();
  } catch (err) {
    // Firestore unreachable/not enabled — degrade to the local file store so the
    // app still boots (data won't persist across Cloud Run cold starts).
    console.error(`Primary store (${store.kind}) failed: ${err.message}. Falling back to file store.`);
    store = fileStore();
    loaded = await store.loadAll();
  }
  db = loaded || seedDatabase();
  if (!Array.isArray(db.users) || !db.users.length) db.users = seedDatabase().users;
  ensureShape();
  // Persist the seed (first run) or any migration backfill from ensureShape().
  await store.saveAll(db, { full: true });
  app.listen(PORT, () => {
    console.log(`OpenCRM API listening on http://localhost:${PORT}`);
    console.log(`Storage: ${store.describe()}`);
    const provider = aiProvider();
    const model = provider === 'gemini' ? (process.env.GEMINI_MODEL || 'gemini-2.0-flash')
      : provider === 'claude' ? (process.env.ANTHROPIC_MODEL || 'claude-sonnet-5')
      : 'built-in (no API key)';
    console.log(`AI assistant: ${provider} — ${model}`);
  });
}

boot().catch((err) => {
  console.error('Failed to start OpenCRM:', err);
  process.exit(1);
});
