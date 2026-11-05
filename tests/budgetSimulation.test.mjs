import test from 'node:test';
import assert from 'node:assert/strict';
import { getBudgetBaselineIncome } from '../src/utils/budgetSimulation.ts';

test('salary excludes refunds, savings withdrawals and internal transfers', () => {
  const allTransactions = [
    { type: 'income', amount: 1800, status: 'completed' },
    { type: 'refund', amount: 106, status: 'completed' },
    { type: 'savings_withdrawal', amount: 3000, status: 'completed' },
    { type: 'transfer', amount: 400, status: 'scheduled' },
    { type: 'income', amount: 700, status: 'cancelled' },
  ];
  assert.equal(getBudgetBaselineIncome([{ income: 5306, allTransactions }]), 1800);
});

test('averages all months including empty ones, with planned and pending income', () => {
  assert.equal(getBudgetBaselineIncome([
    { allTransactions: [{ type: 'income', amount: 2400, status: 'scheduled' }] },
    { allTransactions: [{ type: 'income', amount: 1200, status: 'pending' }] },
    { allTransactions: [] },
  ]), 1200);
});

test('handles missing or empty projections without falling back to cash movements', () => {
  assert.equal(getBudgetBaselineIncome([]), 0);
  assert.equal(getBudgetBaselineIncome([{ income: 5306 }]), 0);
});
