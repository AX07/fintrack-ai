import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { LogoIcon, BellIcon, MenuIcon, SparklesIcon } from './Icons';
import { useAuth } from '../hooks/useAuth';

const navLinks = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Spending', path: '/spending' },
  { name: 'Assets', path: '/assets' },
  { name: 'AI Agent', path: '/ai' },
];

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user } = useAuth();

  return (
    <header className="bg-surface/50 backdrop-blur-sm sticky top-0 z-20 border-b border-secondary">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <button
              onClick={onMenuClick}
              className="md:hidden mr-2 p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-secondary focus:outline-none"
              aria-label="Open sidebar"
            >
              <MenuIcon className="block h-6 w-6" />
            </button>
            <div className="flex-shrink-0">
              <NavLink to="/" className="flex items-center space-x-2">
                <LogoIcon className="h-8 w-8 text-accent" />
                <span className="text-xl font-bold text-text-primary hidden sm:block">FinTrack</span>
              </NavLink>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                {navLinks.map((link) => (
                  <NavLink
                    key={link.name}
                    to={link.path}
                    className={({ isActive }) =>
                      `px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                        isActive
                          ? 'bg-primary text-text-primary'
                          : 'text-text-secondary hover:bg-secondary hover:text-text-primary'
                      }`
                    }
                  >
                    {link.name === 'AI Agent' && <SparklesIcon className="w-4 h-4 text-accent" />}
                    {link.name}
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <button className="p-1 rounded-full text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-accent">
              <BellIcon className="h-6 w-6" />
            </button>
            <Link to="/profile" className="ml-3 relative">
              <img className="h-8 w-8 rounded-full" src={user?.avatar} alt="User" />
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;
