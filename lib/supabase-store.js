import process from 'node:process';
import { Buffer } from 'node:buffer';
import { createClient } from '@supabase/supabase-js';
import { ArchiveStore, AppError } from './archive.js';

export function adminClient(env = process.env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY || !env.SUPABASE_PUBLISHABLE_KEY) throw new AppError('Supabase is not configured. Follow the setup instructions in README.md.', 503);
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

// A request owns its snapshot. A database compare-and-swap prevents lost updates
// across processes; a conflict never retries a user edit against a newer revision.
export async function loadSupabaseStore(client) {
  const { data, error } = await client.from('archive').select('document,version').eq('id', 1).single();
  if (error) throw new AppError('Could not load the Supabase archive. Check migrations and configuration.', 503);
  const store = Object.create(ArchiveStore.prototype);
  let document = data.document;
  const photos = new Map();
  let dirty = false;
  store.read = () => structuredClone(document);
  store.save = value => { document = structuredClone(value); document.updated_at = new Date().toISOString(); dirty = true; };
  store.writePhoto = (folder, name, raw) => photos.set(`${folder}/${name}`, raw);
  store.removePhoto = (folder, name) => photos.delete(`${folder}/${name}`);
  store.photo = async path => {
    const { data, error } = await client.storage.from('archive-photos').download(path);
    if (error) throw new AppError('Photo not found.', 404);
    return Buffer.from(await data.arrayBuffer());
  };
  store.commit = async () => {
    if (!dirty) return;
    const uploaded = [];
    try {
      for (const [path, raw] of photos) {
        const contentType = path.endsWith('.jpg') ? 'image/jpeg' : path.endsWith('.png') ? 'image/png' : 'image/webp';
        const { error } = await client.storage.from('archive-photos').upload(path, raw, { contentType, upsert: false });
        if (error) throw new AppError('Could not store the photograph.', 503);
        uploaded.push(path);
      }
      const { data: committed, error } = await client.rpc('commit_archive', { expected_version: data.version, next_document: document });
      if (error) throw new AppError('Could not save the archive.', 503);
      if (!committed) throw new AppError('Archive changed in another window. Reload before saving.', 409);
      dirty = false;
    } catch (error) {
      // Do not remove uploaded objects after an ambiguous network failure: the
      // transaction may have committed. Unreferenced private objects can be cleaned later.
      if (error.status === 409 && uploaded.length) await client.storage.from('archive-photos').remove(uploaded);
      throw error;
    }
  };
  return store;
}
