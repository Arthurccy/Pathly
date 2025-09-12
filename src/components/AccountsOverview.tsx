import React from 'react';
import { CreditCard, Wallet, PiggyBank, TrendingUp, Plus } from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';

const AccountsOverview: React.FC = () => {
  const { accounts, selectedAccountIds } = useBudget();

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'checking':
        return CreditCard;
      case 'savings':
        return PiggyBank;
      case 'investment':
        return TrendingUp;
      case 'cash':
        return Wallet;
      default:
        return CreditCard;
    }
  };

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'checking':
        return 'Compte courant';
      case 'savings':
        return 'Épargne';
      case 'investment':
        return 'Investissement';
      case 'cash':
        return 'Espèces';
      case 'credit':
        return 'Crédit';
      default:
        return 'Autre';
    }
  };

  const filteredAccounts = accounts.filter(a => 
    selectedAccountIds.length === 0 || selectedAccountIds.includes(a.id)
  );

  const totalBalance = filteredAccounts.reduce((sum, account) => sum + account.balance, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Aperçu des comptes
          </h3>
          <div className="text-right">
            <p className="text-sm text-gray-500 dark:text-gray-400">Solde total</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {totalBalance.toFixed(2)} €
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {filteredAccounts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAccounts.map((account) => {
              const Icon = getAccountIcon(account.type);
              const percentage = totalBalance > 0 ? (account.balance / totalBalance) * 100 : 0;
              
              return (
                <div
                  key={account.id}
                  className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-gray-300 dark:hover:border-gray-500 transition-colors"
                >
                  <div className="flex items-center space-x-3 mb-3">
                    <div
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: `${account.color}20` }}
                    >
                      <Icon 
                        className="h-5 w-5" 
                        style={{ color: account.color }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {account.name}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {getAccountTypeLabel(account.type)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">
                        {account.balance.toFixed(2)} €
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                    
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${percentage}%`,
                          backgroundColor: account.color
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="mx-auto h-12 w-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center mb-4">
              <Plus className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Aucun compte sélectionné
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Utilisez le filtre des comptes pour afficher les données
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountsOverview;