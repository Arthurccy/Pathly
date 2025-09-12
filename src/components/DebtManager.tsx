import React, { useState } from 'react';
import { CreditCard, Plus, Edit, Trash2, Calendar, TrendingDown, DollarSign } from 'lucide-react';
import { format, addMonths, differenceInMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBudget } from '../contexts/BudgetContext';
import { Debt, DebtPayment } from '../types';

const DebtManager: React.FC = () => {
  const { debts, debtPayments, accounts, addDebt, updateDebt, deleteDebt, addDebtPayment } = useBudget();
  const [showForm, setShowForm] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    totalAmount: '',
    remainingAmount: '',
    interestRate: '',
    minimumPayment: '',
    dueDate: new Date().toISOString().split('T')[0],
    accountId: '',
    type: 'personal' as Debt['type'],
    creditor: '',
    description: '',
    paymentDay: '1',
  });

  const [paymentData, setPaymentData] = useState({
    amount: '',
    principal: '',
    interest: '',
    paymentMethod: '',
  });

  const calculatePayoffTime = (debt: Debt) => {
    if (debt.minimumPayment <= 0 || debt.interestRate <= 0) return null;
    
    const monthlyRate = debt.interestRate / 100 / 12;
    const months = Math.ceil(
      -Math.log(1 - (debt.remainingAmount * monthlyRate) / debt.minimumPayment) / 
      Math.log(1 + monthlyRate)
    );
    
    return months;
  };

  const calculateTotalInterest = (debt: Debt) => {
    const months = calculatePayoffTime(debt);
    if (!months) return 0;
    
    return (debt.minimumPayment * months) - debt.remainingAmount;
  };

  const getDebtTypeLabel = (type: Debt['type']) => {
    const labels = {
      credit_card: 'Carte de crédit',
      loan: 'Prêt personnel',
      mortgage: 'Prêt immobilier',
      personal: 'Dette personnelle',
      student: 'Prêt étudiant',
      auto: 'Prêt auto',
      other: 'Autre'
    };
    return labels[type];
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.totalAmount || !formData.remainingAmount || !formData.accountId) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const debtData = {
      name: formData.name,
      totalAmount: parseFloat(formData.totalAmount),
      remainingAmount: parseFloat(formData.remainingAmount),
      interestRate: parseFloat(formData.interestRate) || 0,
      minimumPayment: parseFloat(formData.minimumPayment) || 0,
      dueDate: new Date(formData.dueDate),
      accountId: formData.accountId,
      type: formData.type,
      creditor: formData.creditor || undefined,
      description: formData.description || undefined,
      paymentDay: parseInt(formData.paymentDay),
      isActive: true,
    };

    if (editingDebt) {
      updateDebt(editingDebt.id, debtData);
    } else {
      addDebt(debtData);
    }

    resetForm();
  };

  const handlePayment = (debtId: string) => {
    if (!paymentData.amount) {
      alert('Veuillez saisir le montant du paiement');
      return;
    }

    const amount = parseFloat(paymentData.amount);
    const principal = parseFloat(paymentData.principal) || amount;
    const interest = parseFloat(paymentData.interest) || 0;

    const payment: Omit<DebtPayment, 'id'> = {
      debtId,
      amount,
      principal,
      interest,
      date: new Date(),
      paymentMethod: paymentData.paymentMethod || undefined,
    };

    addDebtPayment(payment);
    setShowPaymentForm(null);
    setPaymentData({
      amount: '',
      principal: '',
      interest: '',
      paymentMethod: '',
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      totalAmount: '',
      remainingAmount: '',
      interestRate: '',
      minimumPayment: '',
      dueDate: new Date().toISOString().split('T')[0],
      accountId: '',
      type: 'personal',
      creditor: '',
      description: '',
      paymentDay: '1',
    });
    setShowForm(false);
    setEditingDebt(null);
  };

  const editDebt = (debt: Debt) => {
    setEditingDebt(debt);
    setFormData({
      name: debt.name,
      totalAmount: debt.totalAmount.toString(),
      remainingAmount: debt.remainingAmount.toString(),
      interestRate: debt.interestRate.toString(),
      minimumPayment: debt.minimumPayment.toString(),
      dueDate: debt.dueDate.toISOString().split('T')[0],
      accountId: debt.accountId,
      type: debt.type,
      creditor: debt.creditor || '',
      description: debt.description || '',
      paymentDay: debt.paymentDay?.toString() || '1',
    });
    setShowForm(true);
  };

  const totalDebt = debts.reduce((sum, debt) => sum + debt.remainingAmount, 0);
  const totalMonthlyPayments = debts.reduce((sum, debt) => sum + debt.minimumPayment, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
            <CreditCard className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Gestion des dettes et crédits
          </h1>
        </div>
        
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>Nouvelle dette</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Dette totale
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {totalDebt.toFixed(2)} €
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <Calendar className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Paiements mensuels
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {totalMonthlyPayments.toFixed(2)} €
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
                Nombre de dettes
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {debts.filter(d => d.isActive).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {editingDebt ? 'Modifier' : 'Ajouter'} une dette
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nom de la dette *
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Ex: Prêt auto"
                  required
                />
              </div>

              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Type de dette *
                </label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as Debt['type'] })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  required
                >
                  <option value="personal">Dette personnelle</option>
                  <option value="credit_card">Carte de crédit</option>
                  <option value="loan">Prêt personnel</option>
                  <option value="mortgage">Prêt immobilier</option>
                  <option value="student">Prêt étudiant</option>
                  <option value="auto">Prêt auto</option>
                  <option value="other">Autre</option>
                </select>
              </div>

              <div>
                <label htmlFor="totalAmount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Montant total *
                </label>
                <input
                  type="number"
                  id="totalAmount"
                  step="0.01"
                  min="0"
                  value={formData.totalAmount}
                  onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="remainingAmount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Montant restant *
                </label>
                <input
                  type="number"
                  id="remainingAmount"
                  step="0.01"
                  min="0"
                  value={formData.remainingAmount}
                  onChange={(e) => setFormData({ ...formData, remainingAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="interestRate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Taux d'intérêt annuel (%)
                </label>
                <input
                  type="number"
                  id="interestRate"
                  step="0.01"
                  min="0"
                  value={formData.interestRate}
                  onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="minimumPayment" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Paiement minimum mensuel
                </label>
                <input
                  type="number"
                  id="minimumPayment"
                  step="0.01"
                  min="0"
                  value={formData.minimumPayment}
                  onChange={(e) => setFormData({ ...formData, minimumPayment: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="accountId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Compte de paiement *
                </label>
                <select
                  id="accountId"
                  value={formData.accountId}
                  onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
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

              <div>
                <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Prochaine échéance
                </label>
                <input
                  type="date"
                  id="dueDate"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="creditor" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Créancier
                </label>
                <input
                  type="text"
                  id="creditor"
                  value={formData.creditor}
                  onChange={(e) => setFormData({ ...formData, creditor: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Ex: Banque XYZ"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  rows={3}
                  placeholder="Description optionnelle"
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
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                {editingDebt ? 'Modifier' : 'Ajouter'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Debts List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Mes dettes ({debts.filter(d => d.isActive).length})
          </h3>
        </div>

        {debts.filter(d => d.isActive).length > 0 ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {debts.filter(d => d.isActive).map((debt) => {
              const account = accounts.find(a => a.id === debt.accountId);
              const payoffMonths = calculatePayoffTime(debt);
              const totalInterest = calculateTotalInterest(debt);
              const progress = ((debt.totalAmount - debt.remainingAmount) / debt.totalAmount) * 100;
              
              return (
                <div key={debt.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                          {debt.name}
                        </h4>
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                          {getDebtTypeLabel(debt.type)}
                        </span>
                      </div>
                      
                      {debt.creditor && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                          Créancier: {debt.creditor}
                        </p>
                      )}
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Restant</p>
                          <p className="font-semibold text-red-600 dark:text-red-400">
                            {debt.remainingAmount.toFixed(2)} €
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Paiement mensuel</p>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {debt.minimumPayment.toFixed(2)} €
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Taux</p>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {debt.interestRate.toFixed(2)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Prochaine échéance</p>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {format(debt.dueDate, 'dd/MM/yyyy')}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => setShowPaymentForm(debt.id)}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                      >
                        Paiement
                      </button>
                      <button
                        onClick={() => editDebt(debt)}
                        className="p-1 text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Êtes-vous sûr de vouloir supprimer cette dette ?')) {
                            deleteDebt(debt.id);
                          }
                        }}
                        className="p-1 text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-1">
                      <span>Progression du remboursement</span>
                      <span>{progress.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Payoff Information */}
                  {payoffMonths && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Temps de remboursement</p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {Math.floor(payoffMonths / 12)} ans {payoffMonths % 12} mois
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Intérêts totaux</p>
                        <p className="font-semibold text-orange-600 dark:text-orange-400">
                          {totalInterest.toFixed(2)} €
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Coût total</p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {(debt.remainingAmount + totalInterest).toFixed(2)} €
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Payment Form */}
                  {showPaymentForm === debt.id && (
                    <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <h5 className="font-medium text-gray-900 dark:text-white mb-3">
                        Enregistrer un paiement
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Montant total
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={paymentData.amount}
                            onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Capital
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={paymentData.principal}
                            onChange={(e) => setPaymentData({ ...paymentData, principal: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Intérêts
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={paymentData.interest}
                            onChange={(e) => setPaymentData({ ...paymentData, interest: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end space-x-2 mt-3">
                        <button
                          onClick={() => setShowPaymentForm(null)}
                          className="px-3 py-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={() => handlePayment(debt.id)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                        >
                          Enregistrer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <p className="text-lg mb-2">Aucune dette enregistrée</p>
            <p className="text-sm">Ajoutez vos dettes pour suivre vos remboursements</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebtManager;