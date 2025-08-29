import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useFinance, useCurrency } from '../hooks/useFinance';
import { processUserCommand, parseFileWithAI, parseImageWithAI } from '../services/geminiService';
import { SendIcon, SparklesIcon, PaperclipIcon } from '../components/Icons';
import { Transaction, Account, Currency } from '../types';
import Card from '../components/Card';
import { useGeminiApiKey } from '../hooks/useApiKey';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
}

type ModalTransaction = Partial<Omit<Transaction, 'id' | 'amount'>> & {
    originalAmount?: { value: number; currency: Currency };
};

type FileType = 'receipt' | 'statement' | 'portfolio';

export const AIPage: React.FC = () => {
  const { transactions, accounts, transactionCategories, addTransaction, addMultipleTransactions, addAccounts, addConversation, renameAccount, mergeAccounts, updateTransaction, deleteTransaction, conversationHistory, settings, pendingFileForAI, setPendingFileForAI, setAiProcessingStatus } = useFinance();
  const { formatCurrency } = useCurrency();
  const { apiKey } = useGeminiApiKey();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mergeState, setMergeState] = useState<{ isActive: boolean; source: string | null; destination: string | null; }>({ isActive: false, source: null, destination: null });
  const [modalTransaction, setModalTransaction] = useState<ModalTransaction | null>(null);
  
  const lastUserMessage = useRef('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bankAccounts = useMemo(() => accounts.filter(a => a.category === 'Bank Accounts'), [accounts]);

  useEffect(() => {
    if (conversationHistory.length > 0) {
        const historyMessages: Message[] = conversationHistory.map(c => [{ id: `${c.id}-user`, text: c.userText, sender: 'user' as const }, { id: `${c.id}-ai`, text: c.aiText, sender: 'ai' as const }]).flat().reverse();
        setMessages(historyMessages);
    } else if (!apiKey) {
        setMessages([{ id: 'init-no-key', sender: 'ai', text: "Welcome! To activate the AI Agent, please add your Google Gemini API key in the Profile & Settings page." }]);
    } else {
        setMessages([{ id: 'init', sender: 'ai', text: "Hello! How can I help? You can describe a transaction, ask a financial question, or upload a statement." }]);
    }
  }, [conversationHistory, apiKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPendingFileForAI(file);
      // We clear the input's value to allow selecting the same file again if the user cancels.
      event.target.value = '';
    }
  };
  
  const handleProcessFile = async (type: FileType) => {
    const fileToProcess = pendingFileForAI;
    const textPrompt = input;
    
    setPendingFileForAI(null);
    setInput('');
    if (!fileToProcess) return;

    const userMessageText = `Processing ${type}: ${fileToProcess.name}${textPrompt ? ` (Prompt: ${textPrompt})` : ''}`;
    const userMessage: Message = { id: Date.now().toString(), sender: 'user', text: userMessageText };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setAiProcessingStatus({ isProcessing: true, message: `Analyzing your ${type}: ${fileToProcess.name}` });

    try {
        let aiResponseText: string = '';
        let showResponse = true;

        if (type === 'receipt') {
            const parsedTransaction = await parseImageWithAI(fileToProcess, transactionCategories);
            if (parsedTransaction) {
                 if (bankAccounts.length === 0) {
                    aiResponseText = `I analyzed the receipt, but you don't have a bank account set up to add it to. Please add one first.`;
                } else {
                    setModalTransaction(parsedTransaction);
                    showResponse = false;
                }
            } else {
                aiResponseText = "Sorry, I couldn't understand that receipt image. Please try a clearer photo.";
            }
        } else { // statement or portfolio
            const { transactions: parsedTransactions, accounts: parsedAccounts, duplicates_found } = await parseFileWithAI(fileToProcess, textPrompt, transactionCategories, transactions);
            
            if (parsedTransactions.length > 0) addMultipleTransactions(parsedTransactions);
            if (parsedAccounts.length > 0) addAccounts(parsedAccounts);

            let summary = '';
            if (parsedTransactions.length > 0) summary += `I've added ${parsedTransactions.length} new transaction(s). `;
            if (parsedAccounts.length > 0) summary += `I've created/updated the '${parsedAccounts[0].name}' account. `;
            if (duplicates_found > 0) summary += `I also skipped ${duplicates_found} duplicate transaction(s). `;
            aiResponseText = summary ? `Success! From ${fileToProcess.name}, ${summary.trim()}` : `I processed ${fileToProcess.name} but found no new information to add.`;
        }
        
        if (showResponse) {
            addConversation({ id: Date.now().toString(), userText: userMessageText, aiText: aiResponseText, timestamp: new Date().toISOString() });
            setMessages(prev => [...prev, { id: `${Date.now()}-ai`, sender: 'ai', text: aiResponseText }]);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Sorry, I couldn't process that.";
        addConversation({ id: Date.now().toString(), userText: userMessageText, aiText: errorMessage, timestamp: new Date().toISOString() });
        setMessages(prev => [...prev, { id: `${Date.now()}-ai-error`, sender: 'ai', text: errorMessage }]);
    } finally {
        setIsLoading(false);
        setAiProcessingStatus({ isProcessing: false, message: '' });
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !apiKey) return;

    const userMessageText = input.trim();
    lastUserMessage.current = userMessageText;
    const userMessage: Message = { id: Date.now().toString(), sender: 'user', text: userMessageText };
    setMessages(prev => [...prev, userMessage]);

    const textPrompt = input;
    setInput('');
    setIsLoading(true);

    try {
        const commandResponse = await processUserCommand(textPrompt, { transactions, accounts, transactionCategories, settings }, conversationHistory);
        const aiResponseText = commandResponse.ai_response;
        let showResponse = true;

        if (commandResponse.action) {
            const params = commandResponse.parameters;
            switch (commandResponse.action) {
                case 'create_account':
                    if (params?.accounts?.length > 0) addAccounts(params.accounts.map((acc: any) => ({ ...acc, currency: acc.currency || 'USD' })));
                    break;
                case 'rename_account':
                    if (params?.oldName && params?.newName) renameAccount({ oldName: params.oldName, newName: params.newName });
                    break;
                case 'trigger_merge_flow':
                    setMergeState({ isActive: true, source: null, destination: null });
                    break;
                case 'stage_transaction':
                    if (params?.amount && params?.description) {
                        setModalTransaction({
                            date: params.date,
                            description: params.description,
                            category: params.category,
                            accountName: params.accountName,
                            originalAmount: { value: params.amount, currency: params.currency || 'USD' }
                        });
                        showResponse = false;
                    }
                    break;
                case 'update_transaction':
                    if (params?.transactionId && params?.updates) updateTransaction({ id: params.transactionId, ...params.updates });
                    break;
                case 'delete_transaction':
                    if (params?.transactionId) deleteTransaction({ transactionId: params.transactionId });
                    break;
            }
        }
        
        if (showResponse) {
            const finalResponse = aiResponseText || "Sorry, I had trouble with that request.";
            addConversation({ id: Date.now().toString(), userText: userMessageText, aiText: finalResponse, timestamp: new Date().toISOString() });
            setMessages(prev => [...prev, { id: `${Date.now()}-ai`, sender: 'ai', text: finalResponse }]);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Sorry, I couldn't process that.";
        addConversation({ id: Date.now().toString(), userText: userMessageText, aiText: errorMessage, timestamp: new Date().toISOString() });
        setMessages(prev => [...prev, { id: `${Date.now()}-ai-error`, sender: 'ai', text: errorMessage }]);
    } finally {
        setIsLoading(false);
    }
  };

  const handleSaveTransactionFromModal = (transaction: Omit<Transaction, 'id' | 'amount'> & { originalAmount: { value: number, currency: Currency }}) => {
    addTransaction(transaction);
    const successText = `Okay, I've added the transaction: "${transaction.description}".`;
    addConversation({ id: Date.now().toString(), userText: lastUserMessage.current, aiText: successText, timestamp: new Date().toISOString() });
    setMessages(prev => [...prev, { id: `${Date.now()}-ai-confirm-add`, sender: 'ai', text: successText }]);
    setModalTransaction(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="hidden md:block">
        <h1 className="text-2xl sm:text-3xl font-bold">AI Agent</h1>
        <p className="text-text-secondary">Your personal finance assistant.</p>
      </div>

      {pendingFileForAI && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <Card className="max-w-md w-full">
                <h2 className="text-xl font-bold mb-2">Process File</h2>
                <p className="text-text-secondary mb-4">What kind of document is <span className="font-semibold text-text-primary">{pendingFileForAI.name}</span>?</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button onClick={() => handleProcessFile('receipt')} className="p-4 bg-secondary hover:bg-primary rounded-lg text-center font-semibold">Receipt</button>
                    <button onClick={() => handleProcessFile('statement')} className="p-4 bg-secondary hover:bg-primary rounded-lg text-center font-semibold">Bank Statement</button>
                    <button onClick={() => handleProcessFile('portfolio')} className="p-4 bg-secondary hover:bg-primary rounded-lg text-center font-semibold">Portfolio</button>
                </div>
                <div className="text-center mt-4">
                    <button onClick={() => setPendingFileForAI(null)} className="text-sm text-text-secondary hover:text-text-primary">Cancel</button>
                </div>
            </Card>
        </div>
      )}

      {mergeState.isActive && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Merge Accounts</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Merge FROM (this account will be deleted):</label>
                <select onChange={(e) => setMergeState(s => ({ ...s, source: e.target.value }))} value={mergeState.source || ''} className="w-full bg-primary border border-secondary rounded-lg px-4 py-2">
                  <option value="" disabled>Select source account...</option>
                  {accounts.map(acc => <option key={acc.id} value={acc.name}>{acc.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Merge INTO (this account will keep all data):</label>
                <select onChange={(e) => setMergeState(s => ({ ...s, destination: e.target.value }))} value={mergeState.destination || ''} className="w-full bg-primary border border-secondary rounded-lg px-4 py-2">
                  <option value="" disabled>Select destination account...</option>
                  {accounts.filter(acc => acc.name !== mergeState.source).map(acc => <option key={acc.id} value={acc.name}>{acc.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setMergeState({ isActive: false, source: null, destination: null })} className="bg-secondary hover:bg-primary font-semibold py-2 px-4 rounded-lg">Cancel</button>
              <button 
                onClick={() => {
                  if (mergeState.source && mergeState.destination) {
                    mergeAccounts({ sourceAccountName: mergeState.source, destinationAccountName: mergeState.destination });
                    setMergeState({ isActive: false, source: null, destination: null });
                    const successText = `Successfully merged '${mergeState.source}' into '${mergeState.destination}'.`;
                    setMessages(prev => [...prev, { id: `${Date.now()}-ai-merge`, sender: 'ai', text: successText }]);
                    addConversation({ id: Date.now().toString(), userText: "Merge accounts (via dialog)", aiText: successText, timestamp: new Date().toISOString() });
                  }
                }}
                disabled={!mergeState.source || !mergeState.destination || mergeState.source === mergeState.destination}
                className="bg-accent hover:opacity-90 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50"
              >
                Confirm Merge
              </button>
            </div>
          </Card>
        </div>
      )}

      {modalTransaction && (
        <CompleteTransactionModal
            transaction={modalTransaction}
            onClose={() => setModalTransaction(null)}
            onSave={handleSaveTransactionFromModal}
            bankAccounts={bankAccounts}
            transactionCategories={transactionCategories}
        />
      )}

      <Card className="flex-1 flex flex-col mt-6 overflow-hidden min-h-[70vh]">
        <div className="flex-1 overflow-y-auto pr-4 -mr-4 space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-lg p-3 rounded-2xl ${
                message.sender === 'user'
                  ? 'bg-accent text-white rounded-br-lg'
                  : 'bg-primary text-text-primary rounded-bl-lg'
              }`}>
                {message.text.split('\n').map((line, index) => <p key={index}>{line}</p>)}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-lg p-3 rounded-2xl bg-primary text-text-primary rounded-bl-lg">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 animate-pulse" />
                  <span>Thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="mt-6 border-t border-secondary pt-4">
          <form onSubmit={handleSendMessage} className="flex items-center gap-3">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,text/csv,application/pdf,.txt" />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="p-2 text-text-secondary hover:text-accent rounded-full hover:bg-secondary disabled:opacity-50">
                <PaperclipIcon className="w-6 h-6" />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={!apiKey ? "Please add your API key..." : "e.g., I spent $15 on coffee"}
              disabled={isLoading || !apiKey}
              className="flex-1 bg-primary border border-secondary rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
            />
            <button type="submit" disabled={!input.trim() || isLoading || !apiKey} className="p-3 bg-accent text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
              <SendIcon className="w-5 h-5" />
            </button>
          </form>
           {!apiKey && <p className="text-xs text-negative-text text-center mt-2">AI Agent is disabled. <Link to="/profile" className="underline hover:text-accent">Add your Gemini API key</Link> to activate.</p>}
        </div>
      </Card>
    </div>
  );
};

interface CompleteTransactionModalProps {
    transaction: ModalTransaction;
    onClose: () => void;
    onSave: (transaction: Omit<Transaction, 'id' | 'amount'> & { originalAmount: { value: number, currency: Currency }}) => void;
    bankAccounts: Account[];
    transactionCategories: string[];
}

const CompleteTransactionModal: React.FC<CompleteTransactionModalProps> = ({ transaction, onClose, onSave, bankAccounts, transactionCategories }) => {
    const [formData, setFormData] = useState({
        date: '',
        description: '',
        amount: '',
        currency: 'USD' as Currency,
        category: '',
        accountName: '',
    });

    useEffect(() => {
        setFormData({
            date: transaction.date || new Date().toISOString().split('T')[0],
            description: transaction.description || '',
            amount: transaction.originalAmount?.value?.toString() || '',
            currency: transaction.originalAmount?.currency || 'USD',
            category: transaction.category || transactionCategories.find(c => c.toLowerCase() === 'other') || transactionCategories[0] || '',
            accountName: transaction.accountName || (bankAccounts.length === 1 ? bankAccounts[0].name : ''),
        });
    }, [transaction, bankAccounts, transactionCategories]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const amountValue = parseFloat(formData.amount);
        if (!formData.date || !formData.description || isNaN(amountValue) || !formData.category || !formData.accountName) {
            alert("Please fill out all fields.");
            return;
        }

        onSave({
            date: formData.date,
            description: formData.description,
            category: formData.category,
            accountName: formData.accountName,
            originalAmount: { value: amountValue, currency: formData.currency }
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <Card className="max-w-lg w-full">
                <h2 className="text-xl font-bold mb-2">Complete & Confirm Transaction</h2>
                <p className="text-text-secondary mb-6">Please review and complete the details below.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-text-secondary mb-1">Description</label>
                        <input id="description" name="description" type="text" value={formData.description} onChange={handleChange} className="w-full bg-primary border border-secondary rounded-lg px-4 py-2" required />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-2">
                             <label htmlFor="amount" className="block text-sm font-medium text-text-secondary mb-1">Amount</label>
                             <input id="amount" name="amount" type="number" step="0.01" value={formData.amount} onChange={handleChange} placeholder="e.g., -12.50" className="w-full bg-primary border border-secondary rounded-lg px-4 py-2" required />
                        </div>
                        <div>
                            <label htmlFor="currency" className="block text-sm font-medium text-text-secondary mb-1">Currency</label>
                            <select id="currency" name="currency" value={formData.currency} onChange={handleChange} className="w-full bg-primary border border-secondary rounded-lg px-4 py-2" required>
                                <option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="date" className="block text-sm font-medium text-text-secondary mb-1">Date</label>
                        <input id="date" name="date" type="date" value={formData.date} onChange={handleChange} className="w-full bg-primary border border-secondary rounded-lg px-4 py-2" required />
                    </div>
                    <div>
                        <label htmlFor="category" className="block text-sm font-medium text-text-secondary mb-1">Category</label>
                        <select id="category" name="category" value={formData.category} onChange={handleChange} className="w-full bg-primary border border-secondary rounded-lg px-4 py-2" required>
                             {transactionCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="accountName" className="block text-sm font-medium text-text-secondary mb-1">Account</label>
                        <select id="accountName" name="accountName" value={formData.accountName} onChange={handleChange} className="w-full bg-primary border border-secondary rounded-lg px-4 py-2" required>
                            <option value="" disabled>Select an account...</option>
                             {bankAccounts.map(acc => <option key={acc.id} value={acc.name}>{acc.name}</option>)}
                        </select>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="bg-secondary hover:bg-primary font-semibold py-2 px-4 rounded-lg">Cancel</button>
                        <button type="submit" className="bg-accent hover:opacity-90 text-white font-semibold py-2 px-4 rounded-lg">Save Transaction</button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default AIPage;
