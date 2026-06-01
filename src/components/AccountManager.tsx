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
  Calendar,
  ArrowRightLeft,
  Utensils
} from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';
import { BankAccount, Transaction } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const AccountManager: React.FC = () => {
  const { accounts, categories, transactions, addAccount, updateAccount, deleteAccount, addTransaction, transferBetweenAccounts } = useBudget();
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [showBalanceModal, setShowBalanceModal] = useState<string | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [historyAccountId, setHistoryAccountId] = useState<string | null>(null);
  const [bankBalanceInput, setBankBalanceInput] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  
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

  const [transferData, setTransferData] = useState({
    fromAccountId: '',
    toAccountId: '',
    amount: '',
    description: '',
  });

  const accountTypes = [
    { value: 'checking', label: 'Compte courant', icon: CreditCard, color: '#3B82F6' },
    { value: 'savings', label: 'Épargne', icon: PiggyBank, color: '#10B981' },
    { value: 'investment', label: 'Investissement', icon: TrendingUp, color: '#8B5CF6' },
    { value: 'meal_voucher', label: 'Tickets restaurant', icon: Utensils, color: '#F97316' },
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

  const openTransferModal = (fromAccountId?: string) => {
    const activeAccounts = accounts.filter(account => account.isActive);
    const sourceAccountId = fromAccountId || activeAccounts[0]?.id || '';
    const destinationAccountId = activeAccounts.find(account => account.id !== sourceAccountId)?.id || '';

    setTransferData({
      fromAccountId: sourceAccountId,
      toAccountId: destinationAccountId,
      amount: '',
      description: '',
    });
    setShowTransferModal(true);
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(transferData.amount);
    const fromAccount = accounts.find(account => account.id === transferData.fromAccountId);
    const toAccount = accounts.find(account => account.id === transferData.toAccountId);

    if (!fromAccount || !toAccount) {
      alert('Veuillez sélectionner deux comptes valides');
      return;
    }

    if (fromAccount.id === toAccount.id) {
      alert('Le compte de départ et le compte de destination doivent être différents');
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Veuillez saisir un montant positif');
      return;
    }

    if (fromAccount.currency !== toAccount.currency) {
      alert('Les transferts entre devises différentes ne sont pas encore pris en charge');
      return;
    }

    try {
      setIsTransferring(true);
      await transferBetweenAccounts(
        fromAccount.id,
        toAccount.id,
        amount,
        transferData.description.trim() || 'Transfert entre comptes'
      );
      setShowTransferModal(false);
      setTransferData({
        fromAccountId: '',
        toAccountId: '',
        amount: '',
        description: '',
      });
    } catch (error) {
      console.error('Error transferring money:', error);
      alert("Impossible d'effectuer le transfert. Veuillez réessayer.");
    } finally {
      setIsTransferring(false);
    }
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

  const getTransactionImpact = (transaction: Transaction) => {
    if (transaction.type === 'transfer') {
      return transaction.description.toLowerCase().includes('depuis')
        ? transaction.amount
        : -transaction.amount;
    }

    if (transaction.type === 'income' || transaction.type === 'refund' || transaction.type === 'savings_withdrawal') {
      return transaction.amount;
    }

    if (transaction.type === 'expense' || transaction.type === 'bill' || transaction.type === 'savings') {
      return -transaction.amount;
    }

    return 0;
  };

  const selectedHistoryAccount = historyAccountId
    ? accounts.find(account => account.id === historyAccountId)
    : null;
  const selectedHistoryTransactions = selectedHistoryAccount
    ? transactions
        .filter(transaction => transaction.accountId === selectedHistoryAccount.id)
        .sort((a, b) => b.date.getTime() - a.date.getTime())
    : [];
  const completedHistoryImpact = selectedHistoryTransactions
    .filter(transaction => transaction.status === 'completed')
    .reduce((sum, transaction) => sum + getTransactionImpact(transaction), 0);
  const reconstructedOpeningBalance = selectedHistoryAccount
    ? selectedHistoryAccount.balance - completedHistoryImpact
    : 0;
  const bankBalance = bankBalanceInput ? parseFloat(bankBalanceInput) : NaN;
  const bankGap = selectedHistoryAccount && Number.isFinite(bankBalance)
    ? bankBalance - selectedHistoryAccount.balance
    : null;
  const expectedOpeningBalance = selectedHistoryAccount && Number.isFinite(bankBalance)
    ? bankBalance - completedHistoryImpact
    : null;

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
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => openTransferModal()}
            disabled={accounts.filter(account => account.isActive).length < 2}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
          >
            <ArrowRightLeft className="h-5 w-5" />
            <span>Transférer</span>
          </button>

          <button
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Nouveau compte</span>
          </button>
        </div>
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
                            onClick={() => {
                              setHistoryAccountId(account.id);
                              setBankBalanceInput('');
                            }}
                            className="p-1 text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white"
                            title="Voir l'historique du compte"
                          >
                            <History className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => openTransferModal(account.id)}
                            disabled={accounts.filter(item => item.isActive).length < 2 || !account.isActive}
                            className="p-1 text-emerald-600 hover:text-emerald-700 disabled:text-gray-300 disabled:cursor-not-allowed dark:text-emerald-400"
                            title="Transférer depuis ce compte"
                          >
                            <ArrowRightLeft className="h-4 w-4" />
                          </button>

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

      {/* Account History Modal */}
      {selectedHistoryAccount && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92dvh] w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-gray-900 sm:max-w-4xl sm:rounded-3xl">
            <div className="border-b border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Historique du compte</p>
                  <h3 className="truncate text-xl font-semibold text-gray-950 dark:text-white">
                    {selectedHistoryAccount.name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {selectedHistoryAccount.bankName || getAccountTypeLabel(selectedHistoryAccount.type)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryAccountId(null)}
                  className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                  aria-label="Fermer"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="max-h-[calc(92dvh-5rem)] overflow-y-auto p-5 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Solde Pathly</p>
                  <p className={`mt-1 text-2xl font-semibold ${selectedHistoryAccount.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {selectedHistoryAccount.balance.toFixed(2)} {selectedHistoryAccount.currency}
                  </p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Mouvements terminés</p>
                  <p className={`mt-1 text-2xl font-semibold ${completedHistoryImpact >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {completedHistoryImpact >= 0 ? '+' : ''}{completedHistoryImpact.toFixed(2)} {selectedHistoryAccount.currency}
                  </p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Solde avant historique</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-950 dark:text-white">
                    {reconstructedOpeningBalance.toFixed(2)} {selectedHistoryAccount.currency}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/60 dark:bg-blue-950/30">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div>
                    <label className="block text-sm font-medium text-blue-950 dark:text-blue-100">
                      Solde réel affiché par ta banque
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={bankBalanceInput}
                      onChange={(event) => setBankBalanceInput(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-gray-950 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-blue-900 dark:bg-gray-900 dark:text-white"
                      placeholder={`Ex: ${selectedHistoryAccount.balance.toFixed(2)}`}
                    />
                  </div>
                  {bankGap !== null && (
                    <div className="grid gap-2 rounded-xl bg-white px-4 py-3 text-sm shadow-sm dark:bg-gray-900">
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Écart à retrouver</p>
                        <p className={`text-lg font-semibold ${bankGap >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {bankGap >= 0 ? '+' : ''}{bankGap.toFixed(2)} {selectedHistoryAccount.currency}
                        </p>
                      </div>
                      {expectedOpeningBalance !== null && (
                        <div className="border-t border-gray-100 pt-2 dark:border-gray-800">
                          <p className="text-gray-500 dark:text-gray-400">Solde avant historique attendu</p>
                          <p className="font-semibold text-gray-950 dark:text-white">
                            {expectedOpeningBalance.toFixed(2)} {selectedHistoryAccount.currency}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <p className="mt-3 text-sm text-blue-900 dark:text-blue-200">
                  Si l'écart correspond à une opération absente, ajoute-la. Si c'est juste une correction de départ, utilise "Modifier le solde" avec création d'une transaction d'ajustement.
                </p>
              </div>

              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="font-semibold text-gray-950 dark:text-white">
                    Mouvements ({selectedHistoryTransactions.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => openBalanceModal(selectedHistoryAccount.id)}
                    className="rounded-full bg-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-700"
                  >
                    Ajuster le solde
                  </button>
                </div>

                {selectedHistoryTransactions.length > 0 ? (
                  <div className="space-y-3">
                    {selectedHistoryTransactions.map(transaction => {
                      const category = categories.find(item => item.id === transaction.categoryId);
                      const impact = getTransactionImpact(transaction);
                      return (
                        <div key={transaction.id} className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-gray-950 dark:text-white">
                                {transaction.description}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {format(transaction.date, 'dd MMM yyyy', { locale: fr })}
                                </span>
                                {category && <span>{category.name}</span>}
                                <span className={`rounded-full px-2 py-0.5 ${
                                  transaction.status === 'completed'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                    : transaction.status === 'scheduled'
                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                }`}>
                                  {transaction.status === 'completed' ? 'Terminé' : transaction.status === 'scheduled' ? 'À venir' : transaction.status}
                                </span>
                              </div>
                            </div>
                            <p className={`whitespace-nowrap text-sm font-semibold ${
                              impact >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                            }`}>
                              {impact >= 0 ? '+' : ''}{impact.toFixed(2)} {selectedHistoryAccount.currency}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    Aucun mouvement lié à ce compte.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4">
            <form onSubmit={handleTransfer}>
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                    <ArrowRightLeft className="h-5 w-5 mr-2" />
                    Transférer entre comptes
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowTransferModal(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Compte de départ *
                  </label>
                  <select
                    value={transferData.fromAccountId}
                    onChange={(e) => {
                      const nextFromId = e.target.value;
                      const nextToId = transferData.toAccountId === nextFromId
                        ? accounts.find(account => account.isActive && account.id !== nextFromId)?.id || ''
                        : transferData.toAccountId;

                      setTransferData({ ...transferData, fromAccountId: nextFromId, toAccountId: nextToId });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    required
                  >
                    {accounts.filter(account => account.isActive).map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name} - {account.balance.toFixed(2)} {account.currency}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Compte de destination *
                  </label>
                  <select
                    value={transferData.toAccountId}
                    onChange={(e) => setTransferData({ ...transferData, toAccountId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    required
                  >
                    {accounts
                      .filter(account => account.isActive && account.id !== transferData.fromAccountId)
                      .map(account => (
                        <option key={account.id} value={account.id}>
                          {account.name} - {account.balance.toFixed(2)} {account.currency}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Montant *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={transferData.amount}
                    onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={transferData.description}
                    onChange={(e) => setTransferData({ ...transferData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Ex: Mise de côté, remboursement, virement interne"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isTransferring}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {isTransferring ? 'Transfert...' : 'Transférer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountManager;
