import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Plus, 
  PieChart, 
  Target, 
  Settings, 
  Menu,
  X,
  Repeat,
  Calendar,
  Tag,
  CreditCard,
  Upload,
  Brain,
  FileText,
  HelpCircle,
  Calculator,
  TrendingUp,
  Wallet
} from 'lucide-react';

interface SidebarProps {
  currentView?: string;
  onViewChange?: (view: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView = 'dashboard', onViewChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'add-transaction', label: 'Ajouter une opération', icon: Plus },
    { id: 'recurring-transactions', label: 'Transactions récurrentes', icon: Repeat },
    { id: 'calendar', label: 'Calendrier budgétaire', icon: Calendar },
    { id: 'categories', label: 'Gestion des catégories', icon: Tag },
    { id: 'accounts', label: 'Gestion des comptes', icon: Wallet },
    { id: 'debts', label: 'Dettes et crédits', icon: CreditCard },
    { id: 'import-csv', label: 'Import CSV', icon: Upload },
    { id: 'rules', label: 'Règles d\'auto-catégorisation', icon: Brain },
    { id: 'wealth-simulator', label: 'Simulateur de patrimoine', icon: Calculator },
    { id: 'analytics', label: 'Analyse détaillée', icon: PieChart },
    { id: 'goals', label: 'Objectifs d\'épargne avancés', icon: Target },
    { id: 'export', label: 'Export & Sauvegarde', icon: FileText },
    { id: 'settings', label: 'Paramètres', icon: Settings },
    { id: 'help', label: 'Aide', icon: HelpCircle },
  ];

  const handleItemClick = (viewId: string) => {
    onViewChange?.(viewId);
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-white dark:bg-gray-800 
        shadow-lg border-r border-gray-200 dark:border-gray-700 z-40
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 overflow-y-auto
      `}>
        <nav className="p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`
                  w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left
                  transition-colors duration-200
                  ${isActive 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-r-2 border-blue-500' 
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;