import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildJournalModel} from '../scripts/journal-model.js';
import {searchableHTML} from '../scripts/entry-layout.js';
import {renderEntryContext} from '../scripts/render-context.js';
const raw=readFileSync('web/index.html','utf8'),data=JSON.parse(readFileSync('content/entry-context.json')),config=JSON.parse(readFileSync('content/entry-groups.json'));
const model=buildJournalModel(raw,data,config);
test('grouping retains every source word, original passage ID and original photo page',()=>{
 assert.equal(model.pages.size,69);
 for(const page of model.pages.values())assert.equal(searchableHTML(page.pieces.map(piece=>piece.html).join('')).text,searchableHTML(page.body).text,'Source page '+page.order);
 const original=Object.values(data.pages).flatMap(page=>page.entries.map(entry=>entry.id));assert.equal(original.length,189);
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
 const continuation=html.match(/<article[^>]*>[\s\S]*?<\/article>/g).find(article=>article.includes('id="context-P-page-029-prefix"'));
 assert.doesNotMatch(group,/Great Party at house last night|class="entry-context"/);
 assert.match(continuation,/Great Party at house last night/);
 assert.match(continuation,/Continued on page 29/);
 assert.equal((html.match(/Great Party at house last night/g)||[]).length,1);
 assert(continuation.indexOf('Great Party')<continuation.indexOf('class="entry-context"'));
 for(const page of [51,52,53]){
  const section=html.match(new RegExp('<section class="log-page" id="page-0'+page+'"[\\s\\S]*?</section>'))[0];
  assert.match(section,/data-entry-id="E-a73bd50f4b"/);
  assert.match(section,new RegExp('data-source-page="'+page+'"'));
 }
 for(const id of model.passages.keys())assert.equal((html.match(new RegExp('id="context-'+id+'"','g'))||[]).length,1,'Preserved anchor '+id);
 for(const page of model.pages.keys())assert(html.includes('id="page-'+String(page).padStart(3,'0')+'"'));
 assert.match(continuation,/href="#context-E-a0b22e406e"/);
});
test('each passage correction, family note and revision stays independent within a complete entry',()=>{
 const corrections={
  'E-a0b22e406e':{text:'First corrected passage.',note:'First family note.',updated_at:'2026-11-19T12:00:00Z'},
  'P-page-029-prefix':{text:'Second corrected passage <unsafe>.',note:'Second family note.',updated_at:'2026-11-23T15:00:00Z'}
 };
 const html=renderEntryContext(raw,data,corrections),group=html.match(/<article[^>]*id="context-E-a0b22e406e"[^>]*>[\s\S]*?<\/article>/)[0];
 for(const text of ['First corrected passage.','Second corrected passage &lt;unsafe&gt;.','First family note.','Second family note.'])assert(html.includes(text));
 assert.match(html,/datetime="2026-11-23T15:00:00Z"/);assert(!html.includes('<unsafe>'));
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


test('July 29 has one saved transcription with both original scans',()=>{
 const corrections=JSON.parse(readFileSync('content/corrections.json'));
 const id='E-d779898898', continuation='E-be19a07009';
 assert.equal(corrections[continuation],undefined);
 assert.match(corrections[id].text,/could not tie on\.\n\nWe proceeded off shore/);
 assert.match(corrections[id].note,/Val England[\s\S]*Vermillion/);
 const html=renderEntryContext(raw,data,corrections,config);
 const article=html.match(new RegExp('<article[^>]*id="context-'+id+'"[^>]*>[\\s\\S]*?</article>'))[0];
 assert.match(article,/data-passage-count="1" data-reading-pages="14,15"/);
 assert.match(article,/Guests were Dr Scott Holt[\s\S]*We proceeded off shore/);
 assert.doesNotMatch(html,/data-passage-id="E-be19a07009"/);
 assert.match(html,/id="context-E-be19a07009" hidden/);
});

test('each multi-page trip has one editable transcription in the current archive',()=>{
 const corrections=JSON.parse(readFileSync('content/corrections.json'));
 const html=renderEntryContext(raw,data,corrections,config);
 for(const group of model.groups.values()){
  if(group.pages.length<2)continue;
  const articles=[...html.matchAll(/<article\b[\s\S]*?<\/article>/g)]
   .map(([article])=>article)
   .filter(article=>article.includes(`data-entry-id="${group.id}"`));
  assert.equal(articles.length,1,group.id);
  assert.match(articles[0],/data-passage-count="1"/);
  const activeIds=group.passageIds.filter(id=>corrections[id]?.text);
  assert.deepEqual(activeIds,[group.id]);
  if(group.passageIds.some(id=>corrections[id]?.deleted))continue;
  assert(articles[0].includes(`data-reading-pages="${group.pages.join(',')}"`));
  for(const page of group.pages){
   assert(articles[0].includes(`aria-label="View original page ${page}"`));
  }
 }
 assert.match(corrections['E-a0b22e406e'].text,/Good summer so far\.\n\nWell, there’s more to that\./);
});
