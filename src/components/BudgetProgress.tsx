import React, { useState } from 'react';
import { format, startOfYear, endOfYear } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBudget } from '../contexts/BudgetContext';
import { useAuth } from '../contexts/AuthContext';
import { getCustomMonthPeriod } from '../utils/dateUtils';

interface BudgetProgressProps {
  viewMode?: 'monthly' | 'yearly';
}

const BudgetProgress: React.FC<BudgetProgressProps> = ({ viewMode = 'monthly' }) => {
  const { transactions, categories, budgets, accounts, selectedAccountIds } = useBudget();
  const { user } = useAuth();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  
  const monthStartDay = user?.settings?.monthStartDay || 1;
  const currentDate = new Date();
  const customMonthPeriod = getCustomMonthPeriod(currentDate, monthStartDay);
  const periodStart = viewMode === 'monthly' ? customMonthPeriod.start : startOfYear(currentDate);
  const periodEnd = viewMode === 'monthly' ? customMonthPeriod.end : endOfYear(currentDate);
  
  const currentPeriodBudgets = budgets.filter(
    b => b.period === viewMode && b.isActive &&
         b.startDate <= periodEnd && (!b.endDate || b.endDate >= periodStart)
  );

  const budgetProgress = currentPeriodBudgets.map(budget => {
    const category = categories.find(c => c.id === budget.categoryId);
    const spent = transactions
      .filter(t => 
        t.categoryId === budget.categoryId && 
        t.type === 'expense' && 
        t.date >= periodStart && 
        t.date <= periodEnd &&
        (selectedAccountIds.length === 0 || selectedAccountIds.includes(t.accountId))
      )
      .reduce((sum, t) => sum + t.amount, 0);
    
    const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
    
    return {
      categoryId: budget.categoryId,
      category: category?.name || 'Catégorie inconnue',
      color: category?.color || '#6B7280',
      budgeted: budget.amount,
      spent,
      percentage: Math.min(percentage, 100),
      isOverBudget: spent > budget.amount,
    };
  });

  // Add categories with default budgets but no explicit budget set
  const categoriesWithDefaultBudgets = categories.filter(c => 
    c.type === 'expense' && 
    c.budget && 
    !currentPeriodBudgets.some(b => b.categoryId === c.id)
  );

  categoriesWithDefaultBudgets.forEach(category => {
    const spent = transactions
      .filter(t => 
        t.categoryId === category.id && 
        t.type === 'expense' && 
        t.date >= periodStart && 
        t.date <= periodEnd &&
        (selectedAccountIds.length === 0 || selectedAccountIds.includes(t.accountId))
      )
      .reduce((sum, t) => sum + t.amount, 0);
    
    const budgetAmount = category.budget || 0;
    const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
    
    budgetProgress.push({
      categoryId: category.id,
      category: category.name,
      color: category.color,
      budgeted: budgetAmount,
      spent,
      percentage: Math.min(percentage, 100),
      isOverBudget: spent > budgetAmount,
    });
  });

  const totalBudgeted = budgetProgress.reduce((sum, item) => sum + item.budgeted, 0);
  const totalSpent = budgetProgress.reduce((sum, item) => sum + item.spent, 0);
  const selectedBudgetCategory = selectedCategoryId
    ? categories.find(category => category.id === selectedCategoryId)
    : null;
  const selectedTransactions = selectedCategoryId
    ? transactions
        .filter(transaction =>
          transaction.categoryId === selectedCategoryId &&
          transaction.type === 'expense' &&
          transaction.date >= periodStart &&
          transaction.date <= periodEnd &&
          (selectedAccountIds.length === 0 || selectedAccountIds.includes(transaction.accountId))
        )
        .sort((a, b) => b.date.getTime() - a.date.getTime())
    : [];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Suivi des budgets
        </h3>
        <div className="text-right">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {viewMode === 'monthly' ? 'Ce mois' : 'Cette année'}
          </p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {totalSpent.toFixed(2)} € / {totalBudgeted.toFixed(2)} €
          </p>
        </div>
      </div>
      
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
                </div>
                <span className={`text-sm font-medium ${
                  item.isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {item.spent.toFixed(2)} € / {item.budgeted.toFixed(2)} €
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
                <span>{item.percentage.toFixed(1)}% utilisé</span>
                {item.isOverBudget ? (
                  <span className="text-red-600 dark:text-red-400 font-medium">
                    Dépassement de {(item.spent - item.budgeted).toFixed(2)} €
                  </span>
                ) : (
                  <span className="text-green-600 dark:text-green-400">
                    Reste {(item.budgeted - item.spent).toFixed(2)} €
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
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

            <div className="max-h-[65vh] overflow-y-auto p-6">
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
