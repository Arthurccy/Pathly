import React, { useState } from 'react';
import { Download, FileText, Calendar, Settings, Check } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { useBudget } from '../contexts/BudgetContext';
import { ExportOptions } from '../types';

const ExportManager: React.FC = () => {
  const { exportData } = useBudget();
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  
  const [options, setOptions] = useState<ExportOptions>({
    format: 'csv',
    dateRange: {
      start: startOfYear(new Date()),
      end: endOfYear(new Date()),
    },
    includeCategories: true,
    includeAccounts: true,
    includeGoals: true,
    includeDebts: true,
    includeRecurring: true,
  });

  const handleExport = async () => {
    setIsExporting(true);
    setExportComplete(false);
    
    try {
      const data = await exportData(options);
      
      // Create and download file
      const blob = new Blob([data], { 
        type: options.format === 'csv' ? 'text/csv' : 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `budget-export-${format(new Date(), 'yyyy-MM-dd')}.${options.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setExportComplete(true);
      setTimeout(() => setExportComplete(false), 3000);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Erreur lors de l\'export. Veuillez réessayer.');
    } finally {
      setIsExporting(false);
    }
  };

  const setDateRange = (range: 'month' | 'year' | 'all') => {
    const now = new Date();
    switch (range) {
      case 'month':
        setOptions({
          ...options,
          dateRange: {
            start: startOfMonth(now),
            end: endOfMonth(now),
          },
        });
        break;
      case 'year':
        setOptions({
          ...options,
          dateRange: {
            start: startOfYear(now),
            end: endOfYear(now),
          },
        });
        break;
      case 'all':
        setOptions({
          ...options,
          dateRange: {
            start: new Date(2020, 0, 1),
            end: new Date(2030, 11, 31),
          },
        });
        break;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
          <Download className="h-6 w-6 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Export & Sauvegarde
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export Options */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Options d'export
          </h3>
          
          <div className="space-y-6">
            {/* Format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Format de fichier
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'csv', label: 'CSV', desc: 'Excel compatible' },
                  { value: 'json', label: 'JSON', desc: 'Données complètes' },
                  { value: 'pdf', label: 'PDF', desc: 'Rapport lisible' },
                ].map(format => (
                  <button
                    key={format.value}
                    onClick={() => setOptions({ ...options, format: format.value as any })}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${
                      options.format === format.value
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <div className="font-medium">{format.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {format.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Période
              </label>
              <div className="grid grid-cols-3 gap-3 mb-3">
                {[
                  { value: 'month', label: 'Ce mois' },
                  { value: 'year', label: 'Cette année' },
                  { value: 'all', label: 'Tout' },
                ].map(range => (
                  <button
                    key={range.value}
                    onClick={() => setDateRange(range.value as any)}
                    className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    {range.label}
                  </button>
                ))}
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Date de début
                  </label>
                  <input
                    type="date"
                    value={options.dateRange.start.toISOString().split('T')[0]}
                    onChange={(e) => setOptions({
                      ...options,
                      dateRange: {
                        ...options.dateRange,
                        start: new Date(e.target.value),
                      },
                    })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Date de fin
                  </label>
                  <input
                    type="date"
                    value={options.dateRange.end.toISOString().split('T')[0]}
                    onChange={(e) => setOptions({
                      ...options,
                      dateRange: {
                        ...options.dateRange,
                        end: new Date(e.target.value),
                      },
                    })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Data to Include */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Données à inclure
              </label>
              <div className="space-y-2">
                {[
                  { key: 'includeCategories', label: 'Catégories' },
                  { key: 'includeAccounts', label: 'Comptes bancaires' },
                  { key: 'includeGoals', label: 'Objectifs d\'épargne' },
                  { key: 'includeDebts', label: 'Dettes et crédits' },
                  { key: 'includeRecurring', label: 'Transactions récurrentes' },
                ].map(item => (
                  <label key={item.key} className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options[item.key as keyof ExportOptions] as boolean}
                      onChange={(e) => setOptions({
                        ...options,
                        [item.key]: e.target.checked,
                      })}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Export Preview & Actions */}
        <div className="space-y-6">
          {/* Preview */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Aperçu de l'export
            </h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Format:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {options.format.toUpperCase()}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Période:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {format(options.dateRange.start, 'dd/MM/yyyy')} - {format(options.dateRange.end, 'dd/MM/yyyy')}
                </span>
              </div>
              
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <p className="text-gray-500 dark:text-gray-400 mb-2">Données incluses:</p>
                <div className="space-y-1">
                  {Object.entries(options).map(([key, value]) => {
                    if (key.startsWith('include') && value) {
                      const labels = {
                        includeCategories: 'Catégories',
                        includeAccounts: 'Comptes bancaires',
                        includeGoals: 'Objectifs d\'épargne',
                        includeDebts: 'Dettes et crédits',
                        includeRecurring: 'Transactions récurrentes',
                      };
                      return (
                        <div key={key} className="flex items-center space-x-2">
                          <Check className="h-3 w-3 text-green-500" />
                          <span className="text-gray-700 dark:text-gray-300">
                            {labels[key as keyof typeof labels]}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Export Button */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className={`w-full flex items-center justify-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all ${
                exportComplete
                  ? 'bg-green-600 text-white'
                  : isExporting
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {exportComplete ? (
                <>
                  <Check className="h-5 w-5" />
                  <span>Export terminé !</span>
                </>
              ) : isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Export en cours...</span>
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" />
                  <span>Télécharger l'export</span>
                </>
              )}
            </button>
            
            {exportComplete && (
              <p className="text-center text-sm text-green-600 dark:text-green-400 mt-2">
                Le fichier a été téléchargé avec succès
              </p>
            )}
          </div>

          {/* Backup Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              💾 Sauvegarde automatique
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Vos données sont automatiquement sauvegardées dans votre navigateur. 
              Exportez régulièrement vos données pour créer des sauvegardes externes.
            </p>
          </div>
        </div>
      </div>

      {/* Export History */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Formats d'export disponibles
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">CSV</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Format tableur compatible Excel. Idéal pour analyser vos transactions 
              dans un logiciel de votre choix.
            </p>
          </div>
          
          <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">JSON</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Format de données complet incluant tous les paramètres et métadonnées. 
              Parfait pour une sauvegarde complète.
            </p>
          </div>
          
          <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">PDF</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Rapport formaté et lisible. Idéal pour partager ou archiver 
              un résumé de votre situation financière.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportManager;