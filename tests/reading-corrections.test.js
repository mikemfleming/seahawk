import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareCorrections, validateCorrections } from '../lib/reading-corrections.js';
import { createReadingGenerator } from '../lib/transcription.js';

test('confirmed names, places and other wording are restored without cascading or altering the original', () => {
  const original = '[Name?] met [Name?] at [Corpus?] in 16 [fathoms?].';
  const prepared = prepareCorrections(original, [{ as_written: '[Name?]', corrected: 'Captain Eddie' }, { as_written: '[Corpus?]', corrected: 'Corpus Christi' }, { as_written: '[fathoms?]', corrected: 'fathoms' }]);
  assert.equal(prepared.finish(prepared.text), 'Captain Eddie met Captain Eddie at Corpus Christi in 16 fathoms.');
  assert.equal(original, '[Name?] met [Name?] at [Corpus?] in 16 [fathoms?].');
  const separate = prepareCorrections('A B', [{ as_written: 'A', corrected: 'B' }, { as_written: 'B', corrected: 'C' }]);
  assert.equal(separate.finish(separate.text), 'B C');
  assert.throws(() => prepared.finish('Missing corrections'), /lost/);
});
test('invalid, duplicate, missing, and overlapping correction mappings are rejected', () => {
  for (const corrections of [{}, [{ as_written: '', corrected: 'A' }], [{ as_written: 'A', corrected: '' }], [{ as_written: 'A', corrected: 'B' }, { as_written: 'A', corrected: 'C' }]]) assert.throws(() => validateCorrections(corrections));
  assert.throws(() => prepareCorrections('A', [{ as_written: 'B', corrected: 'C' }]), /not found/);
  assert.throws(() => prepareCorrections('ABC', [{ as_written: 'ABC', corrected: 'D' }, { as_written: 'AB', corrected: 'E' }]), /overlap/);
});
test('an already applied correction does not block another confirmed name', async () => {
  const generate = createReadingGenerator({ apiKey: 'test', fetchImpl: async (_url, options) => {
    const text = JSON.parse(options.body).input.at(-1).content;
    return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ reading_version: text }) }] }] });
  } });
  const result = await generate('[Cameron?] Pratt and Bill Hudspeth were with me.', [
    { as_written: '[Cameron?]', corrected: 'Cameron' },
    { as_written: '[Hedgpeth?]', corrected: 'Hudspeth' },
  ]);
  assert.equal(result.reading_version, 'Cameron Pratt and Bill Hudspeth were with me.');
});
test('generation restores confirmed corrections but still protects unresolved brackets', async () => {
  let sent;
  const generate = createReadingGenerator({ apiKey: 'test', fetchImpl: async (_url, options) => {
    sent = JSON.parse(options.body).input.at(-1).content;
    return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ reading_version: sent + ' Good trip.' }) }] }] });
  } });
  const result = await generate('[Name?] fished near [place?].', [{ as_written: '[Name?]', corrected: 'Eddie' }]);
  assert.equal(sent.includes('[Name?]'), false);
  assert.equal(result.reading_version, 'Eddie fished near [place?]. Good trip.');
  assert.equal(result.reading_version_status, 'ai_draft');
  const lostMarker = createReadingGenerator({ apiKey: 'test', fetchImpl: async () => Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ reading_version: 'Eddie fished near Port Aransas.' }) }] }] }) });
  await assert.rejects(() => lostMarker('[Name?] fished near [place?].', [{ as_written: '[Name?]', corrected: 'Eddie' }]), /Invalid or incomplete/);
});
