export function formatEscapedTranscription(text) {
  if (!text.trim()) return text;
  if (text.includes('<article class="log-entry') || text.includes('class="continuation-reference"')) return text;
  if (text.startsWith('<p class="passage">') || text.startsWith('<p class="blank-page">')) return text;
  return text.trim().split(/\n[\t ]*\n+/).map(paragraph => `<p class="passage">${paragraph.replace(/\[(?:[^\]\n]*\?|illegible)\]/gi, '<mark class="uncertain">$&</mark>')}</p>`).join('\n');
}
export function enhanceGallery(html) {
  const pages = [...html.matchAll(/<section class="log-page" id="page-(\d+)"/g)].map(match => match[1]);
  html = html.replace("script-src 'none'", "script-src 'self'").replace('<body>', '<body id="top">');
  html = html.replace(/(<div class="transcription"[^>]*>)([\s\S]*?)(<\/div>)/g, (_, open, text, close) => open + formatEscapedTranscription(text) + close);
  if (!html.includes('id="page-jump"')) html = html.replace('  <main>', `  <nav class="page-tools" aria-label="Page navigation">
    <label for="page-jump">Jump to page</label>
    <span class="jump-control"><select id="page-jump"><option value="">Choose a page</option>${pages.map(page=>`<option value="page-${page}">Page ${Number(page)}</option>`).join('')}</select></span>
    <span class="page-total">${pages.length} photographs</span>
  </nav>
  <main>`);
  if (!html.includes('id="photo-viewer-root"')) html = html.replace('</body>', `  <a class="back-to-top" href="#top" aria-label="Back to top">↑ Top</a>
  <div id="photo-viewer-root"></div>
  <script src="gallery.js" type="module"></script>
</body>`);
  html = html.replace('Select a photo to enlarge it.', 'Select a photo or press Space to enlarge the page in view.');
  html = html.replace("photographs, in page order, with their transcriptions below.", "photographs, in page order, with their transcriptions alongside or below.");
  html = html.replace(/<p class="passage">\s*The Ship[’\']s Log(?:™)?(?:\s*\(\d+\))?\s*<\/p>\s*/gi, '');
  return html;
}
