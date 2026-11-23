import {entryBoundaries,splitTranscription,searchableHTML} from './entry-layout.js';
// Original passage IDs remain the correction keys. Groups are explicit, reviewed
// relationships; missing dates alone never imply a continuation.
export function buildJournalModel(html,data,config={groups:[]}){
 const pages=new Map(),passages=new Map(),groups=new Map(),membership=new Map();
 for(const match of html.matchAll(/<section class="log-page" id="page-(\d+)"[\s\S]*?<\/section>/g)){
  const order=Number(match[1]),body=match[0].match(/<div class="transcription"([^>]*)>([\s\S]*?)<\/div>/);
  if(!body)throw Error('Missing page transcription: '+order);
  const entries=data.pages[order]?.entries||[];
  const pieces=entries.length?splitTranscription(body[2],entryBoundaries(body[2],entries)):[{id:null,html:body[2]}];
  const page={order,section:match[0],attrs:body[1],body:body[2],pieces,entries};pages.set(order,page);
  for(const piece of pieces)if(piece.id){
   if(passages.has(piece.id))throw Error('Duplicate passage ID: '+piece.id);
   passages.set(piece.id,{id:piece.id,page:order,html:piece.html,entry:entries.find(entry=>entry.id===piece.id)});
  }
 }
 for(const definition of config.groups||[]){
  const ids=definition.passages.map(item=>{
   if(typeof item==='string')return item;
   if(passages.has(item.id))throw Error('Duplicate synthetic passage ID: '+item.id);
   const page=pages.get(item.page);if(!page)throw Error('Missing continuation page: '+item.page);
   if(!['prefix','body','passage-prefix'].includes(item.source))throw Error('Unknown continuation source');
   if(item.source==='body'&&page.entries.length)throw Error('Whole-page continuation overlaps existing passages');
   let piece;
   if(item.source==='passage-prefix'){
    const original=passages.get(item.passage);if(!original||original.page!==item.page)throw Error('Missing passage to split');
    const view=searchableHTML(original.html),needle=searchableHTML(item.before).text,index=view.text.indexOf(needle);
    if(index<=0||view.text.indexOf(needle,index+1)>=0)throw Error('Ambiguous passage split');
    const [prefix,rest]=splitTranscription(original.html,[{id:original.id,start:view.offsets[index]}]);
    const position=page.pieces.findIndex(piece=>piece.id===original.id);
    piece={id:item.id,html:prefix.html};page.pieces.splice(position,0,piece);page.pieces[position+1].html=rest.html;original.html=rest.html;
   }else{
    piece=page.pieces.find(piece=>!piece.id);if(!piece?.html.trim())throw Error('Empty continuation: '+item.id);piece.id=item.id;
   }
   passages.set(item.id,{id:item.id,page:item.page,html:piece.html,entry:null});return item.id;
  });
  if(ids[0]!==definition.id)throw Error('Entry ID must be its first preserved passage ID');
  for(const id of ids){if(!passages.has(id))throw Error('Unknown passage: '+id);if(membership.has(id))throw Error('Passage assigned twice: '+id);membership.set(id,definition.id);}
  const sourcePages=ids.map(id=>passages.get(id).page);
  if(sourcePages.some((page,index)=>index&&page<sourcePages[index-1]))throw Error('Passages must follow source page order');
  groups.set(definition.id,{id:definition.id,passageIds:ids,entry:passages.get(ids[0]).entry,pages:[...new Set(sourcePages)]});
 }
 for(const passage of passages.values())if(!membership.has(passage.id)){
  membership.set(passage.id,passage.id);groups.set(passage.id,{id:passage.id,passageIds:[passage.id],entry:passage.entry,pages:[passage.page]});
 }
 return {pages,passages,groups,membership};
}
