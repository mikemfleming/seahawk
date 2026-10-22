// Permit the configured deployment origin, plus equivalent loopback names on
// the same port during local development. Never trust an arbitrary Host header.
export function isAllowedOrigin(req, configuredOrigin) {
  if (!req.headers.origin) return true;
  try {
    const expected = new URL(configuredOrigin);
    const actual = new URL(req.headers.origin);
    if (actual.origin === expected.origin) return true;
    const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);
    return expected.protocol === 'http:' && actual.protocol === 'http:' &&
      loopback.has(expected.hostname) && loopback.has(actual.hostname) &&
      actual.port === expected.port && actual.host === req.headers.host &&
      req.headers.origin === actual.origin;
  } catch { return false; }
}
