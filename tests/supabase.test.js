import { resetMemberPassword } from '../lib/password-help.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server.js';
import { AppError, manualEntry } from '../lib/archive.js';
import { authAction, requestAccess } from '../lib/supabase-auth.js';
import { loadSupabaseStore } from '../lib/supabase-store.js';

function fakeDatabase() {
  let document = { schema_version: 1, volumes: [], pages: [], entries: [{ ...manualEntry(), id: 'E1', visibility: 'shared', revisions: [], page_ids: [] }, { ...manualEntry(), id: 'secret', visibility: 'private', revisions: [], page_ids: [] }], contributions: [], trips: [], artifacts: [] };
  let version = 0;
  const objects = new Map();
  const reviews = [];
  return {
    objects, reviews,
    snapshot: () => structuredClone(document),
    from: table => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { document: structuredClone(document), version } }) }), order: async () => ({ data: [] }) }) }),
    rpc: async (name, args) => {
      if (name === 'review_member') { reviews.push(args); return {}; }
      if (args.expected_version !== version) return { data: false };
      document = structuredClone(args.next_document); version++; return { data: true };
    },
    storage: { from: () => ({
      upload: async (path, raw) => { if (objects.has(path)) return { error: true }; objects.set(path, raw); return {}; },
      remove: async paths => { paths.forEach(path => objects.delete(path)); return {}; },
      download: async path => objects.has(path) ? { data: new Blob([objects.get(path)]) } : { error: true },
    }) },
  };
}
function identity(role, id = 'crew-id') {
  return { role, user: role === 'family' ? null : { id }, profile: role === 'family' ? null : { email: 'crew@example.com', status: role === 'crew' ? 'approved' : 'pending' }, person: role === 'family' ? null : { id, name: 'Verified crew', invited: true }, origin: 'http://127.0.0.1:8000', isArchivist: () => role === 'archivist', requireArchivist: () => { if (role !== 'archivist') throw new AppError('Forbidden', 403); }, requireCrew: () => { if (!['crew', 'archivist'].includes(role)) throw new AppError('Forbidden', 403); } };
}
test('Supabase production routes enforce crew approval, ownership, and archivist permissions', async t => {
  const admin = fakeDatabase();
  let current = identity('family');
  const server = createApp({ admin, accessProvider: async () => current, apiKey: '' });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const get = path => fetch(url + path);
  const post = (path, body, origin) => fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body) });
  assert.deepEqual((await (await get('/api/family')).json()).entries.map(e => e.id), ['E1']);
  const memory = { entry_id: 'E1', kind: 'memory', text: 'I remember this.', author: 'Spoofed name', status: 'approved' };
  for (const role of ['family', 'pending']) {
    current = identity(role);
    assert.equal((await post('/api/contributions', memory)).status, 403);
    assert.equal((await get('/api/archive')).status, 403);
    assert.equal((await get('/api/members')).status, 403);
    assert.equal((await get('/api/password-help')).status, 403);
    assert.equal((await post('/api/members/reset-password', {})).status, 403);
    assert.equal((await post('/api/members/review', { id: 'victim', status: 'approved' })).status, 403);
  }
  current = identity('crew');
  assert.equal((await post('/api/import', {})).status, 403);
  assert.equal((await post('/api/entries/E1', {})).status, 403);
  assert.equal((await post('/api/contributions', memory, 'https://attacker.example')).status, 403);
  assert.equal((await post('/api/contributions', { ...memory, entry_id: 'secret' })).status, 404);
  assert.equal((await post('/api/contributions', memory)).status, 201);
  assert.equal(admin.snapshot().contributions[0].author, 'Verified crew');
  assert.equal(admin.snapshot().contributions[0].status, 'pending');
  assert.equal((await (await get('/api/me')).json()).contributions.length, 1);
  current = identity('crew', 'other-user');
  assert.equal((await (await get('/api/me')).json()).contributions.length, 0);
  current = identity('pending'); // revocation takes effect on the next request
  assert.equal((await post('/api/contributions', memory)).status, 403);
  current = identity('archivist');
  assert.equal((await get('/api/archive')).status, 200);
  assert.equal((await get('/api/members')).status, 200);
  assert.equal((await post('/api/members/review', { id: 'crew-id', status: 'approved' })).status, 200);
  assert.equal(admin.reviews[0].reviewer, 'crew-id');
});

