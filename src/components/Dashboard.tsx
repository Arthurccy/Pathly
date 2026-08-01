import React, { useMemo, useState } from 'react';
import { endOfYear, format, startOfYear, subYears } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowDownRight,
  ArrowUpRight,
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  Filter,
  PiggyBank,
  Plus,
  ReceiptText,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  Wallet,
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
import { BankSyncModal } from './BankSyncModal';

interface DashboardProps {
  onViewChange?: (view: string) => void;
}

const money = (value: number, digits = 2) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

const compactMoney = (value: number) => money(value, 0);

const getImpact = (transaction: Transaction) => {
  if (transaction.type === 'income' || transaction.type === 'refund' || transaction.type === 'savings_withdrawal') {
    return transaction.amount;
  }

  if (transaction.type === 'transfer') {
    return transaction.description.toLowerCase().includes('depuis')
      ? transaction.amount
      : -transaction.amount;
  }

  return -transaction.amount;
};

const Dashboard: React.FC<DashboardProps> = ({ onViewChange }) => {
  const {
    transactions,
    categories,
    accounts,
    savingsGoals,
    debts,
    selectedAccountIds,
    setSelectedAccountIds,
    getCashFlowProjection,
  } = useBudget();
  const { user } = useAuth();

  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [showAccountFilter, setShowAccountFilter] = useState(false);
  const [isBankSyncOpen, setIsBankSyncOpen] = useState(false);

  const monthStartDay = user?.settings?.monthStartDay || 1;
  const now = new Date();
  const currentMonthPeriod = getCustomMonthPeriod(now, monthStartDay);
  const previousMonthPeriod = getPreviousCustomMonthPeriod(now, monthStartDay);
  const periodStart = viewMode === 'monthly' ? currentMonthPeriod.start : startOfYear(now);
  const periodEnd = viewMode === 'monthly' ? currentMonthPeriod.end : endOfYear(now);
  const previousPeriodStart = viewMode === 'monthly' ? previousMonthPeriod.start : startOfYear(subYears(now, 1));
  const previousPeriodEnd = viewMode === 'monthly' ? previousMonthPeriod.end : endOfYear(subYears(now, 1));

  const selectedAccountSet = new Set(selectedAccountIds);
  const selectedAccounts = accounts.filter(account =>
    account.isActive &&
    (selectedAccountIds.length === 0 || selectedAccountSet.has(account.id))
  );
  const selectedAccountCount = selectedAccountIds.length === 0 ? accounts.length : selectedAccountIds.length;

  const reportableCategoryIds = new Set(
    categories
      .filter(category => !category.excludeFromReports)
      .map(category => category.id)
  );
  const isReportableTransaction = (transaction: Transaction) =>
    reportableCategoryIds.has(transaction.categoryId) &&
    (selectedAccountIds.length === 0 || selectedAccountSet.has(transaction.accountId));

  const periodTransactions = transactions.filter(transaction =>
    transaction.status === 'completed' &&
    transaction.date >= periodStart &&
    transaction.date <= periodEnd &&
    isReportableTransaction(transaction)
  );
  const previousTransactions = transactions.filter(transaction =>
    transaction.status === 'completed' &&
    transaction.date >= previousPeriodStart &&
    transaction.date <= previousPeriodEnd &&
    isReportableTransaction(transaction)
  );

  const totalIncome = periodTransactions
    .filter(transaction => transaction.type === 'income' || transaction.type === 'refund')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalExpenses = periodTransactions
    .filter(transaction => transaction.type === 'expense' || transaction.type === 'bill')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalSavings = periodTransactions
    .filter(transaction => transaction.type === 'savings')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const periodResult = totalIncome - totalExpenses - totalSavings;

  const previousIncome = previousTransactions
    .filter(transaction => transaction.type === 'income' || transaction.type === 'refund')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const previousExpenses = previousTransactions
    .filter(transaction => transaction.type === 'expense' || transaction.type === 'bill')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const previousSavings = previousTransactions
    .filter(transaction => transaction.type === 'savings')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const previousResult = previousIncome - previousExpenses - previousSavings;

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
  };

  const checkingAccountBalance = selectedAccounts
    .filter(account => account.type === 'checking')
    .reduce((sum, account) => sum + account.balance, 0);
  const totalDebt = debts.reduce((sum, debt) => sum + debt.remainingAmount, 0);
  const netWorth = selectedAccounts.reduce((sum, account) => sum + account.balance, 0) - totalDebt;

  const projection = viewMode === 'monthly'
    ? getCashFlowProjection(1, currentMonthPeriod.start, monthStartDay)[0]
    : getCashFlowProjection(1)[0];
  const projectedIncoming = projection?.income ?? 0;
  const projectedDeductions = projection?.expenses ?? 0;
  const projectedCurrentBalance = projection?.projectedBalance ?? checkingAccountBalance;
  const projectedSavingsBalance = projection?.projectedSavingsBalance ?? 0;
  const projectedTotalWithSavings = projection?.projectedTotalBalance ?? projectedCurrentBalance;
  const projectionDelta = projectedIncoming - projectedDeductions;
  const projectedBaseExpenses = projection?.baseExpenses ?? 0;
  const projectedDebtPayments = projection?.debtPayments ?? 0;
  const projectedBudgetReserve = projection?.budgetReserve ?? 0;
  const projectedTransfersOut = projection?.transfersOut ?? 0;
  const projectedSavingsOut = projection?.savings ?? 0;
  const openingBalanceForMath = projection?.openingBalance ?? checkingAccountBalance;

  const upcomingTransactions = useMemo(
    () => transactions
      .filter(transaction =>
        !transaction.isRecurring &&
        (transaction.status === 'scheduled' || transaction.status === 'pending') &&
        transaction.date >= now &&
        transaction.date <= currentMonthPeriod.end &&
        isReportableTransaction(transaction)
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [transactions, currentMonthPeriod.end, selectedAccountIds.join('|'), categories.length]
  );
  const upcomingIncome = upcomingTransactions
    .filter(transaction => getImpact(transaction) > 0)
    .reduce((sum, transaction) => sum + getImpact(transaction), 0);
  const upcomingOutflows = upcomingTransactions
    .filter(transaction => getImpact(transaction) < 0)
    .reduce((sum, transaction) => sum + Math.abs(getImpact(transaction)), 0);

  const nextGoal = savingsGoals
    .filter(goal => !goal.isCompleted)
    .sort((a, b) => {
      const aProgress = a.targetAmount > 0 ? a.currentAmount / a.targetAmount : 0;
      const bProgress = b.targetAmount > 0 ? b.currentAmount / b.targetAmount : 0;
      return bProgress - aProgress;
    })[0];
  const nextGoalProgress = nextGoal && nextGoal.targetAmount > 0
    ? Math.min((nextGoal.currentAmount / nextGoal.targetAmount) * 100, 100)
    : 0;

  const remainingTone = projectedCurrentBalance >= 0
    ? {
      label: 'Sous controle',
      icon: CheckCircle2,
      text: 'text-emerald-700 dark:text-emerald-300',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      border: 'border-emerald-200 dark:border-emerald-900/60',
    }
    : {
      label: 'A surveiller',
      icon: AlertCircle,
      text: 'text-red-700 dark:text-red-300',
      bg: 'bg-red-50 dark:bg-red-950/30',
      border: 'border-red-200 dark:border-red-900/60',
    };
  const StatusIcon = remainingTone.icon;

  const primaryActions = [
    { label: 'Ajouter', detail: 'Opération', icon: Plus, view: 'add-transaction', style: 'primary' },
    { label: 'Importer', detail: 'CSV bancaire', icon: Upload, view: 'import-csv', style: 'secondary' },
    { label: 'Planifier', detail: 'À venir', icon: CalendarDays, view: 'planning', style: 'secondary' },
    { label: 'Comptes', detail: 'Soldes', icon: Wallet, view: 'accounts', style: 'secondary' },
  ];

  const insightCards = [
    {
      label: 'Revenus à venir',
      value: money(projectedIncoming),
      detail: `${money(upcomingIncome)} déjà daté`,
      icon: ArrowUpRight,
      tone: 'text-emerald-700 dark:text-emerald-200',
      bg: 'bg-emerald-100 dark:bg-emerald-900/50',
      border: 'border-emerald-200 dark:border-emerald-800',
    },
    {
      label: 'Sorties + budgets',
      value: money(projectedDeductions),
      detail: `${money(projectedBudgetReserve)} en budgets non datés`,
      icon: ArrowDownRight,
      tone: 'text-rose-700 dark:text-rose-200',
      bg: 'bg-rose-100 dark:bg-rose-900/50',
      border: 'border-rose-200 dark:border-rose-800',
    },
    {
      label: 'Avec épargne',
      value: money(projectedTotalWithSavings),
      detail: `${money(projectedSavingsBalance)} projetés côté épargne`,
      icon: PiggyBank,
      tone: 'text-indigo-700 dark:text-indigo-200',
      bg: 'bg-indigo-100 dark:bg-indigo-900/50',
      border: 'border-indigo-200 dark:border-indigo-800',
    },
  ];

  const flowSteps = [
    { label: 'Départ', value: openingBalanceForMath, prefix: '', color: 'bg-sky-500', text: 'text-sky-700 dark:text-sky-300' },
    { label: 'Revenus', value: projectedIncoming, prefix: '+', color: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' },
    { label: 'Sorties prévues', value: projectedBaseExpenses + projectedDebtPayments + projectedTransfersOut + projectedSavingsOut, prefix: '-', color: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300' },
    { label: 'Budgets libres', value: projectedBudgetReserve, prefix: '-', color: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300' },
    { label: 'Reste', value: projectedCurrentBalance, prefix: '', color: projectedCurrentBalance >= 0 ? 'bg-emerald-500' : 'bg-red-500', text: projectedCurrentBalance >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300' },
  ];

  const statCards = [
    {
      label: 'Revenus encaisses',
      value: money(totalIncome),
      change: calculateChange(totalIncome, previousIncome),
      icon: ArrowUpRight,
      tone: 'text-emerald-700 dark:text-emerald-300',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
    {
      label: 'Depenses encaissees',
      value: money(totalExpenses),
      change: calculateChange(totalExpenses, previousExpenses),
      icon: ReceiptText,
      tone: 'text-red-700 dark:text-red-300',
      bg: 'bg-red-50 dark:bg-red-950/30',
    },
    {
      label: 'Resultat periode',
      value: money(periodResult),
      change: calculateChange(periodResult, previousResult),
      icon: ShieldCheck,
      tone: periodResult >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300',
      bg: periodResult >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-red-50 dark:bg-red-950/30',
    },
    {
      label: 'Patrimoine net',
      value: money(netWorth),
      change: null,
      icon: Wallet,
      tone: netWorth >= 0 ? 'text-sky-700 dark:text-sky-300' : 'text-red-700 dark:text-red-300',
      bg: netWorth >= 0 ? 'bg-sky-50 dark:bg-sky-950/30' : 'bg-red-50 dark:bg-red-950/30',
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
      setSelectedAccountIds(accounts.map(account => account.id));
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="p-4 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-md bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {format(periodStart, 'dd MMM', { locale: fr })} - {format(periodEnd, 'dd MMM yyyy', { locale: fr })}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ${remainingTone.bg} ${remainingTone.text} ${remainingTone.border}`}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {remainingTone.label}
                  </span>
                </div>
                <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                  Ton mois, en clair
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                  Le tableau commence par la décision importante : combien il restera, pourquoi, et quoi ajuster avant la fin de période.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsBankSyncOpen(true)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-sky-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 transition focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
                >
                  <Building2 className="h-4 w-4" />
                  <span>Synchro banque</span>
                </button>
                {primaryActions.map(action => {
                  const Icon = action.icon;
                  const isPrimary = action.style === 'primary';
                  return (
                    <button
                      key={action.view}
                      type="button"
                      onClick={() => onViewChange?.(action.view)}
                      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-950 ${
                        isPrimary
                          ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 focus:ring-blue-500'
                          : 'border border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50 focus:ring-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{action.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {insightCards.map(card => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className={`rounded-lg border p-4 ${card.border} ${card.bg}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold uppercase tracking-wide ${card.tone}`}>{card.label}</p>
                        <p className="mt-2 break-words text-xl font-semibold text-slate-950 dark:text-white">{card.value}</p>
                      </div>
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/80 ${card.tone} dark:bg-white/10`}>
                        <Icon className="h-4 w-4" />
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-slate-700/75 dark:text-slate-300/80">{card.detail}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Chemin de l'argent</p>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                      {money(openingBalanceForMath)} + {money(projectedIncoming)} - {money(projectedDeductions)} = <span className="font-semibold text-slate-950 dark:text-white">{money(projectedCurrentBalance)}</span>
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Budgets restants déjà réservés : {money(projectedBudgetReserve)}
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-5">
                  {flowSteps.map((step, index) => (
                    <div key={step.label} className="relative rounded-md bg-white p-3 ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800">
                      <div className={`mb-3 h-1.5 rounded-full ${step.color}`} />
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{step.label}</p>
                      <p className={`mt-1 break-words text-base font-semibold ${step.text}`}>
                        {step.prefix}{money(step.value)}
                      </p>
                      {index < flowSteps.length - 1 && (
                        <span className="absolute -right-1.5 top-1/2 hidden h-3 w-3 -translate-y-1/2 rotate-45 border-r border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 sm:block" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400 sm:grid-cols-5">
                  <span className="rounded-md bg-white px-2.5 py-2 ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800">Dépenses {compactMoney(projectedBaseExpenses)}</span>
                  <span className="rounded-md bg-white px-2.5 py-2 ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800">Dettes {compactMoney(projectedDebtPayments)}</span>
                  <span className="rounded-md bg-white px-2.5 py-2 ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800">Budgets {compactMoney(projectedBudgetReserve)}</span>
                  <span className="rounded-md bg-white px-2.5 py-2 ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800">Virements {compactMoney(projectedTransfersOut)}</span>
                  <span className="rounded-md bg-white px-2.5 py-2 ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800">Épargne {compactMoney(projectedSavingsOut)}</span>
                </div>
              </div>
            </div>
          </div>

          <aside className={`border-t p-4 text-white xl:border-l xl:border-t-0 sm:p-5 lg:p-6 ${
            projectedCurrentBalance >= 0
              ? 'border-emerald-700 bg-emerald-700 dark:border-emerald-800 dark:bg-emerald-950'
              : 'border-red-700 bg-red-700 dark:border-red-800 dark:bg-red-950'
          }`}>
            <p className="text-sm font-medium text-white/80">Reste estimé fin de période</p>
            <p className="mt-2 break-words text-4xl font-semibold tracking-tight text-white">
              {money(projectedCurrentBalance)}
            </p>
            <p className="mt-2 text-sm text-white/75">
              Impact restant : {money(projectionDelta)}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md bg-white/10 p-3 ring-1 ring-white/15">
                <p className="text-white/70">Compte courant</p>
                <p className="mt-1 font-semibold">{money(checkingAccountBalance)}</p>
              </div>
              <div className="rounded-md bg-white/10 p-3 ring-1 ring-white/15">
                <p className="text-white/70">Avec épargne</p>
                <p className="mt-1 font-semibold">{money(projectedTotalWithSavings)}</p>
              </div>
            </div>

            {nextGoal && (
              <button
                type="button"
                onClick={() => onViewChange?.('goals')}
                className="mt-5 w-full rounded-md bg-white/10 p-3 text-left ring-1 ring-white/15 transition hover:bg-white/20"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-white/70">Objectif suivi</p>
                    <p className="truncate text-sm font-semibold">{nextGoal.title}</p>
                  </div>
                  <span className="text-sm font-semibold">{nextGoalProgress.toFixed(0)}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full rounded-full bg-white" style={{ width: `${nextGoalProgress}%` }} />
                </div>
              </button>
            )}
          </aside>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="grid grid-cols-2 rounded-md bg-slate-100 p-1 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('monthly')}
              className={`rounded px-3 py-2 text-sm font-semibold transition ${viewMode === 'monthly' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'}`}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setViewMode('yearly')}
              className={`rounded px-3 py-2 text-sm font-semibold transition ${viewMode === 'yearly' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'}`}
            >
              Annuel
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAccountFilter(!showAccountFilter)}
              className="inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-950"
            >
              <Filter className="h-4 w-4" />
              Comptes {selectedAccountCount}/{accounts.length}
            </button>

            {showAccountFilter && (
              <div className="absolute left-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
                <div className="border-b border-slate-200 p-3 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={toggleAllAccounts}
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                  >
                    {selectedAccountIds.length === accounts.length ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {selectedAccountIds.length === accounts.length ? 'Masquer tout' : 'Afficher tout'}
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto p-2">
                  {accounts.map(account => (
                    <label key={account.id} className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-slate-50 dark:hover:bg-slate-900">
                      <input
                        type="checkbox"
                        checked={selectedAccountIds.length === 0 || selectedAccountIds.includes(account.id)}
                        onChange={() => handleAccountToggle(account.id)}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                      />
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: account.color }} />
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-100">{account.name}</span>
                      <span className="text-xs text-slate-500">{money(account.balance)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900">
          <SlidersHorizontal className="h-4 w-4" />
          Vue {viewMode === 'monthly' ? 'période budgétaire' : 'annuelle'}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-xs font-semibold uppercase tracking-wide ${card.tone}`}>{card.label}</p>
                  <p className="mt-2 break-words text-xl font-semibold text-slate-950 dark:text-white">{card.value}</p>
                </div>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${card.bg} ${card.tone}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{card.change || 'Référence stable'}</p>
            </div>
          );
        })}
      </section>

      <AccountsOverview />

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <ExpenseChart viewMode={viewMode} />
        <BudgetProgress viewMode={viewMode} />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <SavingsGoalsProgress />
        <CashFlowChart />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <RecentTransactions title="Dernieres transactions terminees" />
        <RecentTransactions
          title="Operations a venir"
          mode="upcoming"
          periodStart={currentMonthPeriod.start}
          periodEnd={currentMonthPeriod.end}
        />
      </section>

      <BankSyncModal
        isOpen={isBankSyncOpen}
        onClose={() => setIsBankSyncOpen(false)}
      />
    </div>
  );
};

export default Dashboard;
