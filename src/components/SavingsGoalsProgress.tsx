import React from 'react';
import { Target, Plus, Calendar, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBudget } from '../contexts/BudgetContext';

const SavingsGoalsProgress: React.FC = () => {
  const { savingsGoals } = useBudget();

  const activeGoals = savingsGoals.filter(g => !g.isCompleted);
  const completedGoals = savingsGoals.filter(g => g.isCompleted);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 dark:text-red-400';
      case 'medium':
        return 'text-orange-600 dark:text-orange-400';
      case 'low':
        return 'text-green-600 dark:text-green-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'Haute';
      case 'medium':
        return 'Moyenne';
      case 'low':
        return 'Basse';
      default:
        return 'Non définie';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Objectifs d'épargne
          </h3>
          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
            <span>{activeGoals.length} en cours</span>
            <span>•</span>
            <span>{completedGoals.length} terminés</span>
          </div>
        </div>
      </div>

      <div className="p-6">
        {savingsGoals.length > 0 ? (
          <div className="space-y-4">
            {activeGoals.map((goal) => {
              const percentage = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
              const remaining = goal.targetAmount - goal.currentAmount;
              
              return (
                <div
                  key={goal.id}
                  className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                          {goal.title}
                        </h4>
                        <span className={`text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 ${getPriorityColor(goal.priority)}`}>
                          {getPriorityLabel(goal.priority)}
                        </span>
                      </div>
                      {goal.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                          {goal.description}
                        </p>
                      )}
                      {goal.deadline && (
                        <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                          <Calendar className="h-3 w-3" />
                          <span>Échéance: {format(goal.deadline, 'dd MMM yyyy', { locale: fr })}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {goal.currentAmount.toFixed(2)} €
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        sur {goal.targetAmount.toFixed(2)} €
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{percentage.toFixed(1)}% atteint</span>
                      <span>Reste: {remaining.toFixed(2)} €</span>
                    </div>
                    
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          percentage >= 100 
                            ? 'bg-green-500' 
                            : percentage >= 75 
                              ? 'bg-blue-500' 
                              : percentage >= 50 
                                ? 'bg-yellow-500' 
                                : 'bg-orange-500'
                        }`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {completedGoals.length > 0 && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2 text-green-500" />
                  Objectifs atteints
                </h4>
                <div className="space-y-2">
                  {completedGoals.map((goal) => (
                    <div
                      key={goal.id}
                      className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-green-800 dark:text-green-200">
                          {goal.title}
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400">
                          Objectif atteint
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                          {goal.targetAmount.toFixed(2)} €
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="mx-auto h-12 w-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center mb-4">
              <Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Aucun objectif d'épargne
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Définissez vos premiers objectifs pour suivre votre épargne
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SavingsGoalsProgress;