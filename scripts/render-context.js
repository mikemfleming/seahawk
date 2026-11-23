import {formatEntryUpdated} from '../web/entry-updated.js';
import {weeklyContextHTML} from './render-weekly-context.js';
import {buildJournalModel} from './journal-model.js';
import {readFileSync} from 'node:fs';
const entryGroups=JSON.parse(readFileSync(new URL('../content/entry-groups.json',import.meta.url)));
const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const day=value=>new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z'));
const number=(value,suffix='',digits=1)=>typeof value==='number'&&Number.isFinite(value)?`${value.toFixed(digits)}${suffix}`:'Not available';
function condition(code){if(code===0)return 'Clear';if(code===1)return 'Mainly clear';if(code===2)return 'Partly cloudy';if(code===3)return 'Overcast';if([45,48].includes(code))return 'Fog';if([51,53,55,56,57].includes(code))return 'Drizzle';if([61,63,65,66,67,80,81,82].includes(code))return 'Rain';if([71,73,75,77,85,86].includes(code))return 'Snow';if([95,96,99].includes(code))return 'Thunderstorms';return 'Conditions unavailable';}
function windDirection(degrees){return typeof degrees==='number'?['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(degrees/22.5)%16]:'';}
function weatherHTML(entry,data){
 const record=data.weather[entry.weather_key];
 if(!record)return `<p class="context-note">${entry.weather_status==='location_unknown'?'Historical weather needs a resolved location.':'Historical weather is unavailable for this date and location.'}</p>`;
 const reference=entry.weather_reference;
 return `<details class="historical-weather"><summary>${entry.dates?.length>1?day(record.date)+' · ':'Weather · '}${condition(record.weather_code)} · ${number(record.temperature_2m_min,'°',0)}–${number(record.temperature_2m_max,'°F',0)} · wind ${number(record.wind_speed_10m_max,' kn',0)}</summary><p class="context-note">${escape(reference.name)}${' · home port for this part of the log'}</p><dl class="weather-facts"><div><dt>Temperature</dt><dd>${number(record.temperature_2m_min,'°F')}–${number(record.temperature_2m_max,'°F')}</dd></div><div><dt>Rainfall</dt><dd>${number(record.precipitation_sum,' in',2)}</dd></div><div><dt>Maximum wind</dt><dd>${number(record.wind_speed_10m_max,' kn')} ${windDirection(record.wind_direction_10m_dominant)}</dd></div><div><dt>Maximum gust</dt><dd>${number(record.wind_gusts_10m_max,' kn')}</dd></div></dl><p class="context-note weather-source">Daily regional reconstruction, not an observation aboard the boat. ERA5 grid ≈25 km. <a href="${escape(record.source_url)}" target="_blank" rel="noopener noreferrer">Open-Meteo weather data ↗</a></p></details>`;
}
function chartHTML(entry,data){
 const chart=data.charts[entry.chart_date];
 if(!chart)return '<p class="context-note">The weekly Hot 100 chart is unavailable for this date.</p>';
 return `<details class="weekly-songs"><summary>Billboard Hot 100 · top 10 · ${day(chart.date)}</summary><p class="context-note">Chart dated ${day(chart.date)}, for the week containing this entry.</p><ol>${chart.songs.map(song=>`<li><span class="song-title">${escape(song.title)}</span><span class="song-artist">${escape(song.artist)}</span></li>`).join('')}</ol><p class="context-note"><a href="${escape(chart.chart_url)}" target="_blank" rel="noopener noreferrer">Billboard chart ↗</a> · <a href="${escape(chart.archive_url)}" target="_blank" rel="noopener noreferrer">Public chart-data archive ↗</a></p></details>`;
}
function entryHeading(entry){
 if(!entry.date)return '';
 return `<header class="entry-heading"><h3>${day(entry.date)}${entry.end_date?' – '+day(entry.end_date):''}</h3></header>`;
}
function entryContext(entry,data){
 if(!entry.date)return '';
 return `<aside class="entry-context" aria-label="Weather and music for ${day(entry.date)}">${(entry.weather_keys||[entry.weather_key]).map(key=>weatherHTML({...entry,weather_key:key},data)).join('')}${(entry.chart_dates||[entry.chart_date]).map(date=>chartHTML({...entry,chart_date:date},data)).join('')}${weeklyContextHTML(entry,data.weekly)}</aside>`;
}
export function renderContextBlock(page,data){
 return page.entries.map(entry=>entryHeading(entry)+entryContext(entry,data)).join('');
}
export function renderEntryContext(html,data,corrections={},grouping=entryGroups){
 if(!data)return html;
 const model=buildJournalModel(html,data,grouping);
 function renderGroup(group){
  const entry=group.entry||{id:group.id,date:null};
  const title=entry.date?day(entry.date):'Journal note';
  const year=entry.date?.slice(0,4)||entry.period?.[0]||'';
  const parts=group.passageIds.map((id,index)=>{
   const passage=model.passages.get(id),correction=corrections[id];
   const text=correction?correction.text.split(/\n\s*\n/).map(paragraph=>`<p class="passage">${escape(paragraph)}</p>`).join('\n'):passage.html;
   const note=correction?.note?.trim()?`<p class="entry-clarification"><strong>Family note:</strong> ${escape(correction.note)}</p>`:'';
   return `<div class="entry-passage" data-passage-id="${escape(id)}" data-entry-id="${escape(group.id)}" data-source-page="${passage.page}"${id!==group.id?` id="context-${escape(id)}"`:''}>
    ${index?`<p class="continuation-divider">Continued on page ${passage.page}</p>`:''}
    <div class="passage-source"><span>From page ${passage.page}</span><button type="button" class="source-photo" data-source-page="${passage.page}" aria-label="View original page ${passage.page}">View original ↗</button></div>
    <div class="entry-text">${text}</div>${note}</div>`;
  }).join('\n');
  const latest=group.passageIds.map(id=>corrections[id]?.updated_at).filter(value=>formatEntryUpdated(value)).sort((a,b)=>Date.parse(b)-Date.parse(a))[0];
  const updated=`<p class="entry-updated">${latest?`Last updated <time datetime="${escape(latest)}">${escape(formatEntryUpdated(latest))}</time>`:'Not yet updated'}</p>`;
  return `<article class="log-entry dated-context" data-year="${year}" data-entry-id="${escape(group.id)}" data-entry-title="${escape(title)}" data-source-pages="${group.pages.join(',')}" id="context-${escape(group.id)}">${entryHeading(entry)}${parts}${entryContext(entry,data)}${updated}</article>`;
 }
 html=html.replace(/<section class="log-page" id="page-(\d+)"[\s\S]*?<\/section>/g,(section,n)=>{
  const page=model.pages.get(Number(n));
  if(!page.entries.length&&!page.pieces.some(piece=>piece.id))return section;
  const contents=page.pieces.map(piece=>{
   if(!piece.id)return piece.html;
   const group=model.groups.get(model.membership.get(piece.id));
   if(piece.id===group.id)return renderGroup(group);
   const title=group.entry?.date?day(group.entry.date):'the journal note';
   return `<p class="continuation-reference">This page continues ${escape(title)} from page ${group.pages[0]}. <a href="#context-${escape(piece.id)}">Read this passage in the complete entry ↗</a></p>`;
  }).join('\n');
  const first=page.entries[0]?.id||page.pieces.find(piece=>piece.id)?.id;
  return section.replace(/<div class="transcription"[^>]*>[\s\S]*?<\/div>/,`<div class="transcription"${page.attrs} id="places-${escape(first)}">${contents}</div>`);
 });
 const years=new Map();
 // The acquisition account opens the book in December 1994.
 if(data.pages[11])years.set(1994,'page-011');
 for(const [order,page]of Object.entries(data.pages))for(const entry of page.entries){
  const year=entry.date?Number(entry.date.slice(0,4)):entry.period?.[0];
  if(year&&!years.has(year))years.set(year,entry.date?'context-'+entry.id:'page-'+String(order).padStart(3,'0'));
 }
 const options=[...years].sort((a,b)=>a[0]-b[0]).map(([year,id])=>`<option value="${escape(id)}" data-year="${year}">${year}</option>`).join('');
 return html.replace('<span class="page-total">',`<label for="year-jump">Year</label><select id="year-jump"><option value="">Choose year</option>${options}</select><span class="page-total">`);
}
