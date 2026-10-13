import React from 'react';
import { CreditCard, Wallet, PiggyBank, TrendingUp, Plus, Utensils } from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';

const AccountsOverview: React.FC = () => {
  const { accounts, selectedAccountIds } = useBudget();

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'checking': return CreditCard;
      case 'savings': return PiggyBank;
      case 'investment': return TrendingUp;
      case 'meal_voucher': return Utensils;
      case 'cash': return Wallet;
      default: return CreditCard;
    }
  };

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'checking': return 'Compte courant';
      case 'savings': return 'Épargne';
      case 'investment': return 'Investissement';
      case 'meal_voucher': return 'Tickets restaurant';
      case 'cash': return 'Espèces';
      case 'credit': return 'Crédit';
      default: return 'Autre';
    }
  };

  const filteredAccounts = accounts.filter(a =>
    selectedAccountIds.length === 0 || selectedAccountIds.includes(a.id)
  );

  const totalBalance = filteredAccounts.reduce((sum, account) => sum + account.balance, 0);

  const fmt = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(v);

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white shadow-card dark:border-slate-800/80 dark:bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
          Aperçu des comptes
        </h3>
        <div className="text-right">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">Solde total</p>
          <p className="mt-0.5 text-base font-semibold tracking-tight text-slate-900 dark:text-white">
            {fmt(totalBalance)}
          </p>
        </div>
      </div>

      <div className="p-4">
        {filteredAccounts.length > 0 ? (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3">
            {filteredAccounts.map((account) => {
              const Icon = getAccountIcon(account.type);
              const percentage = totalBalance > 0 ? Math.max(0, (account.balance / totalBalance) * 100) : 0;

              return (
                <div
                  key={account.id}
                  className="group rounded-xl border border-slate-100 p-4 transition-all duration-200 hover:border-slate-200 hover:shadow-card-hover dark:border-slate-800 dark:hover:border-slate-700"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${account.color}18` }}
                    >
                      <Icon className="h-4 w-4" style={{ color: account.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {account.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        {getAccountTypeLabel(account.type)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                        {fmt(account.balance)}
                      </span>
                      <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>

                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: account.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
              <Plus className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Aucun compte sélectionné
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Utilisez le filtre des comptes pour afficher les données
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountsOverview;
