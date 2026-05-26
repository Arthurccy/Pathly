import React, { useState } from 'react';
import {
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileText,
  HelpCircle,
  LayoutDashboard,
  ListChecks,
  Menu,
  Plus,
  Repeat,
  Settings,
  SlidersHorizontal,
  Target,
  Upload,
  Wallet,
  X
} from 'lucide-react';

interface SidebarProps {
  currentView?: string;
  onViewChange?: (view: string) => void;
}

const groups = [
  {
    title: 'Quotidien',
    items: [
      { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
      { id: 'add-transaction', label: 'Ajouter', icon: Plus, highlight: true },
      { id: 'transactions', label: 'Transactions', icon: ListChecks },
      { id: 'accounts', label: 'Comptes', icon: Wallet },
      { id: 'calendar', label: 'Calendrier', icon: Calendar },
    ],
  },
  {
    title: 'Planifier',
    items: [
      { id: 'goals', label: 'Objectifs', icon: Target },
      { id: 'debts', label: 'Dettes', icon: CreditCard },
      { id: 'recurring-transactions', label: 'Récurrences', icon: Repeat },
      { id: 'analytics', label: 'Analyses', icon: BarChart3 },
    ],
  },
  {
    title: 'Outils',
    collapsedByDefault: true,
    items: [
      { id: 'import-csv', label: 'Import CSV', icon: Upload },
      { id: 'rules', label: 'Règles auto', icon: SlidersHorizontal },
      { id: 'wealth-simulator', label: 'Simulateur', icon: BarChart3 },
      { id: 'categories', label: 'Catégories', icon: SlidersHorizontal },
      { id: 'export', label: 'Export', icon: FileText },
      { id: 'settings', label: 'Paramètres', icon: Settings },
      { id: 'help', label: 'Aide', icon: HelpCircle },
    ],
  },
];

const Sidebar: React.FC<SidebarProps> = ({ currentView = 'dashboard', onViewChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState(() =>
    Object.fromEntries(groups.map(group => [group.title, !group.collapsedByDefault]))
  );

  const handleItemClick = (viewId: string) => {
    onViewChange?.(viewId);
    setIsOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-3 top-2.5 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800 sm:top-3 sm:h-10 sm:w-10 lg:hidden"
        aria-label={isOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`
        fixed left-0 top-14 h-[calc(100dvh-3.5rem)] w-[min(18rem,86vw)] bg-white/95 dark:bg-gray-900/95
        border-r border-gray-200 dark:border-gray-800 z-40 backdrop-blur
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        overflow-y-auto pb-24 lg:top-16 lg:h-[calc(100vh-4rem)] lg:w-72 lg:translate-x-0 lg:pb-0
      `}>
        <div className="p-4">
          <button
            onClick={() => handleItemClick('add-transaction')}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-100"
          >
            <Plus className="h-5 w-5" />
            Ajouter une opération
          </button>

          <nav className="space-y-4">
            {groups.map(group => {
              const isGroupOpen = openGroups[group.title];
              return (
                <section key={group.title}>
                  <button
                    type="button"
                    onClick={() => setOpenGroups(prev => ({ ...prev, [group.title]: !isGroupOpen }))}
                    className="mb-2 flex w-full items-center justify-between px-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    <span>{group.title}</span>
                    {isGroupOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>

                  {isGroupOpen && (
                    <div className="space-y-1">
                      {group.items.map(item => {
                        const Icon = item.icon;
                        const isActive = currentView === item.id;

                        return (
                          <button
                            key={item.id}
                            onClick={() => handleItemClick(item.id)}
                            className={`
                              flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm
                              transition-colors duration-200
                              ${isActive
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200'
                                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                              }
                            `}
                          >
                            <Icon className="h-5 w-5 shrink-0" />
                            <span className="font-medium">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
