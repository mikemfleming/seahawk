import { useEffect, useId, useRef, useState } from 'react';
import { parseCoordinate, parseCoordinates } from '../coordinates';
import { api, errorMessage } from '../api';
import type { Place } from '../types';

const roles = ['Departure', 'Fishing area', 'Return', 'Stop', 'Purchase', 'Other'];
const precisions = ['Not mapped', 'General area', 'Specific location'];
const sources = ['Log', 'Crew confirmation', 'Other record'];
const normalize = (s: string) => s.trim().toLocaleLowerCase();

function Picker({ label, options, value, onSelect, multiple = false }: { label: string; options: string[]; value: string[]; onSelect: (value: string) => void; multiple?: boolean }) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const matches = options.filter(option => normalize(option).includes(normalize(query)) && (!multiple || !value.includes(option)));
  const canAdd = query.trim() && !options.some(option => normalize(option) === normalize(query));
  const choices = [...matches, ...(canAdd ? [query.trim()] : [])];
  function choose(option: string) { onSelect(option); setQuery(''); setOpen(false); setActive(0); }
  return <div className="place-picker" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label className="field" htmlFor={id}>{label}<input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-options`} aria-activedescendant={open && choices.length ? `${id}-option-${Math.min(active, choices.length - 1)}` : undefined} autoComplete="off" value={open ? query : multiple ? '' : value[0] || ''} placeholder={multiple ? 'Search or add a role…' : 'Search or add a place…'} onFocus={() => { setOpen(true); setQuery(''); setActive(0); }} onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true); }} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setActive(previous => Math.max(0, Math.min(choices.length - 1, previous + (event.key === 'ArrowDown' ? 1 : -1)))); }
      if (event.key === 'Enter') { event.preventDefault(); if (open && choices.length) choose(choices[Math.min(active, choices.length - 1)]); }
    }} /></label>
    {open && <ul id={`${id}-options`} className="picker-options" role="listbox" aria-label={label}>{choices.map((option, index) => <li id={`${id}-option-${index}`} key={option} role="option" aria-selected={index === active}><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}>{canAdd && index === choices.length - 1 ? `Add “${option}”` : option}</button></li>)}{!choices.length && <li role="presentation">No more matches.</li>}</ul>}
  </div>;
}

function PinMap({ place, onChange }: { place: Place; onChange: (place: Place) => void }) {
  const [zoom, setZoom] = useState(place.latitude === null ? 3 : 9);
  const [center, setCenter] = useState({ lat: place.latitude ?? 29, lon: place.longitude ?? -96 });
  const size = 256 * 2 ** zoom;
  const project = (lat: number, lon: number) => ({ x: (lon + 180) / 360 * size, y: (1 - Math.asinh(Math.tan(Math.max(-85, Math.min(85, lat)) * Math.PI / 180)) / Math.PI) / 2 * size });
  const unproject = (x: number, y: number) => ({ lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * Math.max(0, Math.min(size, y)) / size))) * 180 / Math.PI, lon: ((x / size * 360 + 180) % 360 + 360) % 360 - 180 });
  const c = project(center.lat, center.lon);
  const pin = place.latitude !== null && place.longitude !== null ? project(place.latitude, place.longitude) : null;
  function drop(lat: number, lon: number) { onChange({ ...place, geocoding_source: '', latitude: +lat.toFixed(6), longitude: +lon.toFixed(6), precision: place.precision === 'Not mapped' || place.precision === 'unlocated' ? 'General area' : place.precision }); }
  return <div className="pin-picker"><p className="hint">Click to place the marker. Use the arrows to move the map and + / − to zoom. A marker identifies a place, not a route.</p><div className="map-controls"><button type="button" aria-label="Move map west" onClick={() => setCenter(unproject(c.x - 150, c.y))}>←</button><button type="button" aria-label="Move map north" onClick={() => setCenter(unproject(c.x, c.y - 100))}>↑</button><button type="button" aria-label="Move map south" onClick={() => setCenter(unproject(c.x, c.y + 100))}>↓</button><button type="button" aria-label="Move map east" onClick={() => setCenter(unproject(c.x + 150, c.y))}>→</button><button type="button" aria-label="Zoom in" disabled={zoom === 18} onClick={() => setZoom(zoom + 1)}>+</button><button type="button" aria-label="Zoom out" disabled={zoom === 1} onClick={() => setZoom(zoom - 1)}>−</button><button type="button" onClick={() => drop(center.lat, center.lon)}>Pin map center</button>{pin && <button type="button" onClick={() => setCenter({ lat: place.latitude!, lon: place.longitude! })}>Find marker</button>}</div>
    <button type="button" className="pin-map" aria-label="Choose map location" onClick={event => { const box = event.currentTarget.getBoundingClientRect(); const point = unproject(c.x + event.clientX - box.left - box.width / 2, c.y + event.clientY - box.top - box.height / 2); drop(point.lat, point.lon); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); drop(center.lat, center.lon); } }}>
      {[-1, 0, 1].flatMap(dx => [-1, 0, 1].map(dy => { const x = Math.floor(c.x / 256) + dx, y = Math.floor(c.y / 256) + dy; return y < 0 || y >= 2 ** zoom ? null : <img key={`${zoom}-${x}-${y}`} alt="" draggable={false} src={`https://tile.openstreetmap.org/${zoom}/${((x % 2 ** zoom) + 2 ** zoom) % 2 ** zoom}/${y}.png`} style={{ left: `calc(50% + ${x * 256 - c.x}px)`, top: `calc(50% + ${y * 256 - c.y}px)` }} />; }))}
      {pin && <span className="map-pin" style={{ left: `calc(50% + ${pin.x - c.x}px)`, top: `calc(50% + ${pin.y - c.y}px)` }}>●</span>}
    </button><small>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></small><p className="hint" aria-live="polite">{pin ? `Marker: ${place.latitude}, ${place.longitude}` : 'No marker selected.'}</p></div>;
}

