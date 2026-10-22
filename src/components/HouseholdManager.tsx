import React, { useState, useMemo } from 'react';
import { 
  Users, 
  HeartHandshake, 
  Percent, 
  CheckCircle2, 
  ArrowRightLeft, 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  SlidersHorizontal,
  Receipt,
  Check,
  X,
  CreditCard,
  Scale,
  Target,
  CheckSquare,
  Square,
  Layers,
  ArrowRight,
  Info,
  DollarSign
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBudget } from '../contexts/BudgetContext';
import { Transaction, Category } from '../types';

const HouseholdManager: React.FC = () => {
  const { 
    householdConfig, 
    updateHouseholdConfig, 
    transactions, 
    accounts,
    categories, 
    updateCategory,
    toggleTransactionShared, 
    toggleCategoryShared,
    isTransactionShared,
    updateTransaction,
    ratioA, 
    ratioB 
  } = useBudget();

  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'balance' | 'budgets' | 'expenses' | 'settings'>('budgets');
  const [expenseFilter, setExpenseFilter] = useState<'all' | 'shared' | 'personal'>('all');
  const [categoryFilterId, setCategoryFilterId] = useState<string | null>(null);

  // Shared category IDs set by user
  const sharedCategoryIds = useMemo(() => {
    return householdConfig.sharedCategoryIds || [];
  }, [householdConfig.sharedCategoryIds]);

  // Month interval
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  // Accounts taken into account in this view (none selected = all of them)
  const householdAccounts = useMemo(() => accounts.filter(a => a.isActive !== false), [accounts]);
  const selectedAccountIds = useMemo(
    () => (householdConfig.accountIds || []).filter(id => householdAccounts.some(a => a.id === id)),
    [householdConfig.accountIds, householdAccounts]
  );
  const allAccountsSelected = selectedAccountIds.length === 0;

  const toggleHouseholdAccount = async (accountId: string) => {
    const next = selectedAccountIds.includes(accountId)
      ? selectedAccountIds.filter(id => id !== accountId)
      : [...selectedAccountIds, accountId];
    // Selecting every account is the same as "all"
    await updateHouseholdConfig({ accountIds: next.length === householdAccounts.length ? [] : next });
  };

  // Month transactions
  const monthTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (!allAccountsSelected && !selectedAccountIds.includes(t.accountId)) return false;
      const d = new Date(t.date);
      return d >= monthStart && d <= monthEnd;
    });
  }, [transactions, monthStart, monthEnd, allAccountsSelected, selectedAccountIds]);

  // All month expenses & bills
  const monthExpenses = useMemo(() => {
    return monthTransactions.filter(t => t.type === 'expense' || t.type === 'bill');
  }, [monthTransactions]);

  // Shared expenses: computed via isTransactionShared (auto via common budgets + manual exceptions)
  const sharedExpenses = useMemo(() => {
    return monthExpenses.filter(t => isTransactionShared(t));
  }, [monthExpenses, isTransactionShared]);

  // Total amount of shared expenses
  const totalSharedAmount = useMemo(() => {
    return sharedExpenses.reduce((sum, t) => sum + t.amount, 0);
  }, [sharedExpenses]);

  // Theoretical share for each partner
  const userAShare = (totalSharedAmount * ratioA) / 100;
  const userBShare = (totalSharedAmount * ratioB) / 100;

  // Contributions / transfers received from user B (Partner)
  const partnerContributions = useMemo(() => {
    return monthTransactions.filter(t => {
      if (t.isHouseholdContribution) return true;
      if (t.type !== 'income' && t.type !== 'transfer') return false;
      const desc = t.description.toLowerCase();
      const userB = (householdConfig.userB?.name || '').toLowerCase();
      return (userB && desc.includes(userB)) || desc.includes('foyer') || desc.includes('provision') || desc.includes('partenaire');
    });
  }, [monthTransactions, householdConfig.userB?.name]);

  const totalContributionsReceived = useMemo(() => {
    return partnerContributions.reduce((sum, t) => sum + t.amount, 0);
  }, [partnerContributions]);

  // Balance: what user B has contributed minus what they are expected to pay
  const balance = totalContributionsReceived - userBShare;
  const isSettled = Math.abs(balance) < 1;

  // Filterable categories of expense/bill type
  const expenseCategories = useMemo(() => {
    return categories
      .filter(c => c.type === 'expense' || c.type === 'bill')
      .sort((a, b) => {
        const aShared = sharedCategoryIds.includes(a.id) ? 1 : 0;
        const bShared = sharedCategoryIds.includes(b.id) ? 1 : 0;
        if (bShared !== aShared) return bShared - aShared;
        return a.name.localeCompare(b.name);
      });
  }, [categories, sharedCategoryIds]);

  // Spending per category for the current month
  const categoryStats = useMemo(() => {
    const stats: Record<string, { spent: number; count: number }> = {};
    monthExpenses.forEach(t => {
      if (!stats[t.categoryId]) {
        stats[t.categoryId] = { spent: 0, count: 0 };
      }
      stats[t.categoryId].spent += t.amount;
      stats[t.categoryId].count += 1;
    });
    return stats;
  }, [monthExpenses]);

  // Total planned common budget (sum of category budgets for shared categories)
  const totalPlannedSharedBudget = useMemo(() => {
    return expenseCategories
      .filter(c => sharedCategoryIds.includes(c.id))
      .reduce((sum, c) => sum + (c.budget || 0), 0);
  }, [expenseCategories, sharedCategoryIds]);

  // Quick actions for category selection
  const selectAllCategories = async () => {
    const allIds = expenseCategories.map(c => c.id);
    await updateHouseholdConfig({ sharedCategoryIds: allIds });
  };

  const deselectAllCategories = async () => {
    await updateHouseholdConfig({ sharedCategoryIds: [] });
  };

  const selectRecommendedCategories = async () => {
    const recommendedIds = expenseCategories
      .filter(c => {
        const n = c.name.toLowerCase();
        return (
          c.type === 'bill' ||
          n.includes('logement') ||
          n.includes('aliment') ||
          n.includes('course') ||
          n.includes('electr') ||
          n.includes('internet') ||
          n.includes('loyer') ||
          n.includes('assurance')
        );
      })
      .map(c => c.id);
    await updateHouseholdConfig({ sharedCategoryIds: recommendedIds });
  };

  // Quick toggle a contribution
  const toggleContribution = async (t: Transaction) => {
    await updateTransaction(t.id, {
      isHouseholdContribution: !t.isHouseholdContribution,
    });
  };

  // Switch to expense view for a specific category
  const viewExpensesForCategory = (catId: string) => {
    setCategoryFilterId(catId);
    setExpenseFilter('all');
    setActiveTab('expenses');
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-rose-100 dark:bg-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400">
            <HeartHandshake className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Gestion de Foyer & Couple
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
                {ratioA}% {householdConfig.userA.name} / {ratioB}% {householdConfig.userB.name}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Budgets communs du couple, répartition dynamique et balance d'équilibrage mensuelle.
            </p>
          </div>
        </div>

        {/* Month selector */}
        <div className="flex items-center justify-between gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-1 shadow-sm">
          <button
            onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition"
            title="Mois précédent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold capitalize px-2 text-gray-800 dark:text-gray-200 min-w-[8.5rem] text-center">
            {format(selectedMonth, 'MMMM yyyy', { locale: fr })}
          </span>
          <button
            onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition"
            title="Mois suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Accounts included in the household view */}
      {householdAccounts.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Comptes pris en compte
          </span>
          <button
            type="button"
            onClick={() => updateHouseholdConfig({ accountIds: [] })}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              allAccountsSelected
                ? 'border-rose-600 bg-rose-600 text-white'
                : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-600 dark:text-gray-300'
            }`}
          >
            Tous
          </button>
          {householdAccounts.map(account => {
            const active = selectedAccountIds.includes(account.id);
            return (
              <button
                key={account.id}
                type="button"
                onClick={() => toggleHouseholdAccount(account.id)}
                aria-pressed={active}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active
                    ? 'border-rose-600 bg-rose-50 text-rose-700 dark:border-rose-500 dark:bg-rose-950/30 dark:text-rose-300'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-600 dark:text-gray-300'
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: account.color || '#94a3b8' }} />
                {account.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 gap-2 sm:gap-6 text-sm font-medium overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('budgets')}
          className={`pb-3 transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'budgets'
              ? 'border-rose-600 text-rose-600 dark:border-rose-400 dark:text-rose-400 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <Target className="h-4 w-4" />
          <span>Budgets communs du foyer</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            activeTab === 'budgets' 
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300' 
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          }`}>
            {sharedCategoryIds.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('balance')}
          className={`pb-3 transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'balance'
              ? 'border-rose-600 text-rose-600 dark:border-rose-400 dark:text-rose-400 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <Scale className="h-4 w-4" />
          <span>Solde & Équilibre du foyer</span>
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={`pb-3 transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'expenses'
              ? 'border-rose-600 text-rose-600 dark:border-rose-400 dark:text-rose-400 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <Receipt className="h-4 w-4" />
          <span>Dépenses du mois (Ajustements)</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            {sharedExpenses.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-3 transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'settings'
              ? 'border-rose-600 text-rose-600 dark:border-rose-400 dark:text-rose-400 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>Profils & Répartition ({ratioA}/{ratioB})</span>
        </button>
      </div>

      {/* TAB 1: SELECTION DES BUDGETS COMMUNS */}
      {activeTab === 'budgets' && (
        <div className="space-y-6">
          {/* Explanation Banner */}
          <div className="rounded-2xl border border-rose-200/80 bg-gradient-to-r from-rose-50/80 via-pink-50/40 to-indigo-50/40 p-5 dark:border-rose-900/40 dark:from-rose-950/20 dark:via-pink-950/10 dark:to-indigo-950/10 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Target className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                  Sélectionnez les Budgets Communs du Foyer
                </h2>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 max-w-2xl leading-relaxed">
                  Cochez les catégories qui concernent votre couple (Courses, Logement, Électricité, Sorties communes...). Toutes les dépenses passées dans ces budgets sont automatiquement partagées selon votre prorata ({ratioA}% / {ratioB}%), sans devoir cocher chaque dépense individuellement.
                </p>
              </div>

              {/* Summary pill */}
              <div className="shrink-0 flex items-center gap-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur p-3.5 rounded-xl border border-rose-100 dark:border-gray-800 shadow-sm">
                <div>
                  <span className="text-[11px] uppercase font-bold tracking-wider text-gray-500 dark:text-gray-400 block">
                    Budget Commun Prévisionnel
                  </span>
                  <span className="text-xl font-black text-rose-600 dark:text-rose-400">
                    {totalPlannedSharedBudget.toFixed(0)} € / mois
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block mt-0.5">
                    Toi : {((totalPlannedSharedBudget * ratioA) / 100).toFixed(0)} € • {householdConfig.userB.name} : {((totalPlannedSharedBudget * ratioB) / 100).toFixed(0)} €
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-4 pt-3 border-t border-rose-200/50 dark:border-rose-900/30 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500 dark:text-gray-400 font-medium">Actions rapides :</span>
                <button
                  type="button"
                  onClick={selectRecommendedCategories}
                  className="px-3 py-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-rose-700 dark:text-rose-300 font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/40 transition shadow-xs"
                >
                  Sélection recommandée (Essentiels)
                </button>
                <button
                  type="button"
                  onClick={selectAllCategories}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 transition shadow-xs"
                >
                  Tout cocher
                </button>
                <button
                  type="button"
                  onClick={deselectAllCategories}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 transition shadow-xs"
                >
                  Tout décocher
                </button>
              </div>

              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                {sharedCategoryIds.length} budget{sharedCategoryIds.length > 1 ? 's' : ''} commun{sharedCategoryIds.length > 1 ? 's' : ''} sur {expenseCategories.length}
              </span>
            </div>
          </div>

          {/* Grid of Categories / Budgets */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {expenseCategories.map(cat => {
              const IconComponent = (LucideIcons as any)[cat.icon] || LucideIcons.DollarSign;
              const isShared = sharedCategoryIds.includes(cat.id);
              const stats = categoryStats[cat.id] || { spent: 0, count: 0 };
              const userAPart = (stats.spent * ratioA) / 100;
              const userBPart = (stats.spent * ratioB) / 100;

              return (
                <div
                  key={cat.id}
                  className={`rounded-xl border p-5 transition-all flex flex-col justify-between ${
                    isShared
                      ? 'bg-white dark:bg-gray-800 border-rose-200 dark:border-rose-900/60 shadow-card ring-1 ring-rose-500/10'
                      : 'bg-gray-50/60 dark:bg-slate-900/40 border-gray-200/80 dark:border-gray-700 opacity-80 hover:opacity-100'
                  }`}
                >
                  <div>
                    {/* Header: Icon, Name, and Toggle */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div 
                          className="p-2.5 rounded-xl shrink-0"
                          style={{ backgroundColor: `${cat.color || '#3B82F6'}20` }}
                        >
                          <IconComponent className="h-5 w-5" style={{ color: cat.color || '#3B82F6' }} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                            {cat.name}
                          </h3>
                          <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 ${
                            isShared
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                              : 'bg-gray-200/70 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {isShared ? `Partagé (${ratioA}/${ratioB})` : '100% Personnel'}
                          </span>
                        </div>
                      </div>

                      {/* Interactive Toggle Switch */}
                      <button
                        type="button"
                        onClick={() => toggleCategoryShared(cat.id)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isShared ? 'bg-rose-600' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                        title={isShared ? "Désactiver du pot commun" : "Activer comme budget commun"}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            isShared ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Spendings this month */}
                    <div className="mt-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 space-y-2">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">Dépensé ce mois-ci :</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {stats.spent.toFixed(2)} €
                        </span>
                      </div>

                      {/* Budget envelope if defined */}
                      {cat.budget ? (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400">
                            <span>Budget mensuel :</span>
                            <span className="font-semibold text-gray-700 dark:text-gray-300">{cat.budget.toFixed(0)} €</span>
                          </div>
                          <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${
                                stats.spent > cat.budget ? 'bg-rose-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, (stats.spent / cat.budget) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between text-[11px] text-gray-400 italic">
                          <span>Aucun plafond défini</span>
                          <span>{stats.count} dépense{stats.count > 1 ? 's' : ''}</span>
                        </div>
                      )}

                      {/* Shared split if common */}
                      {isShared && stats.spent > 0 && (
                        <div className="pt-1.5 border-t border-gray-200/60 dark:border-gray-700/60 flex items-center justify-between text-[11px]">
                          <span className="text-blue-600 dark:text-blue-400 font-medium">Toi ({ratioA}%) : {userAPart.toFixed(2)} €</span>
                          <span className="text-purple-600 dark:text-purple-400 font-medium">{householdConfig.userB.name} ({ratioB}%) : {userBPart.toFixed(2)} €</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer: Link to view expenses */}
                  <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between text-xs">
                    <span className="text-gray-400 text-[11px]">
                      {stats.count} transaction{stats.count > 1 ? 's' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => viewExpensesForCategory(cat.id)}
                      className="text-rose-600 dark:text-rose-400 font-semibold hover:underline flex items-center gap-1 text-xs"
                    >
                      <span>Voir les dépenses</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: BALANCE D'EQUILIBRAGE */}
      {activeTab === 'balance' && (
        <div className="space-y-6">
          {/* Main Hero Card: Settlement Status */}
          <div className={`rounded-2xl p-6 border shadow-sm transition-all ${
            isSettled
              ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200 dark:from-emerald-950/30 dark:to-teal-950/20 dark:border-emerald-800/60'
              : balance < 0
                ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 dark:from-blue-950/40 dark:to-indigo-950/30 dark:border-blue-800/60'
                : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 dark:from-amber-950/40 dark:to-orange-950/30 dark:border-amber-800/60'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${
                  isSettled
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                    : balance < 0
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                }`}>
                  {isSettled ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Compte à jour
                    </>
                  ) : balance < 0 ? (
                    <>
                      <ArrowRightLeft className="h-4 w-4" /> Régularisation en attente
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> Avance sur le foyer
                    </>
                  )}
                </span>

                <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
                  {isSettled
                    ? 'Comptes du foyer parfaitement équilibrés'
                    : balance < 0
                      ? `Participation restante de ${householdConfig.userB.name} : ${Math.abs(balance).toFixed(2)} €`
                      : `Avance de ${balance.toFixed(2)} € sur les dépenses communes`
                  }
                </h2>

                <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl leading-relaxed">
                  Sur <strong>{totalSharedAmount.toFixed(2)} €</strong> de dépenses communes enregistrées ce mois-ci (via vos {sharedCategoryIds.length} budgets communs et exceptions éventuelles), la quote-part de {householdConfig.userB.name} ({ratioB}%) s'élève à <strong>{userBShare.toFixed(2)} €</strong>. Provisions versées : <strong>{totalContributionsReceived.toFixed(2)} €</strong>.
                </p>
              </div>

              <div className="shrink-0 flex flex-col items-start md:items-end gap-2 bg-white/70 dark:bg-gray-900/60 backdrop-blur p-4 rounded-xl border border-white/80 dark:border-gray-800 shadow-sm min-w-[200px]">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">
                  Solde net du mois
                </span>
                <span className={`text-3xl font-black ${
                  isSettled 
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : balance < 0 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-amber-600 dark:text-amber-400'
                }`}>
                  {balance >= 0 ? '+' : ''}{balance.toFixed(2)} €
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {isSettled ? 'Comptes équilibrés' : balance < 0 ? `Reste à régulariser (${householdConfig.userB.name})` : 'Avance enregistrée'}
                </span>
              </div>
            </div>
          </div>

          {/* 3 Metric Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Dépenses Communes */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total Dépenses Communes
                </span>
                <Receipt className="h-5 w-5 text-rose-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalSharedAmount.toFixed(2)} €
              </p>
              <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
                <span>{sharedExpenses.length} dépense{sharedExpenses.length > 1 ? 's' : ''} partagée{sharedExpenses.length > 1 ? 's' : ''}</span>
                <button 
                  onClick={() => setActiveTab('expenses')}
                  className="text-rose-600 dark:text-rose-400 font-semibold hover:underline"
                >
                  Voir le détail &rarr;
                </button>
              </div>
            </div>

            {/* Répartition des parts */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Répartition ({ratioA}% / {ratioB}%)
                </span>
                <Users className="h-5 w-5 text-indigo-500" />
              </div>
              <div className="space-y-1 mt-1">
                <div className="flex justify-between items-center text-sm font-semibold">
                  <span className="text-blue-600 dark:text-blue-400">Ta part ({ratioA}%) :</span>
                  <span className="text-gray-900 dark:text-white">{userAShare.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between items-center text-sm font-semibold">
                  <span className="text-purple-600 dark:text-purple-400">Part {householdConfig.userB.name} ({ratioB}%) :</span>
                  <span className="text-gray-900 dark:text-white">{userBShare.toFixed(2)} €</span>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <span>Mode : <strong className="capitalize">{householdConfig.splitMode}</strong></span>
                <button 
                  onClick={() => setActiveTab('settings')}
                  className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                >
                  Modifier &rarr;
                </button>
              </div>
            </div>

            {/* Provisions reçues */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Provisions Reçues ({householdConfig.userB.name})
                </span>
                <CreditCard className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {totalContributionsReceived.toFixed(2)} €
              </p>
              <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <span>{partnerContributions.length} virement{partnerContributions.length > 1 ? 's' : ''} comptabilisé{partnerContributions.length > 1 ? 's' : ''}</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  Objectif: {userBShare.toFixed(2)} €
                </span>
              </div>
            </div>
          </div>

          {/* Synthesis of Shared Budgets this month */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Target className="h-5 w-5 text-rose-500" />
                  Budgets Communs Actifs ce mois-ci
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Suivi des enveloppes de dépenses partagées au sein du couple
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('budgets')}
                className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
              >
                <span>Modifier les budgets communs</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {expenseCategories
                .filter(c => sharedCategoryIds.includes(c.id))
                .map(cat => {
                  const IconComponent = (LucideIcons as any)[cat.icon] || LucideIcons.DollarSign;
                  const stats = categoryStats[cat.id] || { spent: 0, count: 0 };
                  const userBPart = (stats.spent * ratioB) / 100;

                  return (
                    <div 
                      key={cat.id} 
                      onClick={() => viewExpensesForCategory(cat.id)}
                      className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 hover:bg-white dark:hover:bg-gray-800 hover:shadow-xs transition cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div 
                            className="p-1.5 rounded-lg"
                            style={{ backgroundColor: `${cat.color || '#3B82F6'}20` }}
                          >
                            <IconComponent className="h-4 w-4" style={{ color: cat.color || '#3B82F6' }} />
                          </div>
                          <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                            {cat.name}
                          </span>
                        </div>
                        <span className="text-xs font-extrabold text-gray-900 dark:text-white">
                          {stats.spent.toFixed(2)} €
                        </span>
                      </div>

                      <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400">
                        <span>{stats.count} dépense{stats.count > 1 ? 's' : ''}</span>
                        <span className="text-purple-600 dark:text-purple-400 font-semibold">
                          Part {householdConfig.userB.name} : {userBPart.toFixed(2)} €
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Quick Section: Provisions reçues ce mois-ci */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-500" />
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Virements & Provisions Foyer reçus de {householdConfig.userB.name}
                </h3>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Détectés automatiquement ou cochés manuellement
              </span>
            </div>

            {partnerContributions.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {partnerContributions.map(t => (
                  <div key={t.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{t.description}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {format(new Date(t.date), 'dd MMMM yyyy', { locale: fr })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        +{t.amount.toFixed(2)} €
                      </span>
                      <button
                        onClick={() => toggleContribution(t)}
                        title="Retirer cette provision du décompte"
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 transition"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 text-center text-xs text-gray-500 dark:text-gray-400">
                Aucun virement de participation ou de provision foyer détecté pour ce mois-ci. Vous pouvez marquer une rentrée d'argent comme participation au foyer dans la liste des transactions.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DEPENSES DU MOIS & AJUSTEMENTS */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          {/* Header & filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                Dépenses de {format(selectedMonth, 'MMMM yyyy', { locale: fr })}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Les dépenses de vos budgets communs sont déjà incluses. Cochez ou décochez pour ajuster manuellement une exception.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-500 dark:text-gray-400 block">Total partagé</span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {totalSharedAmount.toFixed(2)} €
              </span>
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => { setExpenseFilter('all'); setCategoryFilterId(null); }}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                expenseFilter === 'all' && !categoryFilterId
                  ? 'bg-rose-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'
              }`}
            >
              Toutes les dépenses ({monthExpenses.length})
            </button>
            <button
              onClick={() => { setExpenseFilter('shared'); setCategoryFilterId(null); }}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                expenseFilter === 'shared' && !categoryFilterId
                  ? 'bg-rose-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'
              }`}
            >
              Communes ({sharedExpenses.length})
            </button>
            <button
              onClick={() => { setExpenseFilter('personal'); setCategoryFilterId(null); }}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                expenseFilter === 'personal' && !categoryFilterId
                  ? 'bg-rose-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'
              }`}
            >
              Personnelles ({monthExpenses.length - sharedExpenses.length})
            </button>

            {categoryFilterId && (
              <span className="ml-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-semibold">
                Filtre : {categories.find(c => c.id === categoryFilterId)?.name}
                <button 
                  onClick={() => setCategoryFilterId(null)}
                  className="hover:text-rose-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>

          {/* Transactions List */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 shadow-sm overflow-hidden">
            {monthExpenses
              .filter(t => {
                const isShared = isTransactionShared(t);
                if (categoryFilterId && t.categoryId !== categoryFilterId) return false;
                if (expenseFilter === 'shared') return isShared;
                if (expenseFilter === 'personal') return !isShared;
                return true;
              })
              .map(t => {
                const category = categories.find(c => c.id === t.categoryId);
                const IconComponent = category ? (LucideIcons as any)[category.icon] || LucideIcons.DollarSign : LucideIcons.DollarSign;
                const isShared = isTransactionShared(t);
                const isCategoryCommon = sharedCategoryIds.includes(t.categoryId);
                const userAPart = (t.amount * ratioA) / 100;
                const userBPart = (t.amount * ratioB) / 100;

                // Status classification
                let statusLabel = '100% perso';
                let statusBadgeClass = 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
                if (isCategoryCommon && isShared) {
                  statusLabel = `Budget commun : ${category?.name || 'Foyer'}`;
                  statusBadgeClass = 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
                } else if (!isCategoryCommon && isShared) {
                  statusLabel = 'Exception : Ajouté au foyer';
                  statusBadgeClass = 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
                } else if (isCategoryCommon && !isShared) {
                  statusLabel = 'Exception : Exclu du foyer';
                  statusBadgeClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
                }

                return (
                  <div 
                    key={t.id} 
                    className={`p-3 sm:p-4 flex items-center justify-between transition-colors ${
                      isShared 
                        ? 'bg-rose-50/30 dark:bg-rose-950/20' 
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Checkbox toggle */}
                      <button
                        type="button"
                        onClick={() => toggleTransactionShared(t.id)}
                        className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                          isShared
                            ? 'bg-rose-600 border-rose-600 text-white shadow-sm'
                            : 'border-gray-300 dark:border-gray-600 hover:border-rose-400'
                        }`}
                        title={isShared ? "Exclure cette dépense du foyer" : "Ajouter cette dépense au foyer"}
                      >
                        {isShared && <Check className="h-4 w-4 stroke-[3]" />}
                      </button>

                      {/* Category Icon */}
                      <div 
                        className="p-2 rounded-lg shrink-0 hidden sm:block"
                        style={{ backgroundColor: `${category?.color || '#3B82F6'}20` }}
                      >
                        <IconComponent className="h-4 w-4" style={{ color: category?.color || '#3B82F6' }} />
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {t.description}
                          </p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusBadgeClass}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {format(new Date(t.date), 'dd MMM', { locale: fr })} • {category?.name || 'Dépense'}
                        </p>
                      </div>
                    </div>

                    {/* Amount & split info */}
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                        {t.amount.toFixed(2)} €
                      </p>
                      {isShared ? (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          Toi: <strong className="text-blue-600 dark:text-blue-400">{userAPart.toFixed(2)}€</strong> | {householdConfig.userB.name}: <strong className="text-purple-600 dark:text-purple-400">{userBPart.toFixed(2)}€</strong>
                        </p>
                      ) : (
                        <p className="text-[11px] text-gray-400">100% perso</p>
                      )}
                    </div>
                  </div>
                );
              })}

            {monthExpenses.length === 0 && (
              <div className="p-8 text-center text-sm text-gray-500">
                Aucune dépense enregistrée sur ce mois.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: PROFILS & REPARTITION */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Form profiles */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-5">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-500" />
              Profils & Revenus du Foyer
            </h3>

            {/* User A */}
            <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                  Utilisateur A (Toi)
                </span>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {ratioA}% du foyer
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Prénom</label>
                  <input
                    type="text"
                    value={householdConfig.userA.name}
                    onChange={(e) => updateHouseholdConfig({
                      userA: { ...householdConfig.userA, name: e.target.value }
                    })}
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Revenu net mensuel (€)</label>
                  <input
                    type="number"
                    value={householdConfig.userA.income}
                    onChange={(e) => updateHouseholdConfig({
                      userA: { ...householdConfig.userA, income: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* User B */}
            <div className="p-4 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                  Utilisateur B (Conjoint / Coloc)
                </span>
                <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                  {ratioB}% du foyer
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Prénom</label>
                  <input
                    type="text"
                    value={householdConfig.userB.name}
                    onChange={(e) => updateHouseholdConfig({
                      userB: { ...householdConfig.userB, name: e.target.value }
                    })}
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Revenu net mensuel (€)</label>
                  <input
                    type="number"
                    value={householdConfig.userB.income}
                    onChange={(e) => updateHouseholdConfig({
                      userB: { ...householdConfig.userB, income: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Mode de calcul */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-900 dark:text-white block">
                Mode de Répartition des Dépenses
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => updateHouseholdConfig({ splitMode: 'prorata' })}
                  className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition ${
                    householdConfig.splitMode === 'prorata'
                      ? 'border-rose-600 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-500 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  Prorata (Auto)
                </button>
                <button
                  type="button"
                  onClick={() => updateHouseholdConfig({ splitMode: '50_50' })}
                  className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition ${
                    householdConfig.splitMode === '50_50'
                      ? 'border-rose-600 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-500 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  50 / 50 (Égal)
                </button>
                <button
                  type="button"
                  onClick={() => updateHouseholdConfig({ splitMode: 'custom', customRatioA: ratioA })}
                  className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition ${
                    householdConfig.splitMode === 'custom'
                      ? 'border-rose-600 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-500 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  Personnalisé
                </button>
              </div>

              {householdConfig.splitMode === 'custom' && (
                <div className="pt-2">
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                    <span>Ta part : <strong>{householdConfig.customRatioA || 50}%</strong></span>
                    <span>Part {householdConfig.userB.name} : <strong>{100 - (householdConfig.customRatioA || 50)}%</strong></span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="99"
                    value={householdConfig.customRatioA || 50}
                    onChange={(e) => updateHouseholdConfig({ customRatioA: parseInt(e.target.value) })}
                    className="w-full accent-rose-600"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Visual explainer & impact */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-5">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Percent className="h-5 w-5 text-rose-500" />
              Jauge de Répartition du Foyer
            </h3>

            <div className="space-y-3">
              <div className="w-full h-8 bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden flex shadow-inner">
                <div 
                  className="bg-blue-600 text-white font-bold text-xs flex items-center justify-center transition-all duration-500"
                  style={{ width: `${ratioA}%` }}
                >
                  {ratioA}% ({householdConfig.userA.name})
                </div>
                <div 
                  className="bg-purple-600 text-white font-bold text-xs flex items-center justify-center transition-all duration-500"
                  style={{ width: `${ratioB}%` }}
                >
                  {ratioB}% ({householdConfig.userB.name})
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 text-center text-xs">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                  <p className="font-semibold text-blue-900 dark:text-blue-200">{householdConfig.userA.name}</p>
                  <p className="text-base font-extrabold text-blue-600 dark:text-blue-400 mt-0.5">{householdConfig.userA.income} €</p>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">Paye {ratioA}% des frais communs</p>
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
                  <p className="font-semibold text-purple-900 dark:text-purple-200">{householdConfig.userB.name}</p>
                  <p className="text-base font-extrabold text-purple-600 dark:text-purple-400 mt-0.5">{householdConfig.userB.income} €</p>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">Paye {ratioB}% des frais communs</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 space-y-2 text-xs text-gray-600 dark:text-gray-300">
              <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-rose-500" />
                Comment fonctionne le prorata automatique ?
              </p>
              <p>
                Le total des revenus de votre couple est de <strong>{(householdConfig.userA.income + householdConfig.userB.income).toFixed(0)} €</strong>.
              </p>
              <p>
                Chacun contribue exactement à la hauteur de ce qu'il gagne. Par exemple, pour une facture d'électricité de 100 €, {householdConfig.userA.name} finance {ratioA} € et {householdConfig.userB.name} finance {ratioB} €.
              </p>
              <p className="text-gray-500 dark:text-gray-400 italic">
                Toutes les modifications sont enregistrées en base de données et recalculent instantanément votre balance du mois.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HouseholdManager;
