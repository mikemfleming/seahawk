import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { AppError } from './archive.js';

const COOKIE = 'ships_log_workspace';
const SESSION_MS = 12 * 60 * 60 * 1000;
const digest = value => createHash('sha256').update(value).digest();

export function createAccess(password) {
  const expected = digest(password);
  const sessions = new Map();
  function token(req) {
    return (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  }
  function isArchivist(req) {
    const key = token(req);
    const expires = sessions.get(key);
    if (!expires || expires < Date.now()) {
      if (key) sessions.delete(key);
      return false;
    }
    return true;
  }
  return {
    isArchivist,
    requireArchivist(req) {
      if (!isArchivist(req)) throw new AppError('Sign in to the archivist workspace first.', 401);
    },
    signIn(req, res, password) {
      if (typeof password !== 'string' || password.length > 2000 || !timingSafeEqual(expected, digest(password))) {
        throw new AppError('That workspace password is not correct.', 401);
      }
      for (const [key, expires] of sessions) if (expires < Date.now()) sessions.delete(key);
      const key = randomBytes(32).toString('hex');
      sessions.set(key, Date.now() + SESSION_MS);
      res.setHeader('Set-Cookie', `${COOKIE}=${key}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}`);
    },
    signOut(req, res) {
      sessions.delete(token(req));
      res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
    },
  };
}
