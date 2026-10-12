import React, { useState } from 'react';
import { useBudget } from '../contexts/BudgetContext';
import { CheckCircle2, Circle, ChevronRight, Sparkles, X } from 'lucide-react';

interface OnboardingChecklistProps {
  onViewChange?: (view: string) => void;
}

const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({ onViewChange }) => {
  const { accounts, transactions, budgets, savingsGoals, categories } = useBudget();

  // Determine automatic progress from data
  const hasAccount = accounts.length > 0;
  const hasRecurring = transactions.some(t => t.isRecurring);
  const hasBudget = budgets.length > 0;
  const hasGoal = savingsGoals.length > 0;
  // A custom category exists if there's more than the default ones (we check for > 5 as a heuristic,
  // or more precisely any category that the user explicitly created)
  const hasCategory = categories.length > 5;

  // Manual overrides — lets the user dismiss individual steps
  const [manualChecked, setManualChecked] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('pathly_onboarding_manual') || '{}');
    } catch {
      return {};
    }
  });

  const toggleManual = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = { ...manualChecked, [key]: !manualChecked[key] };
    setManualChecked(next);
    localStorage.setItem('pathly_onboarding_manual', JSON.stringify(next));
  };

  const steps = [
    {
      key: 'account',
      label: '1. Ajouter un compte bancaire',
      done: hasAccount || manualChecked['account'],
      view: 'accounts',
    },
    {
      key: 'recurring',
      label: '2. Ajouter une charge fixe récurrente (loyer, abonnement…)',
      done: hasRecurring || manualChecked['recurring'],
      view: 'recurring-transactions',
    },
    {
      key: 'budget',
      label: '3. Définir un budget variable (courses, sorties…)',
      done: hasBudget || manualChecked['budget'],
      view: 'budget-simulator',
    },
    {
      key: 'category',
      label: '4. Créer une catégorie personnalisée',
      done: hasCategory || manualChecked['category'],
      view: 'categories',
    },
    {
      key: 'goal',
      label: '5. Créer un objectif d\'épargne',
      done: hasGoal || manualChecked['goal'],
      view: 'goals',
    },
  ];

  const stepsCompleted = steps.filter(s => s.done).length;
  const progressPercent = (stepsCompleted / steps.length) * 100;

  // Hide if all done
  if (stepsCompleted === steps.length) {
    return null;
  }

  return (
    <section className="mb-8 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-sm dark:border-blue-900/50 dark:from-blue-950/40 dark:to-indigo-950/40">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        {/* Left: title + progress */}
        <div className="w-full md:max-w-xs md:flex-1">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 mb-2">
            <Sparkles className="h-5 w-5" />
            <h2 className="text-lg font-bold">Bienvenue sur Pathly !</h2>
          </div>
          <p className="text-blue-900/80 dark:text-blue-200/80 text-sm mb-4 md:mb-6">
            Configurez ces {steps.length} éléments pour tirer le meilleur de Pathly. Cliquez sur une étape pour y accéder, ou cochez manuellement si vous l'avez déjà faite.
          </p>

          <div className="w-full bg-blue-200/50 dark:bg-blue-900/30 rounded-full h-2.5 mb-2">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-blue-700 font-medium dark:text-blue-400">
            {stepsCompleted} sur {steps.length} étapes terminées
          </p>
        </div>

        {/* Right: step list */}
        <div className="grid gap-2 w-full min-w-0 md:flex-1">
          {steps.map(step => (
            <div
              key={step.key}
              className={`flex items-center gap-3 rounded-xl bg-white dark:bg-slate-900 px-4 py-3 shadow-sm transition-all ${
                step.done
                  ? 'opacity-60'
                  : 'hover:shadow-md hover:scale-[1.01] cursor-pointer'
              }`}
              onClick={() => !step.done && onViewChange?.(step.view)}
            >
              {/* Manual check toggle */}
              <button
                type="button"
                onClick={(e) => toggleManual(step.key, e)}
                className="shrink-0 focus:outline-none"
                title={step.done ? 'Décocher' : 'Marquer comme fait'}
              >
                {step.done
                  ? <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  : <Circle className="h-6 w-6 text-blue-300 hover:text-blue-500 transition-colors" />
                }
              </button>

              <p className={`flex-1 text-sm font-medium ${
                step.done ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'
              }`}>
                {step.label}
              </p>

              {!step.done && <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default OnboardingChecklist;
