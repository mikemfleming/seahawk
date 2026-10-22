import { AppError } from './archive.js';

export function createPlaceLookup({ fetchImpl = fetch } = {}) {
  return async query => {
    if (typeof query !== 'string' || query.trim().length < 2 || query.length > 200) throw new AppError('Enter a city and state, such as San Antonio, TX.');
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.search = new URLSearchParams({ name: query.trim(), count: '20', language: 'en', format: 'json' }).toString();
    let body;
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error();
      body = await response.json();
      if (body.error || (body.results !== undefined && !Array.isArray(body.results))) throw new Error();
    } catch { throw new AppError('Place lookup is unavailable. Try again or set the marker manually.', 502); }
    const city = query.split(',')[0].trim().toLocaleLowerCase();
    const exact = (body.results || []).filter(place => typeof place.name === 'string' && place.name.toLocaleLowerCase() === city);
    const candidates = exact.length ? exact : body.results || [];
    const matches = candidates.filter(place => typeof place.name === 'string' && Number.isFinite(place.latitude) && Number.isFinite(place.longitude) && Math.abs(place.latitude) <= 90 && Math.abs(place.longitude) <= 180).map(place => ({
      label: [...new Set([place.name, place.admin1, place.country].filter(value => typeof value === 'string' && value))].join(', '), latitude: place.latitude, longitude: place.longitude,
    }));
    return { matches: [...new Map(matches.map(place => [`${place.label}/${place.latitude}/${place.longitude}`, place])).values()], source: 'Open-Meteo / GeoNames' };
  };
}
