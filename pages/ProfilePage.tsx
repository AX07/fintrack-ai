import React, { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import pako from 'pako';
import { Peer } from 'peerjs';
import Card from '../components/Card';
import { useAuth } from '../hooks/useAuth';
import { useFinance } from '../hooks/useFinance';
// FIX: Removed useApiKey as it is no longer needed.
// import { useApiKey } from '../hooks/useApiKey';
import { exportTransactionsToCSV, exportAccountsToCSV } from '../utils/export';
import { toV2Format } from '../utils/sync';
import { DownloadIcon, TrashIcon, LogOutIcon, SyncIcon, SparklesIcon } from '../components/Icons';
import { FinanceData, SyncPayload } from '../types';

const ProfilePage: React.FC = () => {
    const { user, logout } = useAuth();
    const { transactions, accounts, transactionCategories, lastUpdated, clearAllData } = useFinance();
    // FIX: Removed API key state management from the UI.
    // const { apiKey, saveApiKey, removeApiKey } = useApiKey();
    // const [keyInput, setKeyInput] = useState('');
    
    // --- State for New Device Setup ---
    const [syncState, setSyncState] = useState<'idle' | 'generating' | 'waiting' | 'connected' | 'sending' | 'complete' | 'error'>('idle');
    const [syncLink, setSyncLink] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    
    const peerRef = useRef<Peer | null>(null);
    const qrCanvasRef = useRef<HTMLCanvasElement>(null);

    const cleanupPeer = () => {
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }
    };
    
    useEffect(() => {
        // Cleanup peer on component unmount
        return () => cleanupPeer();
    }, []);

    const handleGenerateLink = () => {
        if (!user) return;
        cleanupPeer();
        setSyncState('generating');
        setErrorMessage('');
        
        try {
            const peer = new Peer();
            peerRef.current = peer;

            peer.on('open', (id) => {
                const link = `${window.location.origin}${window.location.pathname}#/sync/${id}`;
                setSyncLink(link);
                setSyncState('waiting');
            });
            
            peer.on('connection', (conn) => {
                setSyncState('connected');
                
                conn.on('open', () => {
                    setSyncState('sending');
                    const financeDataForSync: FinanceData = {
                        transactions, accounts, conversationHistory: [], transactionCategories, lastUpdated,
                    };
                    // FIX: Removed apiKey from the sync payload.
                    const payload: SyncPayload = {
                        user, financeData: financeDataForSync,
                    };
                    const compactPayload = toV2Format(payload);
                    const jsonString = JSON.stringify(compactPayload);
                    const compressedData = pako.deflate(jsonString, { level: 9 });
                    conn.send(compressedData);
                    
                    setTimeout(() => {
                        setSyncState('complete');
                        conn.close();
                    }, 1000);
                });
            });

            peer.on('error', (err) => {
                console.error('PeerJS error:', err);
                setErrorMessage(`A connection error occurred: ${err.type}. This can happen if the service is temporarily unavailable. Please try again in a moment.`);
                setSyncState('error');
                cleanupPeer();
            });

        } catch(e) {
            console.error("Failed to initialize PeerJS", e);
            setErrorMessage('Could not initialize the sync service. Please check your internet connection.');
            setSyncState('error');
        }
    };

    useEffect(() => {
        if (syncState === 'waiting' && syncLink && qrCanvasRef.current) {
            QRCode.toCanvas(qrCanvasRef.current, syncLink, { width: 256, errorCorrectionLevel: 'M' })
                .catch(err => {
                    console.error('QR code generation failed:', err);
                    setErrorMessage('Failed to generate QR code.');
                    setSyncState('error');
                });
        }
    }, [syncState, syncLink]);

    const handleCancelSync = () => {
        cleanupPeer();
        setSyncState('idle');
        setSyncLink('');
        setErrorMessage('');
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(syncLink).then(() => {
            alert('Sync link copied to clipboard!');
        }, (err) => {
            alert('Failed to copy link. Please copy it manually.');
            console.error('Could not copy text: ', err);
        });
    };

    const getSyncStatusMessage = () => {
        switch(syncState) {
            case 'generating': return 'Generating secure link...';
            case 'waiting': return 'Waiting for new device to connect...';
            case 'connected': return 'Device connected! Preparing data...';
            case 'sending': return 'Sending data...';
            case 'complete': return 'Sync complete!';
            case 'error': return 'An error occurred.';
            default: return '';
        }
    };
    
    // FIX: Removed functions related to UI-based API key management.
    // const handleSaveKey = () => { if (keyInput.trim()) { saveApiKey(keyInput.trim()); setKeyInput(''); alert('API Key saved successfully!'); } };
    // const handleRemoveKey = () => { if (window.confirm('Are you sure you want to remove your API key?')) { removeApiKey(); } };
    const handleDeleteAllData = () => { if (window.confirm("Are you sure? This will delete all your financial data. This cannot be undone.")) { clearAllData(); logout(); } };
    
    if (!user) return null;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="hidden md:block">
                <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">Profile & Settings</h1>
                <p className="text-text-secondary">Manage your account, data, and device sync settings.</p>
            </div>

            <Card><div className="flex items-center gap-4"><img className="h-20 w-20 rounded-full" src={user.avatar} alt="User Avatar" /><div><h2 className="text-2xl font-bold">{user.name}</h2></div></div></Card>
            
            {/* FIX: Removed the entire Gemini API Key card from the UI. */}

            <Card>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><SyncIcon className="w-5 h-5 text-text-secondary"/>New Device Setup</h2>
                {syncState === 'idle' ? (
                    <>
                        <p className="text-text-secondary mb-4">Securely clone your profile to another device using a direct peer-to-peer connection. Your data is end-to-end encrypted and never passes through a central server.</p>
                        <button onClick={handleGenerateLink} className="w-full bg-accent text-white font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity">Setup a New Device via Link</button>
                    </>
                ) : (
                    <div className="text-center">
                        <p className="text-lg font-semibold text-accent mb-4">{getSyncStatusMessage()}</p>
                        {errorMessage && <p className="text-negative-text mb-4">{errorMessage}</p>}
                        
                        {(syncState === 'waiting' || syncState === 'connected') && (
                            <div className="space-y-6">
                                <div>
                                    <p className="text-text-secondary mb-2">Option 1: Copy this link and open it on your new device.</p>
                                    <div className="flex gap-2">
                                        <input type="text" readOnly value={syncLink} className="w-full bg-primary border border-secondary rounded-lg px-4 py-2 text-text-primary"/>
                                        <button onClick={handleCopyLink} className="bg-secondary hover:bg-primary text-text-primary font-semibold py-2 px-4 rounded-lg transition-colors">Copy</button>
                                    </div>
                                </div>
                                <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-secondary" /></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-surface text-text-secondary">OR</span></div></div>
                                <div>
                                    <p className="text-text-secondary mb-2">Option 2: Scan this QR code on your new device.</p>
                                    <div className="bg-white p-4 rounded-lg inline-block mx-auto"><canvas ref={qrCanvasRef}></canvas></div>
                                </div>
                            </div>
                        )}

                        <div className="mt-6">
                            <button onClick={handleCancelSync} className="bg-secondary hover:bg-primary text-text-primary font-semibold py-2 px-4 rounded-lg transition-colors">
                                {syncState === 'complete' || syncState === 'error' ? 'Close' : 'Cancel'}
                            </button>
                        </div>
                    </div>
                )}
            </Card>

            <Card>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><DownloadIcon className="w-5 h-5 text-text-secondary"/>Data Management</h2>
                <div className="space-y-3">
                    <button onClick={() => exportTransactionsToCSV(transactions)} disabled={transactions.length === 0} className="w-full text-left p-3 rounded-lg bg-secondary hover:bg-primary transition-colors flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">Export Transactions (CSV)</button>
                    <button onClick={() => exportAccountsToCSV(accounts)} disabled={accounts.length === 0} className="w-full text-left p-3 rounded-lg bg-secondary hover:bg-primary transition-colors flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">Export Accounts (CSV)</button>
                </div>
            </Card>

            <Card className="border-negative/50">
                <h2 className="text-xl font-semibold text-negative-text mb-2">Danger Zone</h2>
                <p className="text-text-secondary mb-4 text-sm">These actions are permanent and cannot be undone. Please be certain before proceeding.</p>
                <div className="flex flex-col sm:flex-row gap-4">
                    <button onClick={handleDeleteAllData} className="w-full sm:w-auto flex-grow flex justify-center items-center gap-2 bg-negative/10 hover:bg-negative/20 text-negative-text font-semibold py-2 px-4 rounded-lg transition-colors"><TrashIcon className="w-4 h-4" />Delete All My Data</button>
                    <button onClick={logout} className="w-full sm:w-auto flex-grow flex justify-center items-center gap-2 bg-secondary hover:bg-primary text-text-primary font-semibold py-2 px-4 rounded-lg transition-colors"><LogOutIcon className="w-4 h-4" />Logout</button>
                </div>
            </Card>
        </div>
    );
};

export default ProfilePage;