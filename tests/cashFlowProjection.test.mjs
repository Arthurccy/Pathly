import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCashFlowProjection } from '../src/utils/cashFlowProjection.ts';

const date = (day) => new Date(2026, 10, day);
const start = new Date(2026, 9, 25);
const tx = (overrides = {}) => ({
  id: 'bill', accountId: 'checking', categoryId: 'bills', type: 'expense',
  amount: 128, description: 'Électricité', status: 'pending',
  date: date(5), isRecurring: false, ...overrides,
});
const inputs = (overrides = {}) => ({
  accounts: [{ id: 'checking', isActive: true, type: 'checking', balance: 1008.08 },
    { id: 'savings', isActive: true, type: 'savings', balance: 3325.09 }],
  transactions: [], categories: [{ id: 'bills', type: 'bill' }], debts: [],
  budgets: [], selectedAccountIds: [], getProjectedRecurringTransactions: () => [],
  ...overrides,
});
const project = (data, now = date(6)) => calculateCashFlowProjection(data, 1, start, 25, now)[0];

for (const status of ['scheduled', 'pending']) {
  test(`${status} expense stays deducted before, on and after its due date`, () => {
    const data = inputs({ transactions: [tx({ status })] });
    for (const day of [4, 5, 6, 10, 20]) {
      const result = project(data, date(day));
      assert.equal(result.remainingExpenses, 128);
      assert.equal(result.projectedBalance, 880.08);
      assert.equal(result.projectedTotalBalance, 4205.17);
    }
  });
}

test('settlement changes account balance and removes the outstanding deduction exactly once', () => {
  const planned = project(inputs({ transactions: [tx()] }));
  const settled = project(inputs({
    accounts: [{ id: 'checking', isActive: true, type: 'checking', balance: 880.08 }],
    transactions: [tx({ status: 'completed' })],
  }));
  assert.equal(settled.projectedBalance, planned.projectedBalance);
  assert.equal(settled.remainingExpenses, 0);
});

test('debt estimate remains until represented by a payment, even after due date', () => {
  const debt = { id: 'loan', name: 'Prêt étudiant', categoryId: 'debt', accountId: 'checking', isActive: true, remainingAmount: 5000, minimumPayment: 281.16, dueDate: date(10) };
  const data = inputs({ debts: [debt] });
  assert.equal(project(data, date(9)).projectedBalance, project(data, date(11)).projectedBalance);
  assert.equal(project(data, date(11)).debtPayments, 281.16);
  const paid = project(inputs({ ...data,
    accounts: [{ id: 'checking', isActive: true, type: 'checking', balance: 726.92 }],
    transactions: [tx({ id: 'paid', type: 'expense', description: 'Dette: Prêt étudiant', categoryId: 'debt', amount: 281.16, date: date(10), status: 'completed' })],
  }), date(11));
  assert.equal(paid.debtPayments, 0);
  assert.equal(paid.projectedBalance, 726.92);
});

test('overdue income and savings transfers remain, without counting completed salary again', () => {
  const result = project(inputs({ transactions: [
    tx({ id: 'salary', status: 'completed', type: 'income', amount: 2283.36 }),
    tx({ id: 'aid', type: 'income', amount: 128 }),
    tx({ id: 'transfer', type: 'transfer', amount: 200, transferToAccountId: 'savings', description: 'Virement vers Livret A' }),
  ] }));
  assert.equal(result.remainingIncome, 128);
  assert.equal(result.remainingExpenses, 200);
  assert.equal(result.projectedBalance, 936.08);
  assert.equal(result.projectedSavingsBalance, 3525.09);
});

test('budget reserves do not shrink as time passes and spending consumes the reserve', () => {
  const data = inputs({ budgets: [{ id: 'budget', categoryId: 'food', amount: 550, period: 'monthly', startDate: start, isActive: true }], categories: [{ id: 'food', name: 'Courses', type: 'expense' }], transactions: [tx({ categoryId: 'food', amount: 100 })] });
  const before = project(data, date(4));
  const after = project(data, date(6));
  assert.equal(before.budgetReserve, 450);
  assert.equal(after.projectedBalance, before.projectedBalance);
  const settled = project(inputs({ ...data, accounts: [{ id: 'checking', isActive: true, type: 'checking', balance: 908.08 }], transactions: [tx({ categoryId: 'food', amount: 100, status: 'completed' })] }));
  assert.equal(settled.projectedBalance, before.projectedBalance);
});

test('a missed recurrence stays counted when retained as a pending occurrence', () => {
  const before = project(inputs({ getProjectedRecurringTransactions: () => [tx({ status: 'scheduled' })] }), date(4));
  const after = project(inputs({ transactions: [tx({ status: 'pending' })] }), date(6));
  assert.equal(after.projectedBalance, before.projectedBalance);
});

test('cancelled operations and those outside the budget period do not affect the forecast', () => {
  const result = project(inputs({ transactions: [tx({ status: 'cancelled' }), tx({ date: new Date(2026, 9, 24) }), tx({ date: date(25) })] }));
  assert.equal(result.projectedBalance, 1008.08);
  assert.equal(result.remainingExpenses, 0);
});
