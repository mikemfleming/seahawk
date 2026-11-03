import { enhanceGallery } from './gallery-markup.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const intake = resolve(process.argv[2] || 'data/intake/seahawk');
const archiveFile = resolve(process.argv[3] || join(intake, 'gallery-archive-snapshot.json'));
const manifest = JSON.parse(readFileSync(join(intake, 'manifest.json')));
const archive = JSON.parse(readFileSync(archiveFile));
const items = [...manifest.items].sort((a,b)=>a.order-b.order);
if (items.length !== manifest.count || new Set(items.map(item=>item.order)).size !== items.length || new Set(items.map(item=>item.sha256)).size !== items.length) throw Error('The export manifest contains missing or duplicate photos.');
for (const item of items) if (createHash('sha256').update(readFileSync(join(intake,item.file))).digest('hex') !== item.sha256) throw Error(`Original changed: ${item.file}`);
mkdirSync('web/photos', { recursive: true });
const sizes = JSON.parse(execFileSync(process.env.GALLERY_PYTHON || 'python3', ['scripts/prepare-photos.py', intake, resolve('web/photos')], { maxBuffer: 1024*1024, encoding:'utf8' }));
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function confirmedText(entry) {
  const corrections = [...(entry.reading_corrections || [])].filter(item=>entry.transcription.includes(item.as_written)).sort((a,b)=>b.as_written.length-a.as_written.length);
  if (!corrections.length) return entry.transcription;
  const pattern = new RegExp(corrections.map(item=>item.as_written.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
  return entry.transcription.replace(pattern, match=>corrections.find(item=>item.as_written===match).corrected);
}
const displayedItems = items.filter(item => item.order < 5 || item.order > 10);
const sections = displayedItems.map((item,index)=>{
  const draft=JSON.parse(readFileSync(join(intake,'drafts',`${basename(item.file)}.json`)));
  if(draft.source_sha256!==item.sha256)throw Error('Transcription does not match its photograph.');
  const page=archive.pages.find(page=>page.sha256===item.sha256);
  const entries=page?archive.entries.filter(entry=>entry.page_ids.includes(page.id)):[];
  let transcription=page?.transcription || draft.transcription || '';
  // Keep the full page, including printed text, while carrying forward confirmed
  // passage corrections. Never use the AI reading rewrite as the transcription.
  if(entries.length===draft.entries.length){
    for(const [i,entry] of entries.entries()){
      const source=draft.entries[i];
      if(transcription.includes(source.transcription))transcription=transcription.replace(source.transcription,confirmedText(entry));
      if(source.date_as_written&&entry.date_as_written&&source.date_as_written!==entry.date_as_written)transcription=transcription.replace(source.date_as_written,entry.date_as_written);
    }
  }
  const stem=String(item.order).padStart(3,'0');
  const size=sizes.find(size=>size.order===item.order);
  return `    <section class="log-page" id="page-${stem}" aria-labelledby="title-${stem}" data-source="${escape(basename(item.file))}" data-sha256="${item.sha256}">
      <h2 id="title-${stem}">Page ${item.order}</h2>
      <a class="photograph" href="photos/${stem}-full.jpg" target="_blank" rel="noopener" aria-label="Open page ${item.order} photograph at full size">
        <img src="photos/${stem}-large.jpg" srcset="photos/${stem}-small.jpg ${size.small.width}w, photos/${stem}-large.jpg ${size.large.width}w, photos/${stem}-full.jpg ${size.full.width}w" sizes="(max-width: 900px) calc(100vw - 32px), 868px" width="${size.large.width}" height="${size.large.height}" alt="Photograph of logbook page ${item.order}" loading="${index===0?'eager':'lazy'}" decoding="async"${index===0?' fetchpriority="high"':''}>
      </a>
      <div class="transcription" aria-label="Transcription of page ${item.order}">${escape(transcription.split('\n').map(line=>line.trimEnd()).join('\n').trim()) || '<p class="blank-page">No written text on this page.</p>'}</div>
    </section>`;
});
const html=`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self'; style-src 'self'; script-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
  <meta name="description" content="Captain Eddie’s Seahawk logbook, photographed in page order with transcriptions beneath each original.">
  <meta name="theme-color" content="#f5f2e9">
  <title>Seahawk — The Ship’s Log</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <div class="journal-banner">
      <svg class="banner-art" viewBox="410 775 840 245" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Original green barracuda drawing from Captain Eddie’s journal"><image href="art/fish-drawing-page-34.jpg" width="1800" height="1200"/></svg>
      <div class="banner-title">
        <p class="eyebrow">CAPTAIN EDDIE’S FISH TALES</p>
        <h1>The Seahawk.</h1>
        <p class="hawaiian-name" lang="haw">Nakia</p>
      </div>
    </div>
    <div class="opening-story">
    <p class="introduction">Ten years on the water.</p>
    <p class="journey">Port Aransas, Texas → Kona, Hawaiʻi · 1994–2004</p>
    <p class="note">Select a photo to enlarge it. Transcriptions are a first pass; brackets mark uncertain readings.</p>
    </div>
  </header>
  <main>
${sections.join('\n\n')}
  </main>
  <footer>Seahawk · Nakia · Captain Eddie / Ahi Ed</footer>
</body>
</html>
`;
writeFileSync('web/index.html',enhanceGallery(html));
console.log(`Prepared ${displayedItems.length} displayed photos and transcriptions (${items.length} originals preserved). Originals and confirmed corrections preserved.`);
