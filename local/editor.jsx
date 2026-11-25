import { createPortal } from 'react-dom';
import { useLayoutEffect, useRef, useState } from 'react';
import { appendSlot, mountControl } from '../frontend/mount.jsx';
import { formatEntryUpdated } from '../web/entry-updated.js';
import { renderUncertainty, uncertaintySegments } from './uncertainty.js';
import { prepareArtifactControls } from './artifacts.jsx';

async function saveEntry(input) {
  const response = await fetch('/__local/entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error);
  return result;
}

function updatePassage(article, result) {
  const text = article.querySelector('.entry-text');
  text.replaceChildren(...result.text.split(/\n\s*\n/).map(paragraph => {
    const node = document.createElement('p');
    node.className = 'passage';
    renderUncertainty(node, paragraph);
    return node;
  }));
  article.querySelector('.entry-clarification')?.remove();
  if (result.note.trim()) {
    const note = document.createElement('p');
    note.className = 'entry-clarification';
    const label = document.createElement('strong');
    label.textContent = 'Note:';
    note.append(label, ' ' + result.note);
    text.after(note);
  }
  const updated = [...document.querySelectorAll('.log-entry .entry-updated')].find(node =>
    node.closest('.log-entry').dataset.entryId === article.dataset.entryId);
  const time = document.createElement('time');
  time.dateTime = result.updated_at;
  time.textContent = formatEntryUpdated(result.updated_at);
  updated.replaceChildren(document.createTextNode('Last updated '), time);
}

function EntryEditor({ article, group, record, multiple, onSave, onClose }) {
  const dialog = useRef(null);
  const textarea = useRef(null);
  const highlightLayer = useRef(null);
  const highlights = useRef(null);
  const keepPassage = useRef(null);
  const [text, setText] = useState(record?.text ?? article.querySelector('.entry-text').innerText);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function syncHighlights() {
    const field = textarea.current;
    highlightLayer.current.style.width = field.clientWidth + 'px';
    highlights.current.style.transform = `translate(${-field.scrollLeft}px,${-field.scrollTop}px)`;
  }

  useLayoutEffect(() => {
    dialog.current.showModal();
    syncHighlights();
    window.addEventListener('resize', syncHighlights);
    return () => window.removeEventListener('resize', syncHighlights);
  }, []);
  useLayoutEffect(syncHighlights, [text]);
  useLayoutEffect(() => { if (confirming) keepPassage.current.focus(); }, [confirming]);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const date = fields.get('entryDate');
    const endDate = fields.get('endDate');
    const changed = date !== group.dataset.entryDate || endDate !== group.dataset.entryEndDate;
    const dateFields = changed ? {
      date_override: { date: date || null, end_date: endDate || null },
      date_revision: group.dataset.dateRevision || null,
    } : {};
    setBusy(true);
    setError('');
    try {
      const result = await saveEntry({
        ...dateFields, id: article.dataset.passageId, text, note: fields.get('note'),
        revision: record?.updated_at || null,
      });
      if (changed) {
        history.replaceState(null, '', '#context-' + article.dataset.passageId);
        location.reload();
        return;
      }
      onSave(result);
      dialog.current.close();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function deletePassage() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await saveEntry({ id: article.dataset.passageId, action: 'delete', revision: record?.updated_at || null });
      history.replaceState(null, '', '#page-' + article.dataset.sourcePage.padStart(3, '0'));
      location.reload();
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }

  return (
    <dialog className="entry-editor" aria-labelledby="entry-editor-title" ref={dialog}
      onClose={onClose} onCancel={event => { if (busy) event.preventDefault(); }}>
      <form onSubmit={submit}>
        <h2 id="entry-editor-title">{multiple ? 'Edit passage' : 'Edit journal entry'}</h2>
        <p className="edit-context">
          Page {article.dataset.sourcePage} · Part of {group.dataset.entryTitle}
          {multiple && ' · Source pages ' + group.dataset.sourcePages.replaceAll(',', ', ')}
        </p>
        <p>Saved to this project. Publish separately to update the public site.</p>
        <div className="entry-date-fields">
          <label>Entry date<input type="date" name="entryDate" defaultValue={group.dataset.entryDate} /></label>
          <label>End date (optional)<input type="date" name="endDate" defaultValue={group.dataset.entryEndDate} /></label>
        </div>
        <p>Correcting the date updates the heading and its historical context. Leave it blank if the date is unknown. Missing historical data will be marked unavailable.</p>
        <label>Transcription
          <div className="transcription-input">
            <div className="transcription-highlights" aria-hidden="true" ref={highlightLayer}>
              <div ref={highlights}>
                {uncertaintySegments(text + '\n').map((segment, index) =>
                  segment.uncertain ? <mark className="uncertain" key={index}>{segment.text}</mark> : segment.text)}
              </div>
            </div>
            <textarea name="text" required spellCheck={false} ref={textarea} value={text}
              onChange={event => setText(event.target.value)} onScroll={syncHighlights} />
          </div>
        </label>
        <p className="highlight-help">Yellow marks uncertain or incomplete readings.</p>
        <label>Note (optional)<textarea name="note" rows={3} defaultValue={record?.note ?? ''} /></label>
        <p role="status">{error}</p>
        {confirming ? (
          <div className="delete-confirmation">
            <p>Delete this passage and its note? The original photograph stays. This cannot be undone in the editor.</p>
            <button type="button" className="confirm-delete" disabled={busy} onClick={deletePassage}>Delete passage</button>
            <button type="button" className="keep-passage" ref={keepPassage} disabled={busy} onClick={() => setConfirming(false)}>Keep passage</button>
          </div>
        ) : (
          <button type="button" className="delete-passage" disabled={busy} onClick={() => setConfirming(true)}>Delete passage…</button>
        )}
        <div>
          <button type="button" className="cancel" disabled={busy} onClick={() => dialog.current.close()}>Cancel</button>
          <button type="submit" disabled={busy}>Save correction</button>
        </div>
      </form>
    </dialog>
  );
}

function EditPassage({ article, record, onSave }) {
  const [editing, setEditing] = useState(false);
  const trigger = useRef(null);
  const group = article.closest('.log-entry');
  const multiple = Number(group.dataset.passageCount) > 1;
  const id = article.dataset.passageId;
  return (
    <>
      <button type="button" className="edit-entry" ref={trigger} onClick={() => setEditing(true)}>
        {multiple ? 'Edit passage' : 'Edit entry'}
      </button>
      {editing && createPortal(<EntryEditor article={article} group={group} record={record} multiple={multiple}
        onSave={result => { updatePassage(article, result); onSave(id, result); }}
        onClose={() => { setEditing(false); trigger.current.focus({ preventScroll: true }); }} />, document.body)}
    </>
  );
}

function LatestEntryJump() {
  const [message, setMessage] = useState('');

  function jump() {
    let latest = null;
    let latestDate = -Infinity;
    for (const time of document.querySelectorAll('.log-entry .entry-updated time[datetime]')) {
      const date = Date.parse(time.dateTime);
      if (date > latestDate) {
        latest = document.getElementById('context-' + time.closest('.log-entry').dataset.entryId);
        latestDate = date;
      }
    }
    if (!latest) {
      setMessage('No entries have been updated yet.');
      return;
    }
    setMessage('');
    history.replaceState(null, '', '#' + latest.id);
    // Reuse the reader's anchor navigation even when this entry is already in the URL.
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    const heading = latest.querySelector('h3, h4');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }

  return (
    <>
      <button type="button" className="latest-entry-jump" onClick={jump}>Last updated entry</button>
      {message && <span className="local-mode" role="status">{message}</span>}
    </>
  );
}

function CorrectionProgress({ passages, records }) {
  const pending = new Map();
  for (const { article } of passages) {
    const { entryId, passageId } = article.dataset;
    pending.set(entryId, pending.get(entryId) || !records[passageId]?.text?.trim());
  }
  useLayoutEffect(() => {
    for (const [id, incomplete] of pending) {
      const badge = document.getElementById('context-' + id)?.querySelector('.entry-corrected');
      if (badge) badge.hidden = incomplete;
    }
  });

  const total = pending.size;
  const remaining = [...pending.values()].filter(Boolean).length;
  return (
    <div className="correction-progress">
      <progress aria-label="Entries corrected" value={total - remaining} max={total || 1} />
      <span role="status">{remaining} of {total} entries left to correct</span>
    </div>
  );
}

function LocalEditor({ initialRecords, passages, artifactControls }) {
  const [records, setRecords] = useState(initialRecords);

  function saveCorrection(id, result) {
    setRecords(current => ({ ...current, [id]: result }));
  }

  return (
    <>
      <span className="local-mode">Local editing</span>
      <LatestEntryJump />
      <CorrectionProgress passages={passages} records={records} />
      {passages.map(({ article, slot }) => createPortal(
        <EditPassage article={article} record={records[article.dataset.passageId]} onSave={saveCorrection} />,
        slot, article.dataset.passageId,
      ))}
      {artifactControls}
    </>
  );
}

const toolbarSlot = appendSlot(document.querySelector('.page-tools'));
try {
  const edits = fetch('/__local/entries').then(response => {
    if (!response.ok) throw Error('Could not load saved corrections.');
    return response.json();
  });
  const [records, artifactControls] = await Promise.all([edits, prepareArtifactControls()]);
  document.body.classList.add('local-editing');
  for (const paragraph of document.querySelectorAll('.entry-text .passage')) {
    renderUncertainty(paragraph, paragraph.textContent);
  }
  const passages = [...document.querySelectorAll('.entry-passage')].map(article => ({
    article, slot: appendSlot(article),
  }));
  mountControl(toolbarSlot, <LocalEditor initialRecords={records} passages={passages} artifactControls={artifactControls} />);
} catch (error) {
  mountControl(toolbarSlot, <span className="local-mode" role="status">{error.message}</span>);
} finally {
  document.documentElement.dataset.editorReady = 'true';
  document.dispatchEvent(new Event('journal-editor-ready'));
}
