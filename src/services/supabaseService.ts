import { supabase } from '../lib/supabase';
import { 
  Transaction, 
  Category, 
  BankAccount, 
  Budget, 
  SavingsGoal, 
  Debt, 
  DebtPayment 
} from '../types';

// Helper function to convert database row to app format
const convertDatabaseToApp = {
  account: (row: any): BankAccount => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
    balance: parseFloat(row.balance),
    currency: row.currency,
    color: row.color,
    isActive: row.is_active,
    order: row.order_index,
    bankName: row.bank_name,
    description: row.description,
  }),

  category: (row: any): Category => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    type: row.type,
    parentId: row.parent_id,
    order: row.order_index,
    isActive: row.is_active,
    budget: row.budget ? parseFloat(row.budget) : undefined,
    description: row.description,
  }),

  transaction: (row: any): Transaction => ({
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    amount: parseFloat(row.amount),
    description: row.description,
    date: new Date(row.date),
    categoryId: row.category_id,
    type: row.type,
    status: row.status,
    isRecurring: row.is_recurring,
    recurringPattern: row.recurring_pattern ? {
      ...row.recurring_pattern,
      nextDate: new Date(row.recurring_pattern.nextDate),
      endDate: row.recurring_pattern.endDate ? new Date(row.recurring_pattern.endDate) : undefined,
      lastGenerated: row.recurring_pattern.lastGenerated ? new Date(row.recurring_pattern.lastGenerated) : undefined,
    } : undefined,
    memo: row.memo,
    tags: row.tags,
    transferToAccountId: row.transfer_to_account_id,
    isChecked: row.is_checked,
  }),

  savingsGoal: (row: any): SavingsGoal => ({
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    targetAmount: parseFloat(row.target_amount),
    currentAmount: parseFloat(row.current_amount),
    deadline: row.deadline ? new Date(row.deadline) : undefined,
    categoryId: row.category_id,
    accountId: row.account_id,
    priority: row.priority,
    isCompleted: row.is_completed,
    createdAt: new Date(row.created_at),
    color: row.color,
    autoContribution: row.auto_contribution,
  }),

  debt: (row: any): Debt => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    totalAmount: parseFloat(row.total_amount),
    remainingAmount: parseFloat(row.remaining_amount),
    interestRate: parseFloat(row.interest_rate),
    minimumPayment: parseFloat(row.minimum_payment),
    dueDate: new Date(row.due_date),
    accountId: row.account_id,
    categoryId: row.category_id,
    type: row.type,
    isActive: row.is_active,
    creditor: row.creditor,
    description: row.description,
    paymentDay: row.payment_day,
  }),

  debtPayment: (row: any): DebtPayment => ({
    id: row.id,
    debtId: row.debt_id,
    amount: parseFloat(row.amount),
    date: new Date(row.date),
    principal: parseFloat(row.principal),
    interest: parseFloat(row.interest),
    transactionId: row.transaction_id,
    paymentMethod: row.payment_method,
  }),

  budget: (row: any): Budget => ({
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    amount: parseFloat(row.amount),
    period: row.period,
    startDate: new Date(row.start_date),
    endDate: row.end_date ? new Date(row.end_date) : undefined,
    isActive: row.is_active,
    alertThreshold: row.alert_threshold,
    rollover: row.rollover,
  }),
};

