import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BudgetProvider } from './contexts/BudgetContext';
import Layout from './components/Layout';
import Auth from './components/Auth';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import AddTransaction from './components/AddTransaction';
import RecentTransactions from './components/RecentTransactions';
import RecurringTransactions from './components/RecurringTransactions';
import BudgetCalendar from './components/BudgetCalendar';
import CategoryManager from './components/CategoryManager';
import AccountManager from './components/AccountManager';
import DebtManager from './components/DebtManager';
import WealthSimulator from './components/WealthSimulator';
import AdvancedAnalytics from './components/AdvancedAnalytics';
import AdvancedSavingsGoals from './components/AdvancedSavingsGoals';
import ExportManager from './components/ExportManager';
import UserSettings from './components/UserSettings';
import HelpCenter from './components/HelpCenter';
import ImportCSV from './components/ImportCSV';
import RulesManager from './components/RulesManager';
import OnboardingTour from './components/OnboardingTour';

const AppContent: React.FC = () => {
  const { user, session, isLoading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [authMode, setAuthMode] = useState<'landing' | 'login' | 'register'>('landing');
  
  // Reset view when user changes (logout/login)
  React.useEffect(() => {
    console.log('🎯 AppContent: User state changed:', user ? 'Logged in' : 'Not logged in');
    if (!user) {
      setCurrentView('dashboard');
    }
  }, [user]);

  console.log('🎯 AppContent render: User =', user ? 'Present' : 'Null');

  // While auth initializes and no user yet, show spinner
  if (isLoading && !user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Vérification de la session...</p>
        </div>
      </div>
    );
  }

  if (!user && !session) {
    if (authMode === 'landing') {
      return (
        <LandingPage
          onLogin={() => setAuthMode('login')}
          onRegister={() => setAuthMode('register')}
        />
      );
    }

    console.log('AppContent: Showing Auth component');
    return (
      <Auth
        initialMode={authMode}
        onBack={() => setAuthMode('landing')}
      />
    );
  }

  console.log('🎯 AppContent: Showing main app');
  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onViewChange={setCurrentView} />;
      case 'add-transaction':
        return <AddTransaction />;
      case 'transactions':
        return <RecentTransactions limit={0} title="Transactions" />;
      case 'recurring-transactions':
        return <RecurringTransactions />;
      case 'calendar':
        return <BudgetCalendar />;
      case 'categories':
        return <CategoryManager />;
      case 'accounts':
        return <AccountManager />;
      case 'debts':
        return <DebtManager />;
      case 'wealth-simulator':
        return <WealthSimulator />;
      case 'analytics':
        return <AdvancedAnalytics />;
      case 'goals':
        return <AdvancedSavingsGoals />;
      case 'export':
        return <ExportManager />;
      case 'settings':
        return <UserSettings />;
      case 'help':
        return <HelpCenter />;
      case 'import-csv':
        return <ImportCSV />;
      case 'rules':
        return <RulesManager />;
      default:
        return <Dashboard onViewChange={setCurrentView} />;
    }
  };

  return (
    <Layout currentView={currentView} onViewChange={setCurrentView}>
      {renderContent()}
      <OnboardingTour onViewChange={setCurrentView} />
    </Layout>
  );
};

function App() {
  return (
    <AuthProvider>
      <BudgetProvider>
        <AppContent />
      </BudgetProvider>
    </AuthProvider>
  );
}

export default App;
