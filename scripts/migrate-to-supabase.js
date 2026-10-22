import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { adminClient } from '../lib/supabase-store.js';

const directory = resolve(process.argv[2] || 'data');
const admin = adminClient();
const archive = JSON.parse(readFileSync(join(directory, 'archive.json'), 'utf8'));
const { data, error } = await admin.from('archive').select('document,version').eq('id', 1).single();
if (error) throw error;
if (data.document.entries.length || data.document.pages.length || data.document.contributions?.length) throw new Error('Destination is not empty. Migration stopped to preserve existing records.');
// Legacy browser sessions and invitations do not grant account access.
delete archive.contributor_sessions;
delete archive.invitations;
const paths = new Set([...archive.pages.map(p => p.image), ...(archive.contributions || []).filter(c => c.photo).map(c => c.photo.url)]);
for (const url of paths) {
  if (!/^\/(sources|contribution-photos)\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(url)) throw new Error('Unexpected image path in archive.');
  const path = url.slice(1);
  const raw = readFileSync(join(directory, path));
  const contentType = path.endsWith('.jpg') ? 'image/jpeg' : path.endsWith('.png') ? 'image/png' : 'image/webp';
  const { error } = await admin.storage.from('archive-photos').upload(path, raw, { contentType, upsert: false });
  // Safe reruns: verify an existing object is identical rather than overwriting it.
  if (error) {
    const { data: existing, error: missing } = await admin.storage.from('archive-photos').download(path);
    if (missing || !Buffer.from(await existing.arrayBuffer()).equals(raw)) throw error;
  }
}
const { data: committed, error: failure } = await admin.rpc('commit_archive', { expected_version: data.version, next_document: archive });
if (failure || !committed) throw new Error('Archive changed during migration. No records overwritten.');
console.log(`Migrated ${archive.entries.length} entries and ${paths.size} photographs. Local originals remain intact.`);
