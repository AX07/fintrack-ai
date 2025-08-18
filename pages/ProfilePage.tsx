
import React, { useState, useEffect, useRef } from 'react';
import type { Peer } from 'peerjs';
import type { DataConnection } from 'peerjs';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import Card from '../components/Card';
import { useAuth } from '../hooks/useAuth';
import { useFinance } from '../hooks/useFinance';
import { useApiKey } from '../hooks/useApiKey';
import { exportTransactionsToCSV, exportAccountsToCSV } from '../utils/export';
import { DownloadIcon, TrashIcon, LogOutIcon, SyncIcon, SparklesIcon } from '../components/Icons';
import { FinanceData } from '../types';

// The data payload for syncing, which includes financial data and the API key
interface SyncPayload extends FinanceData {
    apiKey: string | null;
}

// Helper to deeply merge two FinanceData objects
const mergeFinanceData = (hostData: FinanceData, clientData: FinanceData): FinanceData => {
    const createMap = <T extends { id: string }>(arr: T[]): Map<string, T> => new Map(arr.map(item => [item.id, item]));

    // Merge Transactions
    const mergedTransactionsMap = createMap(hostData.transactions);
    clientData.transactions.forEach(tx => {
        if (!mergedTransactionsMap.has(tx.id)) mergedTransactionsMap.set(tx.id, tx);
    });

    // Merge Accounts (with holding merge)
    const mergedAccountsMap = createMap(hostData.accounts);
    clientData.accounts.forEach(clientAcc => {
        if (!mergedAccountsMap.has(clientAcc.id)) {
            mergedAccountsMap.set(clientAcc.id, clientAcc);
        } else {
            const hostAcc = mergedAccountsMap.get(clientAcc.id)!;
            const mergedHoldingsMap = createMap(hostAcc.holdings || []);
            (clientAcc.holdings || []).forEach(clientHolding => {
                if (!mergedHoldingsMap.has(clientHolding.id)) mergedHoldingsMap.set(clientHolding.id, clientHolding);
            });
            const mergedAccount = { ...hostAcc, holdings: Array.from(mergedHoldingsMap.values()) };
            mergedAccount.balance = mergedAccount.holdings.reduce((sum, h) => sum + h.value, 0);
            mergedAccountsMap.set(hostAcc.id, mergedAccount);
        }
    });

    // Merge Conversation History
    const mergedConversationMap = createMap(hostData.conversationHistory);
    clientData.conversationHistory.forEach(conv => {
        if (!mergedConversationMap.has(conv.id)) mergedConversationMap.set(conv.id, conv);
    });

    return {
        transactions: Array.from(mergedTransactionsMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        accounts: Array.from(mergedAccountsMap.values()),
        conversationHistory: Array.from(mergedConversationMap.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
        lastUpdated: new Date().toISOString(),
    };
};


const ProfilePage: React.FC = () => {
    const { user, logout } = useAuth();
    const { transactions, accounts, conversationHistory, lastUpdated, clearAllData, setData } = useFinance();
    const { apiKey, saveApiKey, removeApiKey } = useApiKey();
    const [keyInput, setKeyInput] = useState('');

    // --- State and Refs for Device Sync ---
    const [mode, setMode] = useState<'select' | 'host' | 'scan'>('select');
    const [peerId, setPeerId] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
    const [log, setLog] = useState<string[]>([]);
    const peerRef = useRef<Peer | null>(null);
    const connRef = useRef<DataConnection | null>(null);
    const qrCanvasRef = useRef<HTMLCanvasElement>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);

    // This object contains all data, including the API key, for sync.
    const currentSyncPayload: SyncPayload = {
        transactions,
        accounts,
        conversationHistory,
        lastUpdated,
        apiKey,
    };

    const addLog = (message: string) => setLog(prev => [message, ...prev.slice(0, 99)]);
    
    // --- Handlers for API Key ---
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
    
    // --- Handler for Deleting All Data ---
    const handleDeleteAllDataAndKey = () => {
        if (window.confirm("Are you sure you want to delete all your financial data AND your saved API key? This action cannot be undone.")) {
            clearAllData();
            removeApiKey();
        }
    };

    // --- Effects for Device Sync ---

    // Effect to initialize PeerJS when a mode is selected
    useEffect(() => {
        if (mode === 'select' || peerRef.current) return;

        import('peerjs').then(({ default: Peer }) => {
            if (peerRef.current) return;

            addLog("Initializing connection broker...");
            const peer = new Peer();
            peerRef.current = peer;

            peer.on('open', (id) => {
                setPeerId(id);
                addLog(`Device ready with ID: ${id}`);
            });

            peer.on('connection', (conn) => {
                addLog(`Incoming connection from ${conn.peer}`);
                setConnectionStatus('connecting');
                connRef.current = conn;
                setupConnectionListeners(conn);
            });
            
            peer.on('error', (err) => {
                console.error("PeerJS error:", err);
                addLog(`Error: ${err.type} - ${err.message}`);
                setConnectionStatus('error');
            });
        });

        return () => {
            if (scannerRef.current) {
                try {
                    if (scannerRef.current.getState() !== 1) { // 1 is NOT_STARTED
                         scannerRef.current.clear();
                    }
                } catch (e) { console.error("Error clearing scanner", e) }
            }
            if (peerRef.current) {
                peerRef.current.destroy();
                peerRef.current = null;
            }
        };
    }, [mode]);

    // Effect to generate QR code once peerId is available
    useEffect(() => {
        if (mode === 'host' && peerId && qrCanvasRef.current) {
            QRCode.toCanvas(qrCanvasRef.current, peerId, { width: 256, errorCorrectionLevel: 'H' })
            .catch(err => {
                console.error('QR code generation failed:', err);
                addLog('Error: Could not generate QR code.');
            });
        }
    }, [peerId, mode]);
    
    // Effect to start camera scanner
    useEffect(() => {
        if (mode === 'scan' && peerId) {
            const scanner = new Html5Qrcode('qr-reader');
            scannerRef.current = scanner;
            const config = { fps: 10, qrbox: { width: 250, height: 250 } };
            
            scanner.start({ facingMode: "environment" }, config, (decodedText) => {
                scanner.stop();
                addLog(`QR Code detected. Connecting to host: ${decodedText}`);
                setConnectionStatus('connecting');
                const conn = peerRef.current?.connect(decodedText);
                if(conn) {
                    connRef.current = conn;
                    setupConnectionListeners(conn);
                }
            }, (errorMessage) => {} /* ignore errors */)
            .catch(err => addLog(`Camera error: ${err}`));
        }
    }, [mode, peerId]);

    const setupConnectionListeners = (conn: DataConnection) => {
        conn.on('open', () => {
            setConnectionStatus('connected');
            addLog('Connection established.');
            // The device that scanned the QR code ('client') sends its data first to initiate the sync.
            if (mode === 'scan') {
                addLog("Sending this device's data to the host...");
                conn.send(currentSyncPayload);
            }
        });
    
        conn.on('data', (receivedData: any) => {
            const remotePayload = receivedData as SyncPayload;
            
            if (mode === 'host') {
                // HOST: Receives client data, merges everything, and sends the final version back.
                addLog("Received data from peer. Merging as the host...");
                
                const hostPayload = currentSyncPayload; // This device's data
                const finalFinanceData = mergeFinanceData(hostPayload, remotePayload);
                
                // API Key Logic: Host's key takes priority.
                const finalApiKey = hostPayload.apiKey || remotePayload.apiKey;
    
                // Update the host device's state with the merged result.
                setData(finalFinanceData);
                if (finalApiKey && !hostPayload.apiKey) {
                    saveApiKey(finalApiKey); // Save if host didn't have one but client did
                }
    
                const finalPayload: SyncPayload = {
                    ...finalFinanceData,
                    apiKey: finalApiKey,
                };
    
                addLog("Merge complete. Sending final data back to peer.");
                conn.send(finalPayload);
                setTimeout(() => conn.close(), 1000); // Close connection after sending final data
            } else {
                // CLIENT: Receives the final merged data from the host and applies it.
                addLog("Received final merged data from host. Applying updates...");
                
                const finalFinanceData: FinanceData = {
                    transactions: remotePayload.transactions,
                    accounts: remotePayload.accounts,
                    conversationHistory: remotePayload.conversationHistory,
                    lastUpdated: remotePayload.lastUpdated,
                };
                setData(finalFinanceData);
                
                if (remotePayload.apiKey) {
                    saveApiKey(remotePayload.apiKey);
                    addLog("API Key has been synced from the host device.");
                }
                
                addLog("Sync complete! This device is now up-to-date.");
                conn.close(); // Client closes connection upon receiving final data.
            }
        });
    
        conn.on('close', () => {
            setConnectionStatus('disconnected');
            addLog("Connection closed.");
            connRef.current = null;
        });
    };

    const renderSyncContent = () => {
        if (mode === 'select') {
            return (
                <div className="flex flex-col md:flex-row gap-6">
                    <button onClick={() => setMode('host')} className="flex-1 p-6 bg-secondary hover:bg-primary rounded-lg text-center transition-colors">
                        <h3 className="text-xl font-semibold">Host Session</h3>
                        <p className="text-text-secondary mt-2">Display a QR code on this device for another device to scan.</p>
                    </button>
                    <button onClick={() => setMode('scan')} className="flex-1 p-6 bg-secondary hover:bg-primary rounded-lg text-center transition-colors">
                        <h3 className="text-xl font-semibold">Scan QR Code</h3>
                        <p className="text-text-secondary mt-2">Use this device's camera to scan a code from another device.</p>
                    </button>
                </div>
            );
        }

        if (mode === 'host') {
            return (
                <div className="text-center">
                    <h2 className="text-xl font-semibold mb-2">Scan this QR Code</h2>
                    <p className="text-text-secondary mb-4">Open this page on your other device and choose "Scan QR Code".</p>
                    <div className="bg-white p-4 rounded-lg inline-block mx-auto">
                        {!peerId ? <div className="w-64 h-64 flex items-center justify-center text-black">Initializing...</div> : <canvas ref={qrCanvasRef}></canvas>}
                    </div>
                </div>
            );
        }
        
        if (mode === 'scan') {
            return (
                <div className="text-center">
                    <h2 className="text-xl font-semibold mb-2">Scan QR Code</h2>
                     <p className="text-text-secondary mb-4">Point your camera at the QR code on your other device.</p>
                    <div id="qr-reader" className="w-full max-w-sm mx-auto rounded-lg overflow-hidden border-2 border-secondary"></div>
                </div>
            );
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
                        <p className="text-text-secondary">{user.email}</p>
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
                    Device Sync
                </h2>
                {mode !== 'select' && (
                     <button onClick={() => setMode('select')} className="text-sm text-accent mb-4">← Back to selection</button>
                )}
                {renderSyncContent()}
                
                <h3 className="text-lg font-semibold mt-6 mb-3 flex items-center gap-2">
                    Sync Status & Log
                </h3>
                <div className="p-4 bg-primary rounded-lg h-32 overflow-y-auto flex flex-col-reverse">
                    <ul className="text-sm font-mono space-y-1 text-text-secondary">
                        {log.map((entry, index) => <li key={index}>{entry}</li>)}
                         <li>Status: <span className={`font-bold ${connectionStatus === 'connected' ? 'text-positive-text' : connectionStatus === 'error' ? 'text-negative-text' : ''}`}>{connectionStatus.toUpperCase()}</span></li>
                    </ul>
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
