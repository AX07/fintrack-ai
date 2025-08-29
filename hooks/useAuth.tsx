import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, FinanceData } from '../types';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  createUserAndLogin: (name: string) => void;
  login: (user: User, financeData?: FinanceData) => void; // For QR code sign-in
  logout: () => void;
  updateUser: (updatedDetails: Partial<Omit<User, 'id'>>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CURRENT_USER_STORAGE_KEY = 'finTrackAuthUserId';
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

const generateUserId = (name: string): string => {
    // Creates a simple, stable ID from the user's name
    const sanitizedName = name.toLowerCase().trim().replace(/\s+/g, '-');
    return sanitizedName.replace(/[^a-z0-9-]/g, '');
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const userId = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
      if (!userId) return null;
      const users = getUsersFromStorage();
      return users[userId] || null;
    } catch {
      return null;
    }
  });

  const isAuthenticated = !!user;
  const navigate = useNavigate();

  const createUserAndLogin = (name: string) => {
    const users = getUsersFromStorage();
    const id = generateUserId(name);
    
    let currentUser = users[id];

    if (!currentUser) {
      currentUser = {
        id,
        name,
        avatar: `https://i.pravatar.cc/150?u=${id}`,
      };
      users[id] = currentUser;
      localStorage.setItem(USERS_DB_STORAGE_KEY, JSON.stringify(users));
    }
    
    localStorage.setItem(CURRENT_USER_STORAGE_KEY, id);
    setUser(currentUser);
    navigate('/dashboard');
  };
  
  const login = (userToLogin: User, financeData?: FinanceData) => {
    // Save finance data FIRST, before triggering re-renders with setUser
    if (financeData) {
        const financeDataKey = `finTrackData_${userToLogin.id}`;
        try {
            localStorage.setItem(financeDataKey, JSON.stringify(financeData));
        } catch (error) {
            console.error("Failed to save finance data during login", error);
        }
    }

    const users = getUsersFromStorage();
    users[userToLogin.id] = userToLogin; // Add or update user from QR
    localStorage.setItem(USERS_DB_STORAGE_KEY, JSON.stringify(users));
    localStorage.setItem(CURRENT_USER_STORAGE_KEY, userToLogin.id);
    setUser(userToLogin);
    // Navigation is handled in LoginPage after all data is set
  };

  const logout = () => {
    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    setUser(null);
    navigate('/login');
  };

  const updateUser = (updatedDetails: Partial<Omit<User, 'id'>>) => {
    setUser(currentUser => {
        if (!currentUser) return null;

        const users = getUsersFromStorage();
        const updatedUser: User = { ...currentUser, ...updatedDetails };
        
        users[currentUser.id] = updatedUser;
        localStorage.setItem(USERS_DB_STORAGE_KEY, JSON.stringify(users));
        
        return updatedUser;
    });
  };

  const value = { isAuthenticated, user, createUserAndLogin, login, logout, updateUser };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
