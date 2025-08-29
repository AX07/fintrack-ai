

export type Currency = 'USD' | 'EUR' | 'GBP';

export interface Settings {
    displayCurrency: Currency;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
}

export type TransactionCategory = string;
export const defaultTransactionCategories: TransactionCategory[] = ['Income', 'Food', 'Transport', 'Rent', 'Utilities', 'Health', 'Entertainment', 'Business', 'Investment', 'Crypto', 'Other'];

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // Stored in base currency (USD)
  category: TransactionCategory;
  accountName?: string;
  originalAmount?: { // Optional: to preserve original entry
      value: number;
      currency: Currency;
  }
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
    price: number; // Current market price per unit, in base currency (USD)
    value: number; // Total current market value, in base currency (USD) (quantity * price)
    apiId?: string; // For linking to external price APIs, e.g., 'bitcoin', 'apple'
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
  balance: number; // Total value, in base currency (USD). If holdings exist, this is the sum of their values.
  holdings?: Holding[];
}

export interface Conversation {
  id: string;
  userText: string;
  aiText: string;
  timestamp: string; // ISO string
}

export interface FinanceData {
    settings: Settings;
    transactions: Transaction[];
    accounts: Account[];
    conversationHistory: Conversation[];
    transactionCategories: TransactionCategory[];
    lastUpdated: string; // ISO string for sync logic
    pendingFileForAI?: File | null; // For transient state, not persisted
    aiProcessingStatus: { // For global AI task notifications
        isProcessing: boolean;
        message: string;
    }
}

export interface SyncPayload {
    user: User;
    financeData: FinanceData;
    geminiApiKey: string | null;
}

// From marketDataService, for Explore page
export interface MarketAsset {
    apiId: string;
    name: string;
    ticker: string;
    price: number; // Price is always in USD
    change24h: number; // Percentage change
    type: 'Crypto' | 'Equities';
}

export interface AppNotification {
    id: string;
    source: string; // e.g., "Google Pay", "Chase Bank"
    description: string;
    amount: number;
    currency: Currency;
    timestamp: string;
    read: boolean;
}