/** Convert decimal degrees, degrees/minutes, or degrees/minutes/seconds. */
export function parseCoordinate(input: string, axis: 'latitude' | 'longitude'): number {
  const text = input.trim().toUpperCase().replace(/[º˚]/g, '°').replace(/[′’‘]/g, "'").replace(/[″“”]/g, '"').replace(/−/g, '-');
  const match = /^([NSEW])?\s*([+-]?\d+(?:\.\d+)?)\s*°?\s*(?:(\d+(?:\.\d+)?)\s*'\s*)?(?:(\d+(?:\.\d+)?)\s*"\s*)?([NSEW])?$/.exec(text);
  if (!match || (match[1] && match[5])) throw new Error('Use decimal degrees or degrees and minutes with N, S, E, or W.');
  const hemisphere = match[1] || match[5];
  if (hemisphere && !(axis === 'latitude' ? 'NS' : 'EW').includes(hemisphere)) throw new Error(`Use ${axis === 'latitude' ? 'N or S for latitude' : 'E or W for longitude'}.`);
  const degrees = Number(match[2]), minutes = Number(match[3] || 0), seconds = Number(match[4] || 0);
  if (minutes >= 60 || seconds >= 60 || (match[4] && !match[3]) || ((match[3] || match[4]) && !Number.isInteger(degrees))) throw new Error('Minutes and seconds must be below 60; use whole degrees with minutes.');
  if ((match[2].startsWith('-') && hemisphere && 'NE'.includes(hemisphere)) || (match[2].startsWith('+') && hemisphere && 'SW'.includes(hemisphere))) throw new Error('The sign and compass direction disagree.');
  const sign = hemisphere ? ('SW'.includes(hemisphere) ? -1 : 1) : match[2].startsWith('-') ? -1 : 1;
  const value = sign * (Math.abs(degrees) + minutes / 60 + seconds / 3600);
  if (Math.abs(value) > (axis === 'latitude' ? 90 : 180)) throw new Error(`${axis === 'latitude' ? 'Latitude' : 'Longitude'} is out of range.`);
  return Number(value.toFixed(8));
}

export function parseCoordinates(input: string): { latitude: number; longitude: number } {
  let text = input.trim().replace(/^lat\s*\/\s*lon\s*:\s*/i, '');
  let parts = text.split(/\s*[,/;\n]\s*/);
  if (parts.length === 1) {
    text = text.replace(/\s+(?=[EW]\s*[+-]?\d)/i, '|').replace(/(?<=[0-9°'′"″])\s*([NS])\s+(?=[+-]?\d)/i, '$1|');
    parts = text.split('|');
  }
  if (parts.length === 1 && /^[+-]?\d+(?:\.\d+)?\s+[+-]?\d+(?:\.\d+)?$/.test(text)) parts = text.split(/\s+/);
  if (parts.length !== 2) throw new Error('Paste both coordinates, latitude first, separated by a comma or slash.');
  return { latitude: parseCoordinate(parts[0], 'latitude'), longitude: parseCoordinate(parts[1], 'longitude') };
}
