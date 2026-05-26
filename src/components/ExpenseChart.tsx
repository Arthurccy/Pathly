import React, { useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { endOfYear, format, startOfYear } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBudget } from '../contexts/BudgetContext';
import { useAuth } from '../contexts/AuthContext';
import { getCustomMonthPeriod } from '../utils/dateUtils';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface ExpenseChartProps {
  viewMode?: 'monthly' | 'yearly';
}

const ExpenseChart: React.FC<ExpenseChartProps> = ({ viewMode = 'monthly' }) => {
  const { transactions, categories, accounts, selectedAccountIds } = useBudget();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const { user } = useAuth();
  const monthStartDay = user?.settings?.monthStartDay || 1;
  const currentDate = new Date();
  const currentMonthPeriod = getCustomMonthPeriod(currentDate, monthStartDay);
  const periodStart = viewMode === 'monthly' ? currentMonthPeriod.start : startOfYear(currentDate);
  const periodEnd = viewMode === 'monthly' ? currentMonthPeriod.end : endOfYear(currentDate);

  const periodTransactions = transactions.filter(
    t => t.status === 'completed' &&
         t.date >= periodStart &&
         t.date <= periodEnd &&
         (selectedAccountIds.length === 0 || selectedAccountIds.includes(t.accountId))
  );

  const expenseTransactions = periodTransactions.filter(t => t.type === 'expense');

  const expensesByCategory = expenseTransactions.reduce((acc, transaction) => {
    const category = categories.find(c => c.id === transaction.categoryId);
    if (category) {
      acc[category.id] = {
        id: category.id,
        name: category.name,
        color: category.color,
        amount: (acc[category.id]?.amount || 0) + transaction.amount,
      };
    }
    return acc;
  }, {} as Record<string, { id: string; name: string; color: string; amount: number }>);
  const categoryBreakdown = Object.values(expensesByCategory);
  const selectedCategory = selectedCategoryId
    ? categories.find(category => category.id === selectedCategoryId)
    : null;
  const selectedTransactions = selectedCategoryId
    ? expenseTransactions
        .filter(transaction => transaction.categoryId === selectedCategoryId)
        .sort((a, b) => b.date.getTime() - a.date.getTime())
    : [];

  const data = {
    labels: categoryBreakdown.map(category => category.name),
    datasets: [
      {
        data: categoryBreakdown.map(category => category.amount),
        backgroundColor: categoryBreakdown.map(category => category.color),
        borderWidth: 2,
        borderColor: '#ffffff',
        cutout: '52%',
        radius: '96%',
        hoverOffset: 8,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 100,
    layout: {
      padding: 8,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.parsed;
            const total = categoryBreakdown.reduce((sum, category) => sum + category.amount, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            return `${context.label}: ${value.toFixed(2)} € (${percentage}%)`;
          },
        },
      },
    },
    animation: {
      duration: 250,
    },
    onClick: (_event: unknown, elements: any[]) => {
      const element = elements[0];
      if (!element) return;
      setSelectedCategoryId(categoryBreakdown[element.index]?.id || null);
    },
    onHover: (event: any, elements: any[]) => {
      event.native.target.style.cursor = elements.length ? 'pointer' : 'default';
    },
  };

  const hasData = categoryBreakdown.length > 0;
  const totalExpenses = categoryBreakdown.reduce((sum, category) => sum + category.amount, 0);
  const moneyFormatter = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  });
  const preciseMoneyFormatter = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const baseIncome = periodTransactions
    .filter(t => t.type === 'income' || t.type === 'refund' || t.type === 'savings_withdrawal')
    .reduce((sum, t) => sum + t.amount, 0);
  const outgoingTransactions = periodTransactions
    .filter(t => t.type === 'expense' || t.type === 'bill' || t.type === 'savings')
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const totalOutgoings = outgoingTransactions.reduce((sum, t) => sum + t.amount, 0);
  const remainingIncome = baseIncome - totalOutgoings;

  const MAX_WATERFALL_DEDUCTIONS = 8;
  const displayedOutgoings = outgoingTransactions.slice(0, MAX_WATERFALL_DEDUCTIONS);
  const otherOutgoingsAmount = outgoingTransactions
    .slice(MAX_WATERFALL_DEDUCTIONS)
    .reduce((sum, t) => sum + t.amount, 0);

  let runningBalance = baseIncome;
  const waterfallItems: {
    label: string;
    shortLabel: string;
    value: number;
    range: [number, number];
    color: string;
  }[] = [
    {
      label: 'Revenus de base',
      shortLabel: 'Revenus',
      value: baseIncome,
      range: [0, baseIncome],
      color: '#059669',
    },
  ];

  displayedOutgoings.forEach(transaction => {
    const start = runningBalance;
    runningBalance -= transaction.amount;
    const category = categories.find(c => c.id === transaction.categoryId);
    const label = `${format(transaction.date, 'dd MMM', { locale: fr })} · ${transaction.description || category?.name || 'Sortie'}`;

    waterfallItems.push({
      label,
      shortLabel: transaction.description || category?.name || 'Sortie',
      value: -transaction.amount,
      range: [Math.min(start, runningBalance), Math.max(start, runningBalance)],
      color: transaction.type === 'savings' ? '#2563EB' : '#DC2626',
    });
  });

  if (otherOutgoingsAmount > 0) {
    const start = runningBalance;
    runningBalance -= otherOutgoingsAmount;
    waterfallItems.push({
      label: 'Autres sorties',
      shortLabel: 'Autres',
      value: -otherOutgoingsAmount,
      range: [Math.min(start, runningBalance), Math.max(start, runningBalance)],
      color: '#EA580C',
    });
  }

  waterfallItems.push({
    label: 'Reste en fin de période',
    shortLabel: 'Reste',
    value: remainingIncome,
    range: [Math.min(0, remainingIncome), Math.max(0, remainingIncome)],
    color: remainingIncome >= 0 ? '#0891B2' : '#B91C1C',
  });

  const hasCashFlowData = baseIncome > 0 || totalOutgoings > 0;
  const outgoingRatio = baseIncome > 0 ? Math.min((totalOutgoings / baseIncome) * 100, 999) : 0;
  const waterfallData = {
    labels: waterfallItems.map(item => item.shortLabel),
    datasets: [
      {
        label: 'Impact sur le revenu',
        data: waterfallItems.map(item => item.range),
        backgroundColor: waterfallItems.map(item => item.color),
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };
  const waterfallOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          title: (context: any) => waterfallItems[context[0].dataIndex]?.label || '',
          label: (context: any) => {
            const item = waterfallItems[context.dataIndex];
            const sign = item.value > 0 ? '+' : '';
            return `${sign}${preciseMoneyFormatter.format(item.value)}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: document.documentElement.classList.contains('dark') ? '#D1D5DB' : '#4B5563',
          maxRotation: 0,
          autoSkip: false,
          callback: (_value: string | number, index: number) => {
            const label = waterfallItems[index]?.shortLabel || '';
            return label.length > 12 ? `${label.slice(0, 12)}...` : label;
          },
        },
        grid: {
          display: false,
        },
      },
      y: {
        ticks: {
          color: document.documentElement.classList.contains('dark') ? '#D1D5DB' : '#4B5563',
          callback: (value: string | number) => moneyFormatter.format(Number(value)),
        },
        grid: {
          color: document.documentElement.classList.contains('dark') ? '#374151' : '#E5E7EB',
        },
      },
    },
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Répartition des dépenses
        </h3>
        <div className="text-right">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {viewMode === 'monthly' ? 'Période' : 'Cette année'}
          </p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {totalExpenses.toFixed(2)} €
          </p>
        </div>
      </div>

      {hasData ? (
        <div className="space-y-4">
          <div className="relative mx-auto h-72 min-h-0 w-full max-w-[420px] overflow-hidden sm:h-96">
            <Doughnut data={data} options={options} />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {categoryBreakdown.map(category => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategoryId(category.id)}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                  <span className="truncate text-gray-700 dark:text-gray-300">{category.name}</span>
                </span>
                <span className="ml-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                  {category.amount.toFixed(2)} €
                </span>
              </button>
            ))}
          </div>
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

      <div className="mt-6 border-t border-gray-200 pt-5 dark:border-gray-700">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h4 className="text-base font-semibold text-gray-900 dark:text-white">
              Impact des sorties sur vos revenus
            </h4>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {viewMode === 'monthly' ? 'Du début à la fin du mois' : 'Du début à la fin de l’année'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 dark:text-gray-400">Reste</p>
            <p className={`text-xl font-bold ${remainingIncome >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {remainingIncome.toFixed(2)} €
            </p>
          </div>
        </div>

        {hasCashFlowData ? (
          <>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-900/20">
                <p className="text-gray-500 dark:text-gray-400">Revenus</p>
                <p className="font-semibold text-emerald-700 dark:text-emerald-300">{baseIncome.toFixed(2)} €</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
                <p className="text-gray-500 dark:text-gray-400">Sorties</p>
                <p className="font-semibold text-red-700 dark:text-red-300">-{totalOutgoings.toFixed(2)} €</p>
              </div>
              <div className="rounded-lg bg-sky-50 p-3 dark:bg-sky-900/20">
                <p className="text-gray-500 dark:text-gray-400">Réduction</p>
                <p className="font-semibold text-sky-700 dark:text-sky-300">{outgoingRatio.toFixed(0)}%</p>
              </div>
            </div>
            <div className="mt-4 h-72">
              <Bar data={waterfallData} options={waterfallOptions as any} />
            </div>
          </>
        ) : (
          <div className="flex h-48 items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <p className="text-lg mb-2">
                Aucun revenu ou sortie {viewMode === 'monthly' ? 'ce mois-ci' : 'cette année'}
              </p>
              <p className="text-sm">Ajoutez des transactions pour voir l’évolution du reste disponible</p>
            </div>
          </div>
        )}
      </div>

      {selectedCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-semibold text-gray-950 dark:text-white">{selectedCategory.name}</h2>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseChart;
