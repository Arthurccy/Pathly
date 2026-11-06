import type { BankAccount, Category, Transaction } from '../types';

/** Use settled history, never recurring templates or future projections, as income. */
export function getBudgetIncomeBaseline(
  transactions: Transaction[],
  accounts: BankAccount[],
  categories: Category[],
  selectedAccountIds: string[] = [],
  now = new Date(),
) {
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  const earliest = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const eligibleAccounts = new Set(accounts.filter(account =>
    account.isActive &&
    ['checking', 'cash', 'credit'].includes(account.type) &&
    (selectedAccountIds.length === 0 || selectedAccountIds.includes(account.id))
  ).map(account => account.id));
  const excludedCategories = new Set(categories.filter(category => category.excludeFromReports).map(category => category.id));
  const settled = transactions.filter(transaction =>
    transaction.status === 'completed' &&
    !transaction.isRecurring &&
    eligibleAccounts.has(transaction.accountId) &&
    !excludedCategories.has(transaction.categoryId) &&
    transaction.date < end
  );
  const history = settled.filter(transaction => transaction.date >= earliest);
  // Count months with no income too, but not months before the available history.
  const firstDate = settled.reduce((date, transaction) => Math.min(date, transaction.date.getTime()), end.getTime());
  const start = new Date(Math.max(firstDate, earliest.getTime()));
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const monthCount = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
  const incomeTransactions = history.filter(transaction => transaction.type === 'income')
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const total = incomeTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  return { amount: monthCount > 0 ? Math.round(total / monthCount) : 0, monthCount, start, end, transactions: incomeTransactions };
}
