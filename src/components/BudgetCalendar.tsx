import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  DollarSign
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  addWeeks,
  addYears,
  addDays,
  subMonths,
  isToday,
  isPast,
  isFuture,
  startOfDay
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBudget } from '../contexts/BudgetContext';
import { useAuth } from '../contexts/AuthContext';
import { getCustomMonthPeriod } from '../utils/dateUtils';
import { CalendarEvent, Transaction } from '../types';

const BudgetCalendar: React.FC = () => {
  const { 
    transactions, 
    categories, 
    accounts, 
    savingsGoals, 
    debts, 
    selectedAccountIds,
    getCalendarEvents 
  } = useBudget();
  const { user } = useAuth();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventDetails, setShowEventDetails] = useState(false);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  const events = getCalendarEvents(monthStart, monthEnd);
  const monthStartDay = user?.settings?.monthStartDay || 1;
  const today = startOfDay(new Date());
  const currentCustomPeriod = getCustomMonthPeriod(today, monthStartDay);
  const projectionEnd = currentCustomPeriod.end;
  const selectedAccountSet = new Set(selectedAccountIds);
  const shouldIncludeAccount = (accountId: string) =>
    selectedAccountIds.length === 0 || selectedAccountSet.has(accountId);

  const checkingAccounts = accounts.filter(account =>
    account.isActive &&
    account.type === 'checking' &&
    shouldIncludeAccount(account.id)
  );
  const checkingAccountIds = new Set(checkingAccounts.map(account => account.id));
  const projectedBaseBalance = checkingAccounts.reduce((sum, account) => sum + account.balance, 0);

  const getTransactionImpact = (transaction: Transaction) => {
    const isCheckingTransaction = checkingAccountIds.has(transaction.accountId);

    if (transaction.type === 'transfer') {
      if (!isCheckingTransaction) return 0;
      return transaction.description.toLowerCase().includes('depuis')
        ? transaction.amount
        : -transaction.amount;
    }

    if (!isCheckingTransaction) return 0;
    if (transaction.type === 'income' || transaction.type === 'refund') return transaction.amount;
    if (transaction.type === 'expense' || transaction.type === 'bill' || transaction.type === 'savings') return -transaction.amount;
    return 0;
  };

  const getNextOccurrenceDate = (date: Date, transaction: Transaction) => {
    const pattern = transaction.recurringPattern;
    if (!pattern) return null;

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

  const addImpactToProjection = (
    projection: { incoming: number; deductions: number },
    impact: number
  ) => {
    if (impact > 0) {
      return { ...projection, incoming: projection.incoming + impact };
    }

    return { ...projection, deductions: projection.deductions + Math.abs(impact) };
  };

  const upcomingTransactionProjection = transactions.reduce((projection, transaction) => {
    const impact = getTransactionImpact(transaction);
    if (impact === 0) return projection;

    if (!transaction.isRecurring || !transaction.recurringPattern?.isActive) {
      const transactionDate = startOfDay(transaction.date);
      if (
        transaction.status === 'scheduled' &&
        transactionDate >= today &&
        transactionDate <= projectionEnd
      ) {
        return addImpactToProjection(projection, impact);
      }
      return projection;
    }

    const pattern = transaction.recurringPattern;
    let nextDate = startOfDay(pattern.nextDate);
    let occurrenceCount = pattern.currentOccurrence || 0;
    let recurringProjection = projection;

    while (nextDate <= projectionEnd) {
      const hasReachedEndDate = pattern.endDate && nextDate > startOfDay(pattern.endDate);
      const hasReachedMaxOccurrences = pattern.maxOccurrences && occurrenceCount >= pattern.maxOccurrences;
      if (hasReachedEndDate || hasReachedMaxOccurrences) break;

      if (nextDate >= today) {
        recurringProjection = addImpactToProjection(recurringProjection, impact);
      }

      const followingDate = getNextOccurrenceDate(nextDate, transaction);
      if (!followingDate || followingDate <= nextDate) break;
      nextDate = startOfDay(followingDate);
      occurrenceCount += 1;
    }

    return recurringProjection;
  }, { incoming: 0, deductions: 0 });

  const upcomingDebtPayments = debts
    .filter(debt =>
      debt.isActive &&
      checkingAccountIds.has(debt.accountId) &&
      startOfDay(debt.dueDate) >= today &&
      startOfDay(debt.dueDate) <= projectionEnd
    )
    .reduce((sum, debt) => sum + debt.minimumPayment, 0);

  const projectedIncoming = upcomingTransactionProjection.incoming;
  const projectedDeductions = upcomingTransactionProjection.deductions + upcomingDebtPayments;
  const projectedBalance = projectedBaseBalance + projectedIncoming - projectedDeductions;

  const getEventsForDate = (date: Date): CalendarEvent[] => {
    return events.filter(event => isSameDay(event.date, date));
  };

  const getEventColor = (event: CalendarEvent) => {
    switch (event.type) {
      case 'transaction':
        return event.status === 'completed' ? 'bg-green-500' : 'bg-blue-500';
      case 'bill':
        return event.status === 'overdue' ? 'bg-red-500' : 
               event.status === 'completed' ? 'bg-green-500' : 'bg-orange-500';
      case 'goal_deadline':
        return 'bg-purple-500';
      case 'debt_payment':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getEventIcon = (event: CalendarEvent) => {
    switch (event.type) {
      case 'transaction':
        return event.status === 'completed' ? CheckCircle : Clock;
      case 'bill':
        return event.status === 'overdue' ? AlertCircle : 
               event.status === 'completed' ? CheckCircle : Clock;
      case 'goal_deadline':
        return CalendarIcon;
      case 'debt_payment':
        return DollarSign;
      default:
        return CalendarIcon;
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    const dayEvents = getEventsForDate(date);
    if (dayEvents.length > 0) {
      setShowEventDetails(true);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
            <CalendarIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
            Calendrier budgétaire
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Solde compte courant</p>
          <p className="mt-1 break-words text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl">
            {projectedBaseBalance.toFixed(2)} €
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Compte courant uniquement
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Entrées à venir</p>
          <p className="mt-1 break-words text-xl font-semibold text-green-600 dark:text-green-400 sm:text-2xl">
            +{projectedIncoming.toFixed(2)} €
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Jusqu'au {format(projectionEnd, 'dd MMM', { locale: fr })}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Ponctions à venir</p>
          <p className="mt-1 break-words text-xl font-semibold text-red-600 dark:text-red-400 sm:text-2xl">
            {projectedDeductions > 0 ? '-' : ''}{projectedDeductions.toFixed(2)} €
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Mouvements planifiés et dettes
          </p>
        </div>

        <div className="rounded-xl bg-gray-950 p-4 shadow-sm dark:bg-white sm:p-5">
          <p className="text-sm text-gray-300 dark:text-gray-600">Solde courant prévu</p>
          <p className={`mt-1 break-words text-xl font-semibold sm:text-2xl ${projectedBalance >= 0 ? 'text-emerald-300 dark:text-emerald-700' : 'text-red-300 dark:text-red-700'}`}>
            {projectedBalance.toFixed(2)} €
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Au {format(projectionEnd, 'dd MMM', { locale: fr })}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        {/* Calendar Header */}
        <div className="border-b border-gray-200 p-4 dark:border-gray-700 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold capitalize text-gray-900 dark:text-white sm:text-xl">
              {format(currentDate, 'MMMM yyyy', { locale: fr })}
            </h2>
            
            <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 sm:flex sm:space-x-2">
              <button
                onClick={() => navigateMonth('prev')}
                className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
              
              <button
                onClick={() => setCurrentDate(new Date())}
                className="rounded-lg bg-blue-100 px-3 py-2 text-sm text-blue-700 transition-colors hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40 sm:py-1"
              >
                Aujourd'hui
              </button>
              
              <button
                onClick={() => navigateMonth('next')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="overflow-x-auto p-3 sm:p-6">
          <div className="min-w-[42rem]">
          {/* Days of week header */}
          <div className="mb-4 grid grid-cols-7 gap-1">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(day => {
              const dayEvents = getEventsForDate(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              
              return (
                <div
                  key={day.toISOString()}
                  onClick={() => handleDateClick(day)}
                  className={`
                    min-h-[76px] cursor-pointer rounded-lg border border-gray-200 p-2
                    transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50
                    ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}
                    ${!isCurrentMonth ? 'opacity-50' : ''}
                    ${isToday(day) ? 'bg-blue-100 dark:bg-blue-900/30' : ''}
                  `}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${
                      isToday(day) 
                        ? 'text-blue-700 dark:text-blue-300' 
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {format(day, 'd')}
                    </span>
                    
                    {dayEvents.length > 0 && (
                      <span className="text-xs bg-blue-500 text-white rounded-full px-1 min-w-[16px] h-4 flex items-center justify-center">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>
                  
                  {/* Events preview */}
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map((event, index) => {
                      const Icon = getEventIcon(event);
                      return (
                        <div
                          key={index}
                          className={`
                            flex items-center space-x-1 px-1 py-0.5 rounded text-xs text-white
                            ${getEventColor(event)}
                          `}
                        >
                          <Icon className="h-3 w-3" />
                          <span className="truncate flex-1">{event.title}</span>
                        </div>
                      );
                    })}
                    
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 px-1">
                        +{dayEvents.length - 2} autres
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </div>
      </div>

      {/* Event Details Modal */}
      {showEventDetails && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92dvh] w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-gray-900 sm:max-w-lg sm:rounded-3xl">
            <div className="bg-blue-600 px-6 pb-6 pt-5 text-white dark:bg-blue-500">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-blue-100">
                    {format(selectedDate, 'EEEE', { locale: fr })}
                  </p>
                  <h3 className="mt-1 text-2xl font-semibold">
                    {format(selectedDate, 'dd MMMM yyyy', { locale: fr })}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEventDetails(false)}
                  className="rounded-full p-2 text-blue-100 transition hover:bg-white/15 hover:text-white"
                  aria-label="Fermer"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="max-h-[calc(92dvh-8rem)] overflow-y-auto p-5 sm:p-6">
              {getEventsForDate(selectedDate).length > 0 ? (
                <div className="space-y-3">
                  {getEventsForDate(selectedDate).map((event, index) => {
                    const Icon = getEventIcon(event);
                    const category = categories.find(c => c.id === event.categoryId);
                    
                    return (
                      <div key={index} className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-950">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${getEventColor(event)}`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate font-semibold text-gray-950 dark:text-white">
                            {event.title}
                          </h4>
                          
                          {event.amount && (
                            <p className="mt-1 text-sm font-semibold text-gray-700 dark:text-gray-200">
                              {event.amount.toFixed(2)} €
                            </p>
                          )}
                          
                          {category && (
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                              {category.name}
                            </p>
                          )}
                          
                          <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                            event.status === 'completed' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : event.status === 'overdue'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          }`}>
                            {event.status === 'completed' ? 'Terminé' : 
                             event.status === 'overdue' ? 'En retard' : 'En attente'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                  <p>Aucun événement ce jour</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Légende</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Terminé</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Transaction</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-orange-500 rounded"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Facture</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">En retard</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-purple-500 rounded"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Objectif</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BudgetCalendar;
