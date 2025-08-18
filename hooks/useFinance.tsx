
import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { Transaction, Account, FinanceData, Holding, Conversation } from '../types';
import { useAuth } from './useAuth';

// MOCK DATA for a clean slate
const initialData: FinanceData = {
    transactions: [],
    accounts: [],
    conversationHistory: [],
    lastUpdated: new Date().toISOString(),
};

type Action = 
    | { type: 'ADD_TRANSACTION'; payload: Transaction }
    | { type: 'ADD_MULTIPLE_TRANSACTIONS'; payload: Transaction[] }
    | { type: 'ADD_ACCOUNTS'; payload: Omit<Account, 'id'>[] }
    | { type: 'ADD_CONVERSATION'; payload: Conversation }
    | { type: 'RENAME_ACCOUNT'; payload: { oldName: string; newName: string } }
    | { type: 'UPDATE_TRANSACTION', payload: Partial<Transaction> & { id: string } }
    | { type: 'UPDATE_ACCOUNT', payload: { id: string, data: Partial<Omit<Account, 'id'>> } }
    | { type: 'ADD_HOLDING', payload: { accountId: string, holding: Omit<Holding, 'id'> } }
    | { type: 'UPDATE_HOLDING', payload: { accountId: string, holdingId: string, data: Partial<Holding> } }
    | { type: 'REMOVE_HOLDING', payload: { accountId: string, holdingId: string } }
    | { type: 'SET_DATA', payload: FinanceData }
    | { type: 'CLEAR_DATA' };

