import React, { useState } from 'react';
import { Calendar, Clock, Repeat, Plus, Edit, Trash2, Play, Pause, Percent } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { format, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBudget } from '../contexts/BudgetContext';
import { Transaction, RecurringPattern } from '../types';

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

const RecurringTransactions: React.FC = () => {
  const { transactions, categories, accounts, addTransaction, updateTransaction, deleteTransaction } = useBudget();
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    categoryId: '',
    accountId: '',
    transferToAccountId: '',
    type: 'expense' as 'expense' | 'income' | 'transfer',
    frequency: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly',
    interval: 1,
    nextDate: new Date().toISOString().split('T')[0],
    endDate: '',
    maxOccurrences: '',
    calculationType: 'fixed' as 'fixed' | 'percentage',
    percentage: '',
    linkedTransactionId: '',
  });

  const recurringTransactions = transactions.filter(t => t.isRecurring);

  const selectedLinkedTransaction = recurringTransactions.find(t => t.id === formData.linkedTransactionId);

  const resetForm = () => {
    setFormData({
      amount: '',
      description: '',
      categoryId: '',
      accountId: '',
      transferToAccountId: '',
      type: 'expense',
      frequency: 'monthly',
      interval: 1,
      nextDate: new Date().toISOString().split('T')[0],
      endDate: '',
      maxOccurrences: '',
      calculationType: 'fixed',
      percentage: '',
      linkedTransactionId: '',
    });
    setShowForm(false);
    setEditingTransaction(null);
  };

  const getFrequencyLabel = (frequency: string, interval: number) => {
    const labels = {
      daily: interval === 1 ? 'Quotidien' : `Tous les ${interval} jours`,
      weekly: interval === 1 ? 'Hebdomadaire' : `Toutes les ${interval} semaines`,
      monthly: interval === 1 ? 'Mensuel' : `Tous les ${interval} mois`,
      quarterly: interval === 1 ? 'Trimestriel' : `Tous les ${interval} trimestres`,
      yearly: interval === 1 ? 'Annuel' : `Tous les ${interval} ans`,
    };
    return labels[frequency as keyof typeof labels] || frequency;
  };

  const getNextOccurrence = (pattern: RecurringPattern) => {
    const { frequency, interval, nextDate } = pattern;
    let next = new Date(nextDate);
    
    switch (frequency) {
      case 'daily':
        return addDays(next, interval);
      case 'weekly':
        return addWeeks(next, interval);
      case 'monthly':
        return addMonths(next, interval);
      case 'quarterly':
        return addMonths(next, interval * 3);
      case 'yearly':
        return addYears(next, interval);
      default:
        return next;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.calculationType === 'percentage') {
      if (!formData.linkedTransactionId) {
        alert('Veuillez sélectionner la transaction récurrente de référence');
        return;
      }
      if (!formData.percentage || parseFloat(formData.percentage) <= 0) {
        alert('Veuillez renseigner un pourcentage valide');
        return;
      }
    } else {
      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        alert('Veuillez renseigner un montant valide');
        return;
      }
    }

    if (!formData.description || !formData.accountId) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }
    if (formData.type !== 'transfer' && !formData.categoryId) {
      alert('Veuillez sélectionner une catégorie');
      return;
    }
    if (formData.type === 'transfer' && (!formData.transferToAccountId || formData.transferToAccountId === formData.accountId)) {
      alert('Veuillez choisir deux comptes différents pour le virement');
      return;
    }

    const transferCategory = categories.find(category =>
      category.name.trim().toLowerCase() === 'transferts'
    );
    if (formData.type === 'transfer' && !transferCategory) {
      alert('Créez d’abord un virement simple entre comptes pour initialiser la catégorie Transferts.');
      return;
    }
    const destinationAccount = accounts.find(account => account.id === formData.transferToAccountId);

    let finalAmount = parseFloat(formData.amount) || 0;
    const linkedTx = recurringTransactions.find(t => t.id === formData.linkedTransactionId);
    if (formData.calculationType === 'percentage' && linkedTx) {
      const pct = parseFloat(formData.percentage) || 0;
      finalAmount = Math.round((linkedTx.amount * (pct / 100)) * 100) / 100;
    }

    const recurringPattern: RecurringPattern = {
      frequency: formData.frequency,
      interval: formData.interval,
      nextDate: new Date(formData.nextDate),
      endDate: formData.endDate ? new Date(formData.endDate) : undefined,
      maxOccurrences: formData.maxOccurrences ? parseInt(formData.maxOccurrences) : undefined,
      currentOccurrence: editingTransaction?.recurringPattern?.currentOccurrence || 0,
      isActive: editingTransaction?.recurringPattern ? editingTransaction.recurringPattern.isActive : true,
      calculationType: formData.calculationType,
      percentage: formData.calculationType === 'percentage' ? parseFloat(formData.percentage) : undefined,
      linkedTransactionId: formData.calculationType === 'percentage' ? formData.linkedTransactionId : undefined,
    };

    const transactionData = {
      amount: finalAmount,
      description: formData.type === 'transfer'
        ? `Virement vers ${destinationAccount?.name || 'compte'} - ${formData.description}`
        : formData.description,
      categoryId: formData.type === 'transfer' ? transferCategory!.id : formData.categoryId,
      accountId: formData.accountId,
      type: formData.type,
      date: new Date(formData.nextDate),
      status: 'scheduled' as const,
      isRecurring: true,
      recurringPattern,
      transferToAccountId: formData.type === 'transfer' ? formData.transferToAccountId : undefined,
    };

    if (editingTransaction) {
      updateTransaction(editingTransaction.id, transactionData);
    } else {
      addTransaction(transactionData);
    }

    resetForm();
  };

  const toggleRecurringStatus = (transaction: Transaction) => {
    if (transaction.recurringPattern) {
      updateTransaction(transaction.id, {
        recurringPattern: {
          ...transaction.recurringPattern,
          isActive: !transaction.recurringPattern.isActive
        }
      });
    }
  };

  const editRecurring = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      amount: transaction.amount.toString(),
      description: transaction.type === 'transfer'
        ? transaction.description.replace(/^Virement vers .+? - /, '')
        : transaction.description,
      categoryId: transaction.categoryId,
      accountId: transaction.accountId,
      transferToAccountId: transaction.transferToAccountId || '',
      type: transaction.type === 'transfer' ? 'transfer' : transaction.type as 'expense' | 'income',
      frequency: transaction.recurringPattern?.frequency || 'monthly',
      interval: transaction.recurringPattern?.interval || 1,
      nextDate: transaction.recurringPattern?.nextDate.toISOString().split('T')[0] || transaction.date.toISOString().split('T')[0],
      endDate: transaction.recurringPattern?.endDate?.toISOString().split('T')[0] || '',
      maxOccurrences: transaction.recurringPattern?.maxOccurrences?.toString() || '',
      calculationType: transaction.recurringPattern?.calculationType || 'fixed',
      percentage: transaction.recurringPattern?.percentage !== undefined ? transaction.recurringPattern.percentage.toString() : '',
      linkedTransactionId: transaction.recurringPattern?.linkedTransactionId || '',
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
            <Repeat className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Transactions récurrentes
          </h1>
        </div>
        
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>Nouvelle récurrence</span>
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {editingTransaction ? 'Modifier' : 'Créer'} une transaction récurrente
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Type *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'expense', categoryId: '' })}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      formData.type === 'expense'
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    Dépense
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'income', categoryId: '' })}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      formData.type === 'income'
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    Revenu
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'transfer', categoryId: '' })}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      formData.type === 'transfer'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    Virement
                  </button>
                </div>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description *
                </label>
                <input
                  type="text"
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Ex: Prime de performance, Salaire..."
                  required
                />
              </div>

              {/* Mode de montant et calcul */}
              <div className="col-span-1 md:col-span-2 bg-purple-50/50 dark:bg-purple-950/20 p-4 rounded-xl border border-purple-200/80 dark:border-purple-800/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-sm font-semibold text-gray-900 dark:text-gray-200">
                    Mode de calcul du montant *
                  </label>
                  <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 bg-gray-100 dark:bg-gray-850">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, calculationType: 'fixed' }))}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        formData.calculationType === 'fixed'
                          ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      Montant fixe (€)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, calculationType: 'percentage' }))}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center space-x-1.5 ${
                        formData.calculationType === 'percentage'
                          ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      <Percent className="h-3 w-3" />
                      <span>Pourcentage (%) d'une récurrence</span>
                    </button>
                  </div>
                </div>

                {formData.calculationType === 'fixed' ? (
                  <div>
                    <label htmlFor="amount" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Montant fixe (€) *
                    </label>
                    <input
                      type="number"
                      id="amount"
                      step="0.01"
                      min="0"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder="0.00"
                      required
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="linkedTransactionId" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Lié à la transaction récurrente (ex: Salaire) *
                        </label>
                        <select
                          id="linkedTransactionId"
                          value={formData.linkedTransactionId}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            const linkedTx = recurringTransactions.find(t => t.id === selectedId);
                            const pct = parseFloat(formData.percentage) || 0;
                            const calc = linkedTx ? ((linkedTx.amount * pct) / 100).toFixed(2) : formData.amount;
                            setFormData(prev => ({
                              ...prev,
                              linkedTransactionId: selectedId,
                              amount: calc,
                            }));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                          required
                        >
                          <option value="">Sélectionner une transaction récurrente</option>
                          {recurringTransactions
                            .filter(t => t.id !== editingTransaction?.id)
                            .map(t => (
                              <option key={t.id} value={t.id}>
                                {t.description} ({t.amount.toFixed(2)} €)
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="percentage" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Pourcentage (%) *
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            id="percentage"
                            step="0.01"
                            min="0"
                            max="1000"
                            value={formData.percentage}
                            onChange={(e) => {
                              const pctVal = e.target.value;
                              const pct = parseFloat(pctVal) || 0;
                              const linkedTx = recurringTransactions.find(t => t.id === formData.linkedTransactionId);
                              const calc = linkedTx ? ((linkedTx.amount * pct) / 100).toFixed(2) : '';
                              setFormData(prev => ({
                                ...prev,
                                percentage: pctVal,
                                amount: calc,
                              }));
                            }}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white pr-8"
                            placeholder="Ex: 10 pour 10%"
                            required
                          />
                          <span className="absolute right-3 top-2 text-gray-500 dark:text-gray-400 font-semibold text-sm">%</span>
                        </div>
                      </div>
                    </div>

                    {selectedLinkedTransaction && (
                      <div className="p-3 bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="flex items-center space-x-2 text-purple-900 dark:text-purple-200">
                          <Percent className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                          <span>
                            Montant calculé : <strong className="text-sm font-bold text-purple-700 dark:text-purple-300">{(parseFloat(formData.amount) || 0).toFixed(2)} €</strong> ({formData.percentage || 0}% de {selectedLinkedTransaction.description} à {selectedLinkedTransaction.amount.toFixed(2)} €)
                          </span>
                        </div>
                        <span className="text-purple-600 dark:text-purple-400 italic">
                          Mise à jour automatique en cas d'ajustement du salaire
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Account */}
              <div>
                <label htmlFor="account" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Compte *
                </label>
                <select
                  id="account"
                  value={formData.accountId}
                  onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  required
                >
                  <option value="">Sélectionner un compte</option>
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>

              {formData.type === 'transfer' && (
                <div>
                  <label htmlFor="transferToAccount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Vers le compte *
                  </label>
                  <select
                    id="transferToAccount"
                    value={formData.transferToAccountId}
                    onChange={(e) => setFormData({ ...formData, transferToAccountId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    required
                  >
                    <option value="">Sélectionner un compte</option>
                    {accounts
                      .filter(account => account.id !== formData.accountId)
                      .map(account => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Category */}
              {formData.type !== 'transfer' && (
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Catégorie *
                </label>
                <select
                  id="category"
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  required
                >
                  <option value="">Sélectionner une catégorie</option>
                  {categories
                    .filter(c => c.type === formData.type)
                    .map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </div>
              )}

              {/* Frequency */}
              <div>
                <label htmlFor="frequency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Fréquence *
                </label>
                <select
                  id="frequency"
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  required
                >
                  <option value="daily">Quotidien</option>
                  <option value="weekly">Hebdomadaire</option>
                  <option value="monthly">Mensuel</option>
                  <option value="yearly">Annuel</option>
                </select>
              </div>

              {/* Interval */}
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Next Date */}
              <div>
                <label htmlFor="nextDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Prochaine occurrence *
                </label>
                <input
                  type="date"
                  id="nextDate"
                  value={formData.nextDate}
                  onChange={(e) => setFormData({ ...formData, nextDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              {/* End Date */}
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date de fin (optionnel)
                </label>
                <input
                  type="date"
                  id="endDate"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Max Occurrences */}
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Illimité"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                {editingTransaction ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Recurring Transactions List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Transactions récurrentes ({recurringTransactions.length})
          </h3>
        </div>

        {recurringTransactions.length > 0 ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {recurringTransactions.map((transaction) => {
              const category = categories.find(c => c.id === transaction.categoryId);
              const account = accounts.find(a => a.id === transaction.accountId);
              const IconComponent = category ? (LucideIcons as any)[category.icon] : LucideIcons.DollarSign;
              const pattern = transaction.recurringPattern;
              const linkedTx = pattern?.linkedTransactionId
                ? transactions.find(t => t.id === pattern.linkedTransactionId)
                : undefined;
              const displayImpact = getTransactionDisplayImpact(transaction);
              const displayPattern = pattern || {
                frequency: 'monthly' as const,
                interval: 1,
                nextDate: transaction.date,
                isActive: false,
                currentOccurrence: 0,
              };
              
              return (
                <div key={transaction.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: `${category?.color}20` }}
                      >
                        <IconComponent 
                          className="h-5 w-5" 
                          style={{ color: category?.color || '#6B7280' }}
                        />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                            {transaction.description}
                          </h4>
                          {pattern?.calculationType === 'percentage' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              <Percent className="h-3 w-3" />
                              <span>{pattern.percentage}% de {linkedTx ? linkedTx.description : 'transaction liée'}</span>
                            </span>
                          )}
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            pattern?.isActive 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : pattern
                                ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
                          }`}>
                            {pattern ? (pattern.isActive ? 'Actif' : 'Suspendu') : 'A configurer'}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <span>{category?.name}</span>
                          <span>•</span>
                          <span>{account?.name}</span>
                          <span>•</span>
                          <span>{getFrequencyLabel(displayPattern.frequency, displayPattern.interval)}</span>
                          <span>•</span>
                          <span>Prochaine: {format(displayPattern.nextDate, 'dd MMM yyyy', { locale: fr })}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <span className={`text-sm font-semibold ${
                          displayImpact >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {displayImpact >= 0 ? '+' : '-'}{Math.abs(displayImpact).toFixed(2)} €
                        </span>
                        {pattern?.calculationType === 'percentage' && (
                          <span className="block text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                            {pattern.percentage}% indexé
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => pattern ? toggleRecurringStatus(transaction) : editRecurring(transaction)}
                          className={`p-1 rounded ${
                            pattern?.isActive
                              ? 'text-orange-600 hover:text-orange-700 dark:text-orange-400'
                              : 'text-green-600 hover:text-green-700 dark:text-green-400'
                          }`}
                          title={pattern ? (pattern.isActive ? 'Suspendre' : 'Activer') : 'Configurer'}
                        >
                          {pattern?.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>
                        
                        <button
                          onClick={() => editRecurring(transaction)}
                          className="p-1 text-blue-600 hover:text-blue-700 dark:text-blue-400"
                          title="Modifier"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        
                        <button
                          onClick={() => {
                            if (confirm('Êtes-vous sûr de vouloir supprimer cette transaction récurrente ?')) {
                              deleteTransaction(transaction.id);
                            }
                          }}
                          className="p-1 text-red-600 hover:text-red-700 dark:text-red-400"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <p className="text-lg mb-2">Aucune transaction récurrente</p>
            <p className="text-sm">Créez des transactions automatiques pour vos revenus et dépenses réguliers</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecurringTransactions;
