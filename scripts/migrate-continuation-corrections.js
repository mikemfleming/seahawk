import {readFileSync,writeFileSync,renameSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export function splitContinuationCorrection(corrections,{from,to,before}){
 const original=corrections[from];
 if(!original||original.complete_entry)return corrections;
 const index=original.text.indexOf(before);
 if(index<0)return corrections;
 if(corrections[to])throw Error('Destination already has an independent correction: '+to);
 if(index===0||original.text.indexOf(before,index+1)>=0)throw Error('Ambiguous corrected-passage boundary');
 const first=original.text.slice(0,index),second=original.text.slice(index);
 if(first+second!==original.text)throw Error('Correction text preservation failed');
 return {...corrections,[from]:{...original,text:first},[to]:{text:second,note:'',updated_at:original.updated_at}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const file='content/corrections.json',source=readFileSync(file,'utf8');let corrections=JSON.parse(source);
 const config=JSON.parse(readFileSync('content/entry-groups.json'));
 for(const definition of config.correction_splits||[])corrections=splitContinuationCorrection(corrections,definition);
 const after=JSON.stringify(corrections,null,2)+'\n';
 if(after===source){console.log('No correction migration needed.');process.exit(0);}
 if(!process.argv.includes('--write')){console.log('A reviewed correction split is ready. Use --write to apply it.');process.exit(0);}
 const hash=createHash('sha256').update(source).digest('hex');const folder='data/intake/seahawk/refactor-backups';mkdirSync(folder,{recursive:true});writeFileSync(folder+'/corrections-'+hash+'.json',source);
 if(readFileSync(file,'utf8')!==source)throw Error('Corrections changed during migration; retry from current saved text.');
 writeFileSync(file+'.tmp',after);renameSync(file+'.tmp',file);console.log('Moved the already-corrected continuation into its own passage; exact wording and original timestamp preserved. Original correction file backed up.');
}
