import React, { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import pako from 'pako';
import Card from '../components/Card';
import { useAuth } from '../hooks/useAuth';
import { useFinance } from '../hooks/useFinance';
import { useApiKey } from '../hooks/useApiKey';
import { exportTransactionsToCSV, exportAccountsToCSV } from '../utils/export';
import { DownloadIcon, TrashIcon, LogOutIcon, SyncIcon, SparklesIcon } from '../components/Icons';
import { FinanceData, SyncPayload } from '../types';

// Converts the standard data format to a highly compact array-based format
const toV2Format = (data: SyncPayload) => {
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
            h.value
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
        t: compactTransactions,
        a: compactAccounts,
        tc: data.financeData.transactionCategories,
        lu: data.financeData.lastUpdated,
    };
    
    return {
        u: data.user,
        d: compactFinanceData, // d for data
        k: data.apiKey,       // k for key
    };
};

const QR_CHUNK_SIZE = 750; // Max size for each QR code chunk in bytes

const ProfilePage: React.FC = () => {
    const { user, logout } = useAuth();
    const { transactions, accounts, transactionCategories, lastUpdated, clearAllData } = useFinance();
    const { apiKey, saveApiKey, removeApiKey } = useApiKey();
    const [keyInput, setKeyInput] = useState('');
    
    // --- State for New Device Setup ---
    const [showQr, setShowQr] = useState(false);
    const [qrChunks, setQrChunks] = useState<string[]>([]);
    const [currentQrIndex, setCurrentQrIndex] = useState(0);
    const qrCanvasRef = useRef<HTMLCanvasElement>(null);
    const animationIntervalRef = useRef<number | null>(null);

    const stopQrAnimation = () => {
        if (animationIntervalRef.current) {
            clearInterval(animationIntervalRef.current);
            animationIntervalRef.current = null;
        }
        setShowQr(false);
        setQrChunks([]);
        setCurrentQrIndex(0);
    };

    const handleGenerateQrCode = () => {
        if (!user) return;

        const financeDataForSync: FinanceData = {
            transactions,
            accounts,
            conversationHistory: [], // Exclude history to reduce size
            transactionCategories,
            lastUpdated,
        };

        const payload: SyncPayload = {
            user,
            financeData: financeDataForSync,
            apiKey: apiKey || '',
        };

        const compactPayload = toV2Format(payload);

        try {
            const jsonString = JSON.stringify(compactPayload);
            const compressedData = pako.deflate(jsonString, { level: 9 });

            let compressedBinaryStr = '';
            for (let i = 0; i < compressedData.length; i++) {
                compressedBinaryStr += String.fromCharCode(compressedData[i]);
            }
            const base64String = btoa(compressedBinaryStr);
            const fullPayloadString = `FINT_V2:${base64String}`;

            // --- Data Chunking Logic ---
            const sessionId = Date.now().toString(36);
            const totalChunks = Math.ceil(fullPayloadString.length / QR_CHUNK_SIZE);
            const chunks: string[] = [];
            
            for (let i = 0; i < totalChunks; i++) {
                const chunkData = fullPayloadString.substring(i * QR_CHUNK_SIZE, (i + 1) * QR_CHUNK_SIZE);
                // Format: FINT_M_V1:{sessionId}:{chunkIndex}:{totalChunks}:{data}
                const chunkString = `FINT_M_V1:${sessionId}:${i + 1}:${totalChunks}:${chunkData}`;
                chunks.push(chunkString);
            }

            setQrChunks(chunks);
            setShowQr(true);
        } catch (error) {
            console.error('Data preparation for QR code failed:', error);
            alert('Error: Could not prepare data for QR code. Your profile might be too large.');
        }
    };
    
    useEffect(() => {
        if (showQr && qrChunks.length > 0 && qrCanvasRef.current) {
            const canvas = qrCanvasRef.current;

            const drawQrCode = (index: number) => {
                QRCode.toCanvas(canvas, qrChunks[index], { width: 256, errorCorrectionLevel: 'L' })
                    .catch(err => {
                        console.error('QR code frame generation failed:', err);
                        stopQrAnimation();
                        alert('An error occurred while generating the animated QR code.');
                    });
            };

            drawQrCode(0); // Draw the first frame immediately

            if (qrChunks.length > 1) {
                animationIntervalRef.current = window.setInterval(() => {
                    setCurrentQrIndex(prevIndex => {
                        const nextIndex = (prevIndex + 1) % qrChunks.length;
                        drawQrCode(nextIndex);
                        return nextIndex;
                    });
                }, 400); // 400ms per frame
            }

        } else {
            if (animationIntervalRef.current) {
                clearInterval(animationIntervalRef.current);
                animationIntervalRef.current = null;
            }
        }
        
        return () => {
            if (animationIntervalRef.current) {
                clearInterval(animationIntervalRef.current);
            }
        };
    }, [showQr, qrChunks]);

    const handleSaveKey = () => {
        if (keyInput.trim()) {
            saveApiKey(keyInput.trim());
            setKeyInput('');
            alert('API Key saved successfully!');
        }
    };

    const handleRemoveKey = () => {
        if (window.confirm('Are you sure you want to remove your API key?')) {
            removeApiKey();
        }
    };
    
    const handleDeleteAllDataAndKey = () => {
        if (window.confirm("Are you sure you want to delete all your financial data AND your saved API key? This action cannot be undone.")) {
            clearAllData();
            removeApiKey();
            logout();
        }
    };
    
    if (!user) return null;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">Profile & Settings</h1>
                <p className="text-text-secondary">Manage your account, data, and device sync settings.</p>
            </div>

            <Card>
                <div className="flex items-center gap-4">
                    <img className="h-20 w-20 rounded-full" src={user.avatar} alt="User Avatar" />
                    <div>
                        <h2 className="text-2xl font-bold">{user.name}</h2>
                    </div>
                </div>
            </Card>
            
            <Card>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <SparklesIcon className="w-5 h-5 text-text-secondary"/>
                    Gemini API Key
                </h2>
                <p className="text-text-secondary text-sm mb-4">
                    To use the AI Agent for processing files and commands, you need a Google Gemini API key. You can get a free key from {' '}
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-accent underline">
                        Google AI Studio
                    </a>.
                </p>
                <div className="space-y-3">
                    {apiKey ? (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                            <p className="text-positive-text font-medium">API Key is set.</p>
                            <button onClick={handleRemoveKey} className="text-sm text-negative-text hover:underline">Remove Key</button>
                        </div>
                    ) : (
                         <p className="text-negative-text font-medium p-3 rounded-lg bg-negative/10">API Key is not set.</p>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="password"
                          value={keyInput}
                          onChange={(e) => setKeyInput(e.target.value)}
                          placeholder="Paste your API key here"
                          className="flex-grow bg-primary border border-secondary rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                        <button
                          onClick={handleSaveKey}
                          disabled={!keyInput.trim()}
                          className="bg-accent text-white font-semibold py-2 px-4 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Save Key
                        </button>
                    </div>
                </div>
            </Card>

            <Card>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <SyncIcon className="w-5 h-5 text-text-secondary"/>
                    New Device Setup
                </h2>
                <p className="text-text-secondary mb-4">
                    {showQr 
                        ? 'On your new device, scan the animated QR code below. Keep your camera pointed until all parts are scanned.'
                        : 'Click the button below to generate a QR code. Scanning this code on a new device will securely clone your entire profile, including all data and your API key.'
                    }
                </p>
                <div className={`text-center ${showQr ? '' : 'hidden'}`}>
                    <div className="bg-white p-4 rounded-lg inline-block mx-auto relative">
                        <canvas ref={qrCanvasRef}></canvas>
                        {showQr && qrChunks.length > 1 && (
                            <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs font-mono px-1.5 py-0.5 rounded">
                                {currentQrIndex + 1} / {qrChunks.length}
                            </div>
                        )}
                    </div>
                </div>
                <div className="mt-4 text-center">
                    {showQr ? (
                        <button onClick={stopQrAnimation} className="bg-secondary hover:bg-primary text-text-primary font-semibold py-2 px-4 rounded-lg transition-colors">
                            Done
                        </button>
                    ) : (
                        <button onClick={handleGenerateQrCode} className="w-full bg-accent text-white font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity">
                            Generate Animated QR Code
                        </button>
                    )}
                </div>
            </Card>

            <Card>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <DownloadIcon className="w-5 h-5 text-text-secondary"/>
                    Data Management
                </h2>
                <div className="space-y-3">
                    <button 
                        onClick={() => exportTransactionsToCSV(transactions)}
                        disabled={transactions.length === 0}
                        className="w-full text-left p-3 rounded-lg bg-secondary hover:bg-primary transition-colors flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                    Export Transactions (CSV)
                    </button>
                    <button 
                        onClick={() => exportAccountsToCSV(accounts)}
                        disabled={accounts.length === 0}
                        className="w-full text-left p-3 rounded-lg bg-secondary hover:bg-primary transition-colors flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                    Export Accounts (CSV)
                    </button>
                </div>
            </Card>

            <Card className="border-negative/50">
                <h2 className="text-xl font-semibold text-negative-text mb-2">Danger Zone</h2>
                <p className="text-text-secondary mb-4 text-sm">
                    These actions are permanent and cannot be undone. Please be certain before proceeding.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                    <button 
                    onClick={handleDeleteAllDataAndKey}
                    className="w-full sm:w-auto flex-grow flex justify-center items-center gap-2 bg-negative/10 hover:bg-negative/20 text-negative-text font-semibold py-2 px-4 rounded-lg transition-colors"
                    >
                        <TrashIcon className="w-4 h-4" />
                        Delete All My Data
                    </button>
                    <button 
                    onClick={logout}
                    className="w-full sm:w-auto flex-grow flex justify-center items-center gap-2 bg-secondary hover:bg-primary text-text-primary font-semibold py-2 px-4 rounded-lg transition-colors"
                    >
                        <LogOutIcon className="w-4 h-4" />
                        Logout
                    </button>
                </div>
            </Card>
        </div>
    );
};

export default ProfilePage;
