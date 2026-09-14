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
import { addMonths, endOfYear, format, startOfYear } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBudget } from '../contexts/BudgetContext';
import { useAuth } from '../contexts/AuthContext';
import { getCustomMonthPeriod } from '../utils/dateUtils';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface ExpenseChartProps {
  viewMode?: 'monthly' | 'yearly';
}

const ExpenseChart: React.FC<ExpenseChartProps> = ({ viewMode = 'monthly' }) => {
  const { transactions, categories, accounts, debts, selectedAccountIds } = useBudget();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const { user } = useAuth();
  const monthStartDay = user?.settings?.monthStartDay || 1;
  const currentDate = new Date();
  const currentMonthPeriod = getCustomMonthPeriod(currentDate, monthStartDay);
  const periodStart = viewMode === 'monthly' ? currentMonthPeriod.start : startOfYear(currentDate);
  const periodEnd = viewMode === 'monthly' ? currentMonthPeriod.end : endOfYear(currentDate);
  const reportableCategoryIds = new Set(
    categories
      .filter(category => !category.excludeFromReports)
      .map(category => category.id)
  );
  const isReportableTransaction = (transaction: typeof transactions[number]) =>
    reportableCategoryIds.has(transaction.categoryId);

  const completedPeriodTransactions = transactions.filter(
    t => t.status === 'completed' &&
         t.date >= periodStart &&
         t.date <= periodEnd &&
         isReportableTransaction(t) &&
         (selectedAccountIds.length === 0 || selectedAccountIds.includes(t.accountId))
  );
  const cashFlowTransactions = transactions.filter(
    t => t.status !== 'cancelled' &&
         t.date >= periodStart &&
         t.date <= periodEnd &&
         isReportableTransaction(t) &&
         (selectedAccountIds.length === 0 || selectedAccountIds.includes(t.accountId))
  );

  const expenseTransactions = completedPeriodTransactions.filter(t => t.type === 'expense');

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

  const baseIncome = cashFlowTransactions
    .filter(t => t.type === 'income' || t.type === 'refund' || t.type === 'savings_withdrawal')
    .reduce((sum, t) => sum + t.amount, 0);
  const isSavingsTransferOut = (transaction: typeof cashFlowTransactions[number]) => {
    if (transaction.type !== 'transfer' || !transaction.transferToAccountId) return false;

    const destinationAccount = accounts.find(account => account.id === transaction.transferToAccountId);
    const destinationName = destinationAccount?.name.trim().toLowerCase() || '';
    const isSavingsDestination = destinationAccount?.type === 'savings' || destinationName.includes('livret');

    return isSavingsDestination && transaction.description.trim().toLowerCase().startsWith('virement vers');
  };
  const outgoingTransactions = cashFlowTransactions
    .filter(t => t.type === 'expense' || t.type === 'bill' || t.type === 'savings' || isSavingsTransferOut(t))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const debtPaymentItems = debts
    .filter(debt =>
      debt.isActive &&
      debt.minimumPayment > 0 &&
      debt.remainingAmount > 0 &&
      (selectedAccountIds.length === 0 || selectedAccountIds.includes(debt.accountId))
    )
    .flatMap(debt => {
      const items: {
        date: Date;
        amount: number;
        description: string;
        statusLabel: string;
        color: string;
      }[] = [];
      let cursor = debt.dueDate;
      while (cursor < periodStart) {
        cursor = addMonths(cursor, 1);
      }

      let remainingDebt = debt.remainingAmount;
      while (cursor <= periodEnd && remainingDebt > 0) {
        const amount = Math.min(debt.minimumPayment, remainingDebt);
        items.push({
          date: cursor,
          amount,
          description: `Paiement dette - ${debt.name}`,
          statusLabel: 'planifiée',
          color: '#9333EA',
        });
        remainingDebt -= amount;
        cursor = addMonths(cursor, 1);
      }

      return items;
    });
  const outgoingItems = [
    ...outgoingTransactions.map(transaction => {
      const category = categories.find(c => c.id === transaction.categoryId);
      const statusLabel = transaction.status === 'scheduled'
        ? 'planifiée'
        : transaction.status === 'pending'
          ? 'en attente'
          : 'terminée';

      return {
        date: transaction.date,
        amount: transaction.amount,
        description: transaction.description || category?.name || 'Sortie',
        statusLabel,
        color: transaction.type === 'savings' || isSavingsTransferOut(transaction) ? '#2563EB' : '#DC2626',
      };
    }),
    ...debtPaymentItems,
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
  const totalOutgoings = outgoingItems.reduce((sum, item) => sum + item.amount, 0);
  const remainingIncome = baseIncome - totalOutgoings;
  const plannedTransactionsCount = cashFlowTransactions.filter(t => t.status === 'scheduled' || t.status === 'pending').length + debtPaymentItems.length;

  const hasCashFlowData = baseIncome > 0 || totalOutgoings > 0;
  const outgoingRatio = baseIncome > 0 ? Math.min((totalOutgoings / baseIncome) * 100, 999) : 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
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
          <div className="relative mx-auto h-48 min-h-0 w-full max-w-[280px] overflow-hidden sm:h-64">
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



      {selectedCategory && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92dvh] w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-gray-900 sm:max-w-2xl sm:rounded-2xl">
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

            <div className="max-h-[calc(92dvh-5rem)] overflow-y-auto p-4 sm:p-6">
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
