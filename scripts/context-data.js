const DAY = 86400000;
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}
const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
export function headingParts(written) {
  const text = (written || '').trim().replace(/[“”"]/g,'');
  let match = /^(\d{1,2})\/(\d{1,2})(?:\/([^\s,]+))?/.exec(text);
  let month,day,yearText;
  if(match) { month=Number(match[1]);day=Number(match[2]);yearText=match[3]; }
  else {
    match = /(?:^|,\s*)(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*[,\s]\s*(\d{4}|\d{2})(?![\d:]))?/i.exec(text);
    if(!match) return null;
    month=months.indexOf(match[1].slice(0,3).toLowerCase())+1;day=Number(match[2]);yearText=match[3];
    // Multiple-day headings need more evidence than a single date can express.
    if(/\d(?:st|nd|rd|th)?\s*[-–—]\s*\d/.test(text) || /,\s*\d{1,2}(?:st|nd|rd|th)?\s*,/.test(text)) return null;
  }
  if(month<1||month>12||day<1||day>31)return null;
  if(yearText && !/^\d{2}$|^\d{4}$/.test(yearText))return {month,day,ambiguous:true};
  const n=yearText?Number(yearText):null;
  const year=n===null?null:n<100?(n<=20?2000+n:1900+n):n;
  return {month,day,year,ambiguous:year!==null&&(year<1994||year>2004)};
}
export function resolveEntryDates(entries) {
  const years=new Set(entries.flatMap(entry=>{const p=headingParts(entry.date_as_written);return p?.year&&!p.ambiguous?[p.year]:entry.status==='checked'&&validDate(entry.date)?[Number(entry.date.slice(0,4))]:[];}));
  return entries.map(entry=>{
    if(entry.status==='checked'&&validDate(entry.date))return {date:entry.date,basis:entry.date_certainty==='certain'?'Reviewed date':'Year interpreted in the reviewed entry'};
    const parts=headingParts(entry.date_as_written);
    if(!parts||parts.ambiguous)return {date:null,basis:parts?.ambiguous?'Transcribed year conflicts with the logbook period':'Complete entry date not established'};
    const year=parts.year || (years.size===1?[...years][0]:null);
    if(!year)return {date:null,basis:'Entry year not established'};
    const date=`${year}-${String(parts.month).padStart(2,'0')}-${String(parts.day).padStart(2,'0')}`;
    return validDate(date)?{date,basis:parts.year?'Date as transcribed':'Year inferred from another dated entry on the same page'}:{date:null,basis:'Transcribed date is not a valid calendar day'};
  });
}
// The whole book is resolved in photographed order. Reviewed year transitions
// prevent a small out-of-order day or a transcription error from inventing a year.
export function resolveBookDates(entries, chronology) {
 let year=null,month=null;
 return entries.map(entry=>{
  if(chronology.year_starts[entry.id])year=chronology.year_starts[entry.id];
  const heading=chronology.headings[entry.id]??entry.date_as_written;
  if(chronology.month_only?.[entry.id])return {date:null,dates:[],period:chronology.month_only[entry.id],basis:'Month and year established; no day recorded'};
  const range=chronology.ranges?.[entry.id];
  // An unreadable year is resolved from the sequence; month/day must still exist.
  const parts=range?{month:range[0],day:range[1]}:headingParts(heading);
  if(!parts||!year)return {date:null,dates:[],basis:'No calendar day recorded'};
  month=parts.month;
  const date=`${year}-${String(month).padStart(2,'0')}-${String(parts.day).padStart(2,'0')}`;
  if(!validDate(date))return {date:null,dates:[],basis:'Calendar day remains uncertain'};
  const dates=range?Array.from({length:range[2]-range[1]+1},(_,i)=>`${year}-${String(month).padStart(2,'0')}-${String(range[1]+i).padStart(2,'0')}`):[date];
  return {date,dates,end_date:dates.at(-1)!==date?dates.at(-1):null,basis:chronology.headings[entry.id]?'Date interpreted from photograph and book chronology':parts.year===year&&!parts.ambiguous?'Date as transcribed':'Year inferred from chronological entries',resolved_heading:heading};
 });
}
export function weatherBase(entryId, afterTransition) {
 return afterTransition ? {id:'kona',name:'Kona, Hawaii',latitude:19.64016,longitude:-155.99907,kind:'home-port',precision:'Home port supplied by the owner',region:'Hawaii'} : {id:'port-aransas',name:'Port Aransas, Texas',latitude:27.83392,longitude:-97.0611,kind:'home-port',precision:'Home port supplied by the owner',region:'Texas'};
}
export function chartWeek(date, dates) {
  if(!validDate(date))return null;
  return dates.filter(day=>validDate(day)&&day>=date&&Date.parse(day)-Date.parse(date)<7*DAY).sort()[0]||null;
}
export function topTen(chart, week) {
  if(chart?.date!==week||!Array.isArray(chart.data))throw Error('Chart date mismatch');
  const songs=chart.data.filter(item=>Number.isInteger(item.this_week)&&item.this_week>=1&&item.this_week<=10).sort((a,b)=>a.this_week-b.this_week);
  if(songs.length!==10||songs.some((song,index)=>song.this_week!==index+1||typeof song.song!=='string'||!song.song.trim()||typeof song.artist!=='string'||!song.artist.trim()))throw Error('Incomplete weekly top 10');
  return songs.map(song=>({rank:song.this_week,title:song.song,artist:song.artist}));
}
export function explicitCoordinates(text, region) {
  const lat=/\bN\s*(\d{1,2})[°º]\s*(\d{1,2}\.\d+)/i.exec(text);
  const lon=/\bW\s*(\d{2,3})[°º]\s*(\d{1,2}\.\d+)/i.exec(text);
  if(!lat||!lon||Number(lat[2])>=60||Number(lon[2])>=60)return null;
  const latitude=Number(lat[1])+Number(lat[2])/60, longitude=-(Number(lon[1])+Number(lon[2])/60);
  if(region==='Texas'&&!(latitude>=24&&latitude<=31&&longitude>=-100&&longitude<=-90))return null;
  if(region==='Hawaii'&&!(latitude>=18&&latitude<=23&&longitude>=-162&&longitude<=-153))return null;
  return {id:`coordinate-${latitude.toFixed(5)}-${longitude.toFixed(5)}`,name:'Coordinates written in the entry',latitude,longitude,precision:'As transcribed; verify against the original',source:'Logbook coordinates',kind:'explicit'};
}
export function weatherRecord(response, date, requested) {
  if(response?.daily_units?.temperature_2m_max!=='°F'||response?.daily_units?.temperature_2m_min!=='°F'||response?.daily_units?.precipitation_sum!=='inch'||response?.daily_units?.wind_speed_10m_max!=='kn')throw Error('Unexpected historical weather units');
  const index=response?.daily?.time?.indexOf(date);
  if(!Number.isInteger(index)||index<0)throw Error('Weather date missing');
  const values={};
  for(const field of ['temperature_2m_max','temperature_2m_min','precipitation_sum','wind_speed_10m_max','wind_gusts_10m_max','wind_direction_10m_dominant','weather_code']) {
    const value=response.daily[field]?.[index];values[field]=typeof value==='number'&&Number.isFinite(value)?value:null;
  }
  if(!Object.values(values).some(value=>value!==null))throw Error('No historical weather values');
  return {date,...values,grid_latitude:response.latitude,grid_longitude:response.longitude,timezone:response.timezone,reference:requested.name,reference_kind:requested.kind,source:'Open-Meteo / ERA5',resolution:'Approximately 25 km reanalysis grid'};
}
