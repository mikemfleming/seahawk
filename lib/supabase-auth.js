import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { AppError } from './archive.js';

export async function requestAccess(req, res, admin, env = process.env, clientFactory = createServerClient) {
  const origin = env.APP_ORIGIN || 'http://127.0.0.1:8000';
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  const client = token ? createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } }) : clientFactory(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: { httpOnly: true, secure: origin.startsWith('https:'), sameSite: 'lax', path: '/' },
    cookies: {
      getAll: () => (req.headers.cookie || '').split(';').filter(Boolean).map(part => { const i = part.indexOf('='); return { name: part.slice(0, i).trim(), value: decodeURIComponent(part.slice(i + 1)) }; }),
      setAll: cookies => {
        const previous = res.getHeader('Set-Cookie') || [];
        res.setHeader('Set-Cookie', [...(Array.isArray(previous) ? previous : [previous]), ...cookies.map(({ name, value, options }) => `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${origin.startsWith('https:') ? '; Secure' : ''}; Max-Age=${options.maxAge ?? 31536000}`)]);
      },
    },
  });
  const { data: { user } } = await client.auth.getUser(token || undefined);
  let profile = null;
  if (user) {
    const { data, error } = await admin.from('profiles').select('*').eq('id', user.id).single();
    if (error) throw new AppError('Could not verify account permissions.', 503);
    profile = data;
  }
  const role = !user ? 'family' : profile?.role === 'archivist' ? 'archivist' : profile?.status === 'approved' ? 'crew' : 'pending';
  const person = profile ? { id: profile.id, name: profile.display_name, invited: true, created_at: profile.created_at } : null;
  return {
    client, user, profile, role, person, origin, env,
    isArchivist: () => role === 'archivist',
    requireArchivist: () => { if (role !== 'archivist') throw new AppError('Archivist access required.', user ? 403 : 401); },
    requireCrew: () => { if (!['crew', 'archivist'].includes(role)) throw new AppError(user ? 'Your crew request must be approved by the archivist.' : 'Sign in with an approved crew account first.', user ? 403 : 401); },
  };
}

const attempts = new Map();
export function limitAuth(req) {
  const key = req.socket.remoteAddress;
  const now = Date.now();
  for (const [key, item] of attempts) if (item.until < now) attempts.delete(key);
  const item = attempts.get(key) || { count: 0, until: now + 15 * 60000 };
  if (++item.count > 30) throw new AppError('Too many attempts. Please try again in 15 minutes.', 429);
  attempts.set(key, item);
}
export function checkPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw new AppError('Use a password between 12 and 128 characters.');
}
export async function authAction(path, body, access, admin) {
  const { client } = access;
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  let result;
  if (path === '/api/session') {
    result = await client.auth.signInWithPassword({ email, password: body.password });
    if (result.error) throw new AppError('Unable to sign in. Check your email and password.', 401);
    return { ok: true };
  }
  if (path === '/api/signup') {
    checkPassword(body.password);
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 120) throw new AppError('Enter your name (up to 120 characters).');
    result = await client.auth.signUp({ email, password: body.password, options: { data: { display_name: body.name.trim() } } });
    if (result.error) throw new AppError('Unable to submit signup. Check your details or try again later.');
    return { message: 'Your crew request has been submitted. The archivist must approve your account before you can contribute.' };
  }
  if (path === '/api/forgot-password') {
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('Enter a valid account email.');
    const { error } = await admin.rpc('request_password_help', { account_email: email.toLowerCase() });
    if (error) throw new AppError('Could not submit your request. Please try again.', 503);
    return { message: 'If this account exists, a password-help request is now visible to the archivist. Please speak with them in person to arrange a replacement password. No email will be sent.' };
  }
  if (path === '/api/change-password') {
    if (!access.user) throw new AppError('Sign in first, or ask the archivist for password help.', 401);
    checkPassword(body.password);
    if (typeof body.current_password !== 'string' || !body.current_password) throw new AppError('Enter your current password.');
    result = await client.auth.updateUser({ password: body.password, current_password: body.current_password });
    if (result.error) throw new AppError('Unable to change password. Check your current password or ask the archivist for help.');
    const logout = await client.auth.signOut({ scope: 'global' });
    if (logout.error) throw new AppError('Password changed, but session revocation could not be confirmed. Sign out and request a new sign-in.');
    return { message: 'Password changed. Sign in again on your devices.' };
  }
  if (path === '/api/logout') { const result = await client.auth.signOut(); if (result.error) throw new AppError('Could not confirm sign-out. Please try again.', 503); return { ok: true }; }
  return null;
}
