import {dateOverrideError,latestDateCorrection} from '../scripts/entry-dates.js';
import {absorbedSourcePassages,buildJournalModel} from '../scripts/journal-model.js';
import {validateArtifact,renderArtifact} from '../scripts/artifacts.js';
import {readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {writeExploreIndex} from '../scripts/explore-index.js';
import {renderEntryContext} from '../scripts/render-context.js';
export function localEditor({correctionsFile=resolve('content/corrections.json'),artifactsFile=resolve('content/artifacts.json'),directory=resolve('dist')}={}){
 const read=()=>JSON.parse(readFileSync(correctionsFile,'utf8'));
 const readArtifacts=()=>existsSync(artifactsFile)?JSON.parse(readFileSync(artifactsFile,'utf8')):{version:1,items:[]};
 return async(req,res,path)=>{
  if(!path.startsWith('/__local/'))return false;
  const reply=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
  if(!/^127\.0\.0\.1:\d+$/.test(req.headers.host||'')){reply(403,{error:'Local access only'});return true;}
  if(req.method==='GET'&&['/__local/editor.js','/__local/editor.css'].includes(path)){
   res.writeHead(200,{'Content-Type':path.endsWith('.js')?'text/javascript':'text/css','Cache-Control':'no-store'});res.end(readFileSync(path.endsWith('.js') ? 'node_modules/.cache/seahawk/editor.js' : 'local/editor.css'));return true;
  }
  if(!['/__local/entries','/__local/artifacts'].includes(path)){reply(404,{error:'Not found'});return true;}
  if(req.method==='GET'){reply(200,path==='/__local/artifacts'?readArtifacts():read());return true;}
  if(req.method!=='POST'){reply(405,{error:'Method not allowed'});return true;}
  if(req.headers.origin!==`http://${req.headers.host}`||req.headers['content-type']!=='application/json'){reply(403,{error:'Save from the local editor only'});return true;}
  try{
   let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>100000){reply(413,{error:'Content too long'});return true;}}
   let input;try{input=JSON.parse(body);}catch{reply(400,{error:'Invalid save data.'});return true;}
   const context=JSON.parse(readFileSync('content/entry-context.json'));
   if(existsSync('content/weekly-context.json'))context.weekly=JSON.parse(readFileSync('content/weekly-context.json'));
   const source=readFileSync('web/index.html','utf8'),grouping=JSON.parse(readFileSync('content/entry-groups.json'));
   const model=buildJournalModel(source,context,grouping),corrections=read(),artifacts=readArtifacts();
   let record,file,saved,response;
   if(path==='/__local/artifacts'){
    const existing=input.id?artifacts.items.find(item=>item.id===input.id):null;
    if(input.id&&!existing){reply(404,{error:'Artifact not found.'});return true;}
    if(existing&&existing.page!==input.page){reply(400,{error:'An artifact stays with its source page.'});return true;}
    const placement=existing?.sourceDimensions?{...(existing.entryId&&{entryId:existing.entryId}),sourceDimensions:existing.sourceDimensions,sourceFile:existing.sourceFile}:{};
    const error=validateArtifact({...input,entryId:placement.entryId,sourceDimensions:placement.sourceDimensions,sourceFile:placement.sourceFile},model.pages);if(error){reply(400,{error});return true;}
    if((existing?.updated_at||null)!==(input.revision||null)){reply(409,{error:'This artifact changed in another tab. Reload before editing.'});return true;}
    const now=new Date().toISOString();
    record={...placement,id:existing?.id||'A-'+randomUUID(),page:input.page,type:input.type,title:input.title.trim(),caption:input.caption,crop:input.crop,created_at:existing?.created_at||now,updated_at:now};
    if(existing)artifacts.items[artifacts.items.indexOf(existing)]=record;else artifacts.items.push(record);
    file=artifactsFile;saved=artifacts;response={artifact:record,html:renderArtifact(record,model.pages.get(record.page))};
   }else{
    if(!model.passages.has(input.id)){reply(400,{error:'Unknown passage.'});return true;}
    if(absorbedSourcePassages(model,grouping,corrections).has(input.id)){reply(409,{error:'This text belongs to a complete entry. Copy any unsaved text before reloading.'});return true;}
    if(corrections[input.id]?.deleted){reply(409,{error:'This passage has already been deleted. Copy any unsaved text before reloading.'});return true;}
    if(input.action!=='delete'&&(typeof input.text!=='string'||!input.text.trim()||input.text.length>50000||typeof input.note!=='string'||input.note.length>10000)){reply(400,{error:'A known entry and nonempty text are required'});return true;}
    if((corrections[input.id]?.updated_at||null)!==(input.revision||null)){reply(409,{error:'This entry changed in another tab. Reload before editing.'});return true;}
    const group=model.groups.get(model.membership.get(input.id));
    if(input.action!=='delete'&&Object.hasOwn(input,'date_override')){
     const error=dateOverrideError(input.date_override);if(error){reply(400,{error});return true;}
     if((latestDateCorrection(group,corrections)?.date_updated_at||null)!==(input.date_revision||null)){reply(409,{error:'This entry’s date changed in another tab. Copy your text before reloading.'});return true;}
    }
    const now=new Date(Math.max(Date.now(),Date.parse(latestDateCorrection(group,corrections)?.date_updated_at||'1970-01-01')+1)).toISOString();
    record=input.action==='delete'?{deleted:true,updated_at:now,...(corrections[input.id]?.date_override?{date_override:corrections[input.id].date_override,date_updated_at:corrections[input.id].date_updated_at}:{})}:{...corrections[input.id],text:input.text,note:input.note,updated_at:now,...(Object.hasOwn(input,'date_override')?{date_override:{date:input.date_override.date,end_date:input.date_override.end_date},date_updated_at:now}:{})};corrections[input.id]=record;file=correctionsFile;saved=corrections;response=record;
   }
   const searchEntries=[];
   const html=renderEntryContext(source,context,corrections,grouping,artifacts,searchEntries);
   writeFileSync(file+'.tmp',JSON.stringify(saved,null,2)+'\n');renameSync(file+'.tmp',file);
   writeFileSync(resolve(directory,'index.html'),html);
   writeExploreIndex(directory,searchEntries);reply(200,response);
  }catch{reply(500,{error:'Could not save. Your unsaved text is still in the editor.'});}
  return true;
 };
}
