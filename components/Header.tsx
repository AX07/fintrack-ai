import React from 'react';
import { Link } from 'react-router-dom';
import { MenuIcon } from './Icons';
import { useAuth } from '../hooks/useAuth';
import NotificationCatcher from './NotificationCatcher';

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
              className="md:hidden mr-4 p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-secondary focus:outline-none"
              aria-label="Open sidebar"
            >
              <MenuIcon className="block h-6 w-6" />
            </button>
            <div className="flex-shrink-0 md:hidden">
              <a href="https://www.cryptoax07.com/" target="_blank" rel="noopener noreferrer">
                <img src="https://static.wixstatic.com/media/4a78c1_0ce55f39403f46ccbe0ef5e7f6c799f3~mv2.png/v1/fill/w_958,h_360,al_c,lg_1,q_85,enc_avif,quality_auto/4a78c1_0ce55f39403f46ccbe0ef5e7f6c799f3~mv2.png" alt="Company Logo" className="h-10 object-contain" />
              </a>
            </div>
          </div>
          <div className="flex items-center">
            <NotificationCatcher />
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