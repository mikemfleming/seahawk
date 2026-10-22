import process from 'node:process';
import { createRadioLookup } from './lib/radio.js';
import { publicPage, readTraffic } from './lib/analytics.js';
import { observeRequest } from './lib/observability.js';
import { Buffer } from 'node:buffer';
import { isAllowedOrigin } from './lib/origin.js';
import { resetMemberPassword } from './lib/password-help.js';
import { adminClient, loadSupabaseStore } from './lib/supabase-store.js';
import { requestAccess, authAction, limitAuth } from './lib/supabase-auth.js';
import { createPlaceLookup } from './lib/geocoding.js';
import { getContributor, ownContributions, createInvitation, invitationInfo, redeemInvitation } from './lib/contributors.js';
import { randomBytes } from 'node:crypto';
import { createAccess } from './lib/access.js';
import { familyArchive, submitContribution, reviewContribution } from './lib/contributions.js';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppError, ArchiveStore, decodePhoto, manualEntry } from './lib/archive.js';
import { createTranscriber, createReadingGenerator } from './lib/transcription.js';

export const ROOT = dirname(fileURLToPath(import.meta.url));
const MAX_BODY = 18 * 1024 * 1024;
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

function send(res, status, value, contentType = 'application/json; charset=utf-8') {
  const data = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
  res.writeHead(status, {
    'Content-Type': contentType, 'Content-Length': data.length,
    'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
  });
  res.end(data);
}

