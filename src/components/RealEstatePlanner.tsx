import React, { useState, useMemo, useEffect } from 'react';
import {
  Home,
  Calculator,
  Users,
  Percent,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  FileText,
  Plus,
  Trash2,
  Save,
  Scale,
  Landmark,
  Euro,
  HelpCircle,
  TrendingDown,
  Building2,
  RotateCcw,
  ArrowUpRight,
  Info
} from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';
import { useAuth } from '../contexts/AuthContext';
import { RealEstatePlan } from '../types';

const defaultPlan: RealEstatePlan = {
  id: 'plan-1',
  name: 'Maison principale',
  propertyType: 'old',
  propertyPrice: 280000,
  notaryFeesRate: 7.5,
  notaryFeesAmount: 21000,
  useCustomNotaryFees: false,
  agencyFees: 0,
  renovationBudget: 15000,
  bankGuaranteeFees: 2500,

  buyerAName: 'Arthur',
  buyerAIncome: 2173,
  buyerAContribution: 30000,
  buyerBName: 'Conjoint(e)',
  buyerBIncome: 2100,
  buyerBContribution: 15000,

  ownershipSplitMode: 'pro_rata_total',
  customOwnershipRatioA: 60,

  hasPtz: true,
  ptzAmount: 60000,
  ptzDurationYears: 20,
  ptzDeferredYears: 5,
  ptzInsuranceRate: 0.30,

  mainLoanDurationYears: 25,
  mainLoanInterestRate: 3.40,
  mainLoanInsuranceRate: 0.34,

  monthlySplitMode: 'pro_rata_income',
  customMonthlyRatioA: 55,
};

