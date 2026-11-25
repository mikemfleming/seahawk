import { useLayoutEffect, useRef } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { mountControl } from './mount.jsx';
import { connectReadingScans } from './reading-scans.js';
import { SearchForm } from './search-form.jsx';
import { PhotoViewer } from './viewer.jsx';
import { connectGallery, connectPageLinks, navigateTo, revealViewerPage } from './gallery-dom.js';

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

const searchSlot = document.getElementById('log-search-root');
if (searchSlot) hydrateRoot(searchSlot, <SearchForm />);

function JournalReader({ links }) {
  const viewer = useRef(null);

  useLayoutEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const scans = connectReadingScans(links, signal);
    connectPageLinks(signal);
    connectGallery({
      open: (...args) => viewer.current.open(...args),
      close: () => viewer.current.close(),
      isOpen: () => viewer.current.isOpen(),
      index: () => viewer.current.index(),
    }, links, scans, signal);
    return () => controller.abort();
  }, [links]);

  return <PhotoViewer ref={viewer} links={links} onPageChange={revealViewerPage} />;
}

mountControl(document.getElementById('photo-viewer-root'),
  <JournalReader links={[...document.querySelectorAll('.photograph')]} />);
