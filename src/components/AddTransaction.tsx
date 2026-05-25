import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, Plus, Save } from 'lucide-react';
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
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (formData.isRecurring && !formData.nextDate) {
      alert('Veuillez sélectionner la date de la prochaine occurrence');
      return;
    }

    if (!activeAccounts.some(account => account.id === formData.accountId)) {
      alert('Veuillez sélectionner un compte valide');
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

      alert('Transaction ajoutée avec succès !');
    } catch (error) {
      console.error('Error submitting transaction:', error);
      alert("Impossible d'ajouter la transaction. Vérifiez les champs puis réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableCategories = categories.filter(c => c.type === formData.type);

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
          <Plus className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Ajouter une transaction
        </h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Type de transaction *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'expense', categoryId: '' })}
                className={`p-4 rounded-lg border-2 transition-all ${
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
                className={`p-4 rounded-lg border-2 transition-all ${
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {availableCategories.map((category) => {
                const IconComponent = (LucideIcons as any)[category.icon] || LucideIcons.DollarSign;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, categoryId: category.id })}
                    className={`p-4 rounded-lg border-2 transition-all ${
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
    </div>
  );
};

export default AddTransaction;
