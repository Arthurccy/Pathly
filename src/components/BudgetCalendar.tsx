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
  subMonths,
  isToday,
  isPast,
  isFuture
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBudget } from '../contexts/BudgetContext';
import { CalendarEvent } from '../types';

const BudgetCalendar: React.FC = () => {
  const { 
    transactions, 
    categories, 
    accounts, 
    savingsGoals, 
    debts, 
    getCalendarEvents 
  } = useBudget();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventDetails, setShowEventDetails] = useState(false);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  const events = getCalendarEvents(monthStart, monthEnd);

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
            <CalendarIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Calendrier budgétaire
          </h1>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        {/* Calendar Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {format(currentDate, 'MMMM yyyy', { locale: fr })}
            </h2>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
              
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors"
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
        <div className="p-6">
          {/* Days of week header */}
          <div className="grid grid-cols-7 gap-1 mb-4">
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
                    min-h-[80px] p-2 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer
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

      {/* Event Details Modal */}
      {showEventDetails && selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {format(selectedDate, 'dd MMMM yyyy', { locale: fr })}
                </h3>
                <button
                  onClick={() => setShowEventDetails(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {getEventsForDate(selectedDate).length > 0 ? (
                <div className="space-y-4">
                  {getEventsForDate(selectedDate).map((event, index) => {
                    const Icon = getEventIcon(event);
                    const category = categories.find(c => c.id === event.categoryId);
                    
                    return (
                      <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className={`p-2 rounded-lg ${getEventColor(event)}`}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {event.title}
                          </h4>
                          
                          {event.amount && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {event.amount.toFixed(2)} €
                            </p>
                          )}
                          
                          {category && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {category.name}
                            </p>
                          )}
                          
                          <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs ${
                            event.status === 'completed' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : event.status === 'overdue'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
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