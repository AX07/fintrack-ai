import { SyncPayload, FinanceData, Transaction, Account, Holding } from '../types';

// Converts the standard data format to a highly compact array-based format for efficient transfer
export const toV2Format = (data: SyncPayload) => {
    const compactTransactions = data.financeData.transactions.map(t => [
        t.id,
        t.date,
        t.description,
        t.amount,
        t.category,
        t.accountName || null
    ]);

    const compactAccounts = data.financeData.accounts.map(a => {
        const compactHoldings = a.holdings?.map(h => [
            h.id,
            h.name,
            h.ticker || null,
            h.quantity,
            h.price,
            h.value,
            h.apiId || null,
        ]) || [];
        return [
            a.id,
            a.name,
            a.category,
            a.institution || null,
            a.balance,
            compactHoldings
        ];
    });

    const compactFinanceData = {
        s: data.financeData.settings,
        t: compactTransactions,
        a: compactAccounts,
        tc: data.financeData.transactionCategories,
        lu: data.financeData.lastUpdated,
    };
    
    return {
        v: 2, // Version identifier
        u: data.user,
        d: compactFinanceData,
        gK: data.geminiApiKey, // gK for Gemini Key
    };
};

// Converts the compact array-based format back to the standard object format after transfer
export const fromV2Format = (compactData: any): SyncPayload | null => {
    try {
        const transactions: Transaction[] = compactData.d.t.map((t: any[]) => ({
            id: t[0],
            date: t[1],
            description: t[2],
            amount: t[3],
            category: t[4],
            accountName: t[5] || undefined,
        }));

        const accounts: Account[] = compactData.d.a.map((a: any[]) => {
            const holdings: Holding[] = a[5].map((h: any[]) => ({
                id: h[0],
                name: h[1],
                ticker: h[2] || undefined,
                quantity: h[3],
                price: h[4],
                value: h[5],
                apiId: h[6] || undefined,
            }));
            return {
                id: a[0],
                name: a[1],
                category: a[2],
                institution: a[3] || undefined,
                balance: a[4],
                holdings: holdings.length > 0 ? holdings : undefined,
            };
        });

        const financeData: FinanceData = {
            settings: compactData.d.s || { displayCurrency: 'USD' },
            transactions,
            accounts,
            transactionCategories: compactData.d.tc,
            lastUpdated: compactData.d.lu,
            conversationHistory: [], // History is not synced
            // FIX: Add missing 'aiProcessingStatus' property to conform to FinanceData type.
            aiProcessingStatus: { isProcessing: false, message: '' },
        };

        return {
            user: compactData.u,
            financeData: financeData,
            geminiApiKey: compactData.gK || null,
        };
    } catch (error) {
        console.error("Failed to parse V2 compact data format", error);
        return null;
    }
};