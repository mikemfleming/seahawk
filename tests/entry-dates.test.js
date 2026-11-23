import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dateOverrideError,correctedEntryDate} from '../scripts/entry-dates.js';
import {buildJournalModel} from '../scripts/journal-model.js';
import {renderEntryContext} from '../scripts/render-context.js';
const raw=readFileSync('web/index.html','utf8'),data=JSON.parse(readFileSync('content/entry-context.json')),config=JSON.parse(readFileSync('content/entry-groups.json'));
test('manual dates replace parsed headings and old context without changing transcription or source order',()=>{
 const group=buildJournalModel(raw,data,config).groups.get('E-c306261842');
 const corrections={[group.id]:{text:'Original wording remains Sept 17th.',note:'Family memory',date_override:{date:'1997-09-19',end_date:'1997-09-20'},date_updated_at:'2026-11-23T22:00:00Z',updated_at:'2026-11-23T22:00:00Z'}};
 const resolved=correctedEntryDate(group,corrections,data);assert.deepEqual(resolved.dates,['1997-09-19','1997-09-20']);assert.equal(resolved.weather_key,'port-aransas/1997-09-19');assert.deepEqual(resolved.chart_dates,['1997-09-20']);
 const html=renderEntryContext(raw,data,corrections),article=html.match(/<article[^>]*id="context-E-c306261842"[^>]*>[\s\S]*?<\/article>/)[0];
 assert.match(article,/September 19, 1997 – September 20, 1997/);assert.match(article,/Original wording remains Sept 17th/);assert.match(article,/Family memory/);assert.doesNotMatch(article,/Weather and music for September 17/);assert.match(article,/Historical weather is unavailable/);
 corrections[group.id].date_override={date:null,end_date:null};const unknown=correctedEntryDate(group,corrections,data);assert.equal(unknown.date,null);assert.deepEqual(unknown.dates,[]);
 for(const override of [{date:'1997-02-30',end_date:null},{date:null,end_date:'1997-01-01'},{date:'1997-09-19',end_date:'1997-09-18'}])assert.ok(dateOverrideError(override));
});