function CoordinateInputs({ place, onChange }: { place: Place; onChange: (place: Place) => void }) {
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState('');
  function applyPair() {
    try { onChange({ ...place, ...parseCoordinates(pasted), geocoding_source: '', precision: 'General area' }); setError(''); setPasted(''); }
    catch (error) { setError(errorMessage(error)); }
  }
  return <><label className="field">Paste coordinates<input value={pasted} onChange={event => setPasted(event.target.value)} placeholder="N 27° 51.900′ / W 097° 02.920′" onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); applyPair(); } }} /></label><button type="button" className="outlined" disabled={!pasted.trim()} onClick={applyPair}>Use coordinates</button><p className="hint">Accepts decimal degrees, degrees/minutes, or degrees/minutes/seconds. Paste the pair above, or paste each value into its field.</p>
    <div className="form-row">{(['latitude', 'longitude'] as const).map(axis => <label className="field" key={axis}>{axis === 'latitude' ? 'Latitude' : 'Longitude'}<input type="number" step="any" min={axis === 'latitude' ? -90 : -180} max={axis === 'latitude' ? 90 : 180} value={place[axis] ?? ''} onChange={event => { onChange({ ...place, [axis]: event.target.value === '' ? null : Number(event.target.value), geocoding_source: '' }); setError(''); }} onPaste={event => {
      event.preventDefault(); const text = event.clipboardData.getData('text');
      try {
        let update: Partial<Place>;
        try { update = parseCoordinates(text); } catch { update = { [axis]: parseCoordinate(text, axis) }; }
        onChange({ ...place, ...update, geocoding_source: '', precision: place.precision === 'Not mapped' || place.precision === 'unlocated' ? 'General area' : place.precision }); setError('');
      } catch (error) { setError(errorMessage(error)); }
    }} /></label>)}</div>{error && <p className="error" role="alert">{error}</p>}</>;
}

interface LocationMatch { label: string; latitude: number; longitude: number }
function CityLookup({ place, onChange }: { place: Place; onChange: (place: Place) => void }) {
  const [query, setQuery] = useState(place.canonical_name || place.name);
  const [matches, setMatches] = useState<LocationMatch[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const latest = useRef(place); latest.current = place;
  const version = useRef(0);
  useEffect(() => () => { version.current++; }, []);
  function apply(match: LocationMatch) {
    const current = latest.current;
    onChange({ ...current, canonical_name: match.label, latitude: match.latitude, longitude: match.longitude, precision: 'General area', geocoding_source: 'Open-Meteo / GeoNames' });
    setQuery(match.label); setMatches([]); setMessage('City coordinates filled in. Save the entry to keep them.');
  }
  async function lookup() {
    const request = ++version.current;
    setBusy(true); setMatches([]); setMessage('');
    try {
      const result = await api<{ matches: LocationMatch[] }>('/api/places/lookup', { query });
      if (request !== version.current) return;
      if (result.matches.length === 1) apply(result.matches[0]);
      else { setMatches(result.matches); setMessage(result.matches.length ? 'Choose the matching city.' : 'No matching city found. Try the full city and state name, or place the marker manually.'); }
    } catch (error) { if (request === version.current) setMessage(errorMessage(error)); }
    finally { if (request === version.current) setBusy(false); }
  }
  return <div className="city-lookup"><label className="field">City and state<input value={query} placeholder="San Antonio, TX" onChange={event => { version.current++; setBusy(false); setQuery(event.target.value); setMatches([]); setMessage(''); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (!busy && query.trim().length >= 2) void lookup(); } }} /></label><button type="button" className="outlined" disabled={busy || query.trim().length < 2} onClick={lookup}>{busy ? 'Finding city…' : 'Find coordinates'}</button><p className="hint" role="status">{message || 'City coordinates mark the general area. Refine the pin only if needed.'}</p>{matches.length > 0 && <ul className="city-matches">{matches.map(match => <li key={`${match.label}/${match.latitude}/${match.longitude}`}><button type="button" className="outlined" onClick={() => apply(match)}>{match.label}</button></li>)}</ul>}{place.geocoding_source && <p className="hint">Coordinates: {place.geocoding_source}</p>}</div>;
}

