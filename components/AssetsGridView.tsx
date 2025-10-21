
import React, { useState, useMemo } from 'react';
import { useFinance, useCurrency } from '../hooks/useFinance';
import { Account, Holding, AssetCategory } from '../types';
import Card from './Card';
import { PlusIcon, PencilIcon, TrashIcon } from './Icons';

const assetCategories: AssetCategory[] = ['Bank Accounts', 'Equities', 'Bonds', 'Crypto', 'Commodities', 'Real Estate'];

const AssetsGridView: React.FC = () => {
    const { accounts, addSingleAccount, updateAccount, deleteAccount, addHolding, updateHolding, removeHolding } = useFinance();
    const { formatCurrency } = useCurrency();

    const [isEditing, setIsEditing] = useState(false);
    const [editedData, setEditedData] = useState<{
        accounts: Record<string, Partial<Account>>,
        holdings: Record<string, Partial<Holding>>,
    }>({ accounts: {}, holdings: {} });

    const [isAddAccountModalOpen, setAddAccountModalOpen] = useState(false);
    const [newAccount, setNewAccount] = useState<Omit<Account, 'id'>>({ name: '', category: 'Equities', balance: 0 });

    const [isAddHoldingModalOpen, setAddHoldingModalOpen] = useState(false);
    const [newHolding, setNewHolding] = useState<Omit<Holding, 'id' | 'value'>>({ name: '', ticker: '', quantity: 0, price: 0 });

    const allUniqueHoldings = useMemo(() => {
        const holdingsMap = new Map<string, Omit<Holding, 'id' | 'quantity' | 'value'>>();
        accounts.forEach(acc => {
            acc.holdings?.forEach(h => {
                if (!holdingsMap.has(h.name)) {
                    holdingsMap.set(h.name, { name: h.name, ticker: h.ticker, price: h.price, apiId: h.apiId });
                }
            });
        });
        return Array.from(holdingsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [accounts]);

    const gridData = useMemo(() => {
        return accounts.map(account => {
            const holdingsMap = new Map<string, Holding>();
            account.holdings?.forEach(h => holdingsMap.set(h.name, h));
            return { account, holdingsMap };
        });
    }, [accounts]);

    const totals = useMemo(() => {
        const totalsMap = new Map<string, { totalQuantity: number, totalValue: number }>();
        allUniqueHoldings.forEach(uniqueHolding => {
            let totalQuantity = 0;
            gridData.forEach(({ holdingsMap }) => {
                const holding = holdingsMap.get(uniqueHolding.name);
                if (holding) totalQuantity += holding.quantity;
            });
            totalsMap.set(uniqueHolding.name, { totalQuantity, totalValue: totalQuantity * uniqueHolding.price });
        });
        return totalsMap;
    }, [allUniqueHoldings, gridData]);

    const handleEditToggle = () => {
        if (isEditing) {
            // Save changes
            Object.entries(editedData.accounts).forEach(([id, data]) => {
                if (Object.keys(data).length > 0) updateAccount({ id, data });
            });
            Object.entries(editedData.holdings).forEach(([id, data]) => {
                const holdingToUpdate = accounts.flatMap(a => a.holdings).find(h => h?.id === id);
                if (holdingToUpdate) {
                    const accountId = accounts.find(a => a.holdings?.some(h => h.id === id))!.id;
                    updateHolding({ accountId, holdingId: id, data });
                }
            });
            setEditedData({ accounts: {}, holdings: {} });
        }
        setIsEditing(!isEditing);
    };

    const handleAccountChange = (accountId: string, field: keyof Account, value: string) => {
        setEditedData(prev => ({ ...prev, accounts: { ...prev.accounts, [accountId]: { ...prev.accounts[accountId], [field]: value }}}));
    };

    const handleQuantityChange = (account: Account, uniqueHolding: Omit<Holding, 'id' | 'value' | 'quantity'>, value: string) => {
        const existingHolding = account.holdings?.find(h => h.name === uniqueHolding.name);
        const quantity = parseFloat(value) || 0;

        if (existingHolding) {
            updateHolding({ accountId: account.id, holdingId: existingHolding.id, data: { quantity } });
        } else if (quantity > 0) {
            addHolding({ accountId: account.id, holding: { ...uniqueHolding, quantity } });
        }
    };
    
    const handleAddAccountSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newAccount.name.trim()) {
            addSingleAccount(newAccount);
            setNewAccount({ name: '', category: 'Equities', balance: 0 });
            setAddAccountModalOpen(false);
        }
    };

    const handleAddHoldingSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newHolding.name.trim() && accounts.length > 0) {
            // Add this new holding type to the first account with quantity 0 to make the column appear
            addHolding({ accountId: accounts[0].id, holding: { ...newHolding, quantity: 0 }});
            setNewHolding({ name: '', ticker: '', quantity: 0, price: 0 });
            setAddHoldingModalOpen(false);
        } else {
            alert("You must have at least one account to add an asset.");
        }
    };

    const handleRemoveHoldingColumn = (holdingName: string) => {
        if (window.confirm(`Are you sure you want to remove the asset "${holdingName}" from ALL accounts? This cannot be undone.`)) {
            accounts.forEach(acc => {
                const holdingToRemove = acc.holdings?.find(h => h.name === holdingName);
                if (holdingToRemove) {
                    removeHolding({ accountId: acc.id, holdingId: holdingToRemove.id });
                }
            });
        }
    };

    return (
        <Card>
            {isAddAccountModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <Card className="max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4">Add New Account</h2>
                        <form onSubmit={handleAddAccountSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="acc-name" className="block text-sm font-medium text-text-secondary mb-1">Account Name</label>
                                <input id="acc-name" type="text" value={newAccount.name} onChange={e => setNewAccount(p => ({...p, name: e.target.value}))} className="w-full bg-primary border border-secondary rounded-lg px-4 py-2" required autoFocus/>
                            </div>
                            <div>
                                <label htmlFor="acc-category" className="block text-sm font-medium text-text-secondary mb-1">Category</label>
                                <select id="acc-category" value={newAccount.category} onChange={e => setNewAccount(p => ({...p, category: e.target.value as AssetCategory}))} className="w-full bg-primary border border-secondary rounded-lg px-4 py-2">
                                    {assetCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setAddAccountModalOpen(false)} className="bg-secondary hover:bg-primary font-semibold py-2 px-4 rounded-lg">Cancel</button>
                                <button type="submit" className="bg-accent hover:opacity-90 text-white font-semibold py-2 px-4 rounded-lg">Add Account</button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
             {isAddHoldingModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <Card className="max-w-md w-full">
                        <h2 className="text-xl font-bold mb-4">Add New Asset Type</h2>
                        <form onSubmit={handleAddHoldingSubmit} className="space-y-4">
                             <div>
                                <label htmlFor="hld-name" className="block text-sm font-medium text-text-secondary mb-1">Asset Name</label>
                                <input id="hld-name" type="text" value={newHolding.name} onChange={e => setNewHolding(p => ({...p, name: e.target.value}))} placeholder="e.g. Apple Inc." className="w-full bg-primary border border-secondary rounded-lg px-4 py-2" required autoFocus/>
                            </div>
                             <div>
                                <label htmlFor="hld-ticker" className="block text-sm font-medium text-text-secondary mb-1">Ticker</label>
                                <input id="hld-ticker" type="text" value={newHolding.ticker || ''} onChange={e => setNewHolding(p => ({...p, ticker: e.target.value}))} placeholder="e.g. AAPL" className="w-full bg-primary border border-secondary rounded-lg px-4 py-2" />
                            </div>
                            <div>
                                <label htmlFor="hld-price" className="block text-sm font-medium text-text-secondary mb-1">Price (USD)</label>
                                <input id="hld-price" type="number" step="any" value={newHolding.price} onChange={e => setNewHolding(p => ({...p, price: parseFloat(e.target.value) || 0}))} className="w-full bg-primary border border-secondary rounded-lg px-4 py-2" required />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setAddHoldingModalOpen(false)} className="bg-secondary hover:bg-primary font-semibold py-2 px-4 rounded-lg">Cancel</button>
                                <button type="submit" className="bg-accent hover:opacity-90 text-white font-semibold py-2 px-4 rounded-lg">Add Asset</button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-4">
                <h2 className="text-2xl font-semibold">Assets Grid</h2>
                <div className="flex gap-3">
                    <button onClick={() => setAddAccountModalOpen(true)} className="flex items-center gap-2 bg-secondary hover:bg-primary font-semibold py-2 px-4 rounded-lg"><PlusIcon className="w-4 h-4" /> Add Account</button>
                    <button onClick={() => setAddHoldingModalOpen(true)} className="flex items-center gap-2 bg-secondary hover:bg-primary font-semibold py-2 px-4 rounded-lg"><PlusIcon className="w-4 h-4" /> Add Asset</button>
                    <button onClick={handleEditToggle} className="flex items-center gap-2 bg-accent text-white font-semibold py-2 px-4 rounded-lg">
                        {isEditing ? 'Save Changes' : <><PencilIcon className="w-4 h-4" /> Edit Grid</>}
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm">
                    <thead className="border-b-2 border-secondary">
                        <tr>
                            <th className="p-3 font-semibold sticky left-0 bg-surface min-w-[200px]">Account</th>
                            {allUniqueHoldings.map(h => (
                                <th key={h.name} className="p-3 font-semibold text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <span>{h.name} <span className="text-text-secondary">{h.ticker}</span></span>
                                        {isEditing && <button onClick={() => handleRemoveHoldingColumn(h.name)} className="p-1 text-text-secondary hover:text-negative rounded-full hover:bg-negative/10"><TrashIcon className="w-3 h-3"/></button>}
                                    </div>
                                </th>
                            ))}
                            <th className="p-3 font-semibold text-right">Total Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        {gridData.map(({ account, holdingsMap }) => (
                            <tr key={account.id} className="border-b border-primary hover:bg-primary last:border-b-0">
                                <td className="p-2 font-medium sticky left-0 bg-surface min-w-[200px]">
                                    {isEditing ? (
                                        <div className="flex items-center gap-2">
                                            <input type="text" value={editedData.accounts[account.id]?.name ?? account.name} onChange={(e) => handleAccountChange(account.id, 'name', e.target.value)} className="bg-primary border border-secondary rounded-md p-2 w-full"/>
                                            <button onClick={() => deleteAccount({ accountId: account.id })} className="p-2 text-text-secondary hover:text-negative rounded-full hover:bg-negative/10"><TrashIcon className="w-4 h-4"/></button>
                                        </div>
                                    ) : ( <div>{account.name}</div> )}
                                </td>
                                {allUniqueHoldings.map(uniqueHolding => {
                                    const holding = holdingsMap.get(uniqueHolding.name);
                                    return (
                                        <td key={uniqueHolding.name} className="p-2 text-right">
                                            {isEditing ? (
                                                <input type="number" step="any" defaultValue={holding?.quantity || ''} onBlur={(e) => handleQuantityChange(account, uniqueHolding, e.target.value)} placeholder="0" className="bg-primary border border-secondary rounded-md p-2 w-24 text-right"/>
                                            ) : ( holding ? holding.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 }) : <span className="text-text-secondary">-</span> )}
                                        </td>
                                    );
                                })}
                                <td className="p-3 text-right font-semibold">{formatCurrency(account.balance)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-secondary bg-primary">
                            <td className="p-3 font-bold sticky left-0 bg-primary min-w-[200px]">Totals</td>
                            {allUniqueHoldings.map(h => (
                                <td key={h.name} className="p-3 font-bold text-right">
                                    <div className="flex flex-col">
                                        <span>{totals.get(h.name)?.totalQuantity.toLocaleString(undefined, { maximumFractionDigits: 8 })}</span>
                                        <span className="text-xs text-text-secondary font-medium">{formatCurrency(totals.get(h.name)?.totalValue || 0)}</span>
                                    </div>
                                </td>
                            ))}
                            <td className="p-3 text-right font-bold">{formatCurrency(accounts.reduce((sum, acc) => sum + acc.balance, 0))}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </Card>
    );
};

export default AssetsGridView;
