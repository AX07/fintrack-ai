import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useFinance } from '../hooks/useFinance';
import { useApiKey } from '../hooks/useApiKey';
import Card from '../components/Card';
import { LogoIcon, SparklesIcon } from '../components/Icons';
import { Html5Qrcode } from 'html5-qrcode';
import { SyncPayload, FinanceData } from '../types';
import pako from 'pako';

const fromV2Format = (compactData: any): SyncPayload | null => {
    try {
        const transactions = compactData.d.t.map((t: any[]) => ({
            id: t[0],
            date: t[1],
            description: t[2],
            amount: t[3],
            category: t[4],
            accountName: t[5] || undefined,
        }));

        const accounts = compactData.d.a.map((a: any[]) => {
            const holdings = a[5].map((h: any[]) => ({
                id: h[0],
                name: h[1],
                ticker: h[2] || undefined,
                quantity: h[3],
                value: h[4],
            }));
            return {
                id: a[0],
                name: a[1],
                category: a[2],
                institution: a[3] || undefined,
                balance: a[4],
                holdings: holdings.length > 0 ? holdings : undefined,
            };
        });

        const financeData: FinanceData = {
            transactions,
            accounts,
            transactionCategories: compactData.d.tc,
            lastUpdated: compactData.d.lu,
            conversationHistory: [],
        };

        return {
            user: compactData.u,
            financeData: financeData,
            apiKey: compactData.k,
        };
    } catch (error) {
        console.error("Failed to parse V2 compact data format", error);
        return null;
    }
};

interface ScanProgress {
    sessionId: string | null;
    total: number;
    collected: number;
    chunks: { [key: number]: string };
}

const LoginPage: React.FC = () => {
    const [name, setName] = useState('');
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [mode, setMode] = useState<'create' | 'scan'>('create');
    const [scanError, setScanError] = useState<string | null>(null);
    const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
    
    const { createUserAndLogin, login, isAuthenticated } = useAuth();
    const { saveApiKey } = useApiKey();
    const { setData } = useFinance();
    const navigate = useNavigate();

    const scannerRef = useRef<Html5Qrcode | null>(null);
    const scanTimeoutRef = useRef<number | null>(null);

    const resetScanState = useCallback(() => {
        setScanProgress(null);
        setScanError(null);
        if (scanTimeoutRef.current) {
            clearTimeout(scanTimeoutRef.current);
            scanTimeoutRef.current = null;
        }
    }, []);

    const processPayload = useCallback((payload: any) => {
        if (payload && payload.user && payload.financeData && 'apiKey' in payload) {
            login(payload.user);
            setData(payload.financeData);
            if (payload.apiKey) {
                saveApiKey(payload.apiKey);
            }
            navigate('/dashboard');
        } else {
            let errorMessage = "Could not read the QR code. It may be invalid or from an unsupported version. Please generate a new code from an up-to-date device and try again.";
            console.error("QR Scan Parse Error:", errorMessage, "Payload:", payload);
            setScanError(errorMessage);
        }
    }, [login, setData, saveApiKey, navigate]);
    
    const onScanSuccess = useCallback(async (decodedText: string) => {
        if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);

        const trimmedText = decodedText.trim();
        
        // --- Multi-part QR Code Handling ---
        if (trimmedText.startsWith('FINT_M_V1:')) {
            const parts = trimmedText.split(':');
            if (parts.length < 5) return; // Ignore invalid format
            
            const [, sessionId, indexStr, totalStr, ...dataParts] = parts;
            const data = dataParts.join(':');
            const index = parseInt(indexStr, 10);
            const total = parseInt(totalStr, 10);

            let currentProgress = scanProgress;
            if (!currentProgress || currentProgress.sessionId !== sessionId) {
                currentProgress = { sessionId, total, collected: 0, chunks: {} };
            }
            
            if (!currentProgress.chunks[index]) {
                const newChunks = { ...currentProgress.chunks, [index]: data };
                const collected = Object.keys(newChunks).length;
                const newProgressState = { ...currentProgress, chunks: newChunks, collected };
                setScanProgress(newProgressState);

                if (collected === total) {
                    if (scannerRef.current?.isScanning) {
                        await scannerRef.current.stop();
                    }

                    let reassembledData = '';
                    for (let i = 1; i <= total; i++) {
                        reassembledData += newChunks[i];
                    }
                    
                    resetScanState();
                    return onScanSuccess(reassembledData); // Recursively call with reassembled data
                }
            }
            
            scanTimeoutRef.current = window.setTimeout(() => {
                setScanError("Scan timed out. Please try again from the beginning.");
                resetScanState();
            }, 5000); // 5 second timeout
            return;
        }
        
        // --- Single QR Code Handling ---
        if (scannerRef.current?.isScanning) await scannerRef.current.stop();
        
        let payload: SyncPayload | null = null;
        if (trimmedText.startsWith('FINT_V2:')) {
            try {
                const base64String = trimmedText.substring('FINT_V2:'.length);
                const compressedBinaryStr = atob(base64String);
                const compressedData = Uint8Array.from(compressedBinaryStr, c => c.charCodeAt(0));
                const jsonString = pako.inflate(compressedData, { to: 'string' });
                payload = fromV2Format(JSON.parse(jsonString));
            } catch (e) { console.error("Failed to parse V2 QR code", e); }
        } else if (trimmedText.startsWith('FINT_C_V1:')) {
            try {
                const base64String = trimmedText.substring('FINT_C_V1:'.length);
                const compressedBinaryStr = atob(base64String);
                const compressedData = Uint8Array.from(compressedBinaryStr, c => c.charCodeAt(0));
                const jsonString = pako.inflate(compressedData, { to: 'string' });
                payload = JSON.parse(jsonString);
            } catch (e) { console.error("Failed to parse V1 QR code", e); }
        } else {
            try {
                payload = JSON.parse(trimmedText);
            } catch (e) { /* Not JSON */ }
        }

        processPayload(payload);
    }, [processPayload, resetScanState, scanProgress]);
    
    const startScanner = useCallback(() => {
        resetScanState();
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;
        const config = { fps: 5, qrbox: { width: 250, height: 250 }, supportedScanTypes: [] };

        scanner.start({ facingMode: "environment" }, config, onScanSuccess, (errorMessage) => {})
        .catch(err => {
            setScanError(`Camera Error: ${err}. Please ensure camera permissions are enabled.`);
        });
    }, [onScanSuccess, resetScanState]);

    useEffect(() => {
        if (mode === 'scan') {
            startScanner();
        }
        return () => {
            if (scannerRef.current?.isScanning) {
                scannerRef.current.stop().catch(e => console.error("Error stopping scanner on cleanup", e));
            }
            if (scanTimeoutRef.current) {
                clearTimeout(scanTimeoutRef.current);
            }
        };
    }, [mode, startScanner]);
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() && apiKeyInput.trim()) {
            saveApiKey(apiKeyInput.trim());
            createUserAndLogin(name.trim());
        }
    };
    
    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
            <div className="text-center mb-8">
                <div className="flex justify-center items-center gap-3 mb-4">
                    <LogoIcon className="h-12 w-12 text-accent" />
                    <h1 className="text-4xl font-bold text-text-primary">FinTrack AI</h1>
                </div>
                <p className="text-lg text-text-secondary max-w-xl mx-auto">
                    Your intelligent, private, and local-first financial dashboard.
                </p>
            </div>

            <div className="w-full max-w-md">
                {mode === 'create' ? (
                    <Card>
                        <h2 className="text-xl font-bold text-center text-text-primary mb-2">Get Started</h2>
                        <p className="text-sm text-text-secondary text-center mb-6">
                            FinTrack AI runs entirely on your device. Your financial data is never sent to a server. Enter a nickname and your Gemini API key to begin.
                        </p>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-text-secondary mb-1">
                                    Name or Nickname
                                </label>
                                <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-primary border border-secondary rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                                    placeholder="e.g., Alex's Finances" />
                            </div>
                            <div>
                                <label htmlFor="apiKey" className="block text-sm font-medium text-text-secondary mb-1">
                                    Google Gemini API Key
                                </label>
                                <input id="apiKey" type="password" required value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)}
                                    className="w-full bg-primary border border-secondary rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                                    placeholder="Paste your API key" />
                                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline mt-1 inline-block">
                                    Get a free key from Google AI Studio
                                </a>
                            </div>
                            <button type="submit" disabled={!name.trim() || !apiKeyInput.trim()}
                                className="w-full bg-accent text-white font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
                                Start Tracking
                            </button>
                        </form>
                        <div className="relative my-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-secondary" /></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-surface text-text-secondary">OR</span></div></div>
                        <button type="button" onClick={() => setMode('scan')}
                            className="w-full flex justify-center items-center gap-3 bg-surface border border-secondary text-text-primary font-semibold py-2.5 rounded-lg hover:bg-primary transition-colors">
                            <SparklesIcon className="w-5 h-5" />
                            Sign In with QR Code
                        </button>
                    </Card>
                ) : (
                    <Card>
                        <h2 className="text-xl font-bold text-center text-text-primary mb-2">Sign in with QR Code</h2>
                        <p className="text-sm text-text-secondary text-center mb-6">
                            Scan the animated code from another device to clone its profile.
                        </p>
                        <div id="qr-reader" className="w-full rounded-lg overflow-hidden border-2 border-secondary bg-black"></div>
                        {scanProgress && (
                            <p className="text-lg text-accent text-center font-semibold mt-4 animate-pulse">
                                Scanning... {scanProgress.collected} / {scanProgress.total} parts received.
                            </p>
                        )}
                        {scanError && <p className="text-sm text-negative-text text-center mt-4">{scanError}</p>}
                        <button
                            type="button" onClick={() => setMode('create')}
                            className="w-full mt-6 bg-secondary text-text-primary font-semibold py-2.5 rounded-lg hover:bg-primary transition-colors">
                            Back to Manual Setup
                        </button>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default LoginPage;
