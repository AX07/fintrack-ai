import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, FinanceData, Account, AssetCategory, Conversation, Currency } from '../types';
import { getGeminiApiKey } from '../hooks/useApiKey';

const getAiInstance = () => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        console.error("Gemini API key not found in localStorage.");
        return null;
    }
    return new GoogleGenAI({ apiKey });
};

const assetCategories: AssetCategory[] = ['Bank Accounts', 'Equities', 'Bonds', 'Crypto', 'Commodities', 'Real Estate'];
const supportedCurrencies: Currency[] = ['USD', 'EUR', 'GBP'];

const getSchemas = (categories: string[]) => {
    const transactionSchema = {
        type: Type.OBJECT,
        properties: {
            date: { type: Type.STRING, description: "The date of the transaction in YYYY-MM-DD format. Today's date is " + new Date().toISOString().split('T')[0] },
            description: { type: Type.STRING, description: "A concise, cleaned-up description of the transaction. e.g., 'UBER EATS US HELP.UBER.COM' should become 'Uber Eats'." },
            amount: { type: Type.NUMBER, description: "Transaction amount. MUST be negative for expenses, positive for income." },
            currency: { type: Type.STRING, description: "The original 3-letter ISO currency code of the transaction (e.g., 'USD', 'EUR', 'GBP').", enum: supportedCurrencies },
            category: { type: Type.STRING, description: "The category of the transaction.", enum: categories },
            accountName: { type: Type.STRING, description: "The name of the bank account this transaction belongs to (e.g., 'Chase Checking'). If the account is unknown, this can be omitted." },
        },
        required: ["description", "amount", "currency"],
    };

    const holdingSchema = {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING, description: "Name of the individual asset, e.g., 'Apple Inc.', 'Ethereum'." },
            ticker: { type: Type.STRING, description: "Stock or crypto ticker symbol, e.g., 'AAPL', 'ETH'." },
            quantity: { type: Type.NUMBER, description: "Number of units held." },
            value: { type: Type.NUMBER, description: "Total current market value." },
            currency: { type: Type.STRING, description: "The currency of the holding's value.", enum: supportedCurrencies },
        },
        required: ["name", "quantity", "value", "currency"],
    };

    const accountSchema = {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING, description: "The name of the account or asset, e.g., 'Fidelity Brokerage', 'Primary Residence'." },
            category: { type: Type.STRING, description: "The category of the account.", enum: assetCategories },
            institution: { type: Type.STRING, description: "The financial institution, e.g., 'Fidelity', 'Chase', 'Self-Custody'." },
            balance: { type: Type.NUMBER, description: "Total value of the account. For accounts with holdings, this should be the sum of the holdings' values." },
            currency: { type: Type.STRING, description: "The currency of the account's balance.", enum: supportedCurrencies },
            holdings: {
                type: Type.ARRAY,
                description: "List of individual holdings within this account. Should be empty for simple accounts like bank accounts.",
                items: holdingSchema,
            }
        },
        required: ["name", "category", "balance", "currency"],
    };

    const fileParseSchema = {
        type: Type.OBJECT,
        properties: {
            transactions: {
                type: Type.ARRAY,
                description: "List of financial transactions. Empty if none are found.",
                items: transactionSchema,
            },
            accounts: {
                type: Type.ARRAY,
                description: "List of financial accounts or assets. Empty if none are found.",
                items: accountSchema,
            },
            duplicates_found: {
                type: Type.NUMBER,
                description: "The number of duplicate transactions found in the file that were already present and therefore skipped."
            }
        },
    };

    const commandResponseSchema = {
        type: Type.OBJECT,
        properties: {
            action: {
                type: Type.STRING,
                description: "If an action can be performed, specify it. Otherwise, omit.",
                enum: ['create_account', 'stage_transaction', 'rename_account', 'trigger_merge_flow', 'update_transaction', 'delete_transaction']
            },
            parameters: {
                type: Type.OBJECT,
                description: "Parameters for the action. Required if 'action' is present.",
                properties: {
                    // General
                    oldName: { type: Type.STRING }, newName: { type: Type.STRING },
                    transactionId: { type: Type.STRING },
                    // Create Transaction / Stage Transaction
                    date: { type: Type.STRING }, description: { type: Type.STRING, description: "A concise, cleaned-up description for the transaction." }, amount: { type: Type.NUMBER },
                    currency: { type: Type.STRING, enum: supportedCurrencies, description: "The original 3-letter ISO currency code for the transaction." },
                    category: { type: Type.STRING, enum: categories },
                    accountName: { type: Type.STRING },
                    accounts: { type: Type.ARRAY, items: accountSchema },
                    // Update Transaction
                    updates: {
                        type: Type.OBJECT,
                        properties: {
                            date: { type: Type.STRING }, description: { type: Type.STRING }, amount: { type: Type.NUMBER }, category: { type: Type.STRING }
                        }
                    }
                }
            },
            ai_response: { type: Type.STRING, description: "A friendly, conversational response for the user. This is always required." }
        },
        required: ['ai_response']
    };

    return { fileParseSchema, commandResponseSchema, transactionSchema };
}

type ParsedTransaction = Omit<Transaction, 'id' | 'amount'> & { originalAmount: { value: number; currency: Currency }};
type ParsedAccount = Omit<Account, 'id' | 'balance'> & { balance: number, currency: Currency };

export const parseFileWithAI = async (file: File, prompt: string, categories: string[], existingTransactions: Transaction[]): Promise<{ transactions: ParsedTransaction[], accounts: ParsedAccount[], duplicates_found: number }> => {
    const ai = getAiInstance();
    if (!ai) throw new Error("AI Service is not configured. Please add your Gemini API key.");

    const { fileParseSchema } = getSchemas(categories);
    
    const fileToGenerativePart = (file: File) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve({ inlineData: { mimeType: file.type, data: (reader.result as string).split(',')[1] } });
        reader.onerror = (error) => reject(error);
    });

    const recentTransactions = existingTransactions.slice(0, 200);
    const existingTransactionsSummary = recentTransactions.length > 0 ? recentTransactions.map(t => `Date: ${t.date}, Amount: ${t.amount.toFixed(2)} USD, Desc: ${t.description.substring(0, 50)}`).join('\n') : "No existing transactions.";

    const userPrompt = `You are an intelligent financial data extraction AI. Your task is to analyze the provided financial document (which could be an image of a bank statement, a brokerage portfolio, or a text file like a CSV). The application will handle ALL currency conversions; your job is to extract the original data with perfect accuracy.

**CRITICAL INSTRUCTIONS:**

1.  **Currency and Amount Precision**: You MUST accurately extract the original transaction amount and its currency (e.g., €, £, $). In your response, you MUST provide the original 3-letter currency code ('USD', 'EUR', 'GBP'). If a document clearly uses a single currency for all items, apply it to all transactions. If no currency is obvious from the document, default to 'USD'.
2.  **Description Cleanup**: Clean transaction descriptions to be clear and concise. Remove extraneous codes or prefixes. For example, "CHKPUR_1234 SPOTIFY AB" should become "Spotify Subscription", and "SQ *BLUE BOTTLE COFFEE" should become "Blue Bottle Coffee".
3.  **Expense Amounts**: For any expense, purchase, or payment, the \`amount\` field MUST be a negative number.
4.  **Duplicate Detection**: Below is a summary of transactions already logged (in USD). You MUST IGNORE any transaction from the file that is a duplicate. A duplicate has the same date, amount, and similar description.
5.  **Count Duplicates**: You MUST count how many duplicates you identified and skipped and return this in the \`duplicates_found\` field.
6.  **Single Account Focus**: Assume the entire file represents one single financial account. Create one 'Account' object for it and set its currency.
7.  **Transaction Linking**: For every new transaction you extract, you MUST set its \`accountName\` field to be the exact name of the account you created.
8.  **Categorization**: Use this list for categories: ${categories.join(', ')}.

**User Context**: ${prompt || 'No specific instructions.'}
**Date Context**: Today is ${new Date().toISOString().split('T')[0]}.

**Existing Transactions Summary (in USD for duplicate checking):**
---
${existingTransactionsSummary}
---`;

    const filePart = await fileToGenerativePart(file);

    try {
        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: userPrompt }, filePart] },
            config: { responseMimeType: "application/json", responseSchema: fileParseSchema }
        });
        const parsedObject = JSON.parse(result.text.trim());
        const transactions: ParsedTransaction[] = (parsedObject.transactions || []).map((t: any) => ({
            date: t.date,
            description: t.description,
            category: t.category,
            accountName: t.accountName,
            originalAmount: { value: t.amount, currency: t.currency || 'USD' }
        })).filter((t: any) => t.date && t.description && typeof t.originalAmount.value === 'number' && t.category);

        const accounts: ParsedAccount[] = (parsedObject.accounts || []).map((a: any) => ({
            name: a.name,
            category: a.category,
            institution: a.institution,
            balance: a.balance,
            currency: a.currency || 'USD',
            holdings: a.holdings
        })).filter((a: any) => a.name && a.category && typeof a.balance === 'number');

        return { transactions, accounts, duplicates_found: parsedObject.duplicates_found || 0 };
    } catch (error) {
        console.error("Error parsing file with AI:", error);
        throw new Error("AI processing failed. Check your API key and file clarity.");
    }
};

export const parseImageWithAI = async (file: File, categories: string[]): Promise<Partial<ParsedTransaction> | null> => {
    const ai = getAiInstance();
    if (!ai) throw new Error("AI Service is not configured. Please add your Gemini API key.");

    const { transactionSchema } = getSchemas(categories);
    
    const fileToGenerativePart = (file: File) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve({ inlineData: { mimeType: file.type, data: (reader.result as string).split(',')[1] } });
        reader.onerror = (error) => reject(error);
    });

    const userPrompt = `You are an expert receipt parsing AI. Analyze the provided image of a receipt or bill. Your goal is to extract the key information to create a single transaction record.

**CRITICAL INSTRUCTIONS:**
1.  **Identify the Merchant**: Find the name of the store, restaurant, or vendor. Use this for the transaction 'description'.
2.  **Find the Final Total**: Locate the total amount paid. This is often labeled 'Total', 'Grand Total', or 'Amount Paid'. This is the 'amount' for the transaction.
3.  **Amount is an Expense**: The extracted amount MUST be a negative number, as it represents an expense.
4.  **Detect Currency**: Identify the currency from symbols (€, £, $) or text. Use the 3-letter code ('USD', 'EUR', 'GBP'). Default to 'USD' if unclear.
5.  **Find the Date**: Extract the transaction date. If the year isn't present, assume the current year. Today's date is ${new Date().toISOString().split('T')[0]}. If you absolutely cannot find a date, you may omit it.
6.  **Categorize**: Based on the merchant, choose the most appropriate category from this list: ${categories.join(', ')}. If unsure, use 'Other'. If you cannot determine the category at all, you can omit it.
7.  **Single Transaction**: Return only ONE transaction object for the entire bill. Do not itemize.`;

    const imagePart = await fileToGenerativePart(file);

    try {
        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: userPrompt }, imagePart] },
            config: { responseMimeType: "application/json", responseSchema: transactionSchema }
        });
        const t = JSON.parse(result.text.trim());
        if (t.description && typeof t.amount === 'number') {
            return {
                date: t.date,
                description: t.description,
                category: t.category,
                originalAmount: { value: t.amount, currency: t.currency || 'USD' }
            };
        }
        return null;
    } catch (error) {
        console.error("Error parsing image with AI:", error);
        throw new Error("AI processing failed for the image. Please ensure it's a clear photo of a receipt.");
    }
};

