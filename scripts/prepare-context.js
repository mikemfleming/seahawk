import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolveBookDates,weatherBase,chartWeek,topTen,weatherRecord} from './context-data.js';
const root='data/intake/seahawk/';const archive=JSON.parse(readFileSync(root+'gallery-archive-snapshot.json'));const manifest=JSON.parse(readFileSync(root+'manifest.json'));
const cache=root+'context-cache/';mkdirSync(cache,{recursive:true});mkdirSync('content',{recursive:true});
async function json(url){const file=cache+createHash('sha256').update(url).digest('hex')+'.json';if(existsSync(file))return JSON.parse(readFileSync(file));const response=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error(`HTTP ${response.status}`);const body=await response.json();if(body.error)throw Error('Provider error');writeFileSync(file,JSON.stringify(body));return body;}
const chronology=JSON.parse(readFileSync('content/chronology.json'));
const layout=JSON.parse(readFileSync('content/entry-layout.json'));
const result={generated_at:new Date().toISOString(),pages:{},charts:{},weather:{},sources:{weather:'https://open-meteo.com/en/docs/historical-weather-api',charts:'https://github.com/mhollingshead/billboard-hot-100'}};
const pageEntries=manifest.items.filter(item=>item.order<5||item.order>10).flatMap(item=>{
 const page=archive.pages.find(page=>page.sha256===item.sha256);
 return page?[{order:item.order,entries:archive.entries.filter(entry=>entry.page_ids.includes(page.id))}]:[];
});
const ordered=pageEntries.flatMap(page=>page.entries);
const resolvedDates=resolveBookDates(ordered,chronology);
const dates=new Map(ordered.map((entry,index)=>[entry.id,resolvedDates[index]]));
let afterTransition=false;const weatherJobs=new Map();const chartDates=new Set();
for(const page of pageEntries){
 const enriched=[];
 for(const entry of page.entries){
  const reference=weatherBase(entry.id,afterTransition);
  const resolved=dates.get(entry.id);
  const record={id:entry.id,layout_anchor:layout[entry.id],label:entry.date_as_written||'Undated passage',...resolved,region:reference.region,weather_reference:reference,weather_key:null,weather_keys:[],chart_date:null,chart_dates:[],weather_status:resolved.date?'pending':'date_unknown',chart_status:resolved.date?'pending':'date_unknown'};
  for(const date of resolved.dates){
   chartDates.add(date);const key=`${reference.id}/${date}`;record.weather_keys.push(key);
   const group=`${reference.id}/${date.slice(0,4)}`;
   if(!weatherJobs.has(group))weatherJobs.set(group,{reference,year:date.slice(0,4),region:reference.region,dates:new Set()});
   weatherJobs.get(group).dates.add(date);
  }
  record.weather_key=record.weather_keys[0]||null;
  enriched.push(record);
  if(entry.id===chronology.weather_transition_after)afterTransition=true;
 }
 if(enriched.length)result.pages[page.order]={entries:enriched};
}
console.log(`Resolved headings for ${chartDates.size} dates; fetching ${weatherJobs.size} weather ranges.`);
for(const job of weatherJobs.values()){
 const dates=[...job.dates].sort();const params=new URLSearchParams({latitude:String(job.reference.latitude),longitude:String(job.reference.longitude),start_date:dates[0],end_date:dates.at(-1),daily:'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,weather_code',temperature_unit:'fahrenheit',wind_speed_unit:'kn',precipitation_unit:'inch',timezone:job.region==='Hawaii'?'Pacific/Honolulu':'America/Chicago',models:'era5',grid_cell_selection:'nearest',elevation:'nan'});const url='https://archive-api.open-meteo.com/v1/archive?'+params;
 try{const response=await json(url);for(const date of dates){try{result.weather[`${job.reference.id}/${date}`]={...weatherRecord(response,date,job.reference),source_url:url,status:'available'};}catch{}}console.log('Weather loaded: '+job.reference.name+' '+job.year);}catch(error){console.log('Weather unavailable: '+job.reference.name+' '+job.year+' ('+error.message+')');}
}
let dateIndex=[];try{dateIndex=await json('https://raw.githubusercontent.com/mhollingshead/billboard-hot-100/main/valid_dates.json');}catch{console.log('Chart date index unavailable.');}
const weeks=[...new Set([...chartDates].map(date=>chartWeek(date,dateIndex)).filter(Boolean))];let next=0;
async function chartWorker(){while(next<weeks.length){const week=weeks[next++];try{const data=await json(`https://raw.githubusercontent.com/mhollingshead/billboard-hot-100/main/date/${week}.json`);result.charts[week]={date:week,songs:topTen(data,week),chart_url:`https://www.billboard.com/charts/hot-100/${week}/`,archive_url:result.sources.charts};}catch{console.log('Chart unavailable: '+week);}}}
await Promise.all([chartWorker(),chartWorker(),chartWorker()]);
for(const page of Object.values(result.pages))for(const entry of page.entries){if(entry.date){entry.chart_dates=[...new Set(entry.dates.map(date=>chartWeek(date,dateIndex)).filter(Boolean))];entry.chart_date=entry.chart_dates[0]||null;entry.chart_status=entry.chart_dates.every(date=>result.charts[date])?'available':'unavailable';entry.weather_status=entry.weather_keys.every(key=>result.weather[key])?'available':'unavailable';}}
writeFileSync('content/entry-context.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({pages:Object.keys(result.pages).length,entries:Object.values(result.pages).reduce((n,p)=>n+p.entries.length,0),weatherDays:Object.keys(result.weather).length,chartWeeks:Object.keys(result.charts).length}));
