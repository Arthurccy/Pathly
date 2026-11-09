import { addDays, addWeeks, addMonths, addYears, startOfDay } from 'date-fns';
import type { RecurringPattern, Transaction } from '../types';

export function nextImportOccurrence(date: Date, frequency: RecurringPattern['frequency'], now = new Date()): Date {
  let next = startOfDay(date);
  const today = startOfDay(now);
  do {
    next = frequency === 'daily' ? addDays(next, 1) : frequency === 'weekly' ? addWeeks(next, 1) : frequency === 'yearly' ? addYears(next, 1) : addMonths(next, frequency === 'quarterly' ? 3 : 1);
  } while (next <= today);
  return next;
}

export function recurrenceKey(transaction: Pick<Transaction, 'accountId' | 'type' | 'description'>): string {
  return [transaction.accountId, transaction.type, transaction.description.trim().toLocaleLowerCase()].join('|');
}

export function importRecurrenceCandidates(transactions: Transaction[], accountId: string): Transaction[] {
  const existing = new Set(transactions.filter(t => t.isRecurring).map(recurrenceKey));
  const grouped = new Map<string, Transaction>();
  for (const transaction of transactions) {
    if (transaction.accountId !== accountId || transaction.isRecurring || transaction.status !== 'completed' || !['income', 'expense', 'bill'].includes(transaction.type)) continue;
    const key = recurrenceKey(transaction);
    if (existing.has(key)) continue;
    const previous = grouped.get(key);
    if (!previous || previous.date < transaction.date) grouped.set(key, transaction);
  }
  return [...grouped.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
}
