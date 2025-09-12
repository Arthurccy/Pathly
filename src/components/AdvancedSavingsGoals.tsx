import React, { useState } from 'react';
import { Target, Plus, Edit, Trash2, Calendar, TrendingUp, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { format, differenceInDays, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBudget } from '../contexts/BudgetContext';
import { SavingsGoal } from '../types';

const AdvancedSavingsGoals: React.FC = () => {
  const { savingsGoals, accounts, addSavingsGoal, updateSavingsGoal, deleteSavingsGoal, contributeToGoal } = useBudget();
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [showContributeModal, setShowContributeModal] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    targetAmount: '',
    deadline: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    accountId: '',
    color: '#3B82F6',
    autoContribution: {
      enabled: false,
      amount: '',
      frequency: 'monthly' as 'weekly' | 'monthly',
      accountId: '',
    }
  });

  const [contributionData, setContributionData] = useState({
    amount: '',
    accountId: '',
  });

  const colorOptions = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899',
    '#6366F1', '#14B8A6', '#F97316', '#84CC16', '#06B6D4', '#A855F7'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.targetAmount) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const goalData = {
      title: formData.title,
      description: formData.description || undefined,
      targetAmount: parseFloat(formData.targetAmount),
      deadline: formData.deadline ? new Date(formData.deadline) : undefined,
      priority: formData.priority,
      accountId: formData.accountId || undefined,
      color: formData.color,
      autoContribution: formData.autoContribution.enabled ? {
        amount: parseFloat(formData.autoContribution.amount),
        frequency: formData.autoContribution.frequency,
        accountId: formData.autoContribution.accountId,
      } : undefined,
    };

    if (editingGoal) {
      updateSavingsGoal(editingGoal.id, goalData);
    } else {
      addSavingsGoal(goalData);
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      targetAmount: '',
      deadline: '',
      priority: 'medium',
      accountId: '',
      color: '#3B82F6',
      autoContribution: {
        enabled: false,
        amount: '',
        frequency: 'monthly',
        accountId: '',
      }
    });
    setShowForm(false);
    setEditingGoal(null);
  };

  const editGoal = (goal: SavingsGoal) => {
    setEditingGoal(goal);
    setFormData({
      title: goal.title,
      description: goal.description || '',
      targetAmount: goal.targetAmount.toString(),
      deadline: goal.deadline ? goal.deadline.toISOString().split('T')[0] : '',
      priority: goal.priority,
      accountId: goal.accountId || '',
      color: goal.color || '#3B82F6',
      autoContribution: {
        enabled: !!goal.autoContribution,
        amount: goal.autoContribution?.amount.toString() || '',
        frequency: goal.autoContribution?.frequency || 'monthly',
        accountId: goal.autoContribution?.accountId || '',
      }
    });
    setShowForm(true);
  };

  const handleContribution = (goalId: string) => {
    if (!contributionData.amount || !contributionData.accountId) {
      alert('Veuillez saisir un montant et sélectionner un compte');
      return;
    }

    contributeToGoal(goalId, parseFloat(contributionData.amount), contributionData.accountId);
    setShowContributeModal(null);
    setContributionData({ amount: '', accountId: '' });
  };

  const calculateMonthlyTarget = (goal: SavingsGoal) => {
    if (!goal.deadline) return null;
    
    const remaining = goal.targetAmount - goal.currentAmount;
    const daysLeft = differenceInDays(goal.deadline, new Date());
    const monthsLeft = Math.max(1, Math.ceil(daysLeft / 30));
    
    return remaining / monthsLeft;
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-blue-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20';
      case 'medium': return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/20';
      case 'low': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return 'Haute';
      case 'medium': return 'Moyenne';
      case 'low': return 'Basse';
      default: return 'Non définie';
    }
  };

  const activeGoals = savingsGoals.filter(g => !g.isCompleted);
  const completedGoals = savingsGoals.filter(g => g.isCompleted);
  const totalTargetAmount = activeGoals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalCurrentAmount = activeGoals.reduce((sum, g) => sum + g.currentAmount, 0);
  const overallProgress = totalTargetAmount > 0 ? (totalCurrentAmount / totalTargetAmount) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
            <Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Objectifs d'épargne avancés
          </h1>
        </div>
        
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>Nouvel objectif</span>
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Objectifs actifs</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {activeGoals.length}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Progression globale</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {overallProgress.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Épargné</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {totalCurrentAmount.toFixed(0)} €
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Objectif total</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {totalTargetAmount.toFixed(0)} €
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {editingGoal ? 'Modifier' : 'Créer'} un objectif d'épargne
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Titre de l'objectif *
                </label>
                <input
                  type="text"
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Ex: Vacances d'été"
                  required
                />
              </div>

              <div>
                <label htmlFor="targetAmount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Montant cible * (€)
                </label>
                <input
                  type="number"
                  id="targetAmount"
                  step="0.01"
                  min="0"
                  value={formData.targetAmount}
                  onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date limite
                </label>
                <input
                  type="date"
                  id="deadline"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Priorité
                </label>
                <select
                  id="priority"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="low">Basse</option>
                  <option value="medium">Moyenne</option>
                  <option value="high">Haute</option>
                </select>
              </div>

              <div>
                <label htmlFor="accountId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Compte associé
                </label>
                <select
                  id="accountId"
                  value={formData.accountId}
                  onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Aucun compte spécifique</option>
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  rows={3}
                  placeholder="Description optionnelle de l'objectif"
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

            {/* Auto Contribution */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.autoContribution.enabled}
                  onChange={(e) => setFormData({
                    ...formData,
                    autoContribution: {
                      ...formData.autoContribution,
                      enabled: e.target.checked
                    }
                  })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Contribution automatique
                </span>
              </label>

              {formData.autoContribution.enabled && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Montant (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.autoContribution.amount}
                      onChange={(e) => setFormData({
                        ...formData,
                        autoContribution: {
                          ...formData.autoContribution,
                          amount: e.target.value
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Fréquence
                    </label>
                    <select
                      value={formData.autoContribution.frequency}
                      onChange={(e) => setFormData({
                        ...formData,
                        autoContribution: {
                          ...formData.autoContribution,
                          frequency: e.target.value as any
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    >
                      <option value="weekly">Hebdomadaire</option>
                      <option value="monthly">Mensuelle</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Compte source
                    </label>
                    <select
                      value={formData.autoContribution.accountId}
                      onChange={(e) => setFormData({
                        ...formData,
                        autoContribution: {
                          ...formData.autoContribution,
                          accountId: e.target.value
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Sélectionner un compte</option>
                      {accounts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
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
                {editingGoal ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Goals */}
      {activeGoals.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Objectifs en cours ({activeGoals.length})
            </h3>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {activeGoals
              .sort((a, b) => {
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                return priorityOrder[b.priority] - priorityOrder[a.priority];
              })
              .map((goal) => {
                const percentage = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
                const remaining = goal.targetAmount - goal.currentAmount;
                const monthlyTarget = calculateMonthlyTarget(goal);
                const account = accounts.find(a => a.id === goal.accountId);
                
                return (
                  <div key={goal.id} className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                            {goal.title}
                          </h4>
                          <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(goal.priority)}`}>
                            {getPriorityLabel(goal.priority)}
                          </span>
                          {goal.autoContribution && (
                            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                              Auto
                            </span>
                          )}
                        </div>
                        
                        {goal.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {goal.description}
                          </p>
                        )}
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                          {goal.deadline && (
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-4 w-4" />
                              <span>Échéance: {format(goal.deadline, 'dd MMM yyyy', { locale: fr })}</span>
                            </div>
                          )}
                          {account && (
                            <div className="flex items-center space-x-1">
                              <DollarSign className="h-4 w-4" />
                              <span>{account.name}</span>
                            </div>
                          )}
                          {monthlyTarget && (
                            <div className="flex items-center space-x-1">
                              <TrendingUp className="h-4 w-4" />
                              <span>{monthlyTarget.toFixed(0)} €/mois recommandé</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => setShowContributeModal(goal.id)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                        >
                          Contribuer
                        </button>
                        <button
                          onClick={() => editGoal(goal)}
                          className="p-1 text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Êtes-vous sûr de vouloir supprimer cet objectif ?')) {
                              deleteSavingsGoal(goal.id);
                            }
                          }}
                          className="p-1 text-red-600 hover:text-red-700 dark:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          {goal.currentAmount.toFixed(2)} € / {goal.targetAmount.toFixed(2)} €
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                      
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all duration-300 ${getProgressColor(percentage)}`}
                          style={{ 
                            width: `${Math.min(percentage, 100)}%`,
                            backgroundColor: goal.color 
                          }}
                        />
                      </div>
                      
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Reste: {remaining.toFixed(2)} €</span>
                        {percentage >= 100 && (
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            🎉 Objectif atteint !
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Auto Contribution Info */}
                    {goal.autoContribution && (
                      <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="flex items-center space-x-2 text-sm text-blue-700 dark:text-blue-300">
                          <Clock className="h-4 w-4" />
                          <span>
                            Contribution automatique: {goal.autoContribution.amount} € 
                            {goal.autoContribution.frequency === 'weekly' ? ' par semaine' : ' par mois'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              Objectifs atteints ({completedGoals.length})
            </h3>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedGoals.map((goal) => (
                <div
                  key={goal.id}
                  className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-green-800 dark:text-green-200">
                      {goal.title}
                    </h4>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {goal.targetAmount.toFixed(2)} € atteint
                  </p>
                  <p className="text-xs text-green-500 dark:text-green-400 mt-1">
                    Complété le {format(goal.createdAt, 'dd MMM yyyy', { locale: fr })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* No Goals */}
      {savingsGoals.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
          <Target className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Aucun objectif d'épargne
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Créez votre premier objectif pour commencer à épargner efficacement
          </p>
        </div>
      )}

      {/* Contribution Modal */}
      {showContributeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Contribuer à l'objectif
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Montant (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={contributionData.amount}
                  onChange={(e) => setContributionData({ ...contributionData, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Compte source
                </label>
                <select
                  value={contributionData.accountId}
                  onChange={(e) => setContributionData({ ...contributionData, accountId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Sélectionner un compte</option>
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.balance.toFixed(2)} €)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
              <button
                onClick={() => setShowContributeModal(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleContribution(showContributeModal)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                Contribuer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedSavingsGoals;