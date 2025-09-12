import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
  isSameDay
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
  { name: 'Logement', icon: 'Home', color: '#3B82F6', type: 'expense', order: 1, isActive: true, budget: 1200 },
  { name: 'Alimentation', icon: 'ShoppingCart', color: '#10B981', type: 'expense', order: 2, isActive: true, budget: 400 },
  { name: 'Transport', icon: 'Car', color: '#F59E0B', type: 'expense', order: 3, isActive: true, budget: 200 },
  { name: 'Loisirs', icon: 'Gamepad2', color: '#8B5CF6', type: 'expense', order: 4, isActive: true, budget: 150 },
  { name: 'Santé', icon: 'Heart', color: '#EF4444', type: 'expense', order: 5, isActive: true, budget: 100 },
  { name: 'Vêtements', icon: 'Shirt', color: '#EC4899', type: 'expense', order: 6, isActive: true, budget: 100 },
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

const defaultAccounts: Omit<BankAccount, 'id' | 'userId'>[] = [
  { name: 'Compte courant', type: 'checking', balance: 2500, currency: 'EUR', color: '#3B82F6', isActive: true, order: 1 },
  { name: 'Livret A', type: 'savings', balance: 5000, currency: 'EUR', color: '#10B981', isActive: true, order: 2 },
  { name: 'Espèces', type: 'cash', balance: 150, currency: 'EUR', color: '#F59E0B', isActive: true, order: 3 },
];

interface BudgetProviderProps {
  children: ReactNode;
}

