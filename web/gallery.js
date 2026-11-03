// Optional enhancements only. Every photograph and transcription is in the HTML.
const jump = document.getElementById('page-jump');
const yearJump = document.getElementById('year-jump');
function syncJump() {
 const target=document.getElementById(location.hash.slice(1));
 const page=target?.closest('.log-page');
 jump.value=page?.id||'';
 if(yearJump)yearJump.value=[...yearJump.options].some(option=>option.value===target?.id)?target.id:'';
}
syncJump();
window.addEventListener('hashchange', syncJump);
function navigateTo(id) {
 const target=document.getElementById(id);if(!target)return;
 history.replaceState(null,'',`#${id}`);
 const heading=target.matches('.log-page')?target.querySelector('h2'):target.querySelector('h3,h4');
 if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
 target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
 syncJump();
}
jump.addEventListener('change',()=>navigateTo(jump.value));
yearJump?.addEventListener('change',()=>navigateTo(yearJump.value));
const dialog = document.getElementById('photo-viewer');
const image = document.getElementById('viewer-image');
const viewport = document.getElementById('viewer-viewport');
const zoomIn = document.getElementById('zoom-in');
const zoomOut = document.getElementById('zoom-out');
const zoomLevel = document.getElementById('zoom-level');
const links = [...document.querySelectorAll('.photograph')];
const previousPage = document.getElementById('viewer-previous');
const nextPage = document.getElementById('viewer-next');
const position = document.getElementById('viewer-position');
let activeIndex = -1;
let openedIndex = -1;
let zoom = 1;
let fittedWidth = 0;
let origin = null;
let savedScroll = { x: 0, y: 0 };
let drag = null;
function fitWidth() {
  return Math.min(image.naturalWidth, viewport.clientWidth - 32, (viewport.clientHeight - 32) * image.naturalWidth / image.naturalHeight);
}
function setZoom(value) {
  if (!image.naturalWidth || !fittedWidth) return;
  const x = (viewport.scrollLeft + viewport.clientWidth / 2 - image.offsetLeft) / image.width;
  const y = (viewport.scrollTop + viewport.clientHeight / 2 - image.offsetTop) / image.height;
  zoom = Math.max(1, Math.min(4, value));
  image.style.width = `${fittedWidth * zoom}px`;
  zoomLevel.value = `${Math.round(zoom * 100)}%`;
  zoomOut.disabled = zoom === 1;
  zoomIn.disabled = zoom === 4;
  viewport.classList.toggle('zoomed', zoom > 1);
  if (zoom === 1) viewport.scrollTo(0, 0);
  else viewport.scrollTo(x * image.width - viewport.clientWidth / 2, y * image.height - viewport.clientHeight / 2);
}
function fit() { fittedWidth = fitWidth(); setZoom(1); }
function loadPhoto(index, resetZoom = false) {
  if (index < 0 || index >= links.length) return;
  activeIndex = index;
  origin = links[index];
  const label = origin.closest('.log-page').querySelector('h2').textContent;
  document.getElementById('viewer-title').textContent = label;
  position.value = `${index + 1} of ${links.length}`;
  previousPage.disabled = index === 0;
  nextPage.disabled = index === links.length - 1;
  image.alt = `Enlarged original photograph: ${label}`;
  image.removeAttribute('src');
  image.style.width = '';
  fittedWidth = 0;
  drag = null;
  viewport.classList.remove('dragging');
  if (resetZoom) zoom = 1;
  zoomLevel.value = `${Math.round(zoom * 100)}%`;
  zoomIn.disabled = true;
  zoomOut.disabled = true;
  document.getElementById('zoom-fit').disabled = true;
  viewport.scrollTo(0, 0);
  image.src = origin.href;
}
image.addEventListener('load', () => {
  if (!dialog.open) return;
  fittedWidth = fitWidth();
  image.style.width = `${fittedWidth}px`;
  setZoom(zoom);
  // Each new page starts at its top, retaining the chosen magnification.
  viewport.scrollTo(Math.max(0, (image.width - viewport.clientWidth) / 2), 0);
  document.getElementById('zoom-fit').disabled = false;
});
function openPhoto(index) {
  if (index < 0 || !dialog.showModal) return;
  const resetZoom = index !== activeIndex;
  openedIndex = index;
  savedScroll = { x: window.scrollX, y: window.scrollY };
  document.body.classList.add('viewer-open');
  dialog.showModal();
  loadPhoto(index, resetZoom);
}
function pageInView() {
  const toolbarBottom = document.querySelector('.page-tools').getBoundingClientRect().bottom;
  const readingLine = Math.max(0, toolbarBottom) + 40;
  let selected = -1, distance = Infinity;
  for (const [index, link] of links.entries()) {
    const rect = link.closest('.log-page').getBoundingClientRect();
    const gap = readingLine < rect.top ? rect.top - readingLine : readingLine > rect.bottom ? readingLine - rect.bottom : 0;
    if (gap < distance) { distance = gap; selected = index; }
  }
  return selected;
}
document.addEventListener('keydown', event => {
  if ((event.code !== 'Space' && event.key !== ' ') || event.altKey || event.ctrlKey || event.metaKey) return;
  if (!dialog.open && event.target.closest?.('input, textarea, select, summary, button, a:not(.photograph), [contenteditable="true"]')) return;
  event.preventDefault();
  if (event.repeat) return;
  if (dialog.open) dialog.close();
  else openPhoto(pageInView());
});
for (const [index, link] of links.entries()) {
  link.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !dialog.showModal) return;
    event.preventDefault();
    openPhoto(index);
  });
}
previousPage.addEventListener('click', () => loadPhoto(activeIndex - 1));
nextPage.addEventListener('click', () => loadPhoto(activeIndex + 1));
document.getElementById('viewer-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  document.body.classList.remove('viewer-open');
  viewport.classList.remove('zoomed', 'dragging');
  drag = null;
  origin?.focus({ preventScroll: true });
  if (activeIndex !== openedIndex) {
    const page = origin.closest('.log-page');
    history.replaceState(null, '', `#${page.id}`);
    syncJump();
    page.scrollIntoView({ block: 'start', behavior: 'instant' });
  } else window.scrollTo(savedScroll.x, savedScroll.y);
});
zoomIn.addEventListener('click', () => setZoom(zoom + 0.5));
zoomOut.addEventListener('click', () => setZoom(zoom - 0.5));
document.getElementById('zoom-fit').addEventListener('click', fit);
dialog.addEventListener('keydown', event => {
  if (event.altKey || event.metaKey || event.ctrlKey) return;
  if (event.key === 'ArrowLeft') { event.preventDefault(); loadPhoto(activeIndex - 1); }
  if (event.key === 'ArrowRight') { event.preventDefault(); loadPhoto(activeIndex + 1); }
  if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(zoom + 0.5); }
  if (event.key === '-') { event.preventDefault(); setZoom(zoom - 0.5); }
});
viewport.addEventListener('pointerdown', event => {
  if (zoom <= 1 || event.pointerType !== 'mouse' || event.button !== 0) return;
  event.preventDefault();
  drag = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
  viewport.setPointerCapture(event.pointerId);
  viewport.classList.add('dragging');
});
viewport.addEventListener('pointermove', event => {
  if (!drag) return;
  viewport.scrollTo(drag.left + drag.x - event.clientX, drag.top + drag.y - event.clientY);
});
function stopDrag() { drag = null; viewport.classList.remove('dragging'); }
viewport.addEventListener('pointerup', stopDrag);
viewport.addEventListener('pointercancel', stopDrag);
image.addEventListener('dragstart', event => event.preventDefault());
window.addEventListener('resize', () => { if (dialog.open && image.naturalWidth) fit(); });

