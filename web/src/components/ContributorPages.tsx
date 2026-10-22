import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api';
import { Link } from '../navigation';
import { type Archive, type Contribution, type Contributor, type MyContributions } from '../types';
import { ContributionContent, contributionLabels } from './FamilyContributions';

export function YourContributions({ onScan }: { onScan: (url: string) => void }) {
  const [data, setData] = useState<MyContributions | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { const controller = new AbortController(); api<MyContributions>('/api/me', undefined, controller.signal).then(setData).catch(error => { if (!controller.signal.aborted) setError(errorMessage(error)); }); return () => controller.abort(); }, []);
  return <section className="personal-page"><div className="compact-heading"><p className="eyebrow">YOUR SUBMISSIONS</p><h1>Your contributions</h1><p>{data?.contributor ? `${data.contributor.name}, here’s what you’ve shared with the archive.` : 'Memories, names, and photographs you have sent to the archivist.'}</p></div>
    {error && <p className="error" role="alert">{error}</p>}
    {!data && !error && <p role="status">Finding your contributions…</p>}
    {data && <><p className="personal-identity">{'Your submissions are linked to your crew account. Sign in on another device to return to them.'}</p>{data.contributions.map(item => <article className="contribution-card" key={item.id}><div className="section-heading"><p className="eyebrow">{contributionLabels[item.kind]}</p><span className={`badge ${item.status}`}>{item.status === 'pending' ? 'Awaiting review' : item.status === 'approved' ? item.entry_visibility === 'private' ? 'Approved · entry private' : 'Shared with family' : 'Kept private'}</span></div><p className="subline">For “{item.entry_title}” · {new Date(item.created_at).toLocaleDateString()}</p><ContributionContent item={item} onScan={onScan} /><p className="hint">{item.status === 'pending' ? 'Saved safely. It will appear in the family journal after review.' : item.status === 'declined' ? 'The archivist has kept this contribution out of the family journal. Your submission is still preserved here.' : 'Approved for the family journal; the entry may still be private while the archivist prepares it.'}</p><Link className="entry-reference" to={`/entries/${item.entry_id}`}>Visit the entry ↗</Link></article>)}{!data.contributions.length && <div className="empty"><h2>No contributions yet.</h2><p>Open an entry in the journal and share something you remember. It will appear here immediately, even while awaiting review.</p><Link className="outlined" to="/">Explore the journal ↗</Link></div>}</>}
  </section>;
}
export function JoinFamily({ token, onJoined }: { token: string; onJoined: () => Promise<void> }) {
  const [invite, setInvite] = useState<{ name: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setInvite(null); setError(''); const controller = new AbortController(); api<{ name: string }>(`/api/invitations/${token}`, undefined, controller.signal).then(setInvite).catch(error => { if (!controller.signal.aborted) setError(errorMessage(error)); }); return () => controller.abort(); }, [token]);
  return <section className="personal-page"><div className="compact-heading"><p className="eyebrow">WELCOME ABOARD</p><h1>{invite ? `An invitation for ${invite.name}.` : 'Your family invitation'}</h1><p>This personal link connects your contributions to you, so you can return to them on this device.</p></div>{error && <p className="error" role="alert">{error}</p>}{invite && <><p>Please use this link only if you are {invite.name}. It can be used once.</p><button className="primary" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await api('/api/contributor/join', { token }); await onJoined(); } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); } }}>{busy ? 'Joining…' : `Continue as ${invite.name}`}</button></>}</section>;
}
export function Invitations({ archive, onRefresh }: { archive: Archive; onRefresh: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [person, setPerson] = useState('');
  const [result, setResult] = useState<{ name: string; path: string; expires_at: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  return <section className="personal-page"><div className="compact-heading"><p className="eyebrow">FAMILY ACCESS</p><h1>Invite a contributor.</h1><p>Create a personal, single-use link. Share it yourself with the intended family member.</p></div><form className="invitation-form" onSubmit={async event => { event.preventDefault(); setBusy(true); setError(''); setCopied(false); try { setResult(await api('/api/invitations', { name, contributor_id: person || undefined })); await onRefresh(); } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); } }}>
    <label className="field">Who is this invitation for?<select value={person} onChange={event => { setPerson(event.target.value); setResult(null); }}><option value="">A new contributor</option>{(archive.contributors || []).map(contributor => <option key={contributor.id} value={contributor.id}>{contributor.name} — reconnect their contributions</option>)}</select></label>{!person && <label className="field">Their name<input required maxLength={120} value={name} onChange={event => setName(event.target.value)} /></label>}<p className="hint">For someone returning on another device, choose their existing contributor record. Names alone are not used to merge people.</p>{error && <p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy ? 'Creating…' : 'Create invitation link'}</button>
  </form>{result && <div className="invitation-result" role="status"><h2>Ready for {result.name}</h2><p>Expires {new Date(result.expires_at).toLocaleDateString()}. Copy this private link now; it is not stored in readable form.</p><label className="field">Personal invitation link<input readOnly value={location.origin + result.path} onFocus={event => event.target.select()} /></label><button className="outlined" onClick={async () => { try { await navigator.clipboard.writeText(location.origin + result.path); setCopied(true); } catch { setError('Select the link above and copy it manually.'); } }}>{copied ? 'Copied' : 'Copy invitation link'}</button><p className="hint">The link grants access to this person’s contribution history. Share it only with them.</p></div>}
    <h2>Recent invitations</h2>{(archive.invitations || []).slice().reverse().map(invitation => <div className="invitation-row" key={invitation.id}><strong>{invitation.name}</strong><span>{invitation.redeemed_at ? 'Used' : Date.parse(invitation.expires_at) < Date.now() ? 'Expired' : 'Awaiting use'}</span></div>)}
  </section>;
}
