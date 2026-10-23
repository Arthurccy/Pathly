import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Car, 
  Watch, 
  Gem, 
  Package, 
  Plus, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  Edit3, 
  Trash2, 
  X, 
  Save, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Sparkles,
  ArrowRight,
  PieChart,
  Home
} from 'lucide-react';
import { format, differenceInMonths, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBudget } from '../contexts/BudgetContext';
import { useAuth } from '../contexts/AuthContext';
import { PhysicalAsset, Debt } from '../types';
import { calculateRealEstatePlan } from '../utils/realEstateCalculations';

const money = (val: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(val || 0);

const getCategoryIcon = (category: PhysicalAsset['category']) => {
  switch (category) {
    case 'real_estate':
      return Building2;
    case 'vehicle':
      return Car;
    case 'valuable_item':
      return Watch;
    case 'crypto_hardware':
      return Gem;
    default:
      return Package;
  }
};

const getCategoryLabel = (category: PhysicalAsset['category']) => {
  switch (category) {
    case 'real_estate':
      return 'Immobilier';
    case 'vehicle':
      return 'Véhicule';
    case 'valuable_item':
      return 'Horlogerie & Luxe';
    case 'crypto_hardware':
      return 'Hardware & Crypto';
    default:
      return 'Autre bien';
  }
};

const getCategoryBadgeColor = (category: PhysicalAsset['category']) => {
  switch (category) {
    case 'real_estate':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    case 'vehicle':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    case 'valuable_item':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    case 'crypto_hardware':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  }
};

interface AssetManagerProps {
  onViewChange?: (view: string) => void;
}

const AssetManager: React.FC<AssetManagerProps> = ({ onViewChange }) => {
  const { assets, addAsset, updateAsset, deleteAsset, debts, accounts, addDebt, realEstatePlans } = useBudget();

  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');
  const [scopeFilter, setScopeFilter] = useState<'current' | 'all'>('current');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<PhysicalAsset | null>(null);

  // Helper to detect if an asset is an acquisition in the future
  const isFutureAsset = (asset: PhysicalAsset): boolean => {
    if (asset.isPlanned) return true;
    if (!asset.purchaseDate) return false;
    try {
      const pDate = new Date(asset.purchaseDate);
      const now = new Date();
      return (pDate.getFullYear() > now.getFullYear()) || 
             (pDate.getFullYear() === now.getFullYear() && pDate.getMonth() > now.getMonth());
    } catch {
      return false;
    }
  };

  // Helper to find all debts linked to an asset
  const getAssetDebts = (asset: PhysicalAsset): any[] => {
    const ids = asset.debtIds || (asset.debtId ? [asset.debtId] : []);
    if (ids.length > 0) {
      const matched = debts.filter(d => ids.includes(d.id));
      if (matched.length > 0) return matched;
    }
    const assetNameClean = asset.name.toLowerCase().replace(/^(mon|ma|le|la|les|un|une)\s+/i, '').trim();
    if (assetNameClean.length >= 3) {
      const autoMatched = debts.filter(d => {
        const dLower = d.name.toLowerCase();
        return (
          dLower.includes(assetNameClean) ||
          (asset.notes && asset.notes.toLowerCase().includes(dLower))
        );
      });
      if (autoMatched.length > 0) return autoMatched;
    }
    return [];
  };

  // Active real estate project in progress (only if configured and propertyPrice > 0)
  const plannedRealEstatePlan = useMemo(() => {
    if (realEstatePlans && realEstatePlans.length > 0 && realEstatePlans[0].propertyPrice > 0) {
      return realEstatePlans[0];
    }
    return null;
  }, [realEstatePlans]);

  // Project financial metrics computed dynamically from the plan (synced with RealEstatePlanner)
  const projectMetrics = useMemo(() => {
    if (!plannedRealEstatePlan) return null;
    return calculateRealEstatePlan(plannedRealEstatePlan);
  }, [plannedRealEstatePlan]);

  const isRedundantProjectAsset = (a: PhysicalAsset) => {
    if (!plannedRealEstatePlan) return false;
    if (a.realEstatePlanId && a.realEstatePlanId === plannedRealEstatePlan.id) return true;
    if (plannedRealEstatePlan.assetId && a.id === plannedRealEstatePlan.assetId) return true;
    if (a.category === 'real_estate' && a.isPlanned && a.name.toLowerCase().includes(plannedRealEstatePlan.name.toLowerCase())) return true;
    return false;
  };

  const formatProjectTargetDate = (d?: string) => {
    if (!d) return '';
    try {
      const fullDate = d.length === 7 ? `${d}-01` : d;
      return format(parseISO(fullDate), 'MMMM yyyy', { locale: fr });
    } catch {
      return d;
    }
  };

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: 'real_estate' as PhysicalAsset['category'],
    purchasePrice: '',
    currentValue: '',
    purchaseDate: new Date().toISOString().split('T')[0],
    location: '',
    notes: '',
    hasLoan: false,
    selectedDebtId: '',
    // Quick new loan details
    createDebtRecord: false,
    loanOriginalAmount: '',
    loanRemainingAmount: '',
    loanStartDate: new Date().toISOString().split('T')[0],
    loanEndDate: '',
    loanMonthlyPayment: '',
    loanInterestRate: '2.5',
    loanAccountId: '',
  });

  const openAddModal = () => {
    setEditingAsset(null);
    setFormData({
      name: '',
      category: 'real_estate',
      purchasePrice: '',
      currentValue: '',
      purchaseDate: new Date().toISOString().split('T')[0],
      location: '',
      notes: '',
      hasLoan: false,
      selectedDebtId: '',
      createDebtRecord: false,
      loanOriginalAmount: '',
      loanRemainingAmount: '',
      loanStartDate: new Date().toISOString().split('T')[0],
      loanEndDate: '',
      loanMonthlyPayment: '',
      loanInterestRate: '2.5',
      loanAccountId: accounts[0]?.id || '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (asset: PhysicalAsset) => {
    setEditingAsset(asset);
    const linkedDebt = debts.find(d => d.id === asset.debtId);
    
    setFormData({
      name: asset.name,
      category: asset.category,
      purchasePrice: asset.purchasePrice.toString(),
      currentValue: asset.currentValue.toString(),
      purchaseDate: asset.purchaseDate.split('T')[0],
      location: asset.location || '',
      notes: asset.notes || '',
      hasLoan: Boolean(asset.debtId || asset.loanDetails),
      selectedDebtId: asset.debtId || '',
      createDebtRecord: false,
      loanOriginalAmount: asset.loanDetails?.originalLoanAmount?.toString() || linkedDebt?.totalAmount?.toString() || '',
      loanRemainingAmount: linkedDebt?.remainingAmount?.toString() || '',
      loanStartDate: asset.loanDetails?.startDate?.split('T')[0] || (linkedDebt ? format(linkedDebt.dueDate, 'yyyy-MM-dd') : ''),
      loanEndDate: asset.loanDetails?.endDate?.split('T')[0] || (linkedDebt?.endDate ? format(linkedDebt.endDate, 'yyyy-MM-dd') : ''),
      loanMonthlyPayment: asset.loanDetails?.monthlyPayment?.toString() || linkedDebt?.minimumPayment?.toString() || '',
      loanInterestRate: linkedDebt?.interestRate?.toString() || '2.5',
      loanAccountId: linkedDebt?.accountId || accounts[0]?.id || '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAsset(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.purchasePrice || !formData.currentValue) {
      alert('Veuillez renseigner le nom, le prix d\'achat et la valeur estimée actuelle.');
      return;
    }

    let linkedDebtId = formData.selectedDebtId || undefined;

    // If user asked to create a new Debt in Pathly alongside the asset
    if (formData.hasLoan && formData.createDebtRecord && formData.loanOriginalAmount && formData.loanAccountId) {
      try {
        const debtName = `Crédit ${formData.name}`;
        const total = parseFloat(formData.loanOriginalAmount);
        const remaining = formData.loanRemainingAmount ? parseFloat(formData.loanRemainingAmount) : total;
        const monthly = formData.loanMonthlyPayment ? parseFloat(formData.loanMonthlyPayment) : 0;
        const interest = formData.loanInterestRate ? parseFloat(formData.loanInterestRate) : 0;
        
        await addDebt({
          name: debtName,
          totalAmount: total,
          remainingAmount: remaining,
          interestRate: interest,
          minimumPayment: monthly,
          dueDate: formData.loanStartDate ? new Date(formData.loanStartDate) : new Date(),
          endDate: formData.loanEndDate ? new Date(formData.loanEndDate) : undefined,
          accountId: formData.loanAccountId,
          type: formData.category === 'real_estate' ? 'mortgage' : formData.category === 'vehicle' ? 'auto' : 'loan',
          isActive: true,
          creditor: 'Financement Bien',
          description: `Prêt lié au bien : ${formData.name}`,
        });
      } catch (err) {
        console.error('Failed to create linked debt:', err);
      }
    }

    const payload: Omit<PhysicalAsset, 'id'> = {
      name: formData.name,
      category: formData.category,
      purchasePrice: parseFloat(formData.purchasePrice),
      currentValue: parseFloat(formData.currentValue),
      purchaseDate: formData.purchaseDate,
      location: formData.location || undefined,
      notes: formData.notes || undefined,
      debtId: linkedDebtId,
      loanDetails: formData.hasLoan ? {
        originalLoanAmount: formData.loanOriginalAmount ? parseFloat(formData.loanOriginalAmount) : undefined,
        startDate: formData.loanStartDate || undefined,
        endDate: formData.loanEndDate || undefined,
        monthlyPayment: formData.loanMonthlyPayment ? parseFloat(formData.loanMonthlyPayment) : undefined,
      } : undefined,
    };

    if (editingAsset) {
      await updateAsset(editingAsset.id, payload);
    } else {
      await addAsset(payload);
    }

    closeModal();
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Supprimer le bien "${name}" de votre patrimoine ?`)) {
      await deleteAsset(id);
    }
  };

  // Scope assets: Current vs All
  const scopeAssets = useMemo(() => {
    if (scopeFilter === 'current') {
      return assets.filter(a => !isFutureAsset(a));
    }
    return assets;
  }, [assets, scopeFilter]);

  // Filtered Assets based on category
  const filteredAssets = useMemo(() => {
    if (activeCategoryFilter === 'all') return scopeAssets;
    return scopeAssets.filter(a => a.category === activeCategoryFilter);
  }, [scopeAssets, activeCategoryFilter]);

  const displayedAssets = useMemo(() => {
    return filteredAssets.filter(a => !isRedundantProjectAsset(a));
  }, [filteredAssets, plannedRealEstatePlan]);

  const showProjectCard = Boolean(
    plannedRealEstatePlan && (activeCategoryFilter === 'all' || activeCategoryFilter === 'real_estate')
  );

  const futureAssets = useMemo(() => {
    return assets.filter(a => isFutureAsset(a));
  }, [assets]);

  // Global KPIs computed strictly on the selected scope
  const totalGrossValue = useMemo(() => {
    return scopeAssets.reduce((sum, a) => sum + (Number(a.currentValue) || 0), 0);
  }, [scopeAssets]);

  const totalPurchaseCost = useMemo(() => {
    return scopeAssets.reduce((sum, a) => sum + (Number(a.purchasePrice) || 0), 0);
  }, [scopeAssets]);

  const totalCapitalGain = totalGrossValue - totalPurchaseCost;
  const capitalGainPercent = totalPurchaseCost > 0 ? (totalCapitalGain / totalPurchaseCost) * 100 : 0;

  // Associated remaining loans (taking into account all linked debts or auto-detected ones)
  const totalAssociatedDebt = useMemo(() => {
    return scopeAssets.reduce((sum, asset) => {
      const linkedDebts = getAssetDebts(asset);
      if (linkedDebts.length > 0) {
        return sum + linkedDebts.reduce((s: number, d: any) => s + (d.remainingAmount || 0), 0);
      }
      return sum + (asset.loanDetails?.originalLoanAmount || 0);
    }, 0);
  }, [scopeAssets, debts]);

  const netEquity = totalGrossValue - totalAssociatedDebt;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Patrimoine & Actifs Matériels
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                {assets.length} bien{assets.length > 1 ? 's' : ''}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Suivi de vos biens (immobilier, véhicules, montres...), amortissement des crédits et valeur nette détenue.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {futureAssets.length > 0 && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setScopeFilter('current')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  scopeFilter === 'current'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                Patrimoine Actuel ({assets.filter(a => !isFutureAsset(a)).length})
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  scopeFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                Tout (avec projets futurs) ({assets.length})
              </button>
            </div>
          )}

          <button
            onClick={openAddModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Ajouter un bien</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Brut */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Valeur Totale des Biens
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <PieChart className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            {money(totalGrossValue)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Prix d'achat initial : {money(totalPurchaseCost)}
          </p>
        </div>

        {/* Crédits liés */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Crédits Associés Restants
            </span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400">
            {totalAssociatedDebt > 0 ? `-${money(totalAssociatedDebt)}` : '0 €'}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Montant restant à rembourser
          </p>
        </div>

        {/* Equity Nette */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Valeur Nette Détenue (Equity)
            </span>
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-emerald-700 dark:text-emerald-300">
            {money(netEquity)}
          </p>
          <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
            Biens moins dettes restantes
          </p>
        </div>

        {/* Plus / Moins Value */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-800/80 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Plus / Moins-Value Globale
            </span>
            <div className={`p-2 rounded-lg ${
              totalCapitalGain >= 0
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
            }`}>
              {totalCapitalGain >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            </div>
          </div>
          <p className={`mt-2 text-xl sm:text-2xl font-bold ${
            totalCapitalGain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}>
            {totalCapitalGain >= 0 ? '+' : ''}{money(totalCapitalGain)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {totalCapitalGain >= 0 ? '+' : ''}{capitalGainPercent.toFixed(1)} % depuis l'achat
          </p>
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-sm">
        {[
          { id: 'all', label: 'Tous les biens', icon: Package, count: displayedAssets.length + (showProjectCard ? 1 : 0) },
          { id: 'real_estate', label: 'Immobilier', icon: Building2, count: displayedAssets.filter(a => a.category === 'real_estate').length + (showProjectCard ? 1 : 0) },
          { id: 'vehicle', label: 'Véhicules', icon: Car, count: displayedAssets.filter(a => a.category === 'vehicle').length },
          { id: 'valuable_item', label: 'Horlogerie & Montres', icon: Watch, count: displayedAssets.filter(a => a.category === 'valuable_item').length },
          { id: 'crypto_hardware', label: 'Objets & Autres', icon: Gem, count: displayedAssets.filter(a => a.category === 'crypto_hardware' || a.category === 'other').length },
        ].map(tab => {
          const TabIcon = tab.icon;
          const isActive = activeCategoryFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveCategoryFilter(tab.id)}
              className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl font-medium transition text-xs sm:text-sm flex items-center gap-2 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              <TabIcon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Assets Grid */}
      {showProjectCard || displayedAssets.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {/* PROJET IMMOBILIER EN PRÉPARATION (Card distincte de projet) */}
          {showProjectCard && plannedRealEstatePlan && projectMetrics && (
            <div
              key="real-estate-project-card"
              className="relative rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-700/80 bg-gradient-to-b from-indigo-50/70 via-white to-purple-50/40 dark:from-indigo-950/30 dark:via-slate-900 dark:to-purple-950/20 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20 shrink-0">
                      <Home className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                          PROJET EN PRÉPARATION
                        </span>
                        {plannedRealEstatePlan.targetDate && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                            <Clock className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                            Cible {formatProjectTargetDate(plannedRealEstatePlan.targetDate)}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight mt-1.5">
                        {plannedRealEstatePlan.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {plannedRealEstatePlan.propertyType === 'new'
                          ? 'Logement Neuf (RE2020)'
                          : plannedRealEstatePlan.propertyType === 'construction'
                          ? 'Maison & Construction'
                          : 'Immobilier Ancien'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => onViewChange?.('real-estate-project')}
                    className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 rounded-xl transition"
                    title="Accéder au simulateur immobilier"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Valuation & Budget box */}
                <div className="mt-4 p-3.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-indigo-100 dark:border-indigo-900/50 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Prix d'achat visé :</span>
                    <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                      {money(plannedRealEstatePlan.propertyPrice)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Enveloppe globale estimée :</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {money(projectMetrics.totalCost)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500 dark:text-slate-400">Apport personnel prévu :</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {money(projectMetrics.totalContribution)}
                    </span>
                  </div>
                </div>

                {/* Financing Box */}
                <div className="mt-3 p-3.5 rounded-xl border border-indigo-200/70 bg-indigo-50/50 dark:border-indigo-900/40 dark:bg-indigo-950/25 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      Financement bancaire projeté
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300">
                      Sur {plannedRealEstatePlan.mainLoanDurationYears || 25} ans
                    </span>
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                    <span>Besoin d'emprunt :</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {money(projectMetrics.totalBorrowing)}
                      {plannedRealEstatePlan.hasPtz && projectMetrics.ptzPrincipal > 0 && projectMetrics.isPtzOldEligible ? (
                        <span className="font-normal text-indigo-600 dark:text-indigo-400 ml-1">
                          (dont {money(projectMetrics.ptzPrincipal)} PTZ)
                        </span>
                      ) : null}
                    </span>
                  </div>

                  {projectMetrics.activeMonthlyPayment > 0 && (
                    <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                      <span>Mensualité estimée :</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        ~{money(Math.round(projectMetrics.activeMonthlyPayment))}/mois
                      </span>
                    </div>
                  )}

                  {Boolean(plannedRealEstatePlan.buyerBName) && (
                    <div className="pt-1.5 border-t border-indigo-200/40 dark:border-indigo-800/40 flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
                      <span>Quote-part notariée :</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {plannedRealEstatePlan.buyerAName || 'Arthur'} {projectMetrics.officialRatioA.toFixed(1)}% / {plannedRealEstatePlan.buyerBName || 'Alicia'} {projectMetrics.officialRatioB.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer */}
              <div className="mt-4 pt-3 border-t border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
                <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Simulateur Immo Pathly
                </span>
                <button
                  onClick={() => onViewChange?.('real-estate-project')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm hover:shadow"
                >
                  <span>Gérer le projet</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {displayedAssets.map(asset => {
            const Icon = getCategoryIcon(asset.category);
            const badgeClass = getCategoryBadgeColor(asset.category);
            const gain = asset.currentValue - asset.purchasePrice;
            const gainPercent = asset.purchasePrice > 0 ? (gain / asset.purchasePrice) * 100 : 0;
            
            // Check linked debts (supporting multiple debts e.g. main loan + PTZ)
            const linkedDebts = getAssetDebts(asset);
            const linkedDebt = linkedDebts[0];
            const loanDetails = asset.loanDetails;
            const isFuture = isFutureAsset(asset);
            
            const remainingLoan = linkedDebts.length > 0
              ? linkedDebts.reduce((sum: number, d: any) => sum + (d.remainingAmount || 0), 0)
              : (loanDetails?.originalLoanAmount || 0);
            const originalLoan = linkedDebts.length > 0
              ? linkedDebts.reduce((sum: number, d: any) => sum + (d.totalAmount || 0), 0)
              : (loanDetails?.originalLoanAmount || 0);
            const assetEquity = asset.currentValue - remainingLoan;
            
            // Loan progress
            const loanPaid = originalLoan > 0 ? Math.max(0, originalLoan - remainingLoan) : 0;
            const loanProgressPercent = originalLoan > 0 ? Math.min(100, (loanPaid / originalLoan) * 100) : 0;

            return (
              <div
                key={asset.id}
                className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-card transition hover:shadow-card-hover dark:border-slate-800/80 dark:bg-slate-900 flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-800 dark:text-slate-200">
                        <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                          {asset.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badgeClass}`}>
                            {getCategoryLabel(asset.category)}
                          </span>
                          {asset.location && (
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                              • {asset.location}
                            </span>
                          )}
                          {isFuture && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              Achat prévu {asset.purchaseDate ? format(new Date(asset.purchaseDate), 'MMM yyyy', { locale: fr }) : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(asset)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                        title="Modifier le bien"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(asset.id, asset.name)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                        title="Supprimer le bien"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Valuation & Capital Gain */}
                  <div className="mt-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Valeur marchande actuelle :</span>
                      <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                        {money(asset.currentValue)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">
                        Prix d'achat ({asset.purchaseDate ? format(new Date(asset.purchaseDate), 'MMM yyyy', { locale: fr }) : '-'}) :
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {money(asset.purchasePrice)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-slate-500 dark:text-slate-400">Évolution :</span>
                      <span className={`font-semibold flex items-center gap-1 ${
                        gain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {gain >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {gain >= 0 ? '+' : ''}{money(gain)} ({gain >= 0 ? '+' : ''}{gainPercent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>

                  {/* Credit / Mortgage Section if present */}
                  {(linkedDebts.length > 0 || loanDetails) && (
                    <div className="mt-3 p-3.5 rounded-xl border border-blue-100 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/20 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                          <CreditCard className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          {linkedDebts.length > 1
                            ? `${linkedDebts.length} crédits associés`
                            : (linkedDebt ? linkedDebt.name : 'Crédit associé')}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          remainingLoan <= 0
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                        }`}>
                          {remainingLoan <= 0 ? 'Crédit soldé' : 'En cours'}
                        </span>
                      </div>

                      {/* Detail per loan if multiple */}
                      {linkedDebts.length > 1 && (
                        <div className="space-y-1 pt-1 border-t border-blue-200/40 dark:border-blue-800/40">
                          {linkedDebts.map((d: any) => (
                            <div key={d.id} className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
                              <span className="truncate max-w-[180px]">{d.name}</span>
                              <span className="font-semibold text-rose-600 dark:text-rose-400">-{money(d.remainingAmount)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Dates */}
                      {(loanDetails?.startDate || linkedDebt?.dueDate || loanDetails?.endDate || linkedDebt?.endDate) && (
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>
                            Début : {loanDetails?.startDate 
                              ? format(new Date(loanDetails.startDate), 'dd/MM/yyyy')
                              : linkedDebt ? format(linkedDebt.dueDate, 'dd/MM/yyyy') : '-'}
                          </span>
                          <ArrowRight className="h-3 w-3 text-slate-400" />
                          <span>
                            Fin : {loanDetails?.endDate 
                              ? format(new Date(loanDetails.endDate), 'dd/MM/yyyy')
                              : linkedDebt?.endDate ? format(linkedDebt.endDate, 'dd/MM/yyyy') : 'Non définie'}
                          </span>
                        </div>
                      )}

                      {/* Progress Bar */}
                      {originalLoan > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-medium text-slate-600 dark:text-slate-300">
                            <span>Remboursé : {loanProgressPercent.toFixed(0)}%</span>
                            <span>Reste : {money(remainingLoan)}</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-blue-100 dark:bg-blue-900/40 overflow-hidden">
                            <div 
                              className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-500" 
                              style={{ width: `${loanProgressPercent}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Net Equity for this asset */}
                      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-blue-200/50 dark:border-blue-800/50">
                        <span className="font-medium text-blue-900 dark:text-blue-200">
                          Capital net acquis (Equity) :
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {money(assetEquity)}
                        </span>
                      </div>
                    </div>
                  )}

                  {asset.notes && (
                    <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400 italic">
                      "{asset.notes}"
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Enregistré dans Pathly</span>
                  <span className="font-medium text-slate-500 dark:text-slate-400">
                    Net : {money(assetEquity)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3">
            <Building2 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Aucun bien répertorié pour le moment
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Ajoutez votre résidence, un appartement, votre véhicule ou vos montres de collection pour suivre l'évolution de votre patrimoine réel.
          </p>
          <button
            onClick={openAddModal}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Plus className="h-4 w-4" />
            Ajouter mon premier bien
          </button>
        </div>
      )}

      {/* MODAL: AJOUTER / MODIFIER UN BIEN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 modal-overlay sm:items-center sm:p-4">
          <div className="max-h-[92dvh] w-full modal-panel rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:max-w-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-slate-200/70 bg-gradient-to-b from-slate-50 to-white px-5 py-4 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900 sm:px-6">
              <div>
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">
                  {editingAsset ? 'Modifier le bien' : 'Ajouter un actif à votre patrimoine'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Maison, voiture, montre, investissement matériel...
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="max-h-[calc(92dvh-5rem)] space-y-4 overflow-y-auto p-5 sm:p-6">
              {/* Type / Category selection */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                  Catégorie de bien *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'real_estate', label: 'Immobilier', icon: Building2 },
                    { id: 'vehicle', label: 'Véhicule', icon: Car },
                    { id: 'valuable_item', label: 'Montre / Luxe', icon: Watch },
                    { id: 'other', label: 'Autre actif', icon: Package },
                  ].map(cat => {
                    const CatIcon = cat.icon;
                    const isSelected = formData.category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, category: cat.id as any })}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                            : 'border-slate-200 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <CatIcon className="h-5 w-5 mb-1 text-blue-600 dark:text-blue-400" />
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Name & Location */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Nom du bien *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Maison principale, BMW Série 1, Rolex Submariner..."
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Localisation / Détail
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Rouen, Coffre, Garage..."
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Purchase price & Current value */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Prix d'achat (€) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    placeholder="Ex: 240000"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Valeur actuelle (€) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    placeholder="Ex: 265000"
                    value={formData.currentValue}
                    onChange={(e) => setFormData({ ...formData, currentValue: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Date d'acquisition *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* SECTION CRÉDIT / FINANCEMENT */}
              <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/50 dark:bg-blue-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Financement par crédit / emprunt
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Date de début, date de fin et amortissement
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.hasLoan}
                    onChange={(e) => setFormData({ ...formData, hasLoan: e.target.checked })}
                    className="h-5 w-5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>

                {formData.hasLoan && (
                  <div className="pt-2 border-t border-blue-200/60 dark:border-blue-800/60 space-y-3">
                    {/* Choose existing Pathly debt or create new */}
                    {debts.length > 0 && (
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Associer à un prêt déjà existant dans Pathly
                        </label>
                        <select
                          value={formData.selectedDebtId}
                          onChange={(e) => {
                            const debtId = e.target.value;
                            const d = debts.find(item => item.id === debtId);
                            setFormData({
                              ...formData,
                              selectedDebtId: debtId,
                              loanOriginalAmount: d ? d.totalAmount.toString() : formData.loanOriginalAmount,
                              loanRemainingAmount: d ? d.remainingAmount.toString() : formData.loanRemainingAmount,
                              loanStartDate: d ? format(d.dueDate, 'yyyy-MM-dd') : formData.loanStartDate,
                              loanEndDate: d?.endDate ? format(d.endDate, 'yyyy-MM-dd') : formData.loanEndDate,
                              loanMonthlyPayment: d ? d.minimumPayment.toString() : formData.loanMonthlyPayment,
                            });
                          }}
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        >
                          <option value="">-- Sélectionner un crédit ou renseigner ci-dessous --</option>
                          {debts.map(d => (
                            <option key={d.id} value={d.id}>
                              {d.name} (Reste : {money(d.remainingAmount)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Loan specific dates and amounts */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Date de début du crédit
                        </label>
                        <input
                          type="date"
                          value={formData.loanStartDate}
                          onChange={(e) => setFormData({ ...formData, loanStartDate: e.target.value })}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Date de fin du crédit
                        </label>
                        <input
                          type="date"
                          value={formData.loanEndDate}
                          onChange={(e) => setFormData({ ...formData, loanEndDate: e.target.value })}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Montant emprunté initial (€)
                        </label>
                        <input
                          type="number"
                          placeholder="Ex: 200000"
                          value={formData.loanOriginalAmount}
                          onChange={(e) => setFormData({ ...formData, loanOriginalAmount: e.target.value })}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Reste à rembourser (€)
                        </label>
                        <input
                          type="number"
                          placeholder="Ex: 175000"
                          value={formData.loanRemainingAmount}
                          onChange={(e) => setFormData({ ...formData, loanRemainingAmount: e.target.value })}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Mensualité (€/mois)
                        </label>
                        <input
                          type="number"
                          placeholder="Ex: 980"
                          value={formData.loanMonthlyPayment}
                          onChange={(e) => setFormData({ ...formData, loanMonthlyPayment: e.target.value })}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                    </div>

                    {!formData.selectedDebtId && (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          id="createDebt"
                          checked={formData.createDebtRecord}
                          onChange={(e) => setFormData({ ...formData, createDebtRecord: e.target.checked })}
                          className="h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="createDebt" className="text-xs font-medium text-blue-900 dark:text-blue-300 cursor-pointer">
                          Enregistrer aussi ce crédit dans le gestionnaire de dettes de Pathly (suivi mensuel & échéances)
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notes & Références (optionnel)
                </label>
                <textarea
                  rows={2}
                  placeholder="Informations complémentaires, modèle, assureur..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Modal Buttons */}
              <div className="sticky bottom-0 -mx-5 -mb-5 flex items-center justify-end gap-3 border-t border-slate-200 bg-white/95 px-5 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:-mx-6 sm:-mb-6 sm:px-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
                >
                  <Save className="h-4 w-4" />
                  <span>{editingAsset ? 'Enregistrer les modifications' : 'Ajouter le bien'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetManager;
