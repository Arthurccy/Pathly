import React, { useState } from 'react';
import { LogOut, Loader2, Moon, Settings, Sun, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';

interface HeaderProps {
  onViewChange?: (view: string) => void;
}

const Header: React.FC<HeaderProps> = ({ onViewChange }) => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Profil';
  const email = user?.email || '';

  const showToast = (message: string, type: 'success' | 'error') => {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 ${
      type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
    } text-white text-sm px-4 py-2.5 rounded-xl shadow-lg shadow-black/10 z-[200] font-medium`;
    toast.textContent = message;
    toast.style.cssText += '; transform: translateY(-4px); opacity: 0; transition: all 0.2s ease;';
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.transform = 'translateY(0)';
      toast.style.opacity = '1';
    });
    setTimeout(() => {
      toast.style.transform = 'translateY(-4px)';
      toast.style.opacity = '0';
      setTimeout(() => {
        if (document.body.contains(toast)) document.body.removeChild(toast);
      }, 200);
    }, 3000);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    try {
      setIsLoggingOut(true);
      await logout();
      showToast('Déconnexion réussie', 'success');
    } catch (error) {
      console.error('Logout failed:', error);
      showToast('Erreur lors de la déconnexion', 'error');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 shadow-[0_1px_0_0_rgba(0,0,0,0.05)] backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/90">
      <div className="h-14 w-full px-3 pl-14 pr-2 sm:h-16 sm:pr-4 lg:pl-6 lg:pr-6">
        <div className="flex h-full items-center justify-between gap-3">
          {/* Logo */}
          <button
            type="button"
            onClick={() => onViewChange?.('dashboard')}
            className="min-w-0 rounded-lg px-1 py-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
            aria-label="Retour au tableau de bord"
          >
            <span className="flex items-center gap-2">
              {/* Brand mark */}
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-500/25">
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-white" aria-hidden="true">
                  <path d="M4 14l4-4 3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className="block truncate text-[1.05rem] font-bold tracking-tight text-slate-900 dark:text-white sm:text-lg">
                Pathly
              </span>
            </span>
          </button>

          <div className="flex min-w-0 items-center justify-end gap-1 sm:gap-2">
            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label={isDark ? 'Activer le thème clair' : 'Activer le thème sombre'}
              title={isDark ? 'Thème clair' : 'Thème sombre'}
            >
              {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>

            {/* User profile */}
            <button
              type="button"
              onClick={() => onViewChange?.('settings')}
              className="flex min-w-0 items-center gap-2 rounded-xl px-1.5 py-1.5 text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-800 sm:px-2"
              title="Paramètres du profil"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-700 dark:from-blue-950/60 dark:to-indigo-950/60 dark:text-blue-300">
                <User className="h-4 w-4" />
              </span>
              <span className="hidden min-w-0 text-left sm:block">
                <span className="block max-w-[11rem] truncate text-sm font-semibold tracking-tight">
                  {displayName}
                </span>
                {email && (
                  <span className="block max-w-[11rem] truncate text-[11px] text-slate-400 dark:text-slate-500">
                    {email}
                  </span>
                )}
              </span>
              <Settings className="hidden h-3.5 w-3.5 shrink-0 text-slate-400 md:block" />
            </button>

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-500 dark:hover:bg-red-950/30 dark:hover:text-red-400"
              aria-label="Se déconnecter"
              title="Se déconnecter"
            >
              {isLoggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
