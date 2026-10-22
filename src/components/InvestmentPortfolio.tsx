import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Search,
  ShieldCheck,
  Clock,
  Wallet,
  BarChart2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Layers,
  ChevronRight,
  Info,
  Sliders,
  DollarSign,
  HelpCircle
} from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';
import { InvestmentPosition, BankAccount, StockSearchResult, StockQuote } from '../types';
import { searchStocks, fetchStockQuotes, fetchEurUsdRate, POPULAR_FRENCH_ASSETS } from '../services/stockService';

interface InvestmentPortfolioProps {
  onViewChange?: (view: string) => void;
}

export const InvestmentPortfolio: React.FC<InvestmentPortfolioProps> = ({ onViewChange }) => {
  const {
    accounts,
    addAccount,
    updateAccount,
    investmentPositions,
    addInvestmentPosition,
    updateInvestmentPosition,
    deleteInvestmentPosition
  } = useBudget();

  // Active filter tab: 'all' | 'pea' | 'cto' | 'crypto'
  const [activeTab, setActiveTab] = useState<'all' | 'pea' | 'cto' | 'crypto'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssetType, setSelectedAssetType] = useState<string>('all');

  // Live quotes state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [quotesMap, setQuotesMap] = useState<Record<string, StockQuote>>({});
  const [usdRate, setUsdRate] = useState<number>(1.08);

  // Modals state
  const [showAddPositionModal, setShowAddPositionModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState<InvestmentPosition | null>(null);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);

  // Form state for adding/editing position
  const [formSymbol, setFormSymbol] = useState('');
  const [formName, setFormName] = useState('');
  const [formAccountId, setFormAccountId] = useState('');
  const [formShares, setFormShares] = useState('');
  const [formBuyPrice, setFormBuyPrice] = useState('');
  const [formCurrentPrice, setFormCurrentPrice] = useState('');
  const [formAssetType, setFormAssetType] = useState<'etf' | 'stock' | 'crypto' | 'bond' | 'other'>('etf');
  const [formCurrency, setFormCurrency] = useState('EUR');
  const [formNotes, setFormNotes] = useState('');

  // Autocomplete search in modal
  const [tickerSearchInput, setTickerSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Form state for creating an investment account (PEA/CTO)
  const [accName, setAccName] = useState('');
  const [accSubType, setAccSubType] = useState<'pea' | 'cto' | 'crypto'>('pea');
  const [accBankName, setAccBankName] = useState('BoursoBank');
  const [accCashBalance, setAccCashBalance] = useState('');
  const [accTotalDeposits, setAccTotalDeposits] = useState('');
  const [accOpeningDate, setAccOpeningDate] = useState(new Date().toISOString().substring(0, 10));

  // Find all investment & crypto accounts
  const investmentAccounts = useMemo(() => {
    return accounts.filter(a => a.isActive && (a.type === 'investment' || a.type === 'crypto' || a.subType === 'pea' || a.subType === 'cto'));
  }, [accounts]);

  // Separate PEA and CTO accounts
  const peaAccount = useMemo(() => {
    return investmentAccounts.find(a => a.subType === 'pea' || a.name.toLowerCase().includes('pea'));
  }, [investmentAccounts]);

  const ctoAccount = useMemo(() => {
    return investmentAccounts.find(a => a.subType === 'cto' || a.name.toLowerCase().includes('cto') || a.name.toLowerCase().includes('titres'));
  }, [investmentAccounts]);

  // Set default account for position modal
  useEffect(() => {
    if (!formAccountId && investmentAccounts.length > 0) {
      setFormAccountId(investmentAccounts[0].id);
    }
  }, [investmentAccounts, formAccountId]);

  // Fetch quotes function
  const refreshQuotes = async () => {
    const symbols = investmentPositions.map(p => p.symbol).filter(Boolean);
    if (symbols.length === 0) return;

    setIsRefreshing(true);
    try {
      const [newQuotes, rate] = await Promise.all([
        fetchStockQuotes(symbols),
        fetchEurUsdRate()
      ]);
      setQuotesMap(prev => ({ ...prev, ...newQuotes }));
      setUsdRate(rate);
      setLastRefreshedAt(new Date());
    } catch (err) {
      console.error('Failed to refresh quotes:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto-refresh on mount if positions exist
  useEffect(() => {
    if (investmentPositions.length > 0 && !lastRefreshedAt) {
      refreshQuotes();
    }
  }, [investmentPositions.length]);

  // Handle autocomplete search
  useEffect(() => {
    if (!tickerSearchInput || tickerSearchInput.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchStocks(tickerSearchInput);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [tickerSearchInput]);

  // Select a search result
  const handleSelectAsset = async (item: StockSearchResult | { symbol: string; name: string; type: string }) => {
    setFormSymbol(item.symbol);
    setFormName(item.name);
    setFormAssetType(item.type === 'stock' ? 'stock' : item.type === 'crypto' ? 'crypto' : 'etf');
    setTickerSearchInput('');
    setSearchResults([]);

    // Try fetching the live price immediately
    try {
      const quotes = await fetchStockQuotes([item.symbol]);
      const q = quotes[item.symbol];
      if (q && q.price) {
        setFormCurrentPrice(q.price.toString());
        setFormCurrency(q.currency || 'EUR');
        if (!formBuyPrice) {
          setFormBuyPrice(q.price.toString());
        }
      }
    } catch {}
  };

  // Reset form
  const resetForm = () => {
    setFormSymbol('');
    setFormName('');
    setFormShares('');
    setFormBuyPrice('');
    setFormCurrentPrice('');
    setFormAssetType('etf');
    setFormCurrency('EUR');
    setFormNotes('');
    setEditingPosition(null);
    setTickerSearchInput('');
  };

  // Open edit modal
  const handleOpenEdit = (pos: InvestmentPosition) => {
    setEditingPosition(pos);
    setFormSymbol(pos.symbol);
    setFormName(pos.name);
    setFormAccountId(pos.accountId);
    setFormShares(pos.shares.toString());
    setFormBuyPrice(pos.buyPrice.toString());
    setFormCurrentPrice(pos.currentPrice.toString());
    setFormAssetType(pos.assetType);
    setFormCurrency(pos.currency || 'EUR');
    setFormNotes(pos.notes || '');
    setShowAddPositionModal(true);
  };

  // Save position
  const handleSavePosition = async (e: React.FormEvent) => {
    e.preventDefault();
    const sharesNum = parseFloat(formShares);
    const buyPriceNum = parseFloat(formBuyPrice);
    const currentPriceNum = parseFloat(formCurrentPrice) || buyPriceNum;

    if (!formSymbol || !formName || isNaN(sharesNum) || sharesNum <= 0 || isNaN(buyPriceNum) || buyPriceNum < 0) {
      alert('Veuillez renseigner un symbole, un nom, un nombre de parts valide et un PRU.');
      return;
    }

    if (!formAccountId) {
      alert('Veuillez sélectionner un compte de détention (PEA ou CTO).');
      return;
    }

    const symbolUpper = formSymbol.trim().toUpperCase();
    const posPayload = {
      symbol: symbolUpper,
      name: formName.trim(),
      accountId: formAccountId,
      shares: sharesNum,
      buyPrice: buyPriceNum,
      currentPrice: currentPriceNum,
      assetType: formAssetType,
      currency: formCurrency,
      notes: formNotes.trim() || undefined,
      lastPriceUpdatedAt: new Date().toISOString()
    };

    if (editingPosition) {
      await updateInvestmentPosition(editingPosition.id, posPayload);
    } else {
      await addInvestmentPosition(posPayload);
    }

    setShowAddPositionModal(false);
    resetForm();

    // Immediately fetch quote for this symbol to populate live market data
    if (symbolUpper) {
      fetchStockQuotes([symbolUpper]).then(quotes => {
        if (quotes && quotes[symbolUpper]) {
          setQuotesMap(prev => ({ ...prev, ...quotes }));
        }
      }).catch(() => {});
    }
  };

  // Create new investment account
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) {
      alert('Veuillez nommer le compte.');
      return;
    }

    const cash = parseFloat(accCashBalance) || 0;
    const deposits = parseFloat(accTotalDeposits) || 0;

    await addAccount({
      name: accName.trim(),
      type: accSubType === 'crypto' ? 'crypto' : 'investment',
      subType: accSubType,
      balance: cash,
      currency: 'EUR',
      color: accSubType === 'pea' ? '#059669' : '#4F46E5',
      isActive: true,
      order: accounts.length + 1,
      bankName: accBankName.trim() || undefined,
      totalDeposits: deposits,
      openingDate: accOpeningDate || undefined,
      description: accSubType === 'pea' ? 'Plan d\'Épargne en Actions' : 'Compte-Titres Ordinaire'
    });

    setShowAddAccountModal(false);
    setAccName('');
    setAccCashBalance('');
    setAccTotalDeposits('');
  };

  // ==========================================
  // CALCULATIONS & PORTFOLIO METRICS
  // ==========================================
  const portfolioMetrics = useMemo(() => {
    let totalInvestedEur = 0;
    let totalCurrentValueEur = 0;
    let totalDayChangeEur = 0;

    const enrichedPositions = investmentPositions.map(pos => {
      const quote = quotesMap[pos.symbol];
      const livePrice = quote?.price ?? pos.currentPrice;
      const prevClose = quote?.previousClose ?? pos.previousClosePrice ?? livePrice;

      // Currency conversion factor to EUR
      const isUsd = pos.currency === 'USD';
      const toEur = isUsd ? (1 / (usdRate || 1.08)) : 1;

      const investedPos = pos.shares * pos.buyPrice * toEur;
      const currentValPos = pos.shares * livePrice * toEur;
      const gainLossEur = currentValPos - investedPos;
      const gainLossPercent = investedPos > 0 ? (gainLossEur / investedPos) * 100 : 0;

      const dayChangePosEur = (livePrice - prevClose) * pos.shares * toEur;
      const dayChangePercent = prevClose > 0 ? ((livePrice - prevClose) / prevClose) * 100 : 0;

      totalInvestedEur += investedPos;
      totalCurrentValueEur += currentValPos;
      totalDayChangeEur += dayChangePosEur;

      const account = accounts.find(a => a.id === pos.accountId);
      const isPea = account?.subType === 'pea' || account?.name.toLowerCase().includes('pea');

      return {
        ...pos,
        livePrice,
        prevClose,
        investedPos,
        currentValPos,
        gainLossEur,
        gainLossPercent,
        dayChangePosEur,
        dayChangePercent,
        accountName: account?.name || 'Compte Bourse',
        isPea,
      };
    });

    const totalGainLossEur = totalCurrentValueEur - totalInvestedEur;
    const totalGainLossPercent = totalInvestedEur > 0 ? (totalGainLossEur / totalInvestedEur) * 100 : 0;
    const totalDayChangePercent = (totalCurrentValueEur - totalDayChangeEur) > 0
      ? (totalDayChangeEur / (totalCurrentValueEur - totalDayChangeEur)) * 100
      : 0;

    // Total cash in investment accounts
    const totalCashEur = investmentAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
    const grandTotalPortfolioEur = totalCurrentValueEur + totalCashEur;

    // PEA specific metrics
    const peaPositions = enrichedPositions.filter(p => p.isPea);
    const peaValuation = peaPositions.reduce((sum, p) => sum + p.currentValPos, 0);
    const peaCash = peaAccount?.balance || 0;
    const peaTotal = peaValuation + peaCash;
    const peaDeposits = peaAccount?.totalDeposits || 0;
    const peaCeiling = 150000;
    const peaRemainingDeposit = Math.max(0, peaCeiling - peaDeposits);
    const peaCeilingProgress = (peaDeposits / peaCeiling) * 100;

    // PEA 5 years clock
    let peaAgeYears = 0;
    let peaAgeMonths = 0;
    let isPeaMature = false;
    if (peaAccount?.openingDate) {
      const openDate = new Date(peaAccount.openingDate);
      const now = new Date();
      const diffMs = now.getTime() - openDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      peaAgeYears = Math.floor(diffDays / 365.25);
      peaAgeMonths = Math.floor((diffDays % 365.25) / 30.4);
      isPeaMature = diffDays >= (5 * 365.25);
    }

    // CTO specific metrics
    const ctoPositions = enrichedPositions.filter(p => !p.isPea);
    const ctoValuation = ctoPositions.reduce((sum, p) => sum + p.currentValPos, 0);
    const ctoCash = ctoAccount?.balance || 0;
    const ctoTotal = ctoValuation + ctoCash;

    // Breakdown by asset type
    const etfVal = enrichedPositions.filter(p => p.assetType === 'etf').reduce((s, p) => s + p.currentValPos, 0);
    const stockVal = enrichedPositions.filter(p => p.assetType === 'stock').reduce((s, p) => s + p.currentValPos, 0);
    const cryptoVal = enrichedPositions.filter(p => p.assetType === 'crypto').reduce((s, p) => s + p.currentValPos, 0);

    return {
      totalInvestedEur,
      totalCurrentValueEur,
      totalCashEur,
      grandTotalPortfolioEur,
      totalGainLossEur,
      totalGainLossPercent,
      totalDayChangeEur,
      totalDayChangePercent,
      enrichedPositions,
      peaPositions,
      peaValuation,
      peaCash,
      peaTotal,
      peaDeposits,
      peaCeiling,
      peaRemainingDeposit,
      peaCeilingProgress,
      peaAgeYears,
      peaAgeMonths,
      isPeaMature,
      ctoPositions,
      ctoValuation,
      ctoCash,
      ctoTotal,
      etfVal,
      stockVal,
      cryptoVal,
    };
  }, [investmentPositions, quotesMap, usdRate, accounts, investmentAccounts, peaAccount, ctoAccount]);

  // Filtered positions based on activeTab, search query, and assetType
  const displayedPositions = useMemo(() => {
    let list = portfolioMetrics.enrichedPositions;

    if (activeTab === 'pea') {
      list = list.filter(p => p.isPea);
    } else if (activeTab === 'cto') {
      list = list.filter(p => !p.isPea && p.assetType !== 'crypto');
    } else if (activeTab === 'crypto') {
      list = list.filter(p => p.assetType === 'crypto');
    }

    if (selectedAssetType !== 'all') {
      list = list.filter(p => p.assetType === selectedAssetType);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p => p.symbol.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
    }

    return list;
  }, [portfolioMetrics.enrichedPositions, activeTab, selectedAssetType, searchQuery]);

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-tr from-indigo-600 to-purple-600 text-white rounded-xl shadow-md">
              <TrendingUp className="h-6 w-6" />
            </div>
            <span>Bourse & Portefeuille</span>
            <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-full">
              PEA • CTO • En direct
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Suivez vos actions, ETF et cryptos avec cotation en temps réel, calcul du PRU et plus-values latentes.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={refreshQuotes}
            disabled={isRefreshing}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm transition"
            title="Actualiser les cours via Yahoo Finance"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            <span>{isRefreshing ? 'Actualisation...' : 'Actualiser les cours'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowAddPositionModal(true);
            }}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md transition"
          >
            <Plus className="h-4 w-4" />
            <span>Ajouter une position</span>
          </button>
        </div>
      </div>

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Portfolio Value */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Valeur du Portefeuille</span>
            <Wallet className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {portfolioMetrics.grandTotalPortfolioEur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </div>
          <div className="text-xs text-slate-500 flex justify-between pt-1 border-t border-slate-100 dark:border-slate-700">
            <span>Titres : {portfolioMetrics.totalCurrentValueEur.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</span>
            <span>Espèces : {portfolioMetrics.totalCashEur.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €</span>
          </div>
        </div>

        {/* Global Latent Gain/Loss */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Plus / Moins-Value Globale</span>
            {portfolioMetrics.totalGainLossEur >= 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-rose-500" />
            )}
          </div>
          <div className={`text-2xl font-black ${portfolioMetrics.totalGainLossEur >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {portfolioMetrics.totalGainLossEur >= 0 ? '+' : ''}
            {portfolioMetrics.totalGainLossEur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-700">
            <span className="text-slate-500">Performance latente</span>
            <span className={`font-bold ${portfolioMetrics.totalGainLossPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {portfolioMetrics.totalGainLossPercent >= 0 ? '+' : ''}
              {portfolioMetrics.totalGainLossPercent.toFixed(2)} %
            </span>
          </div>
        </div>

        {/* Day Variation */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Variation du Jour (24h)</span>
            {portfolioMetrics.totalDayChangeEur >= 0 ? (
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-rose-500" />
            )}
          </div>
          <div className={`text-2xl font-black ${portfolioMetrics.totalDayChangeEur >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {portfolioMetrics.totalDayChangeEur >= 0 ? '+' : ''}
            {portfolioMetrics.totalDayChangeEur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-700">
            <span className="text-slate-500">Variation 24h</span>
            <span className={`font-bold ${portfolioMetrics.totalDayChangePercent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {portfolioMetrics.totalDayChangePercent >= 0 ? '+' : ''}
              {portfolioMetrics.totalDayChangePercent.toFixed(2)} %
            </span>
          </div>
        </div>

        {/* Capital Invested vs Valuation */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Capital Investi (PRU)</span>
            <Layers className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {portfolioMetrics.totalInvestedEur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-700 text-slate-500">
            <span>{investmentPositions.length} position{investmentPositions.length > 1 ? 's' : ''} détenue{investmentPositions.length > 1 ? 's' : ''}</span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              {lastRefreshedAt ? `Cotations ${lastRefreshedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'Cotation active'}
            </span>
          </div>
        </div>
      </div>

      {/* PEA FISCAL BANNER / CEILING WIDGET (IF PEA HAS BEEN CREATED OR TARGETED) */}
      {peaAccount ? (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>{peaAccount.name}</span>
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                Plafond 150 000 €
              </span>
              {peaAccount.openingDate && (
                <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>
                    {portfolioMetrics.isPeaMature
                      ? 'Maturité fiscale 5 ans atteinte (Exonération d\'IR)'
                      : `Ancienneté : ${portfolioMetrics.peaAgeYears} an(s) et ${portfolioMetrics.peaAgeMonths} mois`}
                  </span>
                </span>
              )}
            </div>
            <p className="text-xs text-emerald-800 dark:text-emerald-300">
              Valorisation totale du PEA : <strong>{portfolioMetrics.peaTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</strong> (dont {portfolioMetrics.peaCash.toLocaleString('fr-FR')} € d'espèces non investies).
            </p>
          </div>

          {/* Progress bar of deposits */}
          <div className="w-full md:w-64 space-y-1.5 shrink-0">
            <div className="flex justify-between text-[11px] font-bold text-emerald-900 dark:text-emerald-200">
              <span>Versements : {portfolioMetrics.peaDeposits.toLocaleString('fr-FR')} €</span>
              <span>Reste : {portfolioMetrics.peaRemainingDeposit.toLocaleString('fr-FR')} €</span>
            </div>
            <div className="w-full h-2.5 bg-emerald-200/80 dark:bg-emerald-900/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.max(2, portfolioMetrics.peaCeilingProgress))}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-3 text-indigo-950 dark:text-indigo-200">
            <Sparkles className="h-5 w-5 text-indigo-600 shrink-0" />
            <div>
              <strong>Configurez votre PEA dans Pathly :</strong> Suivez votre plafond de versements de 150 000 € et l'horloge fiscale des 5 ans pour vos ETF Monde / Actions françaises.
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setAccSubType('pea');
              setAccName('PEA BoursoBank');
              setShowAddAccountModal(true);
            }}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shrink-0 shadow-sm transition"
          >
            + Configurer mon PEA
          </button>
        </div>
      )}

      {/* FILTER TABS & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-3">
        {/* Envelopes Tabs */}
        <div className="flex items-center space-x-2">
          {[
            { id: 'all', label: 'Toutes les positions', count: portfolioMetrics.enrichedPositions.length },
            { id: 'pea', label: 'Mon PEA', count: portfolioMetrics.peaPositions.length },
            { id: 'cto', label: 'Mon CTO', count: portfolioMetrics.ctoPositions.length },
            { id: 'crypto', label: 'Cryptos', count: portfolioMetrics.enrichedPositions.filter(p => p.assetType === 'crypto').length },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === tab.id
                  ? 'bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Asset Type Filter */}
        <div className="flex items-center space-x-2">
          <div className="relative w-48">
            <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filtrer ticker, nom..."
              className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 dark:text-white"
            />
          </div>

          <select
            value={selectedAssetType}
            onChange={e => setSelectedAssetType(e.target.value)}
            className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Tous types</option>
            <option value="etf">ETF</option>
            <option value="stock">Actions</option>
            <option value="crypto">Cryptos</option>
          </select>
        </div>
      </div>

      {/* POSITIONS TABLE */}
      {displayedPositions.length > 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-4">Titre / Symbole</th>
                  <th className="py-3 px-3">Compte</th>
                  <th className="py-3 px-3 text-right">Parts</th>
                  <th className="py-3 px-3 text-right">PRU Achat</th>
                  <th className="py-3 px-3 text-right">Cours Actuel</th>
                  <th className="py-3 px-3 text-right">Valeur Totale</th>
                  <th className="py-3 px-3 text-right">Plus-Value Latente</th>
                  <th className="py-3 px-3 text-right">Var. Jour</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                {displayedPositions.map(pos => {
                  const isPositive = pos.gainLossEur >= 0;
                  const isDayPositive = pos.dayChangePosEur >= 0;

                  return (
                    <tr key={pos.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-750/40 transition-colors">
                      {/* Name & Symbol */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                          <span>{pos.name}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 mt-0.5">
                          <span className="font-mono font-bold text-[11px] px-1.5 py-0.2 bg-slate-100 dark:bg-slate-700 rounded text-slate-700 dark:text-slate-300">
                            {pos.symbol}
                          </span>
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.2 rounded ${
                            pos.assetType === 'etf'
                              ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                              : pos.assetType === 'crypto'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                              : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                          }`}>
                            {pos.assetType.toUpperCase()}
                          </span>
                        </div>
                      </td>

                      {/* Account envelope badge */}
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          pos.isPea
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            : 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300'
                        }`}>
                          {pos.accountName}
                        </span>
                      </td>

                      {/* Shares */}
                      <td className="py-3 px-3 text-right font-bold text-slate-800 dark:text-slate-200">
                        {pos.shares.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}
                      </td>

                      {/* Buy Price (PRU) */}
                      <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-400">
                        {pos.buyPrice.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {pos.currency === 'USD' ? '$' : '€'}
                        <div className="text-[10px] text-slate-400">
                          Inv : {pos.investedPos.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
                        </div>
                      </td>

                      {/* Current live price */}
                      <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                        {pos.livePrice.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {pos.currency === 'USD' ? '$' : '€'}
                      </td>

                      {/* Total current value in EUR */}
                      <td className="py-3 px-3 text-right font-black text-slate-900 dark:text-white text-sm">
                        {pos.currentValPos.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </td>

                      {/* Gain / Loss */}
                      <td className="py-3 px-3 text-right">
                        <div className={`font-black text-xs ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {isPositive ? '+' : ''}{pos.gainLossEur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </div>
                        <div className={`text-[10px] font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isPositive ? '+' : ''}{pos.gainLossPercent.toFixed(2)} %
                        </div>
                      </td>

                      {/* Day Variation */}
                      <td className="py-3 px-3 text-right">
                        <span className={`inline-flex items-center space-x-0.5 text-[11px] font-bold ${
                          isDayPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {isDayPositive ? '+' : ''}{pos.dayChangePercent.toFixed(2)} %
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(pos)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                            title="Modifier cette position"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Supprimer la position "${pos.name}" (${pos.symbol}) ?`)) {
                                deleteInvestmentPosition(pos.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                            title="Supprimer la position"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center mx-auto">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Aucune position boursière pour le moment
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
              Commencez à suivre vos ETF, actions françaises ou internationales en ajoutant votre première ligne ou en sélectionnant un actif populaire ci-dessous :
            </p>
          </div>

          {/* Quick presets chips */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 max-w-2xl mx-auto">
            {POPULAR_FRENCH_ASSETS.slice(0, 6).map(preset => (
              <button
                key={preset.symbol}
                type="button"
                onClick={() => {
                  resetForm();
                  handleSelectAsset(preset);
                  setShowAddPositionModal(true);
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 dark:bg-slate-700 dark:hover:bg-indigo-950/40 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-indigo-600 transition border border-transparent hover:border-indigo-200"
              >
                <Plus className="h-3 w-3" />
                <span>{preset.symbol} ({preset.name})</span>
              </button>
            ))}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowAddPositionModal(true);
              }}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition"
            >
              + Ajouter ma première ligne
            </button>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT POSITION */}
      {showAddPositionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 rounded-xl">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    {editingPosition ? 'Modifier la position' : 'Ajouter un titre au portefeuille'}
                  </h3>
                  <p className="text-xs text-slate-500">Action, ETF, Crypto (PEA ou CTO)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddPositionModal(false);
                  resetForm();
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Quick Autocomplete Search */}
            {!editingPosition && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Rechercher un actif (Ticker, Nom d'action ou ETF)
                </label>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={tickerSearchInput}
                    onChange={e => setTickerSearchInput(e.target.value)}
                    placeholder="Ex: CW8, LVMH, S&P 500, Total, NVDA..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                  {isSearching && (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin absolute right-3 top-3 text-indigo-500" />
                  )}
                </div>

                {/* Search Results Dropdown */}
                {searchResults.length > 0 && (
                  <div className="p-1 bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg max-h-48 overflow-y-auto space-y-1">
                    {searchResults.map((item, idx) => (
                      <button
                        key={`${item.symbol}-${idx}`}
                        type="button"
                        onClick={() => handleSelectAsset(item)}
                        className="w-full p-2 text-left hover:bg-indigo-50 dark:hover:bg-slate-700/60 rounded-lg flex items-center justify-between text-xs transition"
                      >
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white">{item.name}</span>
                          <span className="ml-2 font-mono font-bold text-indigo-600 dark:text-indigo-400 text-[11px]">{item.symbol}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">{item.exchange}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Popular chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-400 font-medium">Suggestions PEA :</span>
                  {POPULAR_FRENCH_ASSETS.slice(0, 4).map(p => (
                    <button
                      key={p.symbol}
                      type="button"
                      onClick={() => handleSelectAsset(p)}
                      className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-indigo-100 text-slate-700 dark:text-slate-300 hover:text-indigo-700 font-medium transition"
                    >
                      {p.symbol}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Position Form */}
            <form onSubmit={handleSavePosition} className="space-y-4 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Symbole boursier (Ticker) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formSymbol}
                    onChange={e => setFormSymbol(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-mono font-bold dark:text-white"
                    placeholder="Ex: CW8.PA"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Type d'actif
                  </label>
                  <select
                    value={formAssetType}
                    onChange={e => setFormAssetType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold dark:text-white"
                  >
                    <option value="etf">ETF (Fonds indiciel)</option>
                    <option value="stock">Action d'entreprise</option>
                    <option value="crypto">Cryptomonnaie</option>
                    <option value="bond">Obligation</option>
                    <option value="other">Autre</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Nom complet du titre *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold dark:text-white"
                  placeholder="Ex: Amundi MSCI World Swap UCITS ETF"
                />
              </div>

              {/* Account Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Compte de détention (PEA / CTO) *
                </label>
                {investmentAccounts.length > 0 ? (
                  <select
                    required
                    value={formAccountId}
                    onChange={e => setFormAccountId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                  >
                    {investmentAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.subType?.toUpperCase() || acc.type.toUpperCase()})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex justify-between items-center">
                    <span>Aucun compte d'investissement configuré.</span>
                    <button
                      type="button"
                      onClick={() => setShowAddAccountModal(true)}
                      className="font-bold underline"
                    >
                      + Créer un PEA / CTO
                    </button>
                  </div>
                )}
              </div>

              {/* Numbers: Shares, BuyPrice, CurrentPrice */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Nombre de parts *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.0001"
                    required
                    value={formShares}
                    onChange={e => setFormShares(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold dark:text-white"
                    placeholder="Ex: 10 ou 15.5"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    PRU d'achat ({formCurrency}) *
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    required
                    value={formBuyPrice}
                    onChange={e => setFormBuyPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold dark:text-white"
                    placeholder="Prix moyen d'achat"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Cours actuel ({formCurrency})
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={formCurrentPrice}
                    onChange={e => setFormCurrentPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400"
                    placeholder="Cours temps réel"
                  />
                </div>
              </div>

              {/* Real-time Calculation Summary inside modal */}
              {parseFloat(formShares) > 0 && parseFloat(formBuyPrice) > 0 && (
                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                  <div className="flex justify-between text-slate-500">
                    <span>Montant total investi :</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {(parseFloat(formShares) * parseFloat(formBuyPrice)).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {formCurrency}
                    </span>
                  </div>
                  {parseFloat(formCurrentPrice) > 0 && (
                    <div className="flex justify-between text-slate-500">
                      <span>Valeur actuelle :</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {(parseFloat(formShares) * parseFloat(formCurrentPrice)).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {formCurrency}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Note / Objectif (optionnel)
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold dark:text-white"
                  placeholder="Ex: DCA mensuel, horizon 10 ans..."
                />
              </div>

              <div className="flex justify-end space-x-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPositionModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition"
                >
                  {editingPosition ? 'Enregistrer les modifications' : 'Ajouter au portefeuille'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / CONFIGURE INVESTMENT ACCOUNT (PEA / CTO) */}
      {showAddAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-xl">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Nouveau compte d'investissement
                  </h3>
                  <p className="text-xs text-slate-500">PEA, CTO ou Compte Crypto</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddAccountModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Type d'enveloppe fiscale *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAccSubType('pea');
                      setAccName('PEA BoursoBank');
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs font-bold transition ${
                      accSubType === 'pea'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>PEA</div>
                    <div className="text-[10px] font-normal text-slate-500 mt-0.5">Plafond 150k€</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAccSubType('cto');
                      setAccName('CTO Trade Republic');
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs font-bold transition ${
                      accSubType === 'cto'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>CTO</div>
                    <div className="text-[10px] font-normal text-slate-500 mt-0.5">Sans plafond</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAccSubType('crypto');
                      setAccName('Portefeuille Crypto');
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs font-bold transition ${
                      accSubType === 'crypto'
                        ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>Crypto</div>
                    <div className="text-[10px] font-normal text-slate-500 mt-0.5">Ledger / Exchange</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Nom du compte *
                </label>
                <input
                  type="text"
                  required
                  value={accName}
                  onChange={e => setAccName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold dark:text-white"
                  placeholder="Ex: PEA BoursoBank, Fortuneo..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Établissement / Courtier
                </label>
                <input
                  type="text"
                  value={accBankName}
                  onChange={e => setAccBankName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold dark:text-white"
                  placeholder="Ex: BoursoBank, Trade Republic, Bourse Direct..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Solde espèces (€)
                  </label>
                  <input
                    type="number"
                    step="10"
                    min="0"
                    value={accCashBalance}
                    onChange={e => setAccCashBalance(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold dark:text-white"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Versements cumulés (€)
                  </label>
                  <input
                    type="number"
                    step="100"
                    min="0"
                    value={accTotalDeposits}
                    onChange={e => setAccTotalDeposits(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold dark:text-white"
                    placeholder="Total versé"
                  />
                </div>
              </div>

              {accSubType === 'pea' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Date d'ouverture du PEA (pour les 5 ans)
                  </label>
                  <input
                    type="date"
                    value={accOpeningDate}
                    onChange={e => setAccOpeningDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold dark:text-white"
                  />
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition"
                >
                  Créer le compte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
