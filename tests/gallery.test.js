import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { once } from 'node:events';
import { createApp } from '../server.js';
import { formatEscapedTranscription, enhanceGallery } from '../scripts/gallery-markup.js';
const html=readFileSync('dist/index.html','utf8');
test('73 Ricoh photos appear in original order with pages 5–10 omitted',()=>{
 const sections=[...html.matchAll(/<section class="log-page" id="page-(\d+)"[^>]*data-source="([^"]+)"[^>]*data-sha256="([a-f0-9]+)">([\s\S]*?)<\/section>/g)];
 assert.equal(sections.length,73);assert.equal(new Set(sections.map(section=>section[2])).size,73);assert.equal(new Set(sections.map(section=>section[3])).size,73);
 const expected=Array.from({length:79},(_,i)=>i+1).filter(n=>n<5||n>10);
 for(const [index,section]of sections.entries()){assert.equal(Number(section[1]),expected[index]);assert.match(section[2],/^R\d+\.jpeg$/);assert(section[4].indexOf('<img ')<section[4].indexOf('class="transcription"'));assert.match(section[4],/class="transcription"[^>]*>\s*\S/);assert.match(section[4],/<img[^>]+width="\d+" height="\d+"/);}
});
test('transcriptions and historical data are static, with a local viewer script and no account APIs',()=>{
 assert.doesNotMatch(html,/<form|supabase|\/api\/|log.?in|sign.?in|archivist/i);assert.equal([...html.matchAll(/<script/g)].length,1);assert.match(html,/<script src="gallery.js" defer><\/script>/);assert.match(html,/script-src 'self'/);assert(existsSync('dist/gallery.js'));assert.match(html,/connect-src 'none'/);assert.match(html,/Captain Eddie/);
 for(const src of html.matchAll(/(?:src|href)="([^"#]+)"/g)){if(src[1].startsWith('photos/')||src[1]==='style.css')assert(existsSync('dist/'+src[1]),`Missing ${src[1]}`);}
 assert.equal(readdirSync('dist/photos').length,79*3);
});
test('uncertain readings and confirmed names are preserved as text, never executable markup',()=>{
 assert.match(html,/\[illegible\]/);assert.match(html,/Bill Hudspeth/);assert(/Lester\s+Ducote/.test(html), 'Confirmed surname retained across line breaks');assert.doesNotMatch(html,/<script(?! src="(?:gallery.js|vendor\/leaflet\/leaflet.js)")/i);
});
test('any visitor can read the page and photos; obsolete auth and write endpoints are gone',async t=>{
 const server=createApp();server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));const origin=`http://127.0.0.1:${server.address().port}`;
 const page=await fetch(origin);assert.equal(page.status,200);assert.equal(page.headers.get('set-cookie'),null);assert.match(await page.text(),/Page 79/);
 const image=await fetch(origin+'/photos/001-large.jpg');assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/jpeg');const bytes=Buffer.from(await image.arrayBuffer());assert.equal(bytes.subarray(0,3).toString('hex'),'ffd8ff');
 for(const path of ['/api/archive','/.env','/api/config','/src/main.tsx','/%2e%2e%2fpackage.json'])assert.equal((await fetch(origin+path)).status,404);
 assert.equal((await fetch(origin+'/api/session',{method:'POST',body:'{}'})).status,405);
 assert.equal((await fetch(origin+'/workspace',{redirect:'manual'})).headers.get('location'),'/');
});


test('jump menu contains only displayed pages and uncertainty highlights preserve the exact text',()=>{
 const pages=[...html.matchAll(/<section class="log-page" id="(page-\d+)"/g)].map(match=>match[1]);
 const choices=[...html.matchAll(/<option value="(page-\d+)">/g)].map(match=>match[1]);assert.deepEqual(choices,pages);assert.match(html,/id="photo-viewer"/);assert.match(html,/id="viewer-close"/);assert.match(html,/id="viewer-previous"/);assert.match(html,/id="viewer-next"/);assert.match(html,/id="viewer-position"/);assert.match(html,/class="back-to-top" href="#top"/);
 const text='First [Hudspeth?].\n\nThen [illegible] and &lt;unsafe&gt;.';
 const formatted=formatEscapedTranscription(text);assert(formatted.includes('<mark class="uncertain">[Hudspeth?]</mark>'));assert(formatted.includes('<mark class="uncertain">[illegible]</mark>'));assert(formatted.includes('&lt;unsafe&gt;'));assert.equal((formatted.match(/class="passage"/g)||[]).length,2);assert.equal(formatEscapedTranscription(formatted),formatted);assert.equal(enhanceGallery(html),html);
});
