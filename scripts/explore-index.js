import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Match the React search form so the home page can hydrate it.
const searchForm = [
  '<form role="search" action="search/" method="get">',
  '<label for="log-query">Search the logbook</label>',
  '<div class="search-fields">',
  '<input type="search" id="log-query" name="q" placeholder="Try yellowfin or July 1998" value="">',
  '<button type="submit">Search</button>',
  '</div></form>',
].join('');

const entities = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };

export function plainTranscription(html) {
  return html.replace(/<\/(?:p|li)>|<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name) => entities[name]);
}

export function addLogSearch(html) {
  return html.replace("form-action 'none'", "form-action 'self'")
    .replace('  <nav class="page-tools"', `  <div class="log-search">
    <div id="log-search-root">${searchForm}</div>
    <a href="explore/">Browse the logbook index</a>
  </div>
  <nav class="page-tools"`);
}

export function writeExploreIndex(directory, entries) {
  writeFileSync(resolve(directory, 'explore-data.js'), `export default ${JSON.stringify(entries)};\n`);
}
