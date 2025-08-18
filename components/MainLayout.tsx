
import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Dashboard from '../pages/Dashboard';
import SpendingPage from '../pages/SpendingPage';
import AssetsPage from '../pages/AssetsPage';
import AccountDetailPage from '../pages/AccountDetailPage';
import { AIPage } from '../pages/AIPage';
import ProfilePage from '../pages/ProfilePage';
import { MenuIcon } from './Icons';

const MainLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-text-primary font-sans">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Floating Menu Button for Mobile */}
      <button
        onClick={() => setIsSidebarOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-surface/50 backdrop-blur-sm text-text-secondary hover:text-text-primary hover:bg-secondary transition-all"
        aria-label="Open sidebar"
      >
        <MenuIcon className="h-6 w-6" />
      </button>

      <div className="flex-1 flex flex-col min-w-0 md:ml-64">
        <main className="flex-1 p-6 lg:p-10 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/spending" element={<SpendingPage />} />
            <Route path="/assets" element={<AssetsPage />} />
            <Route path="/assets/:accountId" element={<AccountDetailPage />} />
            <Route path="/ai" element={<AIPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
        <footer className="text-center p-4 text-text-secondary text-xs">
          <div>
            Made by CryptoAx07.com
          </div>
        </footer>
      </div>
    </div>
  );
};

export default MainLayout;