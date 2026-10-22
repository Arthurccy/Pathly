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
  Info,
  Calendar,
  Clock,
  TrendingUp,
  Tag,
  Copy,
  RefreshCw,
  Layers,
  Zap,
  Award
} from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';
import { useAuth } from '../contexts/AuthContext';
import { RealEstatePlan, SalaryEvolution } from '../types';

interface RealEstatePlannerProps {
  onViewChange?: (view: string) => void;
}

const createBlankPlan = (id: string, name: string, buyerAName: string, buyerAIncome: number, buyerBName: string, buyerBIncome: number): RealEstatePlan => {
  const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().substring(0, 7);
  return {
    id,
    name,
    targetDate: nextYear,
    propertyType: 'old',
    propertyPrice: 0,
    notaryFeesRate: 7.5,
    notaryFeesAmount: 0,
    useCustomNotaryFees: false,
    agencyFees: 0,
    renovationBudget: 0,
    bankGuaranteeFees: 0,

    buyerAName,
    buyerAIncome,
    buyerAContribution: 0,
    buyerBName,
    buyerBIncome,
    buyerBContribution: 0,
    salaryEvolutions: [],

    ownershipSplitMode: 'pro_rata_total',
    customOwnershipRatioA: 50,

    hasPtz: false,
    useLoanSmoothing: true,
    ptzAmount: 0,
    ptzDurationYears: 20,
    ptzDeferredYears: 0,
    ptzInsuranceRate: 0.30,

    mainLoanDurationYears: 25,
    mainLoanInterestRate: 3.40,
    mainLoanInsuranceRate: 0.34,

    monthlySplitMode: 'pro_rata_income',
    customMonthlyRatioA: 50,
  };
};

