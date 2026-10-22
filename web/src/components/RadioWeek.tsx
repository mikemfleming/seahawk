import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api';
import { dateLabel, type Entry } from '../types';

interface RadioChart {
  status: 'available' | 'before_hot_100' | 'no_chart';
  chart_date?: string;
  chart_url?: string;
  source_url?: string;
  songs: { rank: number; title: string; artist: string }[];
}
function validDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function RadioWeek({ entry }: { entry: Pick<Entry, 'date' | 'date_certainty'> }) {
  const [chart, setChart] = useState<RadioChart | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const hasDate = validDate(entry.date);
  useEffect(() => {
    setChart(null); setError('');
    if (!hasDate) return;
    const controller = new AbortController();
    api<RadioChart>(`/api/radio?${new URLSearchParams({ date: entry.date })}`, undefined, controller.signal)
      .then(result => { if (!controller.signal.aborted) setChart(result); })
      .catch(error => { if (!controller.signal.aborted) setError(errorMessage(error)); });
    return () => controller.abort();
  }, [entry.date, hasDate, attempt]);
  return <div className="fact radio-week"><h3>WHAT WAS ON THE RADIO AT THE TIME</h3>
    {!hasDate ? <p>Add a complete entry date to see that week’s Billboard top five.</p> : <>
      <div aria-live="polite">{error ? <><p className="hint">{error}</p><button className="text-action" onClick={() => setAttempt(value => value + 1)}>Try again</button></> : !chart ? <p className="subline">Loading that week’s songs…</p> : chart.status === 'before_hot_100' ? <p className="subline">The Billboard Hot 100 began August 4, 1958. No Hot 100 chart is available for this date.</p> : chart.status === 'no_chart' ? <p className="subline">No chart is available for this week.</p> : <>
        <p className="subline">Billboard Hot 100 · Week ending {dateLabel({ date: chart.chart_date!, date_as_written: '' })}</p>
        <ol className="radio-songs">{chart.songs.map(song => <li key={song.rank}>{song.title} - {song.artist}</li>)}</ol>
        <p className="hint"><a href={chart.chart_url} target="_blank" rel="noopener noreferrer">View Billboard chart ↗</a> · <a href={chart.source_url} target="_blank" rel="noopener noreferrer">Chart data archive</a></p>
      </>}</div>
    </>}
  </div>;
}
