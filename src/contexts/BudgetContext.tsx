import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { 
  Transaction, 
  Category, 
  BankAccount,
  Budget, 
  SavingsGoal, 
  Debt,
  DebtPayment,
  BudgetContextType,
  FinancialSummary,
  CashFlow,
  RecurringPattern,
  CalendarEvent,
  ExportOptions
} from '../types';
import { useAuth } from './AuthContext';
import { supabaseService } from '../services/supabaseService';
import { db } from '../services/database';
import { getCustomMonthEnd, getCustomMonthStart } from '../utils/dateUtils';
import { 
  startOfMonth, 
  endOfMonth, 
  addMonths, 
  eachDayOfInterval,
  format,
  isSameMonth,
  addDays,
  addWeeks,
  addYears,
  isBefore,
  isAfter,
  isSameDay,
  startOfDay
} from 'date-fns';

const BudgetContext = createContext<BudgetContextType | undefined>(undefined);

export const useBudget = () => {
  const context = useContext(BudgetContext);
  if (!context) {
    throw new Error('useBudget must be used within a BudgetProvider');
  }
  return context;
};

const defaultCategories: Omit<Category, 'id' | 'userId'>[] = [
  // Income categories
  { name: 'Salaire', icon: 'Banknote', color: '#059669', type: 'income', order: 1, isActive: true },
  { name: 'Freelance', icon: 'Briefcase', color: '#0891B2', type: 'income', order: 2, isActive: true },
  { name: 'Investissements', icon: 'TrendingUp', color: '#7C3AED', type: 'income', order: 3, isActive: true },
  { name: 'Autres revenus', icon: 'Plus', color: '#059669', type: 'income', order: 4, isActive: true },
  
  // Expense categories
  { name: 'Logement', icon: 'Home', color: '#3B82F6', type: 'expense', order: 1, isActive: true },
  { name: 'Alimentation', icon: 'ShoppingCart', color: '#10B981', type: 'expense', order: 2, isActive: true },
  { name: 'Transport', icon: 'Car', color: '#F59E0B', type: 'expense', order: 3, isActive: true },
  { name: 'Loisirs', icon: 'Gamepad2', color: '#8B5CF6', type: 'expense', order: 4, isActive: true },
  { name: 'Santé', icon: 'Heart', color: '#EF4444', type: 'expense', order: 5, isActive: true },
  { name: 'Vêtements', icon: 'Shirt', color: '#EC4899', type: 'expense', order: 6, isActive: true },
  { name: 'Éducation', icon: 'GraduationCap', color: '#6366F1', type: 'expense', order: 7, isActive: true },
  { name: 'Assurances', icon: 'Shield', color: '#64748B', type: 'expense', order: 8, isActive: true },
  { name: 'Impôts', icon: 'Receipt', color: '#DC2626', type: 'expense', order: 9, isActive: true },
  { name: 'Autres dépenses', icon: 'MoreHorizontal', color: '#6B7280', type: 'expense', order: 10, isActive: true },
  
  // Savings categories
  { name: 'Épargne urgence', icon: 'Shield', color: '#059669', type: 'savings', order: 1, isActive: true },
  { name: 'Épargne projet', icon: 'Target', color: '#0891B2', type: 'savings', order: 2, isActive: true },
  { name: 'Investissements', icon: 'TrendingUp', color: '#7C3AED', type: 'savings', order: 3, isActive: true },
  { name: 'Retraite', icon: 'Clock', color: '#059669', type: 'savings', order: 4, isActive: true },

  // Bill categories
  { name: 'Électricité', icon: 'Lightbulb', color: '#F59E0B', type: 'bill', order: 1, isActive: true },
  { name: 'Internet', icon: 'Wifi', color: '#3B82F6', type: 'bill', order: 2, isActive: true },
  { name: 'Téléphone', icon: 'Phone', color: '#10B981', type: 'bill', order: 3, isActive: true },
  { name: 'Assurance', icon: 'Shield', color: '#8B5CF6', type: 'bill', order: 4, isActive: true },
];

const defaultAccounts: Omit<BankAccount, 'id' | 'userId'>[] = [];

