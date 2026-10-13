import React from 'react';
import { Calendar, Home, ListChecks, Plus, Wallet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Header from './Header';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  currentView?: string;
  onViewChange?: (view: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentView, onViewChange }) => {
  const { user } = useAuth();
  const mobileNavItems = [
    { id: 'dashboard', label: 'Accueil', icon: Home },
    { id: 'transactions', label: 'Transac.', icon: ListChecks },
    { id: 'add-transaction', label: 'Ajouter', icon: Plus, primary: true },
    { id: 'calendar', label: 'Calendrier', icon: Calendar },
    { id: 'accounts', label: 'Comptes', icon: Wallet },
  ];

  if (!user) {
    return <div className="min-h-screen bg-slate-50 dark:bg-gray-950">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#f0f7ff_0%,#f8fafc_45%,#f1f5f9_100%)] dark:bg-[radial-gradient(ellipse_at_top,#0f1e3a_0%,#0f172a_40%,#020617_100%)]">
      <Header onViewChange={onViewChange} />
      <div className="flex">
        <Sidebar currentView={currentView} onViewChange={onViewChange} />
        <main className="w-full min-w-0 flex-1 px-3 pb-28 pt-4 sm:p-6 lg:ml-72 lg:px-8 lg:py-7">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/96 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/96 lg:hidden"
        style={{ boxShadow: '0 -1px 0 0 rgba(0,0,0,0.05), 0 -4px 16px 0 rgba(0,0,0,0.06)' }}>
        <div className="grid grid-cols-5 gap-0.5">
          {mobileNavItems.map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onViewChange?.(item.id)}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium transition-all duration-150 ${
                  item.primary
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 scale-105'
                    : isActive
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                      : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900'
                }`}
              >
                <Icon className={`${item.primary ? 'h-5 w-5' : 'h-[18px] w-[18px]'}`} />
                <span className="truncate leading-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default Layout;
