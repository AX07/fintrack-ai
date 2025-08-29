import React, { createContext, useContext, useReducer, ReactNode, useEffect, useState, useCallback } from 'react';
import { Transaction, Account, FinanceData, Holding, Conversation, TransactionCategory, defaultTransactionCategories, Settings, Currency } from '../types';
import { useAuth } from './useAuth';
import { fetchExchangeRates } from '../services/marketDataService';

// MOCK DATA for a clean slate
const initialData: FinanceData = {
    settings: { displayCurrency: 'USD' },
    transactions: [],
    accounts: [],
    conversationHistory: [],
    transactionCategories: defaultTransactionCategories,
    lastUpdated: new Date().toISOString(),
    pendingFileForAI: null,
    aiProcessingStatus: { isProcessing: false, message: '' },
};

type Action = 
    | { type: 'ADD_TRANSACTION'; payload: Transaction }
    | { type: 'ADD_MULTIPLE_TRANSACTIONS'; payload: Transaction[] }
    | { type: 'ADD_ACCOUNTS'; payload: Omit<Account, 'id'>[] }
    | { type: 'ADD_CONVERSATION'; payload: Conversation }
    | { type: 'ADD_TRANSACTION_CATEGORY'; payload: string }
    | { type: 'RENAME_ACCOUNT'; payload: { oldName: string; newName: string } }
    | { type: 'MERGE_ACCOUNTS'; payload: { sourceAccountName: string; destinationAccountName: string } }
    | { type: 'UPDATE_TRANSACTION', payload: Partial<Transaction> & { id: string } }
    | { type: 'UPDATE_TRANSACTIONS_CATEGORY', payload: { ids: string[]; category: TransactionCategory } }
    | { type: 'DELETE_TRANSACTION', payload: { transactionId: string } }
    | { type: 'UPDATE_ACCOUNT', payload: { id: string, data: Partial<Omit<Account, 'id'>> } }
    | { type: 'DELETE_ACCOUNT', payload: { accountId: string } }
    | { type: 'ADD_HOLDING', payload: { accountId: string, holding: Omit<Holding, 'id' | 'value'> } }
    | { type: 'UPDATE_HOLDING', payload: { accountId: string, holdingId: string, data: Partial<Omit<Holding, 'id' | 'value'>> } }
    | { type: 'UPDATE_HOLDING_PRICES', payload: { accountId: string, holdingId: string, price: number }[] }
    | { type: 'REMOVE_HOLDING', payload: { accountId: string, holdingId: string } }
    | { type: 'UPDATE_SETTINGS', payload: Partial<Settings> }
    | { type: 'SET_DATA', payload: FinanceData }
    | { type: 'SET_PENDING_AI_FILE', payload: File | null }
    | { type: 'SET_AI_PROCESSING_STATUS', payload: { isProcessing: boolean, message: string } }
    | { type: 'CLEAR_DATA' };

// --- CURRENCY CONTEXT ---
interface CurrencyContextType {
    formatCurrency: (value: number, options?: Intl.NumberFormatOptions) => string;
    convertFromUSD: (value: number, targetCurrency: Currency) => number;
    convertToUSD: (value: number, sourceCurrency: Currency) => number;
    displayCurrency: Currency;
    exchangeRates: Record<string, number>;
}
const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const useCurrency = (): CurrencyContextType => {
    const context = useContext(CurrencyContext);
    if (!context) throw new Error('useCurrency must be used within a FinanceProvider');
    return context;
};

// --- FINANCE CONTEXT ---
interface FinanceContextType extends FinanceData {
    addTransaction: (transaction: Omit<Transaction, 'id' | 'amount'> & { originalAmount: { value: number, currency: Currency }}) => void;
    addMultipleTransactions: (transactions: (Omit<Transaction, 'id' | 'amount'> & { originalAmount: { value: number, currency: Currency }})[]) => void;
    addAccounts: (accounts: (Omit<Account, 'id' | 'balance'> & { balance: number, currency: Currency})[]) => void;
    addConversation: (conversation: Conversation) => void;
    addTransactionCategory: (category: string) => void;
    renameAccount: (payload: { oldName: string; newName: string }) => void;
    mergeAccounts: (payload: { sourceAccountName: string; destinationAccountName: string }) => void;
    updateTransaction: (transaction: Partial<Transaction> & { id: string }) => void;
    updateTransactionsCategory: (payload: { ids: string[]; category: TransactionCategory }) => void;
    deleteTransaction: (payload: { transactionId: string }) => void;
    updateAccount: (payload: { id: string, data: Partial<Omit<Account, 'id'>> }) => void;
    deleteAccount: (payload: { accountId: string }) => void;
    addHolding: (payload: { accountId: string, holding: Omit<Holding, 'id' | 'value'> }) => void;
    updateHolding: (payload: { accountId: string, holdingId: string, data: Partial<Omit<Holding, 'id' | 'value'>> }) => void;
    updateHoldingPrices: (payload: { accountId: string, holdingId: string, price: number }[]) => void;
    removeHolding: (payload: { accountId: string, holdingId: string }) => void;
    updateSettings: (settings: Partial<Settings>) => void;
    setData: (data: FinanceData) => void;
    setPendingFileForAI: (file: File | null) => void;
    setAiProcessingStatus: (status: { isProcessing: boolean; message: string }) => void;
    clearAllData: () => void;
    // from currency context
    formatCurrency: (value: number, options?: Intl.NumberFormatOptions) => string;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const financeReducer = (state: FinanceData, action: Action): FinanceData => {
    switch (action.type) {
        case 'ADD_TRANSACTION': {
            const { accountName, amount } = action.payload;
            let updatedAccounts = [...state.accounts];
            if (accountName) {
                const accountIndex = updatedAccounts.findIndex(acc => acc.name.toLowerCase() === accountName.toLowerCase());
                if (accountIndex !== -1) {
                    const accToUpdate = updatedAccounts[accountIndex];
                    updatedAccounts[accountIndex] = { ...accToUpdate, balance: accToUpdate.balance + amount };
                }
            }
            return {
                ...state,
                accounts: updatedAccounts,
                transactions: [action.payload, ...state.transactions],
                lastUpdated: new Date().toISOString(),
            };
        }
        case 'ADD_MULTIPLE_TRANSACTIONS': {
            const accountBalanceChanges: Record<string, number> = {};
            action.payload.forEach(t => {
                if (t.accountName) {
                    const lowerCaseName = t.accountName.toLowerCase();
                    accountBalanceChanges[lowerCaseName] = (accountBalanceChanges[lowerCaseName] || 0) + t.amount;
                }
            });
            const updatedAccounts = state.accounts.map(acc => {
                const lowerCaseName = acc.name.toLowerCase();
                if (accountBalanceChanges[lowerCaseName]) {
                    return { ...acc, balance: acc.balance + accountBalanceChanges[lowerCaseName] };
                }
                return acc;
            });

            return {
                ...state,
                accounts: updatedAccounts,
                transactions: [...action.payload, ...state.transactions],
                lastUpdated: new Date().toISOString(),
            };
        }
        case 'ADD_ACCOUNTS': {
            const updatedAccounts = [...state.accounts];

            action.payload.forEach(newAccountData => {
                const index = updatedAccounts.findIndex(acc => acc.name === newAccountData.name && acc.category === newAccountData.category);

                if (index !== -1) {
                    const existingAccount = updatedAccounts[index];
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
                        balance: newAccountData.holdings ? updatedHoldings.reduce((sum, h) => sum + h.value, 0) : newAccountData.balance,
                    };
                } else {
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
            return { ...state, conversationHistory: [action.payload, ...state.conversationHistory], lastUpdated: new Date().toISOString() };
        case 'ADD_TRANSACTION_CATEGORY': {
            const newCategory = action.payload.trim();
            if (newCategory && !state.transactionCategories.find(c => c.toLowerCase() === newCategory.toLowerCase())) {
                return { ...state, transactionCategories: [...state.transactionCategories, newCategory].sort(), lastUpdated: new Date().toISOString() };
            }
            return state;
        }
        case 'RENAME_ACCOUNT': {
            const { oldName, newName } = action.payload;
            const accountIndex = state.accounts.findIndex(acc => acc.name.toLowerCase() === oldName.toLowerCase());
            if (accountIndex === -1) return state;
            
            const updatedAccounts = [...state.accounts];
            updatedAccounts[accountIndex] = { ...updatedAccounts[accountIndex], name: newName };
            const updatedTransactions = state.transactions.map(t => t.accountName?.toLowerCase() === oldName.toLowerCase() ? { ...t, accountName: newName } : t);
            return { ...state, accounts: updatedAccounts, transactions: updatedTransactions, lastUpdated: new Date().toISOString() };
        }
        case 'MERGE_ACCOUNTS': {
            const { sourceAccountName, destinationAccountName } = action.payload;
            const sourceAccount = state.accounts.find(acc => acc.name.toLowerCase() === sourceAccountName.toLowerCase());
            const destAccount = state.accounts.find(acc => acc.name.toLowerCase() === destinationAccountName.toLowerCase());
            if (!sourceAccount || !destAccount || sourceAccount.id === destAccount.id) return state;

            const updatedTransactions = state.transactions.map(t => t.accountName?.toLowerCase() === sourceAccount.name.toLowerCase() ? { ...t, accountName: destAccount.name } : t);
            const updatedAccounts = state.accounts.map(acc => {
                if (acc.id === destAccount.id) {
                    const destHoldings = [...(acc.holdings || [])];
                    sourceAccount.holdings?.forEach(sourceHolding => {
                        const existingHoldingIndex = destHoldings.findIndex(dh => dh.name.toLowerCase() === sourceHolding.name.toLowerCase());
                        if (existingHoldingIndex !== -1) {
                            destHoldings[existingHoldingIndex].quantity += sourceHolding.quantity;
                            destHoldings[existingHoldingIndex].value += sourceHolding.value;
                        } else {
                            destHoldings.push(sourceHolding);
                        }
                    });
                    return { ...acc, balance: acc.balance + sourceAccount.balance, holdings: destHoldings.length > 0 ? destHoldings : undefined };
                }
                return acc;
            }).filter(acc => acc.id !== sourceAccount.id);
            return { ...state, transactions: updatedTransactions, accounts: updatedAccounts, lastUpdated: new Date().toISOString() };
        }
        case 'UPDATE_TRANSACTION':
            return { ...state, transactions: state.transactions.map(t => t.id === action.payload.id ? { ...t, ...action.payload } : t), lastUpdated: new Date().toISOString() };
        case 'UPDATE_TRANSACTIONS_CATEGORY': {
            const { ids, category } = action.payload;
            const idSet = new Set(ids);
            return { ...state, transactions: state.transactions.map(t => idSet.has(t.id) ? { ...t, category } : t), lastUpdated: new Date().toISOString() };
        }
        case 'DELETE_TRANSACTION':
            return { ...state, transactions: state.transactions.filter(t => t.id !== action.payload.transactionId), lastUpdated: new Date().toISOString() };
        case 'UPDATE_ACCOUNT': {
            const { id, data } = action.payload;
            const accountToUpdate = state.accounts.find(acc => acc.id === id);
            if (!accountToUpdate) return state;

            let updatedTransactions = state.transactions;
            if (data.name && data.name !== accountToUpdate.name) {
                updatedTransactions = state.transactions.map(t => t.accountName === accountToUpdate.name ? { ...t, accountName: data.name } : t);
            }
            const updatedAccounts = state.accounts.map(account => account.id === id ? { ...account, ...data } : account);
            return { ...state, accounts: updatedAccounts, transactions: updatedTransactions, lastUpdated: new Date().toISOString() };
        }
        case 'DELETE_ACCOUNT': {
            const { accountId } = action.payload;
            const accountToDelete = state.accounts.find(acc => acc.id === accountId);
            if (!accountToDelete) return state;

            const updatedAccounts = state.accounts.filter(acc => acc.id !== accountId);
            const updatedTransactions = state.transactions.filter(t => t.accountName !== accountToDelete.name);
            return { ...state, accounts: updatedAccounts, transactions: updatedTransactions, lastUpdated: new Date().toISOString() };
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
                const newHoldingData = action.payload.holding;
                const newHolding: Holding = {
                    ...newHoldingData,
                    id: `hld-${Date.now()}-${Math.random()}`,
                    value: newHoldingData.quantity * newHoldingData.price,
                };
                currentHoldings.push(newHolding);
            } else if (action.type === 'UPDATE_HOLDING') {
                const { holdingId, data } = action.payload;
                currentHoldings = currentHoldings.map(h => {
                    if (h.id === holdingId) {
                        const updatedHolding = { ...h, ...data };
                        if (data.price !== undefined || data.quantity !== undefined) {
                            updatedHolding.value = updatedHolding.quantity * updatedHolding.price;
                        }
                        return updatedHolding;
                    }
                    return h;
                });
            } else if (action.type === 'REMOVE_HOLDING') {
                currentHoldings = currentHoldings.filter(h => h.id !== action.payload.holdingId);
            }
            
            accountToUpdate.holdings = currentHoldings;
            accountToUpdate.balance = currentHoldings.reduce((sum, h) => sum + h.value, 0);
            updatedAccounts[accountIndex] = accountToUpdate;
            return { ...state, accounts: updatedAccounts, lastUpdated: new Date().toISOString() };
        }
        case 'UPDATE_HOLDING_PRICES': {
            const priceUpdates = action.payload;
            const accountsToUpdate = new Map<string, Account>();
            state.accounts.forEach(acc => accountsToUpdate.set(acc.id, { ...acc, holdings: [...(acc.holdings || [])] }));

            accountsToUpdate.forEach(account => {
                let accountBalanceChanged = false;
                if (account.holdings) {
                    account.holdings = account.holdings.map(h => {
                        const update = priceUpdates.find(p => p.holdingId === h.id);
                        if (update) {
                            accountBalanceChanged = true;
                            return { ...h, price: update.price, value: h.quantity * update.price };
                        }
                        return h;
                    });
                    if (accountBalanceChanged) {
                        account.balance = account.holdings.reduce((sum, h) => sum + h.value, 0);
                    }
                }
            });
            return { ...state, accounts: Array.from(accountsToUpdate.values()), lastUpdated: new Date().toISOString() };
        }
        case 'UPDATE_SETTINGS':
            return { ...state, settings: { ...state.settings, ...action.payload }, lastUpdated: new Date().toISOString() };
        case 'SET_PENDING_AI_FILE':
            return { ...state, pendingFileForAI: action.payload };
        case 'SET_AI_PROCESSING_STATUS':
            return { ...state, aiProcessingStatus: action.payload };
        case 'SET_DATA':
            return { ...initialData, ...action.payload, settings: { ...initialData.settings, ...action.payload.settings } };
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
        const LOCAL_STORAGE_KEY = `finTrackData_${user.id}`;
        try {
            const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (storedData) {
                const parsedData = JSON.parse(storedData);
                if (parsedData.transactions && parsedData.accounts) {
                    return { ...initialData, ...parsedData, settings: { ...initialData.settings, ...parsedData.settings } };
                }
            }
        } catch (error) {
            console.error("Failed to load or parse data from localStorage", error);
        }
        return initialData;
    };

    const [state, dispatch] = useReducer(financeReducer, undefined, initializer);

    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({ USD: 1, EUR: 1.08, GBP: 1.25 });
    
    useEffect(() => {
        const getRates = async () => {
            try {
                const rates = await fetchExchangeRates();
                setExchangeRates(rates);
            } catch (error) {
                console.error("Could not fetch exchange rates, using defaults.", error);
            }
        };
        getRates();
    }, []);

    useEffect(() => {
        if (!user) return;
        const LOCAL_STORAGE_KEY = `finTrackData_${user.id}`;
        try {
            // Create a copy of the state to save, but exclude non-serializable parts
            const stateToSave = { ...state };
            delete stateToSave.pendingFileForAI;
            delete (stateToSave as Partial<FinanceData>).aiProcessingStatus;
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
        } catch (error) {
            console.error("Failed to save data to localStorage", error);
        }
    }, [state, user]);

    // --- Currency Conversion Logic ---
    const convertToUSD = useCallback((value: number, sourceCurrency: Currency): number => {
        if (sourceCurrency === 'USD') return value;
        const rate = exchangeRates[sourceCurrency];
        if (!rate) {
            console.warn(`Missing exchange rate for ${sourceCurrency}. Returning original value.`);
            return value;
        }
        return value / rate;
    }, [exchangeRates]);

    const convertFromUSD = useCallback((value: number, targetCurrency: Currency): number => {
        if (targetCurrency === 'USD') return value;
        const rate = exchangeRates[targetCurrency];
        if (!rate) {
            console.warn(`Missing exchange rate for ${targetCurrency}. Returning original value.`);
            return value;
        }
        return value * rate;
    }, [exchangeRates]);
    
    const formatCurrency = useCallback((value: number, options?: Intl.NumberFormatOptions) => {
        const { displayCurrency } = state.settings;
        const convertedValue = convertFromUSD(value, displayCurrency);
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: displayCurrency,
            ...options
        }).format(convertedValue);
    }, [state.settings, convertFromUSD]);

    // --- Action Creators with Currency Conversion ---
    const addTransaction = (transaction: Omit<Transaction, 'id' | 'amount'> & { originalAmount: { value: number, currency: Currency }}) => {
        const processedTransaction = { ...transaction };
        // BUG FIX: Ensure non-income transactions are negative
        if (processedTransaction.category !== 'Income' && processedTransaction.originalAmount.value > 0) {
            processedTransaction.originalAmount.value = -processedTransaction.originalAmount.value;
        }
        const usdAmount = convertToUSD(processedTransaction.originalAmount.value, processedTransaction.originalAmount.currency);
        const newTransaction: Transaction = {
            ...processedTransaction,
            id: `txn-${Date.now()}-${Math.random()}`,
            amount: usdAmount,
        };
        dispatch({ type: 'ADD_TRANSACTION', payload: newTransaction });
    };

    const addMultipleTransactions = (transactions: (Omit<Transaction, 'id' | 'amount'> & { originalAmount: { value: number, currency: Currency }})[]) => {
        const newTransactions: Transaction[] = transactions.map(t => {
            const processedTransaction = { ...t };
            // BUG FIX: Ensure non-income transactions are negative
            if (processedTransaction.category !== 'Income' && processedTransaction.originalAmount.value > 0) {
                processedTransaction.originalAmount.value = -processedTransaction.originalAmount.value;
            }
            return {
                ...processedTransaction,
                id: `txn-${Date.now()}-${Math.random()}`,
                amount: convertToUSD(processedTransaction.originalAmount.value, processedTransaction.originalAmount.currency),
            };
        });
        dispatch({ type: 'ADD_MULTIPLE_TRANSACTIONS', payload: newTransactions });
    };

    const addAccounts = (accounts: (Omit<Account, 'id' | 'balance'> & { balance: number, currency: Currency})[]) => {
        const newAccounts: Omit<Account, 'id'>[] = accounts.map(acc => ({
            ...acc,
            balance: convertToUSD(acc.balance, acc.currency),
        }));
        dispatch({ type: 'ADD_ACCOUNTS', payload: newAccounts });
    };

    const addConversation = (conversation: Conversation) => dispatch({ type: 'ADD_CONVERSATION', payload: conversation });
    const addTransactionCategory = (category: string) => dispatch({ type: 'ADD_TRANSACTION_CATEGORY', payload: category });
    const renameAccount = (payload: { oldName: string; newName: string }) => dispatch({ type: 'RENAME_ACCOUNT', payload });
    const mergeAccounts = (payload: { sourceAccountName: string; destinationAccountName: string }) => dispatch({ type: 'MERGE_ACCOUNTS', payload });
    const updateTransaction = (transaction: Partial<Transaction> & { id: string }) => dispatch({ type: 'UPDATE_TRANSACTION', payload: transaction });
    const updateTransactionsCategory = (payload: { ids: string[]; category: TransactionCategory }) => dispatch({ type: 'UPDATE_TRANSACTIONS_CATEGORY', payload });
    const deleteTransaction = (payload: { transactionId: string }) => dispatch({ type: 'DELETE_TRANSACTION', payload });
    const updateAccount = (payload: { id: string, data: Partial<Omit<Account, 'id'>> }) => dispatch({ type: 'UPDATE_ACCOUNT', payload });
    const deleteAccount = (payload: { accountId: string }) => dispatch({ type: 'DELETE_ACCOUNT', payload });
    const addHolding = (payload: { accountId: string, holding: Omit<Holding, 'id' | 'value'> }) => dispatch({ type: 'ADD_HOLDING', payload });
    const updateHolding = (payload: { accountId: string, holdingId: string, data: Partial<Omit<Holding, 'id' | 'value'>> }) => dispatch({ type: 'UPDATE_HOLDING', payload });
    const updateHoldingPrices = (payload: { accountId: string, holdingId: string, price: number }[]) => dispatch({ type: 'UPDATE_HOLDING_PRICES', payload });
    const removeHolding = (payload: { accountId: string, holdingId: string }) => dispatch({ type: 'REMOVE_HOLDING', payload });
    const updateSettings = (settings: Partial<Settings>) => dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
    const setData = (data: FinanceData) => dispatch({ type: 'SET_DATA', payload: data });
    const setPendingFileForAI = (file: File | null) => dispatch({ type: 'SET_PENDING_AI_FILE', payload: file });
    const setAiProcessingStatus = (status: { isProcessing: boolean; message: string }) => dispatch({ type: 'SET_AI_PROCESSING_STATUS', payload: status });
    const clearAllData = () => {
        if (user) {
            localStorage.removeItem(`finTrackData_${user.id}`);
            dispatch({ type: 'CLEAR_DATA' });
        }
    };
    
    const currencyValue = { formatCurrency, convertFromUSD, convertToUSD, displayCurrency: state.settings.displayCurrency, exchangeRates };
    const financeValue: FinanceContextType = { ...state, addTransaction, addMultipleTransactions, addAccounts, addConversation, addTransactionCategory, renameAccount, mergeAccounts, updateTransaction, updateTransactionsCategory, deleteTransaction, updateAccount, deleteAccount, addHolding, updateHolding, updateHoldingPrices, removeHolding, updateSettings, setData, setPendingFileForAI, setAiProcessingStatus, clearAllData, formatCurrency };

    return (
        <FinanceContext.Provider value={financeValue}>
            <CurrencyContext.Provider value={currencyValue}>
                {children}
            </CurrencyContext.Provider>
        </FinanceContext.Provider>
    );
};

export const useFinance = (): FinanceContextType => {
    const context = useContext(FinanceContext);
    if (context === undefined) {
        throw new Error('useFinance must be used within a FinanceProvider');
    }
    return context;
};