const dedupeCategories = (items: Category[]): Category[] => {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = `${item.type}:${item.name.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const dedupeAccounts = (items: BankAccount[]): BankAccount[] => {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = `${item.type}:${item.name.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const getAccountBalanceImpact = (transaction: Pick<Transaction, 'type' | 'amount' | 'description'>) => {
  if (transaction.type === 'income' || transaction.type === 'refund' || transaction.type === 'savings_withdrawal') {
    return transaction.amount;
  }

  if (transaction.type === 'transfer') {
    return transaction.description.toLowerCase().includes('depuis')
      ? transaction.amount
      : -transaction.amount;
  }

  return -transaction.amount;
};

const normalizeCategoryRefs = (
  categoryItems: Category[],
  transactionItems: Transaction[],
  budgetItems: Budget[]
) => {
  const canonicalByKey = new Map<string, string>();
  const idToCanonical = new Map<string, string>();

  for (const category of categoryItems) {
    const key = `${category.type}:${category.name.trim().toLowerCase()}`;
    const canonicalId = canonicalByKey.get(key) || category.id;
    canonicalByKey.set(key, canonicalId);
    idToCanonical.set(category.id, canonicalId);
  }

  return {
    categories: dedupeCategories(categoryItems),
    transactions: transactionItems.map(transaction => ({
      ...transaction,
      categoryId: idToCanonical.get(transaction.categoryId) || transaction.categoryId,
    })),
    budgets: budgetItems.map(budget => ({
      ...budget,
      categoryId: idToCanonical.get(budget.categoryId) || budget.categoryId,
    })),
  };
};

interface BudgetProviderProps {
  children: ReactNode;
}

export const BudgetProvider: React.FC<BudgetProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const accountsRef = useRef<BankAccount[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtPayments, setDebtPayments] = useState<DebtPayment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<'pending' | 'completed' | 'error'>('pending');
  const loadRequestId = useRef(0);
  
  // Filters
  const [currentPeriod, setCurrentPeriod] = useState({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date())
  });
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);

  useEffect(() => {
    accountsRef.current = accounts;
  }, [accounts]);

  useEffect(() => {
    if (!user || transactions.length === 0 || accounts.length === 0) return;

    generateRecurringTransactions();
    reconcileScheduledTransactionStatuses();
  }, [user?.id, transactions, accounts]);

  useEffect(() => {
    if (user) {
      console.log('💰 User detected, loading budget data...');
      loadUserData(user.id);
    } else {
      // Clear data when user logs out
      console.log('🔄 Clearing budget data after logout');
      loadRequestId.current++;
      setTransactions([]);
      setCategories([]);
      setAccounts([]);
      setBudgets([]);
      setSavingsGoals([]);
      setDebts([]);
      setDebtPayments([]);
      setSelectedAccountIds([]);
      setMigrationStatus('pending');
    }
  }, [user?.id]);

  const loadUserData = async (userId = user?.id) => {
    if (!userId) return;

    console.log('💰 Loading budget data for user:', user?.email || userId);
    const requestId = ++loadRequestId.current;
    setIsLoading(true);
    
    try {
      // Check if user has data in Supabase
      const [
        supabaseAccounts,
        supabaseCategories,
        supabaseTransactions,
        supabaseBudgets,
        supabaseSavingsGoals,
        supabaseDebts,
        supabaseDebtPayments
      ] = await Promise.all([
        supabaseService.getAccounts(userId),
        supabaseService.getCategories(userId),
        supabaseService.getTransactions(userId),
        supabaseService.getBudgets(userId),
        supabaseService.getSavingsGoals(userId),
        supabaseService.getDebts(userId),
        supabaseService.getDebtPayments()
      ]);

      console.log('📊 Supabase data loaded:', {
        accounts: supabaseAccounts.length,
        categories: supabaseCategories.length,
        transactions: supabaseTransactions.length,
        budgets: supabaseBudgets.length,
        goals: supabaseSavingsGoals.length,
        debts: supabaseDebts.length
      });

      if (requestId !== loadRequestId.current) return;

      // If no data in Supabase, try to migrate from IndexedDB
      if (supabaseAccounts.length === 0 && supabaseCategories.length === 0 && supabaseTransactions.length === 0) {
        console.log('🔄 No data found, attempting migration...');
        await migrateFromIndexedDB();
        
        // Reload data after migration
        const [
          newAccounts,
          newCategories,
          newTransactions,
          newBudgets,
          newSavingsGoals,
          newDebts,
          newDebtPayments
        ] = await Promise.all([
          supabaseService.getAccounts(userId),
          supabaseService.getCategories(userId),
          supabaseService.getTransactions(userId),
          supabaseService.getBudgets(userId),
          supabaseService.getSavingsGoals(userId),
          supabaseService.getDebts(userId),
          supabaseService.getDebtPayments()
        ]);

        if (requestId !== loadRequestId.current) return;

        const cleanAccounts = dedupeAccounts(newAccounts);
        const normalized = normalizeCategoryRefs(newCategories, newTransactions, newBudgets);

        setAccounts(cleanAccounts);
        setCategories(normalized.categories);
        setTransactions(normalized.transactions);
        setBudgets(normalized.budgets);
        setSavingsGoals(newSavingsGoals);
        setDebts(newDebts);
        setDebtPayments(newDebtPayments);
        setSelectedAccountIds(cleanAccounts.map(acc => acc.id));
      } else {
        if (requestId !== loadRequestId.current) return;

        console.log('✅ Using existing Supabase data');
        const cleanAccounts = dedupeAccounts(supabaseAccounts);
        const normalized = normalizeCategoryRefs(supabaseCategories, supabaseTransactions, supabaseBudgets);

        setAccounts(cleanAccounts);
        setCategories(normalized.categories);
        setTransactions(normalized.transactions);
        setBudgets(normalized.budgets);
        setSavingsGoals(supabaseSavingsGoals);
        setDebts(supabaseDebts);
        setDebtPayments(supabaseDebtPayments);
        setSelectedAccountIds(cleanAccounts.map(acc => acc.id));
      }

      setMigrationStatus('completed');
      console.log('✅ Budget data loaded successfully');

    } catch (error) {
      console.error('❌ Error loading user data:', error);
      if (requestId === loadRequestId.current) {
        setMigrationStatus('error');
      }
    } finally {
      if (requestId === loadRequestId.current) {
        setIsLoading(false);
      }
    }
  };

  const reloadAll = async () => {
    await loadUserData();
  };

  const migrateFromIndexedDB = async () => {
    if (!user) return;

    try {
      console.log('🔄 Starting migration from IndexedDB...');
      // Initialize IndexedDB
      await db.init();

      // Get data from IndexedDB
      const [
        indexedDBTransactions,
        indexedDBCategories,
        indexedDBAccounts,
        indexedDBBudgets,
        indexedDBSavingsGoals,
        indexedDBDebts,
        indexedDBDebtPayments
      ] = await Promise.all([
        db.getTransactionsByUserId(user.id),
        db.getCategoriesByUserId(user.id),
        db.getAccountsByUserId(user.id),
        db.getBudgetsByUserId(user.id),
        db.getSavingsGoalsByUserId(user.id),
        db.getDebtsByUserId(user.id),
        db.getDebtPayments()
      ]);

      // If no data in IndexedDB either, create default data
      if (indexedDBAccounts.length === 0 && indexedDBCategories.length === 0) {
        console.log('📝 No existing data found, creating defaults...');
        await createDefaultData();
        return;
      }

      console.log('🔄 Migrating data to Supabase...', {
        accounts: indexedDBAccounts.length,
        categories: indexedDBCategories.length,
        transactions: indexedDBTransactions.length
      });

      // Migrate data to Supabase
      const migrationData = {
        transactions: indexedDBTransactions,
        categories: indexedDBCategories,
        accounts: indexedDBAccounts,
        budgets: indexedDBBudgets,
        savingsGoals: indexedDBSavingsGoals,
        debts: indexedDBDebts,
        debtPayments: indexedDBDebtPayments
      };

      await supabaseService.migrateFromIndexedDB(user.id, migrationData);
      console.log('✅ Migration from IndexedDB to Supabase completed successfully');

    } catch (error) {
      console.error('❌ Migration from IndexedDB failed:', error);
      // Create default data if migration fails
      await createDefaultData();
    }
  };

  const createDefaultData = async () => {
    if (!user) return;

    try {
      console.log('📝 Creating default categories and accounts...');
      
      const [existingCategories, existingAccounts] = await Promise.all([
        supabaseService.getCategories(user.id),
        supabaseService.getAccounts(user.id),
      ]);
      const existingCategoryKeys = new Set(
        existingCategories.map(category => `${category.type}:${category.name.trim().toLowerCase()}`)
      );
      const existingAccountKeys = new Set(
        existingAccounts.map(account => `${account.type}:${account.name.trim().toLowerCase()}`)
      );

      // Create default categories
      for (const categoryData of defaultCategories) {
        const key = `${categoryData.type}:${categoryData.name.trim().toLowerCase()}`;
        if (existingCategoryKeys.has(key)) continue;
        existingCategoryKeys.add(key);
        await supabaseService.createCategory({
          ...categoryData,
          userId: user.id,
        });
      }

      // Create default accounts
      for (const accountData of defaultAccounts) {
        const key = `${accountData.type}:${accountData.name.trim().toLowerCase()}`;
        if (existingAccountKeys.has(key)) continue;
        existingAccountKeys.add(key);
        await supabaseService.createAccount({
          ...accountData,
          userId: user.id,
        });
      }

      console.log('✅ Default data created successfully');
    } catch (error) {
      console.error('❌ Error creating default data:', error);
    }
  };

  // Transaction functions
  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'userId'>) => {
    if (!user) return;
    if (!transaction.accountId) {
      throw new Error('Aucun compte sélectionné pour cette transaction');
    }
    if (!transaction.categoryId) {
      throw new Error('Aucune catégorie sélectionnée pour cette transaction');
    }
    
    try {
      const newTransaction = await supabaseService.createTransaction({
        ...transaction,
        userId: user.id,
      });
      
      setTransactions(prev => [newTransaction, ...prev]);

      // Update account balance only for completed transactions
      if (newTransaction.status === 'completed') {
        await updateAccountBalance(
          transaction.accountId, 
          getAccountBalanceImpact(newTransaction)
        );
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
      throw error;
    }
  };

  const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
    if (!user) return;

    try {
      const oldTransaction = transactions.find(t => t.id === id);
      if (!oldTransaction) return;

      const updatedTransaction = await supabaseService.updateTransaction(id, updates);
      
      setTransactions(prev => prev.map(t => t.id === id ? updatedTransaction : t));

      // Update account balances if amount, account, type or completion status changed
      if (
        updates.amount !== undefined ||
        updates.accountId !== undefined ||
        updates.type !== undefined ||
        updates.status !== undefined
      ) {
        // Revert old transaction effect (only if it was completed)
        if (oldTransaction.status === 'completed') {
          await updateAccountBalance(
            oldTransaction.accountId, 
            -getAccountBalanceImpact(oldTransaction)
          );
        }
        
        // Apply new transaction effect (only if it's completed)
        if (updatedTransaction.status === 'completed') {
          await updateAccountBalance(
            updatedTransaction.accountId, 
            getAccountBalanceImpact(updatedTransaction)
          );
        }
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }
  };

  const deleteTransaction = async (id: string) => {
    if (!user) return;

    try {
      const transaction = transactions.find(t => t.id === id);
      if (!transaction) return;

      await supabaseService.deleteTransaction(id);
      setTransactions(prev => prev.filter(t => t.id !== id));

      // Revert account balance (only if it was completed)
      if (transaction.status === 'completed') {
        await updateAccountBalance(
          transaction.accountId, 
          -getAccountBalanceImpact(transaction)
        );
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    }
  };

  const getScheduledTransactions = (startDate: Date, endDate: Date): Transaction[] => {
    return transactions.filter(t => 
      t.status === 'scheduled' && 
      t.date >= startDate && 
      t.date <= endDate
    );
  };

  const getNextRecurringDate = (date: Date, pattern: RecurringPattern) => {
    switch (pattern.frequency) {
      case 'daily':
        return addDays(date, pattern.interval);
      case 'weekly':
        return addWeeks(date, pattern.interval);
      case 'monthly':
        return addMonths(date, pattern.interval);
      case 'quarterly':
        return addMonths(date, pattern.interval * 3);
      case 'yearly':
        return addYears(date, pattern.interval);
      default:
        return addMonths(date, 1);
    }
  };

  const getProjectedRecurringTransactions = (startDate: Date, endDate: Date): Transaction[] => {
    const projectedTransactions: Transaction[] = [];
    const rangeStart = startOfDay(startDate);
    const rangeEnd = startOfDay(endDate);

    transactions
      .filter(transaction => transaction.isRecurring && transaction.recurringPattern?.isActive)
      .forEach(template => {
        const pattern = template.recurringPattern!;
        let occurrenceDate = startOfDay(pattern.nextDate);
        let occurrenceCount = pattern.currentOccurrence || 0;

        while (occurrenceDate < rangeStart) {
          if (pattern.endDate && isAfter(occurrenceDate, startOfDay(pattern.endDate))) return;
          if (pattern.maxOccurrences && occurrenceCount >= pattern.maxOccurrences) return;

          const nextDate = getNextRecurringDate(occurrenceDate, pattern);
          if (!nextDate || !isAfter(nextDate, occurrenceDate)) return;
          occurrenceDate = startOfDay(nextDate);
          occurrenceCount += 1;
        }

        while (occurrenceDate <= rangeEnd) {
          if (pattern.endDate && isAfter(occurrenceDate, startOfDay(pattern.endDate))) break;
          if (pattern.maxOccurrences && occurrenceCount >= pattern.maxOccurrences) break;

          projectedTransactions.push({
            ...template,
            id: `${template.id}-projected-${occurrenceDate.toISOString()}`,
            date: occurrenceDate,
            status: 'scheduled',
            isRecurring: false,
            recurringPattern: undefined,
          });

          const nextDate = getNextRecurringDate(occurrenceDate, pattern);
          if (!nextDate || !isAfter(nextDate, occurrenceDate)) break;
          occurrenceDate = startOfDay(nextDate);
          occurrenceCount += 1;
        }
      });

    return projectedTransactions;
  };

  const isExcludedFromReports = (transaction: Transaction) =>
    categories.find(category => category.id === transaction.categoryId)?.excludeFromReports === true;

  const getAutoCompletionDate = (date: Date) => {
    const threshold = startOfDay(date);
    threshold.setMinutes(1);
    return threshold;
  };

  const reconcileScheduledTransactionStatuses = async () => {
    const now = new Date();
    const dueTransactions = transactions.filter(transaction =>
      transaction.status === 'scheduled' &&
      !transaction.isRecurring &&
      !isAfter(getAutoCompletionDate(transaction.date), now)
    );
    for (const transaction of dueTransactions) {
      try {
        await updateTransaction(transaction.id, { status: 'completed' });
      } catch (error) {
        console.error('Error completing scheduled transaction:', error);
      }
    }
  };

  // Account functions
  const addAccount = async (account: Omit<BankAccount, 'id' | 'userId'>) => {
    if (!user) return;
    const duplicate = accounts.some(existing =>
      existing.type === account.type &&
      existing.name.trim().toLowerCase() === account.name.trim().toLowerCase()
    );
    if (duplicate) {
      console.warn('Un compte avec ce nom existe déjà');
      return;
    }
    
    try {
      const newAccount = await supabaseService.createAccount({
        ...account,
        userId: user.id,
      });
      
      setAccounts(prev => [...prev, newAccount]);
      setSelectedAccountIds(prev => [...prev, newAccount.id]);
    } catch (error) {
      console.error('Error adding account:', error);
      throw error;
    }
  };

  const updateAccount = async (id: string, updates: Partial<BankAccount>) => {
    if (!user) return;

    try {
      const updatedAccount = await supabaseService.updateAccount(id, updates);
      setAccounts(prev => prev.map(a => a.id === id ? updatedAccount : a));
    } catch (error) {
      console.error('Error updating account:', error);
      throw error;
    }
  };

  const deleteAccount = async (id: string) => {
    if (!user) return;

    try {
      await supabaseService.deleteAccount(id);
      setAccounts(prev => prev.filter(a => a.id !== id));
      setSelectedAccountIds(prev => prev.filter(accountId => accountId !== id));
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  };

  const updateAccountBalance = async (accountId: string, amount: number) => {
    if (!user) return;

    try {
      const latestAccounts = await supabaseService.getAccounts(user.id);
      const account = latestAccounts.find(a => a.id === accountId);
      if (!account) return;

      const updatedAccount = await supabaseService.updateAccount(accountId, {
        balance: account.balance + amount
      });
      accountsRef.current = accountsRef.current.map(a => a.id === accountId ? updatedAccount : a);
      setAccounts(accountsRef.current);
    } catch (error) {
      console.error('Error updating account balance:', error);
      throw error;
    }
  };

  const transferBetweenAccounts = async (fromAccountId: string, toAccountId: string, amount: number, description: string) => {
    if (!user) return;

    try {
      const fromAccount = accounts.find(a => a.id === fromAccountId);
      const toAccount = accounts.find(a => a.id === toAccountId);

      if (!fromAccount || !toAccount) {
        throw new Error('Compte introuvable pour ce transfert');
      }

      if (fromAccountId === toAccountId) {
        throw new Error('Les comptes de départ et de destination doivent être différents');
      }

      if (amount <= 0 || !Number.isFinite(amount)) {
        throw new Error('Le montant du transfert doit être positif');
      }

      let transferCategory = categories.find(category =>
        category.name.trim().toLowerCase() === 'transferts'
      );

      if (!transferCategory) {
        transferCategory = await supabaseService.createCategory({
          userId: user.id,
          name: 'Transferts',
          icon: 'ArrowRightLeft',
          color: '#059669',
          type: 'expense',
          order: categories.length,
          isActive: true,
          description: 'Mouvements internes entre comptes',
        });
        setCategories(prev => [...prev, transferCategory!]);
      }

      // Create transfer transactions
      const transferOut = await supabaseService.createTransaction({
        userId: user.id,
        accountId: fromAccountId,
        amount,
        description: `Virement vers ${toAccount.name} - ${description}`,
        date: new Date(),
        categoryId: transferCategory.id,
        type: 'transfer',
        status: 'completed',
        isRecurring: false,
        transferToAccountId: toAccountId
      });

      const transferIn = await supabaseService.createTransaction({
        userId: user.id,
        accountId: toAccountId,
        amount,
        description: `Virement depuis ${fromAccount.name} - ${description}`,
        date: new Date(),
        categoryId: transferCategory.id,
        type: 'transfer',
        status: 'completed',
        isRecurring: false,
        transferToAccountId: fromAccountId
      });

      setTransactions(prev => [transferIn, transferOut, ...prev]);

      // Update balances
      await updateAccountBalance(fromAccountId, -amount);
      await updateAccountBalance(toAccountId, amount);
    } catch (error) {
      console.error('Error transferring between accounts:', error);
      throw error;
    }
  };

  // Category functions
  const addCategory = async (category: Omit<Category, 'id'>) => {
    if (!user) return;
    const duplicate = categories.some(existing =>
      existing.type === category.type &&
      existing.name.trim().toLowerCase() === category.name.trim().toLowerCase()
    );
    if (duplicate) {
      console.warn('Une catégorie avec ce nom existe déjà');
      return;
    }

    try {
      const newCategory = await supabaseService.createCategory({
        ...category,
        userId: user.id,
      });
      
      setCategories(prev => [...prev, newCategory]);
    } catch (error) {
      console.error('Error adding category:', error);
      throw error;
    }
  };

  const updateCategory = async (id: string, updates: Partial<Category>) => {
    try {
      const updatedCategory = await supabaseService.updateCategory(id, updates);
      setCategories(prev => prev.map(c => c.id === id ? updatedCategory : c));
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      await supabaseService.deleteCategory(id);
      setCategories(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  };

  const reorderCategories = async (categoryIds: string[]) => {
    try {
      // Update order for each category
      for (let i = 0; i < categoryIds.length; i++) {
        const categoryId = categoryIds[i];
        await supabaseService.updateCategory(categoryId, { order: i });
      }
      
      // Update local state
      setCategories(prev => prev.map(cat => {
        const newOrder = categoryIds.indexOf(cat.id);
        return newOrder >= 0 ? { ...cat, order: newOrder } : cat;
      }));
    } catch (error) {
      console.error('Error reordering categories:', error);
      throw error;
    }
  };

  // Budget functions
  const setBudget = async (budget: Omit<Budget, 'id' | 'userId'>) => {
    if (!user) return;
    
    try {
      const existingBudget = budgets.find(
        b => b.categoryId === budget.categoryId && 
             b.period === budget.period &&
             isSameMonth(b.startDate, budget.startDate)
      );

      if (existingBudget) {
        const updatedBudget = await supabaseService.updateBudget(existingBudget.id, {
          amount: budget.amount
        });
        setBudgets(prev => prev.map(b => b.id === existingBudget.id ? updatedBudget : b));
      } else {
        const newBudget = await supabaseService.createBudget({
          ...budget,
          userId: user.id,
        });
        setBudgets(prev => [...prev, newBudget]);
      }
    } catch (error) {
      console.error('Error setting budget:', error);
      throw error;
    }
  };

  const deleteBudget = async (id: string) => {
    try {
      await supabaseService.deleteBudget(id);
      setBudgets(prev => prev.filter(b => b.id !== id));
    } catch (error) {
      console.error('Error deleting budget:', error);
      throw error;
    }
  };

  // Savings Goals functions
  const addSavingsGoal = async (goal: Omit<SavingsGoal, 'id' | 'userId' | 'currentAmount' | 'isCompleted' | 'createdAt'>) => {
    if (!user) return;
    
    try {
      const newGoal = await supabaseService.createSavingsGoal({
        ...goal,
        userId: user.id,
        currentAmount: 0,
        isCompleted: false,
        createdAt: new Date(),
      });
      
      setSavingsGoals(prev => [newGoal, ...prev]);
    } catch (error) {
      console.error('Error adding savings goal:', error);
      throw error;
    }
  };

  const updateSavingsGoal = async (id: string, updates: Partial<SavingsGoal>) => {
    try {
      const updatedGoal = await supabaseService.updateSavingsGoal(id, updates);
      setSavingsGoals(prev => prev.map(g => g.id === id ? updatedGoal : g));
    } catch (error) {
      console.error('Error updating savings goal:', error);
      throw error;
    }
  };

  const deleteSavingsGoal = async (id: string) => {
    try {
      await supabaseService.deleteSavingsGoal(id);
      setSavingsGoals(prev => prev.filter(g => g.id !== id));
    } catch (error) {
      console.error('Error deleting savings goal:', error);
      throw error;
    }
  };

  const contributeToGoal = async (goalId: string, amount: number, accountId: string) => {
    if (!user) return;

    try {
      const goal = savingsGoals.find(g => g.id === goalId);
      if (!goal) return;

      // Update goal
      const newAmount = goal.currentAmount + amount;
      const updatedGoal = await supabaseService.updateSavingsGoal(goalId, {
        currentAmount: newAmount,
        isCompleted: newAmount >= goal.targetAmount
      });
      setSavingsGoals(prev => prev.map(g => g.id === goalId ? updatedGoal : g));

      // Create transaction
      await addTransaction({
        accountId,
        amount,
        description: `Épargne pour ${goal.title}`,
        date: new Date(),
        categoryId: goal.categoryId || 'cat-savings-1',
        type: 'savings',
        status: 'completed',
        isRecurring: false,
        memo: `Contribution à l'objectif: ${goal.title}`
      });
    } catch (error) {
      console.error('Error contributing to goal:', error);
      throw error;
    }
  };

  // Debt functions
  const addDebt = async (debt: Omit<Debt, 'id' | 'userId'>) => {
    if (!user) return;
    
    try {
      const newDebt = await supabaseService.createDebt({
        ...debt,
        userId: user.id,
      });
      
      setDebts(prev => [newDebt, ...prev]);
    } catch (error) {
      console.error('Error adding debt:', error);
      throw error;
    }
  };

  const updateDebt = async (id: string, updates: Partial<Debt>) => {
    try {
      const updatedDebt = await supabaseService.updateDebt(id, updates);
      setDebts(prev => prev.map(d => d.id === id ? updatedDebt : d));
    } catch (error) {
      console.error('Error updating debt:', error);
      throw error;
    }
  };

  const deleteDebt = async (id: string) => {
    try {
      await supabaseService.deleteDebt(id);
      setDebts(prev => prev.filter(d => d.id !== id));
    } catch (error) {
      console.error('Error deleting debt:', error);
      throw error;
    }
  };

  const addDebtPayment = async (payment: Omit<DebtPayment, 'id'>) => {
    try {
      const newPayment = await supabaseService.createDebtPayment(payment);
      setDebtPayments(prev => [newPayment, ...prev]);

      // Update debt remaining amount
      const debt = debts.find(d => d.id === payment.debtId);
      if (debt) {
        await updateDebt(payment.debtId, {
          remainingAmount: debt.remainingAmount - payment.principal
        });
      }
    } catch (error) {
      console.error('Error adding debt payment:', error);
      throw error;
    }
  };

  // Recurring transactions logic
  const generateRecurringTransactions = () => {
    if (!user) return;

    const now = new Date();
    const recurringTransactions = transactions.filter(t => t.isRecurring && t.recurringPattern?.isActive);
    const occurrenceExists = (template: Transaction, date: Date, accountId = template.accountId) =>
      transactions.some(transaction =>
        !transaction.isRecurring &&
        transaction.accountId === accountId &&
        transaction.categoryId === template.categoryId &&
        transaction.type === template.type &&
        transaction.amount === template.amount &&
        transaction.description === template.description &&
        isSameDay(transaction.date, date)
      );

    recurringTransactions.forEach(template => {
      const pattern = template.recurringPattern!;

      let skippedPastOccurrence = false;
      while (isBefore(startOfDay(pattern.nextDate), startOfDay(now))) {
        if (pattern.endDate && isAfter(pattern.nextDate, pattern.endDate)) break;

        const nextDate = getNextRecurringDate(pattern.nextDate, pattern);
        if (!nextDate || !isAfter(nextDate, pattern.nextDate)) break;

        pattern.nextDate = nextDate;
        skippedPastOccurrence = true;
      }

      if (skippedPastOccurrence) {
        updateTransaction(template.id, {
          recurringPattern: {
            ...pattern,
            nextDate: pattern.nextDate,
          },
        });
      }

      // Generate only the occurrence due today after 00:01. Older missed occurrences
      // are skipped to avoid mutating a bank-reconciled balance retroactively.
      while (isSameDay(pattern.nextDate, now) && !isAfter(getAutoCompletionDate(pattern.nextDate), now)) {
        // Check if we've reached the end date or max occurrences
        if (pattern.endDate && isAfter(pattern.nextDate, pattern.endDate)) break;
        if (pattern.maxOccurrences && pattern.currentOccurrence && pattern.currentOccurrence >= pattern.maxOccurrences) break;

        // Generate new transaction
        const newTransactionData = {
          ...template,
          date: new Date(pattern.nextDate),
          status: 'completed' as const,
          isRecurring: false, // Generated transactions are not recurring themselves
          recurringPattern: undefined,
        };

        // Create transaction in Supabase
        if (!occurrenceExists(template, pattern.nextDate)) {
          addTransaction(newTransactionData);
        }
        if (template.type === 'transfer' && template.transferToAccountId) {
          const fromAccount = accountsRef.current.find(account => account.id === template.accountId);
          const transferInDescription = `Virement depuis ${fromAccount?.name || 'compte'} - ${template.description.replace(/^Virement vers .+? - /, '')}`;
          const transferInExists = transactions.some(transaction =>
            !transaction.isRecurring &&
            transaction.accountId === template.transferToAccountId &&
            transaction.categoryId === template.categoryId &&
            transaction.type === template.type &&
            transaction.amount === template.amount &&
            transaction.description === transferInDescription &&
            isSameDay(transaction.date, pattern.nextDate)
          );

          if (!transferInExists) {
            addTransaction({
              ...newTransactionData,
              accountId: template.transferToAccountId,
              description: transferInDescription,
              transferToAccountId: template.accountId,
            });
          }
        }

        // Calculate next occurrence
        let nextDate: Date;
        switch (pattern.frequency) {
          case 'daily':
            nextDate = addDays(pattern.nextDate, pattern.interval);
            break;
          case 'weekly':
            nextDate = addWeeks(pattern.nextDate, pattern.interval);
            break;
          case 'monthly':
            nextDate = addMonths(pattern.nextDate, pattern.interval);
            break;
          case 'quarterly':
            nextDate = addMonths(pattern.nextDate, pattern.interval * 3);
            break;
          case 'yearly':
            nextDate = addYears(pattern.nextDate, pattern.interval);
            break;
          default:
            nextDate = addMonths(pattern.nextDate, 1);
        }

        // Update the recurring pattern
        const updatedPattern: RecurringPattern = {
          ...pattern,
          nextDate,
          lastGenerated: new Date(),
          currentOccurrence: (pattern.currentOccurrence || 0) + 1,
        };

        // Update the template transaction
        updateTransaction(template.id, {
          recurringPattern: updatedPattern,
        });

        pattern.nextDate = nextDate;
        pattern.currentOccurrence = updatedPattern.currentOccurrence;
      }
    });
  };

  // Calendar events
  const getCalendarEvents = (startDate: Date, endDate: Date): CalendarEvent[] => {
    const events: CalendarEvent[] = [];

    // Add transactions
    transactions
      .filter(t => !t.isRecurring && t.date >= startDate && t.date <= endDate)
      .concat(getProjectedRecurringTransactions(startDate, endDate))
      .forEach(transaction => {
        const category = categories.find(c => c.id === transaction.categoryId);
        events.push({
          id: `transaction-${transaction.id}`,
          date: transaction.date,
          type: 'transaction',
          title: transaction.description,
          amount: transaction.amount,
          status: transaction.status === 'completed' ? 'completed' : 'pending',
          categoryId: transaction.categoryId,
          color: category?.color,
          relatedId: transaction.id,
        });
      });

    // Add savings goal deadlines
    savingsGoals
      .filter(g => g.deadline && g.deadline >= startDate && g.deadline <= endDate && !g.isCompleted)
      .forEach(goal => {
        events.push({
          id: `goal-${goal.id}`,
          date: goal.deadline!,
          type: 'goal_deadline',
          title: `Échéance: ${goal.title}`,
          status: 'pending',
          color: goal.color || '#8B5CF6',
          relatedId: goal.id,
        });
      });

    // Add debt payments
    debts
      .filter(d => d.dueDate >= startDate && d.dueDate <= endDate && d.isActive)
      .forEach(debt => {
        events.push({
          id: `debt-${debt.id}`,
          date: debt.dueDate,
          type: 'debt_payment',
          title: `Paiement: ${debt.name}`,
          amount: debt.minimumPayment,
          status: 'pending',
          color: '#EF4444',
          relatedId: debt.id,
        });
      });

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  };

  // Analytics functions
  const getFinancialSummary = (startDate: Date, endDate: Date): FinancialSummary => {
    const periodTransactions = transactions.filter(t => 
      t.date >= startDate && t.date <= endDate &&
      !isExcludedFromReports(t) &&
      (selectedAccountIds.length === 0 || selectedAccountIds.includes(t.accountId))
    );

    const income = {
      total: periodTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0),
      byCategory: periodTransactions
        .filter(t => t.type === 'income')
        .reduce((acc, t) => {
          const category = categories.find(c => c.id === t.categoryId);
          const categoryName = category?.name || 'Sans catégorie';
          acc[categoryName] = (acc[categoryName] || 0) + t.amount;
          return acc;
        }, {} as Record<string, number>)
    };

    const expenses = {
      total: periodTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0),
      byCategory: periodTransactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
          const category = categories.find(c => c.id === t.categoryId);
          const categoryName = category?.name || 'Sans catégorie';
          acc[categoryName] = (acc[categoryName] || 0) + t.amount;
          return acc;
        }, {} as Record<string, number>)
    };

    const savings = {
      total: periodTransactions
        .filter(t => t.type === 'savings')
        .reduce((sum, t) => sum + t.amount, 0),
      byGoal: savingsGoals.reduce((acc, goal) => {
        acc[goal.title] = goal.currentAmount;
        return acc;
      }, {} as Record<string, number>)
    };

    const netWorth = accounts
      .filter(a => selectedAccountIds.length === 0 || selectedAccountIds.includes(a.id))
      .reduce((sum, a) => sum + a.balance, 0) - 
      debts.reduce((sum, d) => sum + d.remainingAmount, 0);

    const cashFlow = getCashFlowProjection(12);

    const budgetPerformance = budgets
      .filter(b => b.isActive)
      .map(budget => {
        const spent = periodTransactions
          .filter(t => t.categoryId === budget.categoryId && t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0);
        
        return {
          categoryId: budget.categoryId,
          budgeted: budget.amount,
          spent,
          remaining: budget.amount - spent,
          percentage: budget.amount > 0 ? (spent / budget.amount) * 100 : 0,
        };
      });

    return {
      period: { start: startDate, end: endDate },
      income,
      expenses,
      savings,
      netWorth,
      cashFlow,
      budgetPerformance
    };
  };

  const getCashFlowProjection = (months: number, startDateParam?: Date, monthStartDay?: number): CashFlow[] => {
    const projections: CashFlow[] = [];
    const selectedAccountSet = new Set(selectedAccountIds);
    const today = startOfDay(new Date());
    const projectionStartDate = startOfDay(startDateParam ?? new Date());
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
          transaction.date.toISOString().split('T')[0],
        ].join('|'))
      );

      const scheduledTransactions = getScheduledTransactions(monthStart, monthEnd)
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
            t.date.toISOString().split('T')[0],
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
          t.date.toISOString().split('T')[0],
        ].join('|'))
      );
      const actualMonthTransactionKeys = new Set(
        monthTransactions
          .concat(scheduledTransactions, pendingTransactions)
          .map(transaction => [
            transaction.accountId,
            transaction.categoryId,
            transaction.type,
            transaction.amount,
            transaction.description.trim().toLowerCase(),
            transaction.date.toISOString().split('T')[0],
          ].join('|'))
      );
      const projectedRecurringTransactions = getProjectedRecurringTransactions(monthStart, monthEnd)
        .filter(t =>
          !isExcludedFromReports(t) &&
          cashFlowAccountIds.has(t.accountId) &&
          !actualMonthTransactionKeys.has([
            t.accountId,
            t.categoryId,
            t.type,
            t.amount,
            t.description.trim().toLowerCase(),
            t.date.toISOString().split('T')[0],
          ].join('|'))
        );
      const plannedTransactions = scheduledTransactions.concat(pendingTransactions, projectedRecurringTransactions);
      const visibleMonthTransactions = monthTransactions.concat(plannedTransactions);
      const cashMovementTransactions = i === 0
        ? plannedTransactions
        : monthTransactions.concat(plannedTransactions);
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

          if (dueDate > monthEnd || (i === 0 && dueDate < today)) return sum;
          return sum + Math.min(debt.minimumPayment, debt.remainingAmount);
        }, 0);

      const income = cashMovementTransactions
        .filter(t => t.type === 'income' || t.type === 'refund' || t.type === 'savings_withdrawal')
        .reduce((sum, t) => sum + t.amount, 0);
      const transferOutToExternalAccounts = cashMovementTransactions
        .filter(t =>
          t.type === 'transfer' &&
          cashFlowAccountIds.has(t.accountId) &&
          t.transferToAccountId &&
          !cashFlowAccountIds.has(t.transferToAccountId) &&
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

      const totalOutflows = baseExpenses + debtPaymentsForMonth + transferOutToExternalAccounts + budgetReserve + savings;
      const balance = income - totalOutflows;
      const projectedBalance = i === 0 ? openingBalance + balance : projections[i - 1].projectedBalance + balance;
      const projectedSavingsBalance = i === 0
        ? openingSavingsBalance + savings + transferOutToSavingsAccounts
        : (projections[i - 1].projectedSavingsBalance || openingSavingsBalance) + savings + transferOutToSavingsAccounts;
      const projectedTotalBalance = projectedBalance + projectedSavingsBalance;

      projections.push({
        date: monthStart,
        income,
        expenses: totalOutflows,
        savings,
        balance,
        projectedBalance,
        openingBalance: i === 0 ? openingBalance : projections[i - 1].projectedBalance,
        projectedSavingsBalance,
        projectedTotalBalance,
        baseExpenses,
        debtPayments: debtPaymentsForMonth,
        transfersOut: transferOutToExternalAccounts,
        budgetReserve,
        scheduledTransactions: plannedTransactions
      });
    }

    return projections;
  };

  // Export function
  const exportData = async (options: ExportOptions): Promise<string> => {
    const { format: exportFormat, dateRange, includeCategories, includeAccounts, includeGoals, includeDebts, includeRecurring } = options;
    
    const filteredTransactions = transactions.filter(t => 
      t.date >= dateRange.start && t.date <= dateRange.end
    );

    const data = {
      transactions: filteredTransactions,
      ...(includeCategories && { categories }),
      ...(includeAccounts && { accounts }),
      ...(includeGoals && { savingsGoals }),
      ...(includeDebts && { debts, debtPayments }),
      ...(includeRecurring && { recurringTransactions: transactions.filter(t => t.isRecurring) }),
      exportDate: new Date().toISOString(),
      dateRange,
    };

    switch (exportFormat) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        // Simple CSV export for transactions
        const csvHeaders = ['Date', 'Description', 'Amount', 'Type', 'Category', 'Account'];
        const csvRows = filteredTransactions.map(t => {
          const category = categories.find(c => c.id === t.categoryId)?.name || '';
          const account = accounts.find(a => a.id === t.accountId)?.name || '';
          return [
            format(t.date, 'yyyy-MM-dd'),
            t.description,
            t.amount.toString(),
            t.type,
            category,
            account
          ].join(',');
        });
        return [csvHeaders.join(','), ...csvRows].join('\n');
      case 'pdf':
        // For PDF, return a formatted text that could be converted to PDF
        return `Budget Export - ${format(dateRange.start, 'dd/MM/yyyy')} to ${format(dateRange.end, 'dd/MM/yyyy')}\n\n${JSON.stringify(data, null, 2)}`;
      default:
        return JSON.stringify(data, null, 2);
    }
  };

  return (
    <BudgetContext.Provider value={{
      // Data
      transactions,
      categories,
      accounts,
      budgets,
      savingsGoals,
      debts,
      debtPayments,
      
      // Transactions
      addTransaction,
      updateTransaction,
      deleteTransaction,
      generateRecurringTransactions,
      getScheduledTransactions,
      getProjectedRecurringTransactions,
      
      // Categories
      addCategory,
      updateCategory,
      deleteCategory,
      reorderCategories,
      
      // Accounts
      addAccount,
      updateAccount,
      deleteAccount,
      transferBetweenAccounts,
      
      // Budgets
      setBudget,
      deleteBudget,
      
      // Savings Goals
      addSavingsGoal,
      updateSavingsGoal,
      deleteSavingsGoal,
      contributeToGoal,
      
      // Debts
      addDebt,
      updateDebt,
      deleteDebt,
      addDebtPayment,
      
      // Analytics
      getFinancialSummary,
      getCashFlowProjection,
      getCalendarEvents,
      
      // Export
      exportData,
      
      // Filters
      currentPeriod,
      setCurrentPeriod: (start: Date, end: Date) => setCurrentPeriod({ start, end }),
      selectedAccountIds,
      setSelectedAccountIds,
      reloadAll,
    }}>
      {children}
    </BudgetContext.Provider>
  );
};
