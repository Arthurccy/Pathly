import { RealEstatePlan } from '../types';

export interface RealEstatePlanMetrics {
  projectTargetDate: string;
  effectiveIncomeA: number;
  effectiveIncomeB: number;
  totalEffectiveIncome: number;
  finalNotaryFees: number;
  totalCost: number;
  totalContribution: number;
  contributionRatioA: number;
  contributionRatioB: number;
  totalBorrowing: number;
  ptzPrincipal: number;
  mainLoanPrincipal: number;
  mainLoanMonthlyTotal: number;
  representativeMonthly: number;
  activeMonthlyPayment: number;
  ratioMonthlyA: number;
  ratioMonthlyB: number;
  monthlyA: number;
  monthlyB: number;
  equitableRatioA: number;
  equitableRatioB: number;
  officialRatioA: number;
  officialRatioB: number;
  debtRatioHousehold: number;
  leftToLiveHousehold: number;
  isPtzOldEligible: boolean;
  minTravauxForPtzInOld: number;
  ptzTravauxDeficit: number;
  totalCostAncien: number;
  borrowAncienNoPtz: number;
  monthlyAncienNoPtz: number;
  totalCostNeuf: number;
  borrowNeuf: number;
  monthlyNeuf: number;
}

export function calculateRealEstatePlan(p: RealEstatePlan): RealEstatePlanMetrics {
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

  // 2. Notary fees
  const calculatedNotaryFees = p.propertyType === 'new'
    ? Math.round((p.propertyPrice || 0) * 0.025)
    : Math.round((p.propertyPrice || 0) * ((p.notaryFeesRate || 7.5) / 100));
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

  // 8. PTZ 25% renovation condition in the old property stock (Ancien)
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

  const totalMonthlyPhase1 = mainLoanMonthlyTotal + (p.hasPtz ? ((p.ptzDeferredYears || 0) > 0 ? ptzMonthlyDuringDeferral : ptzMonthlyAfterDeferral) : 0);
  const totalMonthlyPhase2 = mainLoanMonthlyTotal + (p.hasPtz ? ptzMonthlyAfterDeferral : 0);

  const representativeMonthly = (isSmoothedActive && smoothedMonthlyTotal > 0)
    ? smoothedMonthlyTotal
    : (p.hasPtz && (p.ptzDeferredYears || 0) > 0 ? totalMonthlyPhase2 : totalMonthlyPhase1);

  // Comparatif financier : Neuf RE2020 vs Ancien
  const propertyPrice = p.propertyPrice || 0;
  const notaireNeuf = Math.round(propertyPrice * 0.025);
  const notaireAncien = Math.round(propertyPrice * 0.075);

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

  const borrowAncienNoPtz = Math.max(0, totalCostAncien - totalContribution);
  const monthlyAncienNoPtz = borrowAncienNoPtz > 0
    ? (monthlyRate > 0
      ? (borrowAncienNoPtz * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -mainLoanDurationMonths))))
      : (borrowAncienNoPtz / mainLoanDurationMonths)) + ((borrowAncienNoPtz * ((p.mainLoanInsuranceRate || 0.34) / 100)) / 12)
    : 0;

  // Active monthly payment depending on propertyType and PTZ condition
  const activeMonthlyPayment = p.propertyType === 'old' && !isPtzOldEligible
    ? monthlyAncienNoPtz
    : p.propertyType === 'new'
    ? monthlyNeuf
    : representativeMonthly;

  // 9. Monthly repayment split between A and B
  let ratioMonthlyA = 50;
  if (p.monthlySplitMode === '50_50') {
    ratioMonthlyA = 50;
  } else if (p.monthlySplitMode === 'pro_rata_income') {
    ratioMonthlyA = totalEffectiveIncome > 0 ? Math.round((effectiveIncomeA / totalEffectiveIncome) * 1000) / 10 : 50;
  } else if (p.monthlySplitMode === 'ownership_ratio') {
    ratioMonthlyA = p.ownershipSplitMode === 'custom' ? (p.customOwnershipRatioA || 50) : 50;
  } else if (p.monthlySplitMode === 'custom') {
    ratioMonthlyA = p.customMonthlyRatioA || 50;
  }

  const ratioMonthlyB = Math.round((100 - ratioMonthlyA) * 10) / 10;
  const monthlyA = activeMonthlyPayment * (ratioMonthlyA / 100);
  const monthlyB = activeMonthlyPayment * (ratioMonthlyB / 100);

  const debtRatioHousehold = totalEffectiveIncome > 0 ? (activeMonthlyPayment / totalEffectiveIncome) * 100 : 0;
  const leftToLiveHousehold = totalEffectiveIncome - activeMonthlyPayment;

  // 10. Lifetime Financial Effort & Equitable Notarial Split
  const totalRepaidOverTime = (mainLoanMonthlyTotal * mainLoanDurationMonths) +
    (p.hasPtz ? ((ptzMonthlyDuringDeferral * ptzDeferredMonths) + (ptzMonthlyAfterDeferral * ptzAmortizationMonths)) : 0);

  // If ancient without PTZ, actual repaid amount is based on borrowAncienNoPtz
  const actualTotalRepaid = p.propertyType === 'old' && !isPtzOldEligible
    ? monthlyAncienNoPtz * mainLoanDurationMonths
    : totalRepaidOverTime;

  const totalRepaidByA = actualTotalRepaid * (ratioMonthlyA / 100);
  const totalRepaidByB = actualTotalRepaid * (ratioMonthlyB / 100);

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
    finalNotaryFees,
    totalCost,
    totalContribution,
    contributionRatioA,
    contributionRatioB,
    totalBorrowing,
    ptzPrincipal,
    mainLoanPrincipal,
    mainLoanMonthlyTotal,
    representativeMonthly,
    activeMonthlyPayment,
    ratioMonthlyA,
    ratioMonthlyB,
    monthlyA,
    monthlyB,
    equitableRatioA,
    equitableRatioB,
    officialRatioA,
    officialRatioB,
    debtRatioHousehold,
    leftToLiveHousehold,
    isPtzOldEligible,
    minTravauxForPtzInOld,
    ptzTravauxDeficit,
    totalCostAncien,
    borrowAncienNoPtz,
    monthlyAncienNoPtz,
    totalCostNeuf,
    borrowNeuf,
    monthlyNeuf,
  };
}
