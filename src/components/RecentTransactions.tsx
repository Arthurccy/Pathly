import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as LucideIcons from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';
import type { Transaction } from '../types';

const toDateInputValue = (date: Date) => date.toISOString().split('T')[0];

const RecentTransactions: React.FC = () => {
  const { transactions, categories, accounts, updateTransaction, deleteTransaction } = useBudget();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    accountId: '',
    categoryId: '',
    type: 'expense' as 'expense' | 'income',
    date: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const recentTransactions = useMemo(
    () => [...transactions].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10),
    [transactions]
  );

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
        status: editingTransaction.isRecurring || formData.date > new Date().toISOString().split('T')[0]
          ? 'scheduled'
          : 'completed',
        isRecurring: editingTransaction.isRecurring,
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

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Dernieres transactions
          </h3>
        </div>

        {recentTransactions.length > 0 ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {recentTransactions.map((transaction) => {
              const category = categories.find(c => c.id === transaction.categoryId);
              const account = accounts.find(a => a.id === transaction.accountId);
              const IconComponent = category ? (LucideIcons as any)[category.icon] : LucideIcons.DollarSign;

              return (
                <div key={transaction.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center gap-4">
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
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <p className={`whitespace-nowrap text-sm font-semibold ${
                        transaction.type === 'income'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}{transaction.amount.toFixed(2)} EUR
                      </p>
                      <button
                        type="button"
                        onClick={() => openEditor(transaction)}
                        className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                        aria-label="Modifier la transaction"
                      >
                        <LucideIcons.Pencil className="h-4 w-4" />
                      </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
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

            <form onSubmit={handleSave} className="space-y-5 p-6">
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

              <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-5 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
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
