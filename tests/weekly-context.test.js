import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {weeklyContextHTML} from '../scripts/render-weekly-context.js';
const weekly=JSON.parse(readFileSync('content/weekly-context.json'));
test('historical context never includes events or economic observations after the entry date',()=>{
 for(const [day,snapshot]of Object.entries(weekly.snapshots)){
  assert.equal(snapshot.end_date,day);assert.equal(Date.parse(day)-Date.parse(snapshot.start_date),6*86400000);
  assert(snapshot.events.length<=3);
  for(const event of snapshot.events){assert(event.date>=snapshot.start_date&&event.date<=day);assert(event.text.trim());assert(event.source_url.startsWith('https://en.wikipedia.org/wiki/'));assert.equal(event.license,'CC BY-SA 4.0');}
  for(const [series,record]of Object.entries(snapshot.economy)){
   assert.equal(record.series,series);assert.equal(record.vintage,day);assert(record.period<=day);assert(Number.isFinite(record.value));
   assert(record.download_url.includes('vintage_date='+day));
   if(series==='UNRATE')assert(record.value>=0&&record.value<=100);
  }
 }
 assert(Object.values(weekly.snapshots).some(snapshot=>snapshot.events.length));assert(Object.values(weekly.snapshots).some(snapshot=>snapshot.economy.UNRATE&&snapshot.economy.CPIAUCSL));
});
test('the economy labels monthly periods and refuses revised or future data masquerading as historical',()=>{
 const day='1995-03-06';const html=weeklyContextHTML({date:day},weekly);
 assert.match(html,/monthly indicators/);assert.match(html,/Historical vintages exclude later revisions/);assert.match(html,/January 1995/);assert.match(html,/CC BY-SA|No sourced highlights/);
 const bad={snapshots:{[day]:{start_date:'1995-02-28',events:[{date:'1995-03-07',text:'Future news'}],economy:{UNRATE:{period:'1995-03-01',vintage:'2026-11-19',value:99}}}}};
 const safe=weeklyContextHTML({date:day},bad);assert(!safe.includes('Future news'));assert(!safe.includes('99.0'));assert.match(safe,/unavailable/);
 assert.equal(weeklyContextHTML({date:null},weekly),'');
});
test('weekly context remains static and attaches to dated entries in the built notebook',()=>{
 const html=readFileSync('dist/index.html','utf8');assert.match(html,/Elsewhere that week/);assert.match(html,/U.S. economy at the time/);assert.match(html,/connect-src 'none'/);assert.doesNotMatch(html,/api-key=/);
 const article=html.match(/<article[^>]*id="context-E002"[^>]*>[\s\S]*?<\/article>/)[0];assert.match(article,/weekly-history/);assert.match(article,/weekly-economy/);
});
