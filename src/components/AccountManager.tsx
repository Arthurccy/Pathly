import React, { useState } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  CreditCard, 
  PiggyBank, 
  TrendingUp, 
  Wallet,
  Building,
  Bitcoin,
  DollarSign,
  Eye,
  EyeOff,
  RefreshCw,
  History,
  Calendar
} from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';
import { BankAccount } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const AccountManager: React.FC = () => {
  const { accounts, addAccount, updateAccount, deleteAccount, addTransaction } = useBudget();
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [showBalanceModal, setShowBalanceModal] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'checking' as BankAccount['type'],
    balance: '',
    currency: 'EUR',
    color: '#3B82F6',
    bankName: '',
    description: '',
  });

  const [balanceUpdateData, setBalanceUpdateData] = useState({
    newBalance: '',
    comment: '',
    date: new Date().toISOString().split('T')[0],
    updateType: 'manual' as 'manual' | 'transaction'
  });

  const accountTypes = [
    { value: 'checking', label: 'Compte courant', icon: CreditCard, color: '#3B82F6' },
    { value: 'savings', label: 'Épargne', icon: PiggyBank, color: '#10B981' },
    { value: 'investment', label: 'Investissement', icon: TrendingUp, color: '#8B5CF6' },
    { value: 'crypto', label: 'Cryptomonnaies', icon: Bitcoin, color: '#F59E0B' },
    { value: 'cash', label: 'Espèces', icon: Wallet, color: '#6B7280' },
    { value: 'credit', label: 'Crédit', icon: Building, color: '#EF4444' },
  ];

  const currencies = [
    { value: 'EUR', label: 'Euro (€)', symbol: '€' },
    { value: 'USD', label: 'Dollar US ($)', symbol: '$' },
    { value: 'GBP', label: 'Livre Sterling (£)', symbol: '£' },
    { value: 'CHF', label: 'Franc Suisse', symbol: 'CHF' },
    { value: 'BTC', label: 'Bitcoin', symbol: '₿' },
    { value: 'ETH', label: 'Ethereum', symbol: 'Ξ' },
    { value: 'ADA', label: 'Cardano', symbol: 'ADA' },
    { value: 'DOT', label: 'Polkadot', symbol: 'DOT' },
  ];

  const colorOptions = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899',
    '#6366F1', '#14B8A6', '#F97316', '#84CC16', '#06B6D4', '#A855F7',
    '#DC2626', '#059669', '#D97706', '#7C3AED', '#BE185D', '#4F46E5'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.balance) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const accountData = {
      name: formData.name,
      type: formData.type,
      balance: parseFloat(formData.balance),
      currency: formData.currency,
      color: formData.color,
      bankName: formData.bankName || undefined,
      description: formData.description || undefined,
      isActive: true,
      order: editingAccount ? editingAccount.order : accounts.length,
    };

    if (editingAccount) {
      updateAccount(editingAccount.id, accountData);
    } else {
      addAccount(accountData);
    }

    resetForm();
  };

  const handleBalanceUpdate = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (!account || !balanceUpdateData.newBalance) {
      alert('Veuillez saisir un nouveau solde');
      return;
    }

    const newBalance = parseFloat(balanceUpdateData.newBalance);
    const currentBalance = account.balance;
    const difference = newBalance - currentBalance;

    if (balanceUpdateData.updateType === 'transaction' && difference !== 0) {
      // Créer une transaction pour tracer le changement
      const transactionType = difference > 0 ? 'income' : 'expense';
      const transactionAmount = Math.abs(difference);
      
      addTransaction({
        accountId,
        amount: transactionAmount,
        description: balanceUpdateData.comment || `Ajustement manuel du solde (${difference > 0 ? '+' : '-'}${transactionAmount.toFixed(2)} ${account.currency})`,
        date: new Date(balanceUpdateData.date),
        categoryId: difference > 0 ? 'cat-income-4' : 'cat-expense-10', // Autres revenus / Autres dépenses
        type: transactionType,
        status: 'completed',
        isRecurring: false,
        memo: `Mise à jour manuelle du solde de ${currentBalance.toFixed(2)} vers ${newBalance.toFixed(2)} ${account.currency}`
      });
    } else {
      // Mise à jour directe du solde sans transaction
      updateAccount(accountId, { balance: newBalance });
    }

    setShowBalanceModal(null);
    setBalanceUpdateData({
      newBalance: '',
      comment: '',
      date: new Date().toISOString().split('T')[0],
      updateType: 'manual'
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'checking',
      balance: '',
      currency: 'EUR',
      color: '#3B82F6',
      bankName: '',
      description: '',
    });
    setShowForm(false);
    setEditingAccount(null);
  };

  const editAccount = (account: BankAccount) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      type: account.type,
      balance: account.balance.toString(),
      currency: account.currency,
      color: account.color,
      bankName: account.bankName || '',
      description: account.description || '',
    });
    setShowForm(true);
  };

  const openBalanceModal = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    if (account) {
      setBalanceUpdateData({
        newBalance: account.balance.toString(),
        comment: '',
        date: new Date().toISOString().split('T')[0],
        updateType: 'transaction'
      });
      setShowBalanceModal(accountId);
    }
  };

  const toggleAccountStatus = (account: BankAccount) => {
    updateAccount(account.id, { isActive: !account.isActive });
  };

  const getAccountIcon = (type: string) => {
    const accountType = accountTypes.find(t => t.value === type);
    return accountType?.icon || CreditCard;
  };

  const getAccountTypeLabel = (type: string) => {
    const accountType = accountTypes.find(t => t.value === type);
    return accountType?.label || type;
  };

  const totalBalance = accounts
    .filter(a => a.isActive && a.type !== 'credit')
    .reduce((sum, account) => {
      if (account.currency === 'EUR') return sum + account.balance;
      // For other currencies, we'd need conversion rates
      return sum;
    }, 0);

  const totalDebt = accounts
    .filter(a => a.isActive && a.type === 'credit')
    .reduce((sum, account) => sum + Math.abs(account.balance), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
            <CreditCard className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Gestion des comptes
          </h1>
        </div>
        
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>Nouveau compte</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Patrimoine total
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {totalBalance.toFixed(2)} €
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <Building className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Dettes totales
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {totalDebt.toFixed(2)} €
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Patrimoine net
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {(totalBalance - totalDebt).toFixed(2)} €
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {editingAccount ? 'Modifier' : 'Créer'} un compte
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nom du compte *
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Ex: Compte Courant BNP, PEA Boursorama, Wallet Bitcoin"
                  required
                />
              </div>

              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Type de compte *
                </label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as BankAccount['type'] })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  required
                >
                  {accountTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="balance" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Solde initial *
                </label>
                <input
                  type="number"
                  id="balance"
                  step="0.01"
                  value={formData.balance}
                  onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label htmlFor="currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Devise
                </label>
                <select
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  {currencies.map(currency => (
                    <option key={currency.value} value={currency.value}>
                      {currency.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="bankName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Banque / Institution
                </label>
                <input
                  type="text"
                  id="bankName"
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Ex: BNP Paribas, Binance, Boursorama"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Description optionnelle"
                />
              </div>
            </div>

            {/* Color Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Couleur
              </label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      formData.color === color
                        ? 'border-gray-400 scale-110'
                        : 'border-gray-200 dark:border-gray-600 hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
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
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                {editingAccount ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Accounts List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Mes comptes ({accounts.length}/20)
          </h3>
        </div>

        {accounts.length > 0 ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {accounts
              .sort((a, b) => a.order - b.order)
              .map((account) => {
                const Icon = getAccountIcon(account.type);
                const currency = currencies.find(c => c.value === account.currency);
                
                return (
                  <div key={account.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div
                          className="p-2 rounded-lg"
                          style={{ backgroundColor: `${account.color}20` }}
                        >
                          <Icon 
                            className="h-5 w-5" 
                            style={{ color: account.color }}
                          />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                              {account.name}
                            </h4>
                            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                              {getAccountTypeLabel(account.type)}
                            </span>
                            {!account.isActive && (
                              <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                                Désactivé
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {account.bankName && <span>{account.bankName}</span>}
                            <span>{currency?.label || account.currency}</span>
                            {account.description && <span>{account.description}</span>}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <p className={`text-lg font-semibold ${
                            account.balance >= 0 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {account.balance.toFixed(2)} {currency?.symbol || account.currency}
                          </p>
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => openBalanceModal(account.id)}
                            className="p-1 text-purple-600 hover:text-purple-700 dark:text-purple-400"
                            title="Modifier le solde"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => toggleAccountStatus(account)}
                            className={`p-1 rounded ${
                              account.isActive
                                ? 'text-green-600 hover:text-green-700 dark:text-green-400'
                                : 'text-gray-400 hover:text-gray-600 dark:text-gray-500'
                            }`}
                            title={account.isActive ? 'Désactiver' : 'Activer'}
                          >
                            {account.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </button>
                          
                          <button
                            onClick={() => editAccount(account)}
                            className="p-1 text-blue-600 hover:text-blue-700 dark:text-blue-400"
                            title="Modifier"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => {
                              if (confirm('Êtes-vous sûr de vouloir supprimer ce compte ?')) {
                                deleteAccount(account.id);
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
            <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <p className="text-lg mb-2">Aucun compte enregistré</p>
            <p className="text-sm">Créez votre premier compte pour commencer</p>
          </div>
        )}
      </div>

      {/* Balance Update Modal */}
      {showBalanceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <RefreshCw className="h-5 w-5 mr-2" />
                  Modifier le solde
                </h3>
                <button
                  onClick={() => setShowBalanceModal(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nouveau solde *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={balanceUpdateData.newBalance}
                  onChange={(e) => setBalanceUpdateData({ ...balanceUpdateData, newBalance: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date d'effet
                </label>
                <input
                  type="date"
                  value={balanceUpdateData.date}
                  onChange={(e) => setBalanceUpdateData({ ...balanceUpdateData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Commentaire
                </label>
                <input
                  type="text"
                  value={balanceUpdateData.comment}
                  onChange={(e) => setBalanceUpdateData({ ...balanceUpdateData, comment: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Ex: Versement initial PEA, Achat crypto, Correction solde"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Type de mise à jour
                </label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="updateType"
                      value="transaction"
                      checked={balanceUpdateData.updateType === 'transaction'}
                      onChange={(e) => setBalanceUpdateData({ ...balanceUpdateData, updateType: e.target.value as any })}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Créer une transaction
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Recommandé - Garde un historique de la modification
                      </p>
                    </div>
                  </label>
                  
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="updateType"
                      value="manual"
                      checked={balanceUpdateData.updateType === 'manual'}
                      onChange={(e) => setBalanceUpdateData({ ...balanceUpdateData, updateType: e.target.value as any })}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Modification directe
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Change le solde sans créer de transaction
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
              <button
                onClick={() => setShowBalanceModal(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleBalanceUpdate(showBalanceModal)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Mettre à jour
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountManager;