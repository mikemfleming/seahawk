import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { appendSlot } from '../frontend/mount.jsx';

function pointInImage(event) {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
    y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
  };
}

function ArtifactEditor({ page, record, onClose, onSave }) {
  const dialog = useRef(null);
  const start = useRef(null);
  const [crop, setCrop] = useState(record?.crop ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const number = Number(page.id.slice(5));
  useLayoutEffect(() => { dialog.current.showModal(); }, []);

  function beginCrop(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    start.current = pointInImage(event);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveCrop(event) {
    if (!start.current) return;
    const { x, y } = start.current;
    const end = pointInImage(event);
    setCrop({
      x: Math.min(x, end.x), y: Math.min(y, end.y),
      width: Math.abs(end.x - x), height: Math.abs(end.y - y),
    });
  }

  function finishCrop() {
    start.current = null;
    setCrop(current => current && (current.width < .005 || current.height < .005) ? null : current);
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/__local/artifacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: record?.id, page: number, type: fields.get('type'), title: fields.get('title'),
          caption: fields.get('caption'), crop, revision: record?.updated_at || null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      onSave(result);
      dialog.current.close();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  const selectionStyle = crop && {
    left: crop.x * 100 + '%', top: crop.y * 100 + '%',
    width: crop.width * 100 + '%', height: crop.height * 100 + '%',
  };
  return (
    <dialog className="entry-editor artifact-editor" aria-labelledby="artifact-editor-title" ref={dialog}
      onClose={onClose} onCancel={event => { if (busy) event.preventDefault(); }}>
      <form onSubmit={submit}>
        <h2 id="artifact-editor-title">{record ? 'Edit artifact' : 'Add artifact'}</h2>
        <p className="artifact-page-label">Page {number}</p>
        <p>Drag across the photograph to select an illustration or detail. Leave it unselected to use the whole page.</p>
        <div className="crop-stage" onPointerDown={beginCrop} onPointerMove={moveCrop}
          onPointerUp={finishCrop} onPointerCancel={finishCrop}>
          <img alt="Original journal page" draggable={false} src={page.querySelector('.photograph img').src} />
          <div className="crop-selection" hidden={!crop} style={selectionStyle || undefined} />
        </div>
        <button type="button" className="reset-crop" onClick={() => setCrop(null)}>Use whole page</button>
        <label>Type
          <select name="type" defaultValue={record?.type ?? 'illustration'}>
            <option value="illustration">Illustration</option>
            <option value="map">Map or diagram</option>
            <option value="clipping">Clipping</option>
            <option value="photograph">Photograph</option>
            <option value="specimen">Preserved object</option>
            <option value="other">Artifact</option>
          </select>
        </label>
        <label>Title<input name="title" required maxLength={240} defaultValue={record?.title ?? ''} /></label>
        <label>Caption (optional)<textarea name="caption" rows={3} maxLength={10000} defaultValue={record?.caption ?? ''} /></label>
        <p>Saved locally. Publish separately to update the public site.</p>
        <p role="status">{error}</p>
        <div>
          <button type="button" className="cancel" disabled={busy} onClick={() => dialog.current.close()}>Cancel</button>
          <button type="submit" disabled={busy}>Save artifact</button>
        </div>
      </form>
    </dialog>
  );
}

function PageArtifactControls({ page, container, records, slot }) {
  const [figures, setFigures] = useState(() => [...container.querySelectorAll('.page-artifact')]);
  const [editing, setEditing] = useState(null);
  const returnFocus = useRef(null);
  const addButton = useRef(null);

  function open(button, figure) {
    returnFocus.current = button;
    setEditing({ record: figure ? records.get(figure.dataset.artifactId) : null });
  }

  function save({ artifact, html }) {
    records.set(artifact.id, artifact);
    const figure = new DOMParser().parseFromString(html, 'text/html').body.firstElementChild;
    const old = figures.find(item => item.dataset.artifactId === artifact.id);
    if (old) old.replaceWith(figure);
    else container.insertBefore(figure, slot);
    setFigures(current => old ? current.map(item => item === old ? figure : item) : [...current, figure]);
    returnFocus.current = figure;
  }

  function close() {
    setEditing(null);
    const node = returnFocus.current;
    const button = node.matches('button') ? node : node.querySelector('.edit-artifact');
    (button ?? addButton.current).focus({ preventScroll: true });
  }

  return (
    <>
      <button type="button" className="add-artifact" ref={addButton} onClick={event => open(event.currentTarget, null)}>
        Add artifact to page {Number(page.id.slice(5))}
      </button>
      {figures.map(figure => createPortal(
        <button type="button" className="edit-artifact" onClick={event => open(event.currentTarget, figure)}>Edit artifact</button>,
        figure.querySelector('figcaption'), figure.dataset.artifactId,
      ))}
      {editing && createPortal(
        <ArtifactEditor page={page} record={editing.record} onSave={save} onClose={close} />, document.body,
      )}
    </>
  );
}

export async function prepareArtifactControls() {
  const response = await fetch('/__local/artifacts');
  if (!response.ok) throw Error('Could not load saved artifacts.');
  const store = await response.json();
  const records = new Map(store.items.map(record => [record.id, record]));
  return [...document.querySelectorAll('.log-page')].map(page => {
    let container = page.querySelector('.page-artifacts');
    if (!container) {
      container = document.createElement('div');
      container.className = 'page-artifacts';
      page.append(container);
    }
    const slot = appendSlot(container);
    return createPortal(<PageArtifactControls page={page} container={container} records={records} slot={slot} />, slot, page.id);
  });
}
