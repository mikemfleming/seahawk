import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { AppError } from './archive.js';
import { checkPassword } from './supabase-auth.js';

export async function resetMemberPassword(admin, access, body, clientFactory = createClient) {
  access.requireArchivist();
  checkPassword(body.password);
  if (body.identity_confirmed !== true) throw new AppError('Confirm that you verified this person offline.');
  if (typeof body.current_password !== 'string' || !body.current_password) throw new AppError('Enter your archivist password.');
  const verification = await access.client.auth.signInWithPassword({ email: access.user.email, password: body.current_password });
  if (verification.error || verification.data.user.id !== access.user.id) throw new AppError('Your archivist password is not correct.', 401);
  const { data: request, error } = await admin.from('password_help_requests').select('*, profiles(email)').eq('id', body.request_id).eq('status', 'pending').single();
  if (error || !request) throw new AppError('This password-help request is no longer pending.', 409);
  const updated = await admin.auth.admin.updateUserById(request.user_id, { password: body.password });
  if (updated.error) throw new AppError('Could not change the password. Please try again.', 503);
  // Use a separate client so target credentials cannot replace the archivist's
  // cookies or the service-role client's Authorization header.
  const env = access.env ?? process.env;
  const temporary = clientFactory(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const session = await temporary.auth.signInWithPassword({ email: request.profiles.email, password: body.password });
  if (session.error) throw new AppError('Password changed, but session revocation could not be confirmed. Retry this request.', 503);
  const logout = await admin.auth.admin.signOut(session.data.session.access_token, 'global');
  if (logout.error) throw new AppError('Password changed, but session revocation could not be confirmed. Retry this request.', 503);
  const completed = await admin.rpc('complete_password_help', { request_id: request.id, reviewer: access.user.id });
  if (completed.error) throw new AppError('Password changed, but the request could not be marked complete. Refresh the queue.', 503);
  return { message: 'Password changed and refresh sessions revoked. Share the replacement password in person. Ask them to change it after signing in.' };
}