// Stored only in this browser; explicit page links always take precedence.
const readingKey='seahawk-reading-position-v1';
let readingReady=false;
function saveReadingPosition(){
 if(!readingReady)return;
 const index=dialog.open?activeIndex:pageInView();
 const page=links[index]?.closest('.log-page');if(!page)return;
 const offset=dialog.open?0:Math.max(0,-page.getBoundingClientRect().top+90);
 try{localStorage.setItem(readingKey,JSON.stringify({id:page.id,offset}));}catch{}
 if(!dialog.open){
  jump.value=page.id;
  const line=document.querySelector('.page-tools').getBoundingClientRect().bottom+40;
  const contexts=[...page.querySelectorAll('.dated-context')];
  const current=contexts.filter(item=>item.getBoundingClientRect().top<=line).at(-1)||contexts[0];
  const year=current?.dataset.year||(page.id==='page-011'?'1994':null);
  if(yearJump)yearJump.value=[...yearJump.options].find(option=>option.dataset.year===year)?.value||'';
 }
}
requestAnimationFrame(()=>requestAnimationFrame(()=>{
 if(!location.hash){
  try{
   const saved=JSON.parse(localStorage.getItem(readingKey)||'null');
   const page=saved&&document.getElementById(saved.id);
   if(page?.matches('.log-page')){
    const offset=Number.isFinite(saved.offset)?Math.min(Math.max(0,saved.offset),page.offsetHeight):0;
    window.scrollTo(0,window.scrollY+page.getBoundingClientRect().top-90+offset);
    jump.value=page.id;
   }
  }catch{}
 }
 readingReady=true;
 saveReadingPosition();
}));
let readingTimer;
window.addEventListener('scroll',()=>{clearTimeout(readingTimer);readingTimer=setTimeout(saveReadingPosition,200);},{passive:true});
window.addEventListener('pagehide',saveReadingPosition);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveReadingPosition();});
