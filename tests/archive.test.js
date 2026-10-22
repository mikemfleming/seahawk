import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp, ROOT } from '../server.js';
import { ArchiveStore, FIELDS, manualEntry, validateEntry } from '../lib/archive.js';
import { createTranscriber } from '../lib/transcription.js';

let directory, store, servers;
import { sample, originalPhoto } from './fixtures/archive.js';
const image = (suffix = '') => `data:image/jpeg;base64,${Buffer.concat([originalPhoto, Buffer.from(suffix)]).toString('base64')}`;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'ships-log-'));
  store = new ArchiveStore(directory);
  store.save(structuredClone(sample));
  servers = [];
});
afterEach(async () => {
  for (const server of servers) {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  rmSync(directory, { recursive: true, force: true });
});

async function start(options = {}) {
  const { signedIn = true, ...serverOptions } = options;
  const server = createApp({ store, apiKey: '', archivistPassword: 'test-workspace', ...serverOptions });
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  if (signedIn) {
    const login = await fetch(url + '/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'test-workspace' }) });
    cookie = login.headers.get('set-cookie').split(';')[0];
    await login.json();
  }
  return async (path, body, headers = {}) => {
    const response = await fetch(url + path, body === undefined ? { headers: { Cookie: cookie, ...headers } } : {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
    });
    const value = response.headers.get('content-type')?.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer());
    return { status: response.status, value, headers: response.headers };
  };
}
const draft = () => Object.fromEntries(FIELDS.map(key => [key, structuredClone(sample.entries[0][key])]));
const aiResponse = entries => new Response(JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ entries }) }] }] }));

test('existing archive and source links remain compatible', () => {
  assert.equal(sample.entries.length, 4);
  for (const entry of sample.entries) {
    validateEntry(entry);
    assert(entry.page_ids.every(id => sample.pages.some(page => page.id === id)));
  }
  assert.deepEqual(store.read().entries, sample.entries);
});

test('serves frontend, source images, archive and key-free configuration', async () => {
  const request = await start({ apiKey: 'not-a-real-key' });
  writeFileSync(join(directory, 'sources/P001.jpg'), originalPhoto);
  for (const path of ['/', '/sources/P001.jpg', '/api/archive']) {
    assert.equal((await request(path)).status, 200);
  }
  const html = (await request('/')).value.toString();
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(match => match[1]);
  assert(assets.some(path => path.endsWith('.js')));
  assert(assets.some(path => path.endsWith('.css')));
  for (const asset of assets) assert.equal((await request(asset)).status, 200);
  assert.equal((await request('/src/main.tsx')).status, 404);
  const config = await request('/api/config');
  assert.equal(config.value.automatic_transcription, true);
  assert(!JSON.stringify(config.value).includes('not-a-real-key'));
  assert.deepEqual((await request('/sources/P001.jpg')).value, originalPhoto);
});

test('edit persists original revision and rejects stale updates', async () => {
  const request = await start();
  const original = store.read().entries[0];
  const { status, value } = await request('/api/entries/E001', { revision: original.revisions.length, transcription: 'Corrected text', status: 'checked' });
  assert.equal(status, 200);
  assert.equal(value.revisions.at(-1).record.transcription, original.transcription);
  assert.equal(new ArchiveStore(directory).read().entries[0].transcription, 'Corrected text');
  assert.equal((await request('/api/entries/E001', { revision: original.revisions.length, title: 'Stale edit' })).status, 409);
});

test('invalid metadata leaves archive byte-for-byte unchanged', async () => {
  const request = await start();
  const before = readFileSync(store.file);
  for (const change of [{ date: '1995-02-30' }, { date: '1995-3-6' }, { status: 'invented' }, { people: [42] }, { places: [{ name: 'Bad', role: 'area', precision: 'approximate', source: 'test', latitude: 100, longitude: 10 }] }]) {
    assert.equal((await request('/api/entries/E001', { revision: 0, ...change })).status, 400);
    assert.deepEqual(readFileSync(store.file), before);
  }
});

test('manual import preserves bytes and rejects duplicates before AI', async () => {
  let aiCalls = 0;
  const request = await start({ transcribe: async () => { aiCalls++; return [draft()]; } });
  const photo = image('new-page');
  const result = await request('/api/import', { image: photo, name: 'Page two', automatic: false });
  assert.equal(result.status, 201);
  const archive = store.read();
  assert.equal(archive.pages.length, sample.pages.length + 1);
  assert.equal(archive.entries.length, sample.entries.length + 1);
  assert.equal(archive.entries.at(-1).provenance.method, 'manual');
  const saved = join(directory, 'sources', result.value.page.image.split('/').at(-1));
  assert.deepEqual(readFileSync(saved), Buffer.from(photo.split(',')[1], 'base64'));
  assert.equal((await request('/api/import', { image: photo, automatic: true })).status, 400);
  assert.equal(aiCalls, 0);
});

