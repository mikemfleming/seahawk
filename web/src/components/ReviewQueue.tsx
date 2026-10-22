import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api';
import { type Contribution, type ContributionStatus, type Entry, type Page } from '../types';
import { ContributionContent, contributionLabels } from './FamilyContributions';

function ReviewCard({ item, entry, onReviewed, onApply, onScan }: { item: Contribution; entry?: Entry; onReviewed: (item: Contribution) => void; onApply: (item: Contribution) => void; onScan: (url: string) => void }) {
  const [note, setNote] = useState(item.review_note || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function review(status: ContributionStatus) {
    setBusy(true); setError('');
    try { onReviewed(await api<Contribution>(`/api/contributions/${item.id}/review`, { status, note, revision: item.review_history?.length || 0 })); }
    catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
  }
  const applied = entry?.source_contribution_ids?.includes(item.id);
  return <article className="review-card"><div className="review-card-heading"><div><p className="eyebrow">{contributionLabels[item.kind]}</p><h3>From {item.author}</h3><p className="subline">{new Date(item.created_at).toLocaleString()}</p></div><span className={`badge ${item.status}`}>{item.status === 'declined' ? 'Kept private' : item.status === 'approved' ? 'Approved' : 'Awaiting review'}</span></div>
    <ContributionContent item={item} onScan={onScan} />
    {item.photo && <p className="hint">Permission recorded for family archive sharing. Credit: {item.photo.credit}.</p>}
    {item.kind === 'identification' && item.status === 'approved' && <div className="suggestion-preview"><p>{applied ? 'This suggestion is linked to a saved entry revision.' : 'Keep the family’s recollection alongside the log, or use it in the entry’s interpreted people and notes.'}</p><button className="outlined" disabled={applied} onClick={() => onApply(item)}>{applied ? 'Already used in entry' : 'Update entry using this suggestion ↗'}</button></div>}
    <label className="field">Private review note<textarea rows={2} maxLength={4000} value={note} onChange={event => setNote(event.target.value)} disabled={busy} placeholder="What did you check? Is there a follow-up to make?" /></label>
    <p className="hint">Approval shares this recollection when the entry is visible to family. Updating the entry is a separate, traceable decision.</p>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="review-actions"><button className="primary" disabled={busy} onClick={() => review('approved')}>{item.status === 'approved' ? 'Save review & keep shared' : 'Approve and next →'}</button><button className="outlined" disabled={busy} onClick={() => review('declined')}>Keep private and next</button>{item.status !== 'pending' && <button className="quiet" disabled={busy} onClick={() => review('pending')}>Return to pending</button>}</div>
    {!!item.review_history?.length && <details className="review-history"><summary>{item.review_history.length} review decisions</summary>{item.review_history.map((review, i) => <p className="hint" key={i}>{new Date(review.reviewed_at).toLocaleString()} · {review.previous_status} → {review.status}{review.previous_note && ` · Earlier note: ${review.previous_note}`}</p>)}</details>}
  </article>;
}
export function ReviewQueue({ contributions, entries, pages, onReviewed, onRefresh, onApply, onScan }: { contributions: Contribution[]; entries: Entry[]; pages: Page[]; onReviewed: (item: Contribution) => void; onRefresh: () => Promise<void>; onApply: (item: Contribution) => void; onScan: (url: string) => void }) {
  const [filter, setFilter] = useState<ContributionStatus>('pending');
  const [selected, setSelected] = useState('');
  const [followup, setFollowup] = useState<Contribution | null>(null);
  const [error, setError] = useState('');
  const visible = contributions.filter(item => item.status === filter);
  const item = visible.find(item => item.id === selected) || visible[0];
  const entry = entries.find(entry => entry.id === item?.entry_id);
  const targetPhoto = contributions.find(other => other.id === item?.target_contribution_id)?.photo;
  const sources = pages.filter(page => entry?.page_ids.includes(page.id));
  useEffect(() => setSelected(''), [filter]);
  return <section className="review-queue"><div className="section-heading"><div><p className="eyebrow">FAMILY CONTRIBUTIONS</p><h1>Review their additions.</h1></div><button className="outlined" onClick={async () => { setError(''); try { await onRefresh(); } catch (error) { setError(errorMessage(error)); } }}>Refresh queue</button></div>
    <p className="subline">Compare each recollection with its original context. Approval and changes to the log are separate decisions.</p>
    <div className="queue-tabs" role="group" aria-label="Contribution status">{(['pending', 'approved', 'declined'] as const).map(status => <button key={status} aria-pressed={filter === status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}>{status === 'pending' ? 'Awaiting review' : status === 'approved' ? 'Approved' : 'Kept private'} <span>{contributions.filter(item => item.status === status).length}</span></button>)}</div>
    {followup && <div className="review-followup" role="status"><p>Identification approved. Would you also like to use it in the entry?</p><button className="outlined" onClick={() => onApply(followup)}>Update entry using this suggestion ↗</button><button className="quiet" onClick={() => setFollowup(null)}>Keep it as a family recollection</button></div>}
    {error && <p className="error" role="alert">{error}</p>}
    {item ? <><div className="review-position"><span>{visible.findIndex(other => other.id === item.id) + 1} of {visible.length} in this queue</span><div>{visible.map((other, i) => <button key={other.id} className={other.id === item.id ? 'active' : ''} onClick={() => setSelected(other.id)} aria-label={`Review contribution ${i + 1} by ${other.author}`}>{i + 1}</button>)}</div></div><div className="contextual-review"><section className="review-source"><p className="eyebrow">THE ENTRY THEY’RE REMEMBERING</p><h2>{entry?.title || 'Archived entry'}</h2><p className="subline">{entry?.date_as_written} · {entry?.id}</p>{item.kind === 'identification' && <div className="identification-comparison"><span>In the log</span><p>{item.subject}</p><span>Suggested by {item.author}</span><p>{item.identified_name}</p></div>}<p className="source-excerpt">{entry?.transcription}</p>{targetPhoto && <figure><p className="section-label">THE PHOTOGRAPH THEY’RE IDENTIFYING</p><button className="source-button" onClick={() => onScan(targetPhoto.url)}><img src={targetPhoto.url} alt="Photograph referenced by this identification" /></button><figcaption className="hint">Photo credit: {targetPhoto.credit}</figcaption></figure>}<details><summary>Open the original page</summary>{sources.map(page => <button key={page.id} className="source-button" onClick={() => onScan(page.image)} aria-label="Enlarge original page"><img src={page.image} alt={page.label} /></button>)}</details></section><ReviewCard key={`${item.id}-${item.review_history?.length || 0}`} item={item} entry={entry} onReviewed={result => { if (result.kind === 'identification' && result.status === 'approved') setFollowup(result); onReviewed(result); }} onApply={onApply} onScan={onScan} /></div></>
      : <div className="empty"><h2>{filter === 'pending' ? 'All caught up.' : 'Nothing here yet.'}</h2><p>{filter === 'pending' ? 'New memories, names, and photographs will arrive here for your review.' : 'Contributions you review will appear in this collection.'}</p></div>}
  </section>;
}
