// Integration tests for the dialer-facing API. Spawns the server on a temp
// port + temp data dir, exercises the endpoints, and asserts responses.
// Run with: npm test
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(__dirname, '..', 'server', 'index.js');
const PORT = 4099;
const BASE = `http://localhost:${PORT}`;
const SECRET = 'test_secret_123';
const dataDir = mkdtempSync(path.join(tmpdir(), 'opencrm-test-'));

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`); }
}

const callPayload = (over = {}) => ({
  event: 'call_logged',
  api_key: SECRET,
  user_profile: { agent_name: 'Alexander Graham', agent_role: 'Director', agent_company: 'TelcoCRM', agent_phone: '+15550007' },
  call_details: {
    phone_number: '+15550199', direction: 'OUTGOING', duration_seconds: 183,
    timestamp: 1752000000000, status: 'COMPLETED', has_recording: true, ...over,
  },
  contact_identification: { contact_id: 2, name: 'Alice Vance', company: 'Acme Corporation', role: 'VP', email: 'alice@acme.com', notes: 'n' },
  ai_insights: { transcript: '...', summary: 'Discussed billing.' },
});

const post = (pathname, body, headers = {}) =>
  fetch(BASE + pathname, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const get = (pathname, headers = {}) => fetch(BASE + pathname, { headers });

async function waitForServer(tries = 40) {
  for (let i = 0; i < tries; i++) {
    try { const r = await get('/api/users'); if (r.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('server did not start');
}

const server = spawn('node', [SERVER], {
  env: { ...process.env, PORT: String(PORT), OPENCRM_DATA_DIR: dataDir, OPENCRM_WEBHOOK_SECRET: SECRET, OPENCRM_API_KEY: SECRET },
  stdio: 'ignore',
});

try {
  await waitForServer();

  console.log('auth');
  check('wrong webhook token → 401', (await post('/api/integrations/call-log', callPayload(), { Authorization: 'Bearer WRONG' })).status === 401);
  check('missing phone → 400', (await post('/api/integrations/call-log', { call_details: {} }, { Authorization: `Bearer ${SECRET}` })).status === 400);
  check('mutating board write without x-api-key → 401', (await post('/api/boards', { name: 'X' })).status === 401);

  console.log('call-log create');
  const r1 = await post('/api/integrations/call-log', callPayload({ external_id: 'call_1' }), { Authorization: `Bearer ${SECRET}` });
  const j1 = await r1.json();
  check('first log → 201', r1.status === 201);
  check('created, not updated', j1.updated === false);
  check('direction mapped to outgoing', j1.item.values.direction === 'outgoing');
  check('outcome mapped to completed', j1.item.values.outcome === 'completed');
  check('duration mapped', j1.item.values.duration === 183);
  check('name from contact', j1.item.name === 'Alice Vance');

  console.log('idempotency');
  const r2 = await post('/api/integrations/call-log', callPayload({ external_id: 'call_1', duration_seconds: 200 }), { Authorization: `Bearer ${SECRET}` });
  const j2 = await r2.json();
  check('same external_id → updated (200)', r2.status === 200 && j2.updated === true);
  check('same item id reused', j2.itemId === j1.itemId);
  check('duration updated to 200', j2.item.values.duration === 200);
  const board = await (await get('/api/boards/board_calls')).json();
  const count = board.groups.reduce((n, g) => n + g.items.length, 0);
  check('no duplicate item created', count === 1);

  console.log('contacts sync');
  const contacts = await (await get('/api/contacts')).json();
  check('contacts endpoint returns seeded contacts', Array.isArray(contacts) && contacts.length >= 5);
  check('contact has phone + company', contacts.every((c) => 'phone' in c && 'company' in c));

  console.log('analytics');
  const stats = await (await get('/api/analytics/calls')).json();
  check('analytics total = 1', stats.total === 1);
  check('analytics byOutcome.completed = 1', stats.byOutcome.completed === 1);
  check('analytics avgDurationSeconds = 200', stats.avgDurationSeconds === 200);
} catch (e) {
  failed++;
  console.error('FATAL', e);
} finally {
  server.kill();
  rmSync(dataDir, { recursive: true, force: true });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
