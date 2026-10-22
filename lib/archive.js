import { Buffer } from 'node:buffer';
import { validateCorrections } from './reading-corrections.js';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}

export const FIELDS = [
  'title', 'date_as_written', 'date', 'date_certainty', 'transcription',
  'reading_version', 'editorial_notes', 'status', 'people', 'places',
  'uncertainties', 'weather', 'visibility', 'reading_version_status', 'reading_corrections',
];
const now = () => new Date().toISOString();
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateEntry(entry) {
  if (!object(entry)) throw new AppError('Each entry must be an object.');
  try { validateCorrections(entry.reading_corrections); } catch (error) { throw new AppError(error.message); }
  for (const field of FIELDS.slice(0, 8)) {
    if (typeof entry[field] !== 'string') throw new AppError(`${field} must be text.`);
  }
  if (!entry.title.trim() || !entry.transcription.trim()) {
    throw new AppError('Title and transcription are required.');
  }
  if (!['first_pass', 'checked', 'ready_to_share'].includes(entry.status)) {
    throw new AppError('Unknown review status.');
  }
  if (!['unknown', 'inferred', 'probable', 'certain'].includes(entry.date_certainty)) {
    throw new AppError('Unknown date certainty.');
  }
  if (entry.date) {
    const date = new Date(`${entry.date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== entry.date) {
      throw new AppError('Use a real YYYY-MM-DD date or leave it empty.');
    }
  }
  for (const field of ['people', 'places', 'uncertainties', 'weather']) {
    if (!Array.isArray(entry[field])) throw new AppError(`${field} must be a list.`);
  }
  for (const field of ['people', 'uncertainties']) {
    if (!entry[field].every(value => typeof value === 'string')) {
      throw new AppError(`${field} must contain text.`);
    }
  }
  for (const place of entry.places) {
    if (!object(place) || !['name', 'role', 'precision', 'source'].every(key => typeof place[key] === 'string')) {
      throw new AppError('Places need name, role, precision and source.');
    }
    for (const key of ['canonical_name', 'source_type', 'source_note', 'geocoding_source']) {
      if (place[key] !== undefined && typeof place[key] !== 'string') throw new AppError('Place labels and source notes must be text.');
    }
    if (place.roles !== undefined && (!Array.isArray(place.roles) || !place.roles.every(role => typeof role === 'string' && role.trim()))) throw new AppError('Place roles must be nonempty text.');
    const { latitude: lat, longitude: lon } = place;
    if (lat === undefined || lon === undefined) {
      throw new AppError('Places need latitude and longitude, both null if unknown.');
    }
    if ((lat === null) !== (lon === null)) throw new AppError('Provide both coordinates or leave both null.');
    if (lat !== null && (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180)) {
      throw new AppError('Invalid map coordinates.');
    }
  }
  for (const weather of entry.weather) {
    if (!object(weather) || !['recorded', 'historical_observation', 'forecast'].includes(weather.kind) ||
        !['description', 'source'].every(key => typeof weather[key] === 'string')) {
      throw new AppError('Weather needs kind, description and source.');
    }
  }
  if (entry.visibility !== undefined && !['private', 'help', 'shared'].includes(entry.visibility)) throw new AppError('Unknown family visibility.');
  if (entry.reading_version_status !== undefined && !['ai_draft', 'reviewed'].includes(entry.reading_version_status)) throw new AppError('Unknown reading version status.');
  return entry;
}

export function decodePhoto(image) {
  const match = typeof image === 'string' && /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  if (!match) throw new AppError('Use a JPEG, PNG or WebP photo.');
  const [, kind, base64] = match;
  const raw = Buffer.from(base64, 'base64');
  if (raw.toString('base64') !== base64) throw new AppError('Invalid photo encoding.');
  if (!raw.length || raw.length > 12 * 1024 * 1024) throw new AppError('Photo must be under 12 MB.');
  const matches = (kind === 'jpeg' && raw.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) ||
    (kind === 'png' && raw.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
    (kind === 'webp' && raw.toString('ascii', 0, 4) === 'RIFF' && raw.toString('ascii', 8, 12) === 'WEBP');
  if (!matches) throw new AppError('Photo content does not match the image format.');
  return { raw, kind, digest: createHash('sha256').update(raw).digest('hex') };
}

export class ArchiveStore {
  constructor(dataDir) {
    this.directory = resolve(dataDir);
    this.file = join(this.directory, 'archive.json');
    mkdirSync(join(this.directory, 'sources'), { recursive: true });
    if (!existsSync(this.file)) {
      this.save({ schema_version: 1, volumes: [{ id: 'V001', title: 'The Ship’s Log' }], pages: [], entries: [], trips: [], artifacts: [], contributions: [] });
    }
  }

  read() {
    return JSON.parse(readFileSync(this.file, 'utf8'));
  }

  save(archive) {
    archive.updated_at = now();
    const temp = join(this.directory, `archive-${randomUUID()}.tmp`);
    try {
      writeFileSync(temp, `${JSON.stringify(archive, null, 2)}\n`, { flag: 'wx' });
      renameSync(temp, this.file);
    } finally {
      if (existsSync(temp)) unlinkSync(temp);
    }
  }

  writePhoto(folder, filename, raw) {
    mkdirSync(join(this.directory, folder), { recursive: true });
    writeFileSync(join(this.directory, folder, filename), raw, { flag: 'wx' });
  }

  removePhoto(folder, filename) {
    const file = join(this.directory, folder, filename);
    if (existsSync(file)) unlinkSync(file);
  }

  assertNewPhoto(digest) {
    if (this.read().pages.some(page => page.sha256 === digest)) {
      throw new AppError('This exact photo is already archived.');
    }
  }

  // The entire read/modify/write operation is synchronous. Concurrent HTTP requests
  // cannot interleave commits within this single Node process, even after AI awaits.
  importPage(photo, entries, { name, automatic, model }) {
    this.assertNewPhoto(photo.digest);
    const drafts = entries.map(entry => {
      validateEntry(entry);
      const fields = Object.fromEntries(FIELDS.map(key => [key, structuredClone(entry[key])]));
      fields.status = 'first_pass';
      if (automatic) fields.places.forEach(place => { place.latitude = place.longitude = null; });
      return fields;
    });
    const archive = this.read();
    const pageId = `P-${randomUUID().replaceAll('-', '').slice(0, 10)}`;
    const filename = `${pageId}.${photo.kind === 'jpeg' ? 'jpg' : photo.kind}`;
    const page = {
      id: pageId, volume_id: 'V001', order: archive.pages.length + 1,
      label: String(name || 'Imported page').slice(0, 200), image: `/sources/${filename}`,
      sha256: photo.digest, created_at: now(),
    };
    archive.pages.push(page);
    const added = drafts.map(draft => ({
      ...draft, visibility: 'private', id: `E-${randomUUID().replaceAll('-', '').slice(0, 10)}`,
      page_ids: [pageId], trip_ids: [], revisions: [], created_at: now(),
      provenance: { method: automatic ? 'ai' : 'manual', model: automatic ? model : null },
    }));
    archive.entries.push(...added);
    this.writePhoto('sources', filename, photo.raw);
    try {
      this.save(archive);
    } catch (error) {
      this.removePhoto('sources', filename);
      throw error;
    }
    return { page, entry_ids: added.map(entry => entry.id) };
  }

  editEntry(id, body) {
    const archive = this.read();
    const index = archive.entries.findIndex(entry => entry.id === id);
    if (index === -1) throw new AppError('Entry not found', 404);
    const entry = archive.entries[index];
    if (body.revision !== entry.revisions.length) {
      throw new AppError('Entry changed in another window. Reload before saving.', 409);
    }
    const fields = Object.fromEntries(FIELDS.filter(key => Object.hasOwn(body, key)).map(key => [key, body[key]]));
    const edited = validateEntry({ ...entry, ...fields });
    if (body.source_contribution_id) {
      const source = (archive.contributions || []).find(item => item.id === body.source_contribution_id && item.entry_id === id && item.kind === 'identification' && item.status === 'approved');
      if (!source) throw new AppError('Only approved identifications for this entry can be used as a source.');
      edited.source_contribution_ids = [...new Set([...(entry.source_contribution_ids || []), source.id])];
    }
    edited.revisions = [...entry.revisions, {
      saved_at: now(), record: { ...Object.fromEntries(FIELDS.map(key => [key, entry[key]])), source_contribution_ids: entry.source_contribution_ids || [] },
    }];
    edited.updated_at = now();
    archive.entries[index] = edited;
    this.save(archive);
    return edited;
  }
}

export function manualEntry() {
  return {
    title: 'Untitled entry', date_as_written: '', date: '', date_certainty: 'unknown',
    transcription: '[Awaiting manual transcription]', reading_version: '', editorial_notes: '',
    status: 'first_pass', people: [], places: [],
    uncertainties: ['Page has not been transcribed.'], weather: [],
  };
}
