export interface User {
  id: string;
  email: string;
  name?: string;
  created_at?: string;
  user_metadata?: {
    name?: string;
  };
  settings?: UserSettings;
}

export interface UserSettings {
  fiscalYearStart: number; // Month (1-12)
  defaultPeriod: 'weekly' | 'monthly' | 'yearly';
  currency: string;
  dateFormat: string;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications: {
    budgetAlerts: boolean;
    recurringReminders: boolean;
    goalDeadlines: boolean;
  };
}

export interface Category {
  id: string;
  userId?: string;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense' | 'savings' | 'debt' | 'bill';
  parentId?: string; // For subcategories
  order: number;
  isActive: boolean;
  budget?: number; // Default budget amount
  description?: string;
}

export interface BankAccount {
  id: string;
  userId: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'investment' | 'cash' | 'crypto';
  balance: number;
  currency: string;
  color: string;
  isActive: boolean;
  order: number;
  bankName?: string;
  accountNumber?: string;
  description?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  amount: number;
  description: string;
  date: Date;
  categoryId: string;
  type: 'income' | 'expense' | 'savings' | 'savings_withdrawal' | 'bill' | 'refund' | 'transfer';
  status: 'pending' | 'completed' | 'cancelled' | 'scheduled';
  isRecurring: boolean;
  recurringPattern?: RecurringPattern;
  memo?: string;
  tags?: string[];
  transferToAccountId?: string; // For transfers between accounts
  isChecked?: boolean; // Manual verification status
  attachments?: string[]; // File URLs
}

export interface RecurringPattern {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // Every X days/weeks/months/years
  endDate?: Date;
  nextDate: Date;
  lastGenerated?: Date;
  isActive: boolean;
  maxOccurrences?: number;
  currentOccurrence?: number;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  amount: number;
  period: 'weekly' | 'monthly' | 'yearly';
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  alertThreshold?: number; // Percentage (0-100)
  rollover?: boolean; // Carry over unused budget
}

export interface SavingsGoal {
  id: string;
  userId: string;
  title: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: Date;
  categoryId?: string;
  accountId?: string;
  priority: 'low' | 'medium' | 'high';
  isCompleted: boolean;
  createdAt: Date;
  color?: string;
  icon?: string;
  autoContribution?: {
    amount: number;
    frequency: 'weekly' | 'monthly';
    accountId: string;
  };
}

export interface Debt {
  id: string;
  userId: string;
  name: string;
  totalAmount: number;
  remainingAmount: number;
  interestRate: number;
  minimumPayment: number;
  dueDate: Date;
  accountId: string;
  categoryId?: string;
  type: 'credit_card' | 'loan' | 'mortgage' | 'personal' | 'student' | 'auto' | 'other';
  isActive: boolean;
  creditor?: string;
  description?: string;
  paymentDay?: number; // Day of month
}

export interface DebtPayment {
  id: string;
  debtId: string;
  amount: number;
  date: Date;
  principal: number;
  interest: number;
  transactionId?: string;
  paymentMethod?: string;
}

export interface CashFlow {
  date: Date;
  income: number;
  expenses: number;
  savings: number;
  balance: number;
  projectedBalance: number;
  scheduledTransactions?: Transaction[];
}

export interface FinancialSummary {
  period: {
    start: Date;
    end: Date;
  };
  income: {
    total: number;
    byCategory: Record<string, number>;
    projected?: number;
  };
  expenses: {
    total: number;
    byCategory: Record<string, number>;
    projected?: number;
  };
  savings: {
    total: number;
    byGoal: Record<string, number>;
    projected?: number;
  };
  netWorth: number;
  cashFlow: CashFlow[];
  budgetPerformance: {
    categoryId: string;
    budgeted: number;
    spent: number;
    remaining: number;
    percentage: number;
  }[];
}

export interface CalendarEvent {
  id: string;
  date: Date;
  type: 'transaction' | 'bill' | 'goal_deadline' | 'debt_payment';
  title: string;
  amount?: number;
  status: 'completed' | 'pending' | 'overdue';
  categoryId?: string;
  color?: string;
  relatedId?: string; // Transaction, debt, or goal ID
}

export interface ExportOptions {
  format: 'csv' | 'pdf' | 'json';
  dateRange: {
    start: Date;
    end: Date;
  };
  includeCategories: boolean;
  includeAccounts: boolean;
  includeGoals: boolean;
  includeDebts: boolean;
  includeRecurring: boolean;
}

export interface AuthContextType {
  user: User | null;
  session: any;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUserSettings: (settings: Partial<UserSettings>) => Promise<void>;
  isLoading: boolean;
}

export interface BudgetContextType {
  // Data
  transactions: Transaction[];
  categories: Category[];
  accounts: BankAccount[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  debts: Debt[];
  debtPayments: DebtPayment[];
  
  // Transactions
  addTransaction: (transaction: Omit<Transaction, 'id' | 'userId'>) => void;
  updateTransaction: (id: string, transaction: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  generateRecurringTransactions: () => void;
  getScheduledTransactions: (startDate: Date, endDate: Date) => Transaction[];
  
  // Categories
  addCategory: (category: Omit<Category, 'id'>) => void;
  updateCategory: (id: string, category: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  reorderCategories: (categoryIds: string[]) => void;
  
  // Accounts
  addAccount: (account: Omit<BankAccount, 'id' | 'userId'>) => void;
  updateAccount: (id: string, account: Partial<BankAccount>) => void;
  deleteAccount: (id: string) => void;
  transferBetweenAccounts: (fromAccountId: string, toAccountId: string, amount: number, description: string) => void;
  
  // Budgets
  setBudget: (budget: Omit<Budget, 'id' | 'userId'>) => void;
  deleteBudget: (id: string) => void;
  
  // Savings Goals
  addSavingsGoal: (goal: Omit<SavingsGoal, 'id' | 'userId' | 'currentAmount' | 'isCompleted' | 'createdAt'>) => void;
  updateSavingsGoal: (id: string, goal: Partial<SavingsGoal>) => void;
  deleteSavingsGoal: (id: string) => void;
  contributeToGoal: (goalId: string, amount: number, accountId: string) => void;
  
  // Debts
  addDebt: (debt: Omit<Debt, 'id' | 'userId'>) => void;
  updateDebt: (id: string, debt: Partial<Debt>) => void;
  deleteDebt: (id: string) => void;
  addDebtPayment: (payment: Omit<DebtPayment, 'id'>) => void;
  
  // Analytics
  getFinancialSummary: (startDate: Date, endDate: Date) => FinancialSummary;
  getCashFlowProjection: (months: number) => CashFlow[];
  getCalendarEvents: (startDate: Date, endDate: Date) => CalendarEvent[];
  
  // Export
  exportData: (options: ExportOptions) => Promise<string>;
  
  // Filters
  currentPeriod: { start: Date; end: Date };
  setCurrentPeriod: (start: Date, end: Date) => void;
  selectedAccountIds: string[];
  setSelectedAccountIds: (accountIds: string[]) => void;
}

// Legacy types for backward compatibility
export interface Goal extends SavingsGoal {}