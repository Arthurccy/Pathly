import React, { useState, useMemo } from 'react';
import { TrendingUp, Calculator, Target, DollarSign, Percent, Calendar, CalendarClock, Home, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { useBudget } from '../contexts/BudgetContext';
import { useAuth } from '../contexts/AuthContext';

interface SimulationScenario {
  id: string;
  name: string;
  currentWealth: number;
  monthlyContribution: number;
  years: number;
  returnRate: number;
  inflationRate: number;
  taxRate: number;
  withdrawalRate: number;
}

const parseEventValue = (input: string, currentValue: number): number => {
  const trimmed = (input || '').trim();
  if (!trimmed) return currentValue; 
  
  if (trimmed.endsWith('%')) {
    const percent = parseFloat(trimmed.slice(0, -1));
    if (!isNaN(percent)) {
      if (trimmed.startsWith('+') || trimmed.startsWith('-')) {
        return currentValue * (1 + percent / 100);
      }
      return currentValue * (percent / 100);
    }
  }
  
  if (trimmed.startsWith('+') || trimmed.startsWith('-')) {
    const val = parseFloat(trimmed);
    if (!isNaN(val)) return currentValue + val;
  }
  
  const absoluteVal = parseFloat(trimmed);
  return isNaN(absoluteVal) ? currentValue : absoluteVal;
};

const WealthSimulator: React.FC = () => {
  const { accounts, savingsGoals, simulatedEvents, totalAssetsValue, assets, debts, realEstatePlans } = useBudget();
  const { user } = useAuth();
  
  // Helper to detect if an asset is a future planned acquisition
  const isFutureAsset = (asset: any): boolean => {
    if (asset?.isPlanned) return true;
    if (!asset?.purchaseDate) return false;
    try {
      const pDate = new Date(asset.purchaseDate);
      const now = new Date();
      return (pDate.getFullYear() > now.getFullYear()) || 
             (pDate.getFullYear() === now.getFullYear() && pDate.getMonth() > now.getMonth());
    } catch {
      return false;
    }
  };

  // Helper to detect if a debt starts in the future (like planned 2029 mortgage)
  const isFutureDebt = (debt: any): boolean => {
    if (!debt?.dueDate) return false;
    try {
      const dDate = new Date(debt.dueDate);
      const now = new Date();
      return (dDate.getFullYear() > now.getFullYear()) || 
             (dDate.getFullYear() === now.getFullYear() && dDate.getMonth() > now.getMonth());
    } catch {
      return false;
    }
  };

  // Current owned physical assets (excluding future planned house)
  const currentOwnedAssets = useMemo(() => {
    return (assets || []).filter(a => !isFutureAsset(a));
  }, [assets]);

  const currentOwnedAssetsValue = useMemo(() => {
    return currentOwnedAssets.reduce((sum, a) => sum + (Number(a.currentValue) || 0), 0);
  }, [currentOwnedAssets]);

  // Current liquid accounts (checking + savings + PEA/CTO investments)
  const currentLiquidWealth = useMemo(() => {
    return (accounts || []).filter(a => a.isActive).reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  }, [accounts]);

  // Current active debts (excluding 2029 mortgage)
  const currentActiveDebtsTotal = useMemo(() => {
    return (debts || [])
      .filter(d => d.isActive && !isFutureDebt(d))
      .reduce((sum, d) => sum + (Number(d.remainingAmount) || 0), 0);
  }, [debts]);

  // True live net worth right now:
  const liveNetWorth = useMemo(() => {
    return Math.round((currentLiquidWealth + currentOwnedAssetsValue - currentActiveDebtsTotal) * 100) / 100;
  }, [currentLiquidWealth, currentOwnedAssetsValue, currentActiveDebtsTotal]);

  // Planned real estate project
  const plannedRealEstate = useMemo(() => {
    if (realEstatePlans && realEstatePlans.length > 0 && realEstatePlans[0].propertyPrice > 0) {
      return realEstatePlans[0];
    }
    return null;
  }, [realEstatePlans]);

  const [includeRealEstate, setIncludeRealEstate] = useState<boolean>(true);

  const storageKey = `pathly_wealth_scenarios_${user?.id || 'guest'}`;

  const defaultScenario: SimulationScenario = {
    id: 'scenario-1',
    name: 'Scénario conservateur',
    currentWealth: liveNetWorth > 0 ? liveNetWorth : (accounts.reduce((sum, acc) => sum + acc.balance, 0) + currentOwnedAssetsValue),
    monthlyContribution: 500,
    years: 30,
    returnRate: 4,
    inflationRate: 2,
    taxRate: 30,
    withdrawalRate: 4,
  };

  const [scenarios, setScenarios] = useState<SimulationScenario[]>(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse scenarios', e);
      }
    }
    return [defaultScenario];
  });
  
  React.useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(scenarios));
  }, [scenarios, storageKey]);

  const [activeScenario, setActiveScenario] = useState<SimulationScenario>(scenarios[0]);
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    currentWealth: '',
    monthlyContribution: '',
    years: '',
    returnRate: '',
    inflationRate: '',
    taxRate: '',
    withdrawalRate: '',
  });

  const syncWithLiveNetWorth = () => {
    const updatedScenario = {
      ...activeScenario,
      currentWealth: liveNetWorth
    };
    setActiveScenario(updatedScenario);
    setScenarios(scenarios.map(s => s.id === updatedScenario.id ? updatedScenario : s));
  };

  const calculateProjection = (scenario: SimulationScenario) => {
    const { currentWealth, monthlyContribution, years, returnRate, inflationRate } = scenario;
    const monthlyRate = returnRate / 100 / 12;
    const months = years * 12;
    
    const projections: any[] = [];
    const now = new Date();

    // Planned real estate setup
    const hasRealEstate = Boolean(includeRealEstate && plannedRealEstate);
    const targetDateStr = plannedRealEstate?.targetDate || '2029-03';
    const propertyPrice = plannedRealEstate?.propertyPrice || 0;
    const totalApport = (plannedRealEstate?.buyerAContribution || 0) + (plannedRealEstate?.buyerBContribution || 0);
    const arthurApport = plannedRealEstate?.buyerAContribution || totalApport || 0;
    const totalCost = propertyPrice + (plannedRealEstate?.notaryFeesAmount || 0) + (plannedRealEstate?.renovationBudget || 0) + (plannedRealEstate?.bankGuaranteeFees || 0);
    const initialMortgage = Math.max(0, totalCost - totalApport);

    const loanMonths = (plannedRealEstate?.mainLoanDurationYears || 25) * 12;
    const loanRate = plannedRealEstate?.mainLoanInterestRate || 3.5;
    const loanMonthlyRate = loanRate / 100 / 12;
    const standardMonthlyMortgage = loanMonths > 0 && initialMortgage > 0
      ? (loanMonthlyRate > 0
          ? (initialMortgage * (loanMonthlyRate * Math.pow(1 + loanMonthlyRate, loanMonths))) / (Math.pow(1 + loanMonthlyRate, loanMonths) - 1)
          : initialMortgage / loanMonths)
      : 0;

    // Liquid part of initial wealth
    let liquidCapital = Math.max(0, currentWealth - currentOwnedAssetsValue);
    let runningContribution = monthlyContribution;
    let totalInvested = currentWealth;
    let housePurchased = false;
    let remainingMortgage = 0;
    let cumulatedPrincipalRepaid = 0;

    for (let month = 0; month <= months; month++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() + month, 1);
      const monthKey = monthDate.toISOString().substring(0, 7);

      if (month > 0) {
        // Simulated events (future savings adjustments)
        simulatedEvents.forEach(e => {
          if (e.date === monthKey) {
            if (e.type === 'savings') {
              runningContribution = parseEventValue(e.newValue, runningContribution);
            }
          }
        });

        // Real estate trigger at target date
        if (hasRealEstate && !housePurchased && monthKey >= targetDateStr) {
          housePurchased = true;
          liquidCapital = Math.max(0, liquidCapital - arthurApport);
          remainingMortgage = initialMortgage;
        }

        // Monthly mortgage amortization: principal builds real estate equity
        if (housePurchased && remainingMortgage > 0) {
          const monthlyInterest = remainingMortgage * loanMonthlyRate;
          const principalPaid = Math.max(0, standardMonthlyMortgage - monthlyInterest);
          remainingMortgage = Math.max(0, remainingMortgage - principalPaid);
          cumulatedPrincipalRepaid += principalPaid;
        }

        // Liquid investment growth
        liquidCapital += runningContribution;
        totalInvested += runningContribution;
        liquidCapital *= (1 + monthlyRate);
      }

      const homeEquity = housePurchased ? Math.max(0, propertyPrice - remainingMortgage) : 0;
      const nominalValue = liquidCapital + homeEquity + currentOwnedAssetsValue;
      const inflationAdjusted = nominalValue / Math.pow(1 + inflationRate / 100, month / 12);

      projections.push({
        month,
        year: month / 12,
        nominalValue,
        realValue: inflationAdjusted,
        liquidValue: liquidCapital,
        homeEquity,
        totalContributions: totalInvested + (housePurchased ? arthurApport + cumulatedPrincipalRepaid : 0),
        gains: Math.max(0, nominalValue - (totalInvested + (housePurchased ? arthurApport + cumulatedPrincipalRepaid : 0))),
        housePurchased
      });
    }
    
    return projections;
  };

  const calculateRetirementIncome = (scenario: SimulationScenario) => {
    const projections = calculateProjection(scenario);
    const finalValue = projections[projections.length - 1];
    
    // 4% safe withdrawal rate is applied to liquid / invested wealth
    const grossAnnualIncome = (finalValue.liquidValue || finalValue.nominalValue) * (scenario.withdrawalRate / 100);
    const netAnnualIncome = grossAnnualIncome * (1 - scenario.taxRate / 100);
    const monthlyIncome = netAnnualIncome / 12;
    
    return {
      grossAnnual: grossAnnualIncome,
      netAnnual: netAnnualIncome,
      monthly: monthlyIncome,
      finalWealth: finalValue.nominalValue,
      realFinalWealth: finalValue.realValue,
      finalLiquid: finalValue.liquidValue,
      finalRealEstateEquity: finalValue.homeEquity,
      totalContributions: finalValue.totalContributions,
      totalGains: finalValue.gains,
    };
  };

  const chartData = useMemo(() => {
    const projections = calculateProjection(activeScenario);
    const yearlySnaps = projections.filter((_, index) => index % 12 === 0);
    
    const datasets: any[] = [
      {
        label: 'Patrimoine Total (Nominal)',
        data: yearlySnaps.map(p => p.nominalValue),
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: false,
        tension: 0.3,
        borderWidth: 3,
      },
      {
        label: 'Valeur réelle (inflation ajustée)',
        data: yearlySnaps.map(p => p.realValue),
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: false,
        tension: 0.3,
        borderWidth: 2,
      },
    ];

    if (includeRealEstate && plannedRealEstate) {
      datasets.push({
        label: 'Part Immobilière Détenue (Equity nette)',
        data: yearlySnaps.map(p => p.homeEquity),
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: false,
        tension: 0.3,
        borderWidth: 2,
      });
      datasets.push({
        label: 'Portefeuille Financier & Épargne',
        data: yearlySnaps.map(p => p.liquidValue),
        borderColor: '#8B5CF6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        fill: false,
        tension: 0.3,
        borderWidth: 2,
        borderDash: [5, 5],
      });
    }

    datasets.push({
      label: 'Contributions & Apports totaux',
      data: yearlySnaps.map(p => p.totalContributions),
      borderColor: '#94A3B8',
      backgroundColor: 'rgba(148, 163, 184, 0.1)',
      fill: false,
      tension: 0.3,
      borderWidth: 1.5,
      borderDash: [3, 3],
    });
    
    return {
      labels: yearlySnaps.map(p => `Année ${Math.floor(p.year)}`),
      datasets,
    };
  }, [activeScenario, simulatedEvents, includeRealEstate, plannedRealEstate]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: document.documentElement.classList.contains('dark') ? '#D1D5DB' : '#374151',
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.parsed.y;
            return `${context.dataset.label}: ${value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: document.documentElement.classList.contains('dark') ? '#374151' : '#E5E7EB',
        },
        ticks: {
          color: document.documentElement.classList.contains('dark') ? '#D1D5DB' : '#374151',
        },
      },
      y: {
        grid: {
          color: document.documentElement.classList.contains('dark') ? '#374151' : '#E5E7EB',
        },
        ticks: {
          color: document.documentElement.classList.contains('dark') ? '#D1D5DB' : '#374151',
          callback: (value: any) => `${(value / 1000).toFixed(0)}k €`,
        },
      },
    },
  };

  const retirementData = calculateRetirementIncome(activeScenario);

  const addScenario = () => {
    if (!formData.name) {
      alert('Veuillez saisir un nom pour le scénario');
      return;
    }

    const newScenario: SimulationScenario = {
      id: 'scenario-' + Date.now(),
      name: formData.name,
      currentWealth: parseFloat(formData.currentWealth) || 0,
      monthlyContribution: parseFloat(formData.monthlyContribution) || 0,
      years: parseInt(formData.years) || 30,
      returnRate: parseFloat(formData.returnRate) || 4,
      inflationRate: parseFloat(formData.inflationRate) || 2,
      taxRate: parseFloat(formData.taxRate) || 30,
      withdrawalRate: parseFloat(formData.withdrawalRate) || 4,
    };

    setScenarios([...scenarios, newScenario]);
    setActiveScenario(newScenario);
    setShowForm(false);
    setFormData({
      name: '',
      currentWealth: '',
      monthlyContribution: '',
      years: '',
      returnRate: '',
      inflationRate: '',
      taxRate: '',
      withdrawalRate: '',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
            <Calculator className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Simulateur de patrimoine
          </h1>
        </div>
        
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Target className="h-5 w-5" />
          <span>Nouveau scénario</span>
        </button>
      </div>

      {/* Scenario Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-2">
          {scenarios.map(scenario => (
            <button
              key={scenario.id}
              onClick={() => setActiveScenario(scenario)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeScenario.id === scenario.id
                  ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {scenario.name}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Créer un nouveau scénario
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nom du scénario *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Ex: Scénario optimiste"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Patrimoine actuel (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.currentWealth}
                onChange={(e) => setFormData({ ...formData, currentWealth: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="50000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Épargne mensuelle (€)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.monthlyContribution}
                onChange={(e) => setFormData({ ...formData, monthlyContribution: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Durée (années)
              </label>
              <input
                type="number"
                value={formData.years}
                onChange={(e) => setFormData({ ...formData, years: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Rendement annuel (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.returnRate}
                onChange={(e) => setFormData({ ...formData, returnRate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="7"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Inflation annuelle (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.inflationRate}
                onChange={(e) => setFormData({ ...formData, inflationRate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Taux d'imposition (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.taxRate}
                onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Taux de retrait (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.withdrawalRate}
                onChange={(e) => setFormData({ ...formData, withdrawalRate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="4"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={addScenario}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              Créer le scénario
            </button>
          </div>
        </div>
      )}

      {/* Current Scenario Parameters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Paramètres: {activeScenario.name}
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg mb-2">
              <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400 mx-auto" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Patrimoine initial</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {activeScenario.currentWealth.toLocaleString('fr-FR')} €
            </p>
            {totalAssetsValue > 0 && (
              <span className="block text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                dont {totalAssetsValue.toLocaleString('fr-FR')} € de biens
              </span>
            )}
          </div>
          
          <div className="text-center">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg mb-2">
              <Calendar className="h-6 w-6 text-green-600 dark:text-green-400 mx-auto" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Épargne mensuelle</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {activeScenario.monthlyContribution.toLocaleString('fr-FR')} €
            </p>
          </div>
          
          <div className="text-center">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg mb-2">
              <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400 mx-auto" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Rendement annuel</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {activeScenario.returnRate}%
            </p>
          </div>
          
          <div className="text-center">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg mb-2">
              <Percent className="h-6 w-6 text-orange-600 dark:text-orange-400 mx-auto" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Durée</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {activeScenario.years} ans
            </p>
          </div>
        </div>
      </div>

      {/* Real Estate Project Integration Card */}
      {plannedRealEstate && (
        <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/80 to-purple-50/70 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-purple-950/30 rounded-xl border border-blue-200 dark:border-blue-800/60 p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-sm shrink-0">
                <Home className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {plannedRealEstate.name || 'Projet Immobilier'}
                  </h3>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    Achat prévu : {plannedRealEstate.targetDate || '2029-03'}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Bien de <strong>{plannedRealEstate.propertyPrice.toLocaleString('fr-FR')} €</strong> • Apport prévu de <strong>{((plannedRealEstate.buyerAContribution || 0) + (plannedRealEstate.buyerBContribution || 0)).toLocaleString('fr-FR')} €</strong> • Prêt amortissable sur {plannedRealEstate.mainLoanDurationYears || 25} ans à {plannedRealEstate.mainLoanInterestRate || 3.5}%
                </p>
              </div>
            </div>

            <label className="inline-flex items-center gap-2.5 cursor-pointer select-none bg-white dark:bg-gray-800 px-4 py-2.5 rounded-xl border border-blue-200 dark:border-blue-700 shadow-sm hover:border-blue-400 transition-colors shrink-0">
              <input
                type="checkbox"
                checked={includeRealEstate}
                onChange={e => setIncludeRealEstate(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                Intégrer le bien à la projection 30 ans
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Synchronized Future Events */}
      {simulatedEvents.length > 0 && (
        <div className="bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-base font-semibold text-indigo-950 dark:text-indigo-100">
                Événements futurs synchronisés ({simulatedEvents.length})
              </h3>
            </div>
            <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 px-2.5 py-1 rounded-full">
              Sauvegardés en BDD & intégrés au patrimoine
            </span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            Ces changements de vie planifiés dans le Simulateur de Budget ajustent dynamiquement les contributions sur votre courbe de patrimoine :
          </p>
          <div className="flex flex-wrap gap-2">
            {simulatedEvents.map(e => (
              <span
                key={e.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-indigo-200 dark:border-indigo-800 shadow-sm"
              >
                <span className="font-semibold">{e.date}</span> : <span className="capitalize text-indigo-600 dark:text-indigo-400 font-bold">{e.type}</span> ({e.newValue || 'auto'})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Évolution du patrimoine
          </h3>
          <div className="h-64">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Résultats de la simulation
          </h3>
          
          <div className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                Patrimoine final (nominal)
              </p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                {retirementData.finalWealth.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </p>
            </div>
            
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                Patrimoine final (réel)
              </p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {retirementData.realFinalWealth.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </p>
            </div>
            
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                Revenu mensuel net (règle des {activeScenario.withdrawalRate}%)
              </p>
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                {retirementData.monthly.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Contributions totales</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {retirementData.totalContributions.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Plus-values</p>
                <p className="font-semibold text-green-600 dark:text-green-400">
                  {retirementData.totalGains.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Educational Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          💡 Comprendre la simulation
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Règle des 4%</h4>
            <p className="text-gray-600 dark:text-gray-400">
              Cette règle suggère qu'on peut retirer 4% de son patrimoine chaque année en retraite 
              sans risquer de l'épuiser sur 30 ans.
            </p>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Inflation</h4>
            <p className="text-gray-600 dark:text-gray-400">
              L'inflation réduit le pouvoir d'achat au fil du temps. La valeur "réelle" 
              montre ce que vaudra votre argent en euros d'aujourd'hui.
            </p>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Intérêts composés</h4>
            <p className="text-gray-600 dark:text-gray-400">
              Vos gains génèrent eux-mêmes des gains. Plus vous commencez tôt, 
              plus cet effet est puissant.
            </p>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Diversification</h4>
            <p className="text-gray-600 dark:text-gray-400">
              Ces projections sont théoriques. En réalité, diversifiez vos investissements 
              et adaptez votre stratégie selon votre profil de risque.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WealthSimulator;