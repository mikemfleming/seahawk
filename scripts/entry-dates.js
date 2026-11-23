import {validDate,chartWeek} from './context-data.js';
const DAY=86400000;
export function dateOverrideError(value){
 if(!value||typeof value!=='object')return 'Choose a valid entry date.';
 if(value.date===null&&value.end_date===null)return null;
 if(!validDate(value.date)||value.end_date!==null&&!validDate(value.end_date))return 'Choose a valid calendar date.';
 if(value.end_date&&(value.end_date<value.date||(Date.parse(value.end_date)-Date.parse(value.date))/DAY>365))return 'End date must follow the start date and be within one year.';
 return null;
}
export function latestDateCorrection(group,corrections){
 return group.passageIds.map(id=>corrections[id]).filter(record=>record?.date_override&&record.date_updated_at).sort((a,b)=>Date.parse(b.date_updated_at)-Date.parse(a.date_updated_at))[0]||null;
}
export function correctedEntryDate(group,corrections,data){
 const entry=group.entry||{id:group.id,date:null},saved=latestDateCorrection(group,corrections);
 if(!saved)return entry;
 if(dateOverrideError(saved.date_override))throw Error('Invalid saved entry date');
 const {date,end_date}=saved.date_override;
 const dates=date?Array.from({length:end_date?(Date.parse(end_date)-Date.parse(date))/DAY+1:1},(_,i)=>new Date(Date.parse(date)+i*DAY).toISOString().slice(0,10)):[];
 const reference=entry.weather_reference;
 const weather_keys=dates.map(day=>`${reference?.id||'unknown'}/${day}`);
 const chart_dates=[...new Set(dates.map(day=>chartWeek(day,Object.keys(data.charts||{}))).filter(Boolean))];
 return {...entry,date,end_date:end_date===date?null:end_date,dates,period:null,basis:'Date corrected by the family',weather_keys,weather_key:weather_keys[0]||null,weather_status:'unavailable',chart_dates,chart_date:chart_dates[0]||null};
}
