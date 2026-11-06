import type { BankAccount, Budget, CashFlow, Category, Debt, Transaction } from '../types';
import { addMonths, endOfMonth, format, startOfDay, startOfMonth } from 'date-fns';
import { getCustomMonthEnd, getCustomMonthStart } from './dateUtils.ts';

interface ProjectionInputs {
  accounts: BankAccount[];
  transactions: Transaction[];
  categories: Category[];
  debts: Debt[];
  budgets: Budget[];
  selectedAccountIds: string[];
  getProjectedRecurringTransactions: (start: Date, end: Date) => Transaction[];
}

export function calculateCashFlowProjection(
  { accounts, transactions, categories, debts, budgets, selectedAccountIds, getProjectedRecurringTransactions }: ProjectionInputs,
  months: number,
  startDateParam?: Date,
  monthStartDay?: number,
  now = new Date(),
): CashFlow[] {
  const isExcludedFromReports = (transaction: Transaction) =>
    categories.find(category => category.id === transaction.categoryId)?.excludeFromReports === true;
  const projections: CashFlow[] = [];
  const selectedAccountSet = new Set(selectedAccountIds);
  const projectionStartDate = startOfDay(startDateParam ?? now);
  const shouldIncludeAccount = (accountId: string) =>
    selectedAccountIds.length === 0 || selectedAccountSet.has(accountId);
  const cashFlowAccountIds = new Set(
    accounts
      .filter(account =>
        account.isActive &&
        account.type !== 'savings' &&
        account.type !== 'investment' &&
        account.type !== 'meal_voucher' &&
        account.type !== 'crypto' &&
        shouldIncludeAccount(account.id)
      )
      .map(account => account.id)
  );
  const savingsAccountIds = new Set(
    accounts
      .filter(account =>
        account.isActive &&
        account.type === 'savings' &&
        shouldIncludeAccount(account.id)
      )
      .map(account => account.id)
  );
  const openingBalance = accounts
    .filter(account => cashFlowAccountIds.has(account.id))
    .reduce((sum, account) => sum + account.balance, 0);
  const openingSavingsBalance = accounts
    .filter(account => savingsAccountIds.has(account.id))
    .reduce((sum, account) => sum + account.balance, 0);
  
  for (let i = 0; i < months; i++) {
    const monthStart = monthStartDay != null
      ? (i === 0 ? projectionStartDate : getCustomMonthStart(addMonths(projectionStartDate, i), monthStartDay))
      : startOfMonth(addMonths(projectionStartDate, i));
    const monthEnd = monthStartDay != null
      ? getCustomMonthEnd(monthStart, monthStartDay)
      : endOfMonth(monthStart);
    
    const monthTransactions = transactions.filter(t => 
      t.date >= monthStart && t.date <= monthEnd &&
      t.status === 'completed' &&
      !isExcludedFromReports(t) &&
      cashFlowAccountIds.has(t.accountId)
    );
    const completedMonthTransactionKeys = new Set(
      monthTransactions.map(transaction => [
        transaction.accountId,
        transaction.categoryId,
        transaction.type,
        transaction.amount,
        transaction.description.trim().toLowerCase(),
        format(transaction.date, 'yyyy-MM-dd'),
      ].join('|'))
    );

    const scheduledTransactions = transactions.filter(t => t.status === 'scheduled' && t.date >= monthStart && t.date <= monthEnd)
      .filter(t =>
        !t.isRecurring &&
        !isExcludedFromReports(t) &&
        cashFlowAccountIds.has(t.accountId) &&
        !completedMonthTransactionKeys.has([
          t.accountId,
          t.categoryId,
          t.type,
          t.amount,
          t.description.trim().toLowerCase(),
          format(t.date, 'yyyy-MM-dd'),
        ].join('|'))
      );
    const pendingTransactions = transactions.filter(t =>
      t.date >= monthStart &&
      t.date <= monthEnd &&
      t.status === 'pending' &&
      !t.isRecurring &&
      !isExcludedFromReports(t) &&
      cashFlowAccountIds.has(t.accountId) &&
      !completedMonthTransactionKeys.has([
        t.accountId,
        t.categoryId,
        t.type,
        t.amount,
        t.description.trim().toLowerCase(),
        format(t.date, 'yyyy-MM-dd'),
      ].join('|'))
    );
    const actualTransactions = monthTransactions.concat(scheduledTransactions, pendingTransactions);
    const isRecurringAlreadyRepresented = (projected: Transaction) => {
      const maxDateDistanceMs = 7 * 24 * 60 * 60 * 1000;

      return actualTransactions.some(actual => {
        if (actual.accountId !== projected.accountId) return false;
        if (actual.categoryId !== projected.categoryId) return false;
        if (actual.type !== projected.type) return false;
        if (Math.abs(actual.amount - projected.amount) > 0.01) return false;
        if (Math.abs(startOfDay(actual.date).getTime() - startOfDay(projected.date).getTime()) > maxDateDistanceMs) return false;

        const projDesc = projected.description.trim().toLowerCase();
        const actDesc = actual.description.trim().toLowerCase();
        if (projDesc && actDesc) {
          if (projDesc.includes(actDesc) || actDesc.includes(projDesc)) return true;
        }
        return true;
      });
    };

    const projectedRecurringTransactions = getProjectedRecurringTransactions(monthStart, monthEnd)
      .filter(t =>
        !isExcludedFromReports(t) &&
        cashFlowAccountIds.has(t.accountId) &&
        !isRecurringAlreadyRepresented(t)
      );
    const plannedTransactions = scheduledTransactions.concat(pendingTransactions, projectedRecurringTransactions);
    const visibleMonthTransactions = monthTransactions.concat(plannedTransactions);
    const cashMovementTransactions = visibleMonthTransactions;
    const isDebtAlreadyRepresented = (debt: Debt, dueDate: Date) => {
      const expectedAmount = Math.min(debt.minimumPayment, debt.remainingAmount);
      const debtName = debt.name.trim().toLowerCase();
      const maxDateDistanceMs = 5 * 24 * 60 * 60 * 1000;

      return visibleMonthTransactions.some(transaction => {
        if (transaction.accountId !== debt.accountId) return false;
        if (transaction.type !== 'expense' && transaction.type !== 'bill') return false;
        if (Math.abs(transaction.amount - expectedAmount) > 0.01) return false;
        if (Math.abs(startOfDay(transaction.date).getTime() - dueDate.getTime()) > maxDateDistanceMs) return false;

        const category = categories.find(item => item.id === transaction.categoryId);
        const description = transaction.description.trim().toLowerCase();
        const sameDebtCategory = debt.categoryId && transaction.categoryId === debt.categoryId;
        const debtNamedInTransaction = debtName.length > 0 && (
          description.includes(debtName) ||
          debtName.includes(description)
        );
        const debtLikeCategory = category?.type === 'debt' || category?.name.toLowerCase().includes('prêt');

        return Boolean(sameDebtCategory || debtNamedInTransaction || debtLikeCategory);
      });
    };
    const debtPaymentsForMonth = debts
      .filter(debt =>
        debt.isActive &&
        debt.minimumPayment > 0 &&
        debt.remainingAmount > 0 &&
        cashFlowAccountIds.has(debt.accountId)
      )
      .reduce((sum, debt) => {
        let dueDate = startOfDay(debt.dueDate);
        while (dueDate < monthStart) {
          dueDate = startOfDay(addMonths(dueDate, 1));
        }

        if (dueDate > monthEnd) return sum;
        if (isDebtAlreadyRepresented(debt, dueDate)) return sum;
        return sum + Math.min(debt.minimumPayment, debt.remainingAmount);
      }, 0);

    const transferInFromSavings = cashMovementTransactions
      .filter(t =>
        t.type === 'transfer' &&
        cashFlowAccountIds.has(t.accountId) &&
        t.transferToAccountId &&
        savingsAccountIds.has(t.transferToAccountId) &&
        t.description.toLowerCase().includes('depuis')
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const income = cashMovementTransactions
      .filter(t => t.type === 'income' || t.type === 'refund' || t.type === 'savings_withdrawal')
      .reduce((sum, t) => sum + t.amount, 0) + transferInFromSavings;

    const transferOutToExternalAccounts = cashMovementTransactions
      .filter(t =>
        t.type === 'transfer' &&
        cashFlowAccountIds.has(t.accountId) &&
        t.transferToAccountId &&
        !cashFlowAccountIds.has(t.transferToAccountId) &&
        !savingsAccountIds.has(t.transferToAccountId) &&
        !t.description.toLowerCase().includes('depuis')
      )
      .reduce((sum, t) => sum + t.amount, 0);
    const transferOutToSavingsAccounts = cashMovementTransactions
      .filter(t =>
        t.type === 'transfer' &&
        cashFlowAccountIds.has(t.accountId) &&
        t.transferToAccountId &&
        savingsAccountIds.has(t.transferToAccountId) &&
        !t.description.toLowerCase().includes('depuis')
      )
      .reduce((sum, t) => sum + t.amount, 0);
      
    const baseExpenses = cashMovementTransactions
      .filter(t => t.type === 'expense' || t.type === 'bill')
      .reduce((sum, t) => sum + t.amount, 0);
      
    const savings = cashMovementTransactions
      .filter(t => t.type === 'savings')
      .reduce((sum, t) => sum + t.amount, 0);

    const isDebtLikeCategory = (category?: Category) => {
      const name = category?.name.toLowerCase() || '';
      return category?.type === 'debt' || name.includes('prêt') || name.includes('credit') || name.includes('crédit');
    };

    const activeMonthBudgets = budgets.filter(
      budget =>
        budget.isActive &&
        budget.startDate <= monthEnd &&
        (!budget.endDate || budget.endDate >= monthStart)
    );
    const budgetCategoryIds = new Set(activeMonthBudgets.map(budget => budget.categoryId));
    const monthBudgetItems = activeMonthBudgets
      .map(budget => {
        const category = categories.find(item => item.id === budget.categoryId);
        if (!category || category.excludeFromReports || category.type !== 'expense') return null;
        if (isDebtLikeCategory(category)) return null;

        const normalizedAmount =
          budget.period === 'yearly'
            ? budget.amount / 12
            : budget.period === 'weekly'
              ? budget.amount * 4.345
              : budget.amount;

        return {
          categoryId: budget.categoryId,
          amount: normalizedAmount,
        };
      })
      .filter((item): item is { categoryId: string; amount: number } => item !== null);

    categories
      .filter(category =>
        category.type === 'expense' &&
        !category.excludeFromReports &&
        !isDebtLikeCategory(category) &&
        category.budget &&
        !budgetCategoryIds.has(category.id)
      )
      .forEach(category => {
        monthBudgetItems.push({
          categoryId: category.id,
          amount: category.budget || 0,
        });
      });

    const budgetReserve = monthBudgetItems.reduce((sum, budgetItem) => {
      const committedForCategory = visibleMonthTransactions
        .filter(transaction =>
          transaction.categoryId === budgetItem.categoryId &&
          (transaction.type === 'expense' || transaction.type === 'bill')
        )
        .reduce((categorySum, transaction) => categorySum + transaction.amount, 0);

      return sum + Math.max(budgetItem.amount - committedForCategory, 0);
    }, 0);

    const totalOutflows = baseExpenses + debtPaymentsForMonth + transferOutToExternalAccounts + transferOutToSavingsAccounts + budgetReserve + savings;
    const balance = income - totalOutflows;
    
    let projectedBalance: number;
    let projectedSavingsBalance: number;
    let monthOpeningBalance: number;
    let monthOpeningSavingsBalance: number;

    let remainingIncome = income;
    let remainingExpenses = totalOutflows;
    if (i === 0) {
      // Outstanding operations still affect the balance after their due date.
      // Only completed operations have already been applied to account balances.
      const remainingTransactions = plannedTransactions;

      const remainingTransferInFromSavings = remainingTransactions
        .filter(t =>
          t.type === 'transfer' &&
          cashFlowAccountIds.has(t.accountId) &&
          t.transferToAccountId &&
          savingsAccountIds.has(t.transferToAccountId) &&
          t.description.toLowerCase().includes('depuis')
        )
        .reduce((sum, t) => sum + t.amount, 0);

      remainingIncome = remainingTransactions
        .filter(t => t.type === 'income' || t.type === 'refund' || t.type === 'savings_withdrawal')
        .reduce((sum, t) => sum + t.amount, 0) + remainingTransferInFromSavings;

      const remainingExternalTransfers = remainingTransactions
        .filter(t =>
          t.type === 'transfer' &&
          cashFlowAccountIds.has(t.accountId) &&
          t.transferToAccountId &&
          !cashFlowAccountIds.has(t.transferToAccountId) &&
          !savingsAccountIds.has(t.transferToAccountId) &&
          !t.description.toLowerCase().includes('depuis')
        )
        .reduce((sum, t) => sum + t.amount, 0);
      const remainingSavingsTransfers = remainingTransactions
        .filter(t =>
          t.type === 'transfer' &&
          cashFlowAccountIds.has(t.accountId) &&
          t.transferToAccountId &&
          savingsAccountIds.has(t.transferToAccountId) &&
          !t.description.toLowerCase().includes('depuis')
        )
        .reduce((sum, t) => sum + t.amount, 0);
      const remainingBaseExpenses = remainingTransactions
        .filter(t => t.type === 'expense' || t.type === 'bill')
        .reduce((sum, t) => sum + t.amount, 0);
      const remainingSavings = remainingTransactions
        .filter(t => t.type === 'savings')
        .reduce((sum, t) => sum + t.amount, 0);

      const remainingOutflows = remainingBaseExpenses + debtPaymentsForMonth + remainingExternalTransfers + remainingSavingsTransfers + budgetReserve + remainingSavings;
      remainingExpenses = remainingOutflows;
      const remainingDelta = remainingIncome - remainingExpenses;

      projectedBalance = openingBalance + remainingDelta;
      projectedSavingsBalance = openingSavingsBalance + remainingSavings + remainingSavingsTransfers;
      
      // Pour que l'affichage soit cohérent : Départ + Résultat complet = Fin
      monthOpeningBalance = projectedBalance - balance;
      monthOpeningSavingsBalance = projectedSavingsBalance - (savings + transferOutToSavingsAccounts);
    } else {
      monthOpeningBalance = projections[i - 1].projectedBalance;
      monthOpeningSavingsBalance = projections[i - 1].projectedSavingsBalance || openingSavingsBalance;
      projectedBalance = monthOpeningBalance + balance;
      projectedSavingsBalance = monthOpeningSavingsBalance + savings + transferOutToSavingsAccounts;
    }
    
    const projectedTotalBalance = projectedBalance + projectedSavingsBalance;

    projections.push({
      date: monthStart,
      income,
      expenses: totalOutflows,
      savings: savings + transferOutToSavingsAccounts,
      balance,
      projectedBalance,
      remainingIncome,
      remainingExpenses,
      openingBalance: monthOpeningBalance,
      projectedSavingsBalance,
      projectedTotalBalance,
      baseExpenses,
      debtPayments: debtPaymentsForMonth,
      transfersOut: transferOutToExternalAccounts,
      budgetReserve,
      scheduledTransactions: plannedTransactions,
      allTransactions: visibleMonthTransactions
    });
  }

  return projections;
}
