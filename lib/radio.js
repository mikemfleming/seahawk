import { AppError } from './archive.js';

const ARCHIVE = 'https://raw.githubusercontent.com/mhollingshead/billboard-hot-100/main';
const DAY = 86400000;
export function validRadioDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

// Match the chart dated at the end of the entry's week, without assuming every
// historical chart was dated on Saturday. Never substitute a distant week.
export function chartWeek(date, dates) {
  return dates.filter(day => day >= date && Date.parse(day) - Date.parse(date) < 7 * DAY).sort()[0] || null;
}

export function createRadioLookup({ fetchImpl = fetch, now = Date.now } = {}) {
  let dateIndex;
  let indexExpires = 0;
  const charts = new Map();
  async function json(url) {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Chart archive unavailable');
    return response.json();
  }
  async function dates() {
    if (!dateIndex || now() >= indexExpires) {
      indexExpires = now() + DAY;
      dateIndex = json(`${ARCHIVE}/valid_dates.json`).then(value => {
        if (!Array.isArray(value) || !value.length || !value.every(validRadioDate)) throw new Error('Invalid chart index');
        return value;
      }).catch(error => { dateIndex = undefined; throw error; });
    }
    return dateIndex;
  }
  return async date => {
    if (!validRadioDate(date)) throw new AppError('Use a complete, valid YYYY-MM-DD entry date.');
    if (date < '1958-08-04') return { status: 'before_hot_100', songs: [] };
    if (Date.parse(date) > now()) return { status: 'no_chart', songs: [] };
    try {
      const week = chartWeek(date, await dates());
      if (!week) return { status: 'no_chart', songs: [] };
      if (!charts.has(week)) {
        if (charts.size >= 128) charts.delete(charts.keys().next().value);
        const pending = json(`${ARCHIVE}/date/${week}.json`).then(chart => {
          if (chart.date !== week || !Array.isArray(chart.data)) throw new Error('Invalid chart');
          const songs = chart.data.filter(item => Number.isInteger(item.this_week) && item.this_week >= 1 && item.this_week <= 5).sort((a, b) => a.this_week - b.this_week);
          if (songs.length !== 5 || songs.some((item, index) => item.this_week !== index + 1 || typeof item.song !== 'string' || !item.song.trim() || item.song.length > 500 || typeof item.artist !== 'string' || !item.artist.trim() || item.artist.length > 500)) throw new Error('Incomplete top five');
          return { status: 'available', chart_date: week, songs: songs.map(item => ({ rank: item.this_week, title: item.song, artist: item.artist })), chart_url: `https://www.billboard.com/charts/hot-100/${week}/`, source_url: 'https://github.com/mhollingshead/billboard-hot-100' };
        }).catch(error => { charts.delete(week); throw error; });
        charts.set(week, pending);
      }
      return await charts.get(week);
    } catch { throw new AppError('The weekly chart is unavailable right now. Try again shortly.', 502); }
  };
}
