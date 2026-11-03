import {entryBoundaries,splitTranscription} from './entry-layout.js';
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
 return `<aside class="entry-context" aria-label="Weather and music for ${day(entry.date)}">${(entry.weather_keys||[entry.weather_key]).map(key=>weatherHTML({...entry,weather_key:key},data)).join('')}${(entry.chart_dates||[entry.chart_date]).map(date=>chartHTML({...entry,chart_date:date},data)).join('')}</aside>`;
}
export function renderContextBlock(page,data){
 return page.entries.map(entry=>entryHeading(entry)+entryContext(entry,data)).join('');
}
export function renderEntryContext(html,data,corrections={}){
 if(!data)return html;
 html=html.replace(/<section class="log-page" id="page-(\d+)"[\s\S]*?<\/section>/g,(section,n)=>{
  const page=data.pages[Number(n)];if(!page)return section;
  return section.replace(/<div class="transcription"([^>]*)>([\s\S]*?)<\/div>/,(_,attrs,body)=>{
   const fragments=splitTranscription(body,entryBoundaries(body,page.entries));
   const entries=new Map(page.entries.map(entry=>[entry.id,entry]));
   const grouped=fragments.map(fragment=>{
    if(!fragment.id)return fragment.html;
    const entry=entries.get(fragment.id);
    const correction=corrections[entry.id];
    const text=correction?correction.text.split(/\n\s*\n/).map(paragraph=>`<p class="passage">${escape(paragraph)}</p>`).join("\n"):fragment.html;
    const note=correction?.note?.trim()?`<p class="entry-clarification"><strong>Family note:</strong> ${escape(correction.note)}</p>`:"";
    const year=entry.date?.slice(0,4)||entry.period?.[0]||'';
    return `<article class="log-entry dated-context" data-year="${year}" id="context-${escape(entry.id)}">${entryHeading(entry)}<div class="entry-text">${text}</div>${note}${entryContext(entry,data)}</article>`;
   }).join('\n');
   return `<div class="transcription"${attrs} id="places-${escape(page.entries[0].id)}">${grouped}</div>`;
  });
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