async function readBody(req) {
  if (Number(req.headers['content-length']) > MAX_BODY) throw new AppError('Use a photo under 12 MB.', 413);
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
    throw new AppError('Expected application/json.', 415);
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new AppError('Use a photo under 12 MB.', 413);
    chunks.push(chunk);
  }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch {
    throw new AppError('Expected valid JSON.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError('Expected a JSON object.');
  return body;
}

export function createApp(options = {}) {
  const env = options.env ?? process.env;
  const dataDir = options.dataDir ?? env.SHIPS_LOG_DATA ?? join(ROOT, 'data');
  const model = options.model ?? env.OPENAI_MODEL ?? 'gpt-4.1';
  const apiKey = options.apiKey ?? env.OPENAI_API_KEY;
  // Filesystem mode exists only for isolated integration tests. Production fails closed.
  const testing = Boolean(options.dataDir || options.store);
  const localStore = testing ? options.store ?? new ArchiveStore(dataDir) : null;
  const admin = testing ? null : options.admin ?? adminClient(env);
  const generateReading = options.generateReading ?? createReadingGenerator({ apiKey, model });
  const lookupRadio = options.lookupRadio ?? createRadioLookup();
  const lookupPlace = options.lookupPlace ?? createPlaceLookup();
  const transcribe = options.transcribe ?? createTranscriber({ apiKey, model });
  const localAccess = testing ? createAccess(options.archivistPassword || randomBytes(24).toString('base64url')) : null;
  const server = (options.createServer ?? createServer)(async (req, res) => {
    const timed = observeRequest(req, res, options.requestLogger ?? (testing ? () => {} : undefined));
    try {
      if (env.APP_ORIGIN?.startsWith('https:')) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
      res.setHeader('Referrer-Policy', 'no-referrer');
      if (options.bearerOnly && req.headers.cookie) delete req.headers.cookie;
      const access = localAccess || await timed('auth', () => (options.accessProvider ?? requestAccess)(req, res, admin, env));
      if (req.method === 'GET' && req.url.split('?')[0] === '/api/analytics') {
        access.requireArchivist(req);
        if (testing) return send(res, 200, { rows: [], timezone: 'UTC', days: 30 });
        return send(res, 200, await timed('database', () => readTraffic(admin)));
      }
      if (req.method === 'GET' && req.url.split('?')[0] === '/api/radio') {
        const date = new URL(req.url, 'http://localhost').searchParams.get('date');
        return send(res, 200, await lookupRadio(date));
      }
      const store = localStore || await timed('database', () => loadSupabaseStore(admin));
      const person = () => testing ? getContributor(req, store.read()) : access.person;
      const respond = async (...args) => { await timed('commit', () => store.commit?.()); if (options.transformResponse && args[1] < 400) args[2] = await timed('photos', () => options.transformResponse(args[2], admin)); return send(...args); };
      const path = req.url.split('?')[0];
      if (req.method === 'GET') {
        if (!testing && path === '/api/password-help') {
          access.requireArchivist();
          const { data, error } = await admin.from('password_help_requests').select('*, profiles(display_name,email)').eq('status', 'pending').order('created_at');
          if (error) throw new AppError('Could not load password-help requests.', 503);
          return await respond(res, 200, data);
        }
        if (!testing && path === '/api/members') {
          access.requireArchivist();
          const { data, error } = await admin.from('profiles').select('*').order('created_at', { ascending: false });
          if (error) throw new AppError('Could not load crew requests.', 503);
          return await respond(res, 200, data);
        }
        if (path === '/api/me') { if (!testing) access.requireCrew(); const archive = store.read(); const contributor = person(); return await respond(res, 200, { contributor, contributions: ownContributions(archive, contributor) }); }
        if (testing && path.startsWith('/api/invitations/')) return await respond(res, 200, invitationInfo(store.read(), path.split('/').at(-1)));
        if (path.startsWith('/api/preview/')) { access.requireArchivist(req); const archive = store.read(); const id = path.split('/').at(-1); if (!archive.entries.some(entry => entry.id === id)) throw new AppError('Entry not found', 404); return await respond(res, 200, familyArchive(archive, id)); }
        if (path === '/api/family') return await respond(res, 200, familyArchive(store.read()));
        if (path === '/api/archive') { access.requireArchivist(req); return await respond(res, 200, store.read()); }
        if (path === '/api/config') return await respond(res, 200, { automatic_transcription: access.isArchivist(req) && Boolean(apiKey), model: access.isArchivist(req) ? model : '', role: testing ? (access.isArchivist(req) ? 'archivist' : 'family') : access.role, contributor: person(), account: testing ? null : access.profile && { email: access.profile.email, status: access.profile.status } });
        let file;
        if (path.startsWith('/contribution-photos/')) {
          const item = (store.read().contributions || []).find(item => item.photo?.url === path);
          if (!item || (!access.isArchivist(req) && !(item.contributor_id && person()?.id === item.contributor_id && (testing || ['crew', 'archivist'].includes(access.role))) && !(item.status === 'approved' && familyArchive(store.read()).entries.some(entry => entry.id === item.entry_id)))) throw new AppError('Not found', 404);
          const name = path.slice('/contribution-photos/'.length);
          if (!/^C-[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(name)) throw new AppError('Not found', 404);
          file = testing ? join(store.directory, 'contribution-photos', name) : path.slice(1);
        } else if (path.startsWith('/sources/')) {
          const name = path.slice('/sources/'.length);
          if (!/^[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(name)) throw new AppError('Not found', 404);
          if (!access.isArchivist(req) && !familyArchive(store.read()).pages.some(page => page.image === path)) throw new AppError('Not found', 404);
          file = testing ? join(store.directory, 'sources', name) : path.slice(1);
        } else {
          if (path === '/' || /^\/(entries\/[a-zA-Z0-9_-]+|atlas|contributions|join\/[A-Za-z0-9_-]+|workspace(?:\/(?:entries(?:\/[a-zA-Z0-9_-]+(?:\/edit)?)?|review|members|invitations|atlas))?)\/?$/.test(path)) file = join(ROOT, 'dist', 'index.html');
          else if (/^\/assets\/[a-zA-Z0-9_.-]+$/.test(path)) file = join(ROOT, 'dist', path.slice(1));
          else throw new AppError('Not found', 404);
        }
        let contents;
        try { contents = !testing && /^(sources|contribution-photos)\//.test(file) ? await store.photo(file) : readFileSync(file); } catch (error) {
          if (error.code === 'ENOENT' || error.code === 'EISDIR') throw new AppError('Not found', 404);
          throw error;
        }
        return await respond(res, 200, contents, mime[extname(file)] || 'application/octet-stream');
      }
      if (req.method !== 'POST') throw new AppError('Method not allowed', 405);
      if (!options.bearerOnly && req.headers['sec-fetch-site'] === 'cross-site') throw new AppError('Cross-site writes are not permitted.', 403);
      if (!isAllowedOrigin(req, testing ? `http://${req.headers.host}` : access.origin)) {
        throw new AppError('Cross-origin writes are not permitted.', 403);
      }
      const body = await readBody(req);
      if (path === '/api/page-view') {
        const page = publicPage(body.page, store.read());
        if (!testing) {
          const { error } = await timed('analytics', () => admin.rpc('record_page_view', { page_path: page }));
          if (error) throw new AppError('Could not record page view.', 503);
        }
        return send(res, 200, { recorded: true });
      }
      if (!testing && ['/api/session', '/api/signup', '/api/forgot-password', '/api/change-password', '/api/logout'].includes(path)) {
        limitAuth(req);
        const result = await authAction(path, body, access, admin);
        return await respond(res, 200, result);
      }
      if (testing && path === '/api/session') {
        access.signIn(req, res, body.password);
        return await respond(res, 200, { role: 'archivist' });
      }
      if (testing && path === '/api/logout') {
        access.signOut(req, res);
        return await respond(res, 200, { role: 'family' });
      }
      if (testing && path === '/api/contributor/join') {
        const result = redeemInvitation(store, req, body.token);
        res.setHeader('Set-Cookie', result.cookie);
        return await respond(res, 200, { contributor: result.person });
      }
      if (path === '/api/contributions') {
        if (!testing) { access.requireCrew(); body.author = access.person.name; }
        const { cookie, ...receipt } = submitContribution(store, body, person(), { allowPrivate: access.isArchivist(req) });
        if (cookie) res.setHeader('Set-Cookie', cookie);
        return await respond(res, 201, receipt);
      }
      access.requireArchivist(req);
      if (!testing && path === '/api/members/reset-password') {
        limitAuth(req);
        return await respond(res, 200, await resetMemberPassword(admin, access, body));
      }
      if (!testing && path === '/api/members/review') {
        const { error } = await admin.rpc('review_member', { member: body.id, decision: body.status, reviewer: access.user.id });
        if (error) throw new AppError('Could not review this crew request.');
        return await respond(res, 200, { ok: true });
      }
      if (path === '/api/places/lookup') return await respond(res, 200, await lookupPlace(body.query));
      if (path === '/api/reading-version') return await respond(res, 200, await generateReading(body.transcription, body.reading_corrections));
      if (testing && path === '/api/invitations') return await respond(res, 201, createInvitation(store, body));
      const contributionMatch = /^\/api\/contributions\/([a-zA-Z0-9_-]+)\/review$/.exec(path);
      if (contributionMatch) return await respond(res, 200, reviewContribution(store, contributionMatch[1], body));
      if (path === '/api/import') {
        const photo = decodePhoto(body.image);
        store.assertNewPhoto(photo.digest);
        const automatic = body.automatic === true;
        const entries = automatic ? await transcribe(body.image) : [manualEntry()];
        return await respond(res, 201, store.importPage(photo, entries, { name: body.name, automatic, model }));
      }
      const match = /^\/api\/entries\/([a-zA-Z0-9_-]+)$/.exec(path);
      if (match) return await respond(res, 200, store.editEntry(match[1], body));
      throw new AppError('Not found', 404);
    } catch (error) {
      if (res.destroyed) return;
      if (error instanceof AppError) return send(res, error.status, { error: error.message });
      // Request metadata and status are logged by observeRequest; never log error payloads.
      send(res, 500, { error: 'Could not save changes. Existing archive records are unchanged.' });
    }
  });
  return server;
}

if (typeof Deno === 'undefined' && !process.env.SHIPS_LOG_EDGE && process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const validArgs = args.length === 0 || (args.length === 2 && args[0] === '--port');
  const port = Number(args[1] ?? process.env.PORT ?? 8000);
  if (!validArgs || !Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('Usage: node server.js [--port 8001] (port must be 1–65535)');
    process.exitCode = 1;
  } else {
    let server;
    try { server = createApp(); } catch (error) {
      console.error(error instanceof AppError ? error.message : 'Could not initialize the server.');
      process.exit(1);
    }
    server.on('error', error => {
      console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use; choose another with --port.` : `Server error: ${error.code}`);
      process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => console.log(`Ship’s Log · http://127.0.0.1:${port}`));
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.on(signal, () => server.close(() => process.exit(0)));
    }
  }
}
