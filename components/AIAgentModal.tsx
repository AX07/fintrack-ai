import React from 'react';
import { useFinance } from '../hooks/useFinance';
import { SparklesIcon } from './Icons';

const AIAgentModal: React.FC = () => {
    const { aiProcessingStatus } = useFinance();

    if (!aiProcessingStatus.isProcessing) {
        return null;
    }

    return (
        <div 
            className="fixed top-0 left-0 right-0 bg-accent/95 backdrop-blur-sm text-white p-3 text-center z-[100] text-sm flex items-center justify-center gap-3 shadow-lg"
            role="status"
            aria-live="polite"
        >
            <SparklesIcon className="w-5 h-5 animate-pulse" />
            <span className="font-semibold">{aiProcessingStatus.message}</span>
        </div>
    );
};

export default AIAgentModal;
