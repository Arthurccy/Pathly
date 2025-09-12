import React, { useState } from 'react';
import { Calendar, Clock, Repeat, Plus, Edit, Trash2, Play, Pause } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { format, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBudget } from '../contexts/BudgetContext';
import { Transaction, RecurringPattern } from '../types';

const RecurringTransactions: React.FC = () => {
  const { transactions, categories, accounts, addTransaction, updateTransaction, deleteTransaction } = useBudget();
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    categoryId: '',
    accountId: '',
    type: 'expense' as 'expense' | 'income',
    frequency: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'yearly',
    interval: 1,
    nextDate: new Date().toISOString().split('T')[0],
    endDate: '',
    maxOccurrences: '',
  });

  const recurringTransactions = transactions.filter(t => t.isRecurring && t.recurringPattern);

  const getFrequencyLabel = (frequency: string, interval: number) => {
    const labels = {
      daily: interval === 1 ? 'Quotidien' : `Tous les ${interval} jours`,
      weekly: interval === 1 ? 'Hebdomadaire' : `Toutes les ${interval} semaines`,
      monthly: interval === 1 ? 'Mensuel' : `Tous les ${interval} mois`,
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
      case 'yearly':
        return addYears(next, interval);
      default:
        return next;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.amount || !formData.description || !formData.categoryId || !formData.accountId) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const recurringPattern: RecurringPattern = {
      frequency: formData.frequency,
      interval: formData.interval,
      nextDate: new Date(formData.nextDate),
      endDate: formData.endDate ? new Date(formData.endDate) : undefined,
      maxOccurrences: formData.maxOccurrences ? parseInt(formData.maxOccurrences) : undefined,
      currentOccurrence: 0,
      isActive: true,
    };

    const transactionData = {
      amount: parseFloat(formData.amount),
      description: formData.description,
      categoryId: formData.categoryId,
      accountId: formData.accountId,
      type: formData.type,
      date: new Date(formData.nextDate),
      status: 'scheduled' as const,
      isRecurring: true,
      recurringPattern,
    };

    if (editingTransaction) {
      updateTransaction(editingTransaction.id, transactionData);
    } else {
      addTransaction(transactionData);
    }

    // Reset form
    setFormData({
      amount: '',
      description: '',
      categoryId: '',
      accountId: '',
      type: 'expense',
      frequency: 'monthly',
      interval: 1,
      nextDate: new Date().toISOString().split('T')[0],
      endDate: '',
      maxOccurrences: '',
    });
    setShowForm(false);
    setEditingTransaction(null);
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
      description: transaction.description,
      categoryId: transaction.categoryId,
      accountId: transaction.accountId,
      type: transaction.type as 'expense' | 'income',
      frequency: transaction.recurringPattern?.frequency || 'monthly',
      interval: transaction.recurringPattern?.interval || 1,
      nextDate: transaction.recurringPattern?.nextDate.toISOString().split('T')[0] || '',
      endDate: transaction.recurringPattern?.endDate?.toISOString().split('T')[0] || '',
      maxOccurrences: transaction.recurringPattern?.maxOccurrences?.toString() || '',
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
                <div className="grid grid-cols-2 gap-2">
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
                </div>
              </div>

              {/* Amount */}
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  required
                />
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
                  placeholder="Ex: Loyer mensuel"
                  required
                />
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

              {/* Category */}
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
                onClick={() => {
                  setShowForm(false);
                  setEditingTransaction(null);
                  setFormData({
                    amount: '',
                    description: '',
                    categoryId: '',
                    accountId: '',
                    type: 'expense',
                    frequency: 'monthly',
                    interval: 1,
                    nextDate: new Date().toISOString().split('T')[0],
                    endDate: '',
                    maxOccurrences: '',
                  });
                }}
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
              const pattern = transaction.recurringPattern!;
              
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
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                            {transaction.description}
                          </h4>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            pattern.isActive 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {pattern.isActive ? 'Actif' : 'Suspendu'}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                          <span>{category?.name}</span>
                          <span>•</span>
                          <span>{account?.name}</span>
                          <span>•</span>
                          <span>{getFrequencyLabel(pattern.frequency, pattern.interval)}</span>
                          <span>•</span>
                          <span>Prochaine: {format(pattern.nextDate, 'dd MMM yyyy', { locale: fr })}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <span className={`text-sm font-semibold ${
                        transaction.type === 'income'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}{transaction.amount.toFixed(2)} €
                      </span>
                      
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => toggleRecurringStatus(transaction)}
                          className={`p-1 rounded ${
                            pattern.isActive
                              ? 'text-orange-600 hover:text-orange-700 dark:text-orange-400'
                              : 'text-green-600 hover:text-green-700 dark:text-green-400'
                          }`}
                          title={pattern.isActive ? 'Suspendre' : 'Activer'}
                        >
                          {pattern.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
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