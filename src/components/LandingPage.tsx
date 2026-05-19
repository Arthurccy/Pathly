import React from 'react';
import { ArrowRight, BarChart3, CheckCircle2, CreditCard, Lock, Plus, Sparkles } from 'lucide-react';

interface LandingPageProps {
  onLogin: () => void;
  onRegister: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onRegister }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="absolute left-0 right-0 top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <button
            type="button"
            className="rounded-md text-2xl font-bold tracking-tight focus:outline-none focus:ring-2 focus:ring-white/70"
            aria-label="Pathly"
          >
            Pathly
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onLogin}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              Se connecter
            </button>
            <button
              type="button"
              onClick={onRegister}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              Creer un compte
            </button>
          </div>
        </div>
      </header>

      <main>
        <section
          className="relative min-h-[92vh] overflow-hidden bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(2, 6, 23, 0.96), rgba(2, 6, 23, 0.72), rgba(2, 6, 23, 0.5)), url('https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1800&q=80')",
          }}
        >
          <div className="absolute inset-x-0 bottom-0 h-28 bg-slate-950" />
          <div className="relative z-10 mx-auto grid min-h-[92vh] max-w-7xl items-center gap-10 px-4 pb-20 pt-28 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
            <div className="max-w-3xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm text-white/85 backdrop-blur">
                <Sparkles className="h-4 w-4" />
                Une app budget qui demarre vraiment a zero
              </div>
              <h1 className="max-w-4xl text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
                Pathly
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200 sm:text-xl">
                Suivez vos comptes, vos depenses et vos objectifs sans tableau complique. Pathly vous aide a revenir chaque jour avec une vue claire de votre argent.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onRegister}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-black/20 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white/70"
                >
                  Commencer gratuitement
                  <ArrowRight className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={onLogin}
                  className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-base font-semibold text-white backdrop-blur transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/70"
                >
                  J'ai deja un compte
                </button>
              </div>

              <div className="mt-8 flex max-w-2xl flex-wrap items-center gap-x-5 gap-y-3 text-sm text-slate-200">
                {['Donnees vierges au depart', 'Tutoriel integre', 'Actions rapides'].map((label) => (
                  <div key={label} className="inline-flex items-center gap-2 whitespace-nowrap">
                    <CheckCircle2 className="h-5 w-5 flex-none text-emerald-300" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="relative ml-auto max-w-lg">
                <div className="rounded-2xl border border-white/15 bg-slate-950/72 p-4 shadow-2xl shadow-black/40 backdrop-blur">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div>
                      <p className="text-sm text-slate-400">Solde disponible</p>
                      <p className="mt-1 text-4xl font-bold text-emerald-300">0,00 EUR</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-950">
                      <BarChart3 className="h-6 w-6" />
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {[
                      { label: 'Compte', icon: CreditCard },
                      { label: 'Ajouter', icon: Plus },
                      { label: 'Securise', icon: Lock },
                    ].map(item => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="rounded-xl bg-white/10 p-4">
                          <Icon className="h-5 w-5 text-blue-200" />
                          <p className="mt-3 text-sm font-medium">{item.label}</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 space-y-3 rounded-xl bg-white p-4 text-slate-950">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Creer mon premier compte</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">2 min</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 w-1/3 rounded-full bg-slate-950" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-10 -mt-10 px-4 pb-12 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-4 rounded-2xl border border-white/10 bg-white p-4 text-slate-950 shadow-xl md:grid-cols-3">
            {[
              ['Clair des le premier jour', "Un onboarding court guide l'utilisateur vers son premier compte."],
              ['Moins de clics', "Les actions frequentes restent accessibles depuis l'accueil et la navigation."],
              ['Pret pour la suite', 'Imports, regles et objectifs sont disponibles sans encombrer le quotidien.'],
            ].map(([title, text]) => (
              <div key={title} className="rounded-xl bg-slate-50 p-5">
                <h2 className="font-semibold">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default LandingPage;
