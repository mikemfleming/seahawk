import {readFileSync,writeFileSync} from 'node:fs';
import {searchableHTML,entryBoundaries} from './entry-layout.js';
const data=JSON.parse(readFileSync('content/entry-context.json'));
const archive=JSON.parse(readFileSync('data/intake/seahawk/gallery-archive-snapshot.json'));
const html=readFileSync('web/index.html','utf8');
for(const [order,page]of Object.entries(data.pages)){
 const section=html.match(new RegExp('<section class="log-page" id="page-'+order.padStart(3,'0')+'"[\\s\\S]*?</section>'))[0];
 const body=section.match(/<div class="transcription"[^>]*>([\s\S]*?)<\/div>/)[1];
 for(const entry of page.entries){
  const source=archive.entries.find(item=>item.id===entry.id);let text=source.transcription;
  for(const correction of [...(source.reading_corrections||[])].sort((a,b)=>b.as_written.length-a.as_written.length))text=text.split(correction.as_written).join(correction.corrected);
  entry.layout_anchor=searchableHTML(text).text.slice(0,65);
  if(entry.id==='E-46c2b0b713')entry.layout_anchor='seahawkwillbeloaningtokonathefirstpart';
  if(entry.id==='E-51a6d90868')entry.layout_anchor='beautifuldaycoollikeanorthwindnot1015';
  if(entry.id==='E-fb8b244815')entry.layout_anchor='tominobirdsnobitesnostrikes';
 }
 try{entryBoundaries(body,page.entries);}catch(error){console.log('Page '+order+': '+error.message);}
}
writeFileSync('content/entry-layout.json',JSON.stringify(Object.fromEntries(Object.values(data.pages).flatMap(page=>page.entries.map(entry=>[entry.id,entry.layout_anchor]))),null,2)+'\n');
writeFileSync('content/entry-context.json',JSON.stringify(data,null,2)+'\n');
