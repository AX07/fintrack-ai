import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useFinance, useCurrency } from '../hooks/useFinance';
import Card from '../components/Card';
import { Account, Holding, Currency } from '../types';
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '../components/Icons';

const AccountDetailPage: React.FC = () => {
    const { accountId } = useParams<{ accountId: string }>();
    const { accounts, addHolding, updateHolding, removeHolding } = useFinance();
    const { formatCurrency, convertToUSD, convertFromUSD, displayCurrency } = useCurrency();
    const navigate = useNavigate();

    const [account, setAccount] = useState<Account | null>(null);

    useEffect(() => {
        const foundAccount = accounts.find(acc => acc.id === accountId);
        if (foundAccount) {
            setAccount(foundAccount);
        } else {
            navigate('/assets');
        }
    }, [accountId, accounts, navigate]);

    const handleHoldingChange = (holdingId: string, field: keyof Omit<Holding, 'id' | 'value'>, value: string | number) => {
        if (!account) return;
        
        const data: Partial<Omit<Holding, 'id' | 'value'>> = {};
        let numericValue = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(numericValue)) numericValue = 0;

        if (field === 'price') {
            // User is editing the price in the display currency, convert it back to USD for storage
            data[field] = convertToUSD(numericValue, displayCurrency);
        } else if (field === 'quantity') {
            data[field] = numericValue;
        } else {
            data[field] = value as string;
        }
        updateHolding({ accountId: account.id, holdingId, data });
    };

    const handleAddNewHolding = () => {
        if (!account) return;
        addHolding({
            accountId: account.id,
            holding: { name: 'New Asset', ticker: '', quantity: 0, price: 0, apiId: '' }
        });
    };

    const handleRemoveHolding = (holdingId: string) => {
        if (!account) return;
        removeHolding({ accountId: account.id, holdingId });
    };

    if (!account) {
        return <div className="text-center text-text-secondary p-8">Loading account details...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <Link to="/assets" className="flex items-center gap-2 text-sm text-text-secondary hover:text-accent mb-2">
                    <ArrowLeftIcon className="w-4 h-4"/> Back to Assets
                </Link>
                <div className="hidden md:block">
                    <h1 className="text-2xl sm:text-3xl font-bold">Manage: {account.name}</h1>
                    <p className="text-text-secondary">{account.category}</p>
                </div>
            </div>

            <Card>
                <h2 className="text-lg font-medium text-text-secondary">Total Account Value</h2>
                <p className="text-3xl font-bold mt-1">{formatCurrency(account.balance)}</p>
            </Card>

            <Card>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">Holdings</h2>
                    <button onClick={handleAddNewHolding} className="flex items-center gap-2 bg-accent hover:opacity-90 text-white font-semibold py-2 px-4 rounded-lg">
                        <PlusIcon className="w-5 h-5" /> Add Holding
                    </button>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="border-b-2 border-secondary">
                            <tr className="text-sm text-text-secondary">
                                <th className="p-3 font-semibold">Name</th>
                                <th className="p-3 font-semibold">Ticker</th>
                                <th className="p-3 font-semibold text-right">Quantity</th>
                                <th className="p-3 font-semibold text-right">Price ({displayCurrency})</th>
                                <th className="p-3 font-semibold text-right">Total Value</th>
                                <th className="p-3 font-semibold text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(account.holdings && account.holdings.length > 0) ? (
                                account.holdings.map(holding => (
                                    <tr key={holding.id} className="border-b border-primary last:border-b-0">
                                        <td className="p-2"><input type="text" value={holding.name} onChange={e => handleHoldingChange(holding.id, 'name', e.target.value)} className="bg-primary border border-secondary rounded-md p-2 w-full"/></td>
                                        <td className="p-2"><input type="text" value={holding.ticker || ''} onChange={e => handleHoldingChange(holding.id, 'ticker', e.target.value)} className="bg-primary border border-secondary rounded-md p-2 w-24"/></td>
                                        <td className="p-2"><input type="number" step="any" value={holding.quantity} onChange={e => handleHoldingChange(holding.id, 'quantity', e.target.value)} className="bg-primary border border-secondary rounded-md p-2 w-full text-right"/></td>
                                        <td className="p-2"><input type="number" step="0.01" value={convertFromUSD(holding.price, displayCurrency).toFixed(2)} onChange={e => handleHoldingChange(holding.id, 'price', e.target.value)} className="bg-primary border border-secondary rounded-md p-2 w-full text-right"/></td>
                                        <td className="p-2 text-right font-medium">{formatCurrency(holding.value)}</td>
                                        <td className="p-2 text-center"><button onClick={() => handleRemoveHolding(holding.id)} className="p-2 text-text-secondary hover:text-negative rounded-full hover:bg-negative/10"><TrashIcon className="w-5 h-5"/></button></td>
                                    </tr>
                                ))
                            ) : (
                                <tr><td colSpan={6} className="text-center p-8 text-text-secondary">No holdings in this account.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default AccountDetailPage;
