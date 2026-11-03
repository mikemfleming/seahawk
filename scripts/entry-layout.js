// Build a searchable plain-text view while keeping offsets into the escaped HTML.
// Matching ignores punctuation/spacing, but never rewrites the displayed text.
export function searchableHTML(html) {
 const characters=[],offsets=[];
 const entities={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"};
 for(let i=0;i<html.length;){
  if(html[i]==='<'){const end=html.indexOf('>',i);if(end<0)break;i=end+1;continue;}
  const entity=html[i]==='&'?/^&(?:amp|lt|gt|quot|#39);/.exec(html.slice(i)):null;
  const value=entity?entities[entity[0]]:html[i];
  for(const char of value.toLowerCase())if(/[a-z0-9]/.test(char)){characters.push(char);offsets.push(i);}
  i+=entity?entity[0].length:1;
 }
 return {text:characters.join(''),offsets};
}
export function entryBoundaries(html,entries) {
 const view=searchableHTML(html);let from=0;
 return entries.map(entry=>{
  const needle=searchableHTML(entry.layout_anchor||'').text;
  if(needle.length<12)throw Error('Missing entry anchor: '+entry.id);
  const index=view.text.indexOf(needle,from);
  if(index<0)throw Error('Entry text not found: '+entry.id);
  from=index+needle.length;
  let start=index;
  const label=searchableHTML(entry.label==='Undated passage'?'':entry.label).text;
  if(label){const before=view.text.slice(Math.max(0,index-120),index);const heading=before.lastIndexOf(label);if(heading>=0)start=Math.max(0,index-120)+heading;}
  return {id:entry.id,start:view.offsets[start]};
 });
}
// Close and reopen paragraph markup if an entry starts midway through a paragraph.
export function splitTranscription(html,boundaries) {
 const pieces=[];let previous=0;
 for(const boundary of boundaries){
  let start=boundary.start;
  const open=html.lastIndexOf('<p',start),close=html.lastIndexOf('</p>',start);
  const openingEnd=open>=0?html.indexOf('>',open)+1:0;
  if(open>close&&html.slice(openingEnd,start).trim()==='')start=open;
  pieces.push({html:html.slice(previous,start),id:pieces.length?boundaries[pieces.length-1].id:null});previous=start;
 }
 pieces.push({html:html.slice(previous),id:boundaries.at(-1)?.id});
 // Each fragment is now independently valid paragraph HTML.
 for(const piece of pieces){
  if(!piece.html.trim())continue;
  if(!piece.html.trimStart().startsWith('<p'))piece.html='<p class="passage">'+piece.html;
  const opens=(piece.html.match(/<p\b/g)||[]).length,closes=(piece.html.match(/<\/p>/g)||[]).length;
  if(opens>closes)piece.html+='</p>';
 }
 return pieces;
}
