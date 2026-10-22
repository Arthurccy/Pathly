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
  monthStartDay: number; // Day of month (1-31)
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
  excludeFromReports?: boolean; // Ignore in dashboards and analytics
}

export interface BalanceSnapshot {
  accountId: string;
  date: string; // yyyy-MM-dd (local day)
  balance: number;
}

export interface BankAccount {
  id: string;
  userId: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'investment' | 'cash' | 'crypto' | 'meal_voucher';
  balance: number;
  currency: string;
  color: string;
  isActive: boolean;
  order: number;
  bankName?: string;
  accountNumber?: string;
  description?: string;
  gocardlessAccountId?: string;
  gocardlessInstitutionId?: string;
  lastSyncedAt?: string;
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
  isShared?: boolean; // Dépense commune / Foyer partagée
  isHouseholdContribution?: boolean; // Provision / virement de participation au foyer
  attachments?: string[]; // File URLs
  gocardlessTransactionId?: string;
}

export interface RecurringPattern {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  interval: number; // Every X days/weeks/months/quarters/years
  endDate?: Date;
  nextDate: Date;
  lastGenerated?: Date;
  isActive: boolean;
  maxOccurrences?: number;
  currentOccurrence?: number;
  calculationType?: 'fixed' | 'percentage';
  percentage?: number;
  linkedTransactionId?: string;
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
  endDate?: Date;
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
  openingBalance?: number;
  projectedSavingsBalance?: number;
  projectedTotalBalance?: number;
  baseExpenses?: number;
  debtPayments?: number;
  transfersOut?: number;
  budgetReserve?: number;
  scheduledTransactions?: Transaction[];
  allTransactions?: Transaction[];
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
  balanceSnapshots: BalanceSnapshot[];
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
  getProjectedRecurringTransactions: (startDate: Date, endDate: Date) => Transaction[];
  
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
  addDebt: (debt: Omit<Debt, 'id' | 'userId'>) => Promise<Debt | undefined>;
  updateDebt: (id: string, debt: Partial<Debt>) => void;
  deleteDebt: (id: string) => void;
  addDebtPayment: (payment: Omit<DebtPayment, 'id'>) => void;
  
  // Analytics
  getFinancialSummary: (startDate: Date, endDate: Date) => FinancialSummary;
  getCashFlowProjection: (months: number, startDate?: Date, monthStartDay?: number) => CashFlow[];
  getCalendarEvents: (startDate: Date, endDate: Date) => CalendarEvent[];
  
  // Export
  exportData: (options: ExportOptions) => Promise<string>;
  
  // Filters
  currentPeriod: { start: Date; end: Date };
  setCurrentPeriod: (start: Date, end: Date) => void;
  selectedAccountIds: string[];
  setSelectedAccountIds: (accountIds: string[]) => void;
  
  // Simulated Events
  simulatedEvents: SimulatedEvent[];
  setSimulatedEvents: (events: SimulatedEvent[]) => Promise<void>;

  // Household / Couple Management
  householdConfig: HouseholdConfig;
  updateHouseholdConfig: (config: Partial<HouseholdConfig>) => Promise<void>;
  toggleTransactionShared: (id: string) => Promise<void>;
  toggleCategoryShared: (categoryId: string) => Promise<void>;
  isTransactionShared: (transaction: Transaction) => boolean;
  ratioA: number;
  ratioB: number;

  // Physical Assets / Patrimoine matériel
  assets: PhysicalAsset[];
  addAsset: (asset: Omit<PhysicalAsset, 'id'>) => Promise<PhysicalAsset>;
  updateAsset: (id: string, updates: Partial<PhysicalAsset>) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  totalAssetsValue: number;

  // Real Estate Plans / Projets Immobiliers (Supabase persistant)
  realEstatePlans: RealEstatePlan[];
  saveRealEstatePlans: (plans: RealEstatePlan[]) => Promise<void>;

  // Investment Positions / Bourse, PEA, CTO
  investmentPositions: InvestmentPosition[];
  saveInvestmentPositions: (positions: InvestmentPosition[]) => Promise<void>;
  addInvestmentPosition: (position: Omit<InvestmentPosition, 'id'>) => Promise<InvestmentPosition>;
  updateInvestmentPosition: (id: string, updates: Partial<InvestmentPosition>) => Promise<void>;
  deleteInvestmentPosition: (id: string) => Promise<void>;

  // Utilities
  reloadAll?: () => Promise<void>;
}

