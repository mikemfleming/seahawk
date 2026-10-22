import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCoordinate, parseCoordinates } from '../web/src/coordinates.ts';

test('Waterway Guide coordinates paste as a pair or individual values', () => {
  const expected = { latitude: 27.865, longitude: -97.04866667 };
  assert.deepEqual(parseCoordinates("N 27° 51.900' / W 097° 02.920'"), expected);
  assert.deepEqual(parseCoordinates('N 27° 51.900′ W 097° 02.920′'), expected);
  assert.deepEqual(parseCoordinates("27° 51.900' N, 097° 02.920' W"), expected);
  assert.equal(parseCoordinate("N 27° 51.900'", 'latitude'), expected.latitude);
  assert.equal(parseCoordinate("W 097° 02.920'", 'longitude'), expected.longitude);
});
test('decimal and degrees/minutes/seconds formats preserve signs and hemispheres', () => {
  assert.deepEqual(parseCoordinates('27.865, -97.04866667'), { latitude: 27.865, longitude: -97.04866667 });
  assert.deepEqual(parseCoordinates('27.865 -97.04866667'), { latitude: 27.865, longitude: -97.04866667 });
  assert.equal(parseCoordinate('27° 51\' 54" N', 'latitude'), 27.865);
  assert.equal(parseCoordinate('S 27° 51.9\'', 'latitude'), -27.865);
  assert.equal(parseCoordinate('E 097° 02.92\'', 'longitude'), 97.04866667);
});
test('invalid, reversed, conflicting, or out-of-range coordinates are rejected', () => {
  for (const value of ['N 91°', "N 27° 60'", 'N 27° 10\' 60"', '-27 N', '27 W', 'no coordinates', '27.5° 10\'']) assert.throws(() => parseCoordinate(value, 'latitude'));
  for (const value of ['W 97 / N 27', '27, -97, 1', '27', '91, -97']) assert.throws(() => parseCoordinates(value));
});
