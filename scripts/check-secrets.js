import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const files=[];
function visit(dir){for(const item of readdirSync(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())visit(path);else if(/\.(?:html|css|js|json|md|yml)$/.test(item.name))files.push(path);}}
for(const dir of ['web','scripts','tests','.github','content','local','docs'])visit(dir);
for(const file of files){const text=readFileSync(file,'utf8');if(/sb_secret_[A-Za-z0-9_-]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{30,}|gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))throw Error(`Credential pattern in ${file}`);}
console.log(`Checked ${files.length} source files for credentials. The static page uses no secrets.`);
