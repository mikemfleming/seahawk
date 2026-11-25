export function scanTop(stickyTop, start, nextStart, height, gap) {
  return Math.min(Math.max(stickyTop, start), nextStart - height - gap);
}

// The page-order HTML remains the fallback and the source for the photo viewer.
export function connectReadingScans(links, signal) {
  const desktop = matchMedia('screen and (min-width: 1100px)');
  const photos = new Map(links.map((link, index) => [
    Number(link.closest('.log-page').id.slice(5)), { link, index, page: link.closest('.log-page') },
  ]));
  const entries = [...document.querySelectorAll('.log-entry[id][data-reading-pages]')].flatMap(article => {
    const scans = article.dataset.readingPages.split(',').map(number => photos.get(Number(number)));
    if (scans.length < 2 || scans.some(scan => !scan)) return [];
    const fragments = scans.slice(1).flatMap(({ page }) =>
      [...page.querySelectorAll('.log-entry')].filter(node => node.dataset.entryId === article.dataset.entryId));
    return [{ article, scans, fragments }];
  });

  // Consecutive entries can share a page. Give each connected run one photo rail.
  const groups = [];
  for (const entry of entries) {
    const last = groups.at(-1);
    if (last?.scans.at(-1) === entry.scans[0]) {
      last.scans.push(...entry.scans.slice(1));
      last.entries.push(entry);
    } else {
      groups.push({ scans: [...entry.scans], entries: [entry] });
    }
  }

  const runs = [];
  const observer = new ResizeObserver(measure);
  let frame = 0;

  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  function measure() {
    for (const run of runs) {
      const bounds = run.wrapper.getBoundingClientRect();
      if (!bounds.height) continue;
      run.readingLine = Number.parseFloat(getComputedStyle(run.stage).top);
      run.slideHeight = run.stage.clientHeight;
      run.scanGap = Number.parseFloat(getComputedStyle(run.wrapper).marginBottom);
      run.stops = run.transitions.map(({ entry, fraction }) => {
        const text = [...entry.article.querySelectorAll('.entry-text')].map(node => node.getBoundingClientRect());
        const height = text.reduce((sum, rect) => sum + rect.height, 0);
        let offset = height * fraction;
        for (const rect of text) {
          if (offset <= rect.height) return rect.top + offset - bounds.top;
          offset -= rect.height;
        }
        return text.at(-1).bottom - bounds.top;
      });
    }
    for (const run of runs) {
      run.stops.forEach((stop, index) => {
        run.transitions[index].anchor.style.top = stop + 'px';
      });
    }
    schedule();
  }

  function update() {
    frame = 0;
    for (const run of runs) {
      const bounds = run.wrapper.getBoundingClientRect();
      if (!bounds.height || bounds.bottom < 0 || bounds.top > innerHeight) continue;
      const { stops } = run;
      const readingOffset = run.readingLine - bounds.top;

      const stageTop = run.stage.getBoundingClientRect().top;
      // Each scan enters in document coordinates and sticks at the same line
      // as a single-page scan. The following scan pushes it out from below.
      run.copies.forEach((copy, index) => {
        const start = (stops[index - 1] ?? -Infinity) + bounds.top;
        const next = (stops[index] ?? Infinity) + bounds.top;
        const top = scanTop(stageTop, start, next, run.slideHeight, run.scanGap);
        copy.style.transform = `translateY(${top - stageTop}px)`;
      });
      const active = stops.filter(stop => stop <= readingOffset + 1).length;
      if (active === run.active) continue;
      run.active = active;
      run.copies.forEach((copy, index) => { copy.inert = index !== run.active; });
    }
  }

  function enable() {
    if (runs.length) return;
    for (const group of groups) {
      const { scans } = group;
      const wrapper = document.createElement('div');
      wrapper.className = 'scan-run';
      const stage = document.createElement('div');
      stage.className = 'scan-stage';
      const firstImage = scans[0].link.querySelector('img');
      stage.style.aspectRatio = `${firstImage.getAttribute('width')} / ${firstImage.getAttribute('height')}`;
      const copies = scans.map(({ link, index }) => {
        const copy = link.cloneNode(true);
        copy.inert = index !== scans[0].index;
        copy.dataset.galleryIndex = index;
        stage.append(copy);
        return copy;
      });
      const reading = document.createElement('div');
      reading.className = 'scan-reading';
      wrapper.append(stage, reading);
      scans[0].page.before(wrapper);
      for (const { page } of scans) reading.append(page);

      const moves = [];
      const transitions = [];
      for (const entry of group.entries) {
        entry.article.classList.add('continuous-entry');
        let lastPassage = [...entry.article.querySelectorAll(':scope > .entry-passage')].at(-1);
        for (const fragment of entry.fragments) {
          for (const node of [...fragment.children].filter(child => !child.matches('.continuation-reference'))) {
            const placeholder = document.createComment('Original passage position');
            node.before(placeholder);
            if (node.matches('.entry-passage')) {
              lastPassage.after(node);
              lastPassage = node;
            } else {
              entry.article.append(node);
            }
            moves.push({ node, placeholder });
          }
          fragment.hidden = true;
        }
        for (const [index, { page }] of entry.scans.slice(1).entries()) {
          const anchor = document.createElement('span');
          anchor.className = 'scan-page-anchor';
          anchor.id = page.id + '-reading';
          page.dataset.readingAnchor = anchor.id;
          wrapper.append(anchor);
          transitions.push({ entry, fraction: (index + 1) / entry.scans.length, anchor });
        }
        for (const text of entry.article.querySelectorAll('.entry-text')) observer.observe(text);
      }
      runs.push({ ...group, wrapper, stage, copies, moves, transitions, active: 0, stops: [] });
      observer.observe(wrapper);
      observer.observe(stage);
    }
    measure();
  }

  function disable() {
    observer.disconnect();
    for (const run of runs.splice(0)) {
      for (const { node, placeholder } of run.moves) placeholder.replaceWith(node);
      for (const { article, fragments } of run.entries) {
        article.classList.remove('continuous-entry');
        for (const fragment of fragments) fragment.hidden = false;
      }
      for (const { page } of run.scans) {
        delete page.dataset.readingAnchor;
        run.wrapper.before(page);
      }
      run.wrapper.remove();
    }
  }

  function setLayout() {
    if (desktop.matches) enable();
    else disable();
  }

  setLayout();
  desktop.addEventListener('change', setLayout, { signal });
  window.addEventListener('beforeprint', disable, { signal });
  window.addEventListener('afterprint', setLayout, { signal });
  window.addEventListener('scroll', schedule, { passive: true, signal });
  window.addEventListener('resize', measure, { signal });
  signal.addEventListener('abort', () => {
    cancelAnimationFrame(frame);
    disable();
  }, { once: true });

  return {
    pageAt(line) {
      const run = runs.find(({ wrapper }) => {
        const { top, bottom } = wrapper.getBoundingClientRect();
        return top <= line && line <= bottom;
      });
      return run?.scans[run.active].index ?? -1;
    },
  };
}
