import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildJournalModel} from '../scripts/journal-model.js';
import {searchableHTML} from '../scripts/entry-layout.js';
import {renderEntryContext} from '../scripts/render-context.js';
const raw=readFileSync('web/index.html','utf8'),data=JSON.parse(readFileSync('content/entry-context.json')),config=JSON.parse(readFileSync('content/entry-groups.json'));
const model=buildJournalModel(raw,data,config);
test('grouping retains every source word, original passage ID and original photo page',()=>{
 assert.equal(model.pages.size,73);
 for(const page of model.pages.values())assert.equal(searchableHTML(page.pieces.map(piece=>piece.html).join('')).text,searchableHTML(page.body).text,'Source page '+page.order);
 const original=Object.values(data.pages).flatMap(page=>page.entries.map(entry=>entry.id));assert.equal(original.length,185);
 for(const id of original)assert(model.passages.has(id));
 const assigned=[...model.groups.values()].flatMap(group=>group.passageIds);assert.equal(new Set(assigned).size,model.passages.size);assert.equal(assigned.length,model.passages.size);
 assert.equal(model.membership.get('P-page-029-prefix'),'E-a0b22e406e');
 assert.equal(model.membership.get('P-page-041-prefix'),'E-c550df3542');assert.equal(model.membership.get('E-67243d16d9'),'E-67243d16d9');
 assert.match(model.passages.get('P-page-041-prefix').html,/Really takes/);assert(!model.passages.get('P-page-041-prefix').html.includes('July 11th'));assert.match(model.passages.get('E-67243d16d9').html,/July 11th/);
 assert.equal(model.membership.get('E-8dd394a776'),'E-8dd394a776','Undated does not mean continuation');
});
test('complete entries render continuations once, retain old anchors and show context only after the last passage',()=>{
 const html=renderEntryContext(raw,data,{});
 const group=html.match(/<article[^>]*id="context-E-a0b22e406e"[^>]*>[\s\S]*?<\/article>/)[0];
 assert.match(group,/Great Party at house last night/);assert.match(group,/Continued on page 29/);
 assert.equal((html.match(/Great Party at house last night/g)||[]).length,1);
 assert(group.indexOf('Great Party')<group.indexOf('class="entry-context"'));
 assert.equal((group.match(/class="entry-context"/g)||[]).length,1);
 for(const id of model.passages.keys())assert.equal((html.match(new RegExp('id="context-'+id+'"','g'))||[]).length,1,'Preserved anchor '+id);
 for(const page of model.pages.keys())assert(html.includes('id="page-'+String(page).padStart(3,'0')+'"'));
 assert.match(html,/href="#context-P-page-029-prefix">Read this passage in the complete entry/);
});
test('each passage correction, family note and revision stays independent within a complete entry',()=>{
 const corrections={
  'E-a0b22e406e':{text:'First corrected passage.',note:'First family note.',updated_at:'2026-11-19T12:00:00Z'},
  'P-page-029-prefix':{text:'Second corrected passage <unsafe>.',note:'Second family note.',updated_at:'2026-11-23T15:00:00Z'}
 };
 const html=renderEntryContext(raw,data,corrections),group=html.match(/<article[^>]*id="context-E-a0b22e406e"[^>]*>[\s\S]*?<\/article>/)[0];
 for(const text of ['First corrected passage.','Second corrected passage &lt;unsafe&gt;.','First family note.','Second family note.'])assert(group.includes(text));
 assert.match(group,/datetime="2026-11-23T15:00:00Z"/);assert(!group.includes('<unsafe>'));
 const saved=JSON.parse(readFileSync('content/corrections.json'));
 for(const id of Object.keys(saved))assert(model.passages.has(id),'Saved correction remains attached: '+id);
});
test('invalid groupings fail instead of silently losing or duplicating passages',()=>{
 assert.throws(()=>buildJournalModel(raw,data,{groups:[{id:'E002',passages:['E002','unknown']}]}),/Unknown passage/);
 assert.throws(()=>buildJournalModel(raw,data,{groups:[{id:'E002',passages:['E002','E002']}]}),/assigned twice/);
});

test('an already-corrected continuation can be split without changing any authored words or notes',async()=>{
 const {splitContinuationCorrection}=await import('../scripts/migrate-continuation-corrections.js');
 const original={first:{text:'First part.\n\nWell, more to that. Corrected continuation. ',note:'Keep this note.',updated_at:'2026-11-23T15:00:00Z'},other:{text:'Independent correction.'}};
 const definition={from:'first',to:'second',before:'Well, more to that.'};const split=splitContinuationCorrection(original,definition);
 assert.equal(split.first.text+split.second.text,original.first.text);assert.equal(split.first.note,original.first.note);assert.equal(split.second.updated_at,original.first.updated_at);assert.equal(split.other,original.other);
 assert.deepEqual(splitContinuationCorrection(split,definition),split);
 assert.throws(()=>splitContinuationCorrection({...original,second:{text:'Existing independent correction'}},definition),/already has/);
});

test('an absorbed continuation is hidden only when its corrected replacement exists',()=>{
 const saved=JSON.parse(readFileSync('content/corrections.json'));
 const html=renderEntryContext(raw,data,saved);
 assert.doesNotMatch(html,/Really takes a sporting paradox/);
 assert.match(html,/The boat is really taking a pounding/);
 assert.match(html,/id="context-P-page-041-prefix" hidden/);
 assert.doesNotMatch(html,/data-passage-id="P-page-041-prefix"/);
 assert.match(renderEntryContext(raw,data,{}),/Really takes a sporting paradox/);
});
