import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { once } from 'node:events';
import { createApp } from '../server.js';
import { formatEscapedTranscription, enhanceGallery } from '../scripts/gallery-markup.js';
const html=readFileSync('dist/index.html','utf8');
test('69 Ricoh photos appear in original order with pages 5–10 and 76–79 omitted',()=>{
 const sections=[...html.matchAll(/<section class="log-page" id="page-(\d+)"[^>]*data-source="([^"]+)"[^>]*data-sha256="([a-f0-9]+)">([\s\S]*?)<\/section>/g)];
 assert.equal(sections.length,69);assert.equal(new Set(sections.map(section=>section[2])).size,69);assert.equal(new Set(sections.map(section=>section[3])).size,69);
 const expected=Array.from({length:79},(_,i)=>i+1).filter(n=>n<5||n>10&&n<76);
 for(const [index,section]of sections.entries()){assert.equal(Number(section[1]),expected[index]);assert.match(section[2],/^R\d+\.jpeg$/);assert(section[4].indexOf('<img ')<section[4].indexOf('class="transcription"'));assert.match(section[4],/class="transcription"[^>]*>\s*\S/);assert.match(section[4],/<img[^>]+width="\d+" height="\d+"/);}
});
test('the detached newspaper clipping appears inside the July 10, 1998 entry',()=>{
 const entry=html.match(/<article[^>]*id="context-E-c550df3542"[\s\S]*?<\/article>/)?.[0];
 assert.match(entry,/artifact-A-page-078-saltwater-angler-clipping/);
 assert.match(entry,/href="photos\/078-full.jpg"/);
 assert.doesNotMatch(html,/id="page-078"|value="page-078"/);
});
test('both typed inserts appear inside the April 25, 2000 entry',()=>{
 const entry=html.match(/<article[^>]*id="context-E-a73bd50f4b"[\s\S]*?<\/article>/)?.[0];
 assert.match(entry,/artifact-A-page-077-typed-log/);
 assert.match(entry,/artifact-A-page-079-typed-log-continuation/);
 assert.match(entry,/href="photos\/077-full.jpg"/);
 assert.match(entry,/href="photos\/079-full.jpg"/);
});
test('the Lucky boys clipping has its own section outside the journal pages',()=>{
 const section=html.match(/<section class="loose-clippings"[\s\S]*?<\/section>/)?.[0];
 assert.match(section,/artifact-A-page-076-lucky-boys-clipping/);
 assert.match(section,/href="photos\/076-full.jpg"/);
 assert.doesNotMatch(html,/id="page-076"|value="page-076"/);
});
test('transcriptions and historical data are static, with a local viewer script and no account APIs',()=>{
 assert.doesNotMatch(html,/<form|supabase|\/api\/|log.?in|sign.?in|archivist/i);assert.equal([...html.matchAll(/<script/g)].length,1);assert.match(html,/<script src="gallery.js" type="module"><\/script>/);assert.match(html,/script-src 'self'/);assert(existsSync('dist/gallery.js'));assert.match(html,/connect-src 'none'/);assert.match(html,/Captain Eddie/);
 for(const src of html.matchAll(/(?:src|href)="([^"#]+)"/g)){if(src[1].startsWith('photos/')||src[1]==='style.css')assert(existsSync('dist/'+src[1]),`Missing ${src[1]}`);}
 assert.equal(readdirSync('dist/photos').length,79*3);
});
test('confirmed names are preserved and only expected scripts are included',()=>{
 assert.match(html,/Bill Hudspeth/);assert(/Lester\s+Ducote/.test(html), 'Confirmed surname retained across line breaks');assert.doesNotMatch(html,/<script(?! src="(?:gallery.js|vendor\/leaflet\/leaflet.js)")/i);
});
test('any visitor can read the page and photos; obsolete auth and write endpoints are gone',async t=>{
 const server=createApp();server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));const origin=`http://127.0.0.1:${server.address().port}`;
 const page=await fetch(origin);assert.equal(page.status,200);assert.equal(page.headers.get('set-cookie'),null);assert.match(await page.text(),/Page 75/);
 const image=await fetch(origin+'/photos/001-large.jpg');assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/jpeg');const bytes=Buffer.from(await image.arrayBuffer());assert.equal(bytes.subarray(0,3).toString('hex'),'ffd8ff');
 for(const path of ['/api/archive','/.env','/api/config','/src/main.tsx','/%2e%2e%2fpackage.json'])assert.equal((await fetch(origin+path)).status,404);
 assert.equal((await fetch(origin+'/api/session',{method:'POST',body:'{}'})).status,405);
 assert.equal((await fetch(origin+'/workspace',{redirect:'manual'})).headers.get('location'),'/');
});


test('jump menu contains only displayed pages and uncertainty highlights preserve the exact text',()=>{
 const pages=[...html.matchAll(/<section class="log-page" id="(page-\d+)"/g)].map(match=>match[1]);
 const choices=[...html.matchAll(/<option value="(page-\d+)">/g)].map(match=>match[1]);assert.deepEqual(choices,pages);assert.match(html,/id="photo-viewer-root"/);assert.match(html,/class="back-to-top" href="#top"/);
 const text='First [Hudspeth?].\n\nThen [illegible] and &lt;unsafe&gt;.';
 const formatted=formatEscapedTranscription(text);assert(formatted.includes('<mark class="uncertain">[Hudspeth?]</mark>'));assert(formatted.includes('<mark class="uncertain">[illegible]</mark>'));assert(formatted.includes('&lt;unsafe&gt;'));assert.equal((formatted.match(/class="passage"/g)||[]).length,2);assert.equal(formatEscapedTranscription(formatted),formatted);assert.equal(enhanceGallery(html),html);
});