const RealEstatePlanner: React.FC<RealEstatePlannerProps> = ({ onViewChange }) => {
  const { householdConfig, assets, addAsset, updateAsset, deleteAsset, debts, addDebt, updateDebt, deleteDebt, accounts, realEstatePlans, saveRealEstatePlans } = useBudget();
  const { user } = useAuth();

  const [activePlanId, setActivePlanId] = useState<string>(() => {
    return realEstatePlans[0]?.id || '';
  });
  const [showIntegrateModal, setShowIntegrateModal] = useState(false);
  const [integratedSuccess, setIntegratedSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'project' | 'borrowers' | 'loans' | 'analysis'>('project');

  // Form states for adding a new salary evolution
  const [newEvoBorrower, setNewEvoBorrower] = useState<'buyerA' | 'buyerB'>('buyerA');
  const [newEvoDate, setNewEvoDate] = useState<string>('2027-01');
  const [newEvoIncome, setNewEvoIncome] = useState<string>('');
  const [newEvoNote, setNewEvoNote] = useState<string>('');
  const [showAddEvoForm, setShowAddEvoForm] = useState(false);

  // Always ensure activePlanId points to a valid plan when plans are loaded or modified
  useEffect(() => {
    if (realEstatePlans && realEstatePlans.length > 0) {
      if (!activePlanId || !realEstatePlans.some(p => p.id === activePlanId)) {
        setActivePlanId(realEstatePlans[0].id);
      }
    }
  }, [realEstatePlans, activePlanId]);

  const currentPlan = useMemo(() => {
    if (!realEstatePlans || realEstatePlans.length === 0) return null;
    return realEstatePlans.find(p => p.id === activePlanId) || realEstatePlans[0];
  }, [realEstatePlans, activePlanId]);

  // Find linked asset in Pathly if already integrated
  const linkedAsset = useMemo(() => {
    if (!currentPlan) return null;
    return assets.find(a => 
      (currentPlan.assetId && a.id === currentPlan.assetId) ||
      a.realEstatePlanId === currentPlan.id ||
      (a.category === 'real_estate' && a.name === currentPlan.name)
    ) || null;
  }, [assets, currentPlan]);

  const updateCurrentPlan = async (updates: Partial<RealEstatePlan>) => {
    if (!currentPlan) return;
    const updated = realEstatePlans.map(p => p.id === currentPlan.id ? { ...p, ...updates } : p);
    await saveRealEstatePlans(updated);
  };

  const handleDuplicatePlan = async (sourcePlan: RealEstatePlan) => {
    const defaultNameA = householdConfig?.userA?.name || 'Moi';
    const defaultNameB = householdConfig?.userB?.name || 'Conjoint(e)';
    const newId = `plan-${Date.now()}`;
    const duplicated: RealEstatePlan = {
      ...sourcePlan,
      id: newId,
      name: `${sourcePlan.name} (Variante)`,
      assetId: undefined,
      mainLoanDebtId: undefined,
      ptzDebtId: undefined,
    };
    await saveRealEstatePlans([...realEstatePlans, duplicated]);
    setActivePlanId(newId);
  };

  const handleUnlinkFromPathly = async () => {
    if (!linkedAsset) return;
    if (confirm(`Voulez-vous retirer le bien "${linkedAsset.name}" et ses prêts associés de votre patrimoine ?`)) {
      await deleteAsset(linkedAsset.id);
      const debtsToDelete = debts.filter(d => 
        (linkedAsset.debtIds && linkedAsset.debtIds.includes(d.id)) ||
        d.id === linkedAsset.debtId ||
        d.id === currentPlan?.mainLoanDebtId ||
        d.id === currentPlan?.ptzDebtId
      );
      for (const d of debtsToDelete) {
        await deleteDebt(d.id);
      }
      await updateCurrentPlan({
        assetId: undefined,
        mainLoanDebtId: undefined,
        ptzDebtId: undefined,
      });
      setShowIntegrateModal(false);
    }
  };

  const handleCreateFirstPlan = async () => {
    const defaultNameA = householdConfig?.userA?.name || user?.user_metadata?.name || 'Moi';
    const defaultIncomeA = householdConfig?.userA?.income || 0;
    const defaultNameB = householdConfig?.userB?.name || 'Conjoint(e)';
    const defaultIncomeB = householdConfig?.userB?.income || 0;

    const newId = `plan-${Date.now()}`;
    const newPlan = createBlankPlan(newId, 'Mon Projet Immobilier', defaultNameA, defaultIncomeA, defaultNameB, defaultIncomeB);
    await saveRealEstatePlans([newPlan]);
    setActivePlanId(newId);
  };

  const handleAddNewPlan = async () => {
    const defaultNameA = householdConfig?.userA?.name || user?.user_metadata?.name || 'Moi';
    const defaultIncomeA = householdConfig?.userA?.income || 0;
    const defaultNameB = householdConfig?.userB?.name || 'Conjoint(e)';
    const defaultIncomeB = householdConfig?.userB?.income || 0;

    const newId = `plan-${Date.now()}`;
    const newPlan = createBlankPlan(newId, `Projet ${realEstatePlans.length + 1}`, defaultNameA, defaultIncomeA, defaultNameB, defaultIncomeB);
    await saveRealEstatePlans([...realEstatePlans, newPlan]);
    setActivePlanId(newId);
  };

  const handleDeletePlan = async (id: string) => {
    if (confirm('Voulez-vous vraiment supprimer ce projet immobilier ?')) {
      const remaining = realEstatePlans.filter(p => p.id !== id);
      await saveRealEstatePlans(remaining);
      if (remaining.length > 0) {
        setActivePlanId(remaining[0].id);
      } else {
        setActivePlanId('');
      }
    }
  };

  // Add a salary evolution to the current plan
  const handleAddSalaryEvolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPlan) return;

    const incomeVal = parseFloat(newEvoIncome);
    if (!incomeVal || incomeVal <= 0 || !newEvoDate) {
      alert('Veuillez renseigner une date et un montant de salaire valide.');
      return;
    }

    const newEvo: SalaryEvolution = {
      id: `evo-${Date.now()}`,
      borrower: newEvoBorrower,
      date: newEvoDate,
      newIncome: incomeVal,
      note: newEvoNote.trim() || undefined,
    };

    const currentEvos = currentPlan.salaryEvolutions || [];
    await updateCurrentPlan({
      salaryEvolutions: [...currentEvos, newEvo],
    });

    setNewEvoIncome('');
    setNewEvoNote('');
    setShowAddEvoForm(false);
  };

  const handleDeleteSalaryEvolution = async (id: string) => {
    if (!currentPlan) return;
    const currentEvos = currentPlan.salaryEvolutions || [];
    await updateCurrentPlan({
      salaryEvolutions: currentEvos.filter(e => e.id !== id),
    });
  };

  // ==========================================
  // FINANCIAL CALCULATIONS WITH FUTURE SALARY
  // ==========================================
  const calculations = useMemo(() => {
    if (!currentPlan) return null;
    const p = currentPlan;
    const projectTargetDate = p.targetDate || new Date().toISOString().substring(0, 7);

    // 1. Compute effective salary at project target date
    const getEffectiveIncome = (borrower: 'buyerA' | 'buyerB', baseIncome: number) => {
      const evos = (p.salaryEvolutions || [])
        .filter(e => e.borrower === borrower && e.date <= projectTargetDate)
        .sort((a, b) => a.date.localeCompare(b.date));

      if (evos.length === 0) return baseIncome;
      return evos[evos.length - 1].newIncome;
    };

    const effectiveIncomeA = getEffectiveIncome('buyerA', p.buyerAIncome || 0);
    const effectiveIncomeB = getEffectiveIncome('buyerB', p.buyerBIncome || 0);
    const totalEffectiveIncome = effectiveIncomeA + effectiveIncomeB;

    const hasIncomeChangedA = effectiveIncomeA !== (p.buyerAIncome || 0);
    const hasIncomeChangedB = effectiveIncomeB !== (p.buyerBIncome || 0);

    // 2. Notary fees
    const calculatedNotaryFees = Math.round((p.propertyPrice || 0) * ((p.notaryFeesRate || 7.5) / 100));
    const finalNotaryFees = p.useCustomNotaryFees ? (p.notaryFeesAmount || 0) : calculatedNotaryFees;

    // 3. Total operation cost
    const totalCost = (p.propertyPrice || 0) + finalNotaryFees + (p.agencyFees || 0) + (p.renovationBudget || 0) + (p.bankGuaranteeFees || 0);

    // 4. Total down payment (apports)
    const totalContribution = (p.buyerAContribution || 0) + (p.buyerBContribution || 0);
    const contributionRatioA = totalContribution > 0 ? ((p.buyerAContribution || 0) / totalContribution) * 100 : 50;
    const contributionRatioB = 100 - contributionRatioA;

    // 5. Amount to borrow
    const totalBorrowing = Math.max(0, totalCost - totalContribution);

    // 6. PTZ (Prêt à Taux Zéro)
    const ptzPrincipal = p.hasPtz ? Math.min(p.ptzAmount || 0, totalBorrowing) : 0;
    const ptzDurationMonths = (p.ptzDurationYears || 20) * 12;
    const ptzDeferredMonths = (p.ptzDeferredYears || 0) * 12;
    const ptzAmortizationMonths = Math.max(1, ptzDurationMonths - ptzDeferredMonths);

    const ptzMonthlyInsurance = ptzPrincipal > 0 ? (ptzPrincipal * ((p.ptzInsuranceRate || 0.3) / 100)) / 12 : 0;
    const ptzMonthlyCapital = ptzPrincipal > 0 ? ptzPrincipal / ptzAmortizationMonths : 0;

    const ptzMonthlyDuringDeferral = ptzMonthlyInsurance;
    const ptzMonthlyAfterDeferral = ptzMonthlyCapital + ptzMonthlyInsurance;

    // 7. Main Loan (Classique)
    const mainLoanPrincipal = Math.max(0, totalBorrowing - ptzPrincipal);
    const mainLoanDurationMonths = (p.mainLoanDurationYears || 25) * 12;
    const monthlyRate = ((p.mainLoanInterestRate || 3.4) / 100) / 12;

    const mainLoanMonthlyCapitalInterest = mainLoanPrincipal > 0
      ? (monthlyRate > 0
        ? (mainLoanPrincipal * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -mainLoanDurationMonths))))
        : (mainLoanPrincipal / mainLoanDurationMonths))
      : 0;

    const mainLoanMonthlyInsurance = mainLoanPrincipal > 0
      ? (mainLoanPrincipal * ((p.mainLoanInsuranceRate || 0.34) / 100)) / 12
      : 0;

    const mainLoanMonthlyTotal = mainLoanMonthlyCapitalInterest + mainLoanMonthlyInsurance;

    // 8. Global monthly payment & Banking Loan Smoothing (Lissage)
    const totalMonthlyPhase1 = mainLoanMonthlyTotal + (p.hasPtz ? ((p.ptzDeferredYears || 0) > 0 ? ptzMonthlyDuringDeferral : ptzMonthlyAfterDeferral) : 0);
    const totalMonthlyPhase2 = mainLoanMonthlyTotal + (p.hasPtz ? ptzMonthlyAfterDeferral : 0);

    // Dynamic target year and N-2 reference year for PTZ fiscal check
    const targetYear = parseInt((projectTargetDate || '2029-03').split('-')[0], 10) || 2029;
    const nMinus2Year = targetYear - 2;

    // PTZ 25% renovation condition in the old property stock (Ancien)
    const minTravauxForPtzInOld = Math.round(((p.propertyPrice || 0) + (p.renovationBudget || 0)) * 0.25);
    const isPtzOldEligible = p.propertyType !== 'old' || !p.hasPtz || (p.renovationBudget || 0) >= minTravauxForPtzInOld;
    const ptzTravauxDeficit = Math.max(0, minTravauxForPtzInOld - (p.renovationBudget || 0));

    // Loan smoothing calculation (Lissage de prêt bancaire à mensualité constante)
    let smoothedMonthlyTotal = 0;
    let isSmoothedActive = false;
    const useSmoothing = p.useLoanSmoothing !== false;

    if (p.hasPtz && ptzPrincipal > 0 && useSmoothing && (p.ptzDeferredYears || 0) > 0) {
      const D = mainLoanDurationMonths;
      const dDef = ptzDeferredMonths;
      const dPtz = ptzDurationMonths;
      const r = monthlyRate;
      const insMain = mainLoanMonthlyInsurance;
      const P1 = ptzMonthlyDuringDeferral;
      const P2 = ptzMonthlyAfterDeferral;

      const pvFactor = (n: number, rate: number) => {
        if (rate === 0) return n;
        return (1 - Math.pow(1 + rate, -n)) / rate;
      };

      const pvfTotal = pvFactor(D, r);
      if (pvfTotal > 0) {
        const pvPtz1 = P1 * pvFactor(dDef, r);
        const pvPtz2 = P2 * (pvFactor(Math.min(dPtz, D), r) - pvFactor(dDef, r));
        const pvPtzTotal = pvPtz1 + pvPtz2;

        const smoothedCapInt = (mainLoanPrincipal + pvPtzTotal) / pvfTotal;
        smoothedMonthlyTotal = smoothedCapInt + insMain;
        isSmoothedActive = true;
      }
    }

    const representativeMonthly = (isSmoothedActive && smoothedMonthlyTotal > 0)
      ? smoothedMonthlyTotal
      : (p.hasPtz && (p.ptzDeferredYears || 0) > 0 ? totalMonthlyPhase2 : totalMonthlyPhase1);

    // Comparatif financier : Neuf RE2020 vs Ancien
    const propertyPrice = p.propertyPrice || 0;
    const notaireNeuf = Math.round(propertyPrice * 0.025);
    const notaireAncien = Math.round(propertyPrice * 0.075);
    const notaireSavingsWithNeuf = notaireAncien - notaireNeuf;

    const totalCostNeuf = propertyPrice + notaireNeuf + (p.agencyFees || 0) + (p.renovationBudget || 0) + (p.bankGuaranteeFees || 0);
    const totalCostAncien = propertyPrice + notaireAncien + (p.agencyFees || 0) + (p.renovationBudget || 0) + (p.bankGuaranteeFees || 0);

    const borrowNeuf = Math.max(0, totalCostNeuf - totalContribution);
    const mainPrincipalNeuf = Math.max(0, borrowNeuf - ptzPrincipal);
    const mainMonthlyNeuf = mainPrincipalNeuf > 0
      ? (monthlyRate > 0
        ? (mainPrincipalNeuf * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -mainLoanDurationMonths))))
        : (mainPrincipalNeuf / mainLoanDurationMonths)) + ((mainPrincipalNeuf * ((p.mainLoanInsuranceRate || 0.34) / 100)) / 12)
      : 0;
    const ptzMonthlyNeuf = p.hasPtz ? (ptzDurationMonths > 0 ? (ptzPrincipal / ptzDurationMonths) + ptzMonthlyInsurance : 0) : 0;
    const monthlyNeuf = mainMonthlyNeuf + ptzMonthlyNeuf;
    const debtRatioNeuf = totalEffectiveIncome > 0 ? (monthlyNeuf / totalEffectiveIncome) * 100 : 0;
    const leftToLiveNeuf = totalEffectiveIncome - monthlyNeuf;

    const borrowAncienNoPtz = Math.max(0, totalCostAncien - totalContribution);
    const monthlyAncienNoPtz = borrowAncienNoPtz > 0
      ? (monthlyRate > 0
        ? (borrowAncienNoPtz * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -mainLoanDurationMonths))))
        : (borrowAncienNoPtz / mainLoanDurationMonths)) + ((borrowAncienNoPtz * ((p.mainLoanInsuranceRate || 0.34) / 100)) / 12)
      : 0;
    const debtRatioAncien = totalEffectiveIncome > 0 ? (monthlyAncienNoPtz / totalEffectiveIncome) * 100 : 0;
    const leftToLiveAncien = totalEffectiveIncome - monthlyAncienNoPtz;

    // 9. Total cost of credit
    const totalMainLoanInterests = (mainLoanMonthlyCapitalInterest * mainLoanDurationMonths) - mainLoanPrincipal;
    const totalMainLoanInsurance = mainLoanMonthlyInsurance * mainLoanDurationMonths;
    const totalPtzInsurance = ptzMonthlyInsurance * ptzDurationMonths;
    const totalCreditCost = totalMainLoanInterests + totalMainLoanInsurance + totalPtzInsurance;

    // 10. Monthly repayment split between A and B
    let ratioMonthlyA = 50;

    if (p.monthlySplitMode === '50_50') {
      ratioMonthlyA = 50;
    } else if (p.monthlySplitMode === 'pro_rata_income') {
      ratioMonthlyA = totalEffectiveIncome > 0 ? Math.round((effectiveIncomeA / totalEffectiveIncome) * 1000) / 10 : 50;
    } else if (p.monthlySplitMode === 'ownership_ratio') {
      ratioMonthlyA = p.ownershipSplitMode === 'custom'
        ? (p.customOwnershipRatioA || 50)
        : 50;
    } else if (p.monthlySplitMode === 'custom') {
      ratioMonthlyA = p.customMonthlyRatioA || 50;
    }

    const ratioMonthlyB = Math.round((100 - ratioMonthlyA) * 10) / 10;

    const monthlyA = representativeMonthly * (ratioMonthlyA / 100);
    const monthlyB = representativeMonthly * (ratioMonthlyB / 100);

    // 11. Debt Ratios & Left-to-live USING EFFECTIVE INCOMES AT TARGET DATE
    const debtRatioA = effectiveIncomeA > 0 ? (monthlyA / effectiveIncomeA) * 100 : 0;
    const debtRatioB = effectiveIncomeB > 0 ? (monthlyB / effectiveIncomeB) * 100 : 0;
    const debtRatioHousehold = totalEffectiveIncome > 0 ? (representativeMonthly / totalEffectiveIncome) * 100 : 0;

    const leftToLiveA = effectiveIncomeA - monthlyA;
    const leftToLiveB = effectiveIncomeB - monthlyB;
    const leftToLiveHousehold = totalEffectiveIncome - representativeMonthly;

    // 12. Lifetime Financial Effort & Equitable Notarial Split
    const totalRepaidOverTime = (mainLoanMonthlyTotal * mainLoanDurationMonths) +
      (p.hasPtz ? ((ptzMonthlyDuringDeferral * ptzDeferredMonths) + (ptzMonthlyAfterDeferral * ptzAmortizationMonths)) : 0);

    const totalRepaidByA = totalRepaidOverTime * (ratioMonthlyA / 100);
    const totalRepaidByB = totalRepaidOverTime * (ratioMonthlyB / 100);

    const totalEffortA = (p.buyerAContribution || 0) + totalRepaidByA;
    const totalEffortB = (p.buyerBContribution || 0) + totalRepaidByB;
    const grandTotalEffort = totalEffortA + totalEffortB;

    const equitableRatioA = grandTotalEffort > 0 ? Math.round((totalEffortA / grandTotalEffort) * 1000) / 10 : 50;
    const equitableRatioB = Math.round((100 - equitableRatioA) * 10) / 10;

    let officialRatioA = 50;
    if (p.ownershipSplitMode === 'pro_rata_total') {
      officialRatioA = equitableRatioA;
    } else if (p.ownershipSplitMode === '50_50') {
      officialRatioA = 50;
    } else {
      officialRatioA = p.customOwnershipRatioA || 50;
    }
    const officialRatioB = Math.round((100 - officialRatioA) * 10) / 10;

    return {
      projectTargetDate,
      effectiveIncomeA,
      effectiveIncomeB,
      totalEffectiveIncome,
      hasIncomeChangedA,
      hasIncomeChangedB,
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
      targetYear,
      nMinus2Year,
      minTravauxForPtzInOld,
      isPtzOldEligible,
      ptzTravauxDeficit,
      smoothedMonthlyTotal,
      isSmoothedActive,
      useSmoothing,
      notaireNeuf,
      notaireAncien,
      notaireSavingsWithNeuf,
      totalCostNeuf,
      totalCostAncien,
      monthlyNeuf,
      monthlyAncienNoPtz,
      debtRatioNeuf,
      debtRatioAncien,
      leftToLiveNeuf,
      leftToLiveAncien,
    };
  }, [currentPlan]);

  // Integration / Synchronization with Pathly (prevents duplicates)
  const handleIntegrateIntoPathly = async () => {
    if (!currentPlan || !calculations) return;

    try {
      const defaultAccount = accounts.find(a => a.isActive && (a.type === 'checking' || a.type === 'savings')) || accounts[0];
      const defaultAccountId = defaultAccount?.id || '';
      const targetDateStr = currentPlan.targetDate || '2027-06';
      const startDate = new Date(`${targetDateStr}-01`);

      const existingMainDebt = debts.find(d => 
        (currentPlan.mainLoanDebtId && d.id === currentPlan.mainLoanDebtId) ||
        d.name === `Prêt Immo Principal - ${currentPlan.name}`
      );

      const existingPtzDebt = debts.find(d => 
        (currentPlan.ptzDebtId && d.id === currentPlan.ptzDebtId) ||
        d.name === `Prêt à Taux Zéro (PTZ) - ${currentPlan.name}`
      );

      let mainDebtId = existingMainDebt?.id;
      let ptzDebtId = existingPtzDebt?.id;

      // 1. Main Loan
      if (calculations.mainLoanPrincipal > 0) {
        const mainEndDate = new Date(startDate);
        mainEndDate.setFullYear(mainEndDate.getFullYear() + (currentPlan.mainLoanDurationYears || 25));

        const mainDebtData = {
          name: `Prêt Immo Principal - ${currentPlan.name}`,
          totalAmount: calculations.mainLoanPrincipal,
          remainingAmount: calculations.mainLoanPrincipal,
          interestRate: currentPlan.mainLoanInterestRate || 3.4,
          minimumPayment: Math.round(calculations.mainLoanMonthlyTotal * 100) / 100,
          type: 'mortgage' as const,
          dueDate: startDate,
          endDate: mainEndDate,
          accountId: defaultAccountId,
          isActive: true,
          creditor: 'Banque',
          description: `Prêt immobilier sur ${currentPlan.mainLoanDurationYears || 25} ans (${currentPlan.mainLoanInterestRate}% + assurance). Mensualité: ${calculations.mainLoanMonthlyTotal.toFixed(2)} €/mois.`,
        };

        if (existingMainDebt) {
          await updateDebt(existingMainDebt.id, mainDebtData);
        } else {
          const created = await addDebt(mainDebtData);
          mainDebtId = created?.id;
        }
      } else if (existingMainDebt) {
        await deleteDebt(existingMainDebt.id);
        mainDebtId = undefined;
      }

      // 2. PTZ Loan
      if (currentPlan.hasPtz && calculations.ptzPrincipal > 0) {
        const ptzEndDate = new Date(startDate);
        ptzEndDate.setFullYear(ptzEndDate.getFullYear() + (currentPlan.ptzDurationYears || 20));

        const ptzDebtData = {
          name: `Prêt à Taux Zéro (PTZ) - ${currentPlan.name}`,
          totalAmount: calculations.ptzPrincipal,
          remainingAmount: calculations.ptzPrincipal,
          interestRate: 0,
          minimumPayment: Math.round(calculations.ptzMonthlyAfterDeferral * 100) / 100,
          type: 'mortgage' as const,
          dueDate: startDate,
          endDate: ptzEndDate,
          accountId: defaultAccountId,
          isActive: true,
          creditor: 'Banque (PTZ)',
          description: `PTZ 0% sur ${currentPlan.ptzDurationYears || 20} ans (${currentPlan.ptzDeferredYears || 0} ans de différé). Mensualité: ${calculations.ptzMonthlyAfterDeferral.toFixed(2)} €/mois.`,
        };

        if (existingPtzDebt) {
          await updateDebt(existingPtzDebt.id, ptzDebtData);
        } else {
          const created = await addDebt(ptzDebtData);
          ptzDebtId = created?.id;
        }
      } else if (existingPtzDebt) {
        await deleteDebt(existingPtzDebt.id);
        ptzDebtId = undefined;
      }

      // 3. Asset (with linked debts)
      const debtIdsList = [mainDebtId, ptzDebtId].filter(Boolean) as string[];
      const assetData = {
        name: currentPlan.name || 'Maison principale',
        category: 'real_estate' as const,
        purchasePrice: currentPlan.propertyPrice || 0,
        currentValue: currentPlan.propertyPrice || 0,
        purchaseDate: `${targetDateStr}-01`,
        realEstatePlanId: currentPlan.id,
        isPlanned: true,
        debtId: mainDebtId,
        debtIds: debtIdsList,
        loanDetails: {
          originalLoanAmount: calculations.mainLoanPrincipal + (currentPlan.hasPtz ? calculations.ptzPrincipal : 0),
          startDate: `${targetDateStr}-01`,
          endDate: `${new Date(startDate.getFullYear() + (currentPlan.mainLoanDurationYears || 25), startDate.getMonth()).toISOString().split('T')[0]}`,
          monthlyPayment: calculations.monthlyTotalPayment,
        },
        notes: `Achat prévu pour ${targetDateStr}. Apport global: ${calculations.totalContribution.toLocaleString('fr-FR')} €. Quote-part notariée: ${currentPlan.buyerAName} (${calculations.officialRatioA}%) / ${currentPlan.buyerBName} (${calculations.officialRatioB}%).`,
      };

      let assetId = linkedAsset?.id;
      if (linkedAsset) {
        await updateAsset(linkedAsset.id, assetData);
      } else {
        const created = await addAsset(assetData);
        assetId = created?.id;
      }

      // Save references back onto currentPlan
      await updateCurrentPlan({
        assetId,
        mainLoanDebtId: mainDebtId,
        ptzDebtId: ptzDebtId,
      });

      setIntegratedSuccess(true);
      setTimeout(() => {
        setIntegratedSuccess(false);
        setShowIntegrateModal(false);
      }, 1500);
    } catch (err) {
      console.error('Error integrating real estate plan:', err);
      alert('Une erreur est survenue lors de la synchronisation du projet avec Pathly.');
    }
  };

  // EMPTY STATE IF NO REAL ESTATE PLAN EXISTS YET
  if (!currentPlan || !calculations) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-8 sm:p-12 text-center max-w-2xl mx-auto my-12 shadow-sm space-y-6">
        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
          <Home className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Planificateur d'Achat Immobilier
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Modélisez l'achat de votre futur logement à deux : apports respectifs, prêt classique, Prêt à Taux Zéro (PTZ), date cible et évolution future de vos salaires.
          </p>
        </div>

        <button
          onClick={handleCreateFirstPlan}
          className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-sm rounded-xl shadow-md transition-all hover:scale-105"
        >
          <Plus className="h-4 w-4" />
          <span>Créer mon premier projet immobilier</span>
        </button>
      </div>
    );
  }

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
                Projet Immobilier
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Planifiez votre achat de maison à deux : date cible, évolution future des salaires, apports et clés notariées.
              </p>
            </div>
          </div>
        </div>

        {/* Scenarios switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl">
            {realEstatePlans.map(p => {
              const isSelected = p.id === currentPlan.id;
              const hasAsset = Boolean(p.assetId || assets.some(a => a.realEstatePlanId === p.id || (a.category === 'real_estate' && a.name === p.name)));
              return (
                <button
                  key={p.id}
                  onClick={() => setActivePlanId(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  <Home className="h-3 w-3" />
                  <span>{p.name}</span>
                  {hasAsset && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Intégré au patrimoine" />
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleAddNewPlan}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-xs font-semibold transition-colors"
            title="Créer un nouveau projet immobilier distinct"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nouveau projet</span>
          </button>

          <button
            onClick={() => handleDuplicatePlan(currentPlan)}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 text-xs font-semibold transition-colors"
            title="Dupliquer ce projet pour tester un scénario alternatif"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>Dupliquer</span>
          </button>

          {realEstatePlans.length > 1 && (
            <button
              onClick={() => handleDeletePlan(currentPlan.id)}
              className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              title="Supprimer ce projet"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}

          {calculations.totalCost > 0 && (
            <button
              onClick={() => setShowIntegrateModal(true)}
              className={`flex items-center space-x-1.5 px-3.5 py-2 text-white rounded-xl text-xs font-bold shadow-md transition-all hover:scale-[1.02] ${
                linkedAsset
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700'
              }`}
            >
              {linkedAsset ? <RefreshCw className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
              <span>{linkedAsset ? 'Mettre à jour dans Pathly' : 'Intégrer à Pathly'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Target Date & Future Salary Banner Alert */}
      <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-indigo-200/80 dark:border-indigo-800/60 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md shrink-0">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Date cible de l'acquisition
              </span>
              <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-600 text-white">
                {currentPlan.targetDate || 'À définir'}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
              Revenus effectifs pris en compte à cette date : <strong>{currentPlan.buyerAName} ({calculations.effectiveIncomeA.toLocaleString('fr-FR')} €)</strong>
              {calculations.hasIncomeChangedA && <span className="text-emerald-600 dark:text-emerald-400 font-semibold ml-1">(Revalorisé)</span>}
              &nbsp;+ <strong>{currentPlan.buyerBName} ({calculations.effectiveIncomeB.toLocaleString('fr-FR')} €)</strong>
              {calculations.hasIncomeChangedB && <span className="text-emerald-600 dark:text-emerald-400 font-semibold ml-1">(Revalorisé)</span>}
              &nbsp;= Total <strong>{calculations.totalEffectiveIncome.toLocaleString('fr-FR')} €/mois</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <div className="text-right">
            <label htmlFor="target-date-input" className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Modifier la date cible
            </label>
            <input
              id="target-date-input"
              type="month"
              value={currentPlan.targetDate || '2027-06'}
              onChange={e => updateCurrentPlan({ targetDate: e.target.value })}
              className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 shadow-sm"
            />
          </div>
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
            <span>Bien : {(currentPlan.propertyPrice || 0).toLocaleString('fr-FR')} €</span>
            <span className="font-semibold text-slate-600 dark:text-slate-300">Notaire : {calculations.finalNotaryFees.toLocaleString('fr-FR')} €</span>
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
            <span>{currentPlan.buyerAName} : {(currentPlan.buyerAContribution || 0).toLocaleString('fr-FR')} €</span>
            <span>{currentPlan.buyerBName} : {(currentPlan.buyerBContribution || 0).toLocaleString('fr-FR')} €</span>
          </div>
        </div>

        {/* Monthly Payment */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-2">
            <span>Mensualité globale</span>
            <Landmark className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
            {Math.round(calculations.representativeMonthly).toLocaleString('fr-FR')} € <span className="text-xs font-medium text-slate-500">/mois</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {currentPlan.hasPtz && (currentPlan.ptzDeferredYears || 0) > 0 ? (
              <span className="text-purple-600 dark:text-purple-300 font-medium">
                Phase 1 : {Math.round(calculations.totalMonthlyPhase1)} € puis {Math.round(calculations.totalMonthlyPhase2)} €
              </span>
            ) : (
              <span>Prêt : {Math.round(calculations.mainLoanMonthlyTotal)} € {currentPlan.hasPtz ? `+ PTZ : ${Math.round(calculations.ptzMonthlyAfterDeferral)} €` : ''}</span>
            )}
          </div>
        </div>

        {/* Debt Ratio */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-2">
            <span>Taux d'endettement à terme</span>
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
            Reste à vivre : <strong>{Math.round(calculations.leftToLiveHousehold).toLocaleString('fr-FR')} €</strong>
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
          <span>2. Co-Emprunteurs, Apports & Évolution des Salaires</span>
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

            {/* Scenario Name & Target Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Date cible du projet (Mois / Année) *
                </label>
                <input
                  type="month"
                  value={currentPlan.targetDate || '2027-06'}
                  onChange={e => updateCurrentPlan({ targetDate: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:text-white"
                />
              </div>
            </div>

            {/* Property Type */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Type de projet immobilier & Réglementation
                </label>
                {currentPlan.propertyType === 'old' && currentPlan.hasPtz && !calculations.isPtzOldEligible && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Alerte PTZ ancien actif</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => updateCurrentPlan({ propertyType: 'old', notaryFeesRate: 7.5 })}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    currentPlan.propertyType === 'old'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="font-bold text-sm">Ancien</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Frais notaire ~7.5%</div>
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                    PTZ si ≥ 25% travaux
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => updateCurrentPlan({ propertyType: 'new', notaryFeesRate: 2.5 })}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    currentPlan.propertyType === 'new'
                      ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">Neuf / RE2020 / VEFA</span>
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300">
                      Top PTZ
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Frais réduits ~2.5%</div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                    0 travaux exigés pour PTZ
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => updateCurrentPlan({ propertyType: 'construction', notaryFeesRate: 4.5 })}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    currentPlan.propertyType === 'construction'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="font-bold text-sm">Terrain + Constr. RE2020</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Notaire terrain seul (~4.5%)</div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                    Éligible PTZ neuf
                  </div>
                </button>
              </div>

              {/* Smart Regulatory Banner for PTZ in Ancien */}
              {currentPlan.propertyType === 'old' && currentPlan.hasPtz && !calculations.isPtzOldEligible && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400/80 dark:border-amber-600/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in shadow-sm">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-xs text-amber-900 dark:text-amber-200">
                        Attention : Règle bancaire des 25% de travaux pour le PTZ dans l'Ancien
                      </div>
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
                        Dans l'ancien, le PTZ exige obligatoirement <strong>au moins 25% de travaux</strong> de rénovation énergétique (soit <strong>{calculations.minTravauxForPtzInOld.toLocaleString('fr-FR')} €</strong> minimum pour ce montant, or vous avez saisi {(currentPlan.renovationBudget || 0).toLocaleString('fr-FR')} €).
                        <br />
                        💡 <strong>Vous visez une maison neuve RE2020 (sur plan, VEFA ou construction) ?</strong> Basculez sur « Neuf / RE2020 » : 0 travaux requis et vos frais de notaire chutent immédiatement de <strong>{calculations.finalNotaryFees.toLocaleString('fr-FR')} € à ~{calculations.notaireNeuf.toLocaleString('fr-FR')} €</strong> (-{calculations.notaireSavingsWithNeuf.toLocaleString('fr-FR')} €) !
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateCurrentPlan({ propertyType: 'new', notaryFeesRate: 2.5 })}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shrink-0 shadow-md transition-all flex items-center justify-center gap-1.5 self-start sm:self-center"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Passer en Neuf RE2020</span>
                  </button>
                </div>
              )}

              {/* Reassurance Banner for Neuf RE2020 */}
              {currentPlan.propertyType === 'new' && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700/60 rounded-xl flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Maison RE2020 / Neuf validée :</strong> Frais de notaire réduits à ~2,5% (économie de ~{calculations.notaireSavingsWithNeuf.toLocaleString('fr-FR')} €) et PTZ <strong>100% accordé sans aucune condition de travaux</strong> !
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400 block mt-0.5">
                      (Important : si vous achetez une maison déjà habitée revendue par un particulier, même récente de 2024, elle devient juridiquement de l'Ancien).
                    </span>
                  </div>
                </div>
              )}
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
                    placeholder="0"
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
                    placeholder="0"
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
                    placeholder="0"
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
                <span className="font-bold">{(currentPlan.propertyPrice || 0).toLocaleString('fr-FR')} €</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-indigo-900/60">
                <span className="text-slate-300">Frais de notaire</span>
                <span className="font-bold">{calculations.finalNotaryFees.toLocaleString('fr-FR')} €</span>
              </div>
              {(currentPlan.renovationBudget || 0) > 0 && (
                <div className="flex justify-between items-center py-1.5 border-b border-indigo-900/60">
                  <span className="text-slate-300">Enveloppe travaux</span>
                  <span className="font-bold">{(currentPlan.renovationBudget || 0).toLocaleString('fr-FR')} €</span>
                </div>
              )}
              {(currentPlan.bankGuaranteeFees || 0) > 0 && (
                <div className="flex justify-between items-center py-1.5 border-b border-indigo-900/60">
                  <span className="text-slate-300">Frais garantie & dossier</span>
                  <span className="font-bold">{(currentPlan.bankGuaranteeFees || 0).toLocaleString('fr-FR')} €</span>
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
              <span>Étape suivante : Co-emprunteurs & Salaires</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: CO-EMPRUNTEURS, APPORTS & ÉVOLUTION DES SALAIRES */}
      {/* ======================================================== */}
      {activeTab === 'borrowers' && (
        <div className="space-y-6">
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Salaire net mensuel de base (€ / mois) *
                    </label>
                    {calculations.hasIncomeChangedA && (
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        Pris en compte au projet : {calculations.effectiveIncomeA.toLocaleString('fr-FR')} €
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="50"
                      min="0"
                      value={currentPlan.buyerAIncome || ''}
                      onChange={e => updateCurrentPlan({ buyerAIncome: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 dark:text-white"
                      placeholder="0"
                    />
                    <span className="absolute right-3 top-2.5 text-slate-400 text-sm">€</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Apport personnel injecté (€) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="500"
                      min="0"
                      value={currentPlan.buyerAContribution || ''}
                      onChange={e => updateCurrentPlan({ buyerAContribution: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-black text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500"
                      placeholder="0"
                    />
                    <span className="absolute right-3 top-2.5 text-slate-400 text-sm">€</span>
                  </div>
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Salaire net mensuel de base (€ / mois) *
                    </label>
                    {calculations.hasIncomeChangedB && (
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        Pris en compte au projet : {calculations.effectiveIncomeB.toLocaleString('fr-FR')} €
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="50"
                      min="0"
                      value={currentPlan.buyerBIncome || ''}
                      onChange={e => updateCurrentPlan({ buyerBIncome: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-purple-500 dark:text-white"
                      placeholder="0"
                    />
                    <span className="absolute right-3 top-2.5 text-slate-400 text-sm">€</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Apport personnel injecté (€) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="500"
                      min="0"
                      value={currentPlan.buyerBContribution || ''}
                      onChange={e => updateCurrentPlan({ buyerBContribution: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-black text-purple-600 dark:text-purple-400 focus:ring-2 focus:ring-purple-500"
                      placeholder="0"
                    />
                    <span className="absolute right-3 top-2.5 text-slate-400 text-sm">€</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Planned Future Salary Changes Section */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-indigo-500" />
                  <span>Évolutions & Changements de Salaire Programmés</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Planifiez les augmentations ou changements de poste futurs. Seuls les salaires effectifs à la date du projet (<strong>{currentPlan.targetDate || '2027-06'}</strong>) sont retenus pour le taux d'endettement.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddEvoForm(!showAddEvoForm)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded-xl text-xs font-bold transition shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Planifier un changement de salaire</span>
              </button>
            </div>

            {/* Add Salary Evolution Form */}
            {showAddEvoForm && (
              <form onSubmit={handleAddSalaryEvolution} className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                  Nouveau changement de salaire
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Co-emprunteur concerné
                    </label>
                    <select
                      value={newEvoBorrower}
                      onChange={e => setNewEvoBorrower(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold dark:text-white"
                    >
                      <option value="buyerA">{currentPlan.buyerAName} (Emprunteur 1)</option>
                      <option value="buyerB">{currentPlan.buyerBName} (Emprunteur 2)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Date d'effet (Mois / Année) *
                    </label>
                    <input
                      type="month"
                      value={newEvoDate}
                      onChange={e => setNewEvoDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Nouveau salaire net (€ / mois) *
                    </label>
                    <input
                      type="number"
                      step="50"
                      min="0"
                      value={newEvoIncome}
                      onChange={e => setNewEvoIncome(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold dark:text-white"
                      placeholder="Ex: 2500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Motif / Note (optionnel)
                    </label>
                    <input
                      type="text"
                      value={newEvoNote}
                      onChange={e => setNewEvoNote(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold dark:text-white"
                      placeholder="Ex: Promotion, grille..."
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddEvoForm(false)}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                  >
                    Enregistrer l'évolution
                  </button>
                </div>
              </form>
            )}

            {/* List of Evolutions */}
            <div className="space-y-2">
              {(currentPlan.salaryEvolutions || []).length > 0 ? (
                (currentPlan.salaryEvolutions || []).map(evo => {
                  const isEffectiveAtTargetDate = evo.date <= (currentPlan.targetDate || '2027-06');
                  const borrowerName = evo.borrower === 'buyerA' ? currentPlan.buyerAName : currentPlan.buyerBName;

                  return (
                    <div
                      key={evo.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border transition-all ${
                        isEffectiveAtTargetDate
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 opacity-75'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg text-xs font-bold ${
                          evo.borrower === 'buyerA'
                            ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300'
                            : 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300'
                        }`}>
                          {borrowerName}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                              {evo.newIncome.toLocaleString('fr-FR')} € / mois
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              à partir de {evo.date}
                            </span>
                            {isEffectiveAtTargetDate ? (
                              <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Actif à la date du projet</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                <Clock className="h-3 w-3" />
                                <span>Postérieur à la date cible</span>
                              </span>
                            )}
                          </div>
                          {evo.note && (
                            <p className="text-xs text-slate-500 italic mt-0.5">
                              {evo.note}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteSalaryEvolution(evo.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition self-end sm:self-center mt-2 sm:mt-0"
                        title="Supprimer cette évolution"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                  Aucune évolution de salaire programmée. Les salaires de base actuels sont utilisés.
                </div>
              )}
            </div>
          </div>

          {/* Rétroplanning & Conditions d'Octroi Bancaire */}
          <div className="bg-gradient-to-br from-indigo-900/5 to-purple-900/5 dark:from-indigo-950/30 dark:to-purple-950/30 p-6 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/60 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    Rétroplanning Bancaire & Validation des CDI (Horizon {calculations.targetYear})
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Conditions d'éligibilité pour obtenir l'accord de prêt et le PTZ maximal
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-full self-start sm:self-center">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Alignement optimal</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 pt-1">
              <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between text-xs font-black text-indigo-600 dark:text-indigo-400">
                  <span>1. Arthur</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60">Diplôme sept. 2027</span>
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white">CDI validé fin 2027</div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  À la date cible de {currentPlan.targetDate || '2029-03'}, plus de <strong>18 mois d'ancienneté</strong> en CDI. Profil 100% sécurisé et prioritaire auprès des comités de crédit.
                </p>
              </div>

              <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between text-xs font-black text-purple-600 dark:text-purple-400">
                  <span>2. Alicia</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60">Diplôme août 2028</span>
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white">Période d'essai validée</div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  CDI signé en sept. 2028. Période d'essai (3-4 mois) validée entre <strong>déc. 2028 et fév. 2029</strong> (ou 0 jour de période d'essai si embauchée dans sa boîte d'alternance).
                </p>
              </div>

              <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between text-xs font-black text-emerald-600 dark:text-emerald-400">
                  <span>3. Montage Banque</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60">Début {calculations.targetYear}</span>
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white">Dépôt du Prêt & PTZ</div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Basé sur l'avis d'impôt N-2 ({calculations.nMinus2Year}) : statut étudiant/apprenti exonéré d'impôt = <strong>Tranche 1 du PTZ garantie</strong> (aide max et différé 10-15 ans).
                </p>
              </div>

              <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between text-xs font-black text-teal-600 dark:text-teal-400">
                  <span>4. Projet Concrétisé</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60">Printemps / Été</span>
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white">Signature & Clés</div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Signature chez le notaire avec frais réduits à ~2,5% (Neuf RE2020), déblocage des fonds et emménagement ou lancement de chantier avant l'été {calculations.targetYear}.
                </p>
              </div>
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
              <>
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
                      placeholder="0"
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
                    value={currentPlan.ptzDurationYears || 20}
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
                    value={currentPlan.ptzDeferredYears || 0}
                    onChange={e => updateCurrentPlan({ ptzDeferredYears: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500 dark:text-white"
                  >
                    <option value={0}>Aucun différé (0 an)</option>
                    <option value={5}>5 ans de différé total</option>
                    <option value={8}>8 ans de différé total</option>
                    <option value={10}>10 ans de différé (Tranche 1)</option>
                    <option value={15}>15 ans de différé (Tranche 1 max)</option>
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
                      placeholder="0.30"
                    />
                    <span className="absolute right-3 top-2 text-slate-400 text-xs">%</span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Moyenne : 0.25% à 0.35%
                  </span>
                </div>
              </div>

              {/* Loan Smoothing & Banking Optimization */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-700 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700 gap-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-lg">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Lissage bancaire du crédit (Mensualité constante sur 25 ans)
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {calculations.isSmoothedActive
                          ? `Actif : Mensualité unique lissée de ${Math.round(calculations.smoothedMonthlyTotal).toLocaleString('fr-FR')} €/m (Phase 1 différé et Phase 2 harmonisées)`
                          : 'Recommandé en banque : nivelle l\'échéance principale pour garder le même prélèvement avant et après la fin du différé'}
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 self-start sm:self-center">
                    <input
                      type="checkbox"
                      checked={currentPlan.useLoanSmoothing !== false}
                      onChange={e => updateCurrentPlan({ useLoanSmoothing: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {/* Fiscal Bonus N-2 Card */}
                <div className="p-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-300 dark:border-emerald-800/60 rounded-xl flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs text-emerald-950 dark:text-emerald-200">
                    <div className="font-bold">
                      💡 Super-bonus fiscal des fins d'études (Avis d'imposition N-2 : Année {calculations.nMinus2Year})
                    </div>
                    <p className="leading-relaxed text-emerald-800 dark:text-emerald-300">
                      Pour un emprunt en <strong>{calculations.targetYear}</strong>, l'administration bancaire examine votre Revenu Fiscal de Référence (RFR) de l'année <strong>{calculations.nMinus2Year}</strong>.
                      Grâce aux statuts étudiants et apprentis en {calculations.nMinus2Year} (exonération fiscale de ~21 000 € pour l'apprentissage), votre RFR est minime : vous êtes <strong>garantis d'accéder à la Tranche 1 du PTZ</strong>, soit le différé maximal de remboursement (10 à 15 ans sans capital) et l'aide d'État maximale !
                    </p>
                  </div>
                </div>

                {/* Old Property PTZ Alert in Step 3 */}
                {currentPlan.propertyType === 'old' && !calculations.isPtzOldEligible && (
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Condition des 25% de travaux dans l'ancien :</strong> En restant sur "Ancien", la banque refusera le PTZ car vous prévoyez {(currentPlan.renovationBudget || 0).toLocaleString('fr-FR')} € de travaux (au lieu des {calculations.minTravauxForPtzInOld.toLocaleString('fr-FR')} € légaux).
                      <button
                        type="button"
                        onClick={() => updateCurrentPlan({ propertyType: 'new', notaryFeesRate: 2.5 })}
                        className="ml-2 font-bold underline hover:text-amber-950 dark:hover:text-amber-100"
                      >
                        Basculez sur "Neuf / RE2020" pour valider le PTZ sans condition de travaux →
                      </button>
                    </div>
                  </div>
                )}
              </div>
              </>
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
                  value={currentPlan.mainLoanDurationYears || 25}
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
                    placeholder="3.40"
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
                    placeholder="0.34"
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
          {/* COMPARATEUR DIRECT MAISON RE2020 (NEUF) VS ANCIEN */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border-2 border-indigo-500/40 dark:border-indigo-500/30 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl shadow-sm">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Audit Comparatif : Maison RE2020 (Neuf) vs Logement Ancien</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                      Économie directe ~{calculations.notaireSavingsWithNeuf.toLocaleString('fr-FR')} €
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Simulation comparative sur une base d'achat de {(currentPlan.propertyPrice || 0).toLocaleString('fr-FR')} € à l'horizon {currentPlan.targetDate || '2029-03'}
                  </p>
                </div>
              </div>

              {currentPlan.propertyType === 'old' && (
                <button
                  type="button"
                  onClick={() => updateCurrentPlan({ propertyType: 'new', notaryFeesRate: 2.5 })}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm self-start sm:self-center"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Passer en Neuf RE2020</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-2.5 pr-4">Poste Financier</th>
                    <th className="py-2.5 px-3 bg-slate-50 dark:bg-slate-900/50 rounded-l-lg">Scénario Ancien</th>
                    <th className="py-2.5 px-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-black">Scénario Maison RE2020 (Neuf)</th>
                    <th className="py-2.5 pl-3 text-right">Gain / Avantage RE2020</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  <tr>
                    <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300 font-semibold">Frais de notaire</td>
                    <td className="py-2.5 px-3 bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400">~{calculations.notaireAncien.toLocaleString('fr-FR')} € (7,5%)</td>
                    <td className="py-2.5 px-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold">~{calculations.notaireNeuf.toLocaleString('fr-FR')} € (2,5%)</td>
                    <td className="py-2.5 pl-3 text-right font-black text-emerald-600">-{calculations.notaireSavingsWithNeuf.toLocaleString('fr-FR')} € d'économies</td>
                  </tr>

                  <tr>
                    <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300 font-semibold">Éligibilité PTZ ({currentPlan.hasPtz ? (currentPlan.ptzAmount || 60000).toLocaleString('fr-FR') : '60 000'} €)</td>
                    <td className="py-2.5 px-3 bg-slate-50 dark:bg-slate-900/50 text-rose-600 dark:text-rose-400">Bloqué (travaux &lt; 25%)</td>
                    <td className="py-2.5 px-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold">100% Validé (0 € travaux requis)</td>
                    <td className="py-2.5 pl-3 text-right font-bold text-emerald-600">Taux Zéro débloqué</td>
                  </tr>

                  <tr>
                    <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300 font-semibold">Coût total à financer</td>
                    <td className="py-2.5 px-3 bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400">{calculations.totalCostAncien.toLocaleString('fr-FR')} €</td>
                    <td className="py-2.5 px-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold">{calculations.totalCostNeuf.toLocaleString('fr-FR')} €</td>
                    <td className="py-2.5 pl-3 text-right font-bold text-emerald-600">-{calculations.notaireSavingsWithNeuf.toLocaleString('fr-FR')} €</td>
                  </tr>

                  <tr>
                    <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300 font-semibold">Mensualité globale estimée</td>
                    <td className="py-2.5 px-3 bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400">~{Math.round(calculations.monthlyAncienNoPtz).toLocaleString('fr-FR')} € / mois</td>
                    <td className="py-2.5 px-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-black text-sm">~{Math.round(calculations.monthlyNeuf).toLocaleString('fr-FR')} € / mois</td>
                    <td className="py-2.5 pl-3 text-right font-bold text-emerald-600">-{Math.round(calculations.monthlyAncienNoPtz - calculations.monthlyNeuf).toLocaleString('fr-FR')} € / mois</td>
                  </tr>

                  <tr>
                    <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300 font-semibold">Taux d'endettement du couple</td>
                    <td className="py-2.5 px-3 bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400">{calculations.debtRatioAncien.toFixed(1)} %</td>
                    <td className="py-2.5 px-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold">{calculations.debtRatioNeuf.toFixed(1)} %</td>
                    <td className="py-2.5 pl-3 text-right font-bold text-emerald-600">-{(calculations.debtRatioAncien - calculations.debtRatioNeuf).toFixed(1)} points</td>
                  </tr>

                  <tr>
                    <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300 font-semibold">Reste à vivre mensuel</td>
                    <td className="py-2.5 px-3 bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400">~{Math.round(calculations.leftToLiveAncien).toLocaleString('fr-FR')} €</td>
                    <td className="py-2.5 px-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold">~{Math.round(calculations.leftToLiveNeuf).toLocaleString('fr-FR')} €</td>
                    <td className="py-2.5 pl-3 text-right font-bold text-emerald-600">+{Math.round(calculations.leftToLiveNeuf - calculations.leftToLiveAncien).toLocaleString('fr-FR')} € / mois</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          {/* Controls for Monthly Split & Ownership Split */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            {/* Monthly split rule */}
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide mb-2">
                Comment répartissez-vous la mensualité chaque mois ?
              </label>
              <div className="space-y-2">
                {[
                  { id: 'pro_rata_income', label: 'Au prorata des revenus (à date cible)', desc: `Selon vos salaires futurs (${calculations.ratioMonthlyA}% / ${calculations.ratioMonthlyB}%)` },
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
                    <span>Part de {currentPlan.buyerAName} : {currentPlan.customMonthlyRatioA}%</span>
                    <span>Part de {currentPlan.buyerBName} : {100 - (currentPlan.customMonthlyRatioA || 50)}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    value={currentPlan.customMonthlyRatioA || 50}
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
                    <span>Propriété {currentPlan.buyerAName} : {currentPlan.customOwnershipRatioA}%</span>
                    <span>Propriété {currentPlan.buyerBName} : {100 - (currentPlan.customOwnershipRatioA || 50)}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    value={currentPlan.customOwnershipRatioA || 50}
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
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">1</div>
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
                  <div>
                    <span className="text-slate-500 block">Taux d'endettement</span>
                    <span className="text-[11px] text-slate-400 block">
                      Basé sur {calculations.effectiveIncomeA.toLocaleString('fr-FR')} €/m à date
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`font-bold text-base ${calculations.debtRatioA <= 35 ? 'text-emerald-600' : 'text-rose-600'}`}>
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
                  <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs">2</div>
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
                  <div>
                    <span className="text-slate-500 block">Taux d'endettement</span>
                    <span className="text-[11px] text-slate-400 block">
                      Basé sur {calculations.effectiveIncomeB.toLocaleString('fr-FR')} €/m à date
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`font-bold text-base ${calculations.debtRatioB <= 35 ? 'text-emerald-600' : 'text-rose-600'}`}>
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
                <span>1 Bien immobilier créé : "{currentPlan.name}" ({(currentPlan.propertyPrice || 0).toLocaleString('fr-FR')} €)</span>
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

            {linkedAsset && (
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-800 dark:text-blue-300">
                ℹ️ Ce projet est déjà lié au bien <strong>"{linkedAsset.name}"</strong> dans votre patrimoine. Confirmez pour synchroniser les montants et crédits <strong>sans créer de doublon</strong>.
              </div>
            )}

            {integratedSuccess ? (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-center font-bold text-xs">
                ✓ Synchronisation effectuée avec succès !
              </div>
            ) : (
              <div className="flex items-center justify-between pt-2">
                <div>
                  {linkedAsset && (
                    <button
                      type="button"
                      onClick={handleUnlinkFromPathly}
                      className="text-xs text-red-600 hover:text-red-700 font-semibold"
                    >
                      Retirer du patrimoine
                    </button>
                  )}
                </div>
                <div className="flex items-center space-x-3">
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
                    {linkedAsset ? 'Mettre à jour dans Pathly' : 'Confirmer et créer dans Pathly'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RealEstatePlanner;
