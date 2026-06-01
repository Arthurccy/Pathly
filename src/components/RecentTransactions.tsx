import React, { useMemo, useState } from 'react';
import { endOfMonth, format, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as LucideIcons from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';
import type { Transaction, Debt } from '../types';

const toDateInputValue = (date: Date) => date.toISOString().split('T')[0];

const getTransactionDisplayImpact = (transaction: Transaction) => {
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

interface RecentTransactionsProps {
  limit?: number;
  title?: string;
  mode?: 'recent' | 'upcoming' | 'all';
  periodEnd?: Date;
}

const RecentTransactions: React.FC<RecentTransactionsProps> = ({
  limit = 10,
  title = 'Dernieres transactions',
  mode = 'recent',
  periodEnd,
}) => {
  const { transactions, categories, accounts, debts, updateTransaction, deleteTransaction, getProjectedRecurringTransactions } = useBudget();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    accountId: '',
    categoryId: '',
    type: 'expense' as 'expense' | 'income',
    date: '',
    status: 'completed' as 'pending' | 'completed' | 'scheduled',
  });
  const [isSaving, setIsSaving] = useState(false);

  const recentTransactions = useMemo(
    () => {
      const projectionStart = startOfDay(new Date());
      const projectionEnd = periodEnd ?? endOfMonth(projectionStart);
      const actualTransactionKeys = new Set(
        transactions
          .filter(transaction => !transaction.isRecurring)
          .map(transaction => [
            transaction.accountId,
            transaction.categoryId,
            transaction.description,
            transaction.amount,
            transaction.type,
            toDateInputValue(transaction.date),
          ].join('|'))
      );
      const projectedRecurringTransactions = mode === 'recent'
        ? []
        : getProjectedRecurringTransactions(projectionStart, projectionEnd).filter(transaction => {
          const key = [
            transaction.accountId,
            transaction.categoryId,
            transaction.description,
            transaction.amount,
            transaction.type,
            toDateInputValue(transaction.date),
          ].join('|');

          return !actualTransactionKeys.has(key);
        });

      const upcomingDebtTransactions: Transaction[] = mode === 'upcoming'
        ? debts
            .filter(debt => debt.isActive && startOfDay(debt.dueDate) >= projectionStart && startOfDay(debt.dueDate) <= projectionEnd)
            .map(debt => {
              const debtCategory = categories.find(category => category.id === debt.categoryId) || categories.find(category => category.type === 'debt');

              return {
                id: `debt-${debt.id}`,
                userId: '',
                accountId: debt.accountId,
                amount: debt.minimumPayment,
                description: `Paiement dette: ${debt.name}`,
                date: debt.dueDate,
                categoryId: debtCategory?.id || '',
                type: 'expense',
                status: 'scheduled',
                isRecurring: false,
                memo: 'Dette',
                tags: ['debt'],
                transferToAccountId: undefined,
                isChecked: false,
                attachments: [],
              } as Transaction;
            })
        : [];

      const sourceTransactions = transactions.concat(projectedRecurringTransactions, upcomingDebtTransactions).filter(transaction => {
        if (transaction.isRecurring) return false;
        if (mode === 'upcoming') {
          const isInPeriod = startOfDay(transaction.date) <= projectionEnd;
          return (transaction.status === 'scheduled' || transaction.status === 'pending') && isInPeriod;
        }
        if (mode === 'recent') return transaction.status === 'completed';
        return true;
      });
      const sortedTransactions = [...sourceTransactions].sort((a, b) => {
        if (mode === 'upcoming') return a.date.getTime() - b.date.getTime();
        return b.date.getTime() - a.date.getTime();
      });
      return limit ? sortedTransactions.slice(0, limit) : sortedTransactions;
    },
    [getProjectedRecurringTransactions, limit, mode, transactions, debts, categories]
  );
  const groupedTransactions = useMemo(() => {
    if (mode !== 'all') {
      return [{ key: mode, title: title, transactions: recentTransactions }];
    }

    const upcoming = recentTransactions
      .filter(transaction => transaction.status === 'scheduled')
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    const pending = recentTransactions
      .filter(transaction => transaction.status === 'pending')
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    const completed = recentTransactions
      .filter(transaction => transaction.status === 'completed')
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    return [
      { key: 'scheduled', title: 'À venir', transactions: upcoming },
      { key: 'pending', title: 'En attente', transactions: pending },
      { key: 'completed', title: 'Terminées', transactions: completed },
    ].filter(group => group.transactions.length > 0);
  }, [mode, recentTransactions, title]);

  const activeAccounts = accounts.filter(account => account.isActive);
  const availableCategories = categories.filter(category => category.type === formData.type);

  const openEditor = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      amount: transaction.amount.toString(),
      description: transaction.description,
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
      type: transaction.type === 'income' ? 'income' : 'expense',
      date: toDateInputValue(transaction.date),
      status: transaction.status === 'cancelled' ? 'pending' : transaction.status,
    });
  };

  const closeEditor = () => {
    setEditingTransaction(null);
    setIsSaving(false);
  };

  const handleTypeChange = (type: 'expense' | 'income') => {
    setFormData(prev => ({
      ...prev,
      type,
      categoryId: '',
    }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!editingTransaction) return;
    if (!formData.amount || !formData.description || !formData.accountId || !formData.categoryId || !formData.date) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      setIsSaving(true);
      await updateTransaction(editingTransaction.id, {
        amount: parseFloat(formData.amount),
        description: formData.description,
        accountId: formData.accountId,
        categoryId: formData.categoryId,
        type: formData.type,
        date: new Date(formData.date),
        status: formData.status,
        isRecurring: editingTransaction.isRecurring,
        recurringPattern: editingTransaction.recurringPattern,
      });
      closeEditor();
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert("Impossible de modifier cette transaction. Verifiez les champs puis reessayez.");
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingTransaction) return;
    const confirmed = window.confirm('Supprimer cette transaction ? Le solde du compte sera ajuste.');
    if (!confirmed) return;

    try {
      setIsSaving(true);
      await deleteTransaction(editingTransaction.id);
      closeEditor();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert("Impossible de supprimer cette transaction.");
      setIsSaving(false);
    }
  };

  const renderTransaction = (transaction: Transaction) => {
    const category = categories.find(c => c.id === transaction.categoryId);
    const account = accounts.find(a => a.id === transaction.accountId);
    const IconComponent = category ? (LucideIcons as any)[category.icon] : LucideIcons.DollarSign;
    const displayImpact = getTransactionDisplayImpact(transaction);
    const isProjectedRecurring = transaction.id.includes('-projected-');
    const isDebtPayment = transaction.id.startsWith('debt-');

    return (
      <div key={transaction.id} className="p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 sm:p-4">
        <div className="flex items-start gap-3 sm:items-center sm:gap-4">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${category?.color || '#6B7280'}20` }}
          >
            <IconComponent
              className="h-5 w-5"
              style={{ color: category?.color || '#6B7280' }}
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
              {transaction.description}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {category?.name || 'Sans categorie'}
              </span>
              {account && (
                <>
                  <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{account.name}</span>
                </>
              )}
              <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {format(transaction.date, 'dd MMM yyyy', { locale: fr })}
              </span>
              {transaction.status !== 'completed' && (
                <>
                  <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    transaction.status === 'scheduled'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  }`}>
                    {transaction.status === 'scheduled' ? 'Planifiée' : 'En attente'}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">
            <p className={`whitespace-nowrap text-sm font-semibold ${
              displayImpact >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {displayImpact >= 0 ? '+' : '-'}{Math.abs(displayImpact).toFixed(2)} EUR
            </p>
            {!isProjectedRecurring && !isDebtPayment && (
              <button
                type="button"
                onClick={() => openEditor(transaction)}
                className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:bg-gray-700 dark:hover:text-gray-200 sm:rounded-lg"
                aria-label="Modifier la transaction"
              >
                <LucideIcons.Pencil className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 p-4 dark:border-gray-700 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
        </div>

        {recentTransactions.length > 0 ? (
          <div className={mode === 'all' ? 'space-y-4 p-3 sm:p-4' : 'divide-y divide-gray-200 dark:divide-gray-700'}>
            {mode === 'all' ? (
              groupedTransactions.map(group => (
                <section key={group.key} className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
                  <div className={`flex items-center justify-between px-4 py-3 ${
                    group.key === 'scheduled'
                      ? 'bg-blue-50 text-blue-900 dark:bg-blue-950/30 dark:text-blue-100'
                      : group.key === 'pending'
                        ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
                        : 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
                  }`}>
                    <h4 className="text-sm font-semibold">{group.title}</h4>
                    <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium dark:bg-gray-950/30">
                      {group.transactions.length}
                    </span>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {group.transactions.map(renderTransaction)}
                  </div>
                </section>
              ))
            ) : recentTransactions.map((transaction) => {
              const category = categories.find(c => c.id === transaction.categoryId);
              const account = accounts.find(a => a.id === transaction.accountId);
              const IconComponent = category ? (LucideIcons as any)[category.icon] : LucideIcons.DollarSign;
              const displayImpact = getTransactionDisplayImpact(transaction);
              const isProjectedRecurring = transaction.id.includes('-projected-');

              return (
                <div key={transaction.id} className="p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 sm:p-4">
                  <div className="flex items-start gap-3 sm:items-center sm:gap-4">
                    <div
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: `${category?.color || '#6B7280'}20` }}
                    >
                      <IconComponent
                        className="h-5 w-5"
                        style={{ color: category?.color || '#6B7280' }}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {transaction.description}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {category?.name || 'Sans categorie'}
                        </span>
                        {account && (
                          <>
                            <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{account.name}</span>
                          </>
                        )}
                        <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {format(transaction.date, 'dd MMM yyyy', { locale: fr })}
                        </span>
                        {transaction.status !== 'completed' && (
                          <>
                            <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                              {transaction.status === 'scheduled' ? 'Planifiée' : 'En attente'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <p className={`whitespace-nowrap text-sm font-semibold ${
                        displayImpact >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {displayImpact >= 0 ? '+' : '-'}{Math.abs(displayImpact).toFixed(2)} EUR
                      </p>
                      {!isProjectedRecurring && (
                        <button
                          type="button"
                          onClick={() => openEditor(transaction)}
                          className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:bg-gray-700 dark:hover:text-gray-200 sm:rounded-lg"
                          aria-label="Modifier la transaction"
                        >
                          <LucideIcons.Pencil className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <p className="text-lg mb-2">Aucune transaction</p>
            <p className="text-sm">Commencez par ajouter votre premiere transaction</p>
          </div>
        )}
      </div>

      {editingTransaction && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92dvh] w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-gray-900 sm:max-w-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900 sm:px-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-950 dark:text-white">Modifier la transaction</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Les soldes seront recalcules automatiquement.</p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                aria-label="Fermer"
              >
                <LucideIcons.X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="max-h-[calc(92dvh-5rem)] space-y-5 overflow-y-auto p-5 sm:p-6">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleTypeChange('expense')}
                  className={`rounded-xl border-2 p-4 font-medium transition ${
                    formData.type === 'expense'
                      ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300'
                  }`}
                >
                  Depense
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('income')}
                  className={`rounded-xl border-2 p-4 font-medium transition ${
                    formData.type === 'income'
                      ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300'
                  }`}
                >
                  Revenu
                </button>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label htmlFor="edit-amount" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Montant *
                  </label>
                  <input
                    id="edit-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="edit-date" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Date *
                  </label>
                  <input
                    id="edit-date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="edit-description" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description *
                </label>
                <input
                  id="edit-description"
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  required
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label htmlFor="edit-account" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Compte *
                  </label>
                  <select
                    id="edit-account"
                    value={formData.accountId}
                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    required
                  >
                    {activeAccounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-category" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Categorie *
                  </label>
                  <select
                    id="edit-category"
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    required
                  >
                    <option value="">Choisir une categorie</option>
                    {availableCategories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Statut
                </label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, status: 'pending' })}
                    className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition ${
                      formData.status === 'pending'
                        ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <LucideIcons.Clock className="h-4 w-4" />
                    En attente
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, status: 'scheduled' })}
                    className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition ${
                      formData.status === 'scheduled'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <LucideIcons.CalendarClock className="h-4 w-4" />
                    Planifiée
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, status: 'completed' })}
                    className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition ${
                      formData.status === 'completed'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <LucideIcons.CheckCircle2 className="h-4 w-4" />
                    Terminé
                  </button>
                </div>
              </div>

              <div className="sticky bottom-0 -mx-5 flex flex-col-reverse gap-3 border-t border-gray-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95 sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-3 font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-900/70 dark:text-red-300 dark:hover:bg-red-900/20"
                >
                  <LucideIcons.Trash2 className="h-4 w-4" />
                  Supprimer
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeEditor}
                    disabled={isSaving}
                    className="rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700 disabled:bg-blue-400"
                  >
                    <LucideIcons.Save className="h-4 w-4" />
                    {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default RecentTransactions;
