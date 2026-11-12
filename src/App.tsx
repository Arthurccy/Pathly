/**
 * Copyright (c) 2026 Arthur - Pathly. All rights reserved.
 * Ce code source est la propriété exclusive de son auteur.
 * Toute reproduction, modification, distribution ou utilisation non autorisée est strictement interdite.
 */
import React, { useState, lazy, Suspense } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/authState';
import { BudgetProvider } from './contexts/BudgetContext';
import Layout from './components/Layout';
import Auth from './components/Auth';
import LandingPage from './components/LandingPage';
const Dashboard = lazy(() => import('./components/Dashboard'));
const AddTransaction = lazy(() => import('./components/AddTransaction'));
const RecentTransactions = lazy(() => import('./components/RecentTransactions'));
const RecurringTransactions = lazy(() => import('./components/RecurringTransactions'));
const BudgetCalendar = lazy(() => import('./components/BudgetCalendar'));
const CategoryManager = lazy(() => import('./components/CategoryManager'));
const AccountManager = lazy(() => import('./components/AccountManager'));
const DebtManager = lazy(() => import('./components/DebtManager'));
const WealthSimulator = lazy(() => import('./components/WealthSimulator'));
const BudgetSimulator = lazy(() => import('./components/BudgetSimulator'));
const AdvancedAnalytics = lazy(() => import('./components/AdvancedAnalytics'));
const AdvancedSavingsGoals = lazy(() => import('./components/AdvancedSavingsGoals'));
const ExportManager = lazy(() => import('./components/ExportManager'));
const UserSettings = lazy(() => import('./components/UserSettings'));
const HelpCenter = lazy(() => import('./components/HelpCenter'));
const ImportCSV = lazy(() => import('./components/ImportCSV'));
const RulesManager = lazy(() => import('./components/RulesManager'));
import OnboardingTour from './components/OnboardingTour';
const HouseholdManager = lazy(() => import('./components/HouseholdManager'));
const AssetManager = lazy(() => import('./components/AssetManager'));
const RealEstatePlanner = lazy(() => import('./components/RealEstatePlanner'));
const InvestmentPortfolio = lazy(() => import('./components/InvestmentPortfolio').then(module => ({ default: module.InvestmentPortfolio })));
import { getCustomMonthPeriod } from './utils/dateUtils';

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
  const currentBudgetPeriod = getCustomMonthPeriod(new Date(), user?.settings?.monthStartDay || 1);
  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onViewChange={setCurrentView} />;
      case 'add-transaction':
        return <AddTransaction />;
      case 'transactions':
        return <RecentTransactions limit={0} title="Transactions" mode="all" periodStart={currentBudgetPeriod.start} periodEnd={currentBudgetPeriod.end} />;
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
      case 'household':
        return <HouseholdManager />;
      case 'assets':
        return <AssetManager onViewChange={setCurrentView} />;
      case 'investments':
        return <InvestmentPortfolio onViewChange={setCurrentView} />;
      case 'real-estate-project':
        return <RealEstatePlanner onViewChange={setCurrentView} />;
      case 'wealth-simulator':
        return <WealthSimulator />;
      case 'budget-simulator':
        return <BudgetSimulator />;
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
        return <ImportCSV onViewChange={setCurrentView} />;
      case 'rules':
        return <RulesManager />;
      default:
        return <Dashboard onViewChange={setCurrentView} />;
    }
  };

  return (
    <Layout currentView={currentView} onViewChange={setCurrentView}>
      <Suspense fallback={<p role="status" className="p-6">Chargement…</p>}>{renderContent()}</Suspense>
      <OnboardingTour onViewChange={setCurrentView} />
    </Layout>
  );
};

function UserBudget() {
  const { user } = useAuth();
  return <BudgetProvider key={user?.id || "signed-out"}><AppContent /></BudgetProvider>;
}

function App() {
  return (
    <AuthProvider>
      <UserBudget />
    </AuthProvider>
  );
}

export default App;
