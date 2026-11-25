// Optional enhancements only. Every photograph and transcription is in the HTML.
const jump = document.getElementById('page-jump');
const yearJump = document.getElementById('year-jump');
function syncJump() {
 const target=hashTarget();
 const page=target?.closest('.log-page');
 jump.value=page?.id||'';
 if(yearJump)yearJump.value=[...yearJump.options].some(option=>option.value===target?.id)?target.id:'';
}
function revealTarget(target){
 for(let parent=target?.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
}
function hashTarget(){
 try{return document.getElementById(decodeURIComponent(location.hash.slice(1)));}catch{return null;}
}
function scrollAnchor(target){
 const page=target.hasAttribute?.('data-absorbed-passage')?target.closest('.log-page'):target;
 return (page.dataset?.readingAnchor&&document.getElementById(page.dataset.readingAnchor))||page;
}
function alignHash(){
 const target=hashTarget();if(!target)return;
 revealTarget(target);
 scrollAnchor(target).scrollIntoView({behavior:'instant',block:'start'});syncJump();
}
syncJump();
window.addEventListener('hashchange',()=>{alignHash();syncJump();});
// Local editing adds controls asynchronously. Position explicit links only once
// the initial layout is ready, rather than leaving the native jump behind.
let initialLinkPending=Boolean(location.hash);
let pageLoaded=document.readyState==='complete';
let editorReady=!document.querySelector('script[src="/__local/editor.js"]')||document.documentElement.dataset.editorReady==='true';
function settleInitialLink(){
 if(!initialLinkPending||!pageLoaded||!editorReady)return;
 requestAnimationFrame(()=>requestAnimationFrame(()=>{
  if(!initialLinkPending)return;
  alignHash();initialLinkPending=false;
 }));
}
window.addEventListener('load',()=>{pageLoaded=true;settleInitialLink();},{once:true});
document.addEventListener('journal-editor-ready',()=>{editorReady=true;settleInitialLink();},{once:true});
for(const event of ['wheel','touchstart','pointerdown','keydown'])window.addEventListener(event,()=>{initialLinkPending=false;},{once:true,passive:true});
settleInitialLink();
export function navigateTo(id) {
 const target=document.getElementById(id);if(!target)return;
 revealTarget(target);
 history.replaceState(null,'',`#${id}`);
 const heading=target.matches('.log-page')?target.querySelector('h2'):target.querySelector('h3,h4');
 if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
 scrollAnchor(target).scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
 syncJump();
}
export function connectGallery(viewer, links, scans) {
  function pageInView() {
    const toolbarBottom = document.querySelector('.page-tools').getBoundingClientRect().bottom;
    const readingLine = Math.max(0, toolbarBottom) + 40;
    const readingScan = scans.pageAt(readingLine);
    if (readingScan >= 0) return readingScan;
    let selected = -1, distance = Infinity;
    for (const [index, link] of links.entries()) {
      if(link.closest('details:not([open])')||!link.getClientRects().length)continue;
      const rect = link.closest('.log-page').getBoundingClientRect();
      const gap = readingLine < rect.top ? rect.top - readingLine : readingLine > rect.bottom ? readingLine - rect.bottom : 0;
      if (gap < distance) { distance = gap; selected = index; }
    }
    return selected;
  }
  document.addEventListener('keydown', event => {
    if ((event.code !== 'Space' && event.key !== ' ') || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!viewer.isOpen() && document.querySelector('dialog[open]')) return;
    if (!viewer.isOpen() && event.target.closest?.('input, textarea, select, summary, button, a:not(.photograph), [contenteditable="true"]')) return;
    event.preventDefault();
    if (event.repeat) return;
    if (viewer.isOpen()) viewer.close();
    else viewer.open(pageInView());
  });

  for (const [index, link] of links.entries()) {
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
          typeof globalThis.HTMLDialogElement?.prototype.showModal !== 'function') return;
      event.preventDefault();
      viewer.open(index);
    });
  }

  // Stored only in this browser; explicit page links always take precedence.
  const readingKey='seahawk-reading-position-v1';
  let readingReady=false;
  function saveReadingPosition(){
   if(!readingReady)return;
   const index=viewer.isOpen()?viewer.index():pageInView();
   const page=links[index]?.closest('.log-page');if(!page)return;
   const origin=page.closest('.scan-run')?.querySelector('.log-page')||page;
   const offset=viewer.isOpen()?0:Math.max(0,-origin.getBoundingClientRect().top+90);
   try{localStorage.setItem(readingKey,JSON.stringify({id:viewer.isOpen()?page.id:origin.id,offset}));}catch{}
   if(!viewer.isOpen()){
    jump.value=page.id;
    const line=document.querySelector('.page-tools').getBoundingClientRect().bottom+40;
    const contexts=[...(page.closest('.scan-run')||page).querySelectorAll('.dated-context:not([hidden])')];
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
      revealTarget(page);
      const offset=Number.isFinite(saved.offset)?Math.min(Math.max(0,saved.offset),(page.closest('.scan-run')||page).offsetHeight):0;
      window.scrollTo(0,window.scrollY+scrollAnchor(page).getBoundingClientRect().top-90+offset);
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

  document.addEventListener('click', event => {
    const scan = event.target.closest('a[data-gallery-index]');
    if (scan && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey &&
        typeof globalThis.HTMLDialogElement?.prototype.showModal === 'function') {
      event.preventDefault();
      viewer.open(Number(scan.dataset.galleryIndex), scan);
      return;
    }
    const button = event.target.closest('button.source-photo');
    if (!button) return;
    const pageId = 'page-' + button.dataset.sourcePage.padStart(3, '0');
    const index = links.findIndex(link => link.closest('.log-page').id === pageId);
    if (index >= 0) viewer.open(index, button);
  });
}

export function revealViewerPage(page) {
  history.replaceState(null, '', '#' + page.id);
  syncJump();
  revealTarget(page);
  scrollAnchor(page).scrollIntoView({ block: 'start', behavior: 'instant' });
}
