import React, { useState, useMemo, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Card from '../components/Card';
import { useFinance, useCurrency } from '../hooks/useFinance';
import { Transaction, TransactionCategory } from '../types';
import { PencilIcon, TrashIcon, XIcon, PlusIcon } from '../components/Icons';

const CategoryPill: React.FC<{ category: string }> = ({ category }) => (
    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-secondary text-text-secondary">{category}</span>
);

const SpendingPage: React.FC = () => {
    const { transactions, accounts, updateTransaction, deleteTransaction, updateTransactionsCategory, transactionCategories, addTransactionCategory } = useFinance();
    const { formatCurrency } = useCurrency();
    const [activeTab, setActiveTab] = useState('All');
    const [isEditing, setIsEditing] = useState(false);
    const [editedTransactions, setEditedTransactions] = useState<Record<string, Partial<Transaction>>>({});
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
    const transactionsCardRef = useRef<HTMLDivElement>(null);
    
    const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    const [updateModal, setUpdateModal] = useState<{
        isOpen: boolean;
        originalTransaction: Transaction;
        newCategory: TransactionCategory;
        similarTransactions: Transaction[];
    } | null>(null);

    const bankAccounts = useMemo(() => 
        accounts.filter(acc => acc.category === 'Bank Accounts'), 
    [accounts]);

    const totalSpentThisMonth = useMemo(() => {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return transactions
            .filter(t => t.amount < 0 && new Date(t.date) >= firstDayOfMonth)
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    }, [transactions]);

    const spendingByCategory = transactions
        .filter(t => t.amount < 0)
        .reduce((acc, t) => {
            if (!acc[t.category]) acc[t.category] = { value: 0, count: 0 };
            acc[t.category].value += Math.abs(t.amount);
            acc[t.category].count += 1;
            return acc;
        }, {} as Record<string, { value: number; count: number }>);

    const spendingChartData = Object.entries(spendingByCategory)
        .map(([name, data]) => ({ name, value: data.value, count: data.count }))
        .sort((a, b) => b.value - a.value);

    const displayedTransactions = useMemo(() => {
        return transactions
            .filter(t => (!categoryFilter || t.category === categoryFilter) && (activeTab === 'All' || t.accountName === activeTab))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, activeTab, categoryFilter]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ca8a04', '#65a30d'];

    const handleCategoryClick = (categoryName: string) => {
        setCategoryFilter(categoryName);
        transactionsCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleEditToggle = () => {
        if (isEditing) {
            Object.entries(editedTransactions).forEach(([id, changes]) => {
                if (Object.keys(changes).length > 0) updateTransaction({ id, ...changes });
            });
            setEditedTransactions({});
        }
        setIsEditing(!isEditing);
    };

    const handleTransactionChange = (id: string, field: keyof Transaction, value: any) => {
        if (isEditing && field === 'category') {
            const originalTransaction = transactions.find(t => t.id === id);
            if (!originalTransaction) return;

            const newCategory = value as TransactionCategory;
            const similarTransactions = transactions.filter(t => t.id !== id && t.description.toLowerCase() === originalTransaction.description.toLowerCase());
            
            if (similarTransactions.length > 0 && originalTransaction.category !== newCategory) {
                setUpdateModal({ isOpen: true, originalTransaction, newCategory, similarTransactions });
                // FIX: Prevent "Spread types may only be created from object types" error by providing a default empty object for prev[id].
                setEditedTransactions(prev => ({ ...prev, [id]: { ...(prev[id] || {}), category: newCategory } }));
                return; 
            }
        }
        // FIX: Prevent "Spread types may only be created from object types" error by providing a default empty object for prev[id].
        setEditedTransactions(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
    };

    const handleDeleteTransaction = (transactionId: string) => deleteTransaction({ transactionId });

    const handleModalConfirm = (updateAll: boolean) => {
        if (!updateModal) return;
        const { originalTransaction, newCategory, similarTransactions } = updateModal;
        if (updateAll) {
            const idsToUpdate = [originalTransaction.id, ...similarTransactions.map(t => t.id)];
            updateTransactionsCategory({ ids: idsToUpdate, category: newCategory });
        } else {
            updateTransaction({ id: originalTransaction.id, category: newCategory });
        }
        setEditedTransactions(prev => { const newEdited = { ...prev }; if (newEdited[originalTransaction.id]) delete newEdited[originalTransaction.id].category; return newEdited; });
        setUpdateModal(null);
    };

    const handleModalCancel = () => {
        if (!updateModal) return;
        setEditedTransactions(prev => {
            const newEdited = { ...prev };
            if (newEdited[updateModal.originalTransaction.id]) newEdited[updateModal.originalTransaction.id].category = updateModal.originalTransaction.category;
            return newEdited;
        });
        setUpdateModal(null);
    };

    const handleSaveNewCategory = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = newCategoryName.trim();
        if (trimmedName && !transactionCategories.find(c => c.toLowerCase() === trimmedName.toLowerCase())) {
            addTransactionCategory(trimmedName);
            setNewCategoryName('');
            setIsAddCategoryModalOpen(false);
        } else {
            alert("Category is empty or already exists.");
        }
    };

  return (
    <div className="space-y-6">
      {isAddCategoryModalOpen && (
         <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <Card className="max-w-sm w-full">
                <h2 className="text-xl font-bold mb-4">Add New Category</h2>
                <form onSubmit={handleSaveNewCategory}>
                    <label htmlFor="new-category-name" className="block text-sm font-medium text-text-secondary mb-1">Category Name</label>
                    <input id="new-category-name" type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="w-full bg-primary border border-secondary rounded-lg px-4 py-2" placeholder="e.g., Subscriptions" autoFocus />
                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={() => setIsAddCategoryModalOpen(false)} className="bg-secondary hover:bg-primary font-semibold py-2 px-4 rounded-lg">Cancel</button>
                        <button type="submit" className="bg-accent hover:opacity-90 text-white font-semibold py-2 px-4 rounded-lg">Save Category</button>
                    </div>
                </form>
            </Card>
        </div>
      )}

      {updateModal?.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <Card className="max-w-md w-full">
                <h2 className="text-xl font-bold mb-2">Update Category</h2>
                <p className="text-text-secondary mb-4">Found {updateModal.similarTransactions.length} other transaction(s) with the description "{updateModal.originalTransaction.description}".</p>
                <p className="text-text-secondary mb-6">Update all from '{updateModal.originalTransaction.category}' to '{updateModal.newCategory}'?</p>
                <div className="flex justify-end gap-3">
                    <button onClick={handleModalCancel} className="bg-transparent hover:bg-primary text-text-secondary font-semibold py-2 px-4 rounded-lg">Cancel</button>
                    <button onClick={() => handleModalConfirm(false)} className="bg-secondary hover:bg-primary font-semibold py-2 px-4 rounded-lg">Just This One</button>
                    <button onClick={() => handleModalConfirm(true)} className="bg-accent hover:opacity-90 text-white font-semibold py-2 px-4 rounded-lg">Update All ({updateModal.similarTransactions.length + 1})</button>
                </div>
            </Card>
        </div>
      )}

      <div className="hidden md:block">
        <h1 className="text-2xl sm:text-3xl font-bold">Spending</h1>
        <p className="text-text-secondary">Track and analyze your spending habits.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
              <h2 className="text-lg font-medium text-text-secondary">Total Spent This Month</h2>
              <p className="text-3xl font-bold mt-2">{formatCurrency(totalSpentThisMonth)}</p>
          </Card>
          <Card className="lg:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Spending by Category</h2>
            <div className="h-64">
                {spendingChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={spendingChartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value: number) => formatCurrency(value, { notation: 'compact' })}/>
                            <Tooltip cursor={{fill: 'rgba(107, 114, 128, 0.1)'}} contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #3a3a3a', borderRadius: '0.5rem' }} formatter={(value: number) => formatCurrency(value)}/>
                            <Bar dataKey="value" radius={[4, 4, 0, 0]} className="cursor-pointer" onClick={(data) => handleCategoryClick(data.name)}>
                                {spendingChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : ( <div className="flex items-center justify-center h-full text-text-secondary"><p>No spending data to display.</p></div> )}
            </div>
          </Card>
      </div>
      
      <Card>
        <h2 className="text-xl font-semibold mb-4">Spending Details</h2>
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="border-b border-secondary"><tr className="text-sm text-text-secondary"><th className="p-4 font-normal">Category</th><th className="p-4 font-normal text-right">Total Amount</th><th className="p-4 font-normal text-right"># of Transactions</th></tr></thead>
                <tbody>
                    {spendingChartData.length > 0 ? spendingChartData.map((item) => (
                        <tr key={item.name} onClick={() => handleCategoryClick(item.name)} className="cursor-pointer border-b border-primary hover:bg-primary last:border-b-0">
                            <td className="p-4 font-medium">{item.name}</td><td className="p-4 text-right font-semibold">{formatCurrency(item.value)}</td><td className="p-4 text-right">{item.count}</td>
                        </tr>
                    )) : ( <tr><td colSpan={3} className="text-center p-8 text-text-secondary">No spending data available.</td></tr> )}
                </tbody>
            </table>
        </div>
      </Card>

      <Card ref={transactionsCardRef}>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-4">
            <h2 className="text-xl font-semibold">Transactions{categoryFilter && (<span className="ml-3 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-text-secondary">{categoryFilter}<button onClick={() => setCategoryFilter(null)} className="flex-shrink-0 ml-1.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-text-secondary hover:bg-primary hover:text-text-primary"><XIcon className="h-3 w-3" /></button></span>)}</h2>
            <div className="flex items-center gap-3">
                {isEditing ? (<>
                    <button onClick={() => setIsAddCategoryModalOpen(true)} className="flex items-center gap-2 bg-secondary hover:bg-primary font-semibold py-2 px-4 rounded-lg"><PlusIcon className="w-4 h-4" />Add Category</button>
                    <button onClick={handleEditToggle} className="flex items-center bg-accent text-white font-semibold py-2 px-4 rounded-lg">Done</button>
                </>) : (<button onClick={handleEditToggle} className="flex items-center gap-2 bg-secondary hover:bg-primary font-semibold py-2 px-4 rounded-lg"><PencilIcon className="w-4 h-4" /> Edit Transactions</button>)}
            </div>
        </div>
        <div className="border-b border-secondary"><nav className="-mb-px flex space-x-6 overflow-x-auto"><button onClick={() => setActiveTab('All')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'All' ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-500'}`}>All Accounts</button>
            {bankAccounts.map(account => (<button key={account.id} onClick={() => setActiveTab(account.name)} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === account.name ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-500'}`}>{account.name}</button>))}
        </nav></div>
        <div className="overflow-x-auto mt-4">
            <table className="w-full text-left">
                <thead className="border-b border-secondary"><tr className="text-sm text-text-secondary"><th className="p-4 font-normal">Date</th><th className="p-4 font-normal">Description</th><th className="p-4 font-normal">Category</th><th className="p-4 font-normal text-right">Amount</th>{isEditing && <th className="p-4 font-normal text-center">Actions</th>}</tr></thead>
                <tbody>
                    {displayedTransactions.length > 0 ? displayedTransactions.map((t: Transaction) => (
                        <tr key={t.id} className="border-b border-primary hover:bg-primary last:border-b-0">
                            {isEditing ? (<>
                                <td className="p-2"><input type="date" value={editedTransactions[t.id]?.date ?? t.date} onChange={e => handleTransactionChange(t.id, 'date', e.target.value)} className="bg-primary border border-secondary rounded-md px-2 py-1 w-full"/></td>
                                <td className="p-2"><input type="text" value={editedTransactions[t.id]?.description ?? t.description} onChange={e => handleTransactionChange(t.id, 'description', e.target.value)} className="bg-primary border border-secondary rounded-md px-2 py-1 w-full"/></td>
                                <td className="p-2"><select value={editedTransactions[t.id]?.category ?? t.category} onChange={e => handleTransactionChange(t.id, 'category', e.target.value)} className="bg-primary border border-secondary rounded-md px-2 py-1 w-full">{transactionCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></td>
                                <td className="p-2"><input type="number" step="0.01" value={editedTransactions[t.id]?.amount ?? t.amount} onChange={e => handleTransactionChange(t.id, 'amount', parseFloat(e.target.value) || 0)} className="bg-primary border border-secondary rounded-md px-2 py-1 w-full text-right"/></td>
                                <td className="p-2 text-center"><button onClick={() => handleDeleteTransaction(t.id)} className="p-2 text-text-secondary hover:text-negative rounded-full hover:bg-negative/10" aria-label={`Delete transaction: ${t.description}`}><TrashIcon className="w-5 h-5" /></button></td>
                            </>) : (<>
                                <td className="p-4 text-sm text-text-secondary">{t.date}</td><td className="p-4 font-medium">{t.description}</td><td className="p-4"><CategoryPill category={t.category} /></td><td className={`p-4 text-right font-semibold ${t.amount > 0 ? 'text-positive-text' : 'text-text-primary'}`}>{t.amount > 0 ? `+${formatCurrency(t.amount)}` : formatCurrency(t.amount)}</td>
                            </>)}
                        </tr>
                    )) : (<tr><td colSpan={isEditing ? 5 : 4} className="text-center p-8 text-text-secondary">No transactions found.</td></tr>)}
                </tbody>
            </table>
        </div>
      </Card>
    </div>
  );
};

export default SpendingPage;