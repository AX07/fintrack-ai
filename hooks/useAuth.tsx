import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  name: string;
  email: string;
  avatar: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CURRENT_USER_STORAGE_KEY = 'finTrackAuthUserEmail';
const USERS_DB_STORAGE_KEY = 'finTrackUsersDB';

// Helper to get users from localStorage
const getUsersFromStorage = (): Record<string, User> => {
    try {
        const users = localStorage.getItem(USERS_DB_STORAGE_KEY);
        return users ? JSON.parse(users) : {};
    } catch {
        return {};
    }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const userEmail = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
      if (!userEmail) return null;
      const users = getUsersFromStorage();
      return users[userEmail] || null;
    } catch {
      return null;
    }
  });

  const isAuthenticated = !!user;
  const navigate = useNavigate();

  const login = (email: string) => {
    const users = getUsersFromStorage();
    let currentUser = users[email];

    if (!currentUser) {
      // Create a new user if they don't exist
      const name = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      currentUser = {
        name,
        email,
        avatar: `https://i.pravatar.cc/150?u=${email}`,
      };
      users[email] = currentUser;
      localStorage.setItem(USERS_DB_STORAGE_KEY, JSON.stringify(users));
    }
    
    localStorage.setItem(CURRENT_USER_STORAGE_KEY, email);
    setUser(currentUser);
    navigate('/dashboard');
  };

  const logout = () => {
    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    setUser(null);
    navigate('/login');
  };

  const value = { isAuthenticated, user, login, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
