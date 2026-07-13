// Password hashing (scrypt, built-in — no external deps) and token helpers.
import crypto from 'node:crypto';

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, hash) {
  if (!salt || !hash) return false;
  const h = crypto.scryptSync(String(password), salt, 64).toString('hex');
  const a = Buffer.from(h);
  const b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function newToken() {
  return crypto.randomBytes(24).toString('hex');
}

// Strip secrets before sending a user to the client.
export function sanitizeUser(u) {
  if (!u) return null;
  const { pwHash, pwSalt, ...safe } = u;
  return safe;
}
