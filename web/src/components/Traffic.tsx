import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api';
import { Link } from '../navigation';
import type { Entry } from '../types';
type TrafficData = { rows: { day: string; page: string; views: number }[] };
export function Traffic({ entries }: { entries: Entry[] }) {
  const [data, setData] = useState<TrafficData | null>(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    api<TrafficData>('/api/analytics', undefined, controller.signal).then(setData).catch(error => { if (!controller.signal.aborted) setError(errorMessage(error)); });
    return () => controller.abort();
  }, [version]);
  const byPage = new Map<string, number>();
  const byDay = new Map<string, number>();
  for (const row of data?.rows || []) { byPage.set(row.page, (byPage.get(row.page) || 0) + Number(row.views)); byDay.set(row.day, (byDay.get(row.day) || 0) + Number(row.views)); }
  const days = Array.from({ length: 30 }, (_, i) => { const day = new Date(); day.setUTCDate(day.getUTCDate() - i); return day.toISOString().slice(0, 10); });
  const label = (page: string) => page === '/' ? 'The journal' : page === '/atlas' ? 'The atlas' : entries.find(entry => page === `/entries/${entry.id}`)?.title || 'Removed entry';
  return <section className="traffic"><h2>Page visits</h2><p>Last 30 days · UTC · {Array.from(byDay.values()).reduce((sum, count) => sum + count, 0)} page views</p><p className="subline">Counts public journal, atlas and entry views, including repeat visits. These are page views, not unique people. No visitor identities, IP addresses or browsing histories are stored. Tracking starts with this release; blocked or failed requests may be missed.</p><button onClick={() => setVersion(value => value + 1)}>Refresh traffic</button>{error && <p role="alert">{error}</p>}{!data && !error ? <p role="status">Loading traffic…</p> : data && <><h3>Popular pages</h3>{!byPage.size ? <p>No page visits recorded yet.</p> : <table><thead><tr><th>Page</th><th>Views</th></tr></thead><tbody>{[...byPage].sort((a, b) => b[1] - a[1]).map(([page, views]) => <tr key={page}><td><Link to={page}>{label(page)}</Link></td><td>{views}</td></tr>)}</tbody></table>}<details><summary>Daily page views</summary><table><thead><tr><th>Date (UTC)</th><th>Views</th></tr></thead><tbody>{days.map(day => <tr key={day}><td>{new Date(day + 'T00:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })}</td><td>{byDay.get(day) || 0}</td></tr>)}</tbody></table></details></>}</section>;
}