export interface PhysicalAsset {
  id: string;
  userId?: string;
  name: string;
  category: 'real_estate' | 'vehicle' | 'valuable_item' | 'crypto_hardware' | 'other';
  purchasePrice: number;
  currentValue: number;
  purchaseDate: string;
  debtId?: string; // ID of linked credit/debt in Pathly
  debtIds?: string[]; // IDs of multiple linked credits/debts (e.g. main loan + PTZ)
  isPlanned?: boolean; // If this is a future planned project
  realEstatePlanId?: string; // ID of the linked RealEstatePlan if created from planner
  loanDetails?: {
    originalLoanAmount?: number;
    startDate?: string;
    endDate?: string;
    monthlyPayment?: number;
  };
  notes?: string;
  location?: string;
}

export interface SimulatedEvent {
  id: string;
  date: string;
  type: 'income' | 'fixed' | 'debts' | 'budgets' | 'savings';
  newValue: string;
}

export interface HouseholdProfile {
  name: string;
  income: number;
}

export interface HouseholdConfig {
  enabled: boolean;
  userA: HouseholdProfile;
  userB: HouseholdProfile;
  splitMode: 'prorata' | '50_50' | 'custom';
  customRatioA?: number; // %
  sharedCategoryIds?: string[]; // IDs des budgets / catégories partagés par défaut au sein du foyer
  accountIds?: string[]; // Comptes pris en compte dans la vue foyer (vide / absent = tous)
}

export interface SalaryEvolution {
  id: string;
  borrower: 'buyerA' | 'buyerB';
  date: string; // YYYY-MM
  newIncome: number;
  note?: string;
}

export interface RealEstatePlan {
  id: string;
  name: string;
  targetDate: string; // YYYY-MM (e.g. '2027-06')
  createdAt?: string;
  updatedAt?: string;

  // Property Details
  propertyType: 'old' | 'new' | 'construction';
  propertyPrice: number;
  notaryFeesRate: number; // e.g. 7.5 (%)
  notaryFeesAmount: number; // e.g. 18750
  useCustomNotaryFees: boolean;
  agencyFees: number;
  renovationBudget: number;
  bankGuaranteeFees: number;

  // Co-Borrowers
  buyerAName: string;
  buyerAIncome: number;
  buyerAContribution: number;
  buyerBName: string;
  buyerBIncome: number;
  buyerBContribution: number;
  salaryEvolutions?: SalaryEvolution[];

  // Ownership split (clé notariée)
  ownershipSplitMode: 'pro_rata_total' | '50_50' | 'custom';
  customOwnershipRatioA: number; // %

  // PTZ (Prêt à Taux Zéro)
  hasPtz: boolean;
  useLoanSmoothing?: boolean;
  ptzAmount: number;
  ptzDurationYears: number;
  ptzDeferredYears: number; // Différé de remboursement en années (0, 5, 8, 10...)
  ptzInsuranceRate: number; // % annuel sur capital

  // Main Loan (Prêt amortissable classique)
  mainLoanDurationYears: number;
  mainLoanInterestRate: number; // % annuel
  mainLoanInsuranceRate: number; // % annuel sur capital

  // Monthly Repayment Split
  monthlySplitMode: '50_50' | 'pro_rata_income' | 'ownership_ratio' | 'custom';
  customMonthlyRatioA: number; // %

  // Linked Pathly items
  assetId?: string;
  mainLoanDebtId?: string;
  ptzDebtId?: string;
}

// Legacy types for backward compatibility
export interface Goal extends SavingsGoal {}

export interface InvestmentPosition {
  id: string;
  userId?: string;
  accountId: string; // Linked BankAccount (PEA or CTO)
  symbol: string; // e.g. "CW8.PA", "MC.PA", "NVDA", "BTC-EUR"
  name: string; // e.g. "Amundi MSCI World UCITS ETF"
  isin?: string; // e.g. "LU1681043599"
  shares: number; // e.g. 15.5
  buyPrice: number; // PRU (Prix de Revient Unitaire)
  currency: string; // e.g. "EUR", "USD"
  currentPrice: number; // Dernier cours du marché
  previousClosePrice?: number; // Cours de clôture de la veille
  assetType: 'etf' | 'stock' | 'crypto' | 'bond' | 'other';
  notes?: string;
  lastPriceUpdatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StockQuote {
  symbol: string;
  price: number;
  previousClose?: number;
  change?: number;
  changePercent?: number;
  currency?: string;
  name?: string;
  timestamp?: number;
}

export interface StockSearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
  currency?: string;
}
