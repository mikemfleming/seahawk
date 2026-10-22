import test from 'node:test';
import assert from 'node:assert/strict';
import { createEdgeHandler } from '../lib/edge-handler.js';
import { AppError } from '../lib/archive.js';
import { sample } from './fixtures/archive.js';

test('Edge adapter filters private records before signing photos and enforces origin/role checks', async () => {
  const previous = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = 'https://owner.github.io';
  try {
    const document = structuredClone(sample);
    document.pages.push({ ...document.pages[0], id: 'private-page', image: '/sources/private.jpg' });
    document.entries[0].visibility = 'private';
    document.entries[0].page_ids = ['private-page'];
    const signed = [];
    const admin = { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { document, version: 0 } }) }) }) }), storage: { from: () => ({ createSignedUrl: async path => { signed.push(path); return { data: { signedUrl: `https://storage.example/signed/${path}` } }; } }) } };
    let archivist = false;
    const handler = createEdgeHandler({ admin, apiKey: '', accessProvider: async req => {
      assert.equal(req.headers.cookie, undefined);
      return { origin: process.env.APP_ORIGIN, role: archivist ? 'archivist' : 'family', person: null, isArchivist: () => archivist, requireArchivist: () => { if (!archivist) throw new AppError('Forbidden', 401); } };
    } });
    const request = (path, origin = process.env.APP_ORIGIN, method = 'GET') => handler(new Request('https://project.supabase.co/functions/v1/ships-log' + path, { method, headers: { Origin: origin, Cookie: 'untrusted=1' } }));
    const preflight = await request('/api/family', undefined, 'OPTIONS');
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), process.env.APP_ORIGIN);
    const response = await request('/api/family');
    assert.equal(response.status, 200);
    const family = await response.json();
    assert.equal(family.entries.length, 3);
    assert.deepEqual(signed, ['sources/P001.jpg']);
    assert.match(family.pages[0].image, /^https:\/\/storage.example\/signed\//);
    assert.equal((await request('/api/archive')).status, 401);
    assert.equal((await request('/api/family', 'https://attacker.example')).status, 403);
    assert.equal((await request('/sources/private.jpg')).status, 404);
    archivist = true;
    assert.equal((await request('/api/archive')).status, 200);
    assert.ok(signed.includes('sources/private.jpg'));
    assert.equal(document.pages[0].image, '/sources/P001.jpg');
  } finally { if (previous === undefined) delete process.env.APP_ORIGIN; else process.env.APP_ORIGIN = previous; }
});
