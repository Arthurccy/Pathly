import React from 'react';
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { useBudget } from '../contexts/BudgetContext';

interface BudgetProgressProps {
  viewMode?: 'monthly' | 'yearly';
}

const BudgetProgress: React.FC<BudgetProgressProps> = ({ viewMode = 'monthly' }) => {
  const { transactions, categories, budgets, selectedAccountIds } = useBudget();
  
  const currentDate = new Date();
  const periodStart = viewMode === 'monthly' ? startOfMonth(currentDate) : startOfYear(currentDate);
  const periodEnd = viewMode === 'monthly' ? endOfMonth(currentDate) : endOfYear(currentDate);
  
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
            <div key={index} className="space-y-2">
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
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          <p className="text-lg mb-2">Aucun budget défini</p>
          <p className="text-sm">Définissez des budgets dans les paramètres pour suivre vos dépenses</p>
        </div>
      )}
    </div>
  );
};

export default BudgetProgress;