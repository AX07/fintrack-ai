import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useGeminiApiKey } from '../hooks/useApiKey';
import Card from '../components/Card';
import { LogoIcon, SparklesIcon } from '../components/Icons';
import { Html5Qrcode } from 'html5-qrcode';

const LoginPage: React.FC = () => {
    const [name, setName] = useState('');
    const [geminiApiKeyInput, setGeminiApiKeyInput] = useState('');
    const [mode, setMode] = useState<'create' | 'scan'>('create');
    const [scanError, setScanError] = useState<string | null>(null);
    
    const { createUserAndLogin, isAuthenticated } = useAuth();
    const { saveApiKey: saveGeminiApiKey } = useGeminiApiKey();

    const scannerRef = useRef<Html5Qrcode | null>(null);

    const onScanSuccess = useCallback((decodedText: string) => {
        try {
            const url = new URL(decodedText);
            if (url.hash.includes('/sync/')) {
                if (scannerRef.current?.isScanning) {
                    scannerRef.current.stop();
                }
                window.location.href = decodedText;
            } else {
                setScanError("Invalid QR code. Please scan a valid FinTrack AI sync code.");
            }
        } catch (error) {
            setScanError("Scanned QR code is not a valid URL. Please try again.");
        }
    }, []);
    
    const startScanner = useCallback(() => {
        setScanError(null);
        if (scannerRef.current && scannerRef.current.isScanning) return;
        
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;
        const config = { fps: 5, qrbox: { width: 250, height: 250 }, supportedScanTypes: [] };

        scanner.start({ facingMode: "environment" }, config, onScanSuccess, (errorMessage) => {})
        .catch(err => {
            setScanError(`Camera Error: ${err}. Please ensure camera permissions are enabled for this site.`);
        });
    }, [onScanSuccess]);

    useEffect(() => {
        if (mode === 'scan') {
            startScanner();
        }
        return () => {
            if (scannerRef.current?.isScanning) {
                scannerRef.current.stop().catch(e => console.error("Error stopping scanner on cleanup", e));
            }
        };
    }, [mode, startScanner]);
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() && geminiApiKeyInput.trim()) {
            saveGeminiApiKey(geminiApiKeyInput.trim());
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
                            FinTrack AI runs entirely on your device. Your financial data is never sent to a server.
                        </p>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-text-secondary mb-1">Name or Nickname</label>
                                <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-primary border border-secondary rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                                    placeholder="e.g., Alex's Finances" />
                            </div>
                            <div>
                                <label htmlFor="gemini-api-key" className="block text-sm font-medium text-text-secondary mb-1">Google Gemini API Key</label>
                                <input id="gemini-api-key" type="password" required value={geminiApiKeyInput} onChange={(e) => setGeminiApiKeyInput(e.target.value)}
                                    className="w-full bg-primary border border-secondary rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                                    placeholder="For AI features" />
                                <p className="text-xs text-text-secondary mt-1.5">Get a free key from Google AI Studio.</p>
                            </div>
                            <button type="submit" disabled={!name.trim() || !geminiApiKeyInput.trim()}
                                className="w-full bg-accent text-white font-semibold py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
                                Start Tracking
                            </button>
                        </form>
                        <div className="relative my-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-secondary" /></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-surface text-text-secondary">OR</span></div></div>
                        <button type="button" onClick={() => setMode('scan')}
                            className="w-full flex justify-center items-center gap-3 bg-surface border border-secondary text-text-primary font-semibold py-2.5 rounded-lg hover:bg-primary transition-colors">
                            <SparklesIcon className="w-5 h-5" />
                            Sign In via New Device Setup
                        </button>
                    </Card>
                ) : (
                    <Card>
                        <h2 className="text-xl font-bold text-center text-text-primary mb-2">Sign In with QR Code</h2>
                        <p className="text-sm text-text-secondary text-center mb-6">
                            On your other device, go to Profile &gt; New Device Setup and scan the code.
                        </p>
                        <div 
                            id="qr-reader" 
                            className="w-full rounded-lg overflow-hidden border-2 bg-black border-secondary"
                        ></div>
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