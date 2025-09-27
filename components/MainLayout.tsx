

import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Dashboard from '../pages/Dashboard';
import SpendingPage from '../pages/SpendingPage';
import AssetsPage from '../pages/AssetsPage';
import AccountDetailPage from '../pages/AccountDetailPage';
import { AIPage } from '../pages/AIPage';
import ProfilePage from '../pages/ProfilePage';
import ExplorePage from '../pages/ExplorePage';
import AIAgentModal from './AIAgentModal';
import Header from './Header';

const MainLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-text-primary font-sans">
      <AIAgentModal />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 md:ml-64">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />

        <main className="flex-1 p-6 lg:p-10 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/spending" element={<SpendingPage />} />
            <Route path="/assets" element={<AssetsPage />} />
            <Route path="/assets/:accountId" element={<AccountDetailPage />} />
            <Route path="/ai" element={<AIPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            {/* The /explore route is handled outside MainLayout to give it a full-page feel if needed, but we can also handle it here */}
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
        <footer className="text-center p-4 text-text-secondary text-xs">
          <div>
            Made by <a href="https://cryptoax07.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">CryptoAx07.com</a>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default MainLayout;