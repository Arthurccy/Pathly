import React, { useState, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Calendar, Filter, Download, Eye } from 'lucide-react';
import { format, startOfYear, endOfYear, eachMonthOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBudget } from '../contexts/BudgetContext';

const AdvancedAnalytics: React.FC = () => {
  const { transactions, categories, accounts, selectedAccountIds } = useBudget();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewType, setViewType] = useState<'monthly' | 'category' | 'account'>('monthly');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');

  const yearStart = startOfYear(new Date(selectedYear, 0, 1));
  const yearEnd = endOfYear(new Date(selectedYear, 0, 1));
  const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

  const filteredTransactions = transactions.filter(t => 
    t.date >= yearStart && 
    t.date <= yearEnd &&
    (selectedAccountIds.length === 0 || selectedAccountIds.includes(t.accountId))
  );

  // Monthly data
  const monthlyData = useMemo(() => {
    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      const monthTransactions = filteredTransactions.filter(t => 
        t.date >= monthStart && t.date <= monthEnd
      );

      const income = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
        
      const expenses = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
        
      const savings = monthTransactions
        .filter(t => t.type === 'savings')
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        month: format(month, 'MMM', { locale: fr }),
        fullMonth: format(month, 'MMMM yyyy', { locale: fr }),
        income,
        expenses,
        savings,
        balance: income - expenses - savings,
        transactionCount: monthTransactions.length
      };
    });
  }, [months, filteredTransactions]);

  // Category data
  const categoryData = useMemo(() => {
    const categoryTotals = filteredTransactions.reduce((acc, transaction) => {
      const category = categories.find(c => c.id === transaction.categoryId);
      const categoryName = category?.name || 'Sans catégorie';
      
      if (!acc[categoryName]) {
        acc[categoryName] = {
          name: categoryName,
          income: 0,
          expenses: 0,
          savings: 0,
          color: category?.color || '#6B7280',
          type: category?.type || 'expense'
        };
      }
      
      acc[categoryName][transaction.type] += transaction.amount;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(categoryTotals).sort((a: any, b: any) => 
      (b.income + b.expenses + b.savings) - (a.income + a.expenses + a.savings)
    );
  }, [filteredTransactions, categories]);

  // Account data
  const accountData = useMemo(() => {
    const accountTotals = filteredTransactions.reduce((acc, transaction) => {
      const account = accounts.find(a => a.id === transaction.accountId);
      const accountName = account?.name || 'Compte inconnu';
      
      if (!acc[accountName]) {
        acc[accountName] = {
          name: accountName,
          income: 0,
          expenses: 0,
          savings: 0,
          balance: account?.balance || 0,
          color: account?.color || '#6B7280'
        };
      }
      
      acc[accountName][transaction.type] += transaction.amount;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(accountTotals);
  }, [filteredTransactions, accounts]);

  // Summary statistics
  const yearlyStats = useMemo(() => {
    const totalIncome = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
      
    const totalExpenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
      
    const totalSavings = filteredTransactions
      .filter(t => t.type === 'savings')
      .reduce((sum, t) => sum + t.amount, 0);

    const avgMonthlyIncome = totalIncome / 12;
    const avgMonthlyExpenses = totalExpenses / 12;
    const savingsRate = totalIncome > 0 ? ((totalSavings / totalIncome) * 100) : 0;

    return {
      totalIncome,
      totalExpenses,
      totalSavings,
      balance: totalIncome - totalExpenses - totalSavings,
      avgMonthlyIncome,
      avgMonthlyExpenses,
      savingsRate,
      transactionCount: filteredTransactions.length
    };
  }, [filteredTransactions]);

  const getChartData = () => {
    switch (viewType) {
      case 'monthly':
        return monthlyData;
      case 'category':
        return categoryData;
      case 'account':
        return accountData;
      default:
        return monthlyData;
    }
  };

  const renderChart = () => {
    const data = getChartData();
    
    if (chartType === 'pie' && viewType === 'category') {
      const pieData = categoryData
        .filter((item: any) => item.expenses > 0)
        .map((item: any) => ({
          name: item.name,
          value: item.expenses,
          color: item.color
        }));

      return (
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={120}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value: any) => [`${value.toFixed(2)} €`, 'Montant']} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={viewType === 'monthly' ? 'month' : 'name'} />
            <YAxis />
            <Tooltip 
              formatter={(value: any, name: string) => [`${value.toFixed(2)} €`, name]}
              labelFormatter={(label) => viewType === 'monthly' ? `Mois: ${label}` : label}
            />
            <Legend />
            <Line type="monotone" dataKey="income" stroke="#10B981" name="Revenus" strokeWidth={2} />
            <Line type="monotone" dataKey="expenses" stroke="#EF4444" name="Dépenses" strokeWidth={2} />
            <Line type="monotone" dataKey="savings" stroke="#3B82F6" name="Épargne" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={viewType === 'monthly' ? 'month' : 'name'} />
          <YAxis />
          <Tooltip 
            formatter={(value: any, name: string) => [`${value.toFixed(2)} €`, name]}
            labelFormatter={(label) => viewType === 'monthly' ? `Mois: ${label}` : label}
          />
          <Legend />
          <Bar dataKey="income" fill="#10B981" name="Revenus" />
          <Bar dataKey="expenses" fill="#EF4444" name="Dépenses" />
          <Bar dataKey="savings" fill="#3B82F6" name="Épargne" />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const exportData = () => {
    const data = getChartData();
    const csv = [
      ['Période', 'Revenus', 'Dépenses', 'Épargne', 'Solde'].join(','),
      ...data.map((item: any) => [
        viewType === 'monthly' ? item.fullMonth || item.month : item.name,
        item.income?.toFixed(2) || '0.00',
        item.expenses?.toFixed(2) || '0.00',
        item.savings?.toFixed(2) || '0.00',
        item.balance?.toFixed(2) || '0.00'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analyse-${viewType}-${selectedYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
            <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Analyse détaillée
          </h1>
        </div>
        
        <button
          onClick={exportData}
          className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Download className="h-5 w-5" />
          <span>Exporter CSV</span>
        </button>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-gray-500" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <Eye className="h-5 w-5 text-gray-500" />
            <select
              value={viewType}
              onChange={(e) => setViewType(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="monthly">Par mois</option>
              <option value="category">Par catégorie</option>
              <option value="account">Par compte</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-500" />
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="bar">Barres</option>
              <option value="line">Lignes</option>
              {viewType === 'category' && <option value="pie">Camembert</option>}
            </select>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Revenus totaux</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {yearlyStats.totalIncome.toFixed(0)} €
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {yearlyStats.avgMonthlyIncome.toFixed(0)} €/mois
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Dépenses totales</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {yearlyStats.totalExpenses.toFixed(0)} €
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {yearlyStats.avgMonthlyExpenses.toFixed(0)} €/mois
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Épargne totale</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {yearlyStats.totalSavings.toFixed(0)} €
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {yearlyStats.savingsRate.toFixed(1)}% du revenu
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Solde net</p>
            <p className={`text-2xl font-bold ${
              yearlyStats.balance >= 0 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {yearlyStats.balance.toFixed(0)} €
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {yearlyStats.transactionCount} transactions
            </p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {viewType === 'monthly' && 'Évolution mensuelle'}
          {viewType === 'category' && 'Répartition par catégorie'}
          {viewType === 'account' && 'Répartition par compte'}
          {' - '}
          {selectedYear}
        </h3>
        
        {renderChart()}
      </div>

      {/* Top Categories/Accounts */}
      {viewType !== 'monthly' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Top {viewType === 'category' ? 'catégories' : 'comptes'} - Dépenses
          </h3>
          
          <div className="space-y-3">
            {getChartData()
              .filter((item: any) => item.expenses > 0)
              .sort((a: any, b: any) => b.expenses - a.expenses)
              .slice(0, 10)
              .map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-medium text-gray-900 dark:text-white">
                      {item.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-600 dark:text-red-400">
                      {item.expenses.toFixed(2)} €
                    </p>
                    {item.income > 0 && (
                      <p className="text-xs text-green-600 dark:text-green-400">
                        +{item.income.toFixed(2)} € revenus
                      </p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedAnalytics;