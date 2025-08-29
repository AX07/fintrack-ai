

import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Card from '../components/Card';
import { useFinance, useCurrency } from '../hooks/useFinance';
import { Account, AssetCategory } from '../types';
import { AssetsIcon, PencilIcon, TrashIcon, RefreshIcon } from '../components/Icons';
import EmptyState from '../components/EmptyState';
import { fetchAssetPrices } from '../services/marketDataService';

const AssetsPage: React.FC = () => {
    const { accounts, updateAccount, deleteAccount, updateHoldingPrices } = useFinance();
    const { formatCurrency } = useCurrency();
    const [isEditing, setIsEditing] = useState(false);
    const [isUpdatingPrices, setIsUpdatingPrices] = useState(false);
    const [editedValues, setEditedValues] = useState<Record<string, {name?: string, balance?: number}>>({});

    const totalAssetsValue = useMemo(() => accounts.reduce((sum, account) => sum + account.balance, 0), [accounts]);

    const allocationData = useMemo(() => {
        const byCategory = accounts.reduce((acc, account) => {
            acc[account.category] = (acc[account.category] || 0) + account.balance;
            return acc;
        }, {} as Record<AssetCategory, number>);

        if (Object.keys(byCategory).length === 0) return [];
        
        return Object.entries(byCategory)
            .map(([name, value]) => ({ name, value }))
            .filter(item => item.value > 0)
            .sort((a, b) => b.value - a.value);
    }, [accounts]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#E040FB'];

    const accountsByCategory = useMemo(() => {
        return accounts.reduce((acc, account) => {
            (acc[account.category] = acc[account.category] || []).push(account);
            return acc;
        }, {} as Record<AssetCategory, Account[]>);
    }, [accounts]);

    const handleUpdatePrices = async () => {
        setIsUpdatingPrices(true);
        const holdingsToUpdate = accounts.flatMap(acc => 
            (acc.holdings || []).filter(h => h.apiId).map(h => ({ apiId: h.apiId!, holdingId: h.id, accountId: acc.id }))
        );

        if (holdingsToUpdate.length > 0) {
            const apiIds = holdingsToUpdate.map(h => h.apiId);
            try {
                const priceMap = await fetchAssetPrices(apiIds);
                const priceUpdates = holdingsToUpdate
                    .map(h => ({ ...h, price: priceMap[h.apiId] }))
                    .filter(h => h.price !== undefined);
                if (priceUpdates.length > 0) updateHoldingPrices(priceUpdates);
            } catch (error) {
                console.error("Failed to fetch prices:", error);
                alert("Could not update asset prices. Please try again later.");
            }
        }
        setIsUpdatingPrices(false);
    };

    const handleEditToggle = () => {
        if (isEditing) {
            Object.entries(editedValues).forEach(([accountId, changes]) => {
                if (Object.keys(changes).length > 0) {
                    const originalAccount = accounts.find(a => a.id === accountId);
                    if (!originalAccount) return;
                    
                    const updatedData: Partial<Account> = {};
                    if(changes.name && changes.name.trim() && changes.name !== originalAccount.name) updatedData.name = changes.name.trim();
                    if(changes.balance !== undefined && changes.balance !== originalAccount.balance) updatedData.balance = changes.balance;

                    if(Object.keys(updatedData).length > 0) updateAccount({ id: accountId, data: updatedData });
                }
            });
            setEditedValues({});
        }
        setIsEditing(!isEditing);
    };

    const handleValueChange = (accountId: string, field: 'name' | 'balance', value: string | number) => {
        setEditedValues(prev => ({ ...prev, [accountId]: { ...prev[accountId], [field]: value } }));
    };

    const handleDeleteAccount = (accountId: string, accountName: string) => {
        if (window.confirm(`Delete "${accountName}"? All its transactions will also be deleted.`)) {
            deleteAccount({ accountId });
        }
    };

    if (accounts.length === 0) {
        return (
            <EmptyState
                icon={<AssetsIcon className="w-8 h-8" />}
                title="No Assets Found"
                message="Add financial accounts, brokerages, or other assets using the AI Agent."
                action={<Link to="/ai" className="bg-accent text-white font-semibold py-2 px-4 rounded-lg hover:opacity-90">Add an Account via AI</Link>}
            />
        );
    }

  return (
    <div className="space-y-6">
      <div className="hidden md:block">
        <h1 className="text-2xl sm:text-3xl font-bold">Assets</h1>
        <p className="text-text-secondary">Your complete financial picture in one place.</p>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div>
                <h2 className="text-lg font-medium text-text-secondary">Total Net Worth</h2>
                <p className="text-4xl font-bold text-text-primary mt-2">{formatCurrency(totalAssetsValue)}</p>
                <p className="text-text-secondary mt-2">Across {accounts.length} accounts.</p>
            </div>
            <div className="h-48">
                {allocationData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={allocationData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} fill="#8884d8">
                            {allocationData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #3a3a3a', borderRadius: '0.5rem' }}/>
                        <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" />
                    </PieChart>
                </ResponsiveContainer>
                ) : ( <div className="flex items-center justify-center h-full text-text-secondary"><p>No asset data for allocation chart.</p></div> )}
            </div>
        </div>
      </Card>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pt-2 gap-4">
            <h2 className="text-2xl font-semibold w-full sm:w-auto self-start sm:self-center">Your Accounts</h2>
             <div className="flex w-full sm:w-auto gap-3">
                <button onClick={handleUpdatePrices} disabled={isUpdatingPrices} className="flex w-full sm:w-auto justify-center items-center gap-2 bg-secondary hover:bg-primary font-semibold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-wait">
                    <RefreshIcon className={`w-4 h-4 ${isUpdatingPrices ? 'animate-spin' : ''}`} />{isUpdatingPrices ? 'Updating...' : 'Update Prices'}
                </button>
                <button onClick={handleEditToggle} className="flex w-full sm:w-auto justify-center items-center gap-2 bg-secondary hover:bg-primary font-semibold py-2 px-4 rounded-lg">
                    {isEditing ? 'Done' : <><PencilIcon className="w-4 h-4" /> Edit Accounts</>}
                </button>
            </div>
        </div>

        {Object.keys(accountsByCategory).length > 0 ? Object.entries(accountsByCategory).map(([category, accts]) => {
            const categoryTotal = accts.reduce((sum, acc) => sum + acc.balance, 0);
            return (
                <div key={category} className="space-y-4">
                    <div className="flex justify-between items-baseline px-2">
                        <h3 className="text-xl font-semibold">{category}</h3>
                        <span className="font-semibold text-lg text-text-secondary">{formatCurrency(categoryTotal)}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {accts.map(account => (
                            <Card key={account.id} className="relative flex flex-col justify-between">
                                {isEditing ? (
                                    <div>
                                        <button onClick={() => handleDeleteAccount(account.id, account.name)} className="absolute top-3 right-3 p-2 text-text-secondary hover:text-negative rounded-full hover:bg-negative/10" aria-label={`Delete ${account.name}`}><TrashIcon className="w-5 h-5" /></button>
                                        <div className="space-y-2 pr-8">
                                            <label className="text-xs text-text-secondary">Account Name</label>
                                            <input type="text" value={editedValues[account.id]?.name ?? account.name} onChange={(e) => handleValueChange(account.id, 'name', e.target.value)} className="bg-primary border border-secondary rounded-md px-3 py-2 w-full"/>
                                            {(account.holdings && account.holdings.length > 0) ? (
                                                 <div><label className="text-xs text-text-secondary">Balance (from holdings)</label><p className="font-semibold text-2xl mt-1">{formatCurrency(account.balance)}</p></div>
                                            ) : (
                                                <div>
                                                    <label className="text-xs text-text-secondary">Balance</label>
                                                    <input type="number" value={editedValues[account.id]?.balance ?? account.balance} onChange={(e) => handleValueChange(account.id, 'balance', parseFloat(e.target.value) || 0)} className="bg-primary border border-secondary rounded-md px-3 py-2 w-full"/>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <Link to={`/assets/${account.id}`} className="block hover:bg-primary/30 rounded-lg p-2 -m-2">
                                        <div><p className="font-semibold text-lg">{account.name}</p><p className="text-sm text-text-secondary">{account.institution}</p></div>
                                        <p className="font-semibold text-2xl mt-2">{formatCurrency(account.balance)}</p>
                                    </Link>
                                )}
                            </Card>
                        ))}
                    </div>
                </div>
            );
        }) : ( <Card><p className="text-center text-text-secondary py-8">No accounts found.</p></Card> )}
      </div>
    </div>
  );
};

export default AssetsPage;
