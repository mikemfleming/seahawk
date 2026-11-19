import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {formatEntryUpdated} from '../web/entry-updated.js';
import {renderEntryContext} from '../scripts/render-context.js';
test('update timestamps show a real saved instant in a labeled timezone without inventing dates',()=>{
 assert.match(formatEntryUpdated('2026-11-19T19:28:26.963Z'),/Nov 19, 2026/);assert.match(formatEntryUpdated('2026-11-19T19:28:26.963Z'),/1:28 PM CST/);
 for(const value of [undefined,null,'','invalid'])assert.equal(formatEntryUpdated(value),null);
 const data=JSON.parse(readFileSync('content/entry-context.json'));const raw=readFileSync('web/index.html','utf8');
 const html=renderEntryContext(raw,data,{E003:{text:'Corrected text.',note:'',updated_at:'2026-11-19T19:28:26.963Z'}});
 const article=html.match(/<article[^>]*id="context-E003"[^>]*>[\s\S]*?<\/article>/)[0];
 assert.match(article,/Last updated <time datetime="2026-11-19T19:28:26.963Z">/);assert.match(article,/1:28 PM CST/);
 const untouched=html.match(/<article[^>]*id="context-E002"[^>]*>[\s\S]*?<\/article>/)[0];assert.match(untouched,/Not yet updated/);
 assert.equal((html.match(/class="entry-updated"/g)||[]).length,185);
});
