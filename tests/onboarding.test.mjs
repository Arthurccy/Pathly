import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSignedAmount } from '../src/utils/amountInput.ts';
import { nextImportOccurrence, importRecurrenceCandidates } from '../src/utils/importRecurrence.ts';

test('balances accept French decimals, zero and negative amounts', () => {
  assert.equal(parseSignedAmount('-150,25'), -150.25);
  assert.equal(parseSignedAmount('-150.25'), -150.25);
  assert.equal(parseSignedAmount('0'), 0);
  assert.equal(parseSignedAmount('+42,50'), 42.5);
  for (const invalid of ['', '-', '12oops', '1,2,3', 'Infinity']) assert.ok(Number.isNaN(parseSignedAmount(invalid)));
});

test('recurrence proposals group repeated payments and avoid existing templates', () => {
  const tx = (id, date, other = {}) => ({ id, date: new Date(2026, date, 1), accountId: 'a', type: 'expense', description: 'Loyer', amount: 500, status: 'completed', isRecurring: false, ...other });
  const rows = [tx('older', 7), tx('latest', 9), tx('other-account', 9, { accountId: 'b' }), tx('cancelled', 9, { status: 'cancelled', description: 'Annulé' })];
  assert.deepEqual(importRecurrenceCandidates(rows, 'a').map(t => t.id), ['latest']);
  assert.deepEqual(importRecurrenceCandidates([...rows, tx('template', 10, { isRecurring: true, status: 'scheduled', description: ' LOYER ' })], 'a'), []);
});

test('next recurrence is always in the future even for an old CSV', () => {
  const now = new Date(2026, 10, 9);
  for (const frequency of ['weekly', 'monthly', 'quarterly', 'yearly']) {
    const date = nextImportOccurrence(new Date(2026, 1, 9), frequency, now);
    assert.ok(date > now);
  }
  assert.equal(nextImportOccurrence(new Date(2026, 9, 9), 'monthly', now).getMonth(), 11);
});
