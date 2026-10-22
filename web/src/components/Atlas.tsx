import { useEffect, useRef, useState } from 'react';
import { Link } from '../navigation';
import { Modal } from './Modal';
import { errorMessage } from '../api';
import { dateLabel, type Entry, type Place } from '../types';

interface Forecast {
  timezone: string;
  daily: { time: string[]; weather_code: number[]; temperature_2m_min: number[]; temperature_2m_max: number[]; wind_speed_10m_max: number[] };
}
function weatherName(code: number) {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly cloudy / overcast';
  if (code <= 48) return 'Fog';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  return 'Thunderstorms';
}
function PlaceForecast({ place }: { place: Place & { latitude: number; longitude: number } }) {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [retrieved, setRetrieved] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { latitude: lat, longitude: lon } = place;
  async function loadForecast() {
    setBusy(true); setError('');
    try {
      const params = new URLSearchParams({ latitude: String(lat), longitude: String(lon), daily: 'weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max', temperature_unit: 'fahrenheit', wind_speed_unit: 'kn', timezone: 'auto', forecast_days: '3' });
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Forecast unavailable. Check your connection and try again.');
      const result: Forecast = await response.json();
      if (!Array.isArray(result.daily?.time) || !Array.isArray(result.daily.weather_code) || !Array.isArray(result.daily.temperature_2m_min) || !Array.isArray(result.daily.temperature_2m_max) || !Array.isArray(result.daily.wind_speed_10m_max)) throw new Error('Forecast unavailable. Try again later.');
      setForecast(result); setRetrieved(new Date().toLocaleString());
    } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
  }
  return <>
    <div className="forecast-box"><p className="section-label">PRESENT-DAY FORECAST</p><p className="hint">This forecast describes the next three days here, not the weather on this trip. Loading it sends these coordinates to Open-Meteo.</p>
      <button className="add-record" disabled={busy} onClick={loadForecast}>{busy ? 'Loading forecast…' : forecast ? 'Refresh forecast' : 'Load current forecast ↗'}</button>
      <div role="status">{error && <p className="error">{error}</p>}{forecast && <><div className="forecast-days">{forecast.daily.time.map((date, i) => <div key={date}><strong>{date}</strong><p>{weatherName(forecast.daily.weather_code[i])}</p><p>{forecast.daily.temperature_2m_min[i]}–{forecast.daily.temperature_2m_max[i]} °F</p><small>Max wind {forecast.daily.wind_speed_10m_max[i]} kn</small></div>)}</div><p className="hint">Local dates · {forecast.timezone} · retrieved {retrieved}<br />Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a> (CC BY 4.0). Present-day forecast is not saved as archival evidence.</p></>}</div>
    </div>
  </>;
}
interface MappedPlace {
  key: string;
  name: string;
  latitude: number;
  longitude: number;
  mentions: { entry: Entry; place: Place }[];
}
const project = (latitude: number, longitude: number) => ({
  x: (longitude + 180) / 360,
  y: (1 - Math.asinh(Math.tan(Math.max(-85.0511, Math.min(85.0511, latitude)) * Math.PI / 180)) / Math.PI) / 2,
});

