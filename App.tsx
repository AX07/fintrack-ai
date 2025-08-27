

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import MainLayout from './components/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';
import SyncPage from './pages/SyncPage';

const App: React.FC = () => {
  return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/sync/:peerId" element={<SyncPage />} />
        <Route element={<ProtectedRoute />}>
            <Route path="/*" element={<MainLayout />} />
        </Route>
      </Routes>
  );
};

export default App;