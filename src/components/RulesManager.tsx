import React, { useState, useEffect } from 'react';
import { Brain, Plus, Edit, Trash2, Play, TestTube, GripVertical, Eye, EyeOff } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';
import { useAuth } from '../contexts/AuthContext';
import { importService } from '../services/importService';
import { ImportRule } from '../types/import';

const RulesManager: React.FC = () => {
  const { user } = useAuth();
  const { categories, accounts } = useBudget();
  const [rules, setRules] = useState<ImportRule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<ImportRule | null>(null);
  const [testingRule, setTestingRule] = useState<ImportRule | null>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    pattern: '',
    targetCategoryId: '',
    targetAccountId: '',
    notes: '',
    priority: 50,
    matchType: 'contains' as 'exact' | 'contains' | 'regex' | 'fuzzy',
    confidenceThreshold: 0.8,
    isActive: true
  });

  useEffect(() => {
    if (user) {
      loadRules();
    }
  }, [user]);

  const loadRules = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const userRules = await importService.getUserRules(user.id);
      setRules(userRules);
    } catch (error) {
      console.error('Failed to load rules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !formData.pattern || !formData.targetCategoryId) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setIsLoading(true);
    try {
      const ruleData = {
        userId: user.id,
        pattern: formData.pattern,
        targetCategoryId: formData.targetCategoryId,
        targetAccountId: formData.targetAccountId || undefined,
        notes: formData.notes || undefined,
        priority: formData.priority,
        matchType: formData.matchType,
        confidenceThreshold: formData.confidenceThreshold,
        isActive: formData.isActive
      };

      if (editingRule) {
        await importService.updateRule(editingRule.id, ruleData);
      } else {
        await importService.createRule(ruleData);
      }

      await loadRules();
      resetForm();
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      pattern: '',
      targetCategoryId: '',
      targetAccountId: '',
      notes: '',
      priority: 50,
      matchType: 'contains',
      confidenceThreshold: 0.8,
      isActive: true
    });
    setShowForm(false);
    setEditingRule(null);
  };

  const editRule = (rule: ImportRule) => {
    setEditingRule(rule);
    setFormData({
      pattern: rule.pattern,
      targetCategoryId: rule.targetCategoryId,
      targetAccountId: rule.targetAccountId || '',
      notes: rule.notes || '',
      priority: rule.priority,
      matchType: rule.matchType,
      confidenceThreshold: rule.confidenceThreshold,
      isActive: rule.isActive
    });
    setShowForm(true);
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette règle ?')) return;
    
    setIsLoading(true);
    try {
      await importService.deleteRule(ruleId);
      await loadRules();
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRuleStatus = async (rule: ImportRule) => {
    setIsLoading(true);
    try {
      await importService.updateRule(rule.id, { isActive: !rule.isActive });
      await loadRules();
    } catch (error: any) {
      alert(`Erreur: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testRule = async (rule: ImportRule) => {
    setTestingRule(rule);
    setIsLoading(true);
    
    try {
      const results = await importService.testRule(rule, user!.id, categories);
      setTestResults(results);
    } catch (error: any) {
      alert(`Erreur lors du test: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getMatchTypeLabel = (type: string) => {
    const labels = {
      exact: 'Correspondance exacte',
      contains: 'Contient le texte',
      regex: 'Expression régulière',
      fuzzy: 'Correspondance floue'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getMatchTypeColor = (type: string) => {
    const colors = {
      exact: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      contains: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      regex: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
      fuzzy: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
            <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Règles d'auto-catégorisation
          </h1>
        </div>
        
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>Nouvelle règle</span>
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
          🧠 Comment ça marche ?
        </h4>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Les règles permettent d'automatiser la catégorisation lors des imports CSV. 
          Plus vous créez de règles précises, plus l'import devient automatique et rapide.
        </p>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {editingRule ? 'Modifier' : 'Créer'} une règle
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="pattern" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Motif de recherche *
                </label>
                <input
                  type="text"
                  id="pattern"
                  value={formData.pattern}
                  onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Ex: CARREFOUR, SALAIRE, LOYER"
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Texte à rechercher dans la description des transactions
                </p>
              </div>

              <div>
                <label htmlFor="matchType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Type de correspondance *
                </label>
                <select
                  id="matchType"
                  value={formData.matchType}
                  onChange={(e) => setFormData({ ...formData, matchType: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  required
                >
                  <option value="contains">Contient le texte</option>
                  <option value="exact">Correspondance exacte</option>
                  <option value="fuzzy">Correspondance floue</option>
                  <option value="regex">Expression régulière</option>
                </select>
              </div>

              <div>
                <label htmlFor="targetCategory" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Catégorie cible *
                </label>
                <select
                  id="targetCategory"
                  value={formData.targetCategoryId}
                  onChange={(e) => setFormData({ ...formData, targetCategoryId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  required
                >
                  <option value="">Sélectionner une catégorie</option>
                  {categories.map(category => {
                    const IconComponent = (LucideIcons as any)[category.icon] || LucideIcons.DollarSign;
                    return (
                      <option key={category.id} value={category.id}>
                        {category.name} ({category.type})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Priorité (0-100)
                </label>
                <input
                  type="number"
                  id="priority"
                  min="0"
                  max="100"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Plus élevée = appliquée en premier
                </p>
              </div>

              <div>
                <label htmlFor="confidence" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Seuil de confiance
                </label>
                <input
                  type="number"
                  id="confidence"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formData.confidenceThreshold}
                  onChange={(e) => setFormData({ ...formData, confidenceThreshold: parseFloat(e.target.value) || 0.8 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  0.8 = 80% de confiance minimum
                </p>
              </div>

              <div className="md:col-span-2">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes (optionnel)
                </label>
                <input
                  type="text"
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Description de la règle"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
              >
                {editingRule ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rules List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Mes règles ({rules.length})
          </h3>
        </div>

        {rules.length > 0 ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {rules
              .sort((a, b) => b.priority - a.priority)
              .map((rule) => {
                const category = categories.find(c => c.id === rule.targetCategoryId);
                const IconComponent = category ? (LucideIcons as any)[category.icon] : LucideIcons.DollarSign;
                
                return (
                  <div key={rule.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="cursor-move">
                          <GripVertical className="h-5 w-5 text-gray-400" />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                              "{rule.pattern}"
                            </h4>
                            <span className={`text-xs px-2 py-1 rounded-full ${getMatchTypeColor(rule.matchType)}`}>
                              {getMatchTypeLabel(rule.matchType)}
                            </span>
                            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                              Priorité {rule.priority}
                            </span>
                            {!rule.isActive && (
                              <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                                Désactivée
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">→</span>
                            {category && (
                              <div className="flex items-center space-x-2">
                                <div
                                  className="p-1 rounded"
                                  style={{ backgroundColor: `${category.color}20` }}
                                >
                                  <IconComponent 
                                    className="h-3 w-3" 
                                    style={{ color: category.color }}
                                  />
                                </div>
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  {category.name}
                                </span>
                              </div>
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              (≥{(rule.confidenceThreshold * 100).toFixed(0)}%)
                            </span>
                          </div>
                          
                          {rule.notes && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {rule.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => testRule(rule)}
                          disabled={isLoading}
                          className="p-1 text-green-600 hover:text-green-700 dark:text-green-400"
                          title="Tester la règle"
                        >
                          <TestTube className="h-4 w-4" />
                        </button>
                        
                        <button
                          onClick={() => toggleRuleStatus(rule)}
                          disabled={isLoading}
                          className={`p-1 rounded ${
                            rule.isActive
                              ? 'text-orange-600 hover:text-orange-700 dark:text-orange-400'
                              : 'text-green-600 hover:text-green-700 dark:text-green-400'
                          }`}
                          title={rule.isActive ? 'Désactiver' : 'Activer'}
                        >
                          {rule.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        
                        <button
                          onClick={() => editRule(rule)}
                          className="p-1 text-blue-600 hover:text-blue-700 dark:text-blue-400"
                          title="Modifier"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        
                        <button
                          onClick={() => deleteRule(rule.id)}
                          disabled={isLoading}
                          className="p-1 text-red-600 hover:text-red-700 dark:text-red-400"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <Brain className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <p className="text-lg mb-2">Aucune règle créée</p>
            <p className="text-sm">Créez votre première règle pour automatiser la catégorisation</p>
          </div>
        )}
      </div>

      {/* Test Results Modal */}
      {testingRule && testResults && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  <TestTube className="h-5 w-5 mr-2" />
                  Test de la règle: "{testingRule.pattern}"
                </h3>
                <button
                  onClick={() => {
                    setTestingRule(null);
                    setTestResults(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {testResults.matches} correspondances trouvées
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Sur les 1000 dernières transactions
                </p>
              </div>

              {testResults.examples.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                    Exemples de correspondances:
                  </h4>
                  <div className="space-y-2">
                    {testResults.examples.map((example: any, index: number) => (
                      <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-900 dark:text-white">
                            {example.description}
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              → {example.categoryName}
                            </span>
                            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                              {(example.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {testResults.matches === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>Aucune correspondance trouvée</p>
                  <p className="text-sm mt-1">
                    Essayez d'ajuster le motif ou le type de correspondance
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RulesManager;