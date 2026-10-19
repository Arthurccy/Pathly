import React, { useState, useRef, useMemo } from 'react';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Download, 
  Settings, 
  Eye, 
  EyeOff, 
  Brain,
  Scale,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Info,
  Check,
  RefreshCw,
  HelpCircle,
  Sparkles,
  Search,
  Filter
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { format, differenceInCalendarDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useBudget } from '../contexts/BudgetContext';
import { useAuth } from '../contexts/AuthContext';
import { importService } from '../services/importService';
import { 
  CSVRow, 
  ColumnMapping, 
  ImportSettings, 
  ParsedTransaction, 
  ImportRule,
  ImportResult
} from '../types/import';

const ImportCSV: React.FC = () => {
  const { user } = useAuth();
  const { categories, accounts, transactions: existingTransactions, updateAccount, reloadAll } = useBudget();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'complete'>('upload');
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());
  const [rules, setRules] = useState<ImportRule[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  
  const [settings, setSettings] = useState<ImportSettings>({
    hasHeader: true,
    separator: '',
    encoding: 'auto',
    skipDuplicates: true,
    autoApplyRules: true,
    confidenceThreshold: 0.8
  });

  const [mapping, setMapping] = useState<ColumnMapping>({
    date: '',
    description: '',
    amount: '',
    account: '',
    category: '',
    balance: ''
  });

  const [fileName, setFileName] = useState<string>('');
  const [rawText, setRawText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState('Traitement en cours…');
  const [processedCount, setProcessedCount] = useState(0);
  const [importTotal, setImportTotal] = useState(0);

  // Reconciliation & Account state
  const [targetAccountId, setTargetAccountId] = useState<string>('');
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>('');
  const [statementFinalBalance, setStatementFinalBalance] = useState<string>('');
  const [syncAccountBalance, setSyncAccountBalance] = useState<boolean>(false);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'new' | 'matched' | 'duplicates'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Load user rules on mount
  React.useEffect(() => {
    if (user) {
      loadUserRules();
    }
  }, [user]);

  // Default to first account if user has accounts
  React.useEffect(() => {
    if (accounts.length > 0 && !targetAccountId) {
      setTargetAccountId(accounts[0].id);
    }
  }, [accounts, targetAccountId]);

  const loadUserRules = async () => {
    if (!user) return;
    try {
      const userRules = await importService.getUserRules(user.id);
      setRules(userRules);
    } catch (error) {
      console.error('Failed to load rules:', error);
    }
  };

  const strip = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const autoMapColumns = (data: CSVRow[]): ColumnMapping => {
    const headers = Object.keys(data[0] || {});
    const find = (re: RegExp) => headers.find(h => re.test(strip(h))) || '';
    return {
      date: find(/date|datum/i) || headers[0] || '',
      description: find(/desc|libelle|label|motif|intitule|operation/i) || headers[1] || '',
      amount: find(/^montant|amount/i) || find(/montant|amount|debit|credit/i) || headers[2] || '',
      account: find(/compte|account/i),
      category: find(/categorie|category/i),
      balance: find(/solde|balance/i)
    };
  };

  // Rows left without a category go to the built-in "Autres dépenses" / "Autres revenus"
  const fallbackCategoryFor = (type?: string) => {
    const wantedName = type === 'income' ? 'autres revenus' : 'autres depenses';
    const wantedType = type === 'income' ? 'income' : 'expense';
    return (
      categories.find(c => c.type === wantedType && strip(c.name).toLowerCase().trim() === wantedName) ||
      categories.find(c => c.type === wantedType && strip(c.name).toLowerCase().startsWith('autre'))
    );
  };

  const isSelectable = (t: ParsedTransaction) =>
    t.errors.length === 0 && (!settings.skipDuplicates || !t.isDuplicate);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Le fichier est trop volumineux (max 2 Mo)');
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Veuillez sélectionner un fichier CSV');
      return;
    }

    setFileName(file.name);
    setProcessingLabel('Lecture du fichier…');
    setIsProcessing(true);

    try {
      const data = await importService.parseCSV(file, settings);
      setCsvData(data);
      
      if (data.length > 0) {
        setMapping(autoMapColumns(data));
      }

      setStep('mapping');
    } catch (error: any) {
      alert(`Erreur lors de la lecture du fichier: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRawTextImport = async () => {
    setProcessingLabel('Analyse du texte collé…');
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 400));

    let data: CSVRow[];
    try {
      data = importService.parseRawText(rawText);
    } catch (error: any) {
      setIsProcessing(false);
      alert(`Erreur lors de la lecture du texte: ${error.message}`);
      return;
    }
    if (data.length === 0) {
      setIsProcessing(false);
      alert('Collez au moins une ligne de relevé bancaire');
      return;
    }

    setCsvData(data);
    setFileName('Copier-coller');
    setMapping(autoMapColumns(data));
    setStep('mapping');
    setIsProcessing(false);
  };

  /**
   * Reconciliation matcher: Compares each parsed statement line against existing transactions
   * in Pathly for the selected target account (or all accounts).
   */
  const reconcileTransactions = (
    transactions: ParsedTransaction[],
    targetAccId: string
  ): ParsedTransaction[] => {
    const candidateExisting = existingTransactions.filter(t => 
      !targetAccId || t.accountId === targetAccId
    );

    const usedExistingIds = new Set<string>();

    return transactions.map(t => {
      if (!t.date || t.amount === undefined) return t;

      // 1. Check exact match: same date (within 2 days), exact amount (diff < 0.02)
      const exactMatch = candidateExisting.find(ex => {
        if (usedExistingIds.has(ex.id)) return false;
        const amountMatch = Math.abs(ex.amount - t.amount!) < 0.02;
        if (!amountMatch) return false;

        const dayDiff = Math.abs(differenceInCalendarDays(new Date(ex.date), t.date!));
        if (dayDiff > 2) return false;

        // Also check type matches
        if (t.type && ex.type) {
          const isTIncome = t.type === 'income';
          const isExIncome = ex.type === 'income' || ex.type === 'refund' || ex.type === 'savings_withdrawal';
          if (isTIncome !== isExIncome) return false;
        }

        return true;
      });

      if (exactMatch) {
        usedExistingIds.add(exactMatch.id);
        return {
          ...t,
          reconciliationStatus: 'matched',
          matchedTransactionId: exactMatch.id,
          matchedTransactionDesc: exactMatch.description,
          isDuplicate: true,
          // Inherit category if existing already has one
          categoryId: t.categoryId || exactMatch.categoryId || t.categoryId
        };
      }

      // If already marked as duplicate by hash
      if (t.isDuplicate) {
        return {
          ...t,
          reconciliationStatus: 'duplicate'
        };
      }

      return {
        ...t,
        reconciliationStatus: 'new'
      };
    });
  };

  const handleMappingComplete = async () => {
    if (!mapping.date || !mapping.description || !mapping.amount) {
      alert('Veuillez mapper au minimum les colonnes Date, Description et Montant');
      return;
    }

    setProcessingLabel('Lecture des transactions…');
    setIsProcessing(true);

    try {
      const transactions: ParsedTransaction[] = [];
      const fallbackAccountId = targetAccountId || (accounts.length === 1 ? accounts[0].id : '');
      if (fallbackAccountId && !targetAccountId) setTargetAccountId(fallbackAccountId);

      for (const row of csvData) {
        const { transaction } = importService.parseTransaction(row, mapping, accounts);
        if (!transaction.accountId && fallbackAccountId) transaction.accountId = fallbackAccountId;
        transactions.push(transaction);
      }

      // Apply categorization rules
      let processedTransactions = transactions;
      if (settings.autoApplyRules && user) {
        setProcessingLabel('Application des règles et suggestions de catégories…');
        try {
          const applyPromise = importService.applyCategorization(
            transactions,
            rules,
            categories,
            user.id
          );
          processedTransactions = await Promise.race([
            applyPromise,
            new Promise<ParsedTransaction[]>(resolve => setTimeout(() => resolve(transactions), 8000))
          ]);
        } catch (e) {
          console.warn('[ImportCSV] applyCategorization failed, continuing without rules', e);
          processedTransactions = transactions;
        }

        try {
          processedTransactions = await Promise.race([
            importService.applyCommunitySuggestions(processedTransactions, categories),
            new Promise<ParsedTransaction[]>(resolve => setTimeout(() => resolve(processedTransactions), 6000))
          ]);
        } catch (e) {
          console.warn('[ImportCSV] applyCommunitySuggestions failed', e);
        }
      }

      // Check for duplicate hashes in DB
      if (user) {
        setProcessingLabel('Recherche des doublons…');
        try {
          const dupPromise = importService.checkDuplicates(processedTransactions, user.id);
          processedTransactions = await Promise.race([
            dupPromise,
            new Promise<ParsedTransaction[]>(resolve => setTimeout(() => resolve(processedTransactions), 8000))
          ]);
        } catch (e) {
          console.warn('[ImportCSV] checkDuplicates failed', e);
        }
      }

      // Reconcile with existing Pathly transactions in local state
      setProcessingLabel('Rapprochement avec vos comptes Pathly…');
      processedTransactions = reconcileTransactions(processedTransactions, fallbackAccountId);

      // Auto-extract statement final balance if mapped and present on rows
      if (mapping.balance) {
        const rowsWithBalance = processedTransactions.filter(t => t.rowBalance !== undefined);
        if (rowsWithBalance.length > 0) {
          // Take the latest row balance
          const latest = rowsWithBalance[0].rowBalance;
          if (latest !== undefined && !statementFinalBalance) {
            setStatementFinalBalance(latest.toFixed(2));
          }
        }
      }

      setParsedTransactions(processedTransactions);
      
      // Auto-select only new valid transactions (deselect already matched/duplicates)
      const validIndices = new Set(
        processedTransactions
          .map((t, index) => ({ t, index }))
          .filter(({ t }) => t.errors.length === 0 && !t.isDuplicate && t.reconciliationStatus === 'new')
          .map(({ index }) => index)
      );
      setSelectedTransactions(validIndices);
      setStep('preview');
    } catch (error: any) {
      alert(`Erreur lors du traitement: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const applyToSelected = () => {
    if (!targetAccountId && !defaultCategoryId) return;
    setParsedTransactions(prev =>
      prev.map((t, index) =>
        selectedTransactions.has(index)
          ? {
              ...t,
              accountId: targetAccountId || t.accountId,
              categoryId: defaultCategoryId || t.categoryId,
            }
          : t
      )
    );
  };

  const handleImport = async () => {
    if (!user) return;

    setIsProcessing(true);
    setStep('importing');
    setProcessedCount(0);

    try {
      let jobId: string | undefined = undefined;
      try {
        const createPromise = importService.createImportJob(
          user.id,
          fileName,
          parsedTransactions.length
        );
        jobId = await Promise.race([
          createPromise,
          new Promise<string | undefined>((resolve) => setTimeout(() => resolve(undefined), 8000))
        ]);
      } catch (e) {
        console.warn('[ImportCSV] createImportJob failed', e);
      }

      // Apply defaults on-the-fly if provided
      const prepared = parsedTransactions.map(t => ({
        ...t,
        accountId: t.accountId || targetAccountId || t.accountId,
        categoryId: t.categoryId || defaultCategoryId || fallbackCategoryFor(t.type)?.id || t.categoryId,
      }));

      const transactionsToImport = prepared.map((t, index) => ({
        ...t,
        isSelected: selectedTransactions.has(index)
      }));

      const totalValid = transactionsToImport.filter(t =>
        t.errors.length === 0 && t.categoryId && t.accountId && (!settings.skipDuplicates || !t.isDuplicate) && t.isSelected !== false
      ).length;
      setImportTotal(totalValid);

      const incomplete = transactionsToImport.filter(t => t.isSelected && t.errors.length === 0 && (!t.categoryId || !t.accountId)).length;
      if (incomplete > 0 && !window.confirm(`${incomplete} ligne(s) cochée(s) n'ont pas de compte ou de catégorie et ne seront pas importées. Continuer ?`)) {
        setStep('preview');
        setIsProcessing(false);
        return;
      }

      // Import transactions into DB
      const result = await importService.importTransactions(
        transactionsToImport,
        user.id,
        settings.skipDuplicates,
        (done, total) => setProcessedCount(done)
      );

      // Optional: adjust bank account balance to exact statement balance if user checked the box
      let balanceAdjusted = false;
      let finalNewBalance: number | undefined = undefined;
      const targetAcc = accounts.find(a => a.id === targetAccountId);

      if (syncAccountBalance && targetAcc && statementFinalBalance) {
        const parsedBal = parseFloat(statementFinalBalance.replace(',', '.'));
        if (!isNaN(parsedBal)) {
          try {
            await updateAccount(targetAcc.id, { balance: parsedBal });
            balanceAdjusted = true;
            finalNewBalance = parsedBal;
          } catch (err) {
            console.error('Failed to sync account balance:', err);
          }
        }
      }

      try {
        await importService.submitCommunityLearning(
          transactionsToImport.filter((_, i) => parsedTransactions[i].categoryId || defaultCategoryId),
          user.id,
          categories
        );
      } catch (e) {
        console.warn('[ImportCSV] submitCommunityLearning failed (ignored)', e);
      }

      if (jobId) {
        try {
          const updatePromise = importService.updateImportJob(jobId, {
            rowsImported: result.imported,
            rowsSkipped: result.skipped,
            rowsDuplicates: result.duplicates,
            errorsJson: result.errors.length > 0 ? { errors: result.errors } : null,
            status: result.errors.length > 0 ? 'failed' : 'completed'
          });
          await Promise.race([
            updatePromise,
            new Promise<void>((resolve) => setTimeout(() => resolve(), 6000))
          ]);
        } catch (e) {
          console.warn('[ImportCSV] updateImportJob failed', e);
        }
      }

      // Reload fresh budget & account data
      try {
        await reloadAll?.();
      } catch {}

      setImportResult({ ...result, jobId, balanceAdjusted, newBalance: finalNewBalance });
      setStep('complete');
    } catch (error: any) {
      alert(`Erreur lors de l'import: ${error.message}`);
      setStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleTransactionSelection = (index: number) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedTransactions(newSelected);
  };

  const toggleAllVisible = () => {
    const selectableVisible = filteredTransactions
      .map(({ index, t }) => ({ index, t }))
      .filter(({ t }) => t.errors.length === 0);

    const allVisibleSelected = selectableVisible.every(({ index }) => selectedTransactions.has(index));
    const newSet = new Set(selectedTransactions);

    if (allVisibleSelected) {
      selectableVisible.forEach(({ index }) => newSet.delete(index));
    } else {
      selectableVisible.forEach(({ index }) => newSet.add(index));
    }
    setSelectedTransactions(newSet);
  };

  const applySuggestion = (transactionIndex: number, categoryId: string) => {
    setParsedTransactions(prev => prev.map((t, index) => 
      index === transactionIndex ? { ...t, categoryId } : t
    ));
  };

  const resetImport = () => {
    setStep('upload');
    setCsvData([]);
    setParsedTransactions([]);
    setSelectedTransactions(new Set());
    setImportResult(null);
    setFileName('');
    setStatementFinalBalance('');
    setSyncAccountBalance(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Target account info
  const selectedAccount = useMemo(() => {
    return accounts.find(a => a.id === targetAccountId) || accounts[0];
  }, [accounts, targetAccountId]);

  // Reconciliation summary computations
  const reconciliationSummary = useMemo(() => {
    const total = parsedTransactions.length;
    const newCount = parsedTransactions.filter(t => t.reconciliationStatus === 'new' && t.errors.length === 0).length;
    const matchedCount = parsedTransactions.filter(t => t.reconciliationStatus === 'matched').length;
    const dupCount = parsedTransactions.filter(t => t.reconciliationStatus === 'duplicate' || t.isDuplicate).length;

    // Sum of newly selected transactions
    let netImpactOfSelected = 0;
    parsedTransactions.forEach((t, i) => {
      if (selectedTransactions.has(i) && t.amount !== undefined) {
        if (t.type === 'income') netImpactOfSelected += t.amount;
        else netImpactOfSelected -= t.amount;
      }
    });

    const currentBalance = selectedAccount?.balance || 0;
    const projectedBalance = currentBalance + netImpactOfSelected;
    const targetRealBalance = statementFinalBalance ? parseFloat(statementFinalBalance.replace(',', '.')) : null;
    const balanceGap = targetRealBalance !== null && !isNaN(targetRealBalance) ? (targetRealBalance - projectedBalance) : null;

    return {
      total,
      newCount,
      matchedCount,
      dupCount,
      netImpactOfSelected,
      currentBalance,
      projectedBalance,
      targetRealBalance,
      balanceGap
    };
  }, [parsedTransactions, selectedTransactions, selectedAccount, statementFinalBalance]);

  // Filtered transactions for the preview table
  const filteredTransactions = useMemo(() => {
    return parsedTransactions
      .map((t, index) => ({ t, index }))
      .filter(({ t }) => {
        if (previewFilter === 'new') return t.reconciliationStatus === 'new';
        if (previewFilter === 'matched') return t.reconciliationStatus === 'matched';
        if (previewFilter === 'duplicates') return t.isDuplicate;
        return true;
      })
      .filter(({ t }) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          t.description.toLowerCase().includes(q) ||
          t.amount?.toString().includes(q)
        );
      });
  }, [parsedTransactions, previewFilter, searchQuery]);

  const getStepIcon = (stepName: string) => {
    const currentStepIndex = ['upload', 'mapping', 'preview', 'importing', 'complete'].indexOf(step);
    const stepIndex = ['upload', 'mapping', 'preview', 'importing', 'complete'].indexOf(stepName);
    
    if (stepIndex < currentStepIndex) return CheckCircle;
    if (stepIndex === currentStepIndex) return FileText;
    return FileText;
  };

  const getStepColor = (stepName: string) => {
    const currentStepIndex = ['upload', 'mapping', 'preview', 'importing', 'complete'].indexOf(step);
    const stepIndex = ['upload', 'mapping', 'preview', 'importing', 'complete'].indexOf(stepName);
    
    if (stepIndex < currentStepIndex) return 'text-emerald-600 dark:text-emerald-400';
    if (stepIndex === currentStepIndex) return 'text-blue-600 dark:text-blue-400 font-semibold';
    return 'text-slate-400 dark:text-slate-500';
  };

  return (
    <div className="space-y-6">
      {isProcessing && step !== 'importing' && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{processingLabel}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Comparaison et détection des opérations en cours…</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl text-white shadow-sm">
            <Scale className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Import & Rapprochement Bancaire
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Comparez votre relevé bancaire avec Pathly, repérez ce qui manque et ajustez votre solde
            </p>
          </div>
        </div>

        {accounts.length > 0 && step !== 'complete' && (
          <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-3 py-1.5 rounded-xl shadow-card text-xs">
            <span className="text-slate-500 dark:text-slate-400">Compte cible :</span>
            <select
              value={targetAccountId}
              onChange={(e) => setTargetAccountId(e.target.value)}
              className="font-medium text-slate-900 dark:text-white bg-transparent border-none focus:ring-0 cursor-pointer"
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id} className="dark:bg-slate-900">
                  {acc.name} ({acc.balance.toFixed(2)} €)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Progress Steps */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-card border border-slate-200/80 dark:border-slate-800/80 p-4 sm:p-5">
        <div className="flex items-center justify-between overflow-x-auto">
          {[
            { key: 'upload', label: '1. Relevé' },
            { key: 'mapping', label: '2. Colonnes' },
            { key: 'preview', label: '3. Rapprochement' },
            { key: 'importing', label: '4. Traitement' },
            { key: 'complete', label: '5. Bilan' }
          ].map((stepItem, index) => {
            const Icon = getStepIcon(stepItem.key);
            const color = getStepColor(stepItem.key);
            
            return (
              <div key={stepItem.key} className="flex items-center shrink-0">
                <div className={`flex items-center space-x-2 ${color}`}>
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-xs sm:text-sm">{stepItem.label}</span>
                </div>
                {index < 4 && (
                  <div className="w-4 sm:w-8 h-px bg-slate-200 dark:bg-slate-700 mx-2 sm:mx-4" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-card border border-slate-200/80 dark:border-slate-800/80 p-6">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center space-x-2">
              <Upload className="h-4 w-4 text-blue-600" />
              <span>Charger votre relevé bancaire</span>
            </h3>
            
            <div className="space-y-6">
              {/* File Upload Box */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer bg-slate-50/50 dark:bg-slate-950/40"
              >
                <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="text-base font-medium text-slate-900 dark:text-white mb-1">
                  Glissez ou cliquez pour importer votre fichier CSV
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Exporté depuis votre banque en ligne (BoursoBank, BNP, Crédit Agricole, Revolut, etc.)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {/* Paste Raw Text */}
              <div className="rounded-xl border border-slate-200/80 p-5 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                  Ou copier-coller les lignes de votre relevé
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Copiez le tableau directement depuis le site de votre banque et collez-le ci-dessous :
                </p>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  placeholder={'Exemple :\n12/10/2026  CARREFOUR EXPRESS  -34,20\n14/10/2026  SALAIRE VIREMENT   +2173,00\n15/10/2026  PRLV EDF            -78,50'}
                />
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleRawTextImport}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 shadow-sm"
                  >
                    Analyser le relevé copié
                  </button>
                </div>
              </div>

              {/* Target Account and Solde Config */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Compte bancaire à rapprocher
                  </label>
                  <select
                    value={targetAccountId}
                    onChange={(e) => setTargetAccountId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:bg-slate-800 dark:text-white"
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} — Solde actuel : {acc.balance.toFixed(2)} €
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Solde réel affiché sur votre relevé (optionnel)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Ex: 1450.20"
                      value={statementFinalBalance}
                      onChange={(e) => setStatementFinalBalance(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:bg-slate-800 dark:text-white pr-8"
                    />
                    <span className="absolute right-3 top-2 text-sm text-slate-400">€</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Permet à Pathly de comparer votre solde réel avec votre solde théorique.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Mapping */}
      {step === 'mapping' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-card border border-slate-200/80 dark:border-slate-800/80 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                2. Vérifier les colonnes détectées
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Fichier : <strong>{fileName}</strong> • {csvData.length} ligne(s) détectée(s)
              </p>
            </div>
          </div>
          
          <div className="space-y-5">
            {/* Preview of first rows */}
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr>
                    {Object.keys(csvData[0] || {}).map(header => (
                      <th key={header} className="px-3 py-2 text-left font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                  {csvData.slice(0, 3).map((row, index) => (
                    <tr key={index}>
                      {Object.values(row).map((value, cellIndex) => (
                        <td key={cellIndex} className="px-3 py-1.5 text-slate-700 dark:text-slate-300">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Column Mapping Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { key: 'date', label: 'Date *', required: true },
                { key: 'description', label: 'Description *', required: true },
                { key: 'amount', label: 'Montant *', required: true },
                { key: 'balance', label: 'Solde du compte (optionnel)', required: false }
              ].map(field => (
                <div key={field.key} className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    {field.label}
                  </label>
                  <select
                    value={mapping[field.key as keyof ColumnMapping] || ''}
                    onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">-- Ignorer --</option>
                    {Object.keys(csvData[0] || {}).map(header => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Retour
              </button>
              <button
                onClick={handleMappingComplete}
                disabled={isProcessing}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
              >
                {isProcessing ? 'Analyse en cours…' : 'Lancer le rapprochement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Reconciliation & Preview */}
      {step === 'preview' && (
        <div className="space-y-6">
          
          {/* Reconciliation Dashboard Summary Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Stat 1: Manquantes (New to import) */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-blue-200/80 dark:border-blue-900/40 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">À importer (manquantes)</span>
                <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600">
                  <Sparkles className="h-4 w-4" />
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {reconciliationSummary.newCount}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Sur le compte mais absentes de Pathly
              </p>
            </div>

            {/* Stat 2: Déjà enregistrées (Matched) */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-emerald-200/80 dark:border-emerald-900/40 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Déjà en règle (rapprochées)</span>
                <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
                  <Check className="h-4 w-4" />
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {reconciliationSummary.matchedCount}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Détectées à l'identique dans Pathly
              </p>
            </div>

            {/* Stat 3: Doublons évités */}
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Doublons écartés</span>
                <span className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600">
                  <AlertCircle className="h-4 w-4" />
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {reconciliationSummary.dupCount}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Non cochées pour préserver l'historique
              </p>
            </div>

            {/* Stat 4: Sélection active */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-xl p-4 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-blue-100">Prêtes à être ajoutées</span>
                <CheckCircle className="h-4 w-4 text-blue-200" />
              </div>
              <p className="text-2xl font-bold mt-1">
                {selectedTransactions.size}
              </p>
              <p className="text-[11px] text-blue-200 mt-0.5">
                Impact net : {reconciliationSummary.netImpactOfSelected >= 0 ? '+' : ''}{reconciliationSummary.netImpactOfSelected.toFixed(2)} €
              </p>
            </div>
          </div>

          {/* Account Balance Comparison & Real-Time Sync Card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-card border border-slate-200/80 dark:border-slate-800/80 p-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Scale className="h-4 w-4 text-blue-600" />
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Comparaison du Solde — {selectedAccount?.name}
                  </h4>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                  <span>Solde actuel Pathly : <strong className="text-slate-900 dark:text-white">{reconciliationSummary.currentBalance.toFixed(2)} €</strong></span>
                  <span>→</span>
                  <span>Après import sélection : <strong className="text-blue-600 dark:text-blue-400">{reconciliationSummary.projectedBalance.toFixed(2)} €</strong></span>
                  {reconciliationSummary.targetRealBalance !== null && (
                    <>
                      <span>vs</span>
                      <span>Solde réel relevé : <strong className="text-indigo-600 dark:text-indigo-400">{reconciliationSummary.targetRealBalance.toFixed(2)} €</strong></span>
                      {reconciliationSummary.balanceGap !== null && Math.abs(reconciliationSummary.balanceGap) > 0.01 && (
                        <span className="font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded">
                          Écart : {reconciliationSummary.balanceGap >= 0 ? '+' : ''}{reconciliationSummary.balanceGap.toFixed(2)} €
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Solde Sync Toggle */}
              <div className="flex items-center space-x-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <input
                  type="checkbox"
                  id="syncBalance"
                  checked={syncAccountBalance}
                  onChange={(e) => setSyncAccountBalance(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                />
                <label htmlFor="syncBalance" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <span className="font-semibold text-slate-900 dark:text-white block">
                    Ajuster le solde de mon compte sur le solde réel
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Fixe le compte à {statementFinalBalance ? `${parseFloat(statementFinalBalance).toFixed(2)} €` : 'votre solde réel'} après import
                  </span>
                </label>
                {syncAccountBalance && (
                  <div className="w-24">
                    <input
                      type="number"
                      step="0.01"
                      value={statementFinalBalance}
                      onChange={(e) => setStatementFinalBalance(e.target.value)}
                      placeholder="Solde réel"
                      className="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions & Filters */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-card border border-slate-200/80 dark:border-slate-800/80 p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <button
                  onClick={() => setPreviewFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    previewFilter === 'all'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  Toutes ({parsedTransactions.length})
                </button>
                <button
                  onClick={() => setPreviewFilter('new')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    previewFilter === 'new'
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300'
                  }`}
                >
                  À importer ({reconciliationSummary.newCount})
                </button>
                <button
                  onClick={() => setPreviewFilter('matched')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    previewFilter === 'matched'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300'
                  }`}
                >
                  Déjà dans Pathly ({reconciliationSummary.matchedCount})
                </button>
                <button
                  onClick={() => setPreviewFilter('duplicates')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    previewFilter === 'duplicates'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300'
                  }`}
                >
                  Doublons ({reconciliationSummary.dupCount})
                </button>
              </div>

              {/* Search input */}
              <div className="relative w-full md:w-64">
                <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher par libellé ou montant…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            {/* Mass Category Application */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Catégorie pour les lignes cochées
                </label>
                <select
                  value={defaultCategoryId}
                  onChange={(e) => setDefaultCategoryId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs dark:bg-slate-800 dark:text-white"
                >
                  <option value="">-- Choisir une catégorie --</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <button
                  onClick={applyToSelected}
                  disabled={selectedTransactions.size === 0 || !defaultCategoryId}
                  className="w-full px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  Appliquer aux {selectedTransactions.size} cochée(s)
                </button>
              </div>

              <div className="flex items-center justify-end space-x-2">
                <button
                  onClick={toggleAllVisible}
                  className="px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1"
                >
                  <span>Inverser sélection visible</span>
                </button>
                <button
                  onClick={handleImport}
                  disabled={selectedTransactions.size === 0}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                >
                  Valider l'import ({selectedTransactions.size})
                </button>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-card border border-slate-200/80 dark:border-slate-800/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium text-slate-500 uppercase tracking-wider w-10">
                      <input
                        type="checkbox"
                        checked={filteredTransactions.length > 0 && filteredTransactions.every(({ index }) => selectedTransactions.has(index))}
                        onChange={toggleAllVisible}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-slate-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-slate-500 uppercase tracking-wider">
                      Libellé relevé
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-slate-500 uppercase tracking-wider">
                      Montant
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-slate-500 uppercase tracking-wider">
                      Catégorie Pathly
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-slate-500 uppercase tracking-wider">
                      État rapprochement
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredTransactions.map(({ t: transaction, index }) => {
                    const category = categories.find(c => c.id === transaction.categoryId);
                    const IconComponent = category ? (LucideIcons as any)[category.icon] : LucideIcons.DollarSign;
                    const isSelected = selectedTransactions.has(index);

                    return (
                      <tr 
                        key={index} 
                        className={`transition-colors ${
                          transaction.errors.length > 0 ? 'bg-red-50/50 dark:bg-red-950/20' :
                          transaction.reconciliationStatus === 'matched' ? 'bg-emerald-50/30 dark:bg-emerald-950/10' :
                          isSelected ? 'bg-blue-50/30 dark:bg-blue-950/15' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleTransactionSelection(index)}
                            disabled={transaction.errors.length > 0}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-900 dark:text-slate-100 font-mono text-[11px]">
                          {transaction.date ? format(transaction.date, 'dd/MM/yyyy') : 'Date invalide'}
                        </td>
                        <td className="px-3 py-2.5 text-slate-900 dark:text-slate-100">
                          <div className="font-medium text-xs">{transaction.description}</div>
                          {transaction.matchedTransactionDesc && (
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center space-x-1">
                              <Check className="h-3 w-3" />
                              <span>Correspond à : {transaction.matchedTransactionDesc}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap font-medium text-xs">
                          <span className={transaction.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}>
                            {transaction.type === 'income' ? '+' : '-'}{transaction.amount?.toFixed(2) || '0.00'} €
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center space-x-1.5">
                            {category && (
                              <div
                                className="p-1 rounded shrink-0"
                                style={{ backgroundColor: `${category.color}20` }}
                              >
                                <IconComponent 
                                  className="h-3 w-3" 
                                  style={{ color: category.color }}
                                />
                              </div>
                            )}
                            <select
                              value={transaction.categoryId || ''}
                              onChange={(e) => applySuggestion(index, e.target.value)}
                              className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white max-w-[11rem]"
                            >
                              <option value="">{fallbackCategoryFor(transaction.type)?.name || 'À classer'}</option>
                              {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {transaction.errors.length > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
                              Erreur lecture
                            </span>
                          ) : transaction.reconciliationStatus === 'matched' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              Déjà dans Pathly
                            </span>
                          ) : transaction.isDuplicate ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              Doublon détecté
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                              Nouvelle opération
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredTransactions.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-500">
                Aucune transaction ne correspond à ce filtre.
              </div>
            )}
          </div>

          {/* Bottom Actions */}
          <div className="flex justify-between items-center">
            <button
              onClick={() => setStep('mapping')}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Retour au mapping
            </button>
            <button
              onClick={handleImport}
              disabled={selectedTransactions.size === 0}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
            >
              Importer les {selectedTransactions.size} transactions sélectionnées
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Importing */}
      {step === 'importing' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-card border border-slate-200/80 dark:border-slate-800/80 p-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
            Enregistrement et rapprochement en cours…
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {Math.min(processedCount, importTotal)} / {importTotal} opération(s) traitée(s)
          </p>
          <div className="mt-4 w-full max-w-xs mx-auto h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${importTotal > 0 ? Math.floor(100 * Math.min(processedCount, importTotal) / importTotal) : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Step 5: Complete */}
      {step === 'complete' && importResult && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-card border border-slate-200/80 dark:border-slate-800/80 p-6 sm:p-8 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mb-3">
            <CheckCircle className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
            Rapprochement et import réussis !
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
            Votre compte <strong>{selectedAccount?.name}</strong> est maintenant parfaitement synchronisé avec votre relevé bancaire.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto mb-6">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {importResult.imported}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Ajoutées</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <p className="text-xl font-bold text-slate-700 dark:text-slate-300">
                {importResult.skipped}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Ignorées</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {importResult.duplicates}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Doublons filtrés</p>
            </div>
          </div>

          {importResult.balanceAdjusted && importResult.newBalance !== undefined && (
            <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-200 max-w-md mx-auto">
              Le solde du compte a été aligné sur votre solde bancaire réel : <strong>{importResult.newBalance.toFixed(2)} €</strong>.
            </div>
          )}

          <div className="flex justify-center space-x-3">
            <button
              onClick={resetImport}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors"
            >
              Nouveau rapprochement
            </button>
            <button
              onClick={async () => { try { await reloadAll?.(); } catch {} }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
            >
              Actualiser le tableau de bord
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportCSV;
