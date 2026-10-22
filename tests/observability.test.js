import test from 'node:test';
import assert from 'node:assert/strict';
import { createEdgeHandler } from '../lib/edge-handler.js';
import { routeLabel } from '../lib/observability.js';
import { sample } from './fixtures/archive.js';

test('observability traces errors and successes without logging private request data', async () => {
  const logs = [];
  const handler = createEdgeHandler({ store: { read: () => ({ ...structuredClone(sample), pages: [], contributions: [] }) }, archivistPassword: 'test-password', env: { APP_ORIGIN: 'https://owner.github.io' }, requestLogger: record => logs.push(record) });
  const get = path => handler(new Request(`https://project.supabase.co/ships-log${path}`, { headers: { Origin: 'https://owner.github.io', 'X-Request-ID': 'caller-secret' } }));
  const success = await get('/api/family?email=private@example.com');
  assert.equal(success.status, 200);
  assert.match(success.headers.get('x-request-id'), /^[a-f0-9-]{36}$/);
  assert.match(success.headers.get('server-timing'), /total;dur=/);
  assert.match(success.headers.get('server-timing'), /photos;dur=/);
  assert.match(success.headers.get('access-control-expose-headers'), /Server-Timing/);
  assert.equal(logs[0].request_id, success.headers.get('x-request-id'));
  assert.equal(success.headers.get('cache-control'), 'no-store');
  const failed = await get('/api/archive');
  assert.equal(failed.status, 401);
  assert.ok(failed.headers.get('x-request-id'));
  assert.equal(logs[1].status, 401);
  assert.equal(logs[1].cache, 'disabled');
  assert.ok(!JSON.stringify(logs).match(/private@example|caller-secret|test-password|transcription/));
  assert.equal(routeLabel('/api/preview/secret-entry?token=secret'), '/api/other');
  assert.notEqual(logs[0].request_id, logs[1].request_id);
});
