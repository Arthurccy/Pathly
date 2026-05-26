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
      type === 'success' ? 'bg-green-500' : 'bg-red-500'
    } text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-all duration-300`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
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
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
      <div className="h-14 w-full px-3 pl-14 pr-2 sm:h-16 sm:pr-4 lg:pl-6 lg:pr-6">
        <div className="flex h-full items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onViewChange?.('dashboard')}
            className="min-w-0 rounded-md px-1 py-2 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            aria-label="Retour au tableau de bord"
          >
            <span className="block truncate text-lg font-bold text-gray-900 dark:text-white sm:text-xl">
              Pathly
            </span>
          </button>

          <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200 sm:h-10 sm:w-10"
              aria-label={isDark ? 'Activer le thème clair' : 'Activer le thème sombre'}
              title={isDark ? 'Thème clair' : 'Thème sombre'}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <button
              type="button"
              onClick={() => onViewChange?.('settings')}
              className="flex min-w-0 items-center gap-2 rounded-full px-1.5 py-1.5 text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-300 dark:hover:bg-gray-700 sm:rounded-lg sm:px-2 sm:py-2"
              title="Paramètres du profil"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                <User className="h-5 w-5" />
              </span>
              <span className="hidden min-w-0 text-left sm:block">
                <span className="block max-w-[11rem] truncate text-sm font-medium">
                  {displayName}
                </span>
                {email && (
                  <span className="block max-w-[11rem] truncate text-xs text-gray-500 dark:text-gray-400">
                    {email}
                  </span>
                )}
              </span>
              <Settings className="hidden h-4 w-4 shrink-0 text-gray-400 md:block" />
            </button>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400 sm:h-10 sm:w-10 sm:rounded-lg"
              aria-label="Se déconnecter"
              title="Se déconnecter"
            >
              {isLoggingOut ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <LogOut className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
