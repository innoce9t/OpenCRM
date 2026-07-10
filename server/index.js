import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedDatabase, DEFAULT_STATUS_LABELS, PRIORITY_LABELS } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.OPENCRM_DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PORT = process.env.PORT || 4000;

// ---------------------------------------------------------------- storage

let db;
if (fs.existsSync(DB_FILE)) {
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
} else {
  db = seedDatabase();
}

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  }, 250);
}

let counter = 1;
const uid = (prefix) => `${prefix}_${(counter++).toString(36)}${Date.now().toString(36)}`;

const GROUP_COLORS = ['#579bfc', '#00c875', '#a25ddc', '#e2445c', '#fdab3d', '#66ccff', '#bb3354', '#7f5347'];

// ---------------------------------------------------------------- helpers

function findBoard(req, res) {
  const board = db.boards.find((b) => b.id === req.params.boardId);
  if (!board) res.status(404).json({ error: 'board not found' });
  return board;
}

function findGroup(board, groupId, res) {
  const group = board.groups.find((g) => g.id === groupId);
  if (!group) res.status(404).json({ error: 'group not found' });
  return group;
}

// ---------------------------------------------------------------- app

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/users', (req, res) => res.json(db.users));

app.get('/api/boards', (req, res) => {
  res.json(db.boards.map((b) => ({
    id: b.id,
    name: b.name,
    description: b.description,
    itemCount: b.groups.reduce((n, g) => n + g.items.length, 0),
  })));
});

app.get('/api/boards/:boardId', (req, res) => {
  const board = findBoard(req, res);
  if (board) res.json(board);
});

app.post('/api/boards', (req, res) => {
  const name = (req.body.name || '').trim() || 'New Board';
  const board = {
    id: uid('board'),
    name,
    description: req.body.description || '',
    columns: [
      { id: 'owner', title: 'Owner', type: 'person' },
      { id: 'status', title: 'Status', type: 'status', labels: DEFAULT_STATUS_LABELS },
      { id: 'date', title: 'Date', type: 'date' },
    ],
    groups: [
      { id: uid('grp'), title: 'Group Title', color: GROUP_COLORS[0], collapsed: false, items: [] },
    ],
  };
  db.boards.push(board);
  persist();
  res.status(201).json(board);
});

app.patch('/api/boards/:boardId', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  if (typeof req.body.name === 'string' && req.body.name.trim()) board.name = req.body.name.trim();
  if (typeof req.body.description === 'string') board.description = req.body.description;
  persist();
  res.json(board);
});

app.delete('/api/boards/:boardId', (req, res) => {
  const idx = db.boards.findIndex((b) => b.id === req.params.boardId);
  if (idx === -1) return res.status(404).json({ error: 'board not found' });
  db.boards.splice(idx, 1);
  persist();
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
  persist();
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
  persist();
  res.json(group);
});

app.delete('/api/boards/:boardId/groups/:groupId', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  const idx = board.groups.findIndex((g) => g.id === req.params.groupId);
  if (idx === -1) return res.status(404).json({ error: 'group not found' });
  board.groups.splice(idx, 1);
  persist();
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
  };
  if (req.body.position === 'top') group.items.unshift(item);
  else group.items.push(item);
  persist();
  res.status(201).json(item);
});

app.patch('/api/boards/:boardId/items/:itemId', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  for (const group of board.groups) {
    const item = group.items.find((i) => i.id === req.params.itemId);
    if (!item) continue;
    if (typeof req.body.name === 'string' && req.body.name.trim()) item.name = req.body.name.trim();
    if (req.body.values && typeof req.body.values === 'object') {
      Object.assign(item.values, req.body.values);
      // null clears a value
      for (const [k, v] of Object.entries(item.values)) if (v === null) delete item.values[k];
    }
    persist();
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
    persist();
    return res.json(item);
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
    persist();
    return res.json({ ok: true });
  }
  res.status(404).json({ error: 'item not found' });
});

// ---- columns

const COLUMN_PRESETS = {
  text: () => ({ type: 'text', title: 'Text' }),
  number: () => ({ type: 'number', title: 'Numbers', unit: '' }),
  status: () => ({ type: 'status', title: 'Status', labels: DEFAULT_STATUS_LABELS }),
  priority: () => ({ type: 'status', title: 'Priority', labels: PRIORITY_LABELS }),
  date: () => ({ type: 'date', title: 'Date' }),
  person: () => ({ type: 'person', title: 'People' }),
};

app.post('/api/boards/:boardId/columns', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  const preset = COLUMN_PRESETS[req.body.type];
  if (!preset) return res.status(400).json({ error: 'unknown column type' });
  const column = { id: uid('col'), ...preset() };
  if (typeof req.body.title === 'string' && req.body.title.trim()) column.title = req.body.title.trim();
  board.columns.push(column);
  persist();
  res.status(201).json(column);
});

app.patch('/api/boards/:boardId/columns/:columnId', (req, res) => {
  const board = findBoard(req, res);
  if (!board) return;
  const column = board.columns.find((c) => c.id === req.params.columnId);
  if (!column) return res.status(404).json({ error: 'column not found' });
  if (typeof req.body.title === 'string' && req.body.title.trim()) column.title = req.body.title.trim();
  persist();
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
  persist();
  res.json({ ok: true });
});

// ---------------------------------------------------------------- static client (production build)

const DIST = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`OpenCRM API listening on http://localhost:${PORT}`);
});
