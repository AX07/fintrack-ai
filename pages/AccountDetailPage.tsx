
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useFinance } from '../hooks/useFinance';
import Card from '../components/Card';
import { Account, Holding } from '../types';
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '../components/Icons';

const formatCurrency = (value: number) => {
    if (isNaN(value)) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

const AccountDetailPage: React.FC = () => {
    const { accountId } = useParams<{ accountId: string }>();
    const { accounts, addHolding, updateHolding, removeHolding } = useFinance();
    const navigate = useNavigate();

    const [account, setAccount] = useState<Account | null>(null);

    useEffect(() => {
        const foundAccount = accounts.find(acc => acc.id === accountId);
        if (foundAccount) {
            setAccount(foundAccount);
        } else {
            // If account not found (e.g. page refresh before context loads, or bad ID), navigate away
            navigate('/assets');
        }
    }, [accountId, accounts, navigate]);

    const handleHoldingChange = (holdingId: string, field: keyof Holding, value: string | number) => {
        if (!account) return;
        const numericValue = typeof value === 'string' ? parseFloat(value) : value;
        updateHolding({
            accountId: account.id,
            holdingId,
            data: { [field]: field === 'name' || field === 'ticker' ? value : numericValue }
        });
    };

    const handleAddNewHolding = () => {
        if (!account) return;
        addHolding({
            accountId: account.id,
            holding: { name: 'New Asset', quantity: 0, value: 0 }
        });
    };

    const handleRemoveHolding = (holdingId: string) => {
        if (!account || !window.confirm("Are you sure you want to remove this holding?")) return;
        removeHolding({ accountId: account.id, holdingId });
    };

    if (!account) {
        return <div className="text-center text-text-secondary p-8">Loading account details...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <Link to="/assets" className="flex items-center gap-2 text-sm text-text-secondary hover:text-accent transition-colors mb-2">
                    <ArrowLeftIcon className="w-4 h-4"/>
                    Back to Assets
                </Link>
                <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">Manage: {account.name}</h1>
                <p className="text-text-secondary">{account.category}</p>
            </div>

            <Card>
                <h2 className="text-lg font-medium text-text-secondary">Total Account Value</h2>
                <p className="text-3xl font-bold text-text-primary mt-1">{formatCurrency(account.balance)}</p>
            </Card>

            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Holdings</h2>
                    <button
                        onClick={handleAddNewHolding}
                        className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                    >
                        <PlusIcon className="w-5 h-5" />
                        Add Holding
                    </button>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="border-b-2 border-secondary">
                            <tr className="text-sm text-text-secondary">
                                <th className="p-3 font-semibold">Name</th>
                                <th className="p-3 font-semibold">Ticker</th>
                                <th className="p-3 font-semibold text-right">Quantity</th>
                                <th className="p-3 font-semibold text-right">Value</th>
                                <th className="p-3 font-semibold text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(account.holdings && account.holdings.length > 0) ? (
                                account.holdings.map(holding => (
                                    <tr key={holding.id} className="border-b border-primary last:border-b-0">
                                        <td className="p-2">
                                            <input type="text" value={holding.name} onChange={e => handleHoldingChange(holding.id, 'name', e.target.value)} className="bg-primary border border-secondary rounded-md p-2 w-full focus:outline-none focus:ring-1 focus:ring-accent" />
                                        </td>
                                        <td className="p-2">
                                            <input type="text" value={holding.ticker || ''} onChange={e => handleHoldingChange(holding.id, 'ticker', e.target.value)} className="bg-primary border border-secondary rounded-md p-2 w-24 focus:outline-none focus:ring-1 focus:ring-accent" />
                                        </td>
                                        <td className="p-2">
                                            <input type="number" step="any" value={holding.quantity} onChange={e => handleHoldingChange(holding.id, 'quantity', e.target.value)} className="bg-primary border border-secondary rounded-md p-2 w-full text-right focus:outline-none focus:ring-1 focus:ring-accent" />
                                        </td>
                                        <td className="p-2">
                                            <input type="number" step="0.01" value={holding.value} onChange={e => handleHoldingChange(holding.id, 'value', e.target.value)} className="bg-primary border border-secondary rounded-md p-2 w-full text-right focus:outline-none focus:ring-1 focus:ring-accent" />
                                        </td>
                                        <td className="p-2 text-center">
                                            <button onClick={() => handleRemoveHolding(holding.id)} className="p-2 text-text-secondary hover:text-negative transition-colors rounded-full hover:bg-negative/10">
                                                <TrashIcon className="w-5 h-5"/>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="text-center p-8 text-text-secondary">
                                        No holdings in this account. Click "Add Holding" to start.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default AccountDetailPage;