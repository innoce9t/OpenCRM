// Firebase Authentication helpers: verify the ID token that the client obtains
// from Firebase's Google sign-in popup, and expose the public web config so the
// client can initialize the Firebase SDK.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let authPromise = null;

async function getAdminAuth() {
  if (authPromise) return authPromise;
  authPromise = (async () => {
    const { initializeApp, getApps, cert, applicationDefault } = await import('firebase-admin/app');
    const { getAuth } = await import('firebase-admin/auth');

    // Reuse an app already initialized (e.g. by the Firestore store).
    let app = getApps()[0];
    if (!app) {
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.FIRESTORE_PROJECT_ID;
      const explicit = process.env.FIREBASE_SERVICE_ACCOUNT;
      const defaultPath = path.join(__dirname, 'serviceAccount.json');
      const keyPath = explicit || (fs.existsSync(defaultPath) ? defaultPath : null);

      if (keyPath && fs.existsSync(keyPath)) {
        const sa = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        app = initializeApp({ credential: cert(sa), projectId: sa.project_id || projectId });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        app = initializeApp({ credential: applicationDefault(), projectId });
      } else if (projectId) {
        // verifyIdToken only needs the project id (it validates against Google's public certs).
        app = initializeApp({ projectId });
      } else {
        throw new Error('Firebase auth is not configured (set FIREBASE_PROJECT_ID or provide a service account).');
      }
    }
    return getAuth(app);
  })();
  return authPromise;
}

export async function verifyFirebaseToken(idToken) {
  const auth = await getAdminAuth();
  return auth.verifyIdToken(idToken);
}

// Public web config passed to the client. Returns null unless at least the API
// key and project id are set — the "Continue with Google" button is gated on it.
export function firebaseWebConfig() {
  const apiKey = process.env.FIREBASE_API_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.FIRESTORE_PROJECT_ID;
  if (!apiKey || !projectId) return null;
  return {
    apiKey,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || undefined,
    appId: process.env.FIREBASE_APP_ID || undefined,
  };
}
