import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import pako from 'pako';
import { Peer } from 'peerjs';
import Card from '../components/Card';
import { useAuth } from '../hooks/useAuth';
import { useFinance } from '../hooks/useFinance';
import { useGeminiApiKey } from '../hooks/useApiKey';
import { exportTransactionsToCSV, exportAccountsToCSV } from '../utils/export';
import { toV2Format } from '../utils/sync';
import { DownloadIcon, TrashIcon, LogOutIcon, SyncIcon, SparklesIcon, PencilIcon, DollarSignIcon, ExploreIcon } from '../components/Icons';
import { FinanceData, SyncPayload, Currency } from '../types';

const ProfilePage: React.FC = () => {
    const { user, updateUser, logout } = useAuth();
    const { settings, updateSettings, transactions, accounts, transactionCategories, conversationHistory, lastUpdated, clearAllData } = useFinance();
    const { apiKey: geminiApiKey, saveApiKey: saveGeminiApiKey, removeApiKey: removeGeminiApiKey } = useGeminiApiKey();
    
    const [geminiKeyInput, setGeminiKeyInput] = useState('');

    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState(user?.name || '');
    const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
    const avatarMenuRef = useRef<HTMLDivElement>(null);
    const avatarButtonRef = useRef<HTMLButtonElement>(null);
    const avatarFileRef = useRef<HTMLInputElement>(null);
    
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
    
    useEffect(() => { return () => cleanupPeer(); }, []);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (avatarMenuRef.current && !avatarMenuRef.current.contains(event.target as Node) && !avatarButtonRef.current?.contains(event.target as Node)) {
                setIsAvatarMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
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
                    // FIX: Add missing 'aiProcessingStatus' property to conform to the 'FinanceData' type.
                    const financeDataForSync: FinanceData = { settings, transactions, accounts, conversationHistory, transactionCategories, lastUpdated, aiProcessingStatus: { isProcessing: false, message: '' } };
                    const payload: SyncPayload = { user, financeData: financeDataForSync, geminiApiKey };
                    const compactPayload = toV2Format(payload);
                    const jsonString = JSON.stringify(compactPayload);
                    const compressedData = pako.deflate(jsonString, { level: 9 });
                    conn.send(compressedData);
                    
                    setTimeout(() => { setSyncState('complete'); conn.close(); }, 1000);
                });
            });

            peer.on('error', (err) => {
                setErrorMessage(`A connection error occurred: ${err.type}. Please try again.`);
                setSyncState('error');
                cleanupPeer();
            });

        } catch(e) {
            setErrorMessage('Could not initialize the sync service.');
            setSyncState('error');
        }
    };

    useEffect(() => {
        if (syncState === 'waiting' && syncLink && qrCanvasRef.current) {
            QRCode.toCanvas(qrCanvasRef.current, syncLink, { width: 256, errorCorrectionLevel: 'M' })
                .catch(err => { setErrorMessage('Failed to generate QR code.'); setSyncState('error'); });
        }
    }, [syncState, syncLink]);

    const handleCancelSync = () => { cleanupPeer(); setSyncState('idle'); setSyncLink(''); setErrorMessage(''); };
    const handleCopyLink = () => { navigator.clipboard.writeText(syncLink).then(() => alert('Sync link copied!')); };

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
    
    const handleNameSave = () => {
        if (editedName.trim() && user && editedName.trim() !== user.name) {
            updateUser({ name: editedName.trim() });
        }
        setIsEditingName(false);
    };

    const handleGenerateRandomAvatar = () => {
        const newAvatar = `https://i.pravatar.cc/150?u=user-${Date.now()}`;
        updateUser({ avatar: newAvatar });
        setIsAvatarMenuOpen(false);
    };

    const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 200;
                let { width, height } = img;
                if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } } 
                else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
                updateUser({ avatar: canvas.toDataURL('image/jpeg') });
                setIsAvatarMenuOpen(false);
            };
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    const handleSaveGeminiKey = () => { if (geminiKeyInput.trim()) { saveGeminiApiKey(geminiKeyInput.trim()); setGeminiKeyInput(''); alert('Gemini API Key saved!'); } };
    const handleDeleteAllData = () => { if (window.confirm("Are you sure? This will delete all data.")) { clearAllData(); logout(); } };
    
    if (!user) return null;
    const currencies: Currency[] = ['USD', 'EUR', 'GBP'];

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <input type="file" accept="image/*" ref={avatarFileRef} onChange={handleAvatarUpload} className="hidden" />
            <div className="hidden md:block">
                <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">Profile & Settings</h1>
                <p className="text-text-secondary">Manage your account, data, and device sync settings.</p>
            </div>

            <Card>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <img className="h-20 w-20 rounded-full" src={user.avatar} alt="User Avatar" />
                        <button ref={avatarButtonRef} onClick={() => setIsAvatarMenuOpen(p => !p)} className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center text-white opacity-0 hover:opacity-100 transition-opacity">Change</button>
                        {isAvatarMenuOpen && (
                            <div ref={avatarMenuRef} className="absolute top-full mt-2 left-0 w-48 bg-surface border border-secondary rounded-lg shadow-lg z-10">
                                <button onClick={() => avatarFileRef.current?.click()} className="block w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-primary rounded-t-lg">Upload Photo</button>
                                <button onClick={handleGenerateRandomAvatar} className="block w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-primary rounded-b-lg">Generate Random</button>
                            </div>
                        )}
                    </div>
                    <div>
                        {isEditingName ? (
                            <div className="flex items-center gap-2">
                                <input type="text" value={editedName} onChange={(e) => setEditedName(e.target.value)} className="text-2xl font-bold bg-primary border border-secondary rounded-lg px-3 py-1" onKeyDown={(e) => { if (e.key === 'Enter') handleNameSave(); if (e.key === 'Escape') setIsEditingName(false); }} autoFocus />
                                <button onClick={handleNameSave} className="bg-accent text-white font-semibold py-2 px-3 rounded-lg hover:opacity-90">Save</button>
                                <button onClick={() => setIsEditingName(false)} className="bg-secondary text-text-primary font-semibold py-2 px-3 rounded-lg hover:bg-primary">Cancel</button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <h2 className="text-2xl font-bold">{user.name}</h2>
                                <button onClick={() => { setIsEditingName(true); setEditedName(user.name); }} className="p-1.5 text-text-secondary hover:text-accent rounded-full hover:bg-secondary"><PencilIcon className="w-5 h-5" /></button>
                            </div>
                        )}
                    </div>
                </div>
            </Card>
            
            <Card>
                <h2 className="text-xl font-semibold mb-4">Display Currency</h2>
                <p className="text-text-secondary mb-4">Choose the currency for displaying all financial values in the app.</p>
                <div className="flex space-x-2 rounded-lg bg-primary p-1">
                    {currencies.map(currency => (
                        <button key={currency} onClick={() => updateSettings({ displayCurrency: currency })}
                            className={`w-full rounded-md py-2 text-sm font-semibold transition-colors ${settings.displayCurrency === currency ? 'bg-accent text-white' : 'text-text-secondary hover:bg-secondary'}`}>
                            {currency}
                        </button>
                    ))}
                </div>
            </Card>

            <Card>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-text-secondary"/>AI Agent API Key</h2>
                {geminiApiKey ? (
                    <div className="space-y-3"><p className="text-sm text-text-secondary">Your Gemini API key is saved.</p><div className="p-3 rounded-lg bg-secondary flex items-center justify-between"><span className="font-mono text-sm text-text-secondary">sk-••••{geminiApiKey.slice(-4)}</span><button onClick={removeGeminiApiKey} className="text-xs font-semibold text-negative-text hover:underline">Remove</button></div></div>
                ) : ( <p className="text-text-secondary mb-4 text-sm">Add your Google Gemini API key.</p> )}
                <div className="flex gap-3 mt-4">
                    <input type="password" value={geminiKeyInput} onChange={(e) => setGeminiKeyInput(e.target.value)} placeholder="Enter Gemini key" className="w-full bg-primary border border-secondary rounded-lg px-4 py-2" />
                    <button onClick={handleSaveGeminiKey} disabled={!geminiKeyInput.trim()} className="bg-accent text-white font-semibold py-2 px-4 rounded-lg hover:opacity-90 disabled:opacity-50">Save</button>
                </div>
            </Card>

            <Card>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><SyncIcon className="w-5 h-5 text-text-secondary"/>New Device Setup</h2>
                {syncState === 'idle' ? (
                    <><p className="text-text-secondary mb-4">Securely clone your profile and API keys to another device.</p><button onClick={handleGenerateLink} className="w-full bg-accent text-white font-semibold py-2.5 rounded-lg hover:opacity-90">Setup a New Device</button></>
                ) : (
                    <div className="text-center">
                        <p className="text-lg font-semibold text-accent mb-4">{getSyncStatusMessage()}</p>
                        {errorMessage && <p className="text-negative-text mb-4">{errorMessage}</p>}
                        {(syncState === 'waiting' || syncState === 'connected') && (
                            <div className="space-y-6">
                                <div><p className="text-text-secondary mb-2">Option 1: Copy link</p><div className="flex gap-2"><input type="text" readOnly value={syncLink} className="w-full bg-primary border border-secondary rounded-lg px-4 py-2"/><button onClick={handleCopyLink} className="bg-secondary hover:bg-primary text-text-primary font-semibold py-2 px-4 rounded-lg">Copy</button></div></div>
                                <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-secondary" /></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-surface text-text-secondary">OR</span></div></div>
                                <div><p className="text-text-secondary mb-2">Option 2: Scan QR code</p><div className="bg-white p-4 rounded-lg inline-block mx-auto"><canvas ref={qrCanvasRef}></canvas></div></div>
                            </div>
                        )}
                        <div className="mt-6"><button onClick={handleCancelSync} className="bg-secondary hover:bg-primary text-text-primary font-semibold py-2 px-4 rounded-lg">{syncState === 'complete' || syncState === 'error' ? 'Close' : 'Cancel'}</button></div>
                    </div>
                )}
            </Card>

            <Card>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><DownloadIcon className="w-5 h-5 text-text-secondary"/>Data Management</h2>
                <div className="space-y-3">
                    <button onClick={() => exportTransactionsToCSV(transactions)} disabled={transactions.length === 0} className="w-full text-left p-3 rounded-lg bg-secondary hover:bg-primary flex items-center gap-3 disabled:opacity-50">Export Transactions (CSV)</button>
                    <button onClick={() => exportAccountsToCSV(accounts)} disabled={accounts.length === 0} className="w-full text-left p-3 rounded-lg bg-secondary hover:bg-primary flex items-center gap-3 disabled:opacity-50">Export Accounts (CSV)</button>
                </div>
            </Card>

            <Card>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><ExploreIcon className="w-5 h-5 text-text-secondary"/>Advanced Features</h2>
                <div className="space-y-3">
                    <Link to="/explore" className="w-full text-left p-3 rounded-lg bg-secondary hover:bg-primary flex items-center gap-3">
                        Explore Market Assets
                    </Link>
                </div>
            </Card>

            <Card className="border-negative/50">
                <h2 className="text-xl font-semibold text-negative-text mb-2">Danger Zone</h2>
                <p className="text-text-secondary mb-4 text-sm">These actions are permanent and cannot be undone.</p>
                <div className="flex flex-col sm:flex-row gap-4">
                    <button onClick={handleDeleteAllData} className="w-full sm:w-auto flex-grow flex justify-center items-center gap-2 bg-negative/10 hover:bg-negative/20 text-negative-text font-semibold py-2 px-4 rounded-lg"><TrashIcon className="w-4 h-4" />Delete All My Data</button>
                    <button onClick={logout} className="w-full sm:w-auto flex-grow flex justify-center items-center gap-2 bg-secondary hover:bg-primary text-text-primary font-semibold py-2 px-4 rounded-lg"><LogOutIcon className="w-4 h-4" />Logout</button>
                </div>
            </Card>
        </div>
    );
};

export default ProfilePage;