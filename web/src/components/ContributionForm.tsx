import { dateLabel } from '../types';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, errorMessage, fileDataUrl } from '../api';
import { type ContributionKind, type ContributionRequest, type Entry, type Contributor } from '../types';
import { Modal } from './Modal';

const titles: Record<ContributionKind, string> = { memory: 'Share a memory', clarification: 'Clarify a detail', identification: 'Identify someone', photo: 'Share a memory' };
export function ContributionForm({ entry, request, onClose, contributor, onSubmitted, onViewMine }: { entry: Entry; request: ContributionRequest; onClose: () => void; contributor?: Contributor | null; onSubmitted: () => Promise<void>; onViewMine: () => void }) {
  const memoryForm = request.kind === 'memory' || request.kind === 'photo';
  const [author, setAuthor] = useState(contributor?.name || '');
  const [text, setText] = useState('');
  const [subject, setSubject] = useState(request.subject || '');
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const kind: ContributionKind = memoryForm ? (file ? 'photo' : 'memory') : request.kind;
  const textLabel = kind === 'clarification' ? 'Your clarification' : memoryForm ? 'Your memory or photo caption' : 'How do you know? (optional)';
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');
  const [credit, setCredit] = useState('');
  const [permission, setPermission] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function choose(file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) {
      setError('Please choose a JPEG, PNG or WebP photo under 12 MB. Export HEIC photos as JPEG first.'); return;
    }
    setFile(file); setPermission(false); setError('');
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (kind === 'photo' && !file) { setError('Choose a photograph first.'); return; }
    setBusy(true);
    try {
      const result = await api<{ id: string; status: 'pending' }>('/api/contributions', {
        entry_id: entry.id, kind, author, text, subject, identified_name: name, context: request.prompt || '', target_contribution_id: request.target_contribution_id,
        ...(kind === 'photo' && file ? { image: await fileDataUrl(file), original_name: file.name, credit: credit || author, permission } : {}),
      });
      setReceipt(result.id);
      await onSubmitted().catch(() => undefined);
    } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
  }
  return <Modal id="contribution-dialog" titleId="contribution-title" onClose={onClose} busy={busy}>
    <div className="dialog-heading"><div><p className="eyebrow">CONTRIBUTE TO THIS ENTRY</p><h2 id="contribution-title">{receipt ? 'Submitted for review' : titles[kind]}</h2></div><button className="close" onClick={onClose} disabled={busy} aria-label="Close">×</button></div>
    {receipt ? <div className="submission-success" role="status"><span className="success-mark">✓</span><p><strong>{author}, your contribution is saved.</strong></p><p>The archivist will review it before it appears on “{entry.title}.”</p><p className="hint">You can return to this submission from “Your contributions” whenever you sign in to your crew account.</p><p className="hint">Reference: {receipt}</p><button className="outlined wide" onClick={onViewMine}>View your contributions</button><button className="primary wide" onClick={onClose}>Back to the entry</button></div> : <form onSubmit={submit}>
      <p className="contribution-context">For <strong>{entry.title}</strong> · {dateLabel(entry)}</p>
      {request.prompt && <p className="contribution-prompt">{request.prompt}</p>}<fieldset disabled={busy}>
        <label className="field">Your name<input value={author} onChange={event => setAuthor(event.target.value)} autoComplete="name" readOnly={contributor?.invited} required maxLength={120} placeholder="How should we credit you?" /></label>
        {kind === 'identification' && <><label className="field">Who are you identifying?<input value={subject} onChange={event => setSubject(event.target.value)} required maxLength={500} placeholder="e.g. The name written as [Patricia?]" /></label><label className="field">Suggested name<input value={name} onChange={event => setName(event.target.value)} required maxLength={200} placeholder="Their full name or familiar nickname" /></label></>}

        <label className="field">{textLabel}<textarea aria-label={textLabel} value={text} onChange={event => setText(event.target.value)} required={kind !== 'identification'} maxLength={12000} rows={5} placeholder={kind === 'clarification' ? 'What can you clarify, and how do you know?' : memoryForm ? 'Add a comment about this entry, or describe your photo.' : 'Share the detail that helped you recognize them.'} /></label>
        {memoryForm && <><label className="drop" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!busy) choose(event.dataTransfer.files[0]); }}><span>↥</span><strong>{file ? file.name : 'Attach a photo (optional)'}</strong><small>JPEG, PNG or WebP · up to 12 MB</small><input ref={fileInput} type="file" aria-label="Attach a photo" accept="image/jpeg,image/png,image/webp" onChange={event => choose(event.target.files?.[0])} /></label>{preview && <img className="contribution-upload-preview" src={preview} alt="Family photo selected for sharing" />}{file && <button type="button" className="quiet" onClick={() => { setFile(null); setPermission(false); setError(''); if (fileInput.current) fileInput.current.value = ''; }}>Remove photo</button>}{file && <label className="field">Photo credit<input value={credit} onChange={event => setCredit(event.target.value)} maxLength={200} placeholder="Photographer or collection owner; defaults to your name" /></label>}</>}
        {kind === 'photo' && <label className="check"><input type="checkbox" required checked={permission} onChange={event => setPermission(event.target.checked)} /> I have permission to share this photo in the family archive.</label>}
        <p className="hint">Your name will appear with your approved contribution. Submissions are reviewed before sharing with the family. An approved crew account is required.</p>
        {error && <p className="error" role="alert">{error}</p>}<button className="primary wide">{busy ? 'Saving your contribution…' : 'Send to the archivist'}</button>
      </fieldset>
    </form>}
  </Modal>;
}
