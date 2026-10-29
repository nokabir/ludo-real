// Session tokens for our API, plus Firebase ID token verification
// (no service account needed: tokens are checked against Google's public certs).
import crypto from 'node:crypto';

const SECRET = process.env.TOKEN_SECRET || 'dev-secret-change-me';
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'dream-ludo-6efd8';
const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

export class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

// ---------- our own session tokens ----------
export function signToken(userId) {
  const body = Buffer.from(JSON.stringify({ id: userId, exp: Date.now() + 60 * 864e5 })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const data = JSON.parse(Buffer.from(body, 'base64url').toString());
  return data.exp > Date.now() ? data : null;
}

const bearer = req => { const h = req.headers.authorization || ''; return h.startsWith('Bearer ') ? h.slice(7) : req.query.token; };

export function requireUser(req, res, next) {
  const data = verifyToken(bearer(req));
  if (!data || !data.id) return res.status(401).json({ error: 'Please sign in again' });
  req.userId = data.id;
  next();
}

// ---------- admin ----------
export function signAdminToken() {
  const body = Buffer.from(JSON.stringify({ admin: true, exp: Date.now() + 12 * 3600e3 })).toString('base64url');
  return `${body}.${crypto.createHmac('sha256', SECRET).update(body).digest('base64url')}`;
}

export function requireAdmin(req, res, next) {
  const data = verifyToken(bearer(req));
  if (!data?.admin) return res.status(401).json({ error: 'Admin login required' });
  next();
}

// Constant-time compare that doesn't leak length differences through early exit.
export function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// ---------- Firebase ID tokens ----------
let certs = null, certsExpire = 0;
async function googleCerts() {
  if (certs && Date.now() < certsExpire) return certs;
  const res = await fetch(CERTS_URL, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new AppError('Could not reach Google to check sign-in', 503);
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') || '')?.[1] || 3600);
  certs = await res.json();
  certsExpire = Date.now() + maxAge * 1000;
  return certs;
}

export async function verifyFirebaseToken(idToken) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw new AppError('Invalid sign-in token', 401);
  const [h, p, s] = parts;
  const header = JSON.parse(Buffer.from(h, 'base64url').toString());
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
  if (header.alg !== 'RS256') throw new AppError('Invalid sign-in token', 401);
  const cert = (await googleCerts())[header.kid];
  if (!cert) throw new AppError('Sign-in token key not recognised', 401);
  const ok = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), cert, Buffer.from(s, 'base64url'));
  if (!ok) throw new AppError('Invalid sign-in token', 401);
  const now = Math.floor(Date.now() / 1000);
  if (claims.aud !== PROJECT_ID || claims.iss !== `https://securetoken.google.com/${PROJECT_ID}`) throw new AppError('Sign-in token is for another app', 401);
  if (!claims.sub || claims.exp < now || claims.iat > now + 300) throw new AppError('Sign-in expired, please try again', 401);
  return {
    uid: claims.sub,
    provider: claims.firebase?.sign_in_provider || 'anonymous',
    name: claims.name || null,
    photo: claims.picture || null,
  };
}
