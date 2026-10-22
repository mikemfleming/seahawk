import { recordRequest } from './diagnostics';
import { cloudApi, cloudAuth } from './cloud';
export async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  if (cloudAuth && ['/api/session', '/api/signup', '/api/logout', '/api/change-password'].includes(path)) {
    const fields = (body || {}) as Record<string, string>;
    if (['/api/signup', '/api/change-password'].includes(path) && (typeof fields.password !== 'string' || fields.password.length < 12 || fields.password.length > 128)) throw new Error('Use a password between 12 and 128 characters.');
    let result;
    if (path === '/api/session') result = await cloudAuth.auth.signInWithPassword({ email: fields.email, password: fields.password });
    else if (path === '/api/signup') {
      if (!fields.name?.trim() || fields.name.length > 120) throw new Error('Enter your name (up to 120 characters).');
      result = await cloudAuth.auth.signUp({ email: fields.email, password: fields.password, options: { data: { display_name: fields.name.trim() } } });
    } else if (path === '/api/logout') result = await cloudAuth.auth.signOut();
    else {
      if (!fields.current_password) throw new Error('Enter your current password.');
      result = await cloudAuth.auth.updateUser({ password: fields.password, current_password: fields.current_password });
      if (!result.error) { const logout = await cloudAuth.auth.signOut({ scope: 'global' }); if (logout.error) throw new Error('Password changed, but sign-out could not be confirmed. Sign out and try again.'); }
    }
    if (result.error) throw new Error(path === '/api/session' ? 'Unable to sign in. Check your email and password.' : 'Unable to complete the request. Check your details and try again.');
    return { message: path === '/api/signup' ? 'Your crew request has been submitted. Mike must approve your account before you can contribute.' : path === '/api/change-password' ? 'Password changed. Sign in again.' : undefined } as T;
  }
  const started = performance.now();
  let response: Response | undefined;
  try {
    const token = cloudAuth ? (await cloudAuth.auth.getSession()).data.session?.access_token : null;
    response = await fetch(cloudApi ? cloudApi + path : path, {
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : {
        method: 'POST', body: JSON.stringify(body),
      }),
      signal,
    });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || 'Request failed.');
    return value as T;
  } finally { recordRequest(path, response?.status || 0, started, response); }
}

export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';

export function fileDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read the photo.'));
    reader.onerror = () => reject(new Error('Could not read the photo.'));
    reader.readAsDataURL(file);
  });
}
