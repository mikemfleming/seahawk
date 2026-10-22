import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedOrigin } from '../lib/origin.js';
const allowed = (origin, host = 'localhost:8000', configured = 'http://127.0.0.1:8000') => isAllowedOrigin({headers:{origin,host}},configured);
test('local origins accept equivalent loopback names only on the configured port and matching request host', () => {
  assert.equal(allowed('http://localhost:8000'),true);
  assert.equal(allowed('http://127.0.0.1:8000','127.0.0.1:8000'),true);
  assert.equal(allowed('http://[::1]:8000','[::1]:8000'),true);
  assert.equal(allowed('http://localhost:5173','localhost:5173'),false);
  assert.equal(allowed('http://localhost:8000','attacker.example:8000'),false);
  assert.equal(allowed('https://attacker.example'),false);
  assert.equal(allowed('http://localhost.attacker.example:8000'),false);
  assert.equal(allowed('null'),false);
  assert.equal(allowed('http://localhost:8000/path'),false);
});
test('hosted configuration accepts only its configured origin', () => {
  assert.equal(allowed('https://journal.example','journal.example','https://journal.example'),true);
  assert.equal(allowed('http://localhost:8000','localhost:8000','https://journal.example'),false);
  assert.equal(allowed('https://other.example','other.example','https://journal.example'),false);
});
