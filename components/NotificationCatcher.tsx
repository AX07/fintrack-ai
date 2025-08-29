import React, { useState, useEffect, useRef } from 'react';
import { useFinance, useCurrency } from '../hooks/useFinance';
import { getNotifications } from '../services/notificationService';
import { AppNotification, Currency } from '../types';
import Card from './Card';
import { BellIcon } from './Icons';

const NotificationCatcher: React.FC = () => {
    const { addTransaction, accounts, transactionCategories } = useFinance();
    const { formatCurrency } = useCurrency();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [approvalModal, setApprovalModal] = useState<{
        isOpen: boolean;
        notification: AppNotification | null,
        selectedAccountId: string,
        selectedCategory: string,
    }>({ isOpen: false, notification: null, selectedAccountId: '', selectedCategory: 'Other' });

    const dropdownRef = useRef<HTMLDivElement>(null);
    const bellRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        // Fetch initial notifications and store them.
        // In a real app, this might come from a push notification service.
        setNotifications(getNotifications());
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isDropdownOpen && dropdownRef.current && !dropdownRef.current.contains(event.target as Node) && !bellRef.current?.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isDropdownOpen]);

    const bankAccounts = accounts.filter(acc => acc.category === 'Bank Accounts');
    const unreadCount = notifications.filter(n => !n.read).length;

    const handleApproveClick = (notification: AppNotification) => {
        setIsDropdownOpen(false);
        setApprovalModal({
            isOpen: true,
            notification,
            selectedAccountId: bankAccounts.length > 0 ? bankAccounts[0].id : '',
            selectedCategory: 'Other', // Default category
        });
    };

    const handleConfirmApproval = () => {
        if (!approvalModal.notification || !approvalModal.selectedAccountId) return;

        const selectedAccount = accounts.find(a => a.id === approvalModal.selectedAccountId);
        if (!selectedAccount) return;

        addTransaction({
            date: new Date().toISOString().split('T')[0],
            description: approvalModal.notification.description,
            category: approvalModal.selectedCategory,
            accountName: selectedAccount.name,
            originalAmount: {
                value: -Math.abs(approvalModal.notification.amount), // Expenses are negative
                currency: approvalModal.notification.currency,
            }
        });
        
        // Mark notification as read
        setNotifications(prev => prev.map(n => n.id === approvalModal.notification?.id ? { ...n, read: true } : n));
        setApprovalModal({ isOpen: false, notification: null, selectedAccountId: '', selectedCategory: 'Other' });
    };

    return (
        <div className="relative">
            <button
                ref={bellRef}
                onClick={() => setIsDropdownOpen(prev => !prev)}
                className="relative p-1 rounded-full text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-accent"
            >
                <BellIcon className="h-6 w-6" />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-negative ring-2 ring-surface" />
                )}
            </button>

            {isDropdownOpen && (
                <div ref={dropdownRef} className="origin-top-right absolute right-0 mt-2 w-80 rounded-md shadow-lg bg-surface border border-secondary ring-1 ring-black ring-opacity-5 z-20">
                    <div className="py-1">
                        <div className="px-4 py-2 border-b border-secondary">
                            <p className="text-sm font-semibold text-text-primary">Notifications</p>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                            {notifications.length > 0 ? notifications.map(n => (
                                <div key={n.id} className={`px-4 py-3 ${n.read ? 'opacity-60' : ''}`}>
                                    <p className="text-xs text-text-secondary">{n.source} - {new Date(n.timestamp).toLocaleTimeString()}</p>
                                    <p className="text-sm text-text-primary font-medium">{n.description}</p>
                                    <div className="flex justify-between items-center mt-2">
                                        <p className="text-sm font-bold text-accent">{formatCurrency(n.amount)}</p>
                                        {!n.read && (
                                            <button onClick={() => handleApproveClick(n)} className="text-xs bg-accent text-white font-semibold py-1 px-2 rounded-md hover:opacity-90">
                                                Approve
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )) : (
                                <p className="text-sm text-text-secondary text-center py-4">No new notifications.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {approvalModal.isOpen && approvalModal.notification && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <Card className="max-w-md w-full">
                        <h2 className="text-xl font-bold mb-2">Approve Transaction</h2>
                        <p className="text-text-secondary mb-4">Confirm the details for this payment notification.</p>
                        
                        <div className="bg-primary p-3 rounded-lg text-sm space-y-1 mb-4">
                            <p><strong>Description:</strong> {approvalModal.notification.description}</p>
                            <p><strong>Amount:</strong> {formatCurrency(approvalModal.notification.amount)} ({approvalModal.notification.currency})</p>
                        </div>

                        <div className="space-y-4">
                             <div>
                                <label htmlFor="account" className="block text-sm font-medium text-text-secondary mb-1">Account</label>
                                {bankAccounts.length > 0 ? (
                                    <select id="account" value={approvalModal.selectedAccountId} onChange={(e) => setApprovalModal(s => ({ ...s, selectedAccountId: e.target.value }))} className="w-full bg-primary border border-secondary rounded-lg px-4 py-2">
                                        {bankAccounts.map(acc => (<option key={acc.id} value={acc.id}>{acc.name}</option>))}
                                    </select>
                                ) : (<p className="text-sm text-text-secondary p-3 bg-primary rounded-lg">No bank accounts found.</p>)}
                            </div>
                            <div>
                                <label htmlFor="category" className="block text-sm font-medium text-text-secondary mb-1">Category</label>
                                <select id="category" value={approvalModal.selectedCategory} onChange={(e) => setApprovalModal(s => ({ ...s, selectedCategory: e.target.value }))} className="w-full bg-primary border border-secondary rounded-lg px-4 py-2">
                                    {transactionCategories.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setApprovalModal({ ...approvalModal, isOpen: false })} className="bg-secondary hover:bg-primary font-semibold py-2 px-4 rounded-lg">Cancel</button>
                            <button onClick={handleConfirmApproval} disabled={!approvalModal.selectedAccountId} className="bg-accent hover:opacity-90 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">Log Transaction</button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default NotificationCatcher;
