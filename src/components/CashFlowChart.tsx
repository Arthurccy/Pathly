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
        label: 'Dépenses',
        data: cashFlowData.map(cf => cf.expenses),
        borderColor: '#EF4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: false,
        tension: 0.4,
      },
      {
        label: 'Solde projeté',
        data: cashFlowData.map(cf => cf.projectedBalance),
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
            return `${context.dataset.label}: ${value.toFixed(2)} €`;
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
          callback: (value: any) => `${value} €`,
        },
      },
    },
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Projection de trésorerie
      </h3>
      
      <div className="h-64">
        <Line data={data} options={options} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Revenus moyens</p>
          <p className="text-lg font-semibold text-green-600 dark:text-green-400">
            {(cashFlowData.reduce((sum, cf) => sum + cf.income, 0) / cashFlowData.length).toFixed(0)} €
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Dépenses moyennes</p>
          <p className="text-lg font-semibold text-red-600 dark:text-red-400">
            {(cashFlowData.reduce((sum, cf) => sum + cf.expenses, 0) / cashFlowData.length).toFixed(0)} €
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Solde final projeté</p>
          <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
            {cashFlowData[cashFlowData.length - 1]?.projectedBalance.toFixed(0) || 0} €
          </p>
        </div>
      </div>
    </div>
  );
};

export default CashFlowChart;