import { useState } from 'react';
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
function PlaceMap({ place }: { place: Place & { latitude: number; longitude: number } }) {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [retrieved, setRetrieved] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { latitude: lat, longitude: lon } = place;
  const box = [Math.max(-180, lon - .14), Math.max(-90, lat - .14), Math.min(180, lon + .14), Math.min(90, lat + .14)].join(',');
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
  return <><iframe className="map-frame" title={`Map of ${place.canonical_name || place.name}`} loading="lazy" referrerPolicy="no-referrer" src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(box)}&layer=mapnik&marker=${lat}%2C${lon}`} />
    <p className="subline">© OpenStreetMap contributors · {place.precision} · {place.source}</p>
    <div className="forecast-box"><p className="section-label">PRESENT-DAY FORECAST</p><p className="hint">This forecast describes the next three days here, not the weather on this trip. Loading it sends these coordinates to Open-Meteo.</p>
      <button className="add-record" disabled={busy} onClick={loadForecast}>{busy ? 'Loading forecast…' : forecast ? 'Refresh forecast' : 'Load current forecast ↗'}</button>
      <div role="status">{error && <p className="error">{error}</p>}{forecast && <><div className="forecast-days">{forecast.daily.time.map((date, i) => <div key={date}><strong>{date}</strong><p>{weatherName(forecast.daily.weather_code[i])}</p><p>{forecast.daily.temperature_2m_min[i]}–{forecast.daily.temperature_2m_max[i]} °F</p><small>Max wind {forecast.daily.wind_speed_10m_max[i]} kn</small></div>)}</div><p className="hint">Local dates · {forecast.timezone} · retrieved {retrieved}<br />Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a> (CC BY 4.0). Present-day forecast is not saved as archival evidence.</p></>}</div>
    </div>
  </>;
}
export function Atlas({ entries }: { entries: Entry[] }) {
  const places = entries.flatMap(entry => entry.places.map((place, index) => ({ ...place, entry, key: `${entry.id}-${index}` })));
  const located = places.filter((place): place is typeof place & { latitude: number; longitude: number } => place.latitude !== null && place.longitude !== null && Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
  return <section id="atlas"><p className="subline">Places mentioned in the journal. Markers show identified locations with their precision and source. Routes require evidence from the log.</p>
    {located.length > 0 ? <div className="atlas-grid">{located.map(place => <div className="map-card" key={place.key}><p className="eyebrow">{dateLabel(place.entry)} · {place.role}</p><h3>{place.canonical_name || place.name}</h3><PlaceMap place={place} /></div>)}</div>
      : <div className="empty"><h2>Places first. Routes when we know them.</h2><p>These pages name places, but their exact locations haven’t been confirmed. Edit an entry’s places to add coordinates, precision, and a source. A map appears here once a location is identified.</p></div>}
    <h2>Places awaiting identification</h2>
    {places.filter(place => place.latitude === null || place.longitude === null).map(place => <div className="map-card" key={place.key}><strong>{place.canonical_name || place.name}</strong><p className="subline">{place.entry.title} · {place.role} · {place.precision}</p></div>)}
    {!places.some(place => place.latitude === null || place.longitude === null) && <p className="subline">No unresolved places in this selection.</p>}
  </section>;
}
