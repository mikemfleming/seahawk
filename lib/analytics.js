import { AppError } from './archive.js';
import { familyArchive } from './contributions.js';
export function publicPage(path, archive) {
  if (path === '/' || path === '/atlas') return path;
  if (typeof path !== 'string' || !/^\/entries\/[A-Za-z0-9_-]{1,100}$/.test(path)) throw new AppError('Invalid page.', 400);
  if (!familyArchive(archive).entries.some(entry => `/entries/${entry.id}` === path)) throw new AppError('Page not found.', 404);
  return path;
}
export async function readTraffic(admin) {
  const since = new Date(); since.setUTCDate(since.getUTCDate() - 29);
  const { data, error } = await admin.from('page_view_daily').select('day,page,views').gte('day', since.toISOString().slice(0, 10)).order('day');
  if (error) throw new AppError('Could not load traffic.', 503);
  return { rows: data, timezone: 'UTC', days: 30 };
}
