import React from 'react';
import { useBudget } from '../contexts/BudgetContext';
import { CheckCircle2, Circle, ChevronRight, Sparkles, Building2, CalendarClock, PieChart, Target } from 'lucide-react';

interface OnboardingChecklistProps {
  onViewChange?: (view: string) => void;
}

const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({ onViewChange }) => {
  const { accounts, transactions, budgets, savingsGoals } = useBudget();

  // Determine progress
  const hasAccount = accounts.length > 0;
  const hasRecurring = transactions.some(t => t.isRecurring);
  const hasBudget = budgets.length > 0;
  const hasGoal = savingsGoals.length > 0;

  const stepsCompleted = [hasAccount, hasRecurring, hasBudget, hasGoal].filter(Boolean).length;
  const progressPercent = (stepsCompleted / 4) * 100;

  if (stepsCompleted === 4) {
    return null; // Don't show if all completed
  }

  return (
    <section className="mb-8 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-sm dark:border-blue-900/50 dark:from-blue-950/40 dark:to-indigo-950/40">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 mb-2">
            <Sparkles className="h-5 w-5" />
            <h2 className="text-lg font-bold">Bienvenue sur Pathly !</h2>
          </div>
          <p className="text-blue-900/80 dark:text-blue-200/80 text-sm mb-6 max-w-xl">
            Pour tirer le meilleur de votre budget, nous vous conseillons de configurer ces 4 éléments essentiels. Vous pourrez voir l'impact immédiatement sur vos prévisions !
          </p>

          <div className="w-full bg-blue-200/50 dark:bg-blue-900/30 rounded-full h-2.5 mb-2">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
          <p className="text-xs text-blue-700 font-medium dark:text-blue-400 mb-6">
            {stepsCompleted} sur 4 étapes terminées
          </p>
        </div>

        <div className="grid gap-3 flex-1 min-w-[280px]">
          <button 
            onClick={() => !hasAccount && onViewChange?.('accounts')}
            className={`flex items-center gap-3 rounded-xl bg-white dark:bg-slate-900 p-4 shadow-sm transition-all text-left ${
              hasAccount ? 'opacity-60 cursor-default' : 'hover:shadow-md hover:scale-[1.01] hover:border-blue-300 border border-transparent'
            }`}
          >
            {hasAccount ? <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" /> : <Circle className="h-6 w-6 text-blue-300 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${hasAccount ? 'text-slate-500 dark:text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>1. Ajouter un compte</p>
            </div>
            {!hasAccount && <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />}
          </button>

          <button 
            onClick={() => !hasRecurring && onViewChange?.('add')}
            className={`flex items-center gap-3 rounded-xl bg-white dark:bg-slate-900 p-4 shadow-sm transition-all text-left ${
              hasRecurring ? 'opacity-60 cursor-default' : 'hover:shadow-md hover:scale-[1.01] hover:border-blue-300 border border-transparent'
            }`}
          >
            {hasRecurring ? <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" /> : <Circle className="h-6 w-6 text-blue-300 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${hasRecurring ? 'text-slate-500 dark:text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>2. Ajouter une charge fixe (loyer, etc)</p>
            </div>
            {!hasRecurring && <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />}
          </button>

          <button 
            onClick={() => !hasBudget && onViewChange?.('plan')}
            className={`flex items-center gap-3 rounded-xl bg-white dark:bg-slate-900 p-4 shadow-sm transition-all text-left ${
              hasBudget ? 'opacity-60 cursor-default' : 'hover:shadow-md hover:scale-[1.01] hover:border-blue-300 border border-transparent'
            }`}
          >
            {hasBudget ? <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" /> : <Circle className="h-6 w-6 text-blue-300 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${hasBudget ? 'text-slate-500 dark:text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>3. Définir un budget variable</p>
            </div>
            {!hasBudget && <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />}
          </button>

          <button 
            onClick={() => !hasGoal && onViewChange?.('goals')}
            className={`flex items-center gap-3 rounded-xl bg-white dark:bg-slate-900 p-4 shadow-sm transition-all text-left ${
              hasGoal ? 'opacity-60 cursor-default' : 'hover:shadow-md hover:scale-[1.01] hover:border-blue-300 border border-transparent'
            }`}
          >
            {hasGoal ? <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" /> : <Circle className="h-6 w-6 text-blue-300 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${hasGoal ? 'text-slate-500 dark:text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>4. Créer un objectif d'épargne</p>
            </div>
            {!hasGoal && <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />}
          </button>
        </div>
      </div>
    </section>
  );
};

export default OnboardingChecklist;
