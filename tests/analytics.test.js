import test from 'node:test';
import assert from 'node:assert/strict';
import { publicPage, readTraffic } from '../lib/analytics.js';
import { sample } from './fixtures/archive.js';
import { createEdgeHandler } from '../lib/edge-handler.js';

test('only canonical public pages are counted, never queries or private entries', () => {
  const archive = structuredClone(sample);
  archive.entries[0].visibility = 'private';
  assert.equal(publicPage('/', archive), '/');
  assert.equal(publicPage('/atlas', archive), '/atlas');
  assert.throws(() => publicPage(`/entries/${archive.entries[0].id}`, archive), /not found/);
  for (const path of ['/workspace', '/?email=person@example.com', '/entries/missing', null, '/entries/../config']) assert.throws(() => publicPage(path, archive));
  const entry = archive.entries.find(entry => entry.visibility !== 'private');
  assert.equal(publicPage(`/entries/${entry.id}`, archive), `/entries/${entry.id}`);
});

test('traffic reports require archivist authorization and writes enforce origin', async () => {
  const handler = createEdgeHandler({ store: { read: () => structuredClone(sample) }, env: { APP_ORIGIN: 'https://owner.github.io' }, archivistPassword: 'test-password' });
  const get = await handler(new Request('https://project/ships-log/api/analytics', { headers: { Origin: 'https://owner.github.io' } }));
  assert.equal(get.status, 401);
  const response = await handler(new Request('https://project/ships-log/api/page-view', { method: 'POST', headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ page: '/' }) }));
  assert.equal(response.status, 403);
});

test('traffic report limits its database query to thirty UTC days without selecting visitor data', async () => {
  let cutoff;
  const admin = { from: table => { assert.equal(table, 'page_view_daily'); return { select: fields => { assert.equal(fields, 'day,page,views'); return { gte: (column, value) => { cutoff = value; assert.equal(column, 'day'); return { order: async () => ({ data: [], error: null }) }; } }; } }; } };
  assert.deepEqual((await readTraffic(admin)).rows, []);
  assert.match(cutoff, /^\d{4}-\d{2}-\d{2}$/);
});

test('public recording sends only canonical path to atomic counter; archivist can read aggregates', async () => {
  const recorded = [];
  let archivist = false;
  const admin = {
    from: table => table === 'archive' ? { select: () => ({ eq: () => ({ single: async () => ({ data: { document: structuredClone(sample), version: 0 } }) }) }) } : { select: () => ({ gte: () => ({ order: async () => ({ data: [{ day: '2026-10-21', page: '/', views: 1 }] }) }) }) },
    rpc: async (name, args) => { recorded.push({ name, args }); return {}; },
  };
  const handler = createEdgeHandler({ admin, env: { APP_ORIGIN: 'https://owner.github.io' }, requestLogger: () => {}, accessProvider: async () => ({ role: archivist ? 'archivist' : 'family', origin: 'https://owner.github.io', requireArchivist: () => { if (!archivist) throw new Error('Forbidden'); } }) });
  const response = await handler(new Request('https://project/ships-log/api/page-view', { method: 'POST', headers: { Origin: 'https://owner.github.io', 'Content-Type': 'application/json' }, body: JSON.stringify({ page: '/', email: 'ignored@example.com' }) }));
  assert.equal(response.status, 200);
  assert.deepEqual(recorded, [{ name: 'record_page_view', args: { page_path: '/' } }]);
  archivist = true;
  const report = await handler(new Request('https://project/ships-log/api/analytics', { headers: { Origin: 'https://owner.github.io' } }));
  assert.equal(report.status, 200);
  assert.equal((await report.json()).rows[0].views, 1);
});
