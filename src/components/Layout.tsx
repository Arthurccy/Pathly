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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#eff6ff_0,#f8fafc_34%,#f6f7fb_100%)] dark:bg-[radial-gradient(circle_at_top_left,#172033_0,#111827_38%,#030712_100%)]">
      <Header onViewChange={onViewChange} />
      <div className="flex">
        <Sidebar currentView={currentView} onViewChange={onViewChange} />
        <main className="min-w-0 flex-1 px-3 pb-28 pt-4 sm:p-6 lg:ml-72 lg:p-8">
          {children}
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur dark:border-gray-800 dark:bg-gray-950/95 lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {mobileNavItems.map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onViewChange?.(item.id)}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-medium transition ${
                  item.primary
                    ? 'bg-blue-600 text-white shadow-sm'
                    : isActive
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-200'
                      : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-900'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default Layout;
