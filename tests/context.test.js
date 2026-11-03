import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validDate,headingParts,resolveEntryDates,resolveBookDates,chartWeek,topTen,explicitCoordinates,weatherRecord} from '../scripts/context-data.js';
import {searchableHTML,entryBoundaries,splitTranscription} from '../scripts/entry-layout.js';
import {renderContextBlock,renderEntryContext} from '../scripts/render-context.js';

test('historical dates use explicit or same-page years and reject missing or contradictory years',()=>{
 assert(validDate('2000-02-29'));assert(!validDate('2001-02-29'));
 const dates=resolveEntryDates([{date_as_written:'April 6th, 96'},{date_as_written:'May 22nd'},{date_as_written:'5/2/57'}]);
 assert.equal(dates[0].date,'1996-04-06');assert.equal(dates[1].date,'1996-05-22');assert.match(dates[1].basis,/inferred/);assert.equal(dates[2].date,null);
 assert.equal(resolveEntryDates([{date_as_written:'May 22nd'}])[0].date,null);
 assert.equal(resolveEntryDates([{date_as_written:'7/16/61',date:'1961-07-16'}])[0].date,null);
 assert.equal(resolveEntryDates([{date_as_written:'1/10/01'},{date_as_written:'2/7/01'}])[1].date,'2001-02-07');
 assert.equal(headingParts('Aug 23, 24, 21st'),null);
 assert.equal(resolveEntryDates([{date_as_written:'May 31st 2001'},{date_as_written:'6/5/'}])[1].date,'2001-06-05');
});
test('weekly charts use the issue date within the entry week and require exactly ranks one through ten',()=>{
 assert.equal(chartWeek('1995-03-06',['1995-03-04','1995-03-11','1995-03-18']),'1995-03-11');assert.equal(chartWeek('1995-03-11',['1995-03-11']),'1995-03-11');assert.equal(chartWeek('1995-03-06',['1995-03-18']),null);
 const data=Array.from({length:10},(_,i)=>({this_week:i+1,song:`Song ${i+1}`,artist:'Artist'}));assert.equal(topTen({date:'1995-03-11',data},'1995-03-11').length,10);assert.throws(()=>topTen({date:'1995-03-18',data},'1995-03-11'));assert.throws(()=>topTen({date:'1995-03-11',data:data.slice(0,9)},'1995-03-11'));assert.throws(()=>topTen({date:'1995-03-11',data:[data[0],...data.slice(0,9)]},'1995-03-11'));
});
test('fishing depths are never invented map coordinates; written coordinates are range checked',()=>{
 assert.equal(explicitCoordinates('We fished in 21 fathoms.','Texas'),null);const point=explicitCoordinates('N27°53.152 with W96°44.925','Texas');assert(Math.abs(point.latitude-27.8858667)<0.00001);assert(Math.abs(point.longitude+96.74875)<0.00001);assert.equal(explicitCoordinates('N27°73.152 W96°44.925','Texas'),null);assert.equal(explicitCoordinates('N27°53.152 W96°44.925','Hawaii'),null);
});
test('historical weather respects dates and units, preserves zero rainfall, and leaves missing values absent',()=>{
 const body={latitude:28,longitude:-97,timezone:'America/Chicago',daily_units:{temperature_2m_max:'°F',temperature_2m_min:'°F',precipitation_sum:'inch',wind_speed_10m_max:'kn'},daily:{time:['1995-03-06'],temperature_2m_max:[73.4],temperature_2m_min:[62.2],precipitation_sum:[0],wind_speed_10m_max:[12.9],wind_gusts_10m_max:[null]}};
 const record=weatherRecord(body,'1995-03-06',{name:'Port Aransas',kind:'regional'});assert.equal(record.precipitation_sum,0);assert.equal(record.wind_gusts_10m_max,null);assert.equal(record.grid_latitude,28);assert.throws(()=>weatherRecord(body,'1995-03-07',{name:'Port Aransas'}));assert.throws(()=>weatherRecord({...body,daily_units:{temperature_2m_max:'°C'}},'1995-03-06',{}));
});
test('prepared context contains sourced weather and ten real songs per week without attaching data to unknown dates',()=>{
 const data=JSON.parse(readFileSync('content/entry-context.json'));assert(Object.keys(data.weather).length>0);assert(Object.keys(data.charts).length>0);
 for(const chart of Object.values(data.charts)){assert.equal(chart.songs.length,10);assert.deepEqual(chart.songs.map(song=>song.rank),[1,2,3,4,5,6,7,8,9,10]);assert(chart.chart_url.startsWith('https://www.billboard.com/charts/hot-100/'));}
 for(const page of Object.values(data.pages))for(const entry of page.entries){if(!entry.date){assert.equal(entry.weather_key,null);assert.equal(entry.chart_date,null);}if(entry.weather_status==='available')assert.equal(data.weather[entry.weather_key].date,entry.date);for(const p of entry.places||[]){assert(Number.isFinite(p.latitude));assert(Number.isFinite(p.longitude));}}
 assert.equal(data.charts['1995-03-11'].songs[0].title,'Take A Bow');assert.equal(data.charts['1995-03-11'].songs[0].artist,'Madonna');
});
test('context rendering escapes names, attributes sources, and keeps transcriptions separate from reanalysis',()=>{
 const data=JSON.parse(readFileSync('content/entry-context.json'));const block=renderContextBlock(data.pages[11],data);assert.match(block,/not an observation aboard the boat/);assert.doesNotMatch(block,/OpenStreetMap|entry-map|leaflet/);assert.match(block,/Billboard Hot 100/);assert.equal((block.match(/class="song-title"/g)||[]).length,30);
 const malicious={entries:[{id:'bad',date:null,places:[{id:'x',name:'<script>bad</script>',latitude:27,longitude:-97,precision:'unknown'}],unresolved:[]}]};const safe=renderContextBlock(malicious,{weather:{},charts:{}});assert(!safe.includes('<script>'));assert(!safe.includes('bad</script>'));
 const raw=readFileSync('web/index.html','utf8');const rendered=renderEntryContext(raw,data);assert.match(rendered,/class="entry-text"/);assert(!rendered.includes('class="page-context"'));

});

