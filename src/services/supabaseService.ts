import { supabase, type Database } from '../lib/supabase';
import { 
  Transaction, 
  Category, 
  BankAccount, 
  Budget, 
  SavingsGoal, 
  Debt, 
  DebtPayment 
} from '../types';

type StoredValue<T> = T extends Date ? string : T extends (infer U)[] ? StoredValue<U>[] : T extends object ? { [K in keyof T]: StoredValue<T[K]> } : T;
type Row<T extends keyof Database['public']['Tables']> = { [K in keyof Database['public']['Tables'][T]['Row']]: Exclude<Database['public']['Tables'][T]['Row'][K], null> };
type AccountRow = Omit<Row<'accounts'>, 'type'> & { type: BankAccount['type'] };
type CategoryRow = Omit<Row<'categories'>, 'type'> & { type: Category['type']; exclude_from_reports?: boolean };
type TransactionRow = Omit<Row<'transactions'>, 'type' | 'status' | 'recurring_pattern'> & { type: Transaction['type']; status: Transaction['status']; recurring_pattern?: StoredValue<Transaction['recurringPattern']> };
type GoalRow = Omit<Row<'savings_goals'>, 'priority' | 'auto_contribution'> & { priority: SavingsGoal['priority']; auto_contribution?: SavingsGoal['autoContribution'] };
type DebtRow = Omit<Row<'debts'>, 'type'> & { type: Debt['type']; end_date?: string };
type BudgetRow = Omit<Row<'budgets'>, 'period'> & { period: Budget['period'] };

// Helper function to convert database row to app format
const convertDatabaseToApp = {
  account: (row: AccountRow): BankAccount => {
    let subType: string | undefined = undefined;
    let totalDeposits: number | undefined = undefined;
    let openingDate: string | undefined = undefined;
    let cashBalance: number | undefined = undefined;
    let cleanDesc: string | undefined = row.description;

    if (row.description && typeof row.description === 'string' && row.description.includes('__META__:')) {
      try {
        const parts = row.description.split('__META__:');
        cleanDesc = parts[0].trim() || undefined;
        const meta = JSON.parse(parts[1]);
        subType = meta.subType;
        totalDeposits = meta.totalDeposits !== undefined ? Number(meta.totalDeposits) : undefined;
        openingDate = meta.openingDate;
        cashBalance = meta.cashBalance !== undefined ? Number(meta.cashBalance) : undefined;
      } catch { /* Malformed optional metadata or dates are ignored. */ }
    }

    const nameLower = (row.name || '').toLowerCase();
    if (!subType) {
      if (nameLower.includes('pea')) subType = 'pea';
      else if (nameLower.includes('cto') || nameLower.includes('titres')) subType = 'cto';
      else if (row.type === 'crypto' || nameLower.includes('crypto')) subType = 'crypto';
    }

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      type: row.type,
      balance: Number(row.balance),
      currency: row.currency,
      color: row.color,
      isActive: row.is_active,
      order: row.order_index,
      bankName: row.bank_name,
      description: cleanDesc,
      subType,
      totalDeposits,
      openingDate,
      cashBalance,
    };
  },

  category: (row: CategoryRow): Category => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    type: row.type,
    parentId: row.parent_id,
    order: row.order_index,
    isActive: row.is_active,
    budget: row.budget ? Number(row.budget) : undefined,
    description: row.description,
    excludeFromReports: row.exclude_from_reports || false,
  }),

  transaction: (row: TransactionRow): Transaction => ({
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    amount: Number(row.amount),
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
    isShared: row.tags?.includes('shared') ? true : row.tags?.includes('excluded_shared') ? false : undefined,
    isHouseholdContribution: Boolean(row.tags?.includes('foyer_contribution')),
  }),

  savingsGoal: (row: GoalRow): SavingsGoal => ({
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    targetAmount: Number(row.target_amount),
    currentAmount: Number(row.current_amount),
    deadline: row.deadline ? new Date(row.deadline) : undefined,
    categoryId: row.category_id,
    accountId: row.account_id,
    priority: row.priority,
    isCompleted: row.is_completed,
    createdAt: new Date(row.created_at),
    color: row.color,
    autoContribution: row.auto_contribution,
  }),

  debt: (row: DebtRow): Debt => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    totalAmount: Number(row.total_amount),
    remainingAmount: Number(row.remaining_amount),
    interestRate: Number(row.interest_rate),
    minimumPayment: Number(row.minimum_payment),
    dueDate: new Date(row.due_date),
    accountId: row.account_id,
    categoryId: row.category_id,
    type: row.type,
    isActive: row.is_active,
    creditor: row.creditor,
    description: row.description,
    paymentDay: row.payment_day,
    endDate: row.end_date ? new Date(row.end_date) : undefined,
  }),

  debtPayment: (row: Row<'debt_payments'>): DebtPayment => ({
    id: row.id,
    debtId: row.debt_id,
    amount: Number(row.amount),
    date: new Date(row.date),
    principal: Number(row.principal),
    interest: Number(row.interest),
    transactionId: row.transaction_id,
    paymentMethod: row.payment_method,
  }),

  budget: (row: BudgetRow): Budget => ({
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    amount: Number(row.amount),
    period: row.period,
    startDate: new Date(row.start_date),
    endDate: row.end_date ? new Date(row.end_date) : undefined,
    isActive: row.is_active,
    alertThreshold: row.alert_threshold,
    rollover: row.rollover,
  }),
};

