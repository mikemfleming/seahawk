// The stored timestamp is UTC; display an explicit timezone for both versions.
export function formatEntryUpdated(value){
 if(typeof value!=='string'||!value.trim())return null;
 const date=new Date(value);if(!Number.isFinite(date.getTime()))return null;
 return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/Chicago',timeZoneName:'short'}).format(date);
}
