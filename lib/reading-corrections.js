// Exact, non-cascading replacements. Confirmed values never become model instructions.
export function validateCorrections(corrections = []) {
  if (!Array.isArray(corrections) || corrections.length > 100) throw new Error('Use up to 100 confirmed corrections.');
  const seen = new Set();
  for (const correction of corrections) {
    if (!correction || typeof correction.as_written !== 'string' || !correction.as_written.trim() || correction.as_written.length > 1000 || typeof correction.corrected !== 'string' || !correction.corrected.trim() || correction.corrected.length > 1000) throw new Error('Each correction needs the exact original text and a confirmed replacement (up to 1,000 characters each).');
    if (seen.has(correction.as_written)) throw new Error('Use only one correction for each original phrase.');
    seen.add(correction.as_written);
  }
}

export function prepareCorrections(transcription, corrections = []) {
  validateCorrections(corrections);
  for (const correction of corrections) if (!transcription.includes(correction.as_written)) throw new Error(`Correction not found in the transcription: ${correction.as_written}`);
  let prefix = 'ARCHIVE_CONFIRMED_';
  while (transcription.includes(prefix) || corrections.some(correction => correction.corrected.includes(prefix))) prefix += 'X';
  const items = [...corrections].sort((a, b) => b.as_written.length - a.as_written.length).map((correction, index) => ({ ...correction, token: `${prefix}${index}_TOKEN` }));
  const used = new Set();
  // Match against the original input once so replacements cannot cascade.
  const pattern = items.length ? new RegExp(items.map(item => item.as_written.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g') : null;
  const text = pattern ? transcription.replace(pattern, match => { const item = items.find(item => item.as_written === match); used.add(item.token); return item.token; }) : transcription;
  if (used.size !== items.length) throw new Error('Confirmed corrections overlap. Use one correction for the complete phrase.');
  return {
    text,
    finish(reading) {
      for (const item of items) {
        const expected = text.split(item.token).length - 1;
        if (reading.split(item.token).length - 1 !== expected) throw new Error('A confirmed correction was lost in generation.');
      }
      if (!items.length) return reading;
      const tokenPattern = new RegExp(`${prefix}\\d+_TOKEN`, 'g');
      return reading.replace(tokenPattern, token => {
        const item = items.find(item => item.token === token);
        if (!item) throw new Error('Unknown correction marker.');
        return item.corrected;
      });
    },
  };
}
