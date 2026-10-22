import { randomUUID } from 'node:crypto';

// Never record URLs, query strings, bodies, identities, or caller-supplied IDs.
export function routeLabel(url) {
  const path = url.split('?')[0];
  const fixed = new Set(['config', 'family', 'archive', 'me', 'members', 'password-help', 'session', 'signup', 'logout', 'forgot-password', 'change-password', 'contributions']);
  const part = path.split('/')[2];
  return path.startsWith('/api/') ? `/api/${fixed.has(part) ? part : 'other'}` : 'asset';
}

export function observeRequest(req, res, log = record => console.log(JSON.stringify(record))) {
  const start = performance.now();
  const requestId = randomUUID();
  const timings = {};
  let status = 200;
  const writeHead = res.writeHead.bind(res);
  const end = res.end.bind(res);
  const setTimingHeaders = () => {
    timings.total = performance.now() - start;
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('Server-Timing', Object.entries(timings).map(([name, duration]) => `${name};dur=${duration.toFixed(1)}`).join(', '));
  };
  res.writeHead = (code, headers) => { status = code; setTimingHeaders(); return writeHead(code, headers); };
  res.end = body => {
    log({ event: 'api_request', request_id: requestId, route: routeLabel(req.url), method: ['GET', 'POST'].includes(req.method) ? req.method : 'other', status, cache: 'disabled', timings_ms: Object.fromEntries(Object.entries(timings).map(([name, duration]) => [name, Math.round(duration * 10) / 10])) });
    return end(body);
  };
  return async (name, action) => {
    const started = performance.now();
    try { return await action(); } finally { timings[name] = (timings[name] || 0) + performance.now() - started; }
  };
}