test('Supabase snapshots reject concurrent commits and keep photos private in Storage', async () => {
  const admin = fakeDatabase();
  const first = await loadSupabaseStore(admin), stale = await loadSupabaseStore(admin);
  const a = first.read(); a.entries[0].title = 'First'; first.save(a);
  first.writePhoto('sources', 'P1.jpg', Buffer.from('photo'));
  await first.commit();
  const b = stale.read(); b.entries[0].title = 'Stale'; stale.save(b);
  stale.writePhoto('sources', 'P2.jpg', Buffer.from('other'));
  await assert.rejects(stale.commit(), e => e.status === 409);
  assert.equal(admin.snapshot().entries[0].title, 'First');
  assert.equal(admin.objects.has('sources/P2.jpg'), false);
  assert.deepEqual(await first.photo('sources/P1.jpg'), Buffer.from('photo'));
  await assert.rejects(first.photo('sources/missing.jpg'), e => e.status === 404);
});

test('auth identity uses database approval, not client metadata, without email verification', async () => {
  const secret = 'server-test-secret';
  const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public', SUPABASE_SECRET_KEY: secret, APP_ORIGIN: 'https://journal.example' };
  let status = 'pending';
  const admin = { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'user', role: 'crew', status, display_name: 'Crew' } }) }) }) }) };
  const factory = () => ({ auth: { getUser: async () => ({ data: { user: { id: 'user', email_confirmed_at: '2026-10-21', user_metadata: { role: 'archivist' } } } }) } });
  const req = { headers: {} }; const res = {};
  assert.equal((await requestAccess(req, res, admin, env, factory)).role, 'pending');
  status = 'approved';
  assert.equal((await requestAccess(req, res, admin, env, factory)).role, 'crew');

});

test('account flows enforce passwords, notify archivist without email, and require current passwords', async () => {
  const calls = [];
  const access = { user: { id: 'user' }, origin: 'https://journal.example', client: { auth: {
    signUp: async args => { calls.push(args); return {}; },
    resetPasswordForEmail: async () => { throw new Error('Email delivery must not be used'); },
    updateUser: async args => { calls.push(args); return {}; },
    signOut: async args => { calls.push(args); return {}; },
  } } };
  await assert.rejects(authAction('/api/signup', { name: 'Crew', email: 'a@b.com', password: 'short' }, access));
  await authAction('/api/signup', { name: ' Crew ', email: 'a@b.com', password: 'a strong passphrase', role: 'archivist' }, access);
  assert.deepEqual(calls[0].options.data, { display_name: 'Crew' });
  assert.match((await authAction('/api/forgot-password', { email: 'a@b.com' }, access, { rpc: async (name, args) => { assert.equal(name, 'request_password_help'); assert.equal(args.account_email, 'a@b.com'); return {}; } })).message, /If this account exists/);
  await assert.rejects(authAction('/api/change-password', { password: 'a strong passphrase' }, access), /current password/);
  await authAction('/api/change-password', { password: 'a strong passphrase', current_password: 'old passphrase' }, access);
  assert.equal(calls[1].current_password, 'old passphrase');
  assert.deepEqual(calls[2], { scope: 'global' });
  await assert.rejects(authAction('/api/change-password', { password: 'a strong passphrase' }, { ...access, recovery: true }), /current password/);
});


test('manual password resets require archivist authorization, offline verification, and reauthentication', async () => {
  const calls = [];
  const admin = {
    from: () => ({ select: () => ({ eq() { return this; }, single: async () => ({ data: { id: 'request', user_id: 'member', profiles: { email: 'crew@example.com' } } }) }) }),
    auth: { admin: { updateUserById: async (id, attributes) => { calls.push([id, attributes]); return {}; }, signOut: async (...args) => { calls.push(args); return {}; } } },
    rpc: async (name, args) => { calls.push([name, args]); return {}; },
  };
  const access = { ...identity('archivist', 'keeper'), user: { id: 'keeper', email: 'keeper@example.com' }, client: { auth: { signInWithPassword: async () => ({ data: { user: { id: 'keeper' } } }) } } };
  const body = { request_id: 'request', password: 'a replacement passphrase', current_password: 'keepers password', identity_confirmed: true };
  const factory = () => ({ auth: { signInWithPassword: async () => ({ data: { session: { access_token: 'temporary-jwt' } } }) } });
  await assert.rejects(resetMemberPassword(admin, identity('crew'), body, factory), e => e.status === 403);
  await assert.rejects(resetMemberPassword(admin, access, { ...body, identity_confirmed: false }, factory), /verified/);
  await assert.rejects(resetMemberPassword(admin, { ...access, client: { auth: { signInWithPassword: async () => ({ error: true }) } } }, body, factory), e => e.status === 401);
  assert.equal(calls.length, 0);
  const result = await resetMemberPassword(admin, access, body, factory);
  assert.match(result.message, /in person/);
  assert.deepEqual(calls[0], ['member', { password: body.password }]);
  assert.deepEqual(calls[1], ['temporary-jwt', 'global']);
  assert.deepEqual(calls[2], ['complete_password_help', { request_id: 'request', reviewer: 'keeper' }]);
  assert.equal(JSON.stringify(calls[2]).includes(body.password), false);
});
