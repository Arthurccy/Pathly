import React, { useState, useMemo } from 'react';
import { 
  Users, 
  HeartHandshake, 
  Percent, 
  Calculator, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRightLeft, 
  Plus, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  TrendingUp, 
  Sparkles, 
  SlidersHorizontal,
  DollarSign,
  Receipt,
  Check,
  X,
  CreditCard,
  Scale
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBudget } from '../contexts/BudgetContext';
import { Transaction } from '../types';

const HouseholdManager: React.FC = () => {
  const { 
    householdConfig, 
    updateHouseholdConfig, 
    transactions, 
    categories, 
    toggleTransactionShared, 
    updateTransaction,
    ratioA, 
    ratioB 
  } = useBudget();

  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'balance' | 'expenses' | 'settings'>('balance');

  // Month interval
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);

  // Month transactions
  const monthTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d >= monthStart && d <= monthEnd;
    });
  }, [transactions, monthStart, monthEnd]);

  // Shared expenses paid by user A (Arthur)
  const sharedExpenses = useMemo(() => {
    return monthTransactions.filter(t => 
      t.isShared && (t.type === 'expense' || t.type === 'bill')
    );
  }, [monthTransactions]);

  // Total amount of shared expenses
  const totalSharedAmount = useMemo(() => {
    return sharedExpenses.reduce((sum, t) => sum + t.amount, 0);
  }, [sharedExpenses]);

  // Theoretical share for each partner
  const userAShare = (totalSharedAmount * ratioA) / 100;
  const userBShare = (totalSharedAmount * ratioB) / 100;

  // Contributions / transfers received from user B (Alicia)
  const partnerContributions = useMemo(() => {
    return monthTransactions.filter(t => {
      if (t.isHouseholdContribution) return true;
      if (t.type !== 'income' && t.type !== 'transfer') return false;
      const desc = t.description.toLowerCase();
      const userB = householdConfig.userB.name.toLowerCase();
      return desc.includes(userB) || desc.includes('foyer') || desc.includes('provision') || desc.includes('aide alicia');
    });
  }, [monthTransactions, householdConfig.userB.name]);

  const totalContributionsReceived = useMemo(() => {
    return partnerContributions.reduce((sum, t) => sum + t.amount, 0);
  }, [partnerContributions]);

  // Balance: what Alicia has contributed minus what she is expected to pay
  // Positive: Arthur has advance or Alicia has overpaid
  // Negative: Alicia still owes money to Arthur
  const balance = totalContributionsReceived - userBShare;
  const isSettled = Math.abs(balance) < 1;

  // Quick toggle a contribution
  const toggleContribution = async (t: Transaction) => {
    await updateTransaction(t.id, {
      isHouseholdContribution: !t.isHouseholdContribution,
    });
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
              Répartition équitable des dépenses communes et balance d'équilibrage mensuelle.
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

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('balance')}
          className={`pb-3 transition border-b-2 flex items-center gap-2 ${
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
          className={`pb-3 transition border-b-2 flex items-center gap-2 ${
            activeTab === 'expenses'
              ? 'border-rose-600 text-rose-600 dark:border-rose-400 dark:text-rose-400 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <Receipt className="h-4 w-4" />
          <span>Dépenses communes du mois</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            {sharedExpenses.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-3 transition border-b-2 flex items-center gap-2 ${
            activeTab === 'settings'
              ? 'border-rose-600 text-rose-600 dark:border-rose-400 dark:text-rose-400 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>Profils & Répartition ({ratioA}/{ratioB})</span>
        </button>
      </div>

      {/* TAB 1: BALANCE D'EQUILIBRAGE */}
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
                  Sur <strong>{totalSharedAmount.toFixed(2)} €</strong> de dépenses communes enregistrées ce mois-ci, la quote-part de {householdConfig.userB.name} ({ratioB}%) s'élève à <strong>{userBShare.toFixed(2)} €</strong>. Provisions versées : <strong>{totalContributionsReceived.toFixed(2)} €</strong>.
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
                <span>{sharedExpenses.length} dépense{sharedExpenses.length > 1 ? 's' : ''} cochée{sharedExpenses.length > 1 ? 's' : ''}</span>
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
                Aucun virement d'Alicia ou de provision foyer détecté pour ce mois-ci. Vous pouvez marquer une rentrée d'argent comme participation au foyer dans la liste des transactions.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DEPENSES COMMUNES */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                Dépenses communes de {format(selectedMonth, 'MMMM yyyy', { locale: fr })}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Cochez ou décochez n'importe quelle dépense pour l'inclure dans le pot commun du foyer.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-500 dark:text-gray-400 block">Total partagé</span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {totalSharedAmount.toFixed(2)} €
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 shadow-sm overflow-hidden">
            {monthTransactions
              .filter(t => t.type === 'expense' || t.type === 'bill')
              .map(t => {
                const category = categories.find(c => c.id === t.categoryId);
                const IconComponent = category ? (LucideIcons as any)[category.icon] || LucideIcons.DollarSign : LucideIcons.DollarSign;
                const userAPart = (t.amount * ratioA) / 100;
                const userBPart = (t.amount * ratioB) / 100;

                return (
                  <div 
                    key={t.id} 
                    className={`p-3 sm:p-4 flex items-center justify-between transition-colors ${
                      t.isShared 
                        ? 'bg-rose-50/40 dark:bg-rose-950/20' 
                        : 'hover:bg-gray-50 dark:hover:bg-gray-750'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Checkbox toggle */}
                      <button
                        type="button"
                        onClick={() => toggleTransactionShared(t.id)}
                        className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                          t.isShared
                            ? 'bg-rose-600 border-rose-600 text-white shadow-sm'
                            : 'border-gray-300 dark:border-gray-600 hover:border-rose-400'
                        }`}
                        title={t.isShared ? "Retirer des dépenses communes" : "Marquer comme dépense commune"}
                      >
                        {t.isShared && <Check className="h-4 w-4 stroke-[3]" />}
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
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {t.description}
                          </p>
                          {t.isShared && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 shrink-0">
                              Foyer ({ratioA}/{ratioB})
                            </span>
                          )}
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
                      {t.isShared ? (
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

            {monthTransactions.filter(t => t.type === 'expense' || t.type === 'bill').length === 0 && (
              <div className="p-8 text-center text-sm text-gray-500">
                Aucune dépense enregistrée sur ce mois.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PROFILS & REPARTITION */}
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
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-600 dark:text-gray-300'
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
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-600 dark:text-gray-300'
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
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-600 dark:text-gray-300'
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
