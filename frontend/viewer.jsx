import { useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

export function PhotoViewer({ links, onPageChange, ref }) {
  const dialog = useRef(null);
  const viewport = useRef(null);
  const image = useRef(null);
  const closeButton = useRef(null);
  const opening = useRef(null);
  const drag = useRef(null);
  const [index, setIndex] = useState(-1);
  const [zoom, setZoom] = useState(1);
  const [fittedWidth, setFittedWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const photo = links[index];
  const page = photo?.closest('.log-page');
  const label = page?.querySelector('h2').textContent;

  function load(next, resetZoom = false) {
    if (next < 0 || next >= links.length || next === index && !resetZoom) return;
    drag.current = null;
    setDragging(false);
    setFittedWidth(0);
    if (resetZoom) setZoom(1);
    viewport.current.scrollTo(0, 0);
    setIndex(next);
  }

  useImperativeHandle(ref, () => ({
    open(next, source) {
      if (!links[next] || dialog.current.open || !dialog.current.showModal) return;
      opening.current = { index: next, source, x: window.scrollX, y: window.scrollY };
      document.body.classList.add('viewer-open');
      dialog.current.showModal();
      closeButton.current.focus();
      if (next !== index) load(next, true);
      else if (image.current?.naturalWidth) photoLoaded();
    },
    close() { dialog.current.close(); },
    isOpen() { return dialog.current.open; },
    index() { return index; },
  }));

  function fitWidth() {
    const img = image.current;
    const pane = viewport.current;
    return Math.max(1, Math.min(img.naturalWidth, pane.clientWidth - 32,
      (pane.clientHeight - 32) * img.naturalWidth / img.naturalHeight));
  }

  function photoLoaded() {
    if (!dialog.current.open) return;
    flushSync(() => setFittedWidth(fitWidth()));
    const pane = viewport.current;
    pane.scrollTo(Math.max(0, (image.current.width - pane.clientWidth) / 2), 0);
  }

  function magnify(value, width = fittedWidth) {
    const img = image.current;
    if (!img?.naturalWidth || !width) return;
    const pane = viewport.current;
    const x = (pane.scrollLeft + pane.clientWidth / 2 - img.offsetLeft) / img.width;
    const y = (pane.scrollTop + pane.clientHeight / 2 - img.offsetTop) / img.height;
    const nextZoom = Math.max(1, Math.min(4, value));
    flushSync(() => {
      setFittedWidth(width);
      setZoom(nextZoom);
    });
    if (nextZoom === 1) pane.scrollTo(0, 0);
    else pane.scrollTo(x * img.width - pane.clientWidth / 2, y * img.height - pane.clientHeight / 2);
  }

  function fit() {
    if (image.current?.naturalWidth) magnify(1, fitWidth());
  }

  useLayoutEffect(() => {
    function resize() { if (dialog.current.open) fit(); }
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  function close() {
    document.body.classList.remove('viewer-open');
    drag.current = null;
    setDragging(false);
    const previous = opening.current;
    if (!previous) return;
    (previous.source || photo)?.focus({ preventScroll: true });
    if (index !== previous.index) onPageChange(page);
    else window.scrollTo(previous.x, previous.y);
  }

  function handleKey(event) {
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    switch (event.key) {
      case 'ArrowLeft': event.preventDefault(); load(index - 1); break;
      case 'ArrowRight': event.preventDefault(); load(index + 1); break;
      case '+':
      case '=': event.preventDefault(); magnify(zoom + 0.5); break;
      case '-': event.preventDefault(); magnify(zoom - 0.5); break;
    }
  }

  function startDrag(event) {
    if (zoom <= 1 || event.pointerType !== 'mouse' || event.button !== 0) return;
    event.preventDefault();
    const pane = event.currentTarget;
    drag.current = { x: event.clientX, y: event.clientY, left: pane.scrollLeft, top: pane.scrollTop };
    pane.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function moveDrag(event) {
    if (!drag.current) return;
    const { x, y, left, top } = drag.current;
    event.currentTarget.scrollTo(left + x - event.clientX, top + y - event.clientY);
  }

  function stopDrag() {
    drag.current = null;
    setDragging(false);
  }

  return (
    <dialog id="photo-viewer" aria-labelledby="viewer-title" ref={dialog} onClose={close} onKeyDown={handleKey}>
      <div className="viewer-toolbar">
        <h2 id="viewer-title">{label || 'Original photograph'}</h2>
        <div className="viewer-controls" role="group" aria-label="Photo zoom">
          <button type="button" id="zoom-out" aria-label="Zoom out" disabled={!fittedWidth || zoom === 1} onClick={() => magnify(zoom - 0.5)}>−</button>
          <output id="zoom-level" aria-live="polite">{Math.round(zoom * 100)}%</output>
          <button type="button" id="zoom-in" aria-label="Zoom in" disabled={!fittedWidth || zoom === 4} onClick={() => magnify(zoom + 0.5)}>＋</button>
          <button type="button" id="zoom-fit" disabled={!fittedWidth} onClick={fit}>Fit</button>
        </div>
        <button type="button" id="viewer-close" aria-label="Close photo viewer" ref={closeButton} onClick={() => dialog.current.close()}>Close ×</button>
      </div>
      <nav className="viewer-page-navigation" aria-label="Browse book pages">
        <button type="button" id="viewer-previous" aria-label="Previous page" disabled={index <= 0} onClick={() => load(index - 1)}>← Previous</button>
        <output id="viewer-position" aria-live="polite">{photo && `${index + 1} of ${links.length}`}</output>
        <button type="button" id="viewer-next" aria-label="Next page" disabled={index >= links.length - 1} onClick={() => load(index + 1)}>Next →</button>
      </nav>
      <p className="viewer-hint">← → turn pages. Drag or scroll to pan. Space or Escape closes the photo.</p>
      <div id="viewer-viewport" tabIndex={0} aria-label="Enlarged photograph; scroll to move around, left and right arrows change pages"
        ref={viewport} className={dragging ? 'dragging' : zoom > 1 ? 'zoomed' : undefined}
        onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag}
        onPointerCancel={stopDrag} onLostPointerCapture={stopDrag}>
        {photo && <img key={index} id="viewer-image" ref={image} alt={'Enlarged original photograph: ' + label}
          src={photo.href} style={fittedWidth ? { width: fittedWidth * zoom } : undefined}
          onLoad={photoLoaded} onDragStart={event => event.preventDefault()} />}
      </div>
    </dialog>
  );
}
