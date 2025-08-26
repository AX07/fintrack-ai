
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, TransactionCategory, FinanceData, Account, AssetCategory, Holding, transactionCategories } from '../types';

if (!process.env.API_KEY) {
    console.warn("API_KEY environment variable not set. AI features will not work.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || " " });

const assetCategories: AssetCategory[] = ['Bank Accounts', 'Equities', 'Bonds', 'Crypto', 'Commodities', 'Real Estate'];

const transactionSchema = {
    type: Type.OBJECT,
    properties: {
        date: { type: Type.STRING, description: "The date of the transaction in YYYY-MM-DD format. Today's date is " + new Date().toISOString().split('T')[0] },
        description: { type: Type.STRING, description: "A concise description of the transaction." },
        amount: { type: Type.NUMBER, description: "Transaction amount. Negative for expenses, positive for income." },
        category: { type: Type.STRING, description: "The category of the transaction.", enum: transactionCategories },
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
        }
    },
};

const commandResponseSchema = {
    type: Type.OBJECT,
    properties: {
        action: {
            type: Type.STRING,
            description: "If an action can be performed, specify it. Otherwise, omit.",
            enum: ['create_account', 'create_transaction', 'rename_account']
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
                category: { type: Type.STRING, enum: transactionCategories, description: "Transaction category." },
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

export const parseFileWithAI = async (file: File, prompt: string): Promise<{ transactions: Transaction[], accounts: Omit<Account, 'id'>[] }> => {
    const fileToGenerativePart = (file: File) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve({ inlineData: { mimeType: file.type, data: (reader.result as string).split(',')[1] } });
            reader.onerror = (error) => reject(error);
        });
    };

    const userPrompt = `You are an expert financial data parser. Your task is to analyze the provided financial statement (CSV, PDF, or image) and extract both the transactions and the single account they belong to.

Your response MUST be a single JSON object containing 'transactions' and 'accounts' arrays.

**Critical Instructions:**

1.  **Single Account Focus**: Assume the entire file represents **one single financial account**.
2.  **Account Creation/Identification**:
    -   You **MUST** create one (and only one) 'Account' object in the \`accounts\` array.
    -   **Name**: Infer a descriptive name for the account (e.g., "Chase Checking", "Amex Gold Card"). Use the user's prompt for hints if available.
    -   **Category**: For transaction statements, this will almost always be 'Bank Accounts'.
    -   **Balance**: Look for a 'closing balance', 'ending balance', or 'current balance' in the file. This is the most important value. If you absolutely cannot find one, calculate the balance by summing up all the transactions in the file.
    -   **Institution**: Identify the financial institution (e.g., 'Chase', 'American Express').
3.  **Transaction Extraction**:
    -   Extract all individual financial events into the \`transactions\` array.
    -   Use negative amounts for expenses and positive for income.
    -   Categorize each transaction appropriately from this list: ${transactionCategories.join(', ')}.
4.  **Linking**:
    -   This is **ESSENTIAL**: For every single transaction you extract, you **MUST** set its \`accountName\` field to be the exact same name as the account you created in the \`accounts\` array. This links the transactions to their account.

**User Context/Hints**: ${prompt || 'No specific instructions. Please infer account name from the file content.'}
**Date Context**: Today is ${new Date().toISOString().split('T')[0]}.

Example Scenario: User uploads a Chase bank statement CSV.
Your output should be a JSON with:
- \`accounts\`: An array with ONE object, e.g., \`{ "name": "Chase Freedom Checking", "category": "Bank Accounts", "balance": 4582.11, "institution": "Chase" }\`.
- \`transactions\`: An array of all transactions from the statement, where every single transaction has \`accountName: "Chase Freedom Checking"\`.`;

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

        return { transactions, accounts };

    } catch (error) {
        console.error("Error parsing file with AI:", error);
        throw new Error("Failed to process the file. Ensure it's a clear document (CSV, image, or PDF).");
    }
};

export const processUserCommand = async (query: string, financeData: { transactions: Transaction[], accounts: Account[] }): Promise<any> => {
    const { accounts } = financeData;
    const accountNames = accounts.map(a => a.name);

    const systemInstruction = `
        You are Fin, a powerful and helpful AI financial assistant for the 'FinTrack' app. Your goal is to help users manage their finances by understanding their requests and translating them into actions or informative answers.
        Current Date: ${new Date().toISOString().split('T')[0]}

        Your Capabilities:
        1.  **Answer Questions**: Provide insights based on the user's financial data. If you need data, you must mention you don't have access to it as context is limited.
        2.  **Perform Actions**: Execute commands within the app.

        Available Actions & Their Parameters:
        - \`create_account\`: Use when the user wants to create a new account OR when they mention buying/selling an asset (stock, crypto, commodity) in an account. This is the primary action for managing assets.
            - Requires: \`accounts\` (an array containing at least one account object).
            - The account object should contain: \`name\`, \`category\`, \`balance\`, and optionally \`institution\` and \`holdings\`.
            - When a user says "I bought 1oz of gold for $3000 in my eToro account", you should:
                1. Check if 'eToro' exists in the 'Current Account Names'.
                2. If it exists, you will update it. If not, you will create it.
                3. Construct an 'account' object like: \`{ "name": "eToro", "category": "Commodities", "balance": 3000, "holdings": [{ "name": "Gold", "quantity": 1, "value": 3000 }] }\`.
                4. The \`balance\` MUST be the total value of all holdings if they exist. If no holdings, it's a simple balance.
        - \`create_transaction\`: Use ONLY for simple expense/income tracking, like "spent $5 on coffee". Do NOT use it for asset purchases that should be tracked as holdings.
            - Requires: \`date\`, \`description\`, \`amount\` (negative for expenses), \`category\`.
        - \`rename_account\`: Use when the user explicitly wants to change an account's name.
            - Requires: \`oldName\`, \`newName\`.

        User's Financial Context:
        - Current Account Names: ${JSON.stringify(accountNames)}
        - Asset Categories: ${JSON.stringify(assetCategories)}

        Interaction Rules:
        - ALWAYS provide a friendly 'ai_response' for the user. This is your communication channel.
        - Prioritize using \`create_account\` for any mention of assets, stocks, crypto, etc. to ensure they are tracked correctly as holdings.
        - For 'rename_account', 'oldName' MUST EXACTLY MATCH (case-insensitive) an existing account name.
        - For 'create_account', if the account name mentioned by the user already exists, your generated account object will be used to UPDATE the existing one (e.g., adding a new holding).
        - If a request is ambiguous, ask for clarification in your 'ai_response' and do not return an action. For example, if a price is missing for an asset purchase.
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
        return { ai_response: "I had some trouble processing that. Could you please try rephrasing?" };
    }
};