// Helper function to convert app format to database format
const convertAppToDatabase = {
  account: (account: Omit<BankAccount, 'id'> | Partial<BankAccount>): any => ({
    user_id: account.userId,
    name: account.name,
    type: account.type,
    balance: account.balance,
    currency: account.currency,
    color: account.color,
    is_active: account.isActive,
    order_index: account.order,
    bank_name: account.bankName,
    description: account.description,
  }),

  category: (category: Omit<Category, 'id'> | Partial<Category>): any => ({
    user_id: category.userId,
    name: category.name,
    icon: category.icon,
    color: category.color,
    type: category.type,
    parent_id: category.parentId,
    order_index: category.order,
    is_active: category.isActive,
    budget: category.budget,
    description: category.description,
  }),

  transaction: (transaction: Omit<Transaction, 'id'> | Partial<Transaction>): any => ({
    user_id: transaction.userId,
    account_id: transaction.accountId,
    amount: transaction.amount,
    description: transaction.description,
    date: transaction.date?.toISOString().split('T')[0],
    category_id: transaction.categoryId,
    type: transaction.type,
    status: transaction.status,
    is_recurring: transaction.isRecurring,
    recurring_pattern: transaction.recurringPattern ? {
      ...transaction.recurringPattern,
      nextDate: transaction.recurringPattern.nextDate.toISOString(),
      endDate: transaction.recurringPattern.endDate?.toISOString(),
      lastGenerated: transaction.recurringPattern.lastGenerated?.toISOString(),
    } : null,
    memo: transaction.memo,
    tags: transaction.tags,
    transfer_to_account_id: transaction.transferToAccountId,
    is_checked: transaction.isChecked,
  }),

  savingsGoal: (goal: Omit<SavingsGoal, 'id' | 'createdAt'> | Partial<SavingsGoal>): any => ({
    user_id: goal.userId,
    title: goal.title,
    description: goal.description,
    target_amount: goal.targetAmount,
    current_amount: goal.currentAmount,
    deadline: goal.deadline?.toISOString().split('T')[0],
    category_id: goal.categoryId,
    account_id: goal.accountId,
    priority: goal.priority,
    is_completed: goal.isCompleted,
    color: goal.color,
    auto_contribution: goal.autoContribution,
  }),

  debt: (debt: Omit<Debt, 'id'> | Partial<Debt>): any => ({
    user_id: debt.userId,
    name: debt.name,
    total_amount: debt.totalAmount,
    remaining_amount: debt.remainingAmount,
    interest_rate: debt.interestRate,
    minimum_payment: debt.minimumPayment,
    due_date: debt.dueDate?.toISOString().split('T')[0],
    account_id: debt.accountId,
    category_id: debt.categoryId,
    type: debt.type,
    is_active: debt.isActive,
    creditor: debt.creditor,
    description: debt.description,
    payment_day: debt.paymentDay,
  }),

  debtPayment: (payment: Omit<DebtPayment, 'id'>): any => ({
    debt_id: payment.debtId,
    amount: payment.amount,
    date: payment.date.toISOString().split('T')[0],
    principal: payment.principal,
    interest: payment.interest,
    transaction_id: payment.transactionId,
    payment_method: payment.paymentMethod,
  }),

  budget: (budget: Omit<Budget, 'id'> | Partial<Budget>): any => ({
    user_id: budget.userId,
    category_id: budget.categoryId,
    amount: budget.amount,
    period: budget.period,
    start_date: budget.startDate?.toISOString().split('T')[0],
    end_date: budget.endDate?.toISOString().split('T')[0],
    is_active: budget.isActive,
    alert_threshold: budget.alertThreshold,
    rollover: budget.rollover,
  }),
};

