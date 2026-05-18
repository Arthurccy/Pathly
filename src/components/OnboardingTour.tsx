import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, CreditCard, ListChecks, Plus, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBudget } from '../contexts/BudgetContext';

interface OnboardingTourProps {
  onViewChange: (view: string) => void;
}

const steps = [
  {
    title: 'Bienvenue sur Pathly',
    subtitle: 'On part d’une page blanche, pas d’un patrimoine inventé.',
    description: 'Vos comptes, soldes et objectifs restent vides tant que vous ne les ajoutez pas. Pathly vous aide simplement à construire une vue fiable de votre argent.',
    icon: Sparkles,
  },
  {
    title: 'Ajoutez vos vrais comptes',
    subtitle: 'Compte courant, Livret A, espèces, PEA...',
    description: 'Commencez par créer vos comptes avec leurs soldes réels. C’est la base pour que le tableau de bord soit utile dès le premier jour.',
    icon: CreditCard,
  },
  {
    title: 'Enregistrez en quelques secondes',
    subtitle: 'Une dépense, un revenu, une catégorie, terminé.',
    description: 'Le bouton Ajouter reste accessible partout. Moins de clics, moins d’effort, plus de chances de tenir dans le temps.',
    icon: Plus,
  },
  {
    title: 'Gardez le contrôle',
    subtitle: 'Catégories, objectifs et imports quand vous êtes prêt.',
    description: 'Les outils avancés sont rangés dans la navigation, pour ne pas vous ralentir au quotidien.',
    icon: ListChecks,
  },
];

const OnboardingTour: React.FC<OnboardingTourProps> = ({ onViewChange }) => {
  const { user } = useAuth();
  const { accounts } = useBudget();
  const [isVisible, setIsVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const storageKey = user ? `pathly-onboarding-complete:${user.id}` : '';
  const step = steps[stepIndex];
  const Icon = step.icon;
  const isLastStep = stepIndex === steps.length - 1;

  useEffect(() => {
    if (!user || !storageKey) return;
    setIsVisible(localStorage.getItem(storageKey) !== 'true');
    setStepIndex(0);
  }, [storageKey, user]);

  const complete = (targetView?: string) => {
    if (storageKey) {
      localStorage.setItem(storageKey, 'true');
    }
    setIsVisible(false);
    if (targetView) {
      onViewChange(targetView);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-950/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-950">
        <div className="grid md:grid-cols-[0.9fr_1.1fr]">
          <div className="relative min-h-[22rem] bg-gray-950 p-6 text-white dark:bg-white dark:text-gray-950">
            <button
              type="button"
              onClick={() => complete()}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20 dark:bg-gray-950/10 dark:text-gray-950 dark:hover:bg-gray-950/20"
              aria-label="Ignorer le tutoriel"
              title="Ignorer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex h-full flex-col justify-between">
              <div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-gray-950 dark:bg-gray-950 dark:text-white">
                  <Icon className="h-7 w-7" />
                </div>
                <p className="mt-8 text-sm font-medium text-blue-200 dark:text-blue-700">
                  Étape {stepIndex + 1} sur {steps.length}
                </p>
                <h2 className="mt-3 text-3xl font-bold leading-tight">
                  {step.title}
                </h2>
                <p className="mt-3 text-base text-gray-300 dark:text-gray-600">
                  {step.subtitle}
                </p>
              </div>

              <div className="mt-8 flex gap-2">
                {steps.map((item, index) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => setStepIndex(index)}
                    className={`h-2 flex-1 rounded-full transition ${
                      index <= stepIndex ? 'bg-blue-400 dark:bg-blue-700' : 'bg-white/20 dark:bg-gray-950/20'
                    }`}
                    aria-label={`Aller à l'étape ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="font-semibold text-gray-950 dark:text-white">
                    Vos données restent à vous
                  </p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Pathly ne remplit pas vos soldes à votre place. Les seuls éléments créés automatiquement sont des catégories de base pour vous faire gagner du temps.
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-6 text-lg leading-8 text-gray-700 dark:text-gray-300">
              {step.description}
            </p>

            <div className="mt-6 grid gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {accounts.length > 0 ? `${accounts.length} compte(s) déjà configuré(s).` : 'Aucun compte pré-rempli.'}
                </span>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Vous pouvez ignorer ce tutoriel et le faire à votre rythme.
                </span>
              </div>
            </div>

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => complete()}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-950 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white"
              >
                Ignorer
              </button>

              <div className="flex gap-3">
                {stepIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => setStepIndex(stepIndex - 1)}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-900"
                  >
                    Précédent
                  </button>
                )}
                {isLastStep ? (
                  <button
                    type="button"
                    onClick={() => complete(accounts.length > 0 ? 'add-transaction' : 'accounts')}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-100"
                  >
                    {accounts.length > 0 ? 'Ajouter une opération' : 'Créer mon premier compte'}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStepIndex(stepIndex + 1)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-100"
                  >
                    Suivant
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
