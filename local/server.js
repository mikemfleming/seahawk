import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {resolve} from 'node:path';
import {renderEntryContext} from '../scripts/render-context.js';
export function localEditor({correctionsFile=resolve('content/corrections.json'),directory=resolve('dist')}={}){
 const read=()=>JSON.parse(readFileSync(correctionsFile,'utf8'));
 return async(req,res,path)=>{
  if(!path.startsWith('/__local/'))return false;
  const reply=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
  if(!/^127\.0\.0\.1:\d+$/.test(req.headers.host||'')){reply(403,{error:'Local access only'});return true;}
  if(req.method==='GET'&&['/__local/editor.js','/__local/editor.css'].includes(path)){
   res.writeHead(200,{'Content-Type':path.endsWith('.js')?'text/javascript':'text/css','Cache-Control':'no-store'});res.end(readFileSync(resolve('local',path.split('/').at(-1))));return true;
  }
  if(path!=='/__local/entries'){reply(404,{error:'Not found'});return true;}
  if(req.method==='GET'){reply(200,read());return true;}
  if(req.method!=='POST'){reply(405,{error:'Method not allowed'});return true;}
  if(req.headers.origin!==`http://${req.headers.host}`||req.headers['content-type']!=='application/json'){reply(403,{error:'Save from the local editor only'});return true;}
  try{
   let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>100000){reply(413,{error:'Entry too long'});return true;}}
   const input=JSON.parse(body);
   const context=JSON.parse(readFileSync('content/entry-context.json'));
   if(!Object.values(context.pages).some(page=>page.entries.some(entry=>entry.id===input.id))||typeof input.text!=='string'||!input.text.trim()||input.text.length>50000||typeof input.note!=='string'||input.note.length>10000){reply(400,{error:'A known entry and nonempty text are required'});return true;}
   const corrections=read();
   if((corrections[input.id]?.updated_at||null)!==(input.revision||null)){reply(409,{error:'This entry changed in another tab. Reload before editing.'});return true;}
   corrections[input.id]={text:input.text,note:input.note,updated_at:new Date().toISOString()};
   const html=renderEntryContext(readFileSync('web/index.html','utf8'),context,corrections);
   writeFileSync(correctionsFile+'.tmp',JSON.stringify(corrections,null,2)+'\n');renameSync(correctionsFile+'.tmp',correctionsFile);
   writeFileSync(resolve(directory,'index.html'),html);
   reply(200,corrections[input.id]);
  }catch{reply(500,{error:'Could not save. Your unsaved text is still in the editor.'});}
  return true;
 };
}
