import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, FinanceData, Account, AssetCategory, Conversation } from '../types';

function getApiKey(): string | null {
    try {
        return localStorage.getItem('finTrackGeminiApiKey');
    } catch {
        return null;
    }
}

const getAiInstance = () => {
    const apiKey = getApiKey();
    if (!apiKey) return null;
    return new GoogleGenAI({ apiKey });
};

const assetCategories: AssetCategory[] = ['Bank Accounts', 'Equities', 'Bonds', 'Crypto', 'Commodities', 'Real Estate'];

const getSchemas = (categories: string[]) => {
    const transactionSchema = {
        type: Type.OBJECT,
        properties: {
            date: { type: Type.STRING, description: "The date of the transaction in YYYY-MM-DD format. Today's date is " + new Date().toISOString().split('T')[0] },
            description: { type: Type.STRING, description: "A concise description of the transaction." },
            amount: { type: Type.NUMBER, description: "Transaction amount. Negative for expenses, positive for income." },
            category: { type: Type.STRING, description: "The category of the transaction.", enum: categories },
            accountName: { type: Type.STRING, description: "The name of the bank account this transaction belongs to (e.g., 'Chase Checking'). If the account is unknown, this can be omitted." },
        },
        required: ["date", "description", "amount", "category"],
    };

    const holdingSchema = {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING, description: "Name of the individual asset, e.g., 'Apple Inc.', 'Ethereum'." },
            ticker: { type: Type.STRING, description: "Stock or crypto ticker symbol, e.g., 'AAPL', 'ETH'." },
            quantity: { type: Type.NUMBER, description: "Number of units held." },
            value: { type: Type.NUMBER, description: "Total current market value in USD." },
        },
        required: ["name", "quantity", "value"],
    };

    const accountSchema = {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING, description: "The name of the account or asset, e.g., 'Fidelity Brokerage', 'Primary Residence'." },
            category: { type: Type.STRING, description: "The category of the account.", enum: assetCategories },
            institution: { type: Type.STRING, description: "The financial institution, e.g., 'Fidelity', 'Chase', 'Self-Custody'." },
            balance: { type: Type.NUMBER, description: "Total value of the account in USD. For accounts with holdings, this should be the sum of the holdings' values." },
            holdings: {
                type: Type.ARRAY,
                description: "List of individual holdings within this account (e.g., stocks in a brokerage). Should be empty for simple accounts like bank accounts or real estate.",
                items: holdingSchema,
            }
        },
        required: ["name", "category", "balance"],
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
                description: "The number of duplicate transactions found in the file that were already present in the user's data and therefore skipped."
            }
        },
    };

    const commandResponseSchema = {
        type: Type.OBJECT,
        properties: {
            action: {
                type: Type.STRING,
                description: "If an action can be performed, specify it. Otherwise, omit.",
                enum: ['create_account', 'create_transaction', 'rename_account', 'trigger_merge_flow']
            },
            parameters: {
                type: Type.OBJECT,
                description: "Parameters for the action. Required if 'action' is present.",
                properties: {
                    // For rename_account
                    oldName: { type: Type.STRING, description: "The current name of the account to be renamed." },
                    newName: { type: Type.STRING, description: "The new name for the account." },
                    // For create_transaction
                    date: { type: Type.STRING, description: "Transaction date in YYYY-MM-DD format." },
                    description: { type: Type.STRING, description: "Transaction description." },
                    amount: { type: Type.NUMBER, description: "Transaction amount (negative for expenses)." },
                    category: { type: Type.STRING, enum: categories, description: "Transaction category." },
                    accountName: { type: Type.STRING, description: "Optional: The account name for the transaction." },
                    // For create_account
                    accounts: {
                        type: Type.ARRAY,
                        description: "For the 'create_account' action. A list containing one or more accounts to be created or updated. Use this for requests like 'create a new account' or 'I bought an asset'.",
                        items: accountSchema,
                    }
                }
            },
            ai_response: {
                type: Type.STRING,
                description: "A friendly, conversational response for the user. This is always required."
            }
        },
        required: ['ai_response']
    };

    return { fileParseSchema, commandResponseSchema };
}