test('AI import splits entries, forces review and strips guessed coordinates', async () => {
  const first = draft();
  first.status = 'ready_to_share';
  first.places[0].latitude = 27.8;
  first.places[0].longitude = -97;
  const request = await start({ transcribe: async () => [first, draft()] });
  const result = await request('/api/import', { image: image('ai-page'), automatic: true });
  assert.equal(result.status, 201);
  assert.equal(result.value.entry_ids.length, 2);
  for (const entry of store.read().entries.slice(-2)) {
    assert.equal(entry.status, 'first_pass');
    assert.equal(entry.provenance.method, 'ai');
    assert.equal(entry.places[0].latitude, null);
    assert.deepEqual(entry.page_ids, [result.value.page.id]);
  }
});

test('AI failures leave no photos or records', async () => {
  const transcribe = createTranscriber({ apiKey: 'test-key', fetchImpl: async () => { throw new Error('network'); } });
  const request = await start({ transcribe });
  const before = readFileSync(store.file);
  assert.equal((await request('/api/import', { image: image('failed'), automatic: true })).status, 400);
  assert.deepEqual(readFileSync(store.file), before);
  assert.deepEqual(readdirSync(join(directory, 'sources')), []);
});

test('Responses request uses image input and validates model output', async () => {
  let captured;
  const transcribe = createTranscriber({ apiKey: 'test-key', model: 'test-model', fetchImpl: async (url, options) => {
    captured = { url, options };
    return aiResponse([draft()]);
  } });
  assert.equal((await transcribe(image())).length, 1);
  assert.equal(captured.url, 'https://api.openai.com/v1/responses');
  const payload = JSON.parse(captured.options.body);
  assert.equal(payload.model, 'test-model');
  assert.equal(payload.store, false);
  assert.equal(payload.input[0].content[1].image_url, image());
  for (const reply of [aiResponse([{ title: 'Invalid' }]), aiResponse([]), new Response(JSON.stringify({ status: 'incomplete' })), new Response('bad JSON'), new Response('{}', { status: 401 })]) {
    const invalid = createTranscriber({ apiKey: 'test-key', fetchImpl: async () => reply });
    await assert.rejects(invalid(image()));
  }
  await assert.rejects(createTranscriber({ apiKey: '' })(image()), /OPENAI_API_KEY/);
});

test('coordinate and weather edits survive reopening the data store', async () => {
  const request = await start();
  const places = [{ name: 'Identified area', role: 'fishing area', precision: 'approximate area', source: 'Family identification', latitude: 27.8, longitude: -97 }];
  const weather = [{ kind: 'recorded', description: 'Light north wind', source: 'Original log' }];
  assert.equal((await request('/api/entries/E001', { revision: 0, places, weather })).status, 200);
  const saved = new ArchiveStore(directory).read().entries[0];
  assert.deepEqual(saved.places, places);
  assert.deepEqual(saved.weather, weather);
});

test('rejects bad photos, cross-origin writes and source path traversal', async () => {
  const request = await start();
  assert.equal((await request('/api/import', { image: 'data:image/jpeg;base64,YmFk' })).status, 400);
  assert.equal((await request('/api/import', { image: image() }, { Origin: 'https://unrelated.example' })).status, 403);
  assert.equal((await request('/sources/%2e%2e%2fserver.js')).status, 404);
  assert.equal((await request('/server.js')).status, 404);
  assert.equal((await request('/api/entries/missing', { revision: 0 })).status, 404);
});

test('concurrent imports commit distinct pages without overwriting records', async () => {
  const request = await start({ transcribe: async () => { await new Promise(resolve => setImmediate(resolve)); return [draft()]; } });
  const results = await Promise.all(['one', 'two', 'three'].map(suffix => request('/api/import', { image: image(suffix), automatic: true })));
  assert(results.every(result => result.status === 201));
  assert.equal(store.read().pages.length, sample.pages.length + 3);
  assert.equal(store.read().entries.length, sample.entries.length + 3);
  assert.deepEqual(readdirSync(directory).filter(name => name.endsWith('.tmp')), []);
});

test('simultaneous duplicate uploads commit just one page', async () => {
  const request = await start({ transcribe: async () => { await new Promise(resolve => setImmediate(resolve)); return [draft()]; } });
  const results = await Promise.all([1, 2].map(() => request('/api/import', { image: image('same'), automatic: true })));
  assert.deepEqual(results.map(result => result.status).sort(), [201, 400]);
  assert.equal(store.read().pages.length, sample.pages.length + 1);
});

