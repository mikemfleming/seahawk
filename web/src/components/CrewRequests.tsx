import { Link } from '../navigation';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api';
interface Member { id: string; display_name: string; email: string; status: string; role: string; created_at: string }
export function CrewRequests() {
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function refresh() { setMembers(await api<Member[]>('/api/members')); }
  useEffect(() => { refresh().catch(e => setError(errorMessage(e))); }, []);
  async function review(id: string, status: string) {
    setBusy(true); setError('');
    try { await api('/api/members/review', { id, status }); await refresh(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <section><p className="eyebrow">CREW ACCOUNTS</p><h1>Crew accounts and password help</h1><p>Approval grants contribution access. Each memory, photograph, and clarification still needs your review before publication.</p>{error && <p className="error" role="alert">{error}</p>}{members.filter(m => m.role === 'crew').map(m => <article className="contribution-card" key={m.id}><h2>{m.display_name}</h2><p>{m.email} · {m.status}</p><p>Requested {new Date(m.created_at).toLocaleDateString()}</p><div className="dialog-actions">{m.status !== 'approved' && <button disabled={busy} onClick={() => review(m.id, 'approved')}>Approve crew access</button>}{m.status !== 'declined' && <button disabled={busy} onClick={() => review(m.id, 'declined')}>{m.status === 'approved' ? 'Revoke access' : 'Decline'}</button>}</div></article>)}{!members.some(m => m.role === 'crew') && <p>No crew requests yet.</p>}<PasswordHelpQueue /></section>;
}

export function CrewRequestSummary() {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([api<Member[]>('/api/members', undefined, controller.signal), api<PasswordHelp[]>('/api/password-help', undefined, controller.signal)]).then(([members, requests]) => setCount(members.filter(m => m.role === 'crew' && m.status === 'pending').length + requests.length)).catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); });
    return () => controller.abort();
  }, []);
  return <Link className="task-card featured" to="/workspace/members"><span className="eyebrow">CREW ACCOUNTS</span><strong>{count ?? '…'}</strong><h2>Review account requests ↗</h2><p>{error || 'Crew approvals and password-help requests waiting for you.'}</p></Link>;
}

interface PasswordHelp { id: string; user_id: string; created_at: string; profiles: { email: string; display_name: string } }
export function PasswordHelpQueue() {
  const [requests, setRequests] = useState<PasswordHelp[]>([]);
  const [active, setActive] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [current, setCurrent] = useState('');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function refresh() { setRequests(await api<PasswordHelp[]>('/api/password-help')); }
  useEffect(() => { refresh().catch(e => setError(errorMessage(e))); }, []);
  return <section><h2>Password-help requests</h2><p>Verify the person offline before resetting their password. Requests alone do not prove identity.</p>{message && <p role="status">{message}</p>}{error && <p className="error" role="alert">{error}</p>}{!requests.length && <p>No pending password-help requests.</p>}{requests.map(request => <article className="contribution-card" key={request.id}><h3>{request.profiles.display_name}</h3><p>{request.profiles.email} · Requested {new Date(request.created_at).toLocaleString()}</p>{active !== request.id ? <button onClick={() => { setActive(request.id); setPassword(''); setConfirm(''); setCurrent(''); setVerified(false); setError(''); setMessage(''); }}>Set a replacement password</button> : <form onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (password !== confirm) throw new Error('Replacement passwords must match.');
      const result = await api<{ message: string }>('/api/members/reset-password', { request_id: request.id, password, current_password: current, identity_confirmed: verified });
      setPassword(''); setConfirm(''); setCurrent(''); setActive(''); setMessage(result.message); await refresh();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }}><fieldset disabled={busy}><label className="check"><input type="checkbox" required checked={verified} onChange={e => setVerified(e.target.checked)} /> I verified this person's identity offline.</label><label className="field">Replacement password<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label><label className="field">Confirm replacement password<input type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} /></label><label className="field">Your archivist password<input type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} /></label><p className="hint">Share the replacement password in person. It will not be stored in the request or displayed again. Ask them to change it after signing in.</p><button className="primary" disabled={busy}>{busy ? 'Changing password…' : 'Change their password'}</button><button type="button" onClick={() => { setActive(''); setPassword(''); setConfirm(''); setCurrent(''); }}>Cancel</button></fieldset></form>}</article>)}</section>;
}
