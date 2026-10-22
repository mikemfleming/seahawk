import test from 'node:test';
import assert from 'node:assert/strict';
import { chartWeek, createRadioLookup } from '../lib/radio.js';

const chartDate = '1995-03-11';
const topFive = Array.from({ length: 5 }, (_, i) => ({ this_week: i + 1, song: `Song ${i + 1}`, artist: `Artist ${i + 1}` }));
const response = value => new Response(JSON.stringify(value));

test('weekly lookup uses the week-ending chart and handles historical dates, year boundaries and gaps', () => {
  const dates = ['1995-03-04', chartDate, '1995-03-18'];
  assert.equal(chartWeek('1995-03-06', dates), chartDate);
  assert.equal(chartWeek(chartDate, dates), chartDate);
  assert.equal(chartWeek('1995-03-12', dates), '1995-03-18');
  assert.equal(chartWeek('1994-12-31', ['1995-01-07']), null);
  assert.equal(chartWeek('1994-12-31', ['1994-12-31', '1995-01-07']), '1994-12-31');
  assert.equal(chartWeek('1958-08-05', ['1958-08-04', '1958-08-11']), '1958-08-11');
  assert.equal(chartWeek('1995-03-12', [chartDate, '1995-03-25']), null);
});

test('lookup rejects invalid and partial dates before contacting the provider', async () => {
  const lookup = createRadioLookup({ fetchImpl: () => assert.fail('must not fetch') });
  for (const date of [null, '', 'March 6', '1995-02-30', '1995-3-6', 'https://example.com']) await assert.rejects(lookup(date), /valid YYYY-MM-DD/);
  assert.equal((await lookup('1958-08-03')).status, 'before_hot_100');
  assert.equal((await lookup('9999-01-01')).status, 'no_chart');
});

test('returns the five ranked songs, correct date and attribution; shares requests for the same week', async () => {
  const urls = [];
  const lookup = createRadioLookup({ fetchImpl: async url => {
    urls.push(url);
    return response(url.endsWith('valid_dates.json') ? ['1995-03-04', chartDate] : { date: chartDate, data: [{ this_week: 6, song: 'Other', artist: 'Other' }, ...topFive.toReversed()] });
  } });
  const [a, b] = await Promise.all([lookup('1995-03-06'), lookup('1995-03-08')]);
  assert.deepEqual(a, b);
  assert.deepEqual(a.songs.map(song => song.rank), [1, 2, 3, 4, 5]);
  assert.deepEqual(a.songs[0], { rank: 1, title: 'Song 1', artist: 'Artist 1' });
  assert.equal(a.chart_date, chartDate);
  assert.equal(a.chart_url, `https://www.billboard.com/charts/hot-100/${chartDate}/`);
  assert.equal(a.source_url, 'https://github.com/mhollingshead/billboard-hot-100');
  assert.equal(urls.length, 2);
  await lookup('1995-03-10');
  assert.equal(urls.length, 2);
});

test('missing weeks return an explicit empty result rather than a neighboring chart', async () => {
  const lookup = createRadioLookup({ fetchImpl: async () => response(['1995-03-04', '1995-03-25']) });
  assert.deepEqual(await lookup('1995-03-06'), { status: 'no_chart', songs: [] });
});

test('invalid, mismatched and incomplete chart data fail safely', async () => {
  for (const chart of [{ date: '1995-03-18', data: topFive }, { date: chartDate, data: topFive.slice(0, 4) }, { date: chartDate, data: [topFive[0], ...topFive.slice(0, 4)] }, { date: chartDate, data: topFive.map(song => ({ ...song, artist: '' })) }]) {
    const lookup = createRadioLookup({ fetchImpl: async url => response(url.endsWith('valid_dates.json') ? [chartDate] : chart) });
    await assert.rejects(lookup('1995-03-06'), error => error.status === 502);
  }
});

test('failed requests can be retried and the date index refreshes after a day', async () => {
  let clock = Date.parse('2026-10-22'), calls = 0;
  const lookup = createRadioLookup({ now: () => clock, fetchImpl: async url => {
    calls++;
    if (calls === 1) throw new Error('offline');
    return response(url.endsWith('valid_dates.json') ? [chartDate] : { date: chartDate, data: topFive });
  } });
  await assert.rejects(lookup('1995-03-06'), /unavailable/);
  assert.equal((await lookup('1995-03-06')).status, 'available');
  assert.equal(calls, 3);
  clock += 86400001;
  await lookup('1995-03-06');
  assert.equal(calls, 4);
});