const RealEstatePlanner: React.FC = () => {
  const { householdConfig, addAsset, addDebt } = useBudget();
  const { user } = useAuth();
  const storageKey = `pathly_real_estate_plans_${user?.id || 'guest'}`;

  // State for plans
  const [plans, setPlans] = useState<RealEstatePlan[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse real estate plans', e);
    }

    // Initialize with householdConfig defaults if available
    const init = { ...defaultPlan };
    if (householdConfig?.userA?.name) init.buyerAName = householdConfig.userA.name;
    if (householdConfig?.userA?.income) init.buyerAIncome = householdConfig.userA.income;
    if (householdConfig?.userB?.name) init.buyerBName = householdConfig.userB.name;
    if (householdConfig?.userB?.income) init.buyerBIncome = householdConfig.userB.income;
    return [init];
  });

  const [activePlanId, setActivePlanId] = useState<string>(plans[0]?.id || 'plan-1');
  const [showIntegrateModal, setShowIntegrateModal] = useState(false);
  const [integratedSuccess, setIntegratedSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'project' | 'borrowers' | 'loans' | 'analysis'>('project');

  // Save to localStorage whenever plans change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(plans));
    } catch (e) {
      console.error('Failed to save real estate plans to localStorage', e);
    }
  }, [plans, storageKey]);

  const currentPlan = useMemo(() => {
    return plans.find(p => p.id === activePlanId) || plans[0] || defaultPlan;
  }, [plans, activePlanId]);

  const updateCurrentPlan = (updates: Partial<RealEstatePlan>) => {
    setPlans(prev => prev.map(p => p.id === currentPlan.id ? { ...p, ...updates } : p));
  };

  const handleAddNewPlan = () => {
    const newId = `plan-${Date.now()}`;
    const newPlan: RealEstatePlan = {
      ...defaultPlan,
      id: newId,
      name: `Projet ${plans.length + 1}`,
      buyerAName: householdConfig?.userA?.name || 'Arthur',
      buyerAIncome: householdConfig?.userA?.income || 2173,
      buyerBName: householdConfig?.userB?.name || 'Conjoint(e)',
      buyerBIncome: householdConfig?.userB?.income || 2100,
    };
    setPlans(prev => [...prev, newPlan]);
    setActivePlanId(newId);
  };

  const handleDeletePlan = (id: string) => {
    if (plans.length <= 1) {
      alert('Vous devez conserver au moins un scénario de projet immobilier.');
      return;
    }
    if (confirm('Voulez-vous vraiment supprimer ce scénario ?')) {
      const remaining = plans.filter(p => p.id !== id);
      setPlans(remaining);
      setActivePlanId(remaining[0].id);
    }
  };

  // ==========================================
  // FINANCIAL CALCULATIONS
  // ==========================================
  const calculations = useMemo(() => {
    const p = currentPlan;

    // 1. Notary fees
    const calculatedNotaryFees = Math.round(p.propertyPrice * (p.notaryFeesRate / 100));
    const finalNotaryFees = p.useCustomNotaryFees ? p.notaryFeesAmount : calculatedNotaryFees;

    // 2. Total operation cost
    const totalCost = p.propertyPrice + finalNotaryFees + p.agencyFees + p.renovationBudget + p.bankGuaranteeFees;

    // 3. Total down payment (apports)
    const totalContribution = p.buyerAContribution + p.buyerBContribution;
    const contributionRatioA = totalContribution > 0 ? (p.buyerAContribution / totalContribution) * 100 : 50;
    const contributionRatioB = 100 - contributionRatioA;

    // 4. Amount to borrow
    const totalBorrowing = Math.max(0, totalCost - totalContribution);

    // 5. PTZ (Prêt à Taux Zéro)
    const ptzPrincipal = p.hasPtz ? Math.min(p.ptzAmount, totalBorrowing) : 0;
    const ptzDurationMonths = p.ptzDurationYears * 12;
    const ptzDeferredMonths = p.ptzDeferredYears * 12;
    const ptzAmortizationMonths = Math.max(1, ptzDurationMonths - ptzDeferredMonths);

    const ptzMonthlyInsurance = ptzPrincipal > 0 ? (ptzPrincipal * (p.ptzInsuranceRate / 100)) / 12 : 0;
    const ptzMonthlyCapital = ptzPrincipal > 0 ? ptzPrincipal / ptzAmortizationMonths : 0;

    // Phase 1 (during deferral) & Phase 2 (after deferral)
    const ptzMonthlyDuringDeferral = ptzMonthlyInsurance;
    const ptzMonthlyAfterDeferral = ptzMonthlyCapital + ptzMonthlyInsurance;

    // 6. Main Loan (Classique)
    const mainLoanPrincipal = Math.max(0, totalBorrowing - ptzPrincipal);
    const mainLoanDurationMonths = p.mainLoanDurationYears * 12;
    const monthlyRate = (p.mainLoanInterestRate / 100) / 12;

    const mainLoanMonthlyCapitalInterest = mainLoanPrincipal > 0
      ? (monthlyRate > 0
        ? (mainLoanPrincipal * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -mainLoanDurationMonths))))
        : (mainLoanPrincipal / mainLoanDurationMonths))
      : 0;

    const mainLoanMonthlyInsurance = mainLoanPrincipal > 0
      ? (mainLoanPrincipal * (p.mainLoanInsuranceRate / 100)) / 12
      : 0;

    const mainLoanMonthlyTotal = mainLoanMonthlyCapitalInterest + mainLoanMonthlyInsurance;

    // 7. Global monthly payment
    // Phase 1 (years 1 to ptzDeferredYears) vs Phase 2 (years ptzDeferredYears to end of PTZ)
    const totalMonthlyPhase1 = mainLoanMonthlyTotal + (p.hasPtz ? (p.ptzDeferredYears > 0 ? ptzMonthlyDuringDeferral : ptzMonthlyAfterDeferral) : 0);
    const totalMonthlyPhase2 = mainLoanMonthlyTotal + (p.hasPtz ? ptzMonthlyAfterDeferral : 0);

    // Reference monthly payment for standard budget calculation (Phase 2 if deferred, or Phase 1)
    const representativeMonthly = p.hasPtz && p.ptzDeferredYears > 0 ? totalMonthlyPhase2 : totalMonthlyPhase1;

    // 8. Total cost of credit
    const totalMainLoanInterests = (mainLoanMonthlyCapitalInterest * mainLoanDurationMonths) - mainLoanPrincipal;
    const totalMainLoanInsurance = mainLoanMonthlyInsurance * mainLoanDurationMonths;
    const totalPtzInsurance = ptzMonthlyInsurance * ptzDurationMonths;
    const totalCreditCost = totalMainLoanInterests + totalMainLoanInsurance + totalPtzInsurance;

    // 9. Monthly repayment split between A and B
    const totalIncome = p.buyerAIncome + p.buyerBIncome;
    let ratioMonthlyA = 50;

    if (p.monthlySplitMode === '50_50') {
      ratioMonthlyA = 50;
    } else if (p.monthlySplitMode === 'pro_rata_income') {
      ratioMonthlyA = totalIncome > 0 ? Math.round((p.buyerAIncome / totalIncome) * 1000) / 10 : 50;
    } else if (p.monthlySplitMode === 'ownership_ratio') {
      ratioMonthlyA = p.ownershipSplitMode === 'custom'
        ? p.customOwnershipRatioA
        : p.ownershipSplitMode === '50_50'
          ? 50
          : 50; // will be updated below
    } else if (p.monthlySplitMode === 'custom') {
      ratioMonthlyA = p.customMonthlyRatioA;
    }

    const ratioMonthlyB = Math.round((100 - ratioMonthlyA) * 10) / 10;

    const monthlyA = representativeMonthly * (ratioMonthlyA / 100);
    const monthlyB = representativeMonthly * (ratioMonthlyB / 100);

    // 10. Debt Ratios & Left-to-live
    const debtRatioA = p.buyerAIncome > 0 ? (monthlyA / p.buyerAIncome) * 100 : 0;
    const debtRatioB = p.buyerBIncome > 0 ? (monthlyB / p.buyerBIncome) * 100 : 0;
    const debtRatioHousehold = totalIncome > 0 ? (representativeMonthly / totalIncome) * 100 : 0;

    const leftToLiveA = p.buyerAIncome - monthlyA;
    const leftToLiveB = p.buyerBIncome - monthlyB;
    const leftToLiveHousehold = totalIncome - representativeMonthly;

    // 11. Lifetime Financial Effort & Equitable Notarial Split
    // Total invested = Down payment + All monthly repayments over the loan horizon
    const totalRepaidOverTime = (mainLoanMonthlyTotal * mainLoanDurationMonths) +
      (p.hasPtz ? ((ptzMonthlyDuringDeferral * ptzDeferredMonths) + (ptzMonthlyAfterDeferral * ptzAmortizationMonths)) : 0);

    const totalRepaidByA = totalRepaidOverTime * (ratioMonthlyA / 100);
    const totalRepaidByB = totalRepaidOverTime * (ratioMonthlyB / 100);

    const totalEffortA = p.buyerAContribution + totalRepaidByA;
    const totalEffortB = p.buyerBContribution + totalRepaidByB;
    const grandTotalEffort = totalEffortA + totalEffortB;

    const equitableRatioA = grandTotalEffort > 0 ? Math.round((totalEffortA / grandTotalEffort) * 1000) / 10 : 50;
    const equitableRatioB = Math.round((100 - equitableRatioA) * 10) / 10;

    // Official ownership ratio selected
    let officialRatioA = 50;
    if (p.ownershipSplitMode === 'pro_rata_total') {
      officialRatioA = equitableRatioA;
    } else if (p.ownershipSplitMode === '50_50') {
      officialRatioA = 50;
    } else {
      officialRatioA = p.customOwnershipRatioA;
    }
    const officialRatioB = Math.round((100 - officialRatioA) * 10) / 10;

    return {
      finalNotaryFees,
      totalCost,
      totalContribution,
      contributionRatioA,
      contributionRatioB,
      totalBorrowing,
      ptzPrincipal,
      ptzMonthlyInsurance,
      ptzMonthlyCapital,
      ptzMonthlyDuringDeferral,
      ptzMonthlyAfterDeferral,
      mainLoanPrincipal,
      mainLoanMonthlyCapitalInterest,
      mainLoanMonthlyInsurance,
      mainLoanMonthlyTotal,
      totalMonthlyPhase1,
      totalMonthlyPhase2,
      representativeMonthly,
      totalMainLoanInterests,
      totalCreditCost,
      ratioMonthlyA,
      ratioMonthlyB,
      monthlyA,
      monthlyB,
      debtRatioA,
      debtRatioB,
      debtRatioHousehold,
      leftToLiveA,
      leftToLiveB,
      leftToLiveHousehold,
      totalEffortA,
      totalEffortB,
      grandTotalEffort,
      equitableRatioA,
      equitableRatioB,
      officialRatioA,
      officialRatioB,
    };
  }, [currentPlan]);

  // Integration into Pathly: Creates the Real Estate Asset and 2 Debts (Main Loan + PTZ)
  const handleIntegrateIntoPathly = async () => {
    try {
      // 1. Add Asset in Biens & Patrimoine
      await addAsset({
        name: currentPlan.name || 'Maison principale',
        category: 'real_estate',
        purchasePrice: currentPlan.propertyPrice,
        currentValue: currentPlan.propertyPrice,
        purchaseDate: new Date().toISOString().split('T')[0],
        notes: `Achat financé avec ${calculations.totalContribution.toLocaleString('fr-FR')} € d'apport et ${calculations.totalBorrowing.toLocaleString('fr-FR')} € d'emprunt (dont PTZ). Quote-part: ${currentPlan.buyerAName} (${calculations.officialRatioA}%) / ${currentPlan.buyerBName} (${calculations.officialRatioB}%).`,
      });

      // 2. Add Main Mortgage in Dettes
      if (calculations.mainLoanPrincipal > 0) {
        await addDebt({
          name: `Prêt Immo Principal - ${currentPlan.name}`,
          totalAmount: calculations.mainLoanPrincipal,
          remainingAmount: calculations.mainLoanPrincipal,
          interestRate: currentPlan.mainLoanInterestRate,
          minimumPayment: Math.round(calculations.mainLoanMonthlyTotal * 100) / 100,
          type: 'mortgage',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          description: `Prêt immobilier amortissable sur ${currentPlan.mainLoanDurationYears} ans (${currentPlan.mainLoanInterestRate}% + ${currentPlan.mainLoanInsuranceRate}% assurance). Mensualité: ${calculations.mainLoanMonthlyTotal.toFixed(2)} €/mois.`,
        });
      }

      // 3. Add PTZ in Dettes (if applicable)
      if (currentPlan.hasPtz && calculations.ptzPrincipal > 0) {
        await addDebt({
          name: `Prêt à Taux Zéro (PTZ) - ${currentPlan.name}`,
          totalAmount: calculations.ptzPrincipal,
          remainingAmount: calculations.ptzPrincipal,
          interestRate: 0,
          minimumPayment: Math.round(calculations.ptzMonthlyAfterDeferral * 100) / 100,
          type: 'mortgage',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          description: `PTZ 0% sur ${currentPlan.ptzDurationYears} ans avec ${currentPlan.ptzDeferredYears} ans de différé. Mensualité pleine: ${calculations.ptzMonthlyAfterDeferral.toFixed(2)} €/mois (assurance incluse).`,
        });
      }

      setIntegratedSuccess(true);
      setTimeout(() => {
        setIntegratedSuccess(false);
        setShowIntegrateModal(false);
      }, 2000);
    } catch (err) {
      console.error('Error integrating real estate plan:', err);
      alert('Une erreur est survenue lors de la création du bien et des crédits.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Scenarios */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl shadow-md">
              <Home className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Projet Immobilier & Financement PTZ
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Planifiez votre achat de maison à deux : apport de chacun, PTZ, prêt principal et clé notariée équitable.
              </p>
            </div>
          </div>
        </div>

        {/* Scenarios switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl">
            {plans.map(p => (
              <button
                key={p.id}
                onClick={() => setActivePlanId(p.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  p.id === activePlanId
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>

          <button
            onClick={handleAddNewPlan}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-xs font-semibold transition-colors"
            title="Nouveau scénario"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nouveau</span>
          </button>

          {plans.length > 1 && (
            <button
              onClick={() => handleDeletePlan(currentPlan.id)}
              className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              title="Supprimer ce scénario"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={() => setShowIntegrateModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-md transition-all hover:scale-[1.02]"
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Intégrer à Pathly</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cost */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-2">
            <span>Coût total du projet</span>
            <Euro className="h-4 w-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {calculations.totalCost.toLocaleString('fr-FR')} €
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Bien: {currentPlan.propertyPrice.toLocaleString('fr-FR')} €</span>
            <span className="font-semibold text-slate-600 dark:text-slate-300">Notaire: {calculations.finalNotaryFees.toLocaleString('fr-FR')} €</span>
          </div>
        </div>

        {/* Down Payment (Apport) */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-2">
            <span>Apport total réuni</span>
            <Users className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
            {calculations.totalContribution.toLocaleString('fr-FR')} €
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>{currentPlan.buyerAName}: {currentPlan.buyerAContribution.toLocaleString('fr-FR')} €</span>
            <span>{currentPlan.buyerBName}: {currentPlan.buyerBContribution.toLocaleString('fr-FR')} €</span>
          </div>
        </div>

        {/* Monthly Payment */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-2">
            <span>Mensualité globale crédit</span>
            <Landmark className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
            {Math.round(calculations.representativeMonthly).toLocaleString('fr-FR')} € <span className="text-xs font-medium text-slate-500">/mois</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {currentPlan.hasPtz && currentPlan.ptzDeferredYears > 0 ? (
              <span className="text-purple-600 dark:text-purple-300 font-medium">
                Phase 1 (différé): {Math.round(calculations.totalMonthlyPhase1)} € puis {Math.round(calculations.totalMonthlyPhase2)} €
              </span>
            ) : (
              <span>Prêt: {Math.round(calculations.mainLoanMonthlyTotal)} € {currentPlan.hasPtz ? `+ PTZ: ${Math.round(calculations.ptzMonthlyAfterDeferral)} €` : ''}</span>
            )}
          </div>
        </div>

        {/* Debt Ratio (Endettement) */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-2">
            <span>Taux d'endettement global</span>
            <Percent className="h-4 w-4 text-slate-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className={`text-2xl font-black ${
              calculations.debtRatioHousehold <= 33
                ? 'text-emerald-600 dark:text-emerald-400'
                : calculations.debtRatioHousehold <= 35
                  ? 'text-amber-500 dark:text-amber-400'
                  : 'text-rose-600 dark:text-rose-400'
            }`}>
              {calculations.debtRatioHousehold.toFixed(1)} %
            </span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              calculations.debtRatioHousehold <= 35
                ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
            }`}>
              {calculations.debtRatioHousehold <= 35 ? 'Conforme HCSF' : 'Dépassé (>35%)'}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Reste à vivre couple: <strong>{Math.round(calculations.leftToLiveHousehold).toLocaleString('fr-FR')} €</strong>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 space-x-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('project')}
          className={`pb-3 border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'project'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Home className="h-4 w-4" />
          <span>1. Le Bien & Coûts</span>
        </button>
        <button
          onClick={() => setActiveTab('borrowers')}
          className={`pb-3 border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'borrowers'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>2. Co-Emprunteurs & Apports</span>
        </button>
        <button
          onClick={() => setActiveTab('loans')}
          className={`pb-3 border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'loans'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Landmark className="h-4 w-4" />
          <span>3. Financement & PTZ</span>
        </button>
        <button
          onClick={() => setActiveTab('analysis')}
          className={`pb-3 border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'analysis'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Scale className="h-4 w-4" />
          <span>4. Clé Notariée & Mensualités</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: LE BIEN & COÛTS DE L'OPÉRATION */}
      {/* ======================================================== */}
      {activeTab === 'project' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Home className="h-5 w-5 text-indigo-500" />
              <span>Paramètres du Bien Immobilier</span>
            </h3>

            {/* Scenario Name */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Nom du scénario / du projet
              </label>
              <input
                type="text"
                value={currentPlan.name}
                onChange={e => updateCurrentPlan({ name: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:text-white"
                placeholder="Ex: Maison rénovée, Pavillon 4 pièces..."
              />
            </div>

            {/* Property Type */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                Type de projet immobilier
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => updateCurrentPlan({ propertyType: 'old', notaryFeesRate: 7.5 })}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    currentPlan.propertyType === 'old'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="font-bold text-sm">Ancien</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Frais notaire ~7.5%</div>
                </button>

                <button
                  type="button"
                  onClick={() => updateCurrentPlan({ propertyType: 'new', notaryFeesRate: 2.5 })}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    currentPlan.propertyType === 'new'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="font-bold text-sm">Neuf / VEFA</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Frais réduits ~2.5%</div>
                </button>

                <button
                  type="button"
                  onClick={() => updateCurrentPlan({ propertyType: 'construction', notaryFeesRate: 4.5 })}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    currentPlan.propertyType === 'construction'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="font-bold text-sm">Terrain + Constr.</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Notaire terrain seul</div>
                </button>
              </div>
            </div>

            {/* Prices & Fees */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Prix d'achat net vendeur (€) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1000"
                    min="0"
                    value={currentPlan.propertyPrice || ''}
                    onChange={e => updateCurrentPlan({ propertyPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:text-white"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 text-sm">€</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Frais de notaire (€)
                  </label>
                  <button
                    type="button"
                    onClick={() => updateCurrentPlan({ useCustomNotaryFees: !currentPlan.useCustomNotaryFees })}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {currentPlan.useCustomNotaryFees ? 'Revenir au taux auto' : 'Saisir un montant exact'}
                  </button>
                </div>
                {currentPlan.useCustomNotaryFees ? (
                  <div className="relative">
                    <input
                      type="number"
                      step="500"
                      min="0"
                      value={currentPlan.notaryFeesAmount || ''}
                      onChange={e => updateCurrentPlan({ notaryFeesAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:text-white"
                      placeholder="Montant du notaire"
                    />
                    <span className="absolute right-3 top-2.5 text-slate-400 text-sm">€</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <div className="relative w-28">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="20"
                        value={currentPlan.notaryFeesRate || ''}
                        onChange={e => updateCurrentPlan({ notaryFeesRate: parseFloat(e.target.value) || 0 })}
                        className="w-full pl-3 pr-6 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:text-white"
                      />
                      <span className="absolute right-2 top-2.5 text-slate-400 text-xs">%</span>
                    </div>
                    <div className="flex-1 py-2.5 px-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 text-right">
                      {calculations.finalNotaryFees.toLocaleString('fr-FR')} €
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Budget travaux prévus (€)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="500"
                    min="0"
                    value={currentPlan.renovationBudget || ''}
                    onChange={e => updateCurrentPlan({ renovationBudget: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:text-white"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 text-sm">€</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Garantie bancaire & dossier (€)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="100"
                    min="0"
                    value={currentPlan.bankGuaranteeFees || ''}
                    onChange={e => updateCurrentPlan({ bankGuaranteeFees: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:text-white"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 text-sm">€</span>
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown summary card */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-lg space-y-4">
            <h4 className="font-bold text-sm tracking-wider uppercase text-indigo-300">
              Décomposition du Coût Total
            </h4>

            <div className="space-y-3 pt-2 text-sm">
              <div className="flex justify-between items-center py-1.5 border-b border-indigo-900/60">
                <span className="text-slate-300">Prix d'achat net</span>
                <span className="font-bold">{currentPlan.propertyPrice.toLocaleString('fr-FR')} €</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-indigo-900/60">
                <span className="text-slate-300">Frais de notaire</span>
                <span className="font-bold">{calculations.finalNotaryFees.toLocaleString('fr-FR')} €</span>
              </div>
              {currentPlan.renovationBudget > 0 && (
                <div className="flex justify-between items-center py-1.5 border-b border-indigo-900/60">
                  <span className="text-slate-300">Enveloppe travaux</span>
                  <span className="font-bold">{currentPlan.renovationBudget.toLocaleString('fr-FR')} €</span>
                </div>
              )}
              {currentPlan.bankGuaranteeFees > 0 && (
                <div className="flex justify-between items-center py-1.5 border-b border-indigo-900/60">
                  <span className="text-slate-300">Frais garantie & dossier</span>
                  <span className="font-bold">{currentPlan.bankGuaranteeFees.toLocaleString('fr-FR')} €</span>
                </div>
              )}

              <div className="pt-3 flex justify-between items-baseline text-base font-black">
                <span className="text-indigo-200">Total à financer</span>
                <span className="text-2xl text-emerald-400">
                  {calculations.totalCost.toLocaleString('fr-FR')} €
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-indigo-900/40 border border-indigo-800/60 rounded-xl text-xs text-indigo-200 leading-relaxed">
              <Info className="h-4 w-4 inline mr-1.5 text-indigo-300" />
              Ce montant correspond à la totalité des fonds nécessaires pour signer l'acte authentique chez le notaire et démarrer vos travaux.
            </div>

            <button
              onClick={() => setActiveTab('borrowers')}
              className="w-full mt-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold transition-colors flex items-center justify-center space-x-2"
            >
              <span>Étape suivante : Apports des co-emprunteurs</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: CO-EMPRUNTEURS & APPORTS */}
      {/* ======================================================== */}
      {activeTab === 'borrowers' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Buyer A */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border-2 border-indigo-500/40 dark:border-indigo-500/30 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-black text-sm">
                  1
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">Co-emprunteur 1</h3>
                  <p className="text-xs text-slate-500">Moi / Premier signataire</p>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full">
                {calculations.contributionRatioA.toFixed(1)}% de l'apport
              </span>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Prénom / Nom
                </label>
                <input
                  type="text"
                  value={currentPlan.buyerAName}
                  onChange={e => updateCurrentPlan({ buyerAName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Revenu net mensuel (€ / mois) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="50"
                    min="0"
                    value={currentPlan.buyerAIncome || ''}
                    onChange={e => updateCurrentPlan({ buyerAIncome: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 text-sm">€</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Apport personnel personnel (€) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="500"
                    min="0"
                    value={currentPlan.buyerAContribution || ''}
                    onChange={e => updateCurrentPlan({ buyerAContribution: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-black text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 text-sm">€</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Épargne personnelle injectée dans le projet immobilier.
                </p>
              </div>
            </div>
          </div>

          {/* Buyer B */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border-2 border-purple-500/40 dark:border-purple-500/30 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300 flex items-center justify-center font-black text-sm">
                  2
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">Co-emprunteur 2</h3>
                  <p className="text-xs text-slate-500">Conjoint(e) / Deuxième signataire</p>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-full">
                {calculations.contributionRatioB.toFixed(1)}% de l'apport
              </span>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Prénom / Nom
                </label>
                <input
                  type="text"
                  value={currentPlan.buyerBName}
                  onChange={e => updateCurrentPlan({ buyerBName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-purple-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Revenu net mensuel (€ / mois) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="50"
                    min="0"
                    value={currentPlan.buyerBIncome || ''}
                    onChange={e => updateCurrentPlan({ buyerBIncome: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-purple-500 dark:text-white"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 text-sm">€</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Apport personnel (€) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="500"
                    min="0"
                    value={currentPlan.buyerBContribution || ''}
                    onChange={e => updateCurrentPlan({ buyerBContribution: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-black text-purple-600 dark:text-purple-400 focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="absolute right-3 top-2.5 text-slate-400 text-sm">€</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Épargne personnelle injectée par le/la conjoint(e).
                </p>
              </div>
            </div>
          </div>

          {/* Combined Equity Summary Card */}
          <div className="lg:col-span-2 bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Scale className="h-4 w-4 text-indigo-500" />
                <span>Bilan des apports pour le crédit</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sur un projet total de <strong>{calculations.totalCost.toLocaleString('fr-FR')} €</strong>, vos apports couvrent <strong>{((calculations.totalContribution / (calculations.totalCost || 1)) * 100).toFixed(1)}%</strong> du budget.
              </p>
            </div>

            <div className="flex items-center space-x-6 text-sm">
              <div className="text-right">
                <span className="block text-xs text-slate-400">Apport global</span>
                <span className="text-lg font-black text-slate-900 dark:text-white">
                  {calculations.totalContribution.toLocaleString('fr-FR')} €
                </span>
              </div>
              <div className="text-right">
                <span className="block text-xs text-slate-400">Reste à emprunter</span>
                <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                  {calculations.totalBorrowing.toLocaleString('fr-FR')} €
                </span>
              </div>
              <button
                onClick={() => setActiveTab('loans')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Configurer le PTZ & Crédit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: LE PLAN DE FINANCEMENT : PRÊT PRINCIPAL + PTZ */}
      {/* ======================================================== */}
      {activeTab === 'loans' && (
        <div className="space-y-6">
          {/* PTZ Configuration Card */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border-2 border-emerald-500/40 dark:border-emerald-500/30 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-xl font-black">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Prêt à Taux Zéro (PTZ)</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                      0 % d'intérêt d'État
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">Prêt aidé sans intérêts pour primo-accédants (neuf ou ancien avec 25% de travaux)</p>
                </div>
              </div>

              {/* Toggle PTZ */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentPlan.hasPtz}
                  onChange={e => updateCurrentPlan({ hasPtz: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                <span className="ml-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  {currentPlan.hasPtz ? 'Inclus' : 'Désactivé'}
                </span>
              </label>
            </div>

            {currentPlan.hasPtz && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Montant du PTZ (€) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1000"
                      min="0"
                      max={calculations.totalBorrowing}
                      value={currentPlan.ptzAmount || ''}
                      onChange={e => updateCurrentPlan({ ptzAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-3 pr-7 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-black text-emerald-600 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute right-3 top-2 text-slate-400 text-xs">€</span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Max conseillé : 40% à 50% du projet
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Durée totale du PTZ
                  </label>
                  <select
                    value={currentPlan.ptzDurationYears}
                    onChange={e => updateCurrentPlan({ ptzDurationYears: parseInt(e.target.value) || 20 })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500 dark:text-white"
                  >
                    <option value={15}>15 ans (180 mois)</option>
                    <option value={20}>20 ans (240 mois)</option>
                    <option value={25}>25 ans (300 mois)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Différé de remboursement
                  </label>
                  <select
                    value={currentPlan.ptzDeferredYears}
                    onChange={e => updateCurrentPlan({ ptzDeferredYears: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500 dark:text-white"
                  >
                    <option value={0}>Aucun différé (0 an)</option>
                    <option value={5}>5 ans de différé total</option>
                    <option value={8}>8 ans de différé total</option>
                    <option value={10}>10 ans de différé total</option>
                  </select>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Pendant le différé, seul l'assurance est due
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Taux assurance PTZ (% / an)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      value={currentPlan.ptzInsuranceRate || ''}
                      onChange={e => updateCurrentPlan({ ptzInsuranceRate: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-3 pr-7 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500 dark:text-white"
                    />
                    <span className="absolute right-3 top-2 text-slate-400 text-xs">%</span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Moyenne : 0.25% à 0.35%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Main Loan Configuration Card */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border-2 border-indigo-500/40 dark:border-indigo-500/30 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-xl font-black">
                  <Landmark className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Prêt Immobilier Principal (Classique)</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                      Montant calculé : {calculations.mainLoanPrincipal.toLocaleString('fr-FR')} €
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Complète le financement après déduction des apports et du montant du PTZ.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-100 dark:border-slate-700">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Durée du prêt principal (années)
                </label>
                <select
                  value={currentPlan.mainLoanDurationYears}
                  onChange={e => updateCurrentPlan({ mainLoanDurationYears: parseInt(e.target.value) || 25 })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 dark:text-white"
                >
                  <option value={15}>15 ans (180 mensualités)</option>
                  <option value={20}>20 ans (240 mensualités)</option>
                  <option value={25}>25 ans (300 mensualités)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Taux d'intérêt nominal (% / an) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={currentPlan.mainLoanInterestRate || ''}
                    onChange={e => updateCurrentPlan({ mainLoanInterestRate: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-3 pr-7 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-bold text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="absolute right-3 top-2 text-slate-400 text-xs">%</span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Taux fixe banque (ex: 3.40%)</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Taux assurance emprunteur (% / an)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    value={currentPlan.mainLoanInsuranceRate || ''}
                    onChange={e => updateCurrentPlan({ mainLoanInsuranceRate: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-3 pr-7 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                  <span className="absolute right-3 top-2 text-slate-400 text-xs">%</span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Généralement 0.30% à 0.40%</span>
              </div>
            </div>
          </div>

          {/* Monthly Payment Summary Box */}
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1">
              <span className="text-xs uppercase font-bold text-indigo-400 tracking-wider">
                Synthèse Mensualités de Remboursement
              </span>
              <h4 className="text-xl font-black">
                {Math.round(calculations.representativeMonthly).toLocaleString('fr-FR')} € <span className="text-xs text-slate-400">/ mois</span>
              </h4>
              <p className="text-xs text-slate-300">
                Prêt classique : {Math.round(calculations.mainLoanMonthlyTotal).toLocaleString('fr-FR')} €/m
                {currentPlan.hasPtz && ` + PTZ : ${Math.round(calculations.ptzMonthlyAfterDeferral).toLocaleString('fr-FR')} €/m`}
                &nbsp;• Coût total du crédit : {Math.round(calculations.totalCreditCost).toLocaleString('fr-FR')} €
              </p>
            </div>

            <button
              onClick={() => setActiveTab('analysis')}
              className="px-5 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-xl font-bold text-xs tracking-wide transition-all shadow-md flex items-center space-x-2 shrink-0"
            >
              <span>Voir la répartition à deux & clé notariée</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: ANALYSE ÉQUITÉ NOTARIÉE & RÉPARTITION MENSUALITÉS */}
      {/* ======================================================== */}
      {activeTab === 'analysis' && (
        <div className="space-y-6">
          {/* Controls for Monthly Split & Ownership Split */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            {/* Monthly split rule */}
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-2">
                Comment répartissez-vous la mensualité chaque mois ?
              </label>
              <div className="space-y-2">
                {[
                  { id: 'pro_rata_income', label: 'Au prorata des revenus nets', desc: `Selon vos salaires (${calculations.ratioMonthlyA}% / ${calculations.ratioMonthlyB}%)` },
                  { id: '50_50', label: '50% / 50% (À parts égales)', desc: 'Chacun paie exactement la moitié de l\'échéance' },
                  { id: 'custom', label: 'Personnalisé', desc: 'Réglez vous-mêmes les pourcentages mensuels' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateCurrentPlan({ monthlySplitMode: opt.id as any })}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                      currentPlan.monthlySplitMode === opt.id
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="text-sm">{opt.label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>

              {currentPlan.monthlySplitMode === 'custom' && (
                <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    <span>Part de {currentPlan.buyerAName}: {currentPlan.customMonthlyRatioA}%</span>
                    <span>Part de {currentPlan.buyerBName}: {100 - currentPlan.customMonthlyRatioA}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    value={currentPlan.customMonthlyRatioA}
                    onChange={e => updateCurrentPlan({ customMonthlyRatioA: parseInt(e.target.value) || 50 })}
                    className="w-full accent-indigo-600"
                  />
                </div>
              )}
            </div>

            {/* Ownership split (Notarial Split) */}
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-2">
                Quelle quote-part de propriété inscrire chez le Notaire ?
              </label>
              <div className="space-y-2">
                {[
                  {
                    id: 'pro_rata_total',
                    label: 'Au prorata de l\'effort total (Recommandé)',
                    desc: `Reflète l'apport initial + les remboursements (${calculations.equitableRatioA}% / ${calculations.equitableRatioB}%)`
                  },
                  {
                    id: '50_50',
                    label: '50% / 50% (Copropriété égale)',
                    desc: 'Chacun est propriétaire de la moitié de la maison'
                  },
                  {
                    id: 'custom',
                    label: 'Quote-part personnalisée',
                    desc: 'Fixez librement la part de chacun dans l\'acte d\'achat'
                  }
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateCurrentPlan({ ownershipSplitMode: opt.id as any })}
                    className={`w-full p-3 rounded-xl border text-left transition-all ${
                      currentPlan.ownershipSplitMode === opt.id
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="text-sm">{opt.label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>

              {currentPlan.ownershipSplitMode === 'custom' && (
                <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    <span>Propriété {currentPlan.buyerAName}: {currentPlan.customOwnershipRatioA}%</span>
                    <span>Propriété {currentPlan.buyerBName}: {100 - currentPlan.customOwnershipRatioA}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    value={currentPlan.customOwnershipRatioA}
                    onChange={e => updateCurrentPlan({ customOwnershipRatioA: parseInt(e.target.value) || 50 })}
                    className="w-full accent-indigo-600"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Individual Impact Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Buyer A details */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">A</div>
                  <span>Impact pour {currentPlan.buyerAName}</span>
                </div>
                <span className="text-xs font-black px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full">
                  Propriétaire à {calculations.officialRatioA}%
                </span>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Mensualité à sa charge</span>
                  <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                    {Math.round(calculations.monthlyA).toLocaleString('fr-FR')} € <span className="text-xs font-normal text-slate-400">/ mois</span>
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Taux d'endettement individuel</span>
                  <div className="flex items-center space-x-2">
                    <span className={`font-bold ${calculations.debtRatioA <= 35 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {calculations.debtRatioA.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-slate-400">(max 35%)</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Reste à vivre mensuel</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {Math.round(calculations.leftToLiveA).toLocaleString('fr-FR')} €
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500 flex justify-between">
                  <span>Effort financier total sur 25 ans :</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {Math.round(calculations.totalEffortA).toLocaleString('fr-FR')} € ({calculations.equitableRatioA}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Buyer B details */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs">B</div>
                  <span>Impact pour {currentPlan.buyerBName}</span>
                </div>
                <span className="text-xs font-black px-2.5 py-1 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-full">
                  Propriétaire à {calculations.officialRatioB}%
                </span>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Mensualité à sa charge</span>
                  <span className="text-lg font-black text-purple-600 dark:text-purple-400">
                    {Math.round(calculations.monthlyB).toLocaleString('fr-FR')} € <span className="text-xs font-normal text-slate-400">/ mois</span>
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Taux d'endettement individuel</span>
                  <div className="flex items-center space-x-2">
                    <span className={`font-bold ${calculations.debtRatioB <= 35 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {calculations.debtRatioB.toFixed(1)}%
                    </span>
                    <span className="text-[10px] text-slate-400">(max 35%)</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Reste à vivre mensuel</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {Math.round(calculations.leftToLiveB).toLocaleString('fr-FR')} €
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500 flex justify-between">
                  <span>Effort financier total sur 25 ans :</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {Math.round(calculations.totalEffortB).toLocaleString('fr-FR')} € ({calculations.equitableRatioB}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Legal / Notarial Protection Advice */}
          <div className="p-5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-900/40 rounded-2xl space-y-2">
            <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <span>Conseil Notarial & Protection Juridique du Couple</span>
            </h4>
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              En cas de séparation ou de revente du bien, le prix de vente net est partagé <strong>strictement selon la quote-part inscrite dans l'acte notarié</strong> (actuellement fixée à {calculations.officialRatioA}% / {calculations.officialRatioB}%), indépendamment de qui a payé quoi au jour le jour.
              {Math.abs(calculations.officialRatioA - calculations.equitableRatioA) > 2 && (
                <span className="block mt-1 font-semibold text-amber-900 dark:text-amber-100">
                  Attention : votre quote-part notariée ({calculations.officialRatioA}%) diffère de l'effort financier réel cumulé ({calculations.equitableRatioA}%). Nous vous conseillons de demander à votre notaire d'inscrire l'exact prorata ou d'ajouter une convention d'apport initial.
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Integration Modal */}
      {showIntegrateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Intégrer ce projet dans Pathly
                </h3>
                <p className="text-xs text-slate-500">
                  Crée automatiquement le bien dans votre patrimoine et les prêts dans vos dettes.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2 text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>1 Bien immobilier créé : "{currentPlan.name}" ({currentPlan.propertyPrice.toLocaleString('fr-FR')} €)</span>
              </div>
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>1 Prêt principal créé : {calculations.mainLoanPrincipal.toLocaleString('fr-FR')} € ({Math.round(calculations.mainLoanMonthlyTotal)} €/m)</span>
              </div>
              {currentPlan.hasPtz && calculations.ptzPrincipal > 0 && (
                <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>1 Prêt PTZ à 0% créé : {calculations.ptzPrincipal.toLocaleString('fr-FR')} €</span>
                </div>
              )}
            </div>

            {integratedSuccess ? (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-center font-bold text-xs">
                Projet et crédits ajoutés avec succès à votre Pathly !
              </div>
            ) : (
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowIntegrateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleIntegrateIntoPathly}
                  className="px-5 py-2.5 text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl shadow-md transition-all"
                >
                  Confirmer et créer dans Pathly
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RealEstatePlanner;
