import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useFinance } from '../hooks/useFinance';
import { processUserCommand, parseFileWithAI } from '../services/geminiService';
import { SendIcon, SparklesIcon, PaperclipIcon } from '../components/Icons';
import { Transaction, Account } from '../types';
import Card from '../components/Card';
// FIX: Removed useApiKey hook as API key management is now handled by environment variables.
// import { useApiKey } from '../hooks/useApiKey';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
};

export const AIPage: React.FC = () => {
  const { transactions, accounts, transactionCategories, addTransaction, addMultipleTransactions, addAccounts, addConversation, renameAccount, mergeAccounts, conversationHistory } = useFinance();
  // FIX: Removed useApiKey hook.
  // const { apiKey } = useApiKey();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mergeState, setMergeState] = useState<{ isActive: boolean; source: string | null; destination: string | null; }>({
    isActive: false,
    source: null,
    destination: null,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // FIX: Removed logic that checked for API key. The welcome message will now always show on a clean slate.
    // Error handling for a missing key is done in the service layer.
    if (conversationHistory.length > 0) {
        const historyMessages: Message[] = conversationHistory
            .map(c => [
                { id: `${c.id}-user`, text: c.userText, sender: 'user' as const },
                { id: `${c.id}-ai`, text: c.aiText, sender: 'ai' as const }
            ])
            .flat()
            .reverse();
        setMessages(historyMessages);
    } else {
        setMessages([{ id: 'init', sender: 'ai', text: "Hello! How can I help? You can describe a transaction, ask a financial question, or upload a statement (CSV, PDF, or screenshot)." }]);
    }
  }, [conversationHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    // FIX: Removed API key check from condition.
    if ((!input.trim() && !selectedFile) || isLoading) return;

    const userMessageText = selectedFile ? `${input.trim()} (File: ${selectedFile.name})` : input.trim();
    const userMessage: Message = { id: Date.now().toString(), sender: 'user', text: userMessageText };
    setMessages(prev => [...prev, userMessage]);

    const fileToProcess = selectedFile;
    const textPrompt = input;
    
    setInput('');
    setSelectedFile(null);
    setIsLoading(true);

    try {
      let aiResponseText: string;
      if (fileToProcess) {
        const { transactions: parsedTransactions, accounts: parsedAccounts, duplicates_found } = await parseFileWithAI(fileToProcess, textPrompt, transactionCategories, transactions);
        
        const hasTransactions = parsedTransactions && parsedTransactions.length > 0;
        const hasAccounts = parsedAccounts && parsedAccounts.length > 0;

        if (hasTransactions) {
            addMultipleTransactions(parsedTransactions);
        }
        if (hasAccounts) {
            addAccounts(parsedAccounts);
        }

        let summary = '';
        if (hasTransactions) {
            summary += `I've added ${parsedTransactions.length} new transaction(s). `;
        }
        if (hasAccounts) {
            const account = parsedAccounts[0];
            summary += `I've created or updated the '${account.name}' account with a new balance of ${formatCurrency(account.balance)}. `;
        }
        if (duplicates_found > 0) {
            summary += `I also skipped ${duplicates_found} duplicate transaction(s) that were already logged. `;
        }

        if (summary) {
            aiResponseText = `Success! From ${fileToProcess.name}, ${summary.trim()}`;
        } else {
            aiResponseText = `I processed ${fileToProcess.name} but found no new information to add. It seems all transactions were duplicates.`;
        }

      } else {
        const commandResponse = await processUserCommand(textPrompt, { transactions, accounts, transactionCategories }, conversationHistory);
        aiResponseText = commandResponse.ai_response;

        if (commandResponse.action) {
            const params = commandResponse.parameters;
            switch (commandResponse.action) {
                case 'create_account':
                    if (params && params.accounts && params.accounts.length > 0) {
                        addAccounts(params.accounts);
                    } else {
                        aiResponseText = "I was ready to create an account, but the details were missing. Could you please clarify?";
                    }
                    break;
                case 'rename_account':
                    if (params && params.oldName && params.newName) {
                        renameAccount({
                            oldName: params.oldName,
                            newName: params.newName
                        });
                    } else {
                        aiResponseText = "I seem to be missing the details to rename the account. Please try again.";
                    }
                    break;
                case 'trigger_merge_flow':
                    if (params) { // Check if params exists
                        setMergeState({ isActive: true, source: null, destination: null });
                    }
                    break;
                case 'create_transaction':
                    if (params && params.amount && params.description && params.category && params.date) {
                        const newTransaction: Transaction = {
                            id: `txn-${Date.now()}`,
                            date: params.date,
                            description: params.description,
                            amount: params.amount,
                            category: params.category,
                            accountName: params.accountName,
                        };
                        addTransaction(newTransaction);
                    } else {
                        aiResponseText = "I couldn't quite get all the details for that transaction. Could you be more specific about the amount, description, and date?";
                    }
                    break;
            }
        }

        if (!aiResponseText) {
          aiResponseText = "Sorry, I had trouble with that request.";
        }
      }
      addConversation({ id: Date.now().toString(), userText: userMessageText, aiText: aiResponseText, timestamp: new Date().toISOString() });
      setMessages(prev => [...prev, { id: `${Date.now()}-ai`, sender: 'ai', text: aiResponseText }]);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Sorry, I couldn't process that.";
        addConversation({ id: Date.now().toString(), userText: userMessageText, aiText: `Error: ${errorMessage}`, timestamp: new Date().toISOString() });
        setMessages(prev => [...prev, { id: `${Date.now()}-err`, sender: 'ai', text: `Error: ${errorMessage}` }]);
    } finally {
        setIsLoading(false);
    }
  };

  const handleConfirmMerge = () => {
    if (mergeState.source && mergeState.destination) {
        mergeAccounts({ 
            sourceAccountName: mergeState.source, 
            destinationAccountName: mergeState.destination 
        });
        const confirmationText = `I have successfully merged '${mergeState.source}' into '${mergeState.destination}'.`;
        setMessages(prev => [...prev, { id: `${Date.now()}-ai-merge`, sender: 'ai', text: confirmationText }]);
        // Add to conversation history so the AI knows the action was completed
        addConversation({ id: Date.now().toString(), userText: "(User completed account merge via UI)", aiText: confirmationText, timestamp: new Date().toISOString() });
        setMergeState({ isActive: false, source: null, destination: null });
    }
  };

  const handleCancelMerge = () => {
      setMergeState({ isActive: false, source: null, destination: null });
  };

  const destinationAccounts = accounts.filter(acc => acc.name !== mergeState.source);

  return (
    <div className="space-y-6">
      {mergeState.isActive && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
            <Card className="max-w-md w-full">
                <h2 className="text-xl font-bold mb-4">Merge Accounts</h2>
                
                <div className="space-y-4">
                    <div>
                        <label htmlFor="source-account" className="block text-sm font-medium text-text-secondary mb-1">
                            1. Merge FROM this account (will be deleted)
                        </label>
                        <select
                            id="source-account"
                            value={mergeState.source || ''}
                            onChange={(e) => setMergeState(prev => ({ ...prev, source: e.target.value, destination: null }))} // Reset destination if source changes
                            className="w-full bg-primary border border-secondary rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                        >
                            <option value="" disabled>Select an account...</option>
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.name}>{acc.name}</option>
                            ))}
                        </select>
                    </div>

                    {mergeState.source && (
                        <div>
                            <label htmlFor="destination-account" className="block text-sm font-medium text-text-secondary mb-1">
                                2. Merge INTO this account (will be kept)
                            </label>
                            <select
                                id="destination-account"
                                value={mergeState.destination || ''}
                                onChange={(e) => setMergeState(prev => ({ ...prev, destination: e.target.value }))}
                                className="w-full bg-primary border border-secondary rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                            >
                                <option value="" disabled>Select an account...</option>
                                {destinationAccounts.map(acc => (
                                    <option key={acc.id} value={acc.name}>{acc.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={handleCancelMerge} className="bg-secondary hover:bg-primary text-text-primary font-semibold py-2 px-4 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button 
                        onClick={handleConfirmMerge} 
                        disabled={!mergeState.source || !mergeState.destination}
                        className="bg-accent hover:opacity-90 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Confirm Merge
                    </button>
                </div>
            </Card>
        </div>
      )}
      <div className="hidden md:block">
        <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">AI Agent</h1>
        <p className="text-text-secondary">Converse with your financial assistant to manage data and gain insights.</p>
      </div>
      {/* FIX: Replaced inline style prop with Tailwind CSS class `min-h-[70vh]` to fix compilation error. */}
      <Card className="h-full flex flex-col min-h-[70vh]">
        <div className="p-4 border-b border-secondary flex items-center space-x-2">
          <SparklesIcon className="w-6 h-6 text-accent" />
          {/* FIX: Incomplete h tag caused a compilation error. Completed it as an h2 tag for the chat header. */}
          <h2 className="text-lg font-semibold text-text-primary">AI Conversation</h2>
        </div>
        <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-primary">
            {messages.map((message) => (
                <div key={message.id} className={`flex items-start gap-3 ${ message.sender === 'user' ? 'justify-end' : '' }`}>
                    {message.sender === 'ai' && <div className="w-8 h-8 rounded-full bg-secondary flex-shrink-0 flex items-center justify-center mt-1"><SparklesIcon className="w-5 h-5 text-accent"/></div>}
                    <div className={`max-w-xl px-4 py-2.5 rounded-2xl ${ message.sender === 'user' ? 'bg-accent text-white rounded-br-none' : 'bg-secondary text-text-primary rounded-bl-none'}`}>
                        <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{message.text}</p>
                    </div>
                </div>
            ))}
            {isLoading && (
                <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-secondary flex-shrink-0 flex items-center justify-center mt-1"><SparklesIcon className="w-5 h-5 text-accent"/></div>
                    <div className="max-w-xl px-4 py-2.5 rounded-2xl bg-secondary text-text-primary rounded-bl-none">
                        <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-text-secondary rounded-full animate-pulse"></div>
                            <div className="w-2 h-2 bg-text-secondary rounded-full animate-pulse [animation-delay:0.2s]"></div>
                            <div className="w-2 h-2 bg-text-secondary rounded-full animate-pulse [animation-delay:0.4s]"></div>
                        </div>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>
        <div className="p-4 border-t border-secondary bg-surface">
            {/* FIX: Removed API key prompt message. */}
            <form onSubmit={handleSendMessage} className="relative">
                {selectedFile && (
                    <div className="absolute -top-8 left-0 bg-primary px-3 py-1 rounded-t-md text-xs text-text-secondary flex items-center gap-2">
                        <span>{selectedFile.name}</span>
                        <button type="button" onClick={() => setSelectedFile(null)} className="text-text-secondary hover:text-text-primary">&times;</button>
                    </div>
                )}
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isLoading ? "Thinking..." : "Ask a question or describe a transaction..."}
                    // FIX: Removed apiKey check from disabled attribute.
                    disabled={isLoading}
                    className="w-full bg-primary border border-secondary rounded-lg pl-12 pr-12 py-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" id="file-upload"/>
                    {/* FIX: Removed apiKey check from disabled attribute. */}
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1 text-text-secondary hover:text-accent disabled:opacity-50" disabled={isLoading} aria-label="Attach file">
                        <PaperclipIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {/* FIX: Removed apiKey check from disabled attribute. */}
                    <button type="submit" disabled={(!input.trim() && !selectedFile) || isLoading} className="p-2 bg-accent text-white rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Send message">
                        <SendIcon className="w-5 h-5" />
                    </button>
                </div>
            </form>
        </div>
      </Card>
    </div>
  );
};