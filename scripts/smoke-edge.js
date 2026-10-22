import assert from 'node:assert/strict';
const base = process.env.VITE_EDGE_API_URL || `https://${process.env.SUPABASE_PROJECT_REF}.supabase.co/functions/v1/ships-log`;
const origin = process.env.APP_ORIGIN || 'https://mikemfleming.github.io';
async function get(path, method = 'GET', from = origin) {
  return fetch(base + path, { method, headers: { Origin: from }, signal: AbortSignal.timeout(30000) });
}
const config = await get('/api/config');
assert.equal(config.status, 200, 'Edge config must be healthy before frontend release');
assert.equal((await config.json()).role, 'family');
const family = await get('/api/family'); assert.equal(family.status, 200);
const archive = await family.json(); assert.ok(Array.isArray(archive.entries));
assert.ok(archive.entries.every(entry => entry.visibility !== 'private'));
assert.ok(archive.pages.every(page => page.image.startsWith('https://') && page.image.includes('/object/sign/')));
assert.equal((await get('/api/archive')).status, 401);
assert.equal((await get('/api/family', 'OPTIONS')).status, 204);
assert.equal((await get('/api/family', 'GET', 'https://untrusted.example')).status, 403);
console.log('Production API smoke checks passed.');
