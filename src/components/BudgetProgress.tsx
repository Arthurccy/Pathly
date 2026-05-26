import React, { useState } from 'react';
import { addDays, addMonths, addWeeks, addYears, format, startOfDay, startOfYear, endOfYear } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBudget } from '../contexts/BudgetContext';
import { useAuth } from '../contexts/AuthContext';
import { getCustomMonthPeriod } from '../utils/dateUtils';
import { Transaction } from '../types';

interface BudgetProgressProps {
  viewMode?: 'monthly' | 'yearly';
}

const BudgetProgress: React.FC<BudgetProgressProps> = ({ viewMode = 'monthly' }) => {
  const { transactions, categories, budgets, accounts, debts, selectedAccountIds } = useBudget();
  const { user } = useAuth();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  
  const monthStartDay = user?.settings?.monthStartDay || 1;
  const currentDate = new Date();
  const customMonthPeriod = getCustomMonthPeriod(currentDate, monthStartDay);
  const periodStart = viewMode === 'monthly' ? customMonthPeriod.start : startOfYear(currentDate);
  const periodEnd = viewMode === 'monthly' ? customMonthPeriod.end : endOfYear(currentDate);
  const today = startOfDay(currentDate);
  const selectedAccountSet = new Set(selectedAccountIds);
  const shouldIncludeAccount = (accountId: string) =>
    selectedAccountIds.length === 0 || selectedAccountSet.has(accountId);
  const checkingAccountIds = new Set(
    accounts
      .filter(account => account.isActive && account.type === 'checking' && shouldIncludeAccount(account.id))
      .map(account => account.id)
  );
  const currentAccountBalance = accounts
    .filter(account => checkingAccountIds.has(account.id))
    .reduce((sum, account) => sum + account.balance, 0);
  const getTransactionImpact = (transaction: Transaction) => {
    const isCheckingTransaction = checkingAccountIds.has(transaction.accountId);

    if (transaction.type === 'transfer') {
      if (!isCheckingTransaction) return 0;
      return transaction.description.toLowerCase().includes('depuis')
        ? transaction.amount
        : -transaction.amount;
    }

    if (!isCheckingTransaction) return 0;
    if (transaction.type === 'income' || transaction.type === 'refund') return transaction.amount;
    if (transaction.type === 'expense' || transaction.type === 'bill' || transaction.type === 'savings') return -transaction.amount;
    return 0;
  };
  const getNextOccurrenceDate = (date: Date, transaction: Transaction) => {
    const pattern = transaction.recurringPattern;
    if (!pattern) return null;

    switch (pattern.frequency) {
      case 'daily':
        return addDays(date, pattern.interval);
      case 'weekly':
        return addWeeks(date, pattern.interval);
      case 'monthly':
        return addMonths(date, pattern.interval);
      case 'quarterly':
        return addMonths(date, pattern.interval * 3);
      case 'yearly':
        return addYears(date, pattern.interval);
      default:
        return addMonths(date, 1);
    }
  };
  const addImpactToProjection = (
    projection: { incoming: number; deductions: number },
    impact: number
  ) => impact > 0
    ? { ...projection, incoming: projection.incoming + impact }
    : { ...projection, deductions: projection.deductions + Math.abs(impact) };
  const upcomingTransactionProjection = transactions.reduce((projection, transaction) => {
    const impact = getTransactionImpact(transaction);
    if (impact === 0) return projection;

    if (!transaction.isRecurring || !transaction.recurringPattern?.isActive) {
      const transactionDate = startOfDay(transaction.date);
      if (
        transaction.status === 'scheduled' &&
        transactionDate >= today &&
        transactionDate <= periodEnd
      ) {
        return addImpactToProjection(projection, impact);
      }
      return projection;
    }

    const pattern = transaction.recurringPattern;
    let nextDate = startOfDay(pattern.nextDate);
    let occurrenceCount = pattern.currentOccurrence || 0;
    let recurringProjection = projection;

    while (nextDate <= periodEnd) {
      const hasReachedEndDate = pattern.endDate && nextDate > startOfDay(pattern.endDate);
      const hasReachedMaxOccurrences = pattern.maxOccurrences && occurrenceCount >= pattern.maxOccurrences;
      if (hasReachedEndDate || hasReachedMaxOccurrences) break;

      if (nextDate >= today) {
        recurringProjection = addImpactToProjection(recurringProjection, impact);
      }

      const followingDate = getNextOccurrenceDate(nextDate, transaction);
      if (!followingDate || followingDate <= nextDate) break;
      nextDate = startOfDay(followingDate);
      occurrenceCount += 1;
    }

    return recurringProjection;
  }, { incoming: 0, deductions: 0 });
  const upcomingDebtPayments = debts
    .filter(debt =>
      debt.isActive &&
      checkingAccountIds.has(debt.accountId) &&
      startOfDay(debt.dueDate) >= today &&
      startOfDay(debt.dueDate) <= periodEnd
    )
    .reduce((sum, debt) => sum + debt.minimumPayment, 0);
  const projectedCurrentBalance =
    currentAccountBalance +
    upcomingTransactionProjection.incoming -
    upcomingTransactionProjection.deductions -
    upcomingDebtPayments;
  
  const currentPeriodBudgets = budgets.filter(
    b => b.period === viewMode && b.isActive &&
         b.startDate <= periodEnd && (!b.endDate || b.endDate >= periodStart)
  );

  const getCompletedExpensesForCategory = (categoryId: string) => transactions
    .filter(t =>
      t.categoryId === categoryId &&
      t.type === 'expense' &&
      t.status === 'completed' &&
      categories.find(category => category.id === t.categoryId)?.excludeFromReports !== true &&
      t.date >= periodStart &&
      t.date <= periodEnd &&
      (selectedAccountIds.length === 0 || selectedAccountIds.includes(t.accountId))
    )
    .reduce((sum, t) => sum + t.amount, 0);

  const getPlannedExpensesForCategory = (categoryId: string) => transactions
    .filter(t =>
      t.categoryId === categoryId &&
      t.type === 'expense' &&
      t.status === 'scheduled' &&
      categories.find(category => category.id === t.categoryId)?.excludeFromReports !== true &&
      checkingAccountIds.has(t.accountId) &&
      t.date >= today &&
      t.date <= periodEnd
    )
    .reduce((sum, t) => sum + t.amount, 0);

  const budgetProgress = currentPeriodBudgets.map(budget => {
    const category = categories.find(c => c.id === budget.categoryId);
    if (category?.excludeFromReports) return null;
    const spent = getCompletedExpensesForCategory(budget.categoryId);
    const planned = getPlannedExpensesForCategory(budget.categoryId);
    const committed = spent + planned;
    
    const percentage = budget.amount > 0 ? (committed / budget.amount) * 100 : 0;
    
    return {
      categoryId: budget.categoryId,
      category: category?.name || 'Catégorie inconnue',
      color: category?.color || '#6B7280',
      budgeted: budget.amount,
      spent,
      planned,
      committed,
      percentage: Math.min(percentage, 100),
      isOverBudget: committed > budget.amount,
      isUnplanned: false,
    };
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  // Add categories with default budgets but no explicit budget set
  const categoriesWithDefaultBudgets = categories.filter(c => 
    c.type === 'expense' && 
    !c.excludeFromReports &&
    c.budget && 
    !currentPeriodBudgets.some(b => b.categoryId === c.id)
  );

  categoriesWithDefaultBudgets.forEach(category => {
    const spent = getCompletedExpensesForCategory(category.id);
    const planned = getPlannedExpensesForCategory(category.id);
    const committed = spent + planned;
    
    const budgetAmount = category.budget || 0;
    const percentage = budgetAmount > 0 ? (committed / budgetAmount) * 100 : 0;
    
    budgetProgress.push({
      categoryId: category.id,
      category: category.name,
      color: category.color,
      budgeted: budgetAmount,
      spent,
      planned,
      committed,
      percentage: Math.min(percentage, 100),
      isOverBudget: committed > budgetAmount,
      isUnplanned: false,
    });
  });

  const budgetedCategoryIds = new Set(budgetProgress.map(item => item.categoryId));
  const unplannedCategories = categories
    .filter(category =>
      category.type === 'expense' &&
      !category.excludeFromReports &&
      !budgetedCategoryIds.has(category.id)
    )
    .map(category => {
      const spent = getCompletedExpensesForCategory(category.id);
      const planned = getPlannedExpensesForCategory(category.id);
      const committed = spent + planned;

      return {
        categoryId: category.id,
        category: category.name,
        color: category.color,
        budgeted: 0,
        spent,
        planned,
        committed,
        percentage: committed > 0 ? 100 : 0,
        isOverBudget: committed > 0,
        isUnplanned: true,
      };
    })
    .filter(item => item.committed > 0);

  budgetProgress.push(...unplannedCategories);
  budgetProgress.sort((a, b) => {
    if (a.isUnplanned !== b.isUnplanned) return a.isUnplanned ? -1 : 1;
    return b.committed - a.committed;
  });

  const totalBudgeted = budgetProgress.reduce((sum, item) => sum + item.budgeted, 0);
  const totalPlanned = budgetProgress.reduce((sum, item) => sum + item.planned, 0);
  const totalCommitted = budgetProgress.reduce((sum, item) => sum + item.committed, 0);
  const totalUnplannedSpent = budgetProgress
    .filter(item => item.isUnplanned)
    .reduce((sum, item) => sum + item.committed, 0);
  const remainingBudgets = budgetProgress.reduce(
    (sum, item) => sum + Math.max(item.budgeted - item.committed, 0),
    0
  );
  const projectedAfterBudgets = projectedCurrentBalance - remainingBudgets;
  const selectedBudgetCategory = selectedCategoryId
    ? categories.find(category => category.id === selectedCategoryId)
    : null;
  const selectedTransactions = selectedCategoryId
    ? transactions
        .filter(transaction =>
          transaction.categoryId === selectedCategoryId &&
          transaction.type === 'expense' &&
          (transaction.status === 'completed' || transaction.status === 'scheduled') &&
          transaction.date >= periodStart &&
          transaction.date <= periodEnd &&
          (selectedAccountIds.length === 0 || selectedAccountIds.includes(transaction.accountId))
        )
        .sort((a, b) => b.date.getTime() - a.date.getTime())
    : [];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Suivi des budgets
        </h3>
        <div className="text-right">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {viewMode === 'monthly' ? 'Période' : 'Cette année'}
          </p>
          {viewMode === 'monthly' && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {format(periodStart, 'dd MMM', { locale: fr })} - {format(periodEnd, 'dd MMM', { locale: fr })}
            </p>
          )}
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {totalCommitted.toFixed(2)} € / {totalBudgeted.toFixed(2)} €
          </p>
          {totalPlanned > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              dont {totalPlanned.toFixed(2)} € à venir
            </p>
          )}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
          <p className="text-sm text-gray-500 dark:text-gray-400">Solde courant prévu</p>
          <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
            {projectedCurrentBalance.toFixed(2)} €
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
          <p className="text-sm text-gray-500 dark:text-gray-400">Budgets encore libres</p>
          <p className="mt-1 text-xl font-semibold text-orange-600 dark:text-orange-400">
            -{remainingBudgets.toFixed(2)} €
          </p>
        </div>

        <div className="rounded-lg bg-gray-950 p-4 text-white dark:bg-white dark:text-gray-950">
          <p className="text-sm text-gray-300 dark:text-gray-600">Après budgets</p>
          <p className={`mt-1 text-xl font-semibold ${projectedAfterBudgets >= 0 ? 'text-emerald-300 dark:text-emerald-700' : 'text-red-300 dark:text-red-700'}`}>
            {projectedAfterBudgets.toFixed(2)} €
          </p>
        </div>
      </div>

      {totalUnplannedSpent > 0 && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-900/20">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            Dépenses non prévues: {totalUnplannedSpent.toFixed(2)} €
          </p>
          <p className="mt-1 text-xs text-red-700 dark:text-red-300">
            Ces catégories ont eu des dépenses sur la période mais aucun budget défini.
          </p>
        </div>
      )}
      
      {budgetProgress.length > 0 ? (
        <div className="space-y-4">
          {budgetProgress.map((item, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setSelectedCategoryId(item.categoryId)}
              className="block w-full space-y-2 rounded-lg p-2 text-left transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:bg-gray-700/50"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {item.category}
                  </span>
                  {item.isUnplanned && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                      Non prévu
                    </span>
                  )}
                </div>
                <span className={`text-sm font-medium ${
                  item.isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {item.isUnplanned
                    ? `${item.committed.toFixed(2)} €`
                    : `${item.committed.toFixed(2)} € / ${item.budgeted.toFixed(2)} €`
                  }
                </span>
              </div>
              
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    item.isOverBudget 
                      ? 'bg-red-500' 
                      : item.percentage > 80 
                        ? 'bg-orange-500' 
                        : 'bg-green-500'
                  }`}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
              
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>
                  {item.percentage.toFixed(1)}% engagé
                  {item.planned > 0 ? ` · ${item.planned.toFixed(2)} € à venir` : ''}
                </span>
                {item.isUnplanned ? (
                  <span className="text-red-600 dark:text-red-400 font-medium">
                    Hors budget
                  </span>
                ) : item.isOverBudget ? (
                  <span className="text-red-600 dark:text-red-400 font-medium">
                    Dépassement de {(item.committed - item.budgeted).toFixed(2)} €
                  </span>
                ) : (
                  <span className="text-green-600 dark:text-green-400">
                    Reste {(item.budgeted - item.committed).toFixed(2)} €
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          <p className="text-lg mb-2">Aucun budget défini</p>
          <p className="text-sm">Définissez des budgets dans les paramètres pour suivre vos dépenses</p>
        </div>
      )}

      {selectedBudgetCategory && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92dvh] w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-gray-900 sm:max-w-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-semibold text-gray-950 dark:text-white">{selectedBudgetCategory.name}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedTransactions.length} dépense{selectedTransactions.length > 1 ? 's' : ''} sur la période
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCategoryId(null)}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            <div className="max-h-[calc(92dvh-5rem)] overflow-y-auto p-4 sm:p-6">
              {selectedTransactions.length > 0 ? (
                <div className="space-y-3">
                  {selectedTransactions.map(transaction => {
                    const account = accounts.find(item => item.id === transaction.accountId);
                    return (
                      <div key={transaction.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{transaction.description}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {format(transaction.date, 'dd MMM yyyy', { locale: fr })}
                            {account ? ` - ${account.name}` : ''}
                            {transaction.status === 'scheduled' ? ' - à venir' : ''}
                          </p>
                        </div>
                        <p className="ml-4 whitespace-nowrap text-sm font-semibold text-red-600 dark:text-red-400">
                          -{transaction.amount.toFixed(2)} €
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                  Aucune dépense sur cette période
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetProgress;
