import process from 'node:process';
import { Buffer } from 'node:buffer';
import { createApp } from '../server.js';

// The same route handler runs locally under Node and as a Fetch handler at the
// edge. Cookies are intentionally not used across github.io and supabase.co.
export function createEdgeHandler(options = {}) {
  let handle;
  createApp({ ...options, bearerOnly: true, createServer: handler => { handle = handler; return {}; }, transformResponse: signPhotos });
  return async request => {
    const origin = request.headers.get('origin');
    const configured = process.env.APP_ORIGIN;
    const cors = { 'Access-Control-Allow-Origin': configured, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', Vary: 'Origin' };
    if (origin && origin !== configured) return Response.json({ error: 'Origin is not permitted.' }, { status: 403 });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    const prefix = '/functions/v1/ships-log';
    const path = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : url.pathname;
    if (!path.startsWith('/api/')) return Response.json({ error: 'Not found' }, { status: 404, headers: cors });
    const headers = Object.fromEntries(request.headers);
    // The edge gateway supplies the client IP; never use a caller-supplied
    // forwarding header to establish roles or authentication.
    const req = { headers, url: path + url.search, method: request.method, socket: { remoteAddress: headers['x-forwarded-for']?.split(',')[0].trim() || 'edge' }, async *[Symbol.asyncIterator]() {
      if (!request.body) return;
      for await (const chunk of request.body) yield Buffer.from(chunk);
    } };
    return await new Promise((resolve, reject) => {
      let status = 200;
      const responseHeaders = new Headers(cors);
      const res = { destroyed: false, setHeader(name, value) { if (name.toLowerCase() !== 'set-cookie') responseHeaders.set(name, String(value)); }, getHeader(name) { return responseHeaders.get(name); }, writeHead(code, values) { status = code; for (const [name, value] of Object.entries(values)) this.setHeader(name, value); }, end(body) { responseHeaders.delete('Content-Length'); resolve(new Response(body, { status, headers: responseHeaders })); } };
      Promise.resolve(handle(req, res)).catch(reject);
    });
  };
}

export async function signPhotos(value, admin) {
  if (Buffer.isBuffer(value) || value === null || typeof value !== 'object') return value;
  const copy = structuredClone(value);
  const urls = new Map();
  async function visit(item) {
    if (!item || typeof item !== 'object') return;
    for (const [key, child] of Object.entries(item)) {
      if (['url', 'image'].includes(key) && typeof child === 'string' && /^\/(sources|contribution-photos)\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(child)) {
        if (!urls.has(child)) {
          const { data, error } = await admin.storage.from('archive-photos').createSignedUrl(child.slice(1), 3600);
          if (error) throw new Error('Could not authorize photograph.');
          urls.set(child, data.signedUrl);
        }
        item[key] = urls.get(child);
      } else await visit(child);
    }
  }
  await visit(copy);
  return copy;
}
