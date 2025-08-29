

import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { LogoIcon, DashboardIcon, SpendingIcon, AssetsIcon, AIAssistantIcon, LogOutIcon } from './Icons';
import { useAuth } from '../hooks/useAuth';

const navLinks = [
  { name: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
  { name: 'Spending', path: '/spending', icon: SpendingIcon },
  { name: 'Assets', path: '/assets', icon: AssetsIcon },
  { name: 'AI Assistant', path: '/ai', icon: AIAssistantIcon },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
    const { user, logout } = useAuth();
  
  return (
    <>
      {/* Backdrop for mobile */}
      <div 
        className={`fixed inset-0 bg-black/60 z-30 md:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      ></div>
        
      <aside className={`fixed top-0 left-0 z-40 w-64 h-full bg-surface border-r border-secondary flex-shrink-0 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex flex-col h-full">
          {/* Logo and Title */}
          <div className="flex items-center gap-3 mb-10">
            <LogoIcon className="h-8 w-8 text-accent" />
            <div>
              <h1 className="text-lg font-bold text-text-primary">FinTrack AI</h1>
              <p className="text-xs text-text-secondary">Smart Finance Manager</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.name}
                  to={link.path}
                  onClick={onClose} // This will close the sidebar on navigation
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-text-primary'
                        : 'text-text-secondary hover:bg-primary hover:text-text-primary'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  <span>{link.name}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Spacer */}
          <div className="flex-grow"></div>

          {/* User Profile & Logout */}
          <div className="border-t border-secondary pt-6 mt-6">
              <div className="flex items-center justify-between">
                  <Link to="/profile" onClick={onClose} className="flex items-center gap-3 group">
                      <img className="h-10 w-10 rounded-full group-hover:ring-2 group-hover:ring-accent transition-all" src={user?.avatar} alt="User" />
                      <div>
                          <p className="text-sm font-semibold text-text-primary">{user?.name}</p>
                      </div>
                  </Link>
                  <button 
                      onClick={logout} 
                      className="p-2 text-text-secondary hover:text-negative rounded-md hover:bg-negative/10 transition-colors"
                      aria-label="Logout"
                  >
                      <LogOutIcon className="w-5 h-5" />
                  </button>
              </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;