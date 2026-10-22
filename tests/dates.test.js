import test from 'node:test';
import assert from 'node:assert/strict';
import { dateLabel } from '../web/src/types.ts';

test('entry labels show the full interpreted year regardless of abbreviated or missing original year', () => {
  assert.equal(dateLabel({ date: '1995-03-06', date_as_written: 'March 6th 95' }), 'March 6, 1995');
  assert.equal(dateLabel({ date: '1995-03-24', date_as_written: 'March 24th' }), 'March 24, 1995');
  assert.equal(dateLabel({ date: '2000-01-01', date_as_written: '' }), 'January 1, 2000');
});
test('unknown or invalid dates retain the original wording without inventing a year', () => {
  assert.equal(dateLabel({ date: '', date_as_written: '' }), 'Undated passage');
  assert.equal(dateLabel({ date: '', date_as_written: 'March 24th' }), 'March 24th');
  assert.equal(dateLabel({ date: '1995-02-30', date_as_written: 'Unclear date' }), 'Unclear date');
});
