
export type TransactionCategory = 'Income' | 'Food' | 'Transport' | 'Rent' | 'Utilities' | 'Health' | 'Entertainment' | 'Business' | 'Investment' | 'Crypto' | 'Other';
export const transactionCategories: TransactionCategory[] = ['Income', 'Food', 'Transport', 'Rent', 'Utilities', 'Health', 'Entertainment', 'Business', 'Investment', 'Crypto', 'Other'];

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // positive for income, negative for expenses
  category: TransactionCategory;
  accountName?: string;
}

// HIERARCHICAL ASSET STRUCTURE

export type AssetCategory = 'Bank Accounts' | 'Equities' | 'Bonds' | 'Crypto' | 'Commodities' | 'Real Estate';

/**
 * Represents an individual holding within an account, e.g., a stock, a crypto token.
 */
export interface Holding {
    id: string;
    name: string; // e.g., "Apple Inc.", "Ethereum"
    ticker?: string; // e.g., "AAPL", "ETH"
    quantity: number;
    value: number; // Total current market value in USD
}

/**
 * Represents a container for assets, e.g., a bank account, brokerage, or crypto wallet.
 * Simple assets like real estate can be represented as an Account without holdings.
 */
export interface Account {
  id: string;
  name: string; // e.g., "Chase Checking", "Fidelity Brokerage", "Primary Residence"
  category: AssetCategory;
  institution?: string; // e.g., "Chase", "Fidelity", "Self-Custody"
  balance: number; // Total value. If holdings exist, this is the sum of their values.
  holdings?: Holding[];
}

export interface Conversation {
  id: string;
  userText: string;
  aiText: string;
  timestamp: string; // ISO string
}

export interface FinanceData {
    transactions: Transaction[];
    accounts: Account[];
    conversationHistory: Conversation[];
    lastUpdated: string; // ISO string for sync logic
}