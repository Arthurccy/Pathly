import { User, Transaction, Category, BankAccount, Budget, SavingsGoal, Debt, DebtPayment, UserSettings } from '../types';

// Database service using IndexedDB for better persistence
class DatabaseService {
  private dbName = 'BudgetDiaryDB';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('transactions')) {
          const transactionStore = db.createObjectStore('transactions', { keyPath: 'id' });
          transactionStore.createIndex('userId', 'userId', { unique: false });
        }
        if (!db.objectStoreNames.contains('categories')) {
          const categoryStore = db.createObjectStore('categories', { keyPath: 'id' });
          categoryStore.createIndex('userId', 'userId', { unique: false });
        }
        if (!db.objectStoreNames.contains('accounts')) {
          const accountStore = db.createObjectStore('accounts', { keyPath: 'id' });
          accountStore.createIndex('userId', 'userId', { unique: false });
        }
        if (!db.objectStoreNames.contains('budgets')) {
          const budgetStore = db.createObjectStore('budgets', { keyPath: 'id' });
          budgetStore.createIndex('userId', 'userId', { unique: false });
        }
        if (!db.objectStoreNames.contains('savingsGoals')) {
          const goalStore = db.createObjectStore('savingsGoals', { keyPath: 'id' });
          goalStore.createIndex('userId', 'userId', { unique: false });
        }
        if (!db.objectStoreNames.contains('debts')) {
          const debtStore = db.createObjectStore('debts', { keyPath: 'id' });
          debtStore.createIndex('userId', 'userId', { unique: false });
        }
        if (!db.objectStoreNames.contains('debtPayments')) {
          db.createObjectStore('debtPayments', { keyPath: 'id' });
        }
      };
    });
  }

  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    if (!this.db) {
      await this.init();
    }
    const transaction = this.db!.transaction([storeName], mode);
    return transaction.objectStore(storeName);
  }

  // Generic CRUD operations
  async save<T extends { id: string }>(storeName: string, data: T): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getById<T>(storeName: string, id: string): Promise<T | null> {
    const store = await this.getStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getByUserId<T>(storeName: string, userId: string): Promise<T[]> {
    const store = await this.getStore(storeName);
    const index = store.index('userId');
    return new Promise((resolve, reject) => {
      const request = index.getAll(userId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    const store = await this.getStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName: string, id: string): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName: string): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Specific methods for each entity type
  async saveUser(user: User): Promise<void> {
    return this.save('users', user);
  }

  async getUser(id: string): Promise<User | null> {
    return this.getById('users', id);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const users = await this.getAll<User>('users');
    return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async saveTransaction(transaction: Transaction): Promise<void> {
    return this.save('transactions', transaction);
  }

  async getTransactionsByUserId(userId: string): Promise<Transaction[]> {
    return this.getByUserId('transactions', userId);
  }

  async saveCategory(category: Category): Promise<void> {
    return this.save('categories', category);
  }

  async getCategoriesByUserId(userId: string): Promise<Category[]> {
    return this.getByUserId('categories', userId);
  }

  async saveAccount(account: BankAccount): Promise<void> {
    return this.save('accounts', account);
  }

  async getAccountsByUserId(userId: string): Promise<BankAccount[]> {
    return this.getByUserId('accounts', userId);
  }

  async saveBudget(budget: Budget): Promise<void> {
    return this.save('budgets', budget);
  }

  async getBudgetsByUserId(userId: string): Promise<Budget[]> {
    return this.getByUserId('budgets', userId);
  }

  async saveSavingsGoal(goal: SavingsGoal): Promise<void> {
    return this.save('savingsGoals', goal);
  }

  async getSavingsGoalsByUserId(userId: string): Promise<SavingsGoal[]> {
    return this.getByUserId('savingsGoals', userId);
  }

  async saveDebt(debt: Debt): Promise<void> {
    return this.save('debts', debt);
  }

  async getDebtsByUserId(userId: string): Promise<Debt[]> {
    return this.getByUserId('debts', userId);
  }

  async saveDebtPayment(payment: DebtPayment): Promise<void> {
    return this.save('debtPayments', payment);
  }

  async getDebtPayments(): Promise<DebtPayment[]> {
    return this.getAll('debtPayments');
  }

  // Migration from localStorage
  async migrateFromLocalStorage(userId: string): Promise<void> {
    try {
      // Migrate transactions
      const transactions = JSON.parse(localStorage.getItem(`transactions-${userId}`) || '[]');
      for (const transaction of transactions) {
        await this.saveTransaction({
          ...transaction,
          date: new Date(transaction.date),
          recurringPattern: transaction.recurringPattern ? {
            ...transaction.recurringPattern,
            nextDate: new Date(transaction.recurringPattern.nextDate),
            endDate: transaction.recurringPattern.endDate ? new Date(transaction.recurringPattern.endDate) : undefined,
            lastGenerated: transaction.recurringPattern.lastGenerated ? new Date(transaction.recurringPattern.lastGenerated) : undefined
          } : undefined
        });
      }

      // Migrate other entities similarly...
      const categories = JSON.parse(localStorage.getItem(`categories-${userId}`) || '[]');
      for (const category of categories) {
        await this.saveCategory(category);
      }

      const accounts = JSON.parse(localStorage.getItem(`accounts-${userId}`) || '[]');
      for (const account of accounts) {
        await this.saveAccount(account);
      }

      const budgets = JSON.parse(localStorage.getItem(`budgets-${userId}`) || '[]');
      for (const budget of budgets) {
        await this.saveBudget({
          ...budget,
          startDate: new Date(budget.startDate),
          endDate: budget.endDate ? new Date(budget.endDate) : undefined
        });
      }

      const goals = JSON.parse(localStorage.getItem(`savingsGoals-${userId}`) || '[]');
      for (const goal of goals) {
        await this.saveSavingsGoal({
          ...goal,
          deadline: goal.deadline ? new Date(goal.deadline) : undefined,
          createdAt: new Date(goal.createdAt)
        });
      }

      const debts = JSON.parse(localStorage.getItem(`debts-${userId}`) || '[]');
      for (const debt of debts) {
        await this.saveDebt({
          ...debt,
          dueDate: new Date(debt.dueDate)
        });
      }

      const payments = JSON.parse(localStorage.getItem(`debtPayments-${userId}`) || '[]');
      for (const payment of payments) {
        await this.saveDebtPayment({
          ...payment,
          date: new Date(payment.date)
        });
      }

      console.log('Migration from localStorage completed');
    } catch (error) {
      console.error('Migration failed:', error);
    }
  }
}

export const db = new DatabaseService();