import React from 'react';
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
import { useBudget } from '../contexts/BudgetContext';

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

  const cashFlowData = getCashFlowProjection(6);
  const firstProjection = cashFlowData[0];
  const finalProjection = cashFlowData[cashFlowData.length - 1];
  const average = (selector: (item: typeof cashFlowData[number]) => number | undefined) =>
    cashFlowData.length > 0
      ? cashFlowData.reduce((sum, item) => sum + (selector(item) || 0), 0) / cashFlowData.length
      : 0;

  const data = {
    labels: cashFlowData.map(cf => format(cf.date, 'MMM yyyy', { locale: fr })),
    datasets: [
      {
        label: 'Revenus',
        data: cashFlowData.map(cf => cf.income),
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: false,
        tension: 0.4,
      },
      {
        label: 'Sorties',
        data: cashFlowData.map(cf => cf.expenses),
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: false,
        tension: 0.4,
      },
      {
        label: 'Tr\u00e9sorerie dispo',
        data: cashFlowData.map(cf => cf.projectedBalance),
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Total avec \u00e9pargne',
        data: cashFlowData.map(cf => cf.projectedTotalBalance ?? cf.projectedBalance),
        borderColor: '#8B5CF6',
        backgroundColor: 'rgba(139, 92, 246, 0.08)',
        fill: false,
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
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Projection de tr&eacute;sorerie
      </h3>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        La projection part du solde courant enregistr&eacute; dans Pathly, puis ajoute les revenus pr&eacute;vus et retire les sorties, dettes, budgets restants et virements vers l'&eacute;pargne.
      </p>

      <div className="h-64">
        <Line data={data} options={options} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 text-center sm:grid-cols-2 xl:grid-cols-5">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">D&eacute;part courant</p>
          <p className={`text-lg font-semibold ${(firstProjection?.openingBalance ?? 0) >= 0 ? 'text-slate-700 dark:text-slate-200' : 'text-red-600 dark:text-red-400'}`}>
            {(firstProjection?.openingBalance ?? 0).toFixed(0)} &euro;
          </p>
        </div>
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
          <p className="text-sm text-gray-500 dark:text-gray-400">Tr&eacute;sorerie finale</p>
          <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
            {(finalProjection?.projectedBalance ?? 0).toFixed(0)} &euro;
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Avec &eacute;pargne</p>
          <p className="text-lg font-semibold text-violet-600 dark:text-violet-400">
            {(finalProjection?.projectedTotalBalance ?? finalProjection?.projectedBalance ?? 0).toFixed(0)} &euro;
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            &eacute;pargne projet&eacute;e {(finalProjection?.projectedSavingsBalance ?? 0).toFixed(0)} &euro;
          </p>
        </div>
      </div>
    </div>
  );
};

export default CashFlowChart;
