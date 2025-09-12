import React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as LucideIcons from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';

const RecentTransactions: React.FC = () => {
  const { transactions, categories } = useBudget();
  
  const recentTransactions = transactions
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 10);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Dernières transactions
        </h3>
      </div>
      
      {recentTransactions.length > 0 ? (
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {recentTransactions.map((transaction) => {
            const category = categories.find(c => c.id === transaction.categoryId);
            const IconComponent = category ? (LucideIcons as any)[category.icon] : LucideIcons.DollarSign;
            
            return (
              <div key={transaction.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
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
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {transaction.description}
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {category?.name || 'Sans catégorie'}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {format(transaction.date, 'dd MMM yyyy', { locale: fr })}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${
                      transaction.type === 'income'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}{transaction.amount.toFixed(2)} €
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          <p className="text-lg mb-2">Aucune transaction</p>
          <p className="text-sm">Commencez par ajouter votre première transaction</p>
        </div>
      )}
    </div>
  );
};

export default RecentTransactions;