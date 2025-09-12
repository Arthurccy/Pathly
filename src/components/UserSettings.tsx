import React, { useState } from 'react';
import { Settings, User, Palette, Globe, Bell, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { UserSettings as UserSettingsType } from '../types';

const UserSettings: React.FC = () => {
  const { user, updateUserSettings } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  
  const [settings, setSettings] = useState<Partial<UserSettingsType>>({
    fiscalYearStart: user?.settings?.fiscalYearStart || 1,
    defaultPeriod: user?.settings?.defaultPeriod || 'monthly',
    currency: user?.settings?.currency || 'EUR',
    dateFormat: user?.settings?.dateFormat || 'dd/MM/yyyy',
    language: user?.settings?.language || 'fr',
    notifications: {
      budgetAlerts: user?.settings?.notifications?.budgetAlerts ?? true,
      recurringReminders: user?.settings?.notifications?.recurringReminders ?? true,
      goalDeadlines: user?.settings?.notifications?.goalDeadlines ?? true,
    },
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateUserSettings(settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const months = [
    { value: 1, label: 'Janvier' },
    { value: 2, label: 'Février' },
    { value: 3, label: 'Mars' },
    { value: 4, label: 'Avril' },
    { value: 5, label: 'Mai' },
    { value: 6, label: 'Juin' },
    { value: 7, label: 'Juillet' },
    { value: 8, label: 'Août' },
    { value: 9, label: 'Septembre' },
    { value: 10, label: 'Octobre' },
    { value: 11, label: 'Novembre' },
    { value: 12, label: 'Décembre' },
  ];

  const currencies = [
    { value: 'EUR', label: 'Euro (€)', symbol: '€' },
    { value: 'USD', label: 'Dollar US ($)', symbol: '$' },
    { value: 'GBP', label: 'Livre Sterling (£)', symbol: '£' },
    { value: 'CHF', label: 'Franc Suisse (CHF)', symbol: 'CHF' },
    { value: 'CAD', label: 'Dollar Canadien (CAD)', symbol: 'CAD' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <Settings className="h-6 w-6 text-gray-600 dark:text-gray-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Paramètres
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <User className="h-5 w-5 mr-2" />
            Profil utilisateur
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nom
              </label>
              <input
                type="text"
                value={user?.name || ''}
                disabled
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
              />
            </div>
          </div>
        </div>

        {/* Financial Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Globe className="h-5 w-5 mr-2" />
            Paramètres financiers
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Début de l'année fiscale
              </label>
              <select
                value={settings.fiscalYearStart}
                onChange={(e) => setSettings({ ...settings, fiscalYearStart: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                {months.map(month => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Devise
              </label>
              <select
                value={settings.currency}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                {currencies.map(currency => (
                  <option key={currency.value} value={currency.value}>
                    {currency.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Période par défaut
              </label>
              <select
                value={settings.defaultPeriod}
                onChange={(e) => setSettings({ ...settings, defaultPeriod: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="weekly">Hebdomadaire</option>
                <option value="monthly">Mensuel</option>
                <option value="yearly">Annuel</option>
              </select>
            </div>
          </div>
        </div>

        {/* Display Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Palette className="h-5 w-5 mr-2" />
            Affichage
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Thème
              </label>
              <div className="flex space-x-3">
                <button
                  onClick={toggleTheme}
                  className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                    !isDark
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  ☀️ Clair
                </button>
                <button
                  onClick={toggleTheme}
                  className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                    isDark
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  🌙 Sombre
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Format de date
              </label>
              <select
                value={settings.dateFormat}
                onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="dd/MM/yyyy">DD/MM/YYYY (31/12/2024)</option>
                <option value="MM/dd/yyyy">MM/DD/YYYY (12/31/2024)</option>
                <option value="yyyy-MM-dd">YYYY-MM-DD (2024-12-31)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Bell className="h-5 w-5 mr-2" />
            Notifications
          </h3>
          
          <div className="space-y-4">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notifications?.budgetAlerts}
                onChange={(e) => setSettings({
                  ...settings,
                  notifications: {
                    ...settings.notifications!,
                    budgetAlerts: e.target.checked,
                  },
                })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Alertes de budget
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Recevoir des alertes en cas de dépassement de budget
                </p>
              </div>
            </label>
            
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notifications?.recurringReminders}
                onChange={(e) => setSettings({
                  ...settings,
                  notifications: {
                    ...settings.notifications!,
                    recurringReminders: e.target.checked,
                  },
                })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Rappels de transactions récurrentes
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Rappels pour les transactions récurrentes à venir
                </p>
              </div>
            </label>
            
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notifications?.goalDeadlines}
                onChange={(e) => setSettings({
                  ...settings,
                  notifications: {
                    ...settings.notifications!,
                    goalDeadlines: e.target.checked,
                  },
                })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Échéances d'objectifs
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Notifications pour les échéances d'objectifs d'épargne
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all ${
            saveSuccess
              ? 'bg-green-600 text-white'
              : isSaving
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {saveSuccess ? (
            <>
              <span>✓</span>
              <span>Paramètres sauvegardés</span>
            </>
          ) : isSaving ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Sauvegarde...</span>
            </>
          ) : (
            <>
              <Save className="h-5 w-5" />
              <span>Sauvegarder les paramètres</span>
            </>
          )}
        </button>
      </div>

      {/* Data Management */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Gestion des données
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Stockage local
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Vos données sont stockées localement dans votre navigateur. 
              Elles ne sont pas partagées avec des serveurs externes.
            </p>
            <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              Voir les détails du stockage
            </button>
          </div>
          
          <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Sauvegarde recommandée
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Exportez régulièrement vos données pour éviter toute perte 
              en cas de problème avec votre navigateur.
            </p>
            <button className="text-sm text-green-600 dark:text-green-400 hover:underline">
              Aller à l'export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserSettings;