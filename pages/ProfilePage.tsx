
import React, { useState, useRef } from 'react';
import QRCode from 'qrcode';
import pako from 'pako';
import Card from '../components/Card';
import { useAuth } from '../hooks/useAuth';
import { useFinance } from '../hooks/useFinance';
import { useApiKey } from '../hooks/useApiKey';
import { exportTransactionsToCSV, exportAccountsToCSV } from '../utils/export';
import { DownloadIcon, TrashIcon, LogOutIcon, SyncIcon, SparklesIcon } from '../components/Icons';
import { FinanceData, SyncPayload } from '../types';


const ProfilePage: React.FC = () => {
    const { user, logout } = useAuth();
    const { transactions, accounts, conversationHistory, lastUpdated, clearAllData } = useFinance();
    const { apiKey, saveApiKey, removeApiKey } = useApiKey();
    const [keyInput, setKeyInput] = useState('');
    
    // --- State for New Device Setup ---
    const [showQr, setShowQr] = useState(false);
    const qrCanvasRef = useRef<HTMLCanvasElement>(null);

    const handleGenerateQrCode = () => {
        if (!user || !qrCanvasRef.current) return;

        const financeData: FinanceData = { transactions, accounts, conversationHistory, lastUpdated };
        const payload: SyncPayload = {
            user,
            financeData,
            apiKey: apiKey || '',
        };

        try {
            const jsonString = JSON.stringify(payload);
            const compressedData = pako.deflate(jsonString);
            
            // Convert Uint8Array to a binary string for btoa
            let compressedBinaryStr = '';
            const len = compressedData.length;
            for (let i = 0; i < len; i++) {
                compressedBinaryStr += String.fromCharCode(compressedData[i]);
            }
            const base64String = btoa(compressedBinaryStr);

            // Add a version prefix for format detection and backward compatibility
            const finalPayload = `FINT_C_V1:${base64String}`;
            
            QRCode.toCanvas(qrCanvasRef.current, finalPayload, { width: 256, errorCorrectionLevel: 'L' })
                .then(() => setShowQr(true))
                .catch(err => {
                    console.error('QR code generation failed:', err);
                    alert('Error: Could not generate QR code. The data might be too large.');
                });
        } catch (error) {
            console.error('Data compression/encoding failed:', error);
            alert('Error: Could not prepare data for QR code. Your profile might be too large.');
        }
    };

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
            logout(); // Log out after clearing data to prevent issues
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
                {showQr ? (
                     <div className="text-center">
                        <p className="text-text-secondary mb-4">On your new device, choose "Sign in with QR Code" and scan the image below.</p>
                        <div className="bg-white p-4 rounded-lg inline-block mx-auto">
                            <canvas ref={qrCanvasRef}></canvas>
                        </div>
                        <button onClick={() => setShowQr(false)} className="mt-4 bg-secondary hover:bg-primary text-text-primary font-semibold py-2 px-4 rounded-lg transition-colors">
                            Done
                        </button>
                     </div>
                ) : (
                    <div>
                        <p className="text-text-secondary mb-4">
                            Click the button below to generate a QR code. Scanning this code on the login screen of a new device will securely clone your entire profile, including all data and your API key.
                        </p>
                        <button onClick={handleGenerateQrCode} className="w-full bg-accent text-white font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity">
                            Generate QR Code
                        </button>
                        <canvas ref={qrCanvasRef} style={{ display: 'none' }}></canvas>
                    </div>
                )}
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
