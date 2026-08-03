import React, { useState, useMemo } from 'react';
import { Target, TrendingUp, AlertTriangle, Gauge, CheckCircle2, ChevronRight, Calculator, Plus, Minus, Euro } from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';

const BudgetSimulator: React.FC = () => {
  const { getCashFlowProjection } = useBudget();
  
  // Calculate baselines based on 6 months projection
  const { baselineIncome, baselineFixed, baselineDebts, baselineSavings, baselineBudgets } = useMemo(() => {
    const projections = getCashFlowProjection(6);
    if (projections.length === 0) return { baselineIncome: 0, baselineFixed: 0, baselineDebts: 0, baselineSavings: 0, baselineBudgets: 0 };
    
    return {
      baselineIncome: Math.round(projections.reduce((sum, p) => sum + p.income, 0) / projections.length),
      baselineFixed: Math.round(projections.reduce((sum, p) => sum + p.baseExpenses, 0) / projections.length),
      baselineDebts: Math.round(projections.reduce((sum, p) => sum + p.debtPayments, 0) / projections.length),
      baselineSavings: Math.round(projections.reduce((sum, p) => sum + p.savings + p.transfersOut, 0) / projections.length),
      baselineBudgets: Math.round(projections.reduce((sum, p) => sum + p.budgetReserve, 0) / projections.length)
    };
  }, [getCashFlowProjection]);

  // Simulator States
  const [simIncome, setSimIncome] = useState(baselineIncome.toString());
  const [simFixed, setSimFixed] = useState(baselineFixed.toString());
  const [simDebts, setSimDebts] = useState(baselineDebts.toString());
  const [simBudgets, setSimBudgets] = useState(baselineBudgets.toString());
  
  const currentIncome = parseFloat(simIncome) || 0;
  const currentFixed = parseFloat(simFixed) || 0;
  const currentDebts = parseFloat(simDebts) || 0;
  const currentBudgets = parseFloat(simBudgets) || 0;
  const currentSavings = baselineSavings; // Keep savings static for simple simulation

  const totalExpenses = currentFixed + currentDebts + currentSavings + currentBudgets;
  const surplus = currentIncome - totalExpenses;
  const marginPercent = currentIncome > 0 ? (surplus / currentIncome) * 100 : 0;

  const getStatus = (balance: number) => {
    if (balance < 0) return { label: 'Déficit', Icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30' };
    if (balance < 150) return { label: 'Tendu', Icon: Gauge, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' };
    return { label: 'Excédent', Icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' };
  };

  const status = getStatus(surplus);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg">
          <Target className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Simulateur de Budget
        </h1>
      </div>
      
      <p className="text-gray-500 dark:text-gray-400">
        Simulez l'impact d'un changement de salaire, de loyer ou de train de vie sur votre budget mensuel. Les valeurs de départ sont vos moyennes actuelles.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Entrées */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Paramètres simulés
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Revenus nets mensuels (€)</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={simIncome} 
                  onChange={e => setSimIncome(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                />
                <Euro className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
              {currentIncome !== baselineIncome && (
                <p className={`text-xs mt-1 font-medium ${currentIncome > baselineIncome ? 'text-green-600' : 'text-red-600'}`}>
                  {currentIncome > baselineIncome ? '+' : ''}{currentIncome - baselineIncome} € par rapport à aujourd'hui
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Charges fixes (Loyer, Assurances...) (€)</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={simFixed} 
                  onChange={e => setSimFixed(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                />
                <Euro className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
              {currentFixed !== baselineFixed && (
                <p className={`text-xs mt-1 font-medium ${currentFixed < baselineFixed ? 'text-green-600' : 'text-red-600'}`}>
                  {currentFixed > baselineFixed ? '+' : ''}{currentFixed - baselineFixed} € par rapport à aujourd'hui
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Remboursements de Dettes (€)</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={simDebts} 
                  onChange={e => setSimDebts(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                />
                <Euro className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Budgets de vie (Courses, Loisirs...) (€)</label>
              <div className="relative">
                <input 
                  type="number" 
                  value={simBudgets} 
                  onChange={e => setSimBudgets(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                />
                <Euro className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </div>
            
            <button
              onClick={() => {
                setSimIncome(baselineIncome.toString());
                setSimFixed(baselineFixed.toString());
                setSimDebts(baselineDebts.toString());
                setSimBudgets(baselineBudgets.toString());
              }}
              className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
            >
              Réinitialiser avec mes vraies moyennes
            </button>
          </div>
        </div>

        {/* Résultats */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center justify-between">
              Résultat Simulé
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${status.bg} ${status.color}`}>
                <status.Icon className="h-4 w-4" />
                {status.label}
              </span>
            </h2>
            
            <div className="flex flex-col items-center justify-center py-6 border-b border-gray-100 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mb-2">Reste à vivre (Marge mensuelle)</p>
              <p className={`text-5xl font-bold ${surplus >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
                {surplus > 0 ? '+' : ''}{surplus.toLocaleString('fr-FR')} €
              </p>
              <p className="text-sm text-gray-500 mt-3">
                Soit {marginPercent.toFixed(1)}% de vos revenus
              </p>
            </div>
            
            <div className="mt-6 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 dark:text-gray-400">Total des revenus</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{currentIncome.toLocaleString('fr-FR')} €</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 dark:text-gray-400">Total des sorties</span>
                <span className="font-semibold text-red-600 dark:text-red-400">{totalExpenses.toLocaleString('fr-FR')} €</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 overflow-hidden flex">
                <div className="bg-red-500 h-2.5" style={{ width: `${Math.min((currentFixed / currentIncome) * 100, 100)}%` }} title="Charges fixes"></div>
                <div className="bg-orange-500 h-2.5" style={{ width: `${Math.min((currentDebts / currentIncome) * 100, 100)}%` }} title="Dettes"></div>
                <div className="bg-amber-500 h-2.5" style={{ width: `${Math.min((currentBudgets / currentIncome) * 100, 100)}%` }} title="Budgets"></div>
                <div className="bg-blue-500 h-2.5" style={{ width: `${Math.min((currentSavings / currentIncome) * 100, 100)}%` }} title="Epargne"></div>
                <div className="bg-emerald-500 h-2.5" style={{ width: `${Math.max(marginPercent, 0)}%` }} title="Reste"></div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-gray-500 mt-2 justify-center">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Fixe</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Dettes</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Vie</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Épargne ({currentSavings}€)</span>
                {marginPercent > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Marge</span>}
              </div>
            </div>
          </div>
          
          {surplus > 0 ? (
            <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-sm text-indigo-800 dark:text-indigo-300">
              💡 Avec cette simulation, vous pourriez épargner <strong>{(surplus * 12).toLocaleString('fr-FR')} €</strong> par an supplémentaires !
            </div>
          ) : (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-800 dark:text-red-300">
              ⚠️ Attention, cette simulation génère un déficit de <strong>{Math.abs(surplus * 12).toLocaleString('fr-FR')} €</strong> par an. Vous devrez piocher dans vos réserves ou réduire vos budgets de vie.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BudgetSimulator;
