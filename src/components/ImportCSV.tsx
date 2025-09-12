import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Download, Settings, Eye, EyeOff, Brain } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { format } from 'date-fns';
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
  const { categories, accounts, addTransaction } = useBudget();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'complete'>('upload');
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());
  const [rules, setRules] = useState<ImportRule[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  
  const [settings, setSettings] = useState<ImportSettings>({
    hasHeader: true,
    separator: ',',
    encoding: 'UTF-8',
    skipDuplicates: true,
    autoApplyRules: true,
    confidenceThreshold: 0.8
  });

  const [mapping, setMapping] = useState<ColumnMapping>({
    date: '',
    description: '',
    amount: '',
    account: '',
    category: ''
  });

  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Load user rules on mount
  React.useEffect(() => {
    if (user) {
      loadUserRules();
    }
  }, [user]);

  const loadUserRules = async () => {
    if (!user) return;
    
    try {
      const userRules = await importService.getUserRules(user.id);
      setRules(userRules);
    } catch (error) {
      console.error('Failed to load rules:', error);
    }
  };

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
    setIsProcessing(true);

    try {
      const data = await importService.parseCSV(file, settings);
      setCsvData(data);
      
      // Auto-detect column mapping
      if (data.length > 0) {
        const headers = Object.keys(data[0]);
        const autoMapping: ColumnMapping = {
          date: headers.find(h => /date|datum/i.test(h)) || headers[0] || '',
          description: headers.find(h => /desc|libelle|label|motif/i.test(h)) || headers[1] || '',
          amount: headers.find(h => /montant|amount|debit|credit/i.test(h)) || headers[2] || '',
          account: headers.find(h => /compte|account/i.test(h)) || '',
          category: headers.find(h => /categorie|category/i.test(h)) || ''
        };
        setMapping(autoMapping);
      }
      
      setStep('mapping');
    } catch (error: any) {
      alert(`Erreur lors de la lecture du fichier: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMappingComplete = async () => {
    if (!mapping.date || !mapping.description || !mapping.amount) {
      alert('Veuillez mapper au minimum les colonnes Date, Description et Montant');
      return;
    }

    setIsProcessing(true);

    try {
      // Parse transactions
      const transactions: ParsedTransaction[] = [];
      for (const row of csvData) {
        const { transaction } = importService.parseTransaction(row, mapping, accounts);
        transactions.push(transaction);
      }

      // Apply categorization rules
      let processedTransactions = transactions;
      if (settings.autoApplyRules && user) {
        processedTransactions = await importService.applyCategorization(
          transactions,
          rules,
          categories,
          user.id
        );
      }

      // Check for duplicates
      if (user) {
        processedTransactions = await importService.checkDuplicates(processedTransactions, user.id);
      }

      setParsedTransactions(processedTransactions);
      
      // Select all valid, non-duplicate transactions by default
      const validIndices = new Set(
        processedTransactions
          .map((t, index) => ({ transaction: t, index }))
          .filter(({ transaction }) => 
            transaction.errors.length === 0 && 
            (!settings.skipDuplicates || !transaction.isDuplicate)
          )
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

  const handleImport = async () => {
    if (!user) return;

    setIsProcessing(true);
    setStep('importing');

    try {
      // Create import job
      const jobId = await importService.createImportJob(
        user.id,
        fileName,
        parsedTransactions.length
      );

      // Mark selected transactions
      const transactionsToImport = parsedTransactions.map((t, index) => ({
        ...t,
        isSelected: selectedTransactions.has(index)
      }));

      // Import transactions
      const result = await importService.importTransactions(
        transactionsToImport,
        user.id,
        settings.skipDuplicates
      );

      // Update import job
      await importService.updateImportJob(jobId, {
        rowsImported: result.imported,
        rowsSkipped: result.skipped,
        rowsDuplicates: result.duplicates,
        errorsJson: result.errors.length > 0 ? { errors: result.errors } : null,
        status: result.errors.length > 0 ? 'failed' : 'completed'
      });

      setImportResult({ ...result, jobId });
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

  const toggleAllTransactions = () => {
    const validIndices = parsedTransactions
      .map((t, index) => ({ transaction: t, index }))
      .filter(({ transaction }) => 
        transaction.errors.length === 0 && 
        (!settings.skipDuplicates || !transaction.isDuplicate)
      )
      .map(({ index }) => index);

    if (selectedTransactions.size === validIndices.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(validIndices));
    }
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
    
    if (stepIndex < currentStepIndex) return 'text-green-600 dark:text-green-400';
    if (stepIndex === currentStepIndex) return 'text-blue-600 dark:text-blue-400';
    return 'text-gray-400 dark:text-gray-500';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
          <Upload className="h-6 w-6 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Import CSV
        </h1>
      </div>

      {/* Progress Steps */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          {[
            { key: 'upload', label: 'Upload' },
            { key: 'mapping', label: 'Mapping' },
            { key: 'preview', label: 'Prévisualisation' },
            { key: 'importing', label: 'Import' },
            { key: 'complete', label: 'Terminé' }
          ].map((stepItem, index) => {
            const Icon = getStepIcon(stepItem.key);
            const color = getStepColor(stepItem.key);
            
            return (
              <div key={stepItem.key} className="flex items-center">
                <div className={`flex items-center space-x-2 ${color}`}>
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{stepItem.label}</span>
                </div>
                {index < 4 && (
                  <div className="w-8 h-px bg-gray-300 dark:bg-gray-600 mx-4" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            1. Sélectionner le fichier CSV
          </h3>
          
          <div className="space-y-6">
            {/* File Upload */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-green-400 dark:hover:border-green-500 transition-colors cursor-pointer"
            >
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Cliquez pour sélectionner un fichier CSV
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Taille max: 2 Mo • Formats supportés: .csv
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Séparateur
                </label>
                <select
                  value={settings.separator}
                  onChange={(e) => setSettings({ ...settings, separator: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value=",">Virgule (,)</option>
                  <option value=";">Point-virgule (;)</option>
                  <option value="\t">Tabulation</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Encodage
                </label>
                <select
                  value={settings.encoding}
                  onChange={(e) => setSettings({ ...settings, encoding: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="UTF-8">UTF-8</option>
                  <option value="ISO-8859-1">ISO-8859-1</option>
                </select>
              </div>

              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.hasHeader}
                    onChange={(e) => setSettings({ ...settings, hasHeader: e.target.checked })}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Première ligne = en-têtes
                  </span>
                </label>
              </div>
            </div>

            {isProcessing && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Lecture du fichier...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === 'mapping' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            2. Correspondance des colonnes
          </h3>
          
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Fichier: <strong>{fileName}</strong> • {csvData.length} lignes
            </p>

            {/* Preview of first few rows */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    {Object.keys(csvData[0] || {}).map(header => (
                      <th key={header} className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {csvData.slice(0, 3).map((row, index) => (
                    <tr key={index}>
                      {Object.values(row).map((value, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Column Mapping */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { key: 'date', label: 'Date *', required: true },
                { key: 'description', label: 'Description *', required: true },
                { key: 'amount', label: 'Montant *', required: true },
                { key: 'account', label: 'Compte', required: false },
                { key: 'category', label: 'Catégorie', required: false }
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {field.label}
                  </label>
                  <select
                    value={mapping[field.key as keyof ColumnMapping] || ''}
                    onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    required={field.required}
                  >
                    <option value="">-- Sélectionner --</option>
                    {Object.keys(csvData[0] || {}).map(header => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Retour
              </button>
              <button
                onClick={handleMappingComplete}
                disabled={isProcessing}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
              >
                {isProcessing ? 'Traitement...' : 'Continuer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              3. Prévisualisation et sélection
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {parsedTransactions.length}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {parsedTransactions.filter(t => t.errors.length === 0).length}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Valides</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {parsedTransactions.filter(t => t.isDuplicate).length}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Doublons</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {selectedTransactions.size}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Sélectionnées</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={toggleAllTransactions}
                className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                {selectedTransactions.size === parsedTransactions.filter(t => t.errors.length === 0 && (!settings.skipDuplicates || !t.isDuplicate)).length ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                <span>
                  {selectedTransactions.size === parsedTransactions.filter(t => t.errors.length === 0 && (!settings.skipDuplicates || !t.isDuplicate)).length 
                    ? 'Désélectionner tout' 
                    : 'Sélectionner tout'
                  }
                </span>
              </button>

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('mapping')}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Retour
                </button>
                <button
                  onClick={handleImport}
                  disabled={selectedTransactions.size === 0}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                >
                  Importer {selectedTransactions.size} transactions
                </button>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Sélection
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Montant
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Catégorie
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Statut
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {parsedTransactions.map((transaction, index) => {
                    const category = categories.find(c => c.id === transaction.categoryId);
                    const IconComponent = category ? (LucideIcons as any)[category.icon] : LucideIcons.DollarSign;
                    
                    return (
                      <tr key={index} className={`${
                        transaction.errors.length > 0 ? 'bg-red-50 dark:bg-red-900/10' :
                        transaction.isDuplicate ? 'bg-orange-50 dark:bg-orange-900/10' :
                        'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedTransactions.has(index)}
                            onChange={() => toggleTransactionSelection(index)}
                            disabled={transaction.errors.length > 0 || (settings.skipDuplicates && transaction.isDuplicate)}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {transaction.date ? format(transaction.date, 'dd/MM/yyyy') : 'Invalide'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {transaction.description}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`font-medium ${
                            transaction.type === 'income' 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {transaction.type === 'income' ? '+' : '-'}{transaction.amount?.toFixed(2) || '0.00'} €
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {transaction.categoryId ? (
                            <div className="flex items-center space-x-2">
                              {category && (
                                <div
                                  className="p-1 rounded"
                                  style={{ backgroundColor: `${category.color}20` }}
                                >
                                  <IconComponent 
                                    className="h-3 w-3" 
                                    style={{ color: category.color }}
                                  />
                                </div>
                              )}
                              <span className="text-sm text-gray-900 dark:text-white">
                                {category?.name || 'Catégorie inconnue'}
                              </span>
                              {transaction.suggestions.length > 0 && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400">
                                  <Brain className="h-3 w-3 mr-1" />
                                  {(transaction.suggestions[0].confidence * 100).toFixed(0)}%
                                </span>
                              )}
                            </div>
                          ) : transaction.suggestions.length > 0 ? (
                            <div className="space-y-1">
                              {transaction.suggestions.slice(0, 2).map((suggestion, suggestionIndex) => (
                                <button
                                  key={suggestionIndex}
                                  onClick={() => applySuggestion(index, suggestion.categoryId)}
                                  className="flex items-center space-x-2 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 px-2 py-1 rounded hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors"
                                >
                                  <Brain className="h-3 w-3" />
                                  <span>{suggestion.categoryName}</span>
                                  <span className="text-blue-600 dark:text-blue-400">
                                    ({(suggestion.confidence * 100).toFixed(0)}%)
                                  </span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-400">À classer</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {transaction.errors.length > 0 ? (
                            <div className="flex items-center space-x-1 text-red-600 dark:text-red-400">
                              <AlertCircle className="h-4 w-4" />
                              <span className="text-xs">Erreur</span>
                            </div>
                          ) : transaction.isDuplicate ? (
                            <div className="flex items-center space-x-1 text-orange-600 dark:text-orange-400">
                              <AlertCircle className="h-4 w-4" />
                              <span className="text-xs">Doublon</span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-xs">Prêt</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Importing */}
      {step === 'importing' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Import en cours...
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Traitement de {selectedTransactions.size} transactions
            </p>
          </div>
        </div>
      )}

      {/* Step 5: Complete */}
      {step === 'complete' && importResult && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Import terminé !
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {importResult.imported}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Importées</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {importResult.skipped}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Ignorées</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {importResult.duplicates}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Doublons</p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">Erreurs:</h4>
                <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
                  {importResult.errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-center space-x-3">
              <button
                onClick={resetImport}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Nouvel import
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                Voir les transactions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportCSV;