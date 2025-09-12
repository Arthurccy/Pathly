import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { useBudget } from '../contexts/BudgetContext';

ChartJS.register(ArcElement, Tooltip, Legend);

interface ExpenseChartProps {
  viewMode?: 'monthly' | 'yearly';
}

const ExpenseChart: React.FC<ExpenseChartProps> = ({ viewMode = 'monthly' }) => {
  const { transactions, categories, selectedAccountIds } = useBudget();
  
  const currentDate = new Date();
  const periodStart = viewMode === 'monthly' ? startOfMonth(currentDate) : startOfYear(currentDate);
  const periodEnd = viewMode === 'monthly' ? endOfMonth(currentDate) : endOfYear(currentDate);
  
  const expenseTransactions = transactions.filter(
    t => t.type === 'expense' && 
         t.date >= periodStart && 
         t.date <= periodEnd &&
         (selectedAccountIds.length === 0 || selectedAccountIds.includes(t.accountId))
  );

  const expensesByCategory = expenseTransactions.reduce((acc, transaction) => {
    const category = categories.find(c => c.id === transaction.categoryId);
    if (category) {
      acc[category.name] = (acc[category.name] || 0) + transaction.amount;
    }
    return acc;
  }, {} as Record<string, number>);

  const data = {
    labels: Object.keys(expensesByCategory),
    datasets: [
      {
        data: Object.values(expensesByCategory),
        backgroundColor: categories
          .filter(c => expensesByCategory[c.name])
          .map(c => c.color),
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 20,
          usePointStyle: true,
          color: document.documentElement.classList.contains('dark') ? '#D1D5DB' : '#374151',
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.parsed;
            const total = Object.values(expensesByCategory).reduce((sum: number, val: number) => sum + val, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            return `${context.label}: ${value.toFixed(2)} € (${percentage}%)`;
          },
        },
      },
    },
  };

  const hasData = Object.keys(expensesByCategory).length > 0;
  const totalExpenses = Object.values(expensesByCategory).reduce((sum, val) => sum + val, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Répartition des dépenses
        </h3>
        <div className="text-right">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {viewMode === 'monthly' ? 'Ce mois' : 'Cette année'}
          </p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {totalExpenses.toFixed(2)} €
          </p>
        </div>
      </div>
      
      {hasData ? (
        <div className="h-64">
          <Doughnut data={data} options={options} />
        </div>
      ) : (
        <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <p className="text-lg mb-2">
              Aucune dépense {viewMode === 'monthly' ? 'ce mois-ci' : 'cette année'}
            </p>
            <p className="text-sm">Ajoutez des transactions pour voir les statistiques</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseChart;