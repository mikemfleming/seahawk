import { useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import entries from './explore-data.js';

import { SearchForm } from './search-form.jsx';
import { collections } from './explore-topics.js';

const normalize = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const words = value => normalize(value).match(/[\p{L}\p{N}]+/gu) || [];
const searchable = value => ` ${words(value).join(' ')} `;
function browseHref(key, value) {
  return `../search/?${new URLSearchParams({ [key]: value })}`;
}

const catalog = collections.flatMap(section => section.topics);
const aliasKeys = new Map(catalog.map(item => [item, item.aliases.map(searchable)]));
const indexed = entries.map(entry => ({
  ...entry,
  body: searchable(entry.text),
  metadata: searchable([entry.title, entry.year, entry.date, entry.endDate].join(' ')),
}));

function matchesTopic(entry, item) {
  return item.entryIds.includes(entry.id) || aliasKeys.get(item).some(alias => entry.body.includes(alias));
}

function SearchResults({ query, topic, year }) {
  const selectedTopic = catalog.find(item => item.label === topic);
  const terms = words(query);
  const matches = indexed.filter(entry => {
    if (year && entry.year !== year) return false;
    if (topic && (!selectedTopic || !matchesTopic(entry, selectedTopic))) return false;
    if (topic || year) return true;
    return terms.length > 0 && terms.every(term => entry.body.includes(` ${term} `) || entry.metadata.includes(` ${term} `));
  });
  const heading = selectedTopic?.label || year || (query ? `Results for “${query}”` : 'Search results');
  const count = matches.length;
  return (
    <div id="explore-content">
      <div className="search-summary">
        <div>
          <h2>{heading}</h2>
          <p>{count ? `${count} ${count === 1 ? 'entry' : 'entries'}`
            : !query && !topic && !year ? 'Enter a name, date, or keyword.'
              : 'No entries found. Try a different name, date, or keyword.'}</p>
        </div>
        <a href="../explore/">Browse the index</a>
      </div>
      {count > 0 && (
        <ul className="explore-results">
          {matches.map(entry => (
            <li key={entry.id}>
              <small>{entry.pages.length === 1 ? 'Page' : 'Pages'} {entry.pages.join(', ')}</small>
              <h3><a href={`../#context-${encodeURIComponent(entry.id)}`}>{entry.title}</a></h3>
              <p>{excerptFor(entry.text, selectedTopic?.aliases || terms)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function excerptFor(text, phrases) {
  const tokens = [...text.matchAll(/[\p{L}\p{M}\p{N}]+/gu)];
  const lowerTokens = tokens.map(token => normalize(token[0]));
  let offset = 0;
  for (const phrase of phrases) {
    const phraseWords = words(phrase);
    const match = lowerTokens.findIndex((_, index) =>
      phraseWords.every((word, relative) => lowerTokens[index + relative] === word));
    if (match < 0) continue;
    offset = tokens[match].index;
    break;
  }
  const start = text.lastIndexOf(' ', Math.max(0, offset - 65)) + 1;
  const beyond = text.indexOf(' ', start + 200);
  const end = beyond < 0 ? text.length : beyond;
  return `${start ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

function indexSections() {
  const years = [...new Set(indexed.map(entry => entry.year))].filter(Boolean);
  return [...collections, { name: 'Years', topics: years.map(label => ({ label })) }].map(({ name, topics }) => {
    const isYear = name === 'Years';
    const items = [...topics].sort((a, b) => a.label.localeCompare(b.label)).flatMap(item => {
      const { label, aliases = [] } = item;
      const count = indexed.filter(entry => isYear ? entry.year === label : matchesTopic(entry, item)).length;
      return count ? [{
        label, count,
        href: browseHref(isYear ? 'year' : 'topic', label),
        text: searchable([label, ...aliases].join(' ')),
      }] : [];
    });
    return { name, id: name.toLowerCase().replace(/[^a-z]+/g, '-'), items };
  });
}

function BrowseIndex() {
  const [sections] = useState(indexSections);
  const [filter, setFilter] = useState('');
  const terms = words(filter);
  const visible = sections.map(section => ({
    ...section, items: section.items.filter(item => terms.every(term => item.text.includes(term))),
  })).filter(section => section.items.length);
  const count = visible.reduce((total, section) => total + section.items.length, 0);

  useLayoutEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, []);

  return (
    <>
      <div id="index-controls">
        <label htmlFor="index-filter">Filter index terms</label>
        <input type="search" id="index-filter" placeholder="Try a name, place, or lure"
          value={filter} onChange={event => setFilter(event.target.value)} />
        <p id="index-status" aria-live="polite">
          {count ? `${count} index ${count === 1 ? 'term' : 'terms'}` : 'No matching index terms.'}
        </p>
        <nav id="index-jump" className="index-jump" aria-label="Index categories">
          {visible.map(section => <a key={section.id} href={`#${section.id}`}>{section.name}</a>)}
        </nav>
        <p><a href="../#loose-clippings">Browse loose clippings</a></p>
      </div>
      <div id="explore-content">
        {visible.map(section => (
          <section className="explore-category" id={section.id} key={section.id}>
            <h2>{section.name}</h2>
            <ul>
              {section.items.map(item => <li key={item.label}><a href={item.href}>{item.label} ({item.count})</a></li>)}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

function ExplorePage({ params, searchPage }) {
  const query = params.get('q')?.trim() || '';
  const topic = params.get('topic');
  const year = params.get('year');
  const results = searchPage || params.has('q') || Boolean(topic || year);
  return (
    <>
      <header className="explore-header">
        <a href="../#top">← The Seahawk logbook</a>
        <h1>{searchPage ? 'Search the logbook' : 'Logbook index'}</h1>
        <SearchForm query={query} action="../search/" />
      </header>
      <main data-view={results ? 'search' : 'index'}>
        {results ? <SearchResults query={query} topic={topic} year={year} /> : <BrowseIndex />}
      </main>
    </>
  );
}

function LegacyRoute() {
  useLayoutEffect(() => {
    const destination = new URL(location.href);
    destination.pathname = destination.pathname.replace(/\.html$/, '/');
    location.replace(destination.href);
  }, []);
  return null;
}

const root = document.getElementById('explore-root');
const view = root.dataset.view;
createRoot(root).render(view === 'legacy'
  ? <LegacyRoute />
  : <ExplorePage params={new URLSearchParams(location.search)} searchPage={view === 'search'} />);
