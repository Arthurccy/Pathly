import React from 'react';
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

  if (!user) {
    return <div className="min-h-screen bg-slate-50 dark:bg-gray-950">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#eff6ff_0,#f8fafc_34%,#f6f7fb_100%)] dark:bg-[radial-gradient(circle_at_top_left,#172033_0,#111827_38%,#030712_100%)]">
      <Header onViewChange={onViewChange} />
      <div className="flex">
        <Sidebar currentView={currentView} onViewChange={onViewChange} />
        <main className="flex-1 p-4 sm:p-6 lg:ml-72 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
