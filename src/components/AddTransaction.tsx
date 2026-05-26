import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, CreditCard, Plus, Save, X } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';

const AddTransaction: React.FC = () => {
  const { accounts, categories, addTransaction } = useBudget();
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    accountId: '',
    categoryId: '',
    type: 'expense' as 'expense' | 'income',
    date: new Date().toISOString().split('T')[0],
    isRecurring: false,
    frequency: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly',
    interval: 1,
    nextDate: new Date().toISOString().split('T')[0],
    endDate: '',
    maxOccurrences: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);

  const activeAccounts = useMemo(
    () => accounts.filter(account => account.isActive),
    [accounts]
  );

  useEffect(() => {
    if (formData.accountId && activeAccounts.some(account => account.id === formData.accountId)) {
      return;
    }

    setFormData(prev => ({
      ...prev,
      accountId: activeAccounts[0]?.id || '',
    }));
  }, [activeAccounts, formData.accountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.amount || !formData.description || !formData.accountId || !formData.categoryId) {
      setNotice({
        type: 'error',
        title: 'Champs manquants',
        message: 'Renseignez le montant, la description, le compte et la categorie.',
      });
      return;
    }

    if (formData.isRecurring && !formData.nextDate) {
      setNotice({
        type: 'error',
        title: 'Date manquante',
        message: 'Selectionnez la date de la prochaine occurrence.',
      });
      return;
    }

    if (!activeAccounts.some(account => account.id === formData.accountId)) {
      setNotice({
        type: 'error',
        title: 'Compte invalide',
        message: 'Selectionnez un compte actif avant d enregistrer.',
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const transactionPayload: any = {
        accountId: formData.accountId,
        amount: parseFloat(formData.amount),
        description: formData.description,
        categoryId: formData.categoryId,
        type: formData.type,
        date: new Date(formData.isRecurring ? formData.nextDate : formData.date),
        status: formData.isRecurring || formData.date > new Date().toISOString().split('T')[0]
          ? 'scheduled'
          : 'completed',
        isRecurring: formData.isRecurring,
      };

      if (formData.isRecurring) {
        transactionPayload.recurringPattern = {
          frequency: formData.frequency,
          interval: formData.interval,
          nextDate: new Date(formData.nextDate),
          endDate: formData.endDate ? new Date(formData.endDate) : undefined,
          maxOccurrences: formData.maxOccurrences ? parseInt(formData.maxOccurrences) : undefined,
          currentOccurrence: 0,
          isActive: true,
        };
      }

      await addTransaction(transactionPayload);

      setFormData(prev => ({
        amount: '',
        description: '',
        accountId: prev.accountId,
        categoryId: '',
        type: 'expense',
        date: new Date().toISOString().split('T')[0],
        isRecurring: false,
        frequency: 'monthly',
        interval: 1,
        nextDate: new Date().toISOString().split('T')[0],
        endDate: '',
        maxOccurrences: '',
      }));

      setNotice({
        type: 'success',
        title: 'Transaction ajoutee',
        message: formData.date > new Date().toISOString().split('T')[0] || formData.isRecurring
          ? 'Elle est bien planifiee dans vos operations a venir.'
          : 'Elle est bien enregistree dans vos transactions.',
      });
    } catch (error) {
      console.error('Error submitting transaction:', error);
      setNotice({
        type: 'error',
        title: 'Enregistrement impossible',
        message: 'Verifiez les champs puis reessayez.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableCategories = categories.filter(c => c.type === formData.type);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
          <Plus className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
          Ajouter une transaction
        </h1>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Type de transaction *
            </label>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'expense', categoryId: '' })}
                  className={`rounded-xl border-2 p-3 transition-all sm:p-4 ${
                  formData.type === 'expense'
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <div className="text-center">
                  <div className="font-medium">Dépense</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'income', categoryId: '' })}
                  className={`rounded-xl border-2 p-3 transition-all sm:p-4 ${
                  formData.type === 'income'
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <div className="text-center">
                  <div className="font-medium">Revenu</div>
                </div>
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Montant * (€)
            </label>
            <input
              type="number"
              id="amount"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-lg"
              placeholder="0,00"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description *
            </label>
            <input
              type="text"
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="Ex: Courses au supermarché"
              required
            />
          </div>

          <div>
            <label htmlFor="account" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Compte *
            </label>
            {activeAccounts.length > 0 ? (
              <select
                id="account"
                value={formData.accountId}
                onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                required
              >
                {activeAccounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.name} - {account.balance.toFixed(2)} {account.currency}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center space-x-3 p-4 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <CreditCard className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Créez ou activez un compte avant d'ajouter une transaction.
                </p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Catégorie *
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
              {availableCategories.map((category) => {
                const IconComponent = (LucideIcons as any)[category.icon] || LucideIcons.DollarSign;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, categoryId: category.id })}
                    className={`rounded-xl border-2 p-3 transition-all sm:p-4 ${
                      formData.categoryId === category.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="text-center">
                      <div
                        className="p-2 rounded-lg mx-auto mb-2 w-fit"
                        style={{ backgroundColor: `${category.color}20` }}
                      >
                        <IconComponent
                          className="h-5 w-5"
                          style={{ color: category.color }}
                        />
                      </div>
                      <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {category.name}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <input
              id="isRecurring"
              type="checkbox"
              checked={formData.isRecurring}
              onChange={(e) => setFormData({
                ...formData,
                isRecurring: e.target.checked,
                nextDate: e.target.checked ? formData.date : formData.nextDate,
              })}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isRecurring" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Transaction récurrente
            </label>
          </div>

          {!formData.isRecurring ? (
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date *
              </label>
              <input
                type="date"
                id="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="frequency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Fréquence *
                  </label>
                  <select
                    id="frequency"
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="weekly">Hebdomadaire</option>
                    <option value="monthly">Mensuelle</option>
                    <option value="quarterly">Trimestrielle</option>
                    <option value="yearly">Annuelle</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="interval" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Intervalle
                  </label>
                  <input
                    type="number"
                    id="interval"
                    min="1"
                    value={formData.interval}
                    onChange={(e) => setFormData({ ...formData, interval: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="nextDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date de la prochaine occurrence *
                </label>
                <input
                  type="date"
                  id="nextDate"
                  value={formData.nextDate}
                  onChange={(e) => setFormData({ ...formData, nextDate: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date de fin (optionnel)
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="maxOccurrences" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nombre max d'occurrences
                  </label>
                  <input
                    type="number"
                    id="maxOccurrences"
                    min="1"
                    value={formData.maxOccurrences}
                    onChange={(e) => setFormData({ ...formData, maxOccurrences: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Illimité"
                  />
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || activeAccounts.length === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <Save className="h-5 w-5" />
            <span>{isSubmitting ? 'Enregistrement...' : 'Enregistrer la transaction'}</span>
          </button>
        </form>
      </div>

      {notice && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl dark:bg-gray-900 sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                notice.type === 'success'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
              }`}>
                {notice.type === 'success' ? <CheckCircle2 className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
              </div>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5">
              <h2 className="text-xl font-semibold text-gray-950 dark:text-white">{notice.title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{notice.message}</p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddTransaction;
