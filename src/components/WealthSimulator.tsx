import React, { useState, useMemo } from 'react';
import { TrendingUp, Calculator, Target, DollarSign, Percent, Calendar } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { useBudget } from '../contexts/BudgetContext';

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

const WealthSimulator: React.FC = () => {
  const { accounts, savingsGoals } = useBudget();
  
  const [scenarios, setScenarios] = useState<SimulationScenario[]>([
    {
      id: 'scenario-1',
      name: 'Scénario conservateur',
      currentWealth: accounts.reduce((sum, acc) => sum + acc.balance, 0),
      monthlyContribution: 500,
      years: 30,
      returnRate: 4,
      inflationRate: 2,
      taxRate: 30,
      withdrawalRate: 4,
    }
  ]);
  
  const [activeScenario, setActiveScenario] = useState(scenarios[0]);
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

  const calculateProjection = (scenario: SimulationScenario) => {
    const { currentWealth, monthlyContribution, years, returnRate, inflationRate } = scenario;
    const monthlyRate = returnRate / 100 / 12;
    const months = years * 12;
    
    const projections = [];
    let currentValue = currentWealth;
    
    for (let month = 0; month <= months; month++) {
      if (month > 0) {
        // Add monthly contribution
        currentValue += monthlyContribution;
        // Apply monthly return
        currentValue *= (1 + monthlyRate);
      }
      
      // Calculate real value (adjusted for inflation)
      const inflationAdjusted = currentValue / Math.pow(1 + inflationRate / 100, month / 12);
      
      projections.push({
        month,
        year: month / 12,
        nominalValue: currentValue,
        realValue: inflationAdjusted,
        totalContributions: currentWealth + (monthlyContribution * month),
        gains: currentValue - (currentWealth + (monthlyContribution * month)),
      });
    }
    
    return projections;
  };

  const calculateRetirementIncome = (scenario: SimulationScenario) => {
    const projections = calculateProjection(scenario);
    const finalValue = projections[projections.length - 1];
    
    const grossAnnualIncome = finalValue.nominalValue * (scenario.withdrawalRate / 100);
    const netAnnualIncome = grossAnnualIncome * (1 - scenario.taxRate / 100);
    const monthlyIncome = netAnnualIncome / 12;
    
    return {
      grossAnnual: grossAnnualIncome,
      netAnnual: netAnnualIncome,
      monthly: monthlyIncome,
      finalWealth: finalValue.nominalValue,
      realFinalWealth: finalValue.realValue,
      totalContributions: finalValue.totalContributions,
      totalGains: finalValue.gains,
    };
  };

  const chartData = useMemo(() => {
    const projections = calculateProjection(activeScenario);
    
    return {
      labels: projections.filter((_, index) => index % 12 === 0).map(p => `Année ${Math.floor(p.year)}`),
      datasets: [
        {
          label: 'Valeur nominale',
          data: projections.filter((_, index) => index % 12 === 0).map(p => p.nominalValue),
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: false,
          tension: 0.4,
        },
        {
          label: 'Valeur réelle (inflation ajustée)',
          data: projections.filter((_, index) => index % 12 === 0).map(p => p.realValue),
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: false,
          tension: 0.4,
        },
        {
          label: 'Contributions totales',
          data: projections.filter((_, index) => index % 12 === 0).map(p => p.totalContributions),
          borderColor: '#F59E0B',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          fill: false,
          tension: 0.4,
        },
      ],
    };
  }, [activeScenario]);

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