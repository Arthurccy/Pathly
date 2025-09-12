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
  const { categories, addCategory, updateCategory, deleteCategory, reorderCategories } = useBudget();
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

  const handleSubmit = (e: React.FormEvent) => {
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
      order: editingCategory ? editingCategory.order : categories.filter(c => c.type === formData.type).length,
      isActive: true,
    };

    if (editingCategory) {
      updateCategory(editingCategory.id, categoryData);
    } else {
      addCategory(categoryData);
    }

    // Reset form
    setFormData({
      name: '',
      icon: 'DollarSign',
      color: '#3B82F6',
      type: 'expense',
      budget: '',
      description: '',
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
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg">
            <Tag className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Gestion des catégories
          </h1>
        </div>
        
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5" />
          <span>Nouvelle catégorie</span>
        </button>
      </div>

      {/* Type Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-2">
          {(['income', 'expense', 'savings', 'debt', 'bill'] as const).map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
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

            {/* Icon Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Icône
              </label>
              <div className="grid grid-cols-8 md:grid-cols-12 gap-2 max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2">
                {iconOptions.map(iconName => {
                  const IconComponent = (LucideIcons as any)[iconName];
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon: iconName })}
                      className={`p-2 rounded-lg border-2 transition-all ${
                        formData.icon === iconName
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <IconComponent className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Couleur
              </label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      formData.color === color
                        ? 'border-gray-400 scale-110'
                        : 'border-gray-200 dark:border-gray-600 hover:scale-105'
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