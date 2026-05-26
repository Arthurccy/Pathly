import React, { useEffect, useRef, useState } from 'react';
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
  const touchStartX = useRef<number | null>(null);

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

  const handleTouchEnd = (x: number) => {
    if (touchStartX.current === null) return;

    const distance = touchStartX.current - x;
    touchStartX.current = null;

    if (Math.abs(distance) < 60) return;
    if (distance > 0 && stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1);
    }
    if (distance < 0 && stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center overflow-y-auto bg-gray-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        className="max-h-[100dvh] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl dark:bg-gray-950 sm:max-h-[calc(100dvh-2rem)] sm:max-w-4xl sm:rounded-2xl"
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          handleTouchEnd(event.changedTouches[0]?.clientX ?? 0);
        }}
      >
        <div className="grid max-h-[100dvh] overflow-y-auto sm:max-h-[calc(100dvh-2rem)] md:grid-cols-[0.9fr_1.1fr]">
          <div className="relative bg-gray-950 p-5 text-white dark:bg-white dark:text-gray-950 sm:p-6 md:min-h-[22rem]">
            <button
              type="button"
              onClick={() => complete()}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20 dark:bg-gray-950/10 dark:text-gray-950 dark:hover:bg-gray-950/20"
              aria-label="Ignorer le tutoriel"
              title="Ignorer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex min-h-[16rem] flex-col justify-between md:h-full">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-gray-950 dark:bg-gray-950 dark:text-white sm:h-14 sm:w-14">
                  <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
                </div>
                <p className="mt-6 text-sm font-medium text-blue-200 dark:text-blue-700 sm:mt-8">
                  Étape {stepIndex + 1} sur {steps.length}
                </p>
                <h2 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">
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

          <div className="p-5 sm:p-8">
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

            <p className="mt-5 text-base leading-7 text-gray-700 dark:text-gray-300 sm:mt-6 sm:text-lg sm:leading-8">
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

            <div className="sticky bottom-0 -mx-5 mt-6 flex flex-col-reverse gap-3 border-t border-gray-100 bg-white/95 px-5 py-4 backdrop-blur dark:border-gray-900 dark:bg-gray-950/95 sm:static sm:mx-0 sm:mt-8 sm:flex-row sm:items-center sm:justify-between sm:border-t-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-0">
              <button
                type="button"
                onClick={() => complete()}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-950 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white"
              >
                Ignorer
              </button>

              <div className="flex flex-col gap-3 sm:flex-row">
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