export const parseFileWithAI = async (file: File, prompt: string, categories: string[], existingTransactions: Transaction[]): Promise<{ transactions: Transaction[], accounts: Omit<Account, 'id'>[], duplicates_found: number }> => {
    const ai = getAiInstance();
    if (!ai) {
        throw new Error("Gemini API Key not set. Please add it in your Profile page.");
    }

    const { fileParseSchema } = getSchemas(categories);
    
    const fileToGenerativePart = (file: File) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve({ inlineData: { mimeType: file.type, data: (reader.result as string).split(',')[1] } });
            reader.onerror = (error) => reject(error);
        });
    };

    const recentTransactions = existingTransactions.slice(0, 200); // Limit to most recent 200 to manage token count
    const existingTransactionsSummary = recentTransactions.length > 0
        ? recentTransactions.map(t => `Date: ${t.date}, Amount: ${t.amount}, Desc: ${t.description.substring(0, 50)}`).join('\n')
        : "No existing transactions.";

    const userPrompt = `You are an intelligent financial data extraction AI. Your task is to analyze the provided financial document and extract transactions.

**CRITICAL INSTRUCTIONS:**

1.  **Duplicate Detection**: Below is a summary of transactions already in the user's records. You **MUST IGNORE and NOT EXTRACT** any transaction from the file that is a duplicate of an existing one. A duplicate has the exact same \`date\`, \`amount\`, and a very similar \`description\`.
2.  **Count Duplicates**: You **MUST** count how many duplicates you identified and skipped. Return this number in the \`duplicates_found\` field of your JSON response.
3.  **Single Account Focus**: Assume the entire file represents one single financial account. Create one 'Account' object for it.
4.  **Transaction Linking**: For every new transaction you extract, you **MUST** set its \`accountName\` field to be the exact name of the account you created.
5.  **Categorization**: Use this list for categories: ${categories.join(', ')}. Aggressively avoid using 'Other'.

**User Context/Hints**: ${prompt || 'No specific instructions.'}
**Date Context**: Today is ${new Date().toISOString().split('T')[0]}.

**Existing Transactions Summary (to check for duplicates):**
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

        const transactions = (parsedObject.transactions || []).map((t: any) => ({
            ...t,
            id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        })).filter((t: any) => t.date && t.description && typeof t.amount === 'number' && t.category);

        const accounts = (parsedObject.accounts || []).filter((a: any) => a.name && a.category && typeof a.balance === 'number');

        const duplicates_found = parsedObject.duplicates_found || 0;

        return { transactions, accounts, duplicates_found };

    } catch (error) {
        console.error("Error parsing file with AI:", error);
        throw new Error("AI processing failed. Please check your API Key and ensure the uploaded file is a clear document (CSV, image, or PDF).");
    }
};

export const processUserCommand = async (query: string, financeData: { transactions: Transaction[], accounts: Account[], transactionCategories: string[] }, conversationHistory: Omit<Conversation, 'id' | 'timestamp'>[]): Promise<any> => {
    const ai = getAiInstance();
    if (!ai) {
        return { ai_response: "I can't help with that because the Gemini API Key is not set. Please add it on the Profile page." };
    }
    
    const { accounts, transactionCategories } = financeData;
    const { commandResponseSchema } = getSchemas(transactionCategories);
    const accountNames = accounts.map(a => a.name);

    const recentHistory = conversationHistory.slice(0, 5).reverse(); // last 5 turns, oldest first
    const historyString = recentHistory.length > 0 
        ? recentHistory.map(c => `User: ${c.userText}\nFin: ${c.aiText}`).join('\n\n')
        : "No recent conversation history.";

    const systemInstruction = `
        You are Fin, a powerful and helpful AI financial assistant for the 'FinTrack' app. Your goal is to help users manage their finances by understanding their requests and translating them into actions or informative answers.
        Current Date: ${new Date().toISOString().split('T')[0]}

        Your Capabilities:
        1.  **Answer Questions**: Provide insights based on the user's financial data.
        2.  **Perform Actions**: Execute commands within the app.

        Available Actions & Their Parameters:
        - \`create_account\`: For creating a new account or adding/updating assets (stocks, crypto).
        - \`create_transaction\`: For simple expense/income tracking.
        - \`rename_account\`: To change an account's name.
        - \`trigger_merge_flow\`: Use this when the user wants to merge, combine, or consolidate accounts. This action has no parameters and will open a selection dialog in the app.

        User's Financial Context:
        - Current Account Names: ${JSON.stringify(accountNames)}
        - Asset Categories: ${JSON.stringify(assetCategories)}
        - Transaction Categories: ${JSON.stringify(transactionCategories)}

        **Conversational Context (Recent History):**
        ---
        ${historyString}
        ---

        Interaction Rules:
        - ALWAYS provide a friendly 'ai_response'.
        - Use the conversational context to understand follow-up questions and pronouns.
        - If you trigger \`trigger_merge_flow\`, your \`ai_response\` should be something like "Of course, I can help with that. Please select the accounts you'd like to merge."
        - If an account name in a 'create_account' action already exists, it will be updated.
        - If a request is ambiguous, ask for clarification in your 'ai_response' and do not return an action.
        - Your final output must be a single JSON object matching the provided schema.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: query,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: commandResponseSchema
            }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error("Error processing user command:", error);
        console.error("Failing query:", query);
        return { ai_response: "I couldn't connect to the AI service. Please check that your API Key is correct and your internet connection is stable." };
    }
};