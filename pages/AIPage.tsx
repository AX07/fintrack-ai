import React, { useState, useRef, useEffect } from 'react';
import { useFinance } from '../hooks/useFinance';
import { processUserCommand, parseFileWithAI } from '../services/geminiService';
import { SendIcon, SparklesIcon, PaperclipIcon } from '../components/Icons';
import { Transaction } from '../types';
import Card from '../components/Card';

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
  const { transactions, accounts, addTransaction, addMultipleTransactions, addAccounts, addConversation, renameAccount, conversationHistory } = useFinance();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
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
        const parsedData = await parseFileWithAI(fileToProcess, textPrompt);
        const { transactions: parsedTransactions, accounts: parsedAccounts } = parsedData;
        
        const hasTransactions = parsedTransactions && parsedTransactions.length > 0;
        const hasAccounts = parsedAccounts && parsedAccounts.length > 0;

        if (hasTransactions) {
            addMultipleTransactions(parsedTransactions);
        }
        if (hasAccounts) {
            addAccounts(parsedAccounts);
        }

        if (hasAccounts && hasTransactions) {
            const account = parsedAccounts[0];
            aiResponseText = `Success! From ${fileToProcess.name}, I've added ${parsedTransactions.length} transactions and updated the '${account.name}' account. The new balance is ${formatCurrency(account.balance)}.`;
        } else if (hasAccounts) {
            const account = parsedAccounts[0];
            aiResponseText = `Success! I've created or updated the '${account.name}' account from ${fileToProcess.name} with a balance of ${formatCurrency(account.balance)}. No new transactions were found.`;
        } else if (hasTransactions) {
            aiResponseText = `Success! I've added ${parsedTransactions.length} transactions from ${fileToProcess.name}. I couldn't identify a specific account to update, so you may want to assign them manually.`;
        } else {
            aiResponseText = `I couldn't find any valid transactions or accounts in ${fileToProcess.name}. Please ensure the file is clear and contains financial data.`;
        }
      } else {
        const commandResponse = await processUserCommand(textPrompt, { transactions, accounts });
        aiResponseText = commandResponse.ai_response;

        if (commandResponse.action && commandResponse.parameters) {
          switch (commandResponse.action) {
            case 'create_account':
              if (commandResponse.parameters.accounts && commandResponse.parameters.accounts.length > 0) {
                addAccounts(commandResponse.parameters.accounts);
              } else {
                aiResponseText = "I was ready to create an account, but the details were missing. Could you please clarify?";
              }
              break;
            case 'rename_account':
              if (commandResponse.parameters.oldName && commandResponse.parameters.newName) {
                renameAccount({
                  oldName: commandResponse.parameters.oldName,
                  newName: commandResponse.parameters.newName
                });
              } else {
                aiResponseText = "I seem to be missing the details to rename the account. Please try again.";
              }
              break;
            case 'create_transaction':
              const params = commandResponse.parameters;
              if (params.amount && params.description && params.category && params.date) {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">AI Agent</h1>
        <p className="text-text-secondary">Converse with your financial assistant to manage data and gain insights.</p>
      </div>
      <Card className="h-full flex flex-col">
        <div className="p-4 border-b border-secondary flex items-center space-x-2">
          <SparklesIcon className="w-6 h-6 text-accent" />
          <h2 className="text-xl font-semibold">AI Conversation</h2>
        </div>
        <div className="flex-1 p-4 overflow-y-auto space-y-4 h-[65vh] min-h-[400px]">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
              {msg.sender === 'ai' && <div className="w-8 h-8 rounded-full bg-accent flex-shrink-0 flex items-center justify-center"><SparklesIcon className="w-5 h-5 text-white"/></div>}
              <div className={`max-w-2xl p-3 rounded-xl ${msg.sender === 'user' ? 'bg-accent text-white rounded-br-none' : 'bg-primary text-text-primary rounded-bl-none'}`}>
                <p className="text-sm break-words">{msg.text}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-accent flex-shrink-0 flex items-center justify-center"><SparklesIcon className="w-5 h-5 text-white animate-pulse"/></div>
              <div className="max-w-md p-3 rounded-xl bg-primary text-text-primary rounded-bl-none">
                <div className="h-2 bg-secondary rounded-full w-16 animate-pulse"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-4 border-t border-secondary">
          <form onSubmit={handleSendMessage} className="space-y-2">
            {selectedFile && (
                <div className="flex items-center">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-text-secondary">
                        {selectedFile.name}
                        <button type="button" onClick={() => setSelectedFile(null)} className="flex-shrink-0 ml-1.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-text-secondary hover:bg-primary hover:text-text-primary">
                            <span className="sr-only">Remove file</span>
                            <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8"><path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" /></svg>
                        </button>
                    </span>
                </div>
            )}
            <div className="flex items-center space-x-2">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".csv,image/png,image/jpeg,application/pdf" />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="text-text-secondary hover:text-accent p-2.5 rounded-lg disabled:text-gray-600 disabled:cursor-not-allowed">
                    <PaperclipIcon className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={selectedFile ? 'Add a comment... (optional)' : 'e.g., I spent $15 on coffee'}
                  disabled={isLoading}
                  className="w-full bg-primary border border-secondary rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button type="submit" disabled={isLoading || (!input.trim() && !selectedFile)} className="bg-accent text-white p-2.5 rounded-lg disabled:bg-secondary disabled:cursor-not-allowed transition-colors">
                  <SendIcon className="w-5 h-5" />
                </button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
};
