// Swappable persistence for OpenCRM.
//
// Two backends behind one small async interface:
//   - "file"      : the original server/data/db.json (used when no Firestore
//                   credentials are configured, so the app runs with zero setup)
//   - "firestore" : Google Cloud Firestore, used automatically once a service
//                   account is provided (see resolveFirestore()).
//
// The in-memory shape the server works with is unchanged:
//   { users: [...], boards: [...], notifications: [...], channels: [...], quickReplies: [...] }
//
// Firestore layout:
//   boards/{boardId}          -> the full board document
//   channels/{channelId}      -> a chat channel with its messages
//   meta/users                -> { list: [...] }
//   meta/notifications        -> { list: [...] }
//   meta/quickReplies         -> { list: [...] }
// Boards and channels are each stored as a single document. That's simple and
// keeps route handlers straightforward; the tradeoff is a board/channel must
// stay under Firestore's 1 MiB per-document limit.
//
// saveAll(db, opts) is granular: opts.full writes everything (seed/boot), else
// it writes only opts.boards / opts.channels, deletes opts.deletedBoardIds, and
// rewrites the meta docs when opts.meta is set.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- file backend

export function fileStore() {
  const DATA_DIR = process.env.OPENCRM_DATA_DIR || path.join(__dirname, 'data');
  const DB_FILE = path.join(DATA_DIR, 'db.json');
  return {
    kind: 'file',
    describe: () => `JSON file (${DB_FILE})`,
    async loadAll() {
      if (!fs.existsSync(DB_FILE)) return null;
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    },
    // A single file is cheap to rewrite wholesale, so opts is ignored here.
    async saveAll(db) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    },
  };
}

// ---------------------------------------------------------------- firestore backend

// Where might a service account come from? In priority order:
//   1. FIREBASE_SERVICE_ACCOUNT  -> path to a service-account JSON key
//   2. server/serviceAccount.json (default drop-in location)
//   3. GOOGLE_APPLICATION_CREDENTIALS -> path, via application-default creds
// Returns { credential, projectId } or null when nothing is configured.
function resolveFirestore() {
  const explicit = process.env.FIREBASE_SERVICE_ACCOUNT;
  const defaultPath = path.join(__dirname, 'serviceAccount.json');
  const keyPath = explicit || (fs.existsSync(defaultPath) ? defaultPath : null);

  if (keyPath) {
    if (!fs.existsSync(keyPath)) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT points to a missing file: ${keyPath}`);
    }
    const json = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    return { serviceAccount: json, projectId: json.project_id || process.env.FIRESTORE_PROJECT_ID };
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return { applicationDefault: true, projectId: process.env.FIRESTORE_PROJECT_ID };
  }
  // On Google Cloud (Cloud Run/GCE), Application Default Credentials are
  // available from the metadata server — opt in by setting FIRESTORE_PROJECT_ID.
  const adcProject = process.env.FIRESTORE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  if (adcProject) {
    return { applicationDefault: true, projectId: adcProject };
  }
  return null;
}

async function firestoreStore(config) {
  const { initializeApp, cert, applicationDefault, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: config.applicationDefault ? applicationDefault() : cert(config.serviceAccount),
        projectId: config.projectId,
      });
  const fdb = getFirestore(app);
  const boardsCol = fdb.collection(process.env.FIRESTORE_COLLECTION || 'boards');
  const channelsCol = fdb.collection('channels');
  const metaCol = fdb.collection('meta');

  const writeMeta = (batch, db) => {
    batch.set(metaCol.doc('users'), { list: db.users || [] });
    batch.set(metaCol.doc('notifications'), { list: db.notifications || [] });
    batch.set(metaCol.doc('quickReplies'), { list: db.quickReplies || [] });
  };

  return {
    kind: 'firestore',
    describe: () => `Firestore (project ${config.projectId || 'default'})`,

    async loadAll() {
      const [boardsSnap, channelsSnap, usersSnap, notifsSnap, qrSnap] = await Promise.all([
        boardsCol.get(),
        channelsCol.get(),
        metaCol.doc('users').get(),
        metaCol.doc('notifications').get(),
        metaCol.doc('quickReplies').get(),
      ]);
      if (boardsSnap.empty && !usersSnap.exists) return null; // nothing stored yet -> caller seeds
      return {
        users: usersSnap.exists ? (usersSnap.data().list || []) : [],
        boards: boardsSnap.docs.map((d) => d.data()),
        channels: channelsSnap.docs.map((d) => d.data()),
        notifications: notifsSnap.exists ? (notifsSnap.data().list || []) : [],
        quickReplies: qrSnap.exists ? (qrSnap.data().list || []) : [],
      };
    },

    // Granular write. Debounced by the caller so edit bursts collapse to one batch.
    async saveAll(db, opts = {}) {
      const batch = fdb.batch();
      let writes = 0;
      if (opts.full) {
        for (const board of db.boards) { batch.set(boardsCol.doc(board.id), board); writes++; }
        for (const ch of db.channels || []) { batch.set(channelsCol.doc(ch.id), ch); writes++; }
        writeMeta(batch, db); writes += 3;
      } else {
        for (const board of opts.boards || []) { batch.set(boardsCol.doc(board.id), board); writes++; }
        for (const ch of opts.channels || []) { batch.set(channelsCol.doc(ch.id), ch); writes++; }
        for (const id of opts.deletedBoardIds || []) { batch.delete(boardsCol.doc(id)); writes++; }
        if (opts.meta) { writeMeta(batch, db); writes += 3; }
      }
      if (writes > 0) await batch.commit();
    },
  };
}

// ---------------------------------------------------------------- factory

export async function createStore() {
  const fsConfig = resolveFirestore();
  if (fsConfig) {
    try {
      return await firestoreStore(fsConfig);
    } catch (err) {
      console.error('Failed to initialize Firestore, falling back to file store:', err.message);
    }
  }
  return fileStore();
}
