import React, { useState } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  GripVertical, 
  Eye, 
  EyeOff,
  Palette,
  Tag
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useBudget } from '../contexts/BudgetContext';
import { Category } from '../types';

const CategoryManager: React.FC = () => {
  const { 
    categories, 
    addCategory, 
    updateCategory, 
    deleteCategory, 
    reorderCategories, 
    householdConfig, 
    toggleCategoryShared, 
    ratioA, 
    ratioB 
  } = useBudget();
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [selectedType, setSelectedType] = useState<'income' | 'expense' | 'savings' | 'debt' | 'bill'>('expense');
  
  const [formData, setFormData] = useState({
    name: '',
    icon: 'DollarSign',
    color: '#3B82F6',
    type: 'expense' as Category['type'],
    budget: '',
    description: '',
    excludeFromReports: false,
    isSharedBudget: false,
  });

  const iconOptions = [
    'DollarSign', 'Home', 'Car', 'ShoppingCart', 'Utensils', 'Gamepad2', 
    'Heart', 'Shirt', 'GraduationCap', 'Shield', 'Receipt', 'Banknote',
    'Briefcase', 'TrendingUp', 'PiggyBank', 'CreditCard', 'Smartphone',
    'Fuel', 'Plane', 'Coffee', 'Book', 'Music', 'Camera', 'Gift',
    'Baby', 'Dog', 'Wrench', 'Lightbulb', 'Wifi', 'Phone', 'Tv'
  ];

  const colorOptions = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899',
    '#6366F1', '#14B8A6', '#F97316', '#84CC16', '#06B6D4', '#A855F7',
    '#DC2626', '#059669', '#D97706', '#7C3AED', '#BE185D', '#4F46E5'
  ];

  const categoriesByType = categories.filter(c => c.type === selectedType);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Le nom de la catégorie est requis');
      return;
    }

    const categoryData = {
      name: formData.name.trim(),
      icon: formData.icon,
      color: formData.color,
      type: formData.type,
      budget: formData.budget ? parseFloat(formData.budget) : undefined,
      description: formData.description.trim() || undefined,
      excludeFromReports: formData.excludeFromReports,
      order: editingCategory ? editingCategory.order : categories.filter(c => c.type === formData.type).length,
      isActive: true,
    };

    if (editingCategory) {
      await updateCategory(editingCategory.id, categoryData);
      const isCurrentlyShared = householdConfig.sharedCategoryIds?.includes(editingCategory.id) || false;
      if (formData.isSharedBudget !== isCurrentlyShared) {
        await toggleCategoryShared(editingCategory.id);
      }
    } else {
      await addCategory(categoryData);
    }

    // Reset form
    setFormData({
      name: '',
      icon: 'DollarSign',
      color: '#3B82F6',
      type: 'expense',
      budget: '',
      description: '',
      excludeFromReports: false,
      isSharedBudget: false,
    });
    setShowForm(false);
    setEditingCategory(null);
  };

  const editCategory = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      icon: category.icon,
      color: category.color,
      type: category.type,
      budget: category.budget?.toString() || '',
      description: category.description || '',
      excludeFromReports: category.excludeFromReports || false,
      isSharedBudget: householdConfig.sharedCategoryIds?.includes(category.id) || false,
    });
    setShowForm(true);
  };

  const toggleCategoryStatus = (category: Category) => {
    updateCategory(category.id, { isActive: !category.isActive });
  };

  const getTypeLabel = (type: Category['type']) => {
    const labels = {
      income: 'Revenus',
      expense: 'Dépenses',
      savings: 'Épargne',
      debt: 'Dettes',
      bill: 'Factures'
    };
    return labels[type];
  };

  const getTypeColor = (type: Category['type']) => {
    const colors = {
      income: 'text-green-600 dark:text-green-400',
      expense: 'text-red-600 dark:text-red-400',
      savings: 'text-blue-600 dark:text-blue-400',
      debt: 'text-orange-600 dark:text-orange-400',
      bill: 'text-purple-600 dark:text-purple-400'
    };
    return colors[type];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg">
            <Tag className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
            Gestion des catégories
          </h1>
        </div>
        
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl transition-colors text-sm font-medium shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Nouvelle catégorie</span>
        </button>
      </div>

      {/* Type Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(['income', 'expense', 'savings', 'debt', 'bill'] as const).map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedType === type
                  ? 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {getTypeLabel(type)} ({categories.filter(c => c.type === type).length})
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {editingCategory ? 'Modifier' : 'Créer'} une catégorie
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nom *
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Ex: Alimentation"
                  required
                />
              </div>

              {/* Type */}
              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Type *
                </label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as Category['type'] })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  required
                >
                  <option value="income">Revenus</option>
                  <option value="expense">Dépenses</option>
                  <option value="savings">Épargne</option>
                  <option value="debt">Dettes</option>
                  <option value="bill">Factures</option>
                </select>
              </div>

              {/* Budget (for expense categories) */}
              {formData.type === 'expense' && (
                <div>
                  <label htmlFor="budget" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Budget par défaut (€)
                  </label>
                  <input
                    type="number"
                    id="budget"
                    step="0.01"
                    min="0"
                    value={formData.budget}
                    onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="0.00"
                  />
                </div>
              )}

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Description optionnelle"
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
              <input
                type="checkbox"
                checked={formData.excludeFromReports}
                onChange={(e) => setFormData({ ...formData, excludeFromReports: e.target.checked })}
                className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                <span className="block text-sm font-medium text-gray-900 dark:text-white">
                  Exclure des tableaux de bord
                </span>
                <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                  Utile pour les corrections de solde, remboursements techniques ou écritures qui ne sont pas de vrais revenus/dépenses.
                </span>
              </span>
            </label>

            {householdConfig?.enabled && (formData.type === 'expense' || formData.type === 'bill') && (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900/60 dark:bg-rose-950/20">
                <input
                  type="checkbox"
                  checked={formData.isSharedBudget}
                  onChange={(e) => setFormData({ ...formData, isSharedBudget: e.target.checked })}
                  className="mt-1 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                />
                <span>
                  <span className="block text-sm font-semibold text-rose-950 dark:text-rose-200">
                    Budget commun du foyer (Partagé {ratioA}% / {ratioB}%)
                  </span>
                  <span className="mt-1 block text-xs text-rose-700 dark:text-rose-300">
                    Toutes les dépenses dans cette catégorie seront automatiquement réparties entre {householdConfig.userA?.name || 'Moi'} et {householdConfig.userB?.name || 'Conjoint(e)'}.
                  </span>
                </span>
              </label>
            )}

            {/* Icon Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Icône
              </label>
              <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-xl p-3">
                {iconOptions.map(iconName => {
                  const IconComponent = (LucideIcons as any)[iconName];
                  return (
                    <button
                      key={iconName}
                      type="button"
                      title={iconName}
                      onClick={() => setFormData({ ...formData, icon: iconName })}
                      className={`flex items-center justify-center p-2.5 rounded-xl border-2 transition-all min-h-[44px] min-w-[44px] ${
                        formData.icon === iconName
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 scale-105 shadow-sm'
                          : 'border-transparent bg-gray-50 dark:bg-gray-700/50 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/10'
                      }`}
                    >
                      <IconComponent className={`h-5 w-5 ${formData.icon === iconName ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Couleur
                </label>
                <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <span className="inline-block h-4 w-4 rounded-full border border-gray-300" style={{ backgroundColor: formData.color }} />
                  {formData.color}
                </span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {colorOptions.map(color => (
                  <button
                    key={color}
                    type="button"
                    title={color}
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-9 h-9 rounded-xl border-2 transition-all flex-shrink-0 ${
                      formData.color === color
                        ? 'border-gray-700 dark:border-white scale-110 shadow-md'
                        : 'border-white dark:border-gray-800 hover:scale-110 hover:shadow-sm'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingCategory(null);
                  setFormData({
                    name: '',
                    icon: 'DollarSign',
                    color: '#3B82F6',
                  type: 'expense',
                  budget: '',
                  description: '',
                  excludeFromReports: false,
                });
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                {editingCategory ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Categories List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {getTypeLabel(selectedType)} ({categoriesByType.length}/120)
          </h3>
        </div>

        {categoriesByType.length > 0 ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {categoriesByType
              .sort((a, b) => a.order - b.order)
              .map((category) => {
                const IconComponent = (LucideIcons as any)[category.icon] || LucideIcons.DollarSign;
                
                return (
                  <div key={category.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="cursor-move">
                          <GripVertical className="h-5 w-5 text-gray-400" />
                        </div>
                        
                        <div
                          className="p-2 rounded-lg"
                          style={{ backgroundColor: `${category.color}20` }}
                        >
                          <IconComponent 
                            className="h-5 w-5" 
                            style={{ color: category.color }}
                          />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                              {category.name}
                            </h4>
                            <span className={`text-xs px-2 py-1 rounded-full ${getTypeColor(category.type)} bg-gray-100 dark:bg-gray-700`}>
                              {getTypeLabel(category.type)}
                            </span>
                            {!category.isActive && (
                              <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                                Désactivée
                              </span>
                            )}
                            {category.excludeFromReports && (
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                Hors stats
                              </span>
                            )}
                            {householdConfig?.enabled && householdConfig.sharedCategoryIds?.includes(category.id) && (
                              <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                                Budget commun ({ratioA}/{ratioB})
                              </span>
                            )}
                          </div>
                          
                          {category.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {category.description}
                            </p>
                          )}
                          
                          {category.budget && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Budget par défaut: {category.budget.toFixed(2)} €
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => toggleCategoryStatus(category)}
                          className={`p-1 rounded ${
                            category.isActive
                              ? 'text-green-600 hover:text-green-700 dark:text-green-400'
                              : 'text-gray-400 hover:text-gray-600 dark:text-gray-500'
                          }`}
                          title={category.isActive ? 'Désactiver' : 'Activer'}
                        >
                          {category.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </button>
                        
                        <button
                          onClick={() => editCategory(category)}
                          className="p-1 text-blue-600 hover:text-blue-700 dark:text-blue-400"
                          title="Modifier"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        
                        <button
                          onClick={() => {
                            if (confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) {
                              deleteCategory(category.id);
                            }
                          }}
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
            <Tag className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <p className="text-lg mb-2">Aucune catégorie {getTypeLabel(selectedType).toLowerCase()}</p>
            <p className="text-sm">Créez votre première catégorie pour commencer</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryManager;