export const BudgetProvider: React.FC<BudgetProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtPayments, setDebtPayments] = useState<DebtPayment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<'pending' | 'completed' | 'error'>('pending');
  
  // Filters
  const [currentPeriod, setCurrentPeriod] = useState({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date())
  });
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      console.log('💰 User detected, loading budget data...');
      loadUserData();
    } else {
      // Clear data when user logs out
      console.log('🔄 Clearing budget data after logout');
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
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;

    console.log('💰 Loading budget data for user:', user.email);
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
        supabaseService.getAccounts(user.id),
        supabaseService.getCategories(user.id),
        supabaseService.getTransactions(user.id),
        supabaseService.getBudgets(user.id),
        supabaseService.getSavingsGoals(user.id),
        supabaseService.getDebts(user.id),
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
          supabaseService.getAccounts(user.id),
          supabaseService.getCategories(user.id),
          supabaseService.getTransactions(user.id),
          supabaseService.getBudgets(user.id),
          supabaseService.getSavingsGoals(user.id),
          supabaseService.getDebts(user.id),
          supabaseService.getDebtPayments()
        ]);

        setAccounts(newAccounts);
        setCategories(newCategories);
        setTransactions(newTransactions);
        setBudgets(newBudgets);
        setSavingsGoals(newSavingsGoals);
        setDebts(newDebts);
        setDebtPayments(newDebtPayments);
      } else {
        console.log('✅ Using existing Supabase data');
        setAccounts(supabaseAccounts);
        setCategories(supabaseCategories);
        setTransactions(supabaseTransactions);
        setBudgets(supabaseBudgets);
        setSavingsGoals(supabaseSavingsGoals);
        setDebts(supabaseDebts);
        setDebtPayments(supabaseDebtPayments);
      }

      // Set default selected accounts
      const accountsToSelect = supabaseAccounts.length > 0 ? supabaseAccounts : 
                              accounts.length > 0 ? accounts : [];
      setSelectedAccountIds(accountsToSelect.map(acc => acc.id));
      
      setMigrationStatus('completed');
      console.log('✅ Budget data loaded successfully');

    } catch (error) {
      console.error('❌ Error loading user data:', error);
      setMigrationStatus('error');
    } finally {
      setIsLoading(false);
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
      
      // Create default categories
      for (const categoryData of defaultCategories) {
        await supabaseService.createCategory({
          ...categoryData,
          userId: user.id,
        });
      }

      // Create default accounts
      for (const accountData of defaultAccounts) {
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
          transaction.type === 'income' ? transaction.amount : -transaction.amount
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

      // Update account balances if amount or account changed
      if (updates.amount !== undefined || updates.accountId !== undefined || updates.type !== undefined) {
        // Revert old transaction effect (only if it was completed)
        if (oldTransaction.status === 'completed') {
          await updateAccountBalance(
            oldTransaction.accountId, 
            oldTransaction.type === 'income' ? -oldTransaction.amount : oldTransaction.amount
          );
        }
        
        // Apply new transaction effect (only if it's completed)
        if (updatedTransaction.status === 'completed') {
          await updateAccountBalance(
            updatedTransaction.accountId, 
            updatedTransaction.type === 'income' ? updatedTransaction.amount : -updatedTransaction.amount
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
          transaction.type === 'income' ? -transaction.amount : transaction.amount
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

  // Account functions
  const addAccount = async (account: Omit<BankAccount, 'id' | 'userId'>) => {
    if (!user) return;
    
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
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;

    try {
      const updatedAccount = await supabaseService.updateAccount(accountId, {
        balance: account.balance + amount
      });
      setAccounts(prev => prev.map(a => a.id === accountId ? updatedAccount : a));
    } catch (error) {
      console.error('Error updating account balance:', error);
      throw error;
    }
  };

  const transferBetweenAccounts = async (fromAccountId: string, toAccountId: string, amount: number, description: string) => {
    if (!user) return;

    try {
      // Create transfer transactions
      const transferOut = await supabaseService.createTransaction({
        userId: user.id,
        accountId: fromAccountId,
        amount,
        description: `Virement vers ${accounts.find(a => a.id === toAccountId)?.name} - ${description}`,
        date: new Date(),
        categoryId: 'transfer',
        type: 'transfer',
        status: 'completed',
        isRecurring: false,
        transferToAccountId: toAccountId
      });

      const transferIn = await supabaseService.createTransaction({
        userId: user.id,
        accountId: toAccountId,
        amount,
        description: `Virement depuis ${accounts.find(a => a.id === fromAccountId)?.name} - ${description}`,
        date: new Date(),
        categoryId: 'transfer',
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
    let hasNewTransactions = false;

    const updatedTransactions = [...transactions];

    recurringTransactions.forEach(template => {
      const pattern = template.recurringPattern!;
      
      // Check if we need to generate new transactions
      while (isBefore(pattern.nextDate, now) || isSameDay(pattern.nextDate, now)) {
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
        addTransaction(newTransactionData);
        hasNewTransactions = true;

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
      .filter(t => t.date >= startDate && t.date <= endDate)
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

  const getCashFlowProjection = (months: number): CashFlow[] => {
    const projections: CashFlow[] = [];
    const startDate = new Date();
    
    for (let i = 0; i < months; i++) {
      const monthStart = addMonths(startDate, i);
      const monthEnd = endOfMonth(monthStart);
      
      const monthTransactions = transactions.filter(t => 
        t.date >= monthStart && t.date <= monthEnd &&
        (selectedAccountIds.length === 0 || selectedAccountIds.includes(t.accountId))
      );

      const scheduledTransactions = getScheduledTransactions(monthStart, monthEnd);

      const income = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0) +
        scheduledTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
        
      const expenses = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0) +
        scheduledTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
        
      const savings = monthTransactions
        .filter(t => t.type === 'savings')
        .reduce((sum, t) => sum + t.amount, 0) +
        scheduledTransactions
        .filter(t => t.type === 'savings')
        .reduce((sum, t) => sum + t.amount, 0);

      const balance = income - expenses - savings;
      const projectedBalance = i === 0 ? balance : projections[i - 1].projectedBalance + balance;

      projections.push({
        date: monthStart,
        income,
        expenses,
        savings,
        balance,
        projectedBalance,
        scheduledTransactions
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
