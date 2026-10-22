// Synthetic records and image bytes: never derive CI fixtures from a real archive.
import { manualEntry } from '../../lib/archive.js';
export const originalPhoto = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
export const sample = {
  schema_version: 1, volumes: [{ id: 'V001', title: 'Synthetic test volume' }],
  pages: [{ id: 'P001', volume_id: 'V001', order: 1, label: 'Synthetic page', image: '/sources/P001.jpg', sha256: 'synthetic-fixture', created_at: '2000-01-01T00:00:00Z' }],
  entries: Array.from({ length: 4 }, (_, i) => ({
    ...manualEntry(), id: `E00${i + 1}`, title: `Synthetic entry ${i + 1}`, transcription: 'A fictional crew sailed to [Example harbor?].',
    places: [{ name: 'Example harbor', role: 'departure', precision: 'unknown', source: 'Synthetic fixture', latitude: null, longitude: null }],
    page_ids: ['P001'], trip_ids: [], revisions: [], created_at: '2000-01-01T00:00:00Z', provenance: { method: 'manual', model: null },
  })), trips: [], artifacts: [], contributions: [],
};
