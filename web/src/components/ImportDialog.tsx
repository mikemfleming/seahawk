import { useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage, fileDataUrl } from '../api';
import { type Config, type ImportResult } from '../types';
import { Modal } from './Modal';

export function ImportDialog({ config, onClose, onImported }: {
  config: Config; onClose: () => void; onImported: (result: ImportResult) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [name, setName] = useState('');
  const [automatic, setAutomatic] = useState(config.automatic_transcription);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function choose(selected?: File) {
    if (!selected) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || selected.size > 12 * 1024 * 1024) {
      setFile(null); setError('Choose a JPEG, PNG or WebP under 12 MB.'); return;
    }
    setFile(selected); setName(selected.name); setError('');
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) { setError('Choose a photo first.'); return; }
    setBusy(true); setError('');
    try {
      const result = await api<ImportResult>('/api/import', { image: await fileDataUrl(file), name: name || file.name, automatic });
      await onImported(result);
    } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
  }
  return <Modal id="import-dialog" titleId="import-title" onClose={onClose} busy={busy}>
    <form id="import-form" onSubmit={submit}><div className="dialog-heading"><div><p className="eyebrow">GROW THE ARCHIVE</p><h2 id="import-title">Another page, another story.</h2></div><button type="button" className="close" onClick={onClose} disabled={busy} aria-label="Close">×</button></div>
      <p>Upload a page photo. The original stays intact; each dated passage becomes its own editable entry.</p>
      <fieldset disabled={busy}>
        <label className={`drop ${dragging ? 'dragover' : ''}`} htmlFor="photo" onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); if (!busy) choose(event.dataTransfer.files[0]); }}>
          <span>↥</span><strong>Choose a photo or drop it here</strong><small>JPEG, PNG or WebP · up to 12 MB · one page at a time</small>
          <input id="photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => choose(event.target.files?.[0])} />
        </label>
        {preview && <img id="upload-preview" src={preview} alt="Selected log page" />}
        <label className="field">Page label<input value={name} onChange={event => setName(event.target.value)} maxLength={200} placeholder="e.g. Volume 1 · page 02" /></label>
        <label className="check"><input type="checkbox" checked={automatic} disabled={!config.automatic_transcription} onChange={event => setAutomatic(event.target.checked)} /> Automatically transcribe and parse entries</label>
        <p className="hint">{config.automatic_transcription ? `Automatic transcription available (${config.model}).` : 'Manual mode. Set OPENAI_API_KEY on the server to enable automatic transcription.'}</p>
        <p className="hint">Automatic transcription sends this image to OpenAI. Every result starts as a draft for you to check.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary wide">Save page to archive</button>
      </fieldset>
      <p role="status">{busy && (automatic ? 'Reading the handwriting… This can take a few minutes.' : 'Preserving the original…')}</p>
    </form>
  </Modal>;
}