// Service functions
export const supabaseService = {
  // Accounts
  async getAccounts(userId: string): Promise<BankAccount[]> {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .order('order_index');

    if (error) throw error;
    return data.map(convertDatabaseToApp.account);
  },

  async createAccount(account: Omit<BankAccount, 'id'>): Promise<BankAccount> {
    const { data, error } = await supabase
      .from('accounts')
      .insert(convertAppToDatabase.account(account))
      .select()
      .single();

    if (error) throw error;
    return convertDatabaseToApp.account(data);
  },

  async updateAccount(id: string, updates: Partial<BankAccount>): Promise<BankAccount> {
    const cleanedUpdates = Object.fromEntries(
      Object.entries(convertAppToDatabase.account(updates)).filter(([_, v]) => v !== undefined)
    );

    const { data, error } = await supabase
      .from('accounts')
      .update(cleanedUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return convertDatabaseToApp.account(data);
  },

  async deleteAccount(id: string): Promise<void> {
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Categories
  async getCategories(userId: string): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('order_index');

    if (error) throw error;
    return data.map(convertDatabaseToApp.category);
  },

  async createCategory(category: Omit<Category, 'id'>): Promise<Category> {
    const { data, error } = await supabase
      .from('categories')
      .insert(convertAppToDatabase.category(category))
      .select()
      .single();

    if (error) throw error;
    return convertDatabaseToApp.category(data);
  },

  async updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
    const cleanedUpdates = Object.fromEntries(
      Object.entries(convertAppToDatabase.category(updates)).filter(([_, v]) => v !== undefined)
    );

    const { data, error } = await supabase
      .from('categories')
      .update(cleanedUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return convertDatabaseToApp.category(data);
  },

  async deleteCategory(id: string): Promise<void> {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Transactions
  async getTransactions(userId: string): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) throw error;
    return data.map(convertDatabaseToApp.transaction);
  },

  async createTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .insert(convertAppToDatabase.transaction(transaction))
      .select()
      .single();

    if (error) throw error;
    return convertDatabaseToApp.transaction(data);
  },

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const cleanedUpdates = Object.fromEntries(
      Object.entries(convertAppToDatabase.transaction(updates)).filter(([_, v]) => v !== undefined)
    );

    const { data, error } = await supabase
      .from('transactions')
      .update(cleanedUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return convertDatabaseToApp.transaction(data);
  },

  async deleteTransaction(id: string): Promise<void> {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Savings Goals
  async getSavingsGoals(userId: string): Promise<SavingsGoal[]> {
    const { data, error } = await supabase
      .from('savings_goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data.map(convertDatabaseToApp.savingsGoal);
  },

  async createSavingsGoal(goal: Omit<SavingsGoal, 'id' | 'createdAt'>): Promise<SavingsGoal> {
    const { data, error } = await supabase
      .from('savings_goals')
      .insert(convertAppToDatabase.savingsGoal(goal))
      .select()
      .single();

    if (error) throw error;
    return convertDatabaseToApp.savingsGoal(data);
  },

  async updateSavingsGoal(id: string, updates: Partial<SavingsGoal>): Promise<SavingsGoal> {
    const cleanedUpdates = Object.fromEntries(
      Object.entries(convertAppToDatabase.savingsGoal(updates)).filter(([_, v]) => v !== undefined)
    );

    const { data, error } = await supabase
      .from('savings_goals')
      .update(cleanedUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return convertDatabaseToApp.savingsGoal(data);
  },

  async deleteSavingsGoal(id: string): Promise<void> {
    const { error } = await supabase
      .from('savings_goals')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Debts
  async getDebts(userId: string): Promise<Debt[]> {
    const { data, error } = await supabase
      .from('debts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data.map(convertDatabaseToApp.debt);
  },

  async createDebt(debt: Omit<Debt, 'id'>): Promise<Debt> {
    const { data, error } = await supabase
      .from('debts')
      .insert(convertAppToDatabase.debt(debt))
      .select()
      .single();

    if (error) throw error;
    return convertDatabaseToApp.debt(data);
  },

  async updateDebt(id: string, updates: Partial<Debt>): Promise<Debt> {
    const cleanedUpdates = Object.fromEntries(
      Object.entries(convertAppToDatabase.debt(updates)).filter(([_, v]) => v !== undefined)
    );

    const { data, error } = await supabase
      .from('debts')
      .update(cleanedUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return convertDatabaseToApp.debt(data);
  },

  async deleteDebt(id: string): Promise<void> {
    const { error } = await supabase
      .from('debts')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Debt Payments
  async getDebtPayments(): Promise<DebtPayment[]> {
    const { data, error } = await supabase
      .from('debt_payments')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw error;
    return data.map(convertDatabaseToApp.debtPayment);
  },

  async createDebtPayment(payment: Omit<DebtPayment, 'id'>): Promise<DebtPayment> {
    const { data, error } = await supabase
      .from('debt_payments')
      .insert(convertAppToDatabase.debtPayment(payment))
      .select()
      .single();

    if (error) throw error;
    return convertDatabaseToApp.debtPayment(data);
  },

  // Budgets
  async getBudgets(userId: string): Promise<Budget[]> {
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data.map(convertDatabaseToApp.budget);
  },

  async createBudget(budget: Omit<Budget, 'id'>): Promise<Budget> {
    const { data, error } = await supabase
      .from('budgets')
      .insert(convertAppToDatabase.budget(budget))
      .select()
      .single();

    if (error) throw error;
    return convertDatabaseToApp.budget(data);
  },

  async updateBudget(id: string, updates: Partial<Budget>): Promise<Budget> {
    const cleanedUpdates = Object.fromEntries(
      Object.entries(convertAppToDatabase.budget(updates)).filter(([_, v]) => v !== undefined)
    );

    const { data, error } = await supabase
      .from('budgets')
      .update(cleanedUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return convertDatabaseToApp.budget(data);
  },

  async deleteBudget(id: string): Promise<void> {
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Migration helper
  async migrateFromIndexedDB(userId: string, data: any): Promise<void> {
    try {
      // Migrate categories first (they're referenced by transactions)
      if (data.categories?.length > 0) {
        for (const category of data.categories) {
          await this.createCategory({
            ...category,
            userId,
          });
        }
      }

      // Migrate accounts
      if (data.accounts?.length > 0) {
        for (const account of data.accounts) {
          await this.createAccount({
            ...account,
            userId,
          });
        }
      }

      // Migrate transactions
      if (data.transactions?.length > 0) {
        for (const transaction of data.transactions) {
          await this.createTransaction({
            ...transaction,
            userId,
          });
        }
      }

      // Migrate savings goals
      if (data.savingsGoals?.length > 0) {
        for (const goal of data.savingsGoals) {
          await this.createSavingsGoal({
            ...goal,
            userId,
          });
        }
      }

      // Migrate debts
      if (data.debts?.length > 0) {
        for (const debt of data.debts) {
          await this.createDebt({
            ...debt,
            userId,
          });
        }
      }

      // Migrate debt payments
      if (data.debtPayments?.length > 0) {
        for (const payment of data.debtPayments) {
          await this.createDebtPayment(payment);
        }
      }

      // Migrate budgets
      if (data.budgets?.length > 0) {
        for (const budget of data.budgets) {
          await this.createBudget({
            ...budget,
            userId,
          });
        }
      }

      console.log('Migration from IndexedDB completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  },
};