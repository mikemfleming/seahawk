export function formatEscapedTranscription(text) {
  if (text.includes('<article class="log-entry')) return text;
  if (text.startsWith('<p class="passage">') || text.startsWith('<p class="blank-page">')) return text;
  return text.trim().split(/\n[\t ]*\n+/).map(paragraph => `<p class="passage">${paragraph.replace(/\[(?:[^\]\n]*\?|illegible)\]/gi, '<mark class="uncertain">$&</mark>')}</p>`).join('\n');
}
export function enhanceGallery(html) {
  const pages = [...html.matchAll(/<section class="log-page" id="page-(\d+)"/g)].map(match => match[1]);
  html = html.replace("script-src 'none'", "script-src 'self'").replace('<body>', '<body id="top">');
  html = html.replace(/(<div class="transcription"[^>]*>)([\s\S]*?)(<\/div>)/g, (_, open, text, close) => open + formatEscapedTranscription(text) + close);
  if (!html.includes('id="page-jump"')) html = html.replace('  <main>', `  <nav class="page-tools" aria-label="Page navigation">
    <label for="page-jump">Jump to page</label>
    <select id="page-jump"><option value="">Choose a page</option>${pages.map(page=>`<option value="page-${page}">Page ${Number(page)}</option>`).join('')}</select>
    <span class="page-total">${pages.length} photographs</span>
  </nav>
  <main>`);
  if (!html.includes('id="photo-viewer"')) html = html.replace('</body>', `  <a class="back-to-top" href="#top" aria-label="Back to top">↑ Top</a>
  <dialog id="photo-viewer" aria-labelledby="viewer-title">
    <div class="viewer-toolbar">
      <h2 id="viewer-title">Original photograph</h2>
      <div class="viewer-controls" role="group" aria-label="Photo zoom">
        <button type="button" id="zoom-out" aria-label="Zoom out">−</button>
        <output id="zoom-level" aria-live="polite">100%</output>
        <button type="button" id="zoom-in" aria-label="Zoom in">＋</button>
        <button type="button" id="zoom-fit">Fit</button>
      </div>
      <button type="button" id="viewer-close" aria-label="Close photo viewer" autofocus>Close ×</button>
    </div>
    <p class="viewer-hint">Zoom for a closer look. Drag or scroll to move around. Escape closes the photo.</p>
    <div id="viewer-viewport" tabindex="0" aria-label="Enlarged photograph; use arrow keys or scroll to move around"><img id="viewer-image" alt=""></div>
  </dialog>
  <script src="gallery.js" defer></script>
</body>`);
  if (!html.includes('id="viewer-previous"')) html = html.replace(/    <p class="viewer-hint">[\s\S]*?<\/p>/, `    <nav class="viewer-page-navigation" aria-label="Browse book pages">
      <button type="button" id="viewer-previous" aria-label="Previous page">← Previous</button>
      <output id="viewer-position" aria-live="polite"></output>
      <button type="button" id="viewer-next" aria-label="Next page">Next →</button>
    </nav>
    <p class="viewer-hint">← → change pages. Drag or scroll to pan. Escape closes the photo.</p>`);
  html = html.replace('Enlarged photograph; use arrow keys or scroll to move around', 'Enlarged photograph; scroll to move around, left and right arrows change pages');
  html = html.replace(/<p class="viewer-hint">[\s\S]*?<\/p>/, '<p class="viewer-hint">← → turn pages. Drag or scroll to pan. Space or Escape closes the photo.</p>');
  html = html.replace('Select a photo to enlarge it.', 'Select a photo or press Space to enlarge the page in view.');
  html = html.replace("photographs, in page order, with their transcriptions below.", "photographs, in page order, with their transcriptions alongside or below.");
  html = html.replace(/<p class="passage">\s*The Ship[’\']s Log(?:™)?(?:\s*\(\d+\))?\s*<\/p>\s*/gi, '');
  return html;
}
