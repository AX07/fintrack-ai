import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Peer } from 'peerjs';
import pako from 'pako';
import { useAuth } from '../hooks/useAuth';
import { useGeminiApiKey } from '../hooks/useApiKey';
import { fromV2Format } from '../utils/sync';
import Card from '../components/Card';
import { LogoIcon, SparklesIcon } from '../components/Icons';
import { SyncPayload, defaultTransactionCategories } from '../types';

const SyncPage: React.FC = () => {
    const { peerId } = useParams<{ peerId: string }>();
    const navigate = useNavigate();
    const { login } = useAuth();
    const { saveApiKey: saveGeminiApiKey } = useGeminiApiKey();
    
    const [status, setStatus] = useState('Initializing...');
    const peerRef = useRef<Peer | null>(null);

    useEffect(() => {
        if (!peerId) {
            setStatus('Error: No sync ID provided in the link.');
            return;
        }

        const cleanupPeer = () => {
            if (peerRef.current) {
                peerRef.current.destroy();
                peerRef.current = null;
            }
        };

        try {
            const peer = new Peer();
            peerRef.current = peer;

            peer.on('open', () => {
                setStatus('Connecting to your other device...');
                const conn = peer.connect(peerId, { reliable: true });

                conn.on('open', () => {
                    setStatus('Connection established. Waiting for data...');
                });

                conn.on('data', (data) => {
                    setStatus('Data received. Setting up your profile...');
                    try {
                        const compressedData = data as Uint8Array;
                        const jsonString = pako.inflate(compressedData, { to: 'string' });
                        const receivedData = JSON.parse(jsonString);
                        let payload: SyncPayload | null = null;
                        
                        if (receivedData.v === 2) {
                            payload = fromV2Format(receivedData);
                        } else if (receivedData.user && receivedData.financeData) { // Legacy V1
                            payload = {
                                user: receivedData.user,
                                financeData: {
                                    settings: receivedData.financeData.settings || { displayCurrency: 'USD' },
                                    transactions: receivedData.financeData.transactions || [],
                                    accounts: receivedData.financeData.accounts || [],
                                    conversationHistory: receivedData.financeData.conversationHistory || [],
                                    transactionCategories: receivedData.financeData.transactionCategories || defaultTransactionCategories,
                                    lastUpdated: receivedData.financeData.lastUpdated || new Date().toISOString(),
                                    // FIX: Add missing 'aiProcessingStatus' property to conform to FinanceData type.
                                    aiProcessingStatus: { isProcessing: false, message: '' },
                                },
                                geminiApiKey: receivedData.geminiApiKey || receivedData.apiKey || null, // Legacy used 'apiKey'
                            };
                        }

                        if (payload && payload.user && payload.financeData) {
                            if (payload.geminiApiKey) saveGeminiApiKey(payload.geminiApiKey);
                            
                            login(payload.user, payload.financeData);
                            setStatus('Sync complete! Welcome back.');
                            setTimeout(() => navigate('/dashboard'), 1500);
                        } else {
                            throw new Error('Invalid data format received.');
                        }
                    } catch (e: any) {
                        console.error('Error processing received data:', e);
                        setStatus(`Error: Failed to process data. Please try again. Details: ${e.message}`);
                    } finally {
                        conn.close();
                        cleanupPeer();
                    }
                });

                conn.on('error', (err) => {
                    setStatus(`Connection error: ${err.type}. Please close this page and try generating a new link.`);
                    cleanupPeer();
                });

                conn.on('close', () => {
                    if (status.includes('...')) {
                       setStatus('The connection was closed. Please try again.');
                    }
                });
            });
            
            peer.on('error', (err) => {
                setStatus(`Error: Could not establish a connection (${err.type}). Please check your network and try again.`);
                cleanupPeer();
            });

        } catch (e) {
            console.error("Failed to initialize PeerJS on sync page", e);
            setStatus('Error: Could not initialize the sync service.');
        }

        return () => cleanupPeer();

    }, [peerId, login, navigate, saveGeminiApiKey]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-text-primary">
            <Card className="w-full max-w-md text-center">
                <div className="flex justify-center items-center gap-3 mb-4">
                    <LogoIcon className="h-10 w-10 text-accent" />
                    <h1 className="text-3xl font-bold">FinTrack AI</h1>
                </div>
                <h2 className="text-xl font-semibold mb-6">Device Sync in Progress</h2>
                <div className="flex justify-center items-center space-x-2 my-4 p-4 bg-primary rounded-lg">
                    <SparklesIcon className="w-6 h-6 text-accent animate-pulse flex-shrink-0"/>
                    <p className="text-lg text-text-secondary">{status}</p>
                </div>
                <p className="text-sm text-text-secondary mt-6">
                    Please keep this page open until the process is complete. This may take a moment depending on the size of your profile.
                </p>
            </Card>
        </div>
    );
};

export default SyncPage;