test('malformed JSON and unsupported media type do not reach storage', async () => {
  const server = createApp({ store, apiKey: '' });
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/api/import`;
  for (const [body, type, expected] of [['{', 'application/json', 400], ['[]', 'application/json', 400], ['{}', 'text/plain', 415]]) {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': type }, body });
    assert.equal(response.status, expected);
    await response.text();
  }
});

test('new data directories initialize an empty compatible archive', () => {
  const fresh = new ArchiveStore(join(directory, 'fresh'));
  assert.equal(fresh.read().schema_version, 1);
  assert.deepEqual(fresh.read().entries, []);
  validateEntry(manualEntry());
});

test('family readers cannot access workspace data, import originals, edit entries or review contributions', async () => {
  const request = await start({ signedIn: false, apiKey: 'not-a-real-key' });
  assert.equal((await request('/api/family')).status, 200);
  const config = (await request('/api/config')).value;
  assert.equal(config.role, 'family');
  assert.equal(config.automatic_transcription, false);
  assert.equal(config.model, '');
  assert.equal((await request('/api/archive')).status, 401);
  assert.equal((await request('/api/import', { image: image('blocked') })).status, 401);
  assert.equal((await request('/api/entries/E001', { revision: 0, title: 'Blocked' })).status, 401);
  assert.equal((await request('/api/contributions/missing/review', { revision: 0, status: 'approved' })).status, 401);
  assert.deepEqual(store.read().entries, sample.entries);
});

test('workspace password creates a protected cookie session and logout revokes it', async () => {
  const request = await start({ signedIn: false });
  assert.equal((await request('/api/session', { password: 'wrong' })).status, 401);
  const login = await request('/api/session', { password: 'test-workspace' });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  const headers = { Cookie: cookie.split(';')[0] };
  assert.equal((await request('/api/archive', undefined, headers)).status, 200);
  assert.equal((await request('/api/config', undefined, headers)).value.role, 'archivist');
  assert.equal((await request('/api/logout', {}, headers)).status, 200);
  assert.equal((await request('/api/archive', undefined, headers)).status, 401);
});

test('a family memory is stored with attribution and stays private until approved', async () => {
  const family = await start({ signedIn: false });
  const admin = await start();
  const response = await family('/api/contributions', { entry_id: 'E002', kind: 'memory', author: 'Family contributor', text: 'I remember the rough ride home.' });
  assert.equal(response.status, 201);
  assert.equal(response.value.status, 'pending');
  assert.equal((await family('/api/family')).value.contributions.length, 0);
  const item = store.read().contributions[0];
  assert.equal(item.author, 'Family contributor');
  assert.equal(item.entry_id, 'E002');
  const reviewed = await admin(`/api/contributions/${item.id}/review`, { revision: 0, status: 'approved', note: 'Internal review only' });
  assert.equal(reviewed.status, 200);
  const publicArchive = (await family('/api/family')).value;
  assert.equal(publicArchive.contributions.length, 1);
  assert.equal(publicArchive.contributions[0].text, item.text);
  assert(!JSON.stringify(publicArchive).includes('Internal review only'));
  assert(publicArchive.entries.every(entry => entry.revisions.length === 0 && entry.editorial_notes === ''));
  assert.deepEqual(store.read().entries, sample.entries);
});

test('identifications retain context and never silently replace original names or text', async () => {
  const family = await start({ signedIn: false });
  const admin = await start();
  const response = await family('/api/contributions', { entry_id: 'E003', kind: 'identification', author: 'A relative', subject: '[Patricia?]', identified_name: 'Patricia Example', text: 'I recognize the nickname.' });
  assert.equal(response.status, 201);
  const item = store.read().contributions[0];
  assert.equal(item.subject, '[Patricia?]');
  assert.equal(item.identified_name, 'Patricia Example');
  assert.equal((await admin(`/api/contributions/${item.id}/review`, { revision: 0, status: 'approved' })).status, 200);
  assert.deepEqual(store.read().entries, sample.entries);
  assert.equal((await family('/api/family')).value.contributions[0].identified_name, 'Patricia Example');
});

test('photo submissions preserve bytes and permission, with access controlled by review status', async () => {
  const family = await start({ signedIn: false });
  const admin = await start();
  const dataUrl = image('family-picture');
  const response = await family('/api/contributions', { entry_id: 'E001', kind: 'photo', author: 'A relative', text: 'At the dock.', credit: 'Family collection', image: dataUrl, original_name: 'dock.jpg', permission: true });
  assert.equal(response.status, 201);
  const item = store.read().contributions[0];
  assert.equal(item.photo.permission, 'family_archive');
  assert.equal(item.photo.credit, 'Family collection');
  assert.equal((await family(item.photo.url)).status, 404);
  assert.deepEqual((await admin(item.photo.url)).value, Buffer.from(dataUrl.split(',')[1], 'base64'));
  assert.equal((await family('/api/contributions', { entry_id: 'E001', kind: 'photo', author: 'Other', text: 'Same photo', image: dataUrl, permission: true })).status, 400);
  await admin(`/api/contributions/${item.id}/review`, { revision: 0, status: 'approved', note: '' });
  assert.equal((await family(item.photo.url)).status, 200);
  await admin(`/api/contributions/${item.id}/review`, { revision: 1, status: 'declined', note: 'Keep this one private.' });
  assert.equal((await family(item.photo.url)).status, 404);
  assert.equal((await family('/api/family')).value.contributions.length, 0);
  assert.equal((await admin(item.photo.url)).status, 200);
});

test('invalid contributions, missing photo permission, and unknown entries do not change storage', async () => {
  const request = await start({ signedIn: false });
  const before = readFileSync(store.file);
  const valid = { entry_id: 'E001', kind: 'memory', author: 'A relative', text: 'A memory.' };
  for (const body of [
    { ...valid, author: '' }, { ...valid, text: '' }, { ...valid, kind: 'unknown' },
    { ...valid, kind: 'identification', identified_name: '', subject: 'Person' },
    { ...valid, kind: 'photo', image: image('missing-consent') },
    { ...valid, kind: 'photo', image: 'data:image/jpeg;base64,YmFk', permission: true },
  ]) assert.equal((await request('/api/contributions', body)).status, 400);
  assert.equal((await request('/api/contributions', { ...valid, entry_id: 'missing' })).status, 404);
  assert.deepEqual(readFileSync(store.file), before);
  assert(!readdirSync(directory).includes('contribution-photos'));
});

test('review decisions preserve history, reject stale edits, and can return a contribution to pending', async () => {
  const family = await start({ signedIn: false });
  const admin = await start();
  const response = await family('/api/contributions', { entry_id: 'E001', kind: 'memory', author: 'A relative', text: 'A memory.' });
  const path = `/api/contributions/${response.value.id}/review`;
  assert.equal((await admin(path, { revision: 0, status: 'approved', note: 'First decision' })).status, 200);
  assert.equal((await admin(path, { revision: 0, status: 'declined' })).status, 409);
  assert.equal((await admin(path, { revision: 1, status: 'pending', note: 'Need more context' })).status, 200);
  const item = store.read().contributions[0];
  assert.equal(item.review_history.length, 2);
  assert.equal(item.review_history[1].previous_note, 'First decision');
  assert.equal(item.status, 'pending');
  assert.equal((await family('/api/family')).value.contributions.length, 0);
});

test('simultaneous family contributions preserve both submissions', async () => {
  const family = await start({ signedIn: false });
  const results = await Promise.all(['First', 'Second'].map(author => family('/api/contributions', { entry_id: 'E001', kind: 'memory', author, text: 'I was there.' })));
  assert(results.every(result => result.status === 201));
  assert.equal(new ArchiveStore(directory).read().contributions.length, 2);
  assert.deepEqual(store.read().entries, sample.entries);
});

test('family submissions cannot set their own approval status or review notes', async () => {
  const family = await start({ signedIn: false });
  const result = await family('/api/contributions', { entry_id: 'E001', kind: 'memory', author: 'A relative', text: 'A memory.', status: 'approved', review_note: 'Injected', review_history: ['Injected'] });
  assert.equal(result.status, 201);
  const item = store.read().contributions[0];
  assert.equal(item.status, 'pending');
  assert.equal(item.review_note, '');
  assert.deepEqual(item.review_history, []);
  assert.equal((await family('/api/family')).value.contributions.length, 0);
});

test('failed contribution persistence rolls back an uploaded photo', async () => {
  const family = await start({ signedIn: false });
  const before = readFileSync(store.file);
  store.save = () => { throw new Error('Simulated disk failure'); };
  const result = await family('/api/contributions', { entry_id: 'E001', kind: 'photo', author: 'A relative', text: 'A caption', image: image('rollback-photo'), permission: true });
  assert.equal(result.status, 500);
  assert.deepEqual(readFileSync(store.file), before);
  assert.deepEqual(readdirSync(join(directory, 'contribution-photos')), []);
});

test('dedicated family and workspace routes survive direct navigation without exposing source files', async () => {
  const family = await start({ signedIn: false });
  for (const path of ['/entries/E003', '/atlas', '/contributions', '/workspace', '/workspace/entries?task=drafts', '/workspace/entries/E003/edit', '/workspace/review', '/workspace/invitations', '/join/example-token']) assert.equal((await family(path)).status, 200);
  for (const path of ['/lib/access.js', '/.env', '/src/App.tsx', '/workspace/../../server.js']) assert.equal((await family(path)).status, 404);
});

test('entry quality and visibility are independent, and private pages stay outside the family API', async () => {
  const admin = await start();
  const family = await start({ signedIn: false });
  const imported = await admin('/api/import', { image: image('private-page'), name: 'Private original', automatic: false });
  const id = imported.value.entry_ids[0];
  assert.equal(store.read().entries.find(entry => entry.id === id).visibility, 'private');
  assert(!(await family('/api/family')).value.entries.some(entry => entry.id === id));
  assert.equal((await family(imported.value.page.image)).status, 404);
  assert.equal((await admin(imported.value.page.image)).status, 200);
  assert.equal((await family('/api/contributions', {entry_id:id, kind:'memory',author:'Relative',text:'Not allowed on private entry'})).status,404);
  assert.equal((await admin(`/api/entries/${id}`, {revision:0,status:'first_pass',visibility:'help'})).status,200);
  const shared = (await family('/api/family')).value.entries.find(entry => entry.id === id);
  assert.equal(shared.status,'first_pass');
  assert.equal(shared.visibility,'help');
  assert.equal((await family(imported.value.page.image)).status,200);
  assert.equal((await admin(`/api/entries/${id}`, {revision:1,status:'checked',visibility:'private'})).status,200);
  assert(!(await family('/api/family')).value.entries.some(entry => entry.id === id));
  assert.equal((await family(imported.value.page.image)).status,404);
});

test('contributors privately recover their own pending submissions, not other people’s or review notes', async () => {
  const family=await start({signedIn:false});
  const first=await family('/api/contributions',{entry_id:'E001',kind:'memory',author:'Same name',text:'First browser memory'});
  const firstCookie={Cookie:first.headers.get('set-cookie').split(';')[0]};
  const second=await family('/api/contributions',{entry_id:'E001',kind:'memory',author:'Same name',text:'Second browser memory'});
  const secondCookie={Cookie:second.headers.get('set-cookie').split(';')[0]};
  assert.equal((await family('/api/me')).value.contributions.length,0);
  assert.equal((await family('/api/me',undefined,firstCookie)).value.contributions[0].text,'First browser memory');
  assert.equal((await family('/api/me',undefined,secondCookie)).value.contributions[0].text,'Second browser memory');
  const admin=await start();
  await admin(`/api/contributions/${first.value.id}/review`,{revision:0,status:'declined',note:'Private archivist discussion'});
  const mine=(await family('/api/me',undefined,firstCookie)).value;
  assert.equal(mine.contributions[0].status,'declined');
  assert(!JSON.stringify(mine).includes('Private archivist discussion'));
  const publicArchive=JSON.stringify((await family('/api/family')).value);
  assert(!publicArchive.includes('contributor_sessions'));
  assert(!publicArchive.includes('token_hash'));
});

test('photo owners can see their own pending images while other readers cannot', async () => {
  const family=await start({signedIn:false});
  const result=await family('/api/contributions',{entry_id:'E001',kind:'photo',author:'Photo owner',text:'At the dock',image:image('owner-only'),permission:true});
  const cookie={Cookie:result.headers.get('set-cookie').split(';')[0]};
  const photo=store.read().contributions[0].photo.url;
  assert.equal((await family(photo)).status,404);
  assert.equal((await family(photo,undefined,cookie)).status,200);
  const admin=await start();
  await admin(`/api/contributions/${result.value.id}/review`,{revision:0,status:'approved'});
  await admin('/api/entries/E001',{revision:0,visibility:'private'});
  assert.equal((await family(photo)).status,404);
  assert.equal((await family(photo,undefined,cookie)).status,200);
});

test('invitation links are single-use, hashed at rest, and reconnect the intended contributor on another device', async () => {
  const family=await start({signedIn:false});
  const admin=await start();
  const original=await family('/api/contributions',{entry_id:'E001',kind:'memory',author:'Family member',text:'A previous memory'});
  const person=store.read().contributors[0];
  assert.equal((await family('/api/invitations',{name:'Not authorized'})).status,401);
  const invitation=await admin('/api/invitations',{contributor_id:person.id});
  const token=invitation.value.path.split('/').at(-1);
  assert.equal(invitation.status,201);
  assert(!readFileSync(store.file,'utf8').includes(token));
  assert.equal((await family(`/api/invitations/${token}`)).value.name,'Family member');
  const joined=await family('/api/contributor/join',{token});
  assert.equal(joined.status,200);
  const cookie={Cookie:joined.headers.get('set-cookie').split(';')[0]};
  const mine=(await family('/api/me',undefined,cookie)).value;
  assert.equal(mine.contributor.id,person.id);
  assert.equal(mine.contributor.invited,true);
  assert.equal(mine.contributions[0].id,original.value.id);
  assert.equal((await family('/api/contributor/join',{token})).status,404);
  assert.equal((await family(`/api/invitations/${token}`)).status,404);
  const submitted=await family('/api/contributions',{entry_id:'E001',kind:'memory',author:'Impersonated name',text:'Invited contribution'},cookie);
  assert.equal(submitted.status,201);
  assert.equal(store.read().contributions.at(-1).author,'Family member');
  const publicText=JSON.stringify((await family('/api/family')).value);
  assert(!publicText.includes('invitations'));
  assert(!publicText.includes(person.id));
});

test('new invitations upgrade the current guest identity and retain browser contribution history', async () => {
  const family=await start({signedIn:false});
  const admin=await start();
  const submitted=await family('/api/contributions',{entry_id:'E001',kind:'memory',author:'Guest',text:'My memory'});
  const oldCookie={Cookie:submitted.headers.get('set-cookie').split(';')[0]};
  const guestId=store.read().contributors[0].id;
  const invitation=await admin('/api/invitations',{name:'Invited relative'});
  const joined=await family('/api/contributor/join',{token:invitation.value.path.split('/').at(-1)},oldCookie);
  const newCookie={Cookie:joined.headers.get('set-cookie').split(';')[0]};
  assert.equal(joined.value.contributor.id,guestId);
  assert.equal((await family('/api/me',undefined,newCookie)).value.contributions.length,1);
});

test('using an identification creates a linked normal revision without altering the faithful transcription', async () => {
  const family=await start({signedIn:false});
  const admin=await start();
  const submitted=await family('/api/contributions',{entry_id:'E003',kind:'identification',author:'Relative',subject:'[Patricia?]',identified_name:'Patricia Example'});
  const path=`/api/entries/E003`;
  assert.equal((await admin(path,{revision:0,source_contribution_id:submitted.value.id})).status,400);
  await admin(`/api/contributions/${submitted.value.id}/review`,{revision:0,status:'approved'});
  const original=store.read().entries.find(entry=>entry.id==='E003');
  const edited=await admin(path,{revision:original.revisions.length,people:['Patricia Example','Mike'],editorial_notes:'Identification supplied by Relative.',source_contribution_id:submitted.value.id});
  assert.equal(edited.status,200);
  assert.equal(edited.value.transcription,original.transcription);
  assert.deepEqual(edited.value.source_contribution_ids,[submitted.value.id]);
  assert.deepEqual(edited.value.revisions.at(-1).record.people,original.people);
  assert.equal((await admin('/api/entries/E001',{revision:0,source_contribution_id:submitted.value.id})).status,400);
});

test('archivist previews can show private entries without making them available to family', async () => {
  const admin=await start();const family=await start({signedIn:false});
  await admin('/api/entries/E003',{revision:sample.entries.find(entry=>entry.id==='E003').revisions.length,visibility:'private'});
  assert.equal((await family('/api/preview/E003')).status,401);
  const preview=await admin('/api/preview/E003');
  assert.equal(preview.status,200);
  assert(preview.value.entries.some(entry=>entry.id==='E003'&&entry.visibility==='private'));
  assert(preview.value.entries.every(entry=>entry.revisions.length===0&&entry.editorial_notes===''));
  assert(!(await family('/api/family')).value.entries.some(entry=>entry.id==='E003'));
});

test('expired invitation and contributor sessions do not grant access', async () => {
  const admin=await start();const family=await start({signedIn:false});
  const invite=await admin('/api/invitations',{name:'Expired invite'});
  const submitted=await family('/api/contributions',{entry_id:'E001',kind:'memory',author:'Relative',text:'My memory'});
  const cookie={Cookie:submitted.headers.get('set-cookie').split(';')[0]};
  const archive=store.read();archive.invitations[0].expires_at='2000-01-01T00:00:00Z';archive.contributor_sessions[0].expires_at='2000-01-01T00:00:00Z';store.save(archive);
  const token=invite.value.path.split('/').at(-1);
  assert.equal((await family('/api/contributor/join',{token})).status,404);
  assert.equal((await family('/api/me',undefined,cookie)).value.contributor,null);
});

test('reading generation requires archivist access and never saves over an entry', async () => {
  let calls = 0;
  const generateReading = async text => { calls++; assert.equal(text, 'New [name?] text'); return { reading_version: 'New [name?] text.', reading_version_status: 'ai_draft' }; };
  const guest = await start({ signedIn: false, generateReading });
  assert.equal((await guest('/api/reading-version', { transcription: 'New [name?] text' })).status, 401);
  assert.equal(calls, 0);
  const request = await start({ generateReading });
  const before = store.read();
  const result = await request('/api/reading-version', { transcription: 'New [name?] text' });
  assert.equal(result.status, 200);
  assert.equal(result.value.reading_version_status, 'ai_draft');
  assert.deepEqual(store.read(), before);
  const entry = before.entries[0];
  const saved = await request('/api/entries/' + entry.id, { revision: entry.revisions.length, ...result.value });
  assert.equal(saved.value.transcription, entry.transcription);
  assert.equal(saved.value.reading_version_status, 'ai_draft');
  const reviewed = await request('/api/entries/' + entry.id, { revision: saved.value.revisions.length, reading_version_status: 'reviewed' });
  assert.equal(reviewed.value.reading_version_status, 'reviewed');
  assert.equal(reviewed.value.revisions.at(-1).record.reading_version_status, 'ai_draft');
});

test('reading service preserves uncertainty, validates results and handles unavailable service', async () => {
  const { createReadingGenerator } = await import('../lib/transcription.js');
  let payload;
  const generator = output => createReadingGenerator({ apiKey: 'test', fetchImpl: async (url, options) => {
    payload = JSON.parse(options.body);
    return new Response(JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ reading_version: output }) }] }] }));
  } });
  const result = await generator('Beautiful weather. [Patricia?] came aboard.')('beautiful weather [Patricia?] came aboard');
  assert.equal(result.reading_version_status, 'ai_draft');
  assert.equal(payload.store, false);
  assert.equal(payload.input[0].role, 'developer');
  assert.match(payload.input[0].content, /Return JSON/);
  assert.deepEqual(payload.input[1], { role: 'user', content: 'beautiful weather [Patricia?] came aboard' });
  await assert.rejects(generator('Patricia came aboard.')('[Patricia?] came aboard'), /Invalid or incomplete/);
  await assert.rejects(generator('')('some text'), /Invalid or incomplete/);
  await assert.rejects(generator('ok')(''), /faithful transcription/);
  await assert.rejects(createReadingGenerator({ apiKey: '' })('some text'), /OPENAI_API_KEY/);
  await assert.rejects(createReadingGenerator({ apiKey: 'test', fetchImpl: async () => { throw new Error(); } })('some text'), /could not be reached/);
});

test('automatic transcription returns reading drafts with review state', async () => {
  const entry = draft();
  entry.reading_version = 'A lightly edited reading copy.';
  const transcribe = createTranscriber({ apiKey: 'test', fetchImpl: async () => aiResponse([entry]) });
  const request = await start({ transcribe });
  assert.equal((await request('/api/import', { image: image('reading-draft'), automatic: true })).status, 201);
  const imported = store.read().entries.at(-1);
  assert.equal(imported.reading_version, entry.reading_version);
  assert.equal(imported.reading_version_status, 'ai_draft');
  assert.equal(imported.visibility, 'private');
});


test('reading errors report upstream rejection and redact credentials', async () => {
  const { createReadingGenerator } = await import('../lib/transcription.js');
  const generate = createReadingGenerator({ apiKey: 'secret-value', fetchImpl: async () => new Response(JSON.stringify({ error: { message: 'Input messages must contain json. secret-value sk-test-secret' } }), { status: 400 }) });
  await assert.rejects(generate('Weather fine'), error => {
    assert.match(error.message, /HTTP 400.*Input messages must contain json/);
    assert(!error.message.includes('secret-value'));
    assert(!error.message.includes('sk-test-secret'));
    return true;
  });
  const unavailable = createReadingGenerator({ apiKey: 'test', fetchImpl: async () => new Response('unavailable', { status: 502 }) });
  await assert.rejects(unavailable('Weather fine'), /HTTP 502.*temporarily unavailable/);
});

test('clarifications retain the unresolved detail, require review, and do not rewrite the entry', async () => {
  const archive = store.read();
  archive.entries[0].uncertainties = ['Which harbor is mentioned?'];
  store.save(archive);
  const entry = structuredClone(archive.entries[0]);
  const family = await start({ signedIn: false });
  const admin = await start();
  const submitted = await family('/api/contributions', { entry_id: entry.id, kind: 'clarification', author: 'Captain Eddie', subject: entry.uncertainties[0], text: 'That was the harbor near our launch.', context: 'Untrusted replacement context', status: 'approved' });
  assert.equal(submitted.status, 201);
  const item = store.read().contributions.find(item => item.id === submitted.value.id);
  assert.equal(item.kind, 'clarification');
  assert.equal(item.subject, entry.uncertainties[0]);
  assert.equal(item.context, entry.uncertainties[0]);
  assert.equal(item.status, 'pending');
  assert.equal((await family('/api/family')).value.contributions.length, 0);
  assert.equal((await admin(`/api/contributions/${item.id}/review`, { revision: 0, status: 'approved' })).status, 200);
  assert.equal((await family('/api/family')).value.contributions[0].kind, 'clarification');
  assert.deepEqual(store.read().entries[0], entry);
});

test('clarifications require an existing unresolved detail and a nonempty answer', async () => {
  const archive = store.read();
  archive.entries[0].uncertainties = ['Which harbor?'];
  store.save(archive);
  const family = await start({ signedIn: false });
  const body = { entry_id: archive.entries[0].id, kind: 'clarification', author: 'Crew member', subject: 'Which harbor?', text: 'The launch harbor.' };
  for (const invalid of [{ ...body, subject: '' }, { ...body, subject: 'A different question' }, { ...body, text: ' ' }]) {
    assert.equal((await family('/api/contributions', invalid)).status, 400);
  }
  assert.equal((store.read().contributions || []).length, 0);
});

test('place picker metadata survives saving without changing original wording', async () => {
  const request = await start();
  const body = draft();
  body.places = [{ name: '[Corpus?]', canonical_name: 'Corpus Christi', role: 'Departure · Return', roles: ['Departure', 'Return'], precision: 'General area', source: 'Crew confirmation · Captain Eddie', source_type: 'Crew confirmation', source_note: 'Captain Eddie', latitude: 27.8, longitude: -97 }];
  const result = await request(`/api/entries/${sample.entries[0].id}`, { ...body, revision: sample.entries[0].revisions.length });
  assert.equal(result.status, 200);
  assert.deepEqual(result.value.places, body.places);
  assert.deepEqual(new ArchiveStore(directory).read().entries[0].places, body.places);
  const family = await request('/api/family');
  assert.deepEqual(family.value.entries[0].places, body.places);
});

test('place picker metadata rejects malformed roles and labels', () => {
  for (const patch of [{ roles: 'Departure' }, { roles: [''] }, { canonical_name: 42 }, { source_type: [] }, { source_note: {} }]) {
    const body = draft();
    body.places = [{ name: 'Harbor', role: 'departure', precision: 'unlocated', source: 'Log', latitude: null, longitude: null, ...patch }];
    assert.throws(() => validateEntry(body));
  }
});

test('city lookup requires archivist access and does not save coordinates until the entry is saved', async () => {
  let query;
  const lookupPlace = async value => { query = value; return { matches: [{ label: 'San Antonio, Texas, United States', latitude: 29.42412, longitude: -98.49363 }], source: 'Open-Meteo / GeoNames' }; };
  const family = await start({ signedIn: false, lookupPlace });
  const admin = await start({ lookupPlace });
  const before = store.read();
  assert.equal((await family('/api/places/lookup', { query: 'San Antonio, TX' })).status, 401);
  assert.equal(query, undefined);
  const result = await admin('/api/places/lookup', { query: 'San Antonio, TX' });
  assert.equal(result.status, 200);
  assert.equal(query, 'San Antonio, TX');
  assert.equal(result.value.matches[0].latitude, 29.42412);
  assert.deepEqual(store.read(), before);
});

test('geocoder forwards city/state qualifiers, handles ambiguity and empty results, and rejects service failures', async () => {
  const { createPlaceLookup } = await import('../lib/geocoding.js');
  let requested;
  const lookup = createPlaceLookup({ fetchImpl: async url => { requested = url; return Response.json({ results: [
    { name: 'Springfield', admin1: 'Illinois', country: 'United States', latitude: 39.8, longitude: -89.6 },
    { name: 'Springfield', admin1: 'Missouri', country: 'United States', latitude: 37.2, longitude: -93.3 },
    { name: 'Invalid', latitude: 100, longitude: 0 },
  ] }); } });
  const result = await lookup('Springfield, IL');
  assert.equal(requested.searchParams.get('name'), 'Springfield, IL');
  assert.equal(result.matches.length, 2);
  assert.equal(result.matches[0].label, 'Springfield, Illinois, United States');
  await assert.rejects(() => lookup(''), /city and state/);
  assert.deepEqual((await createPlaceLookup({ fetchImpl: async () => Response.json({}) })('Unknown city')).matches, []);
  await assert.rejects(() => createPlaceLookup({ fetchImpl: async () => new Response('', { status: 503 }) })('San Antonio, TX'), /unavailable/);
  await assert.rejects(() => createPlaceLookup({ fetchImpl: async () => { throw new Error('Timeout'); } })('San Antonio, TX'), /unavailable/);
});

test('confirmed reading corrections persist, reach generation, and retain the faithful transcription and revision history', async () => {
  let received;
  const request = await start({ generateReading: async (text, corrections) => { received = { text, corrections }; return { reading_version: 'Eddie visited Corpus Christi.', reading_version_status: 'ai_draft' }; } });
  const entry = sample.entries[0];
  const corrections = [{ as_written: '[Name?]', corrected: 'Eddie' }, { as_written: '[Corpus?]', corrected: 'Corpus Christi' }];
  const text = '[Name?] visited [Corpus?].';
  const before = store.read();
  const generated = await request('/api/reading-version', { transcription: text, reading_corrections: corrections });
  assert.equal(generated.status, 200);
  assert.deepEqual(received, { text, corrections });
  assert.deepEqual(store.read(), before);
  const saved = await request(`/api/entries/${entry.id}`, { transcription: text, reading_corrections: corrections, reading_version: generated.value.reading_version, revision: 0 });
  assert.equal(saved.status, 200);
  assert.equal(saved.value.transcription, text);
  assert.deepEqual(saved.value.reading_corrections, corrections);
  assert.equal(saved.value.revisions[0].record.transcription, entry.transcription);
  const next = await request(`/api/entries/${entry.id}`, { reading_corrections: [], revision: 1 });
  assert.deepEqual(next.value.revisions[1].record.reading_corrections, corrections);
});

test('weekly radio charts are available publicly without changing archive records', async () => {
  const before = store.read();
  const dates = [];
  const request = await start({ signedIn: false, lookupRadio: async date => { dates.push(date); return { status: 'no_chart', songs: [] }; } });
  const result = await request('/api/radio?date=1995-03-06');
  assert.equal(result.status, 200);
  assert.deepEqual(result.value, { status: 'no_chart', songs: [] });
  assert.deepEqual(dates, ['1995-03-06']);
  assert.deepEqual(store.read(), before);
});
