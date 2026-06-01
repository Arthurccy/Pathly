import React, { useState } from 'react';
import { addDays, addMonths, addWeeks, addYears, format, startOfDay, startOfYear, endOfYear, subYears } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target,
  Calendar,
  Filter,
  Eye,
  EyeOff,
  Plus,
  Upload,
  Wallet
} from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';
import { useAuth } from '../contexts/AuthContext';
import { getCustomMonthPeriod, getPreviousCustomMonthPeriod } from '../utils/dateUtils';
import { Transaction } from '../types';
import ExpenseChart from './ExpenseChart';
import RecentTransactions from './RecentTransactions';
import BudgetProgress from './BudgetProgress';
import CashFlowChart from './CashFlowChart';
import AccountsOverview from './AccountsOverview';
import SavingsGoalsProgress from './SavingsGoalsProgress';

interface DashboardProps {
  onViewChange?: (view: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onViewChange }) => {
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
    getFinancialSummary,
    getCashFlowProjection
  } = useBudget();
  const { user } = useAuth();
  
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [showAccountFilter, setShowAccountFilter] = useState(false);
  
  const monthStartDay = user?.settings?.monthStartDay || 1;
  const currentDate = new Date();
  const currentMonthPeriod = getCustomMonthPeriod(currentDate, monthStartDay);
  const yearStart = startOfYear(currentDate);
  const yearEnd = endOfYear(currentDate);
  
  const periodStart = viewMode === 'monthly' ? currentMonthPeriod.start : yearStart;
  const periodEnd = viewMode === 'monthly' ? currentMonthPeriod.end : yearEnd;
  const reportableCategoryIds = new Set(
    categories
      .filter(category => !category.excludeFromReports)
      .map(category => category.id)
  );
  const isReportableTransaction = (transaction: Transaction) =>
    reportableCategoryIds.has(transaction.categoryId);
  
  const previousMonthPeriod = getPreviousCustomMonthPeriod(currentDate, monthStartDay);
  const previousPeriodStart = viewMode === 'monthly' ? previousMonthPeriod.start : startOfYear(subYears(currentDate, 1));
  const previousPeriodEnd = viewMode === 'monthly' ? previousMonthPeriod.end : endOfYear(subYears(currentDate, 1));
  
  const filteredTransactions = transactions.filter(
    t => t.date >= periodStart && 
         t.date <= periodEnd &&
         t.status === 'completed' &&
         isReportableTransaction(t) &&
         (selectedAccountIds.length === 0 || selectedAccountIds.includes(t.accountId))
  );
  
  const previousTransactions = transactions.filter(
    t => t.date >= previousPeriodStart && 
         t.date <= previousPeriodEnd &&
         t.status === 'completed' &&
         isReportableTransaction(t) &&
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
  const selectedAccountSet = new Set(selectedAccountIds);
  const shouldIncludeAccount = (accountId: string) =>
    selectedAccountIds.length === 0 || selectedAccountSet.has(accountId);
  const today = startOfDay(currentDate);
  const currentAccountBalance = accounts
    .filter(a =>
      a.isActive &&
      a.type === 'checking' &&
      shouldIncludeAccount(a.id)
    )
    .reduce((sum, a) => sum + a.balance, 0);
  const checkingAccountIds = new Set(
    accounts
      .filter(account =>
        account.isActive &&
        account.type === 'checking' &&
        shouldIncludeAccount(account.id)
      )
      .map(account => account.id)
  );
  const getTransactionImpact = (transaction: Transaction) => {
    const isCheckingTransaction = checkingAccountIds.has(transaction.accountId);

    if (transaction.type === 'transfer') {
      if (!isCheckingTransaction) return 0;
      return transaction.description.toLowerCase().includes('depuis')
        ? transaction.amount
        : -transaction.amount;
    }

    if (!isCheckingTransaction) return 0;
    if (transaction.type === 'income' || transaction.type === 'refund') return transaction.amount;
    if (transaction.type === 'expense' || transaction.type === 'bill' || transaction.type === 'savings') return -transaction.amount;
    return 0;
  };
  const getNextOccurrenceDate = (date: Date, transaction: Transaction) => {
    const pattern = transaction.recurringPattern;
    if (!pattern) return null;

    switch (pattern.frequency) {
      case 'daily':
        return addDays(date, pattern.interval);
      case 'weekly':
        return addWeeks(date, pattern.interval);
      case 'monthly':
        return addMonths(date, pattern.interval);
      case 'quarterly':
        return addMonths(date, pattern.interval * 3);
      case 'yearly':
        return addYears(date, pattern.interval);
      default:
        return addMonths(date, 1);
    }
  };
  const addImpactToProjection = (
    projection: { incoming: number; deductions: number },
    impact: number
  ) => impact > 0
    ? { ...projection, incoming: projection.incoming + impact }
    : { ...projection, deductions: projection.deductions + Math.abs(impact) };
  const upcomingTransactionProjection = transactions.reduce((projection, transaction) => {
    const impact = getTransactionImpact(transaction);
    if (impact === 0) return projection;

    if (!transaction.isRecurring || !transaction.recurringPattern?.isActive) {
      const transactionDate = startOfDay(transaction.date);
      if (
        transaction.status === 'scheduled' &&
        transactionDate >= today &&
        transactionDate <= currentMonthPeriod.end
      ) {
        return addImpactToProjection(projection, impact);
      }
      return projection;
    }

    const pattern = transaction.recurringPattern;
    let nextDate = startOfDay(pattern.nextDate);
    let occurrenceCount = pattern.currentOccurrence || 0;
    let recurringProjection = projection;

    while (nextDate <= currentMonthPeriod.end) {
      const hasReachedEndDate = pattern.endDate && nextDate > startOfDay(pattern.endDate);
      const hasReachedMaxOccurrences = pattern.maxOccurrences && occurrenceCount >= pattern.maxOccurrences;
      if (hasReachedEndDate || hasReachedMaxOccurrences) break;

      if (nextDate >= today) {
        recurringProjection = addImpactToProjection(recurringProjection, impact);
      }

      const followingDate = getNextOccurrenceDate(nextDate, transaction);
      if (!followingDate || followingDate <= nextDate) break;
      nextDate = startOfDay(followingDate);
      occurrenceCount += 1;
    }

    return recurringProjection;
  }, { incoming: 0, deductions: 0 });
  const upcomingDebtPayments = debts
    .filter(debt =>
      debt.isActive &&
      checkingAccountIds.has(debt.accountId) &&
      startOfDay(debt.dueDate) >= today &&
      startOfDay(debt.dueDate) <= currentMonthPeriod.end
    )
    .reduce((sum, debt) => sum + debt.minimumPayment, 0);
  const monthEndProjection = getCashFlowProjection(1)[0];
  const projectedIncoming = monthEndProjection?.income ?? upcomingTransactionProjection.incoming;
  const projectedDeductions = monthEndProjection?.expenses ?? (upcomingTransactionProjection.deductions + upcomingDebtPayments);
  const projectedCurrentBalance = monthEndProjection?.projectedBalance ?? (currentAccountBalance + projectedIncoming - projectedDeductions);
  const projectedSavingsBalance = monthEndProjection?.projectedSavingsBalance ?? 0;
  const projectedTotalWithSavings = monthEndProjection?.projectedTotalBalance ?? projectedCurrentBalance;
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
      title: 'Résultat du mois',
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

  const nextGoal = savingsGoals
    .filter(goal => !goal.isCompleted)
    .sort((a, b) => {
      const aProgress = a.targetAmount > 0 ? a.currentAmount / a.targetAmount : 0;
      const bProgress = b.targetAmount > 0 ? b.currentAmount / b.targetAmount : 0;
      return bProgress - aProgress;
    })[0];

  const primaryActions = [
    { label: 'Ajouter', detail: 'Revenu ou dépense', icon: Plus, view: 'add-transaction' },
    { label: 'Comptes', detail: 'Soldes et Livret A', icon: Wallet, view: 'accounts' },
    { label: 'Importer', detail: 'CSV bancaire', icon: Upload, view: 'import-csv' },
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
    <div className="space-y-4 sm:space-y-6">
      <section className="overflow-hidden rounded-2xl border border-white/70 bg-white/85 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/85">
        <div className="grid gap-4 p-4 sm:gap-6 sm:p-6 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="min-w-0">
            <p className="text-sm font-medium capitalize text-blue-700 dark:text-blue-300">
              {format(currentDate, 'MMMM yyyy', { locale: fr })}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Période budgétaire: {format(currentMonthPeriod.start, 'dd MMM', { locale: fr })} - {format(currentMonthPeriod.end, 'dd MMM yyyy', { locale: fr })}
            </p>
            <h1 className="mt-2 text-2xl font-bold text-gray-950 dark:text-white sm:text-3xl">
              Votre argent, en clair.
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
              Ajoutez une opération en un clic, gardez vos comptes sous les yeux et voyez ce qui restera sur le compte courant.
            </p>

            <div className="-mx-1 mt-5 flex gap-3 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0">
              {primaryActions.map(action => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.view}
                    type="button"
                    onClick={() => onViewChange?.(action.view)}
                    className="flex min-h-20 min-w-[12.5rem] items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950/60 dark:hover:border-blue-800 sm:min-w-0"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-950 text-white dark:bg-white dark:text-gray-950">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-gray-950 dark:text-white">{action.label}</span>
                      <span className="block truncate text-sm text-gray-500 dark:text-gray-400">{action.detail}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-gray-950 p-4 text-white shadow-sm dark:bg-white dark:text-gray-950 sm:p-5">
            <p className="text-sm text-gray-300 dark:text-gray-600">Reste estimé fin du mois</p>
            <p className={`mt-2 break-words text-3xl font-bold sm:text-4xl ${projectedCurrentBalance >= 0 ? 'text-emerald-300 dark:text-emerald-700' : 'text-red-300 dark:text-red-700'}`}>
              {projectedCurrentBalance.toFixed(2)} €
            </p>
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              Avec prévisions, récurrences, dettes et budgets restants.
            </p>
            <div className="mt-4 rounded-xl bg-white/10 p-3 text-xs text-gray-200 dark:bg-gray-950/10 dark:text-gray-700">
              <p className="font-medium text-white dark:text-gray-950">Contrôle du calcul</p>
              <p className="mt-1">
                {currentAccountBalance.toFixed(2)} € + {projectedIncoming.toFixed(2)} € - {projectedDeductions.toFixed(2)} € = {projectedCurrentBalance.toFixed(2)} €
              </p>
              <p className="mt-2 text-gray-400 dark:text-gray-500">
                Fiable si le solde Pathly correspond à ta banque et si les opérations à venir, récurrences, dettes et budgets sont à jour.
              </p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-400 dark:text-gray-500">Compte courant</p>
                <p className="font-semibold">{currentAccountBalance.toFixed(2)} €</p>
              </div>
              <div>
                <p className="text-gray-400 dark:text-gray-500">Impact restant</p>
                <p className="font-semibold">{(projectedIncoming - projectedDeductions).toFixed(2)} €</p>
              </div>
              <div>
                <p className="text-gray-400 dark:text-gray-500">Revenus à venir</p>
                <p className="font-semibold">+{projectedIncoming.toFixed(2)} €</p>
              </div>
              <div>
                <p className="text-gray-400 dark:text-gray-500">Sorties + budgets</p>
                <p className="font-semibold">-{projectedDeductions.toFixed(2)} €</p>
              </div>
              <div>
                <p className="text-gray-400 dark:text-gray-500">Avec épargne</p>
                <p className="font-semibold">{projectedTotalWithSavings.toFixed(2)} €</p>
              </div>
              <div>
                <p className="text-gray-400 dark:text-gray-500">Épargne projetée</p>
                <p className="font-semibold">{projectedSavingsBalance.toFixed(2)} €</p>
              </div>
            </div>
            {nextGoal && (
              <button
                type="button"
                onClick={() => onViewChange?.('goals')}
                className="mt-5 w-full rounded-lg bg-white/10 px-3 py-2 text-left text-sm transition hover:bg-white/15 dark:bg-gray-950/10 dark:hover:bg-gray-950/15"
              >
                <span className="block text-gray-300 dark:text-gray-600">Objectif en cours</span>
                <span className="block truncate font-medium">{nextGoal.title}</span>
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="relative z-30 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white/90 p-3 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/90 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid w-full grid-cols-2 rounded-lg bg-gray-100 p-1 dark:bg-gray-700 sm:flex sm:w-auto">
            <button
              onClick={() => setViewMode('monthly')}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors sm:py-1 ${
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
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors sm:py-1 ${
                viewMode === 'yearly'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="h-4 w-4 inline mr-1" />
              Annuel
            </button>
          </div>

          <div className="relative z-40">
            <button
              onClick={() => setShowAccountFilter(!showAccountFilter)}
              className="flex w-full items-center justify-center space-x-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 sm:w-auto sm:justify-start sm:py-2"
            >
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">
                Comptes ({selectedAccountIds.length}/{accounts.length})
              </span>
            </button>

            {showAccountFilter && (
              <div className="absolute left-0 right-0 z-50 mt-2 rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800 sm:left-auto sm:w-72">
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

      <div className="relative z-0 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.title}
              className="rounded-xl border border-gray-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/90 sm:p-5"
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
                    <p className="break-words text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl">
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentTransactions title="Dernières transactions terminées" />
        <RecentTransactions title="Opérations à venir" mode="upcoming" />
      </div>
    </div>
  );
};

export default Dashboard;
