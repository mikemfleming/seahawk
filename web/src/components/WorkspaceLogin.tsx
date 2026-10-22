import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '../api';
import { Modal } from './Modal';
type Mode = 'signin' | 'signup' | 'forgot' | 'password';
export function WorkspaceLogin({ onClose, onSignedIn, initialMode = 'signin' }: { onClose: () => void; onSignedIn: () => Promise<void>; initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [current, setCurrent] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const titles = { signin: 'Welcome aboard', signup: 'Join the crew', forgot: 'Ask for password help', password: 'Choose a new password' };
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      if ((mode === 'signup' || mode === 'password') && password !== confirm) throw new Error('Passwords must match.');
      const result = await api<{message?: string}>(`/api/${{ signin: 'session', signup: 'signup', forgot: 'forgot-password', password: 'change-password' }[mode]}`, { email, name, password, current_password: current });
      setPassword(''); setConfirm(''); setCurrent('');
      if (mode === 'signin') { await onSignedIn(); onClose(); }
      else { setMessage(result.message || 'Done.'); if (mode === 'signup') await onSignedIn(); if (mode === 'password') { setMode('signin'); await onSignedIn(); } }
    } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
  }
  return <Modal id="account-login" titleId="account-title" onClose={onClose} busy={busy}><form onSubmit={submit}>
    <div className="dialog-heading"><div><p className="eyebrow">SEAHAWK · FAMILY AND CREW</p><h2 id="account-title">{titles[mode]}</h2></div><button type="button" className="close" onClick={onClose} disabled={busy} aria-label="Close">×</button></div>
    {mode === 'signup' && <><p>The archivist will verify your request and approve your account. Approved crew can share memories, photos, identifications, and clarifications for review.</p><label className="field">Your name<input autoComplete="name" value={name} onChange={e => setName(e.target.value)} maxLength={120} required /></label></>}
    {mode === 'forgot' && <p>Enter your account email to request help in the archivist workspace. Speak with the archivist in person to verify who you are and arrange a replacement password. No email will be sent.</p>}
    {mode !== 'password' && <label className="field">Email<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={busy} /></label>}
    {mode === 'password' && <label className="field">Current password<input type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} required /></label>}
    {mode !== 'forgot' && <label className="field">{mode === 'password' ? 'New password' : 'Password'}<input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={mode === 'signin' ? undefined : 12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} required disabled={busy} /></label>}
    {(mode === 'signup' || mode === 'password') && <><p className="hint">Use at least 12 characters. A password manager can create and store a unique password.</p><label className="field">Confirm password<input type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required /></label></>}
    {error && <p className="error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <button className="primary wide" disabled={busy}>{busy ? 'Please wait…' : { signin: 'Sign in', signup: 'Request crew access', forgot: 'Notify the archivist', password: 'Change password' }[mode]}</button>
    <div className="dialog-actions">{(['signin', 'signup', 'forgot'] as Mode[]).filter(item => item !== mode).map(item => <button type="button" className="quiet" key={item} disabled={busy} onClick={() => { setMode(item); setError(''); setMessage(''); }}>{item === 'signin' ? 'Sign in' : item === 'signup' ? 'Create an account' : 'Forgot password?'}</button>)}</div>
  </form></Modal>;
}