export const processUserCommand = async (query: string, financeData: { transactions: Transaction[], accounts: Account[], transactionCategories: string[], settings: { displayCurrency: Currency } }, conversationHistory: Omit<Conversation, 'id' | 'timestamp'>[]): Promise<any> => {
    const ai = getAiInstance();
    if (!ai) return { ai_response: "Please add your Gemini API key in the Profile & Settings page." };
    
    const { accounts, transactions, transactionCategories, settings } = financeData;
    const { commandResponseSchema } = getSchemas(transactionCategories);
    const accountNames = accounts.map(a => a.name);
    const bankAccountNames = accounts.filter(a => a.category === 'Bank Accounts').map(a => a.name);

    const recentTransactionsSummary = transactions.slice(0, 10).map(t => `ID: ${t.id}, Date: ${t.date}, Desc: ${t.description}, Amt: ${t.amount.toFixed(2)}, Cat: ${t.category}`).join('\n');

    const systemInstruction = `
        You are Fin, a helpful AI financial assistant. Current Date: ${new Date().toISOString().split('T')[0]}. The user's display currency is ${settings.displayCurrency}.

        **Currency & Amount Rules:**
        - Your primary goal is to extract the original amount and its currency from the user's text. The application will handle any necessary conversions.
        - You MUST detect currency from words ("euros", "pounds", "dollars"), symbols ("€", "£", "$"), or ISO codes ("EUR", "GBP", "USD").
        - In your response parameters, ALWAYS use the 3-letter currency code.
        - **If no currency is mentioned, DEFAULT TO 'USD'.**
        - For any expense, purchase, or payment, the \`amount\` field in your parameters MUST be a negative number. This is critical. For example, "spent 10 euros on coffee" should result in \`amount: -10\` and \`currency: "EUR"\`. "got paid £500" should be \`amount: 500\` and \`currency: "GBP"\`.

        User's Financial Context (all values are in USD):
        - All Account Names: ${JSON.stringify(accountNames)}
        - Bank Account Names: ${JSON.stringify(bankAccountNames)}
        - Transaction Categories: ${JSON.stringify(transactionCategories)}
        - 10 Most Recent Transactions (for correction context):
          ${recentTransactionsSummary || 'None'}

        **Interaction Rules:**
        - ALWAYS provide a friendly 'ai_response'.
        - When creating a transaction, make the description meaningful. For "bought a sandwich", a good description is "Sandwich". For "paid my netflix bill", use "Netflix Subscription".
        - When asked for a financial overview, you MUST provide a detailed, insightful response. Do not give a generic response.
        - When the user asks to merge accounts, you MUST use the \`trigger_merge_flow\` action. DO NOT ask for account names.
        
        - **CRITICAL Action Rule**: When you identify a user describing a new transaction (e.g., "spent $10 on lunch", "got paid 500 eur"), you MUST use the \`stage_transaction\` action. Provide all the transaction properties you can extract in the \`parameters\`. The application will then show a confirmation dialog to the user. Do not ask clarifying questions in your text response; let the app's UI handle it.

        - If the user reports a mistake with a recent transaction, use the transaction list above to identify the correct \`transactionId\` and use the \`update_transaction\` or \`delete_transaction\` action to fix it.
        - Your final output must be a single JSON object matching the schema.
    `;

    const historyForModel = conversationHistory
        .slice(0, 5) // Take last 5 conversations (which are newest)
        .reverse() // Order them from oldest to newest for the model
        .flatMap(turn => [
            { role: 'user' as const, parts: [{ text: turn.userText }] },
            { role: 'model' as const, parts: [{ text: turn.aiText }] }
        ]);

    const contents = [
        ...historyForModel,
        { role: 'user' as const, parts: [{ text: query }] }
    ];

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents, // Use the full conversation context
            config: { 
                systemInstruction, 
                responseMimeType: "application/json", 
                responseSchema: commandResponseSchema,
                thinkingConfig: { thinkingBudget: 0 } 
            }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error("Error processing user command:", error);
        return { ai_response: "I couldn't connect to the AI service. Please check your API key and internet connection." };
    }
};