interface FinanceContextType extends FinanceData {
    addTransaction: (transaction: Transaction) => void;
    addMultipleTransactions: (transactions: Transaction[]) => void;
    addAccounts: (accounts: Omit<Account, 'id'>[]) => void;
    addConversation: (conversation: Conversation) => void;
    renameAccount: (payload: { oldName: string; newName: string }) => void;
    updateTransaction: (transaction: Partial<Transaction> & { id: string }) => void;
    updateAccount: (payload: { id: string, data: Partial<Omit<Account, 'id'>> }) => void;
    addHolding: (payload: { accountId: string, holding: Omit<Holding, 'id'> }) => void;
    updateHolding: (payload: { accountId: string, holdingId: string, data: Partial<Holding> }) => void;
    removeHolding: (payload: { accountId: string, holdingId: string }) => void;
    setData: (data: FinanceData) => void;
    clearAllData: () => void;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const financeReducer = (state: FinanceData, action: Action): FinanceData => {
    switch (action.type) {
        case 'ADD_TRANSACTION':
            return {
                ...state,
                transactions: [action.payload, ...state.transactions],
                lastUpdated: new Date().toISOString(),
            };
        case 'ADD_MULTIPLE_TRANSACTIONS':
            return {
                ...state,
                transactions: [...action.payload, ...state.transactions],
                lastUpdated: new Date().toISOString(),
            };
        case 'ADD_ACCOUNTS': {
            const updatedAccounts = [...state.accounts];

            action.payload.forEach(newAccountData => {
                const index = updatedAccounts.findIndex(acc => acc.name === newAccountData.name && acc.category === newAccountData.category);

                if (index !== -1) {
                    // Update existing account
                    const existingAccount = updatedAccounts[index];
                    
                    // Merge holdings: update existing or add new
                    const updatedHoldings = [...(existingAccount.holdings || [])];
                    newAccountData.holdings?.forEach(newHolding => {
                        const holdingIndex = updatedHoldings.findIndex(h => h.name === newHolding.name);
                        if (holdingIndex !== -1) {
                            updatedHoldings[holdingIndex] = { ...updatedHoldings[holdingIndex], ...newHolding };
                        } else {
                            updatedHoldings.push({ ...newHolding, id: `hld-${Date.now()}-${Math.random()}` });
                        }
                    });

                    updatedAccounts[index] = {
                        ...existingAccount,
                        ...newAccountData,
                        holdings: updatedHoldings.length > 0 ? updatedHoldings : undefined,
                        // Recalculate balance if holdings are provided
                        balance: newAccountData.holdings ? updatedHoldings.reduce((sum, h) => sum + h.value, 0) : newAccountData.balance,
                    };
                } else {
                    // Add new account
                    const newAccount: Account = {
                        ...newAccountData,
                        id: `acc-${Date.now()}-${Math.random()}`,
                        holdings: newAccountData.holdings?.map(h => ({ ...h, id: `hld-${Date.now()}-${Math.random()}` }))
                    };
                    updatedAccounts.push(newAccount);
                }
            });

            return {
                ...state,
                accounts: updatedAccounts,
                lastUpdated: new Date().toISOString(),
            };
        }
        case 'ADD_CONVERSATION':
            return {
                ...state,
                conversationHistory: [action.payload, ...state.conversationHistory],
                lastUpdated: new Date().toISOString(),
            }
        case 'RENAME_ACCOUNT': {
            const { oldName, newName } = action.payload;
            const accountIndex = state.accounts.findIndex(acc => acc.name.toLowerCase() === oldName.toLowerCase());
    
            if (accountIndex === -1) {
                console.warn(`Account with name "${oldName}" not found for renaming.`);
                return state; // Do nothing if account not found
            }
            const updatedAccounts = [...state.accounts];
            const accountToUpdate = updatedAccounts[accountIndex];
            
            updatedAccounts[accountIndex] = { ...accountToUpdate, name: newName };
    
            const updatedTransactions = state.transactions.map(t => {
                if (t.accountName?.toLowerCase() === oldName.toLowerCase()) {
                    return { ...t, accountName: newName };
                }
                return t;
            });
    
            return {
                ...state,
                accounts: updatedAccounts,
                transactions: updatedTransactions,
                lastUpdated: new Date().toISOString(),
            };
        }
        case 'UPDATE_TRANSACTION':
            return {
                ...state,
                transactions: state.transactions.map(t =>
                    t.id === action.payload.id ? { ...t, ...action.payload } : t
                ),
                lastUpdated: new Date().toISOString(),
            };

        case 'UPDATE_ACCOUNT': {
            const { id, data } = action.payload;
            const accountToUpdate = state.accounts.find(acc => acc.id === id);

            if (!accountToUpdate) {
                return state; // Account not found, do nothing.
            }

            let updatedTransactions = state.transactions;
            // If account name is changing, update all transactions linked to it.
            if (data.name && data.name !== accountToUpdate.name) {
                updatedTransactions = state.transactions.map(t => {
                    if (t.accountName === accountToUpdate.name) {
                        return { ...t, accountName: data.name };
                    }
                    return t;
                });
            }

            const updatedAccounts = state.accounts.map(account => {
                if (account.id === id) {
                    return { ...account, ...data };
                }
                return account;
            });

            return {
                ...state,
                accounts: updatedAccounts,
                transactions: updatedTransactions,
                lastUpdated: new Date().toISOString(),
            };
        }

        case 'ADD_HOLDING':
        case 'UPDATE_HOLDING':
        case 'REMOVE_HOLDING': {
            const { accountId } = action.payload;
            const accountIndex = state.accounts.findIndex(acc => acc.id === accountId);
            if (accountIndex === -1) return state;

            const updatedAccounts = [...state.accounts];
            const accountToUpdate = { ...updatedAccounts[accountIndex] };
            let currentHoldings = [...(accountToUpdate.holdings || [])];

            if (action.type === 'ADD_HOLDING') {
                const newHolding: Holding = {
                    ...action.payload.holding,
                    id: `hld-${Date.now()}-${Math.random()}`
                };
                currentHoldings.push(newHolding);
            } else if (action.type === 'UPDATE_HOLDING') {
                const { holdingId, data } = action.payload;
                currentHoldings = currentHoldings.map(h => h.id === holdingId ? { ...h, ...data } : h);
            } else if (action.type === 'REMOVE_HOLDING') {
                currentHoldings = currentHoldings.filter(h => h.id !== action.payload.holdingId);
            }
            
            accountToUpdate.holdings = currentHoldings;
            accountToUpdate.balance = currentHoldings.reduce((sum, h) => sum + h.value, 0);
            updatedAccounts[accountIndex] = accountToUpdate;

            return { ...state, accounts: updatedAccounts, lastUpdated: new Date().toISOString() };
        }
        
        case 'SET_DATA':
            return action.payload;
        
        case 'CLEAR_DATA':
            return initialData;

        default:
            return state;
    }
};

export const FinanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();

