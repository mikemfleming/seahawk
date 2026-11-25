import { createRef } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { mountControl } from './mount.jsx';
import { connectReadingScans } from './reading-scans.js';
import { PhotoViewer } from './viewer.jsx';
import { connectGallery, navigateTo, revealViewerPage } from '../web/gallery.js';

function JumpSelect({ select }) {
  return (
    <select id={select.id} onChange={event => navigateTo(event.target.value)}>
      {[...select.options].map(option => (
        <option key={option.value} value={option.value} data-year={option.dataset.year}>
          {option.textContent}
        </option>
      ))}
    </select>
  );
}

for (const select of document.querySelectorAll('.jump-control > select')) {
  hydrateRoot(select.parentElement, <JumpSelect select={select} />);
}

const links = [...document.querySelectorAll('.photograph')];
const scans = connectReadingScans(links);
const viewer = createRef();
mountControl(document.getElementById('photo-viewer-root'),
  <PhotoViewer ref={viewer} links={links} onPageChange={revealViewerPage} />);
connectGallery({
  open: (...args) => viewer.current.open(...args),
  close: () => viewer.current.close(),
  isOpen: () => viewer.current.isOpen(),
  index: () => viewer.current.index(),
}, links, scans);