test('book chronology resolves cross-page years, photo date corrections, ranges and the retrospective insert',()=>{
 const chronology=JSON.parse(readFileSync('content/chronology.json'));
 const sample=[{id:'E002',date_as_written:'March 6th 95'},{id:'next-page',date_as_written:'May 12th'},{id:'E-34da3b6c76',date_as_written:'April 6th, 96'},{id:'E-00d722132c',date_as_written:'Jan 12-15 1957'},{id:'E-7bb3604ad0',date_as_written:'March 16th 1989'},{id:'E-7cb3734825',date_as_written:'Feb 14th 1999'},{id:'E-e593a8be00',date_as_written:'July 10 - 11th 75'},{id:'E-26ddaedba6',date_as_written:'Nov 27th 1995'},{id:'E-6f9e517116',date_as_written:'1/14/00'},{id:'E-e3581660fb',date_as_written:'1/10/01'},{id:'E-99c1ba1e3b',date_as_written:'July 1st 2002'},{id:'E-e3bd2c5eb8',date_as_written:'July 04'},{id:'E-5762d5533a',date_as_written:'April 29th, 2000'}];
 const result=resolveBookDates(sample,chronology);
 assert.equal(result[1].date,'1995-05-12');assert.equal(result[3].date,'1997-01-12');assert.equal(result[3].dates.length,4);assert.equal(result[4].date,'1998-03-16');assert.deepEqual(result[6].dates,['1999-07-10','1999-07-11']);assert.equal(result[7].date,'1999-11-27');assert.equal(result[11].date,null);assert.deepEqual(result[11].period,[2004,7]);assert.equal(result[12].date,'2000-04-29');
});
test('home-port weather switches after July 10–11 on page 44 and never follows entry place names',()=>{
 const data=JSON.parse(readFileSync('content/entry-context.json'));
 let kona=false;
 for(const page of Object.values(data.pages))for(const entry of page.entries){
  assert.equal(entry.weather_reference.id,kona?'kona':'port-aransas');
  if(entry.id==='E-e593a8be00'){assert.equal(entry.end_date,'1999-07-11');kona=true;}
  for(const key of entry.weather_keys){assert(data.weather[key],`Missing weather: ${key}`);assert.equal(data.weather[key].reference,entry.weather_reference.name);}
 }
 assert.equal(data.pages[44].entries[1].weather_reference.id,'kona');
 const html=readFileSync('dist/index.html','utf8');assert.doesNotMatch(html,/entry-map|leaflet|tile.openstreetmap.org/);
});

test('reading aids keep detailed weather collapsed and year navigation points to actual book entries',()=>{
 const html=readFileSync('dist/index.html','utf8');
 assert.match(html,/<details class="historical-weather"><summary>Weather ·/);
 assert.doesNotMatch(html,/<details class="historical-weather" open/);
 const options=[...html.matchAll(/<option value="([^"]+)" data-year="(\d{4})">/g)];
 assert.deepEqual(options.map(option=>Number(option[2])),[1994,1995,1996,1997,1998,1999,2000,2001,2002,2004]);
 for(const option of options)assert(html.includes(`id="${option[1]}"`));
 assert.match(html,/wind \d+ kn<\/summary>/);
});

test('every entry retains its source text and has its own attached weather rather than a page-end panel',()=>{
 const data=JSON.parse(readFileSync('content/entry-context.json'));
 const raw=readFileSync('web/index.html','utf8');const built=readFileSync('dist/index.html','utf8');
 let count=0;
 for(const [order,page]of Object.entries(data.pages)){
  const section=raw.match(new RegExp('<section class="log-page" id="page-'+order.padStart(3,'0')+'"[\\s\\S]*?</section>'))[0];
  const body=section.match(/<div class="transcription"[^>]*>([\s\S]*?)<\/div>/)[1];
  const fragments=splitTranscription(body,entryBoundaries(body,page.entries));
  assert.equal(searchableHTML(fragments.map(fragment=>fragment.html).join('')).text,searchableHTML(body).text,'Source text preserved on page '+order);
  for(const fragment of fragments){
   assert.equal((fragment.html.match(/<p\b/g)||[]).length,(fragment.html.match(/<\/p>/g)||[]).length,'Balanced paragraphs on page '+order);
   assert.equal((fragment.html.match(/<mark\b/g)||[]).length,(fragment.html.match(/<\/mark>/g)||[]).length,'Balanced uncertainty marks on page '+order);
  }
  for(const entry of page.entries){
   const article=built.match(new RegExp('<article class="log-entry dated-context"[^>]*id="context-'+entry.id+'"[^>]*>[\\s\\S]*?</article>'))?.[0];
   assert(article,'Entry wrapper: '+entry.id);assert(article.includes('class="entry-text"'));
   if(entry.date){assert(article.indexOf('class="entry-text"')<article.indexOf('class="entry-context"'));assert(article.includes(entry.weather_reference.name));assert(!article.includes('class="entry-home-port"'));assert(!article.includes('class="context-note date-basis"'));assert(article.includes('Weather and music for'));}
   count++;
  }
 }
 assert.equal(count,185);assert.doesNotMatch(built,/class="page-context"/);
});
