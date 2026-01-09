import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subYears } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target,
  Calendar,
  Filter,
  Eye,
  EyeOff
} from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';
import ExpenseChart from './ExpenseChart';
import RecentTransactions from './RecentTransactions';
import BudgetProgress from './BudgetProgress';
import CashFlowChart from './CashFlowChart';
import AccountsOverview from './AccountsOverview';
import SavingsGoalsProgress from './SavingsGoalsProgress';

const Dashboard: React.FC = () => {
  const { 
    transactions, 
    categories, 
    accounts,
    savingsGoals,
    debts,
    currentPeriod,
    setCurrentPeriod,
    selectedAccountIds,
    setSelectedAccountIds,
    getFinancialSummary
  } = useBudget();
  
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [showAccountFilter, setShowAccountFilter] = useState(false);
  
  const currentDate = new Date();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const yearStart = startOfYear(currentDate);
  const yearEnd = endOfYear(currentDate);
  
  const periodStart = viewMode === 'monthly' ? monthStart : yearStart;
  const periodEnd = viewMode === 'monthly' ? monthEnd : yearEnd;
  
  // Calculate previous period for comparison
  const previousDate = viewMode === 'monthly' ? subMonths(currentDate, 1) : subYears(currentDate, 1);
  const previousPeriodStart = viewMode === 'monthly' ? startOfMonth(previousDate) : startOfYear(previousDate);
  const previousPeriodEnd = viewMode === 'monthly' ? endOfMonth(previousDate) : endOfYear(previousDate);
  
  const filteredTransactions = transactions.filter(
    t => t.date >= periodStart && 
         t.date <= periodEnd &&
         t.status === 'completed' &&
         (selectedAccountIds.length === 0 || selectedAccountIds.includes(t.accountId))
  );
  
  const previousTransactions = transactions.filter(
    t => t.date >= previousPeriodStart && 
         t.date <= previousPeriodEnd &&
         t.status === 'completed' &&
         (selectedAccountIds.length === 0 || selectedAccountIds.includes(t.accountId))
  );
  
  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const totalExpenses = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSavings = filteredTransactions
    .filter(t => t.type === 'savings')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const balance = totalIncome - totalExpenses - totalSavings;
  
  // Previous period totals
  const previousIncome = previousTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const previousExpenses = previousTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const previousSavings = previousTransactions
    .filter(t => t.type === 'savings')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const previousBalance = previousIncome - previousExpenses - previousSavings;
  
  // Calculate percentage changes
  const calculateChange = (current: number, previous: number): string | null => {
    // No data to compare
    if (previous === 0 && current === 0) {
      return null;
    }
    // New data (no previous period data)
    if (previous === 0) {
      return null; // Don't show percentage for new data
    }
    const change = ((current - previous) / previous) * 100;
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  };
  
  const incomeChange = calculateChange(totalIncome, previousIncome);
  const expensesChange = calculateChange(totalExpenses, previousExpenses);
  const balanceChange = calculateChange(balance, previousBalance);
  
  const completedGoals = savingsGoals.filter(g => g.isCompleted).length;
  const totalGoals = savingsGoals.length;

  const totalDebt = debts.reduce((sum, d) => sum + d.remainingAmount, 0);
  const netWorth = accounts
    .filter(a => selectedAccountIds.length === 0 || selectedAccountIds.includes(a.id))
    .reduce((sum, a) => sum + a.balance, 0) - totalDebt;

  const stats = [
    {
      title: `Revenus ${viewMode === 'monthly' ? 'du mois' : 'de l\'année'}`,
      value: `${totalIncome.toFixed(2)} €`,
      icon: TrendingUp,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      change: incomeChange,
    },
    {
      title: `Dépenses ${viewMode === 'monthly' ? 'du mois' : 'de l\'année'}`,
      value: `${totalExpenses.toFixed(2)} €`,
      icon: TrendingDown,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      change: expensesChange,
    },
    {
      title: 'Solde restant',
      value: `${balance.toFixed(2)} €`,
      icon: DollarSign,
      color: balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      bgColor: balance >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20',
      change: balanceChange,
    },
    {
      title: 'Patrimoine net',
      value: `${netWorth.toFixed(2)} €`,
      icon: Target,
      color: netWorth >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400',
      bgColor: netWorth >= 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-red-50 dark:bg-red-900/20',
      change: null, // Net worth change requires historical tracking
    },
  ];

  const handleAccountToggle = (accountId: string) => {
    if (selectedAccountIds.includes(accountId)) {
      setSelectedAccountIds(selectedAccountIds.filter(id => id !== accountId));
    } else {
      setSelectedAccountIds([...selectedAccountIds, accountId]);
    }
  };

  const toggleAllAccounts = () => {
    if (selectedAccountIds.length === accounts.length) {
      setSelectedAccountIds([]);
    } else {
      setSelectedAccountIds(accounts.map(a => a.id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Tableau de bord
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {format(currentDate, 'MMMM yyyy', { locale: fr })}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'monthly'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="h-4 w-4 inline mr-1" />
              Mensuel
            </button>
            <button
              onClick={() => setViewMode('yearly')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'yearly'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="h-4 w-4 inline mr-1" />
              Annuel
            </button>
          </div>

          {/* Account Filter */}
          <div className="relative">
            <button
              onClick={() => setShowAccountFilter(!showAccountFilter)}
              className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">
                Comptes ({selectedAccountIds.length}/{accounts.length})
              </span>
            </button>

            {showAccountFilter && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <button
                    onClick={toggleAllAccounts}
                    className="flex items-center space-x-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    {selectedAccountIds.length === accounts.length ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    <span>
                      {selectedAccountIds.length === accounts.length ? 'Masquer tout' : 'Afficher tout'}
                    </span>
                  </button>
                </div>
                <div className="p-2 max-h-48 overflow-y-auto">
                  {accounts.map(account => (
                    <label
                      key={account.id}
                      className="flex items-center space-x-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAccountIds.includes(account.id)}
                        onChange={() => handleAccountToggle(account.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex items-center space-x-2 flex-1">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: account.color }}
                        />
                        <span className="text-sm text-gray-900 dark:text-white">
                          {account.name}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {account.balance.toFixed(2)} €
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.title}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`${stat.bgColor} p-2 rounded-lg`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {stat.title}
                    </p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {stat.value}
                    </p>
                  </div>
                </div>
                <div className={`text-sm font-medium ${stat.color}`}>
                  {stat.change || '—'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Accounts Overview */}
      <AccountsOverview />

      {/* Charts and Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExpenseChart viewMode={viewMode} />
        <BudgetProgress viewMode={viewMode} />
      </div>

      {/* Savings Goals and Cash Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SavingsGoalsProgress />
        <CashFlowChart />
      </div>

      {/* Recent Transactions */}
      <RecentTransactions />
    </div>
  );
};

export default Dashboard;