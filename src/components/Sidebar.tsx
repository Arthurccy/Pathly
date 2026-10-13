import React, { useState } from 'react';
import {
  BarChart3,
  Building2,
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
  Users,
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
      { id: 'assets', label: 'Biens & Patrimoine', icon: Building2 },
      { id: 'household', label: 'Foyer & Couple', icon: Users },
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
      { id: 'budget-simulator', label: 'Simul. Budget', icon: Target },
      { id: 'wealth-simulator', label: 'Simul. Patrimoine', icon: BarChart3 },
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
      {/* Hamburger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-3 top-2.5 z-50 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 sm:top-3 sm:h-10 sm:w-10 lg:hidden"
        aria-label={isOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
      >
        {isOpen ? <X className="h-4.5 w-4.5 text-slate-600 dark:text-slate-400" /> : <Menu className="h-4.5 w-4.5 text-slate-600 dark:text-slate-400" />}
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside className={`
        fixed left-0 top-14 z-40 h-[calc(100dvh-3.5rem)] w-[min(17rem,86vw)]
        border-r border-slate-200/80 bg-white/97 dark:border-slate-800/80 dark:bg-slate-950/97
        backdrop-blur-xl overflow-y-auto
        transform transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
        pb-24 lg:top-16 lg:h-[calc(100dvh-4rem)] lg:w-72 lg:translate-x-0 lg:pb-6 lg:shadow-none
      `}>
        <div className="p-3 lg:p-4">
          {/* CTA button */}
          <button
            onClick={() => handleItemClick('add-transaction')}
            className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-slate-900/15 transition-all duration-150 hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 dark:shadow-white/10"
          >
            <Plus className="h-4 w-4" />
            Ajouter une opération
          </button>

          <nav className="space-y-5">
            {groups.map(group => {
              const isGroupOpen = openGroups[group.title];
              return (
                <section key={group.title}>
                  <button
                    type="button"
                    onClick={() => setOpenGroups(prev => ({ ...prev, [group.title]: !isGroupOpen }))}
                    className="mb-1.5 flex w-full items-center justify-between rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                  >
                    <span>{group.title}</span>
                    {isGroupOpen
                      ? <ChevronDown className="h-3.5 w-3.5" />
                      : <ChevronRight className="h-3.5 w-3.5" />
                    }
                  </button>

                  {isGroupOpen && (
                    <div className="space-y-0.5">
                      {group.items.map(item => {
                        const Icon = item.icon;
                        const isActive = currentView === item.id;

                        return (
                          <button
                            key={item.id}
                            onClick={() => handleItemClick(item.id)}
                            className={`
                              group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm
                              transition-all duration-150
                              ${isActive
                                ? 'bg-blue-50 text-blue-700 font-semibold dark:bg-blue-950/50 dark:text-blue-300'
                                : 'text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100'
                              }
                            `}
                          >
                            {/* Active accent bar */}
                            {isActive && (
                              <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-blue-600 dark:bg-blue-400" />
                            )}
                            <Icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'}`} />
                            <span>{item.label}</span>
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
