import test from 'node:test';
import assert from 'node:assert/strict';
import { getBudgetIncomeBaseline } from '../src/utils/budgetSimulation.ts';

const now = new Date(2026, 10, 6);
const accounts = [
  { id: 'current', type: 'checking', isActive: true },
  { id: 'other', type: 'checking', isActive: true },
  { id: 'savings', type: 'savings', isActive: true },
  { id: 'closed', type: 'checking', isActive: false },
];
let id = 0;
const tx = (overrides = {}) => ({
  id: String(++id), accountId: 'current', categoryId: 'salary', type: 'income',
  status: 'completed', isRecurring: false, amount: 1800, description: 'Salaire',
  date: new Date(2026, 9, 28), ...overrides,
});
const baseline = (transactions, selected = [], categories = []) =>
  getBudgetIncomeBaseline(transactions, accounts, categories, selected, now);

test('uses actual salary, not multiple future salaries and recurring templates', () => {
  const result = baseline([
    tx(),
    tx({ isRecurring: true, amount: 1700, recurringPattern: { isActive: true } }),
    tx({ date: new Date(2026, 11, 1), amount: 1795, status: 'scheduled' }),
    tx({ date: new Date(2026, 10, 1), amount: 1800 }),
    tx({ amount: 4000, status: 'pending' }),
    tx({ amount: 4000, status: 'cancelled' }),
  ]);
  assert.equal(result.amount, 1800);
  assert.equal(result.transactions.length, 1);
  assert.equal(result.monthCount, 1);
});

test('excludes refunds, withdrawals and internal transfers', () => {
  assert.equal(baseline([tx(), ...['refund', 'savings_withdrawal', 'transfer'].map(type => tx({ type, amount: 3506 }))]).amount, 1800);
});

test('uses six complete months and counts empty months when history is older', () => {
  const result = baseline([
    tx({ date: new Date(2025, 0, 1), amount: 100 }),
    tx({ date: new Date(2026, 3, 30), amount: 100000 }),
    tx({ date: new Date(2026, 4, 1), amount: 1800 }),
    tx({ date: new Date(2026, 9, 31, 23, 59, 59), amount: 1800 }),
    tx({ date: new Date(2026, 10, 1), amount: 100000 }),
  ]);
  assert.equal(result.amount, 600);
  assert.equal(result.monthCount, 6);
  assert.equal(result.transactions.length, 2);
});

test('uses available history and includes months with no income', () => {
  const result = baseline([tx({ date: new Date(2026, 7, 1), type: 'expense' }), tx()]);
  assert.equal(result.monthCount, 3);
  assert.equal(result.amount, 600);
});

test('respects selected accounts, excluded categories and active current accounts', () => {
  const transactions = [tx(), tx({ accountId: 'other', amount: 900 }), tx({ accountId: 'savings' }), tx({ accountId: 'closed' }), tx({ categoryId: 'excluded' })];
  const result = baseline(transactions, ['current'], [{ id: 'excluded', excludeFromReports: true }]);
  assert.equal(result.amount, 1800);
  assert.equal(result.transactions.length, 1);
  assert.equal(baseline(transactions, ['other']).amount, 900);
});

test('does not invent income when only plans or templates exist', () => {
  const result = baseline([tx({ isRecurring: true }), tx({ status: 'scheduled' })]);
  assert.equal(result.amount, 0);
  assert.equal(result.monthCount, 0);
  assert.equal(result.transactions.length, 0);
});