export function PlaceEditor({ place, places, onChange, onRemove }: { place: Place; places: Place[]; onChange: (place: Place) => void; onRemove: () => void }) {
  const [mappingOpen, setMappingOpen] = useState(false);
  const known = [...new Map(places.map(p => p.canonical_name || p.name).filter(Boolean).map(name => [normalize(name), name])).values()].sort((a,b) => a.localeCompare(b));
  const selectedRoles = place.roles || (place.role ? [roles.find(role => normalize(role) === normalize(place.role)) || place.role] : []);
  const knownRoles = [...new Set([...roles, ...places.flatMap(p => p.roles || (p.role ? [roles.find(role => normalize(role) === normalize(p.role)) || p.role] : []))])];
  const sourceChoice = place.source_type || (place.source === 'Handwritten log' ? 'Log' : '');
  const sourceNote = place.source_note ?? (place.source_type || place.source === 'Handwritten log' ? '' : place.source);
  function source(type: string, note: string) { onChange({ ...place, source_type: type, source_note: note, source: [type, note].filter(Boolean).join(' · ') }); }
  return <div className="place-row record-row"><div className="record-head"><strong>Place</strong><button type="button" className="remove-record" onClick={onRemove}>Remove</button></div>
    <Picker label="Place" options={known} value={[place.canonical_name || place.name]} onSelect={value => {
      const canonical = known.find(name => normalize(name) === normalize(value)) || value;
      const same = normalize(canonical) === normalize(place.canonical_name || place.name);
      const saved = places.find(other => normalize(other.canonical_name || other.name) === normalize(canonical) && other.latitude !== null && other.longitude !== null);
      onChange({ ...place, canonical_name: canonical, name: place.name || value, ...(!same ? { latitude: saved?.latitude ?? null, longitude: saved?.longitude ?? null, precision: saved?.precision || 'Not mapped', geocoding_source: saved?.geocoding_source || '' } : {}) });
    }} />
    <details className="place-original"><summary>Name as written{place.name ? `: ${place.name}` : ''}</summary><label className="field">Name as written<input value={place.name} onChange={event => onChange({ ...place, name: event.target.value })} /></label><p className="hint">Preserved separately from the place selected above.</p></details>
    <Picker label="Role" options={knownRoles} value={selectedRoles} multiple onSelect={value => { const next = [...selectedRoles, value]; onChange({ ...place, roles: next, role: next.join(' · ') }); }} />
    <div className="selected-roles" aria-label="Selected roles">{selectedRoles.map(role => <button type="button" className="chip" key={role} aria-label={`Remove role ${role}`} onClick={() => { const next = selectedRoles.filter(value => value !== role); onChange({ ...place, roles: next, role: next.join(' · ') }); }}>{role} ×</button>)}</div>
    <details className="place-mapping" onToggle={event => setMappingOpen(event.currentTarget.open)}><summary>Map location (optional){place.latitude !== null ? ' · Marker set' : ''}</summary>
      {mappingOpen && <CityLookup key={place.canonical_name || place.name} place={place} onChange={onChange} />}
      <label className="field">Location precision<select value={place.precision} onChange={event => onChange({ ...place, precision: event.target.value, ...(event.target.value === 'Not mapped' ? { latitude: null, longitude: null } : {}) })}>{!precisions.includes(place.precision) && <option value={place.precision}>{place.precision || 'Choose precision' } (existing)</option>}{precisions.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="field">Identification source<select value={sourceChoice} onChange={event => { source(event.target.value, sourceNote); }}><option value="">Choose a source</option>{sources.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="field">Source note (optional)<input value={sourceNote} onChange={event => source(sourceChoice, event.target.value)} placeholder="e.g. Confirmed by Captain Eddie" /></label>
      {mappingOpen && <PinMap key={`${place.latitude}/${place.longitude}`} place={place} onChange={onChange} />}
      <details><summary>Advanced: coordinates</summary><CoordinateInputs place={place} onChange={onChange} /></details>
      {place.latitude !== null && <button type="button" className="quiet" onClick={() => onChange({ ...place, latitude: null, longitude: null, precision: 'Not mapped' })}>Remove marker</button>}
    </details>
  </div>;
}