    const initializer = () => {
        if (!user) return initialData;
        const LOCAL_STORAGE_KEY = `finTrackData_${user.email}`;
        try {
            const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (storedData) {
                const parsedData = JSON.parse(storedData);
                // Basic validation and add lastUpdated if missing
                if (parsedData.transactions && parsedData.accounts && parsedData.conversationHistory) {
                    return { ...parsedData, lastUpdated: parsedData.lastUpdated || new Date(0).toISOString() };
                }
            }
        } catch (error) {
            console.error("Failed to load or parse data from localStorage", error);
        }
        return initialData;
    };

    const [state, dispatch] = useReducer(financeReducer, undefined, initializer);

    useEffect(() => {
        if (!user) return; // Don't save if no user is logged in
        const LOCAL_STORAGE_KEY = `finTrackData_${user.email}`;
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            console.error("Failed to save data to localStorage", error);
        }
    }, [state, user]);

    const addTransaction = (transaction: Transaction) => dispatch({ type: 'ADD_TRANSACTION', payload: transaction });
    const addMultipleTransactions = (transactions: Transaction[]) => dispatch({ type: 'ADD_MULTIPLE_TRANSACTIONS', payload: transactions });
    const addAccounts = (accounts: Omit<Account, 'id'>[]) => dispatch({ type: 'ADD_ACCOUNTS', payload: accounts });
    const addConversation = (conversation: Conversation) => dispatch({ type: 'ADD_CONVERSATION', payload: conversation });
    const renameAccount = (payload: { oldName: string; newName: string }) => dispatch({ type: 'RENAME_ACCOUNT', payload });
    const updateTransaction = (transaction: Partial<Transaction> & { id: string }) => dispatch({ type: 'UPDATE_TRANSACTION', payload: transaction });
    const updateAccount = (payload: { id: string, data: Partial<Omit<Account, 'id'>> }) => dispatch({ type: 'UPDATE_ACCOUNT', payload });
    const addHolding = (payload: { accountId: string, holding: Omit<Holding, 'id'> }) => dispatch({ type: 'ADD_HOLDING', payload });
    const updateHolding = (payload: { accountId: string, holdingId: string, data: Partial<Holding> }) => dispatch({ type: 'UPDATE_HOLDING', payload });
    const removeHolding = (payload: { accountId: string, holdingId: string }) => dispatch({ type: 'REMOVE_HOLDING', payload });
    const setData = (data: FinanceData) => dispatch({ type: 'SET_DATA', payload: data });
    const clearAllData = () => {
        if (user) {
            const LOCAL_STORAGE_KEY = `finTrackData_${user.email}`;
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            dispatch({ type: 'CLEAR_DATA' });
        }
    };

    const value = { ...state, addTransaction, addMultipleTransactions, addAccounts, addConversation, renameAccount, updateTransaction, updateAccount, addHolding, updateHolding, removeHolding, setData, clearAllData };

    return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
};

export const useFinance = (): FinanceContextType => {
    const context = useContext(FinanceContext);
    if (context === undefined) {
        throw new Error('useFinance must be used within a FinanceProvider');
    }
    return context;
};