function JournalMap({ places, onSelect }: { places: MappedPlace[]; onSelect: (place: MappedPlace) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 500 });
  const [view, setView] = useState<{ x: number; y: number; zoom: number } | null>(null);
  const drag = useRef<{ x: number; y: number; center: { x: number; y: number } } | null>(null);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, []);
  const points = places.map(place => ({ ...project(place.latitude, place.longitude), place }));
  // Cut the world at the largest gap so places across the date line remain together.
  const xs = points.map(point => point.x).sort((a, b) => a - b);
  let gap = -1, start = xs[0];
  xs.forEach((x, i) => { const next = xs[(i + 1) % xs.length] + (i === xs.length - 1 ? 1 : 0); if (next - x > gap) { gap = next - x; start = next % 1; } });
  const wrapped = points.map(point => ({ ...point, x: point.x < start ? point.x + 1 : point.x }));
  const minX = Math.min(...wrapped.map(p => p.x)), maxX = Math.max(...wrapped.map(p => p.x));
  const minY = Math.min(...wrapped.map(p => p.y)), maxY = Math.max(...wrapped.map(p => p.y));
  const fitZoom = Math.max(1, Math.min(12, Math.floor(Math.log2(Math.min((size.width - 100) / (256 * Math.max(maxX - minX, .00001)), (size.height - 100) / (256 * Math.max(maxY - minY, .00001)))))));
  const current = view || { x: (minX + maxX) / 2, y: (minY + maxY) / 2, zoom: fitZoom };
  const scale = 256 * 2 ** current.zoom;
  const left = current.x * scale - size.width / 2, top = current.y * scale - size.height / 2;
  const tiles = [];
  for (let x = Math.floor(left / 256); x <= Math.floor((left + size.width) / 256); x++) {
    for (let y = Math.max(0, Math.floor(top / 256)); y <= Math.min(2 ** current.zoom - 1, Math.floor((top + size.height) / 256)); y++) {
      tiles.push(<img key={`${current.zoom}/${x}/${y}`} alt="" draggable={false} src={`https://tile.openstreetmap.org/${current.zoom}/${((x % 2 ** current.zoom) + 2 ** current.zoom) % 2 ** current.zoom}/${y}.png`} style={{ left: x * 256 - left, top: y * 256 - top }} />);
    }
  }
  function move(dx: number, dy: number) { setView({ ...current, x: current.x + dx / scale, y: Math.max(0, Math.min(1, current.y + dy / scale)) }); }
  return <div className="atlas-map-shell">
    <div className="atlas-map-controls"><button aria-label="Zoom in" disabled={current.zoom >= 18} onClick={() => setView({ ...current, zoom: current.zoom + 1 })}>+</button><button aria-label="Zoom out" disabled={current.zoom <= 1} onClick={() => setView({ ...current, zoom: current.zoom - 1 })}>−</button><button onClick={() => setView(null)}>Show all places</button></div>
    <div ref={ref} className="atlas-map" role="region" aria-label="Journal locations map. Use arrow keys to pan." tabIndex={0}
      onKeyDown={event => { if (event.target !== event.currentTarget) return; const delta = { ArrowLeft: [-100, 0], ArrowRight: [100, 0], ArrowUp: [0, -100], ArrowDown: [0, 100] }[event.key]; if (delta) { event.preventDefault(); move(delta[0], delta[1]); } }}
      onPointerDown={event => { if ((event.target as HTMLElement).closest('button')) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, center: current }; }}
      onPointerMove={event => { if (!drag.current) return; setView({ ...current, x: drag.current.center.x - (event.clientX - drag.current.x) / scale, y: Math.max(0, Math.min(1, drag.current.center.y - (event.clientY - drag.current.y) / scale)) }); }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      {tiles}
      {points.map(point => { const x = point.x + Math.round(current.x - point.x); return <button key={point.place.key} className="atlas-marker" aria-label={`Explore ${point.place.name}`} title={point.place.name} style={{ left: x * scale - left, top: point.y * scale - top }} onClick={() => onSelect(point.place)}><span aria-hidden="true">●</span></button>; })}
    </div>
    <p className="atlas-attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></p>
  </div>;
}

export function Atlas({ entries }: { entries: Entry[] }) {
  const [selected, setSelected] = useState<MappedPlace | null>(null);
  const places = entries.flatMap(entry => entry.places.map((place, index) => ({ place, entry, key: `${entry.id}-${index}` })));
  const grouped = new Map<string, MappedPlace>();
  for (const { place, entry } of places) {
    if (place.latitude === null || place.longitude === null || !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) continue;
    const name = place.canonical_name || place.name;
    const key = JSON.stringify([name.trim().toLowerCase(), place.latitude, place.longitude]);
    const existing = grouped.get(key);
    if (existing) existing.mentions.push({ entry, place });
    else grouped.set(key, { key, name, latitude: place.latitude, longitude: place.longitude, mentions: [{ entry, place }] });
  }
  const located = [...grouped.values()];
  const unresolved = places.filter(({ place }) => place.latitude === null || place.longitude === null);
  return <section id="atlas"><p className="subline">Explore the places in the journal. Select a pin to learn about a location and find its entries.</p>
    {located.length > 0 ? <><JournalMap places={located} onSelect={setSelected} /><p className="hint">{located.length} mapped {located.length === 1 ? 'location' : 'locations'} · Drag to explore, or focus the map and use the arrow keys.</p></>
      : <div className="empty"><h2>Places first. Routes when we know them.</h2><p>These pages name places, but their exact locations haven’t been confirmed. Edit an entry’s places to add coordinates, precision, and a source. A map appears here once a location is identified.</p></div>}
    {selected && <Modal id="atlas-place" titleId="atlas-place-title" onClose={() => setSelected(null)}><div className="atlas-place-heading"><p className="eyebrow">A PLACE IN THE LOG</p><button className="quiet" onClick={() => setSelected(null)} aria-label="Close place details">Close ×</button></div><h2 id="atlas-place-title">{selected.name}</h2><p className="subline">{new Set(selected.mentions.map(m => m.entry.id)).size} journal entries · {selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}</p><Link className="primary" to={`/?${new URLSearchParams({ q: selected.name })}`}>Find this place in the journal →</Link>
      <ul className="atlas-place-mentions">{selected.mentions.map(({ entry, place }, i) => <li key={`${entry.id}-${i}`}><strong>{entry.title}</strong><p className="subline">{dateLabel(entry)}{place.role && ` · ${place.role}`}</p><p className="hint">{[place.precision, place.source].filter(Boolean).join(' · ')}</p></li>)}</ul><PlaceForecast key={selected.key} place={{ ...selected.mentions[0].place, latitude: selected.latitude, longitude: selected.longitude }} /></Modal>}
    <h2>Places awaiting identification</h2>
    {unresolved.map(({ place, entry, key }) => <div className="map-card" key={key}><Link to={`/?${new URLSearchParams({ q: place.canonical_name || place.name })}`}><strong>{place.canonical_name || place.name}</strong></Link><p className="subline">{entry.title} · {place.role} · {place.precision}</p></div>)}
    {!unresolved.length && <p className="subline">No unresolved places in this selection.</p>}
  </section>;
}
