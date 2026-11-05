import type { CashFlow } from '../types';

// Cash-flow income also includes refunds and money moved out of savings.
// Only transactions classified as income belong in the simulator's revenue baseline.
export function getBudgetBaselineIncome(projections: CashFlow[]): number {
  if (projections.length === 0) return 0;

  const income = projections.reduce((total, month) => total +
    (month.allTransactions ?? [])
      .filter(transaction => transaction.type === 'income' &&
        (transaction.status === 'completed' || transaction.status === 'scheduled' || transaction.status === 'pending'))
      .reduce((sum, transaction) => sum + transaction.amount, 0), 0);

  return Math.round(income / projections.length);
}