// Helper functions to safely format dates
const formatDateOnly = (d: Date | string | number | undefined): string | undefined => {
  if (!d) return undefined;
  if (typeof d === 'string') return d.split('T')[0];
  if (d instanceof Date && !isNaN(d.getTime())) return d.toISOString().split('T')[0];
  try {
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  } catch { /* Malformed optional metadata or dates are ignored. */ }
  return undefined;
};

const formatIsoDateTime = (d: Date | string | number | undefined): string | undefined => {
  if (!d) return undefined;
  if (typeof d === 'string') return d;
  if (d instanceof Date && !isNaN(d.getTime())) return d.toISOString();
  try {
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  } catch { /* Malformed optional metadata or dates are ignored. */ }
  return undefined;
};

// Helper function to convert app format to database format
const convertAppToDatabase = {
  account: (account: Omit<BankAccount, 'id'> | Partial<BankAccount>) => {
    let desc = account.description;
    const hasMeta = account.subType !== undefined || account.totalDeposits !== undefined || account.openingDate !== undefined || account.cashBalance !== undefined;
    if (hasMeta) {
      const meta = {
        subType: account.subType,
        totalDeposits: account.totalDeposits,
        openingDate: account.openingDate,
        cashBalance: account.cashBalance,
      };
      const cleanDesc = (desc || '').split('__META__:')[0].trim();
      desc = cleanDesc ? `${cleanDesc} __META__:${JSON.stringify(meta)}` : `__META__:${JSON.stringify(meta)}`;
    }

    return {
      user_id: account.userId,
      name: account.name,
      type: account.type,
      balance: account.balance,
      currency: account.currency,
      color: account.color,
      is_active: account.isActive,
      order_index: account.order,
      bank_name: account.bankName,
      description: desc,
    };
  },

  category: (category: Omit<Category, 'id'> | Partial<Category>) => ({
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
    exclude_from_reports: category.excludeFromReports,
  }),

  transaction: (transaction: Omit<Transaction, 'id'> | Partial<Transaction>) => ({
    user_id: transaction.userId,
    account_id: transaction.accountId,
    amount: transaction.amount,
    description: transaction.description,
    date: formatDateOnly(transaction.date),
    category_id: transaction.categoryId,
    type: transaction.type,
    status: transaction.status,
    is_recurring: transaction.isRecurring,
    recurring_pattern: transaction.recurringPattern ? {
      ...transaction.recurringPattern,
      nextDate: formatIsoDateTime(transaction.recurringPattern.nextDate) || '',
      endDate: formatIsoDateTime(transaction.recurringPattern.endDate),
      lastGenerated: formatIsoDateTime(transaction.recurringPattern.lastGenerated),
    } : null,
    memo: transaction.memo,
    tags: (transaction.tags !== undefined || transaction.isShared !== undefined || transaction.isHouseholdContribution !== undefined)
      ? Array.from(new Set([
          ...(transaction.tags || []).filter((t: string) => t !== 'shared' && t !== 'excluded_shared' && t !== 'foyer_contribution'),
          ...(transaction.isShared === true ? ['shared'] : []),
          ...(transaction.isShared === false ? ['excluded_shared'] : []),
          ...(transaction.isHouseholdContribution ? ['foyer_contribution'] : [])
        ]))
      : undefined,
    transfer_to_account_id: transaction.transferToAccountId,
    is_checked: transaction.isChecked,
  }),

  savingsGoal: (goal: Omit<SavingsGoal, 'id' | 'createdAt'> | Partial<SavingsGoal>) => ({
    user_id: goal.userId,
    title: goal.title,
    description: goal.description,
    target_amount: goal.targetAmount,
    current_amount: goal.currentAmount,
    deadline: formatDateOnly(goal.deadline),
    category_id: goal.categoryId,
    account_id: goal.accountId,
    priority: goal.priority,
    is_completed: goal.isCompleted,
    color: goal.color,
    auto_contribution: goal.autoContribution,
  }),

  debt: (debt: Omit<Debt, 'id'> | Partial<Debt>) => ({
    user_id: debt.userId,
    name: debt.name,
    total_amount: debt.totalAmount,
    remaining_amount: debt.remainingAmount,
    interest_rate: debt.interestRate,
    minimum_payment: debt.minimumPayment,
    due_date: formatDateOnly(debt.dueDate),
    account_id: debt.accountId,
    category_id: debt.categoryId,
    type: debt.type,
    is_active: debt.isActive,
    creditor: debt.creditor,
    description: debt.description,
    payment_day: debt.paymentDay,
    end_date: formatDateOnly(debt.endDate),
  }),

  debtPayment: (payment: Omit<DebtPayment, 'id'>) => ({
    debt_id: payment.debtId,
    amount: payment.amount,
    date: formatDateOnly(payment.date) || new Date().toISOString().split('T')[0],
    principal: payment.principal,
    interest: payment.interest,
    transaction_id: payment.transactionId,
    payment_method: payment.paymentMethod,
  }),

  budget: (budget: Omit<Budget, 'id'> | Partial<Budget>) => ({
    user_id: budget.userId,
    category_id: budget.categoryId,
    amount: budget.amount,
    period: budget.period,
    start_date: formatDateOnly(budget.startDate),
    end_date: formatDateOnly(budget.endDate),
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
      Object.entries(convertAppToDatabase.account(updates)).filter(([, v]) => v !== undefined)
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

  // Balance snapshots (daily end-of-day balance per account)
  async getBalanceSnapshots(userId: string): Promise<{ accountId: string; date: string; balance: number }[]> {
    const { data, error } = await supabase
      .from('account_balance_snapshots')
      .select('account_id, snapshot_date, balance')
      .eq('user_id', userId)
      .order('snapshot_date');

    if (error) throw error;
    return (data || []).map((row: { account_id: string; snapshot_date: string; balance: number | string }) => ({
      accountId: row.account_id,
      date: row.snapshot_date,
      balance: Number(row.balance),
    }));
  },

  async upsertBalanceSnapshots(
    userId: string,
    rows: { accountId: string; date: string; balance: number }[]
  ): Promise<void> {
    if (rows.length === 0) return;
    const { error } = await supabase
      .from('account_balance_snapshots')
      .upsert(
        rows.map(r => ({
          user_id: userId,
          account_id: r.accountId,
          snapshot_date: r.date,
          balance: r.balance,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'account_id,snapshot_date' }
      );

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
      Object.entries(convertAppToDatabase.category(updates)).filter(([, v]) => v !== undefined)
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
      Object.entries(convertAppToDatabase.transaction(updates)).filter(([, v]) => v !== undefined)
    );
    if (!Object.prototype.hasOwnProperty.call(updates, 'recurringPattern')) {
      delete cleanedUpdates.recurring_pattern;
    }

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
      Object.entries(convertAppToDatabase.savingsGoal(updates)).filter(([, v]) => v !== undefined)
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
      Object.entries(convertAppToDatabase.debt(updates)).filter(([, v]) => v !== undefined)
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
      Object.entries(convertAppToDatabase.budget(updates)).filter(([, v]) => v !== undefined)
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
  async migrateFromIndexedDB(userId: string, data: { categories?: Category[]; accounts?: BankAccount[]; transactions?: Transaction[]; savingsGoals?: SavingsGoal[]; debts?: Debt[]; debtPayments?: DebtPayment[]; budgets?: Budget[] }): Promise<void> {
    try {
      // Migrate categories first (they're referenced by transactions)
      if (data.categories && data.categories.length > 0) {
        for (const category of data.categories) {
          await this.createCategory({
            ...category,
            userId,
          });
        }
      }

      // Migrate accounts
      if (data.accounts && data.accounts.length > 0) {
        for (const account of data.accounts) {
          await this.createAccount({
            ...account,
            userId,
          });
        }
      }

      // Migrate transactions
      if (data.transactions && data.transactions.length > 0) {
        for (const transaction of data.transactions) {
          await this.createTransaction({
            ...transaction,
            userId,
          });
        }
      }

      // Migrate savings goals
      if (data.savingsGoals && data.savingsGoals.length > 0) {
        for (const goal of data.savingsGoals) {
          await this.createSavingsGoal({
            ...goal,
            userId,
          });
        }
      }

      // Migrate debts
      if (data.debts && data.debts.length > 0) {
        for (const debt of data.debts) {
          await this.createDebt({
            ...debt,
            userId,
          });
        }
      }

      // Migrate debt payments
      if (data.debtPayments && data.debtPayments.length > 0) {
        for (const payment of data.debtPayments) {
          await this.createDebtPayment(payment);
        }
      }

      // Migrate budgets
      if (data.budgets && data.budgets.length > 0) {
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
