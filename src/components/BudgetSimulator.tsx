import React, { useState, useMemo } from 'react';
import { Target, TrendingUp, AlertTriangle, Gauge, CheckCircle2, ChevronRight, Calculator, Plus, Minus, Euro, Info, Trash2, CalendarClock } from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';

interface SimulatedEvent {
  id: string;
  date: string;
  type: 'income' | 'fixed' | 'debts' | 'budgets' | 'savings';
  newValue: string;
}

const BudgetSimulator: React.FC = () => {
  const { getCashFlowProjection, accounts, debts, budgets, categories, transactions } = useBudget();
  
  // Calculate initial savings balance
  const initialSavingsBalance = useMemo(() => {
    return accounts?.filter(a => a.type === 'savings').reduce((sum, a) => sum + a.balance, 0) || 0;
  }, [accounts]);
  
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
  const [simSavings, setSimSavings] = useState(baselineSavings.toString());
  
  const currentIncome = parseFloat(simIncome) || 0;
  const currentFixed = parseFloat(simFixed) || 0;
  const currentDebts = parseFloat(simDebts) || 0;
  const currentBudgets = parseFloat(simBudgets) || 0;
  const currentSavings = parseFloat(simSavings) || 0;

  const [events, setEvents] = useState<SimulatedEvent[]>(() => {
    const saved = localStorage.getItem('pathly_simulated_events');
    return saved ? JSON.parse(saved) : [];
  });

  React.useEffect(() => {
    localStorage.setItem('pathly_simulated_events', JSON.stringify(events));
  }, [events]);

  const addEvent = () => {
    setEvents([...events, {
      id: Date.now().toString(),
      date: new Date().toISOString().substring(0, 7),
      type: 'income',
      newValue: ''
    }]);
  };
  
  const updateEvent = (id: string, updates: Partial<SimulatedEvent>) => {
    setEvents(events.map(e => e.id === id ? { ...e, ...updates } : e));
  };
  
  const removeEvent = (id: string) => {
    setEvents(events.filter(e => e.id !== id));
  };

  const getDebtsTooltip = () => debts.filter(d => d.isActive && d.remainingAmount > 0).map(d => `${d.name}: ${d.minimumPayment}€`).join('\n') || 'Aucune dette active';
  const getBudgetsTooltip = () => budgets.filter(b => b.isActive).map(b => `${categories.find(c => c.id === b.categoryId)?.name || 'Budget'}: ${b.amount}€`).join('\n') || 'Aucun budget actif';
  const getIncomeTooltip = () => transactions.filter(t => t.isRecurring && t.type === 'income').map(t => `${t.description}: ${t.amount}€`).join('\n') || 'Moyenne sur 6 mois';
  const getFixedTooltip = () => transactions.filter(t => t.isRecurring && (t.type === 'expense' || t.type === 'bill')).map(t => `${t.description}: ${t.amount}€`).join('\n') || 'Moyenne sur 6 mois';
  const getSavingsTooltip = () => transactions.filter(t => t.isRecurring && t.type === 'transfer' && !t.isExcludedFromReports).map(t => `${t.description}: ${t.amount}€`).join('\n') || 'Moyenne sur 6 mois';

  const totalExpenses = currentFixed + currentDebts + currentSavings + currentBudgets;
  const surplus = currentIncome - totalExpenses;
  const marginPercent = currentIncome > 0 ? (surplus / currentIncome) * 100 : 0;
  
  // Calculate true projections using actual scheduled transactions
  const { trueProjection1Year, trueProjection5Years } = useMemo(() => {
    const projections = getCashFlowProjection(60);
    if (projections.length === 0) return { trueProjection1Year: 0, trueProjection5Years: 0 };
    
    let cumulativeDelta = 0;
    let trueProj1Y = 0;
    let trueProj5Y = 0;
    
    projections.forEach((proj, i) => {
      const projMonth = proj.date.toISOString().substring(0, 7);
      
      let monthIncome = currentIncome;
      let monthFixed = currentFixed;
      let monthDebts = currentDebts;
      let monthBudgets = currentBudgets;
      let monthSavings = currentSavings;
      
      events.forEach(e => {
        if (e.date <= projMonth) {
          const val = parseFloat(e.newValue) || 0;
          if (e.type === 'income') monthIncome = val;
          if (e.type === 'fixed') monthFixed = val;
          if (e.type === 'debts') monthDebts = val;
          if (e.type === 'budgets') monthBudgets = val;
          if (e.type === 'savings') monthSavings = val;
        }
      });
      
      // Calculate the true delta on PATRIMONY (Checking + Savings).
      // Savings is an internal transfer, so it doesn't reduce total patrimony.
      const monthPatrimonySurplus = monthIncome - (monthFixed + monthDebts + monthBudgets);
      const baselinePatrimonySurplus = baselineIncome - (baselineFixed + baselineDebts + baselineBudgets);
      
      cumulativeDelta += (monthPatrimonySurplus - baselinePatrimonySurplus);
      
      if (i === 11) trueProj1Y = proj.projectedTotalBalance + cumulativeDelta;
      if (i === 59) trueProj5Y = proj.projectedTotalBalance + cumulativeDelta;
    });

    return { trueProjection1Year: trueProj1Y, trueProjection5Years: trueProj5Y };
  }, [getCashFlowProjection, currentIncome, currentFixed, currentDebts, currentBudgets, currentSavings, baselineIncome, baselineFixed, baselineDebts, baselineBudgets, baselineSavings, events]);

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
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Revenus nets mensuels (€) <Info className="h-4 w-4 text-gray-400 cursor-help" title={getIncomeTooltip()} />
              </label>
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
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Charges fixes (Loyer, Assurances...) (€) <Info className="h-4 w-4 text-gray-400 cursor-help" title={getFixedTooltip()} />
              </label>
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
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Remboursements de Dettes (€) <Info className="h-4 w-4 text-gray-400 cursor-help" title={getDebtsTooltip()} />
              </label>
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
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Budgets de vie (Courses, Loisirs...) (€) <Info className="h-4 w-4 text-gray-400 cursor-help" title={getBudgetsTooltip()} />
              </label>
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
            
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Épargne mensuelle (€) <Info className="h-4 w-4 text-gray-400 cursor-help" title={getSavingsTooltip()} />
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={simSavings}
                  onChange={(e) => setSimSavings(e.target.value)}
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
                setSimSavings(baselineSavings.toString());
              }}
              className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
            >
              Réinitialiser avec mes vraies moyennes
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-indigo-500" />
              Événements futurs
            </h2>
            <button onClick={addEvent} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-3 py-1.5 rounded-lg flex items-center gap-1">
              <Plus className="h-4 w-4" /> Ajouter
            </button>
          </div>
          
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Définissez vos changements de vie pour ajuster dynamiquement les prévisions à long terme.
          </p>

          <div className="space-y-3">
            {events.map(event => (
              <div key={event.id} className="flex flex-col gap-3 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                <div className="flex gap-3">
                  <input 
                    type="month" 
                    value={event.date}
                    onChange={e => updateEvent(event.id, { date: e.target.value })}
                    className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 dark:text-white"
                  />
                  <select 
                    value={event.type}
                    onChange={e => updateEvent(event.id, { type: e.target.value as any })}
                    className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 dark:text-white"
                  >
                    <option value="income">Revenus</option>
                    <option value="fixed">Charges fixes</option>
                    <option value="debts">Dettes</option>
                    <option value="budgets">Budgets</option>
                    <option value="savings">Épargne</option>
                  </select>
                </div>
                <div className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <input 
                      type="number"
                      value={event.newValue}
                      onChange={e => updateEvent(event.id, { newValue: e.target.value })}
                      className="w-full pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-indigo-500"
                      placeholder="Nouveau montant..."
                    />
                    <Euro className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                  </div>
                  <button onClick={() => removeEvent(event.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-md shrink-0 transition-colors">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
            {events.length === 0 && (
              <div className="text-center py-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-500">
                Aucun événement futur programmé.
              </div>
            )}
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
          
          <div className="mt-4 p-4 border border-gray-100 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Prévision du Patrimoine (avec vos transactions planifiées)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Dans 1 an</p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{trueProjection1Year.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Dans 5 ans</p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{trueProjection5Years.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3 italic">
              * Inclut la réalité de vos comptes (épargne + courant) et intègre vos futures transactions planifiées.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BudgetSimulator;
