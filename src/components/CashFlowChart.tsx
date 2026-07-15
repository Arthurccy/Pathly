import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertTriangle, CheckCircle2, Gauge, TrendingDown } from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';
import { useAuth } from '../contexts/AuthContext';
import { getCustomMonthPeriod } from '../utils/dateUtils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const CashFlowChart: React.FC = () => {
  const { getCashFlowProjection } = useBudget();
  const { user } = useAuth();

  const monthStartDay = user?.settings?.monthStartDay || 1;
  const currentBudgetPeriod = getCustomMonthPeriod(new Date(), monthStartDay);
  const cashFlowData = getCashFlowProjection(6, currentBudgetPeriod.start, monthStartDay);
  const firstProjection = cashFlowData[0];
  const finalProjection = cashFlowData[cashFlowData.length - 1];
  const money = (value: number, digits = 0) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  const average = (selector: (item: typeof cashFlowData[number]) => number | undefined) =>
    cashFlowData.length > 0
      ? cashFlowData.reduce((sum, item) => sum + (selector(item) || 0), 0) / cashFlowData.length
      : 0;
  const lowestResult = cashFlowData.reduce(
    (lowest, item) => Math.min(lowest, item.balance),
    firstProjection?.balance ?? 0
  );
  const riskyMonths = cashFlowData.filter(item => item.balance < 0).length;
  const tightMonths = cashFlowData.filter(item => item.balance >= 0 && item.balance < 200).length;
  const globalStatus = riskyMonths > 0
    ? {
        label: 'À revoir',
        detail: `${riskyMonths} mois en négatif`,
        Icon: AlertTriangle,
        classes: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300',
      }
    : tightMonths > 0
      ? {
          label: 'Tendu',
          detail: `${tightMonths} mois avec reste < ${money(200)}`,
          Icon: Gauge,
          classes: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300',
        }
      : {
          label: 'Plan OK',
          detail: `Pire mois à ${money(lowestResult)}`,
          Icon: CheckCircle2,
          classes: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300',
        };

  const monthlyPlan = useMemo(
    () => {
      let projectedWithoutBudgetReserve = firstProjection?.openingBalance ?? 0;

      return cashFlowData.map((item, index) => {
      const period = getCustomMonthPeriod(item.date, monthStartDay);
      const plannedExpenses = item.baseExpenses || 0;
      const debtPayments = item.debtPayments || 0;
      const transfersOut = item.transfersOut || 0;
      const savings = item.savings || 0;
      const budgetReserve = item.budgetReserve || 0;
      const plannedOutflows = plannedExpenses + debtPayments + transfersOut + savings;
      const planBalance =
        item.income -
        plannedOutflows -
        budgetReserve;
      const plannedOnlyBalance = item.income - plannedOutflows;
      projectedWithoutBudgetReserve += plannedOnlyBalance;
      const pressureItems = [
        { label: 'dépenses prévues', value: plannedExpenses },
        { label: 'budgets libres', value: budgetReserve },
        { label: 'virements', value: transfersOut },
        { label: 'dettes', value: debtPayments },
        { label: 'épargne', value: savings },
      ].sort((a, b) => b.value - a.value);
      const mainPressure = pressureItems.find(pressure => pressure.value > 0);
      const status = planBalance < 0
        ? {
            label: 'Déficit',
            Icon: AlertTriangle,
            classes: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-900',
          }
        : planBalance < 200
          ? {
              label: 'Tendu',
              Icon: Gauge,
              classes: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900',
            }
          : {
              label: 'Excédent',
              Icon: CheckCircle2,
              classes: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900',
            };

      return {
        ...item,
        planBalance,
        plannedOnlyBalance,
        plannedExpenses,
        debtPayments,
        transfersOut,
        savings,
        budgetReserve,
        plannedOutflows,
        periodStart: period.start,
        periodEnd: period.end,
        isCurrentPeriod: index === 0,
        mainPressure,
        status,
        plannedCount: item.scheduledTransactions?.length || 0,
      };
      });
    },
    [cashFlowData, firstProjection?.openingBalance, monthStartDay]
  );

  const data = {
    labels: monthlyPlan.map(item => format(item.periodStart, 'dd MMM', { locale: fr })),
    datasets: [
      {
        label: 'Revenus',
        data: monthlyPlan.map(cf => cf.income),
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: false,
        tension: 0.4,
      },
      {
        label: 'Sorties',
        data: monthlyPlan.map(cf => cf.expenses),
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: false,
        tension: 0.4,
      },
      {
        label: 'Résultat du mois',
        data: monthlyPlan.map(cf => cf.planBalance),
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          padding: 20,
          usePointStyle: true,
          color: document.documentElement.classList.contains('dark') ? '#D1D5DB' : '#374151',
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.parsed.y;
            return `${context.dataset.label}: ${value.toFixed(2)} \u20ac`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: document.documentElement.classList.contains('dark') ? '#374151' : '#E5E7EB',
        },
        ticks: {
          color: document.documentElement.classList.contains('dark') ? '#D1D5DB' : '#374151',
        },
      },
      y: {
        grid: {
          color: document.documentElement.classList.contains('dark') ? '#374151' : '#E5E7EB',
        },
        ticks: {
          color: document.documentElement.classList.contains('dark') ? '#D1D5DB' : '#374151',
          callback: (value: any) => `${value} \u20ac`,
        },
      },
    },
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Résultat par mois
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Évolution de votre résultat mensuel net (Revenus - Dépenses - Épargne - Budgets libres). Remis à zéro chaque mois.
          </p>
        </div>
        <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${globalStatus.classes}`}>
          <globalStatus.Icon className="h-4 w-4" />
          <span>{globalStatus.label}</span>
          <span className="text-xs font-medium opacity-80">{globalStatus.detail}</span>
        </div>
      </div>

      <div className="h-64">
        <Line data={data} options={options} />
      </div>

      <div className="mt-5 space-y-3">
        {monthlyPlan.map(item => {
          const StatusIcon = item.status.Icon;
          const endBalanceClass = item.projectedBalance >= 0
            ? 'text-slate-950 dark:text-white'
            : 'text-red-600 dark:text-red-400';

          return (
            <div key={item.date.toISOString()} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    <TrendingDown className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-950 dark:text-white">
                      {format(item.periodStart, 'dd MMM', { locale: fr })} - {format(item.periodEnd, 'dd MMM yyyy', { locale: fr })}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {item.isCurrentPeriod ? 'Reste de la période' : 'Période complète'} - {item.plannedCount} mouvement{item.plannedCount > 1 ? 's' : ''} prévu{item.plannedCount > 1 ? 's' : ''} - plus gros poste: {item.mainPressure ? `${item.mainPressure.label} ${money(item.mainPressure.value)}` : 'aucun'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm sm:flex sm:items-center sm:gap-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Sans les budgets</p>
                    <p className={item.plannedOnlyBalance >= 0 ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'font-semibold text-red-600 dark:text-red-400'}>
                      {money(item.plannedOnlyBalance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Résultat final du mois</p>
                    <p className={`font-semibold ${endBalanceClass}`}>
                      {money(item.planBalance)}
                    </p>
                  </div>
                  <span className={`col-span-2 inline-flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 sm:col-span-1 ${item.status.classes}`}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {item.status.label}
                  </span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-3 xl:grid-cols-6">
                <span className="rounded-md bg-slate-50 px-2.5 py-2 dark:bg-slate-900">Revenus {money(item.income)}</span>
                <span className="rounded-md bg-slate-50 px-2.5 py-2 dark:bg-slate-900">Dépenses {money(item.plannedExpenses)}</span>
                <span className="rounded-md bg-slate-50 px-2.5 py-2 dark:bg-slate-900">Dettes {money(item.debtPayments)}</span>
                <span className="rounded-md bg-slate-50 px-2.5 py-2 dark:bg-slate-900">Virements {money(item.transfersOut + item.savings)}</span>
                <span className="rounded-md bg-slate-50 px-2.5 py-2 dark:bg-slate-900">Budgets libres {money(item.budgetReserve)}</span>
                <span className="rounded-md bg-slate-50 px-2.5 py-2 dark:bg-slate-900">Départ {money(item.openingBalance || 0)}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Vous avez besoin de {money(item.income)} de revenus pour couvrir ce mois. {item.planBalance < 0 ? `Il manquera ${money(Math.abs(item.planBalance))} !` : `Vous dégagerez un excédent de ${money(item.planBalance)}.`}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 text-center sm:grid-cols-3">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Revenus moyens</p>
          <p className="text-lg font-semibold text-green-600 dark:text-green-400">
            {average(cf => cf.income).toFixed(0)} &euro;
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Sorties moyennes</p>
          <p className="text-lg font-semibold text-red-600 dark:text-red-400">
            {average(cf => cf.expenses).toFixed(0)} &euro;
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            d&eacute;penses {average(cf => cf.baseExpenses).toFixed(0)} &euro; - dettes {average(cf => cf.debtPayments).toFixed(0)} &euro;
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            &eacute;pargne {average(cf => cf.savings).toFixed(0)} &euro; - virements {average(cf => cf.transfersOut).toFixed(0)} &euro; - budgets {average(cf => cf.budgetReserve).toFixed(0)} &euro;
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Résultat mensuel moyen</p>
          <p className={`text-lg font-semibold ${average(cf => cf.planBalance) >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
            {average(cf => cf.planBalance).toFixed(0)} &euro;
          </p>
        </div>
      </div>
    </div>
  );
};

export default CashFlowChart;
