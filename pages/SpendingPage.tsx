
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Card from '../components/Card';
import { useFinance } from '../hooks/useFinance';
import { Transaction, transactionCategories } from '../types';
import { PencilIcon } from '../components/Icons';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};

const CategoryPill: React.FC<{ category: string }> = ({ category }) => (
    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-secondary text-text-secondary">{category}</span>
);

const SpendingPage: React.FC = () => {
    const { transactions, accounts, updateTransaction } = useFinance();
    const [activeTab, setActiveTab] = useState('All');
    const [isEditing, setIsEditing] = useState(false);
    const [editedTransactions, setEditedTransactions] = useState<Record<string, Partial<Transaction>>>({});

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
            if (!acc[t.category]) {
                acc[t.category] = { value: 0, count: 0 };
            }
            acc[t.category].value += Math.abs(t.amount);
            acc[t.category].count += 1;
            return acc;
        }, {} as Record<string, { value: number; count: number }>);

    const spendingChartData = Object.entries(spendingByCategory)
        .map(([name, data]) => ({ name, value: data.value, count: data.count }))
        .sort((a, b) => b.value - a.value);

    const displayedTransactions = useMemo(() => {
        return transactions
            .filter(t => activeTab === 'All' || t.accountName === activeTab)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, activeTab]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ca8a04', '#65a30d'];

    const handleEditToggle = () => {
        if (isEditing) {
            Object.entries(editedTransactions).forEach(([id, changes]) => {
                if (Object.keys(changes).length > 0) {
                    updateTransaction({ id, ...changes });
                }
            });
            setEditedTransactions({});
        }
        setIsEditing(!isEditing);
    };

    const handleTransactionChange = (id: string, field: keyof Transaction, value: any) => {
        setEditedTransactions(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                [field]: value,
            }
        }));
    };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">Spending</h1>
        <p className="text-text-secondary">Track and analyze your spending habits.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
              <h2 className="text-lg font-medium text-text-secondary">Total Spent This Month</h2>
              <p className="text-3xl font-bold text-text-primary mt-2">{formatCurrency(totalSpentThisMonth)}</p>
          </Card>
          <Card className="lg:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Spending by Category</h2>
            <div className="h-64">
                {spendingChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={spendingChartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${Number(value)/1000}k`}/>
                            <Tooltip cursor={{fill: 'rgba(107, 114, 128, 0.1)'}} contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #3a3a3a', borderRadius: '0.5rem' }} formatter={(value) => formatCurrency(Number(value))}/>
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {spendingChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-text-secondary">
                        <p>No spending data to display.</p>
                    </div>
                )}
            </div>
          </Card>
      </div>
      
      <Card>
        <h2 className="text-xl font-semibold mb-4">Spending Details</h2>
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="border-b border-secondary">
                    <tr className="text-sm text-text-secondary">
                        <th className="p-4 font-normal">Category</th>
                        <th className="p-4 font-normal text-right">Total Amount</th>
                        <th className="p-4 font-normal text-right"># of Transactions</th>
                    </tr>
                </thead>
                <tbody>
                    {spendingChartData.length > 0 ? spendingChartData.map((item) => (
                        <tr key={item.name} className="border-b border-primary hover:bg-primary transition-colors last:border-b-0">
                            <td className="p-4 font-medium">{item.name}</td>
                            <td className="p-4 text-right font-semibold">{formatCurrency(item.value)}</td>
                            <td className="p-4 text-right">{item.count}</td>
                        </tr>
                    )) : (
                         <tr>
                            <td colSpan={3} className="text-center p-8 text-text-secondary">No spending data available.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-4 sm:gap-0">
            <h2 className="text-xl font-semibold">Transactions</h2>
            <button
                onClick={handleEditToggle}
                className="flex items-center justify-center gap-2 bg-secondary hover:bg-primary text-text-primary font-semibold py-2 px-4 rounded-lg transition-colors"
            >
                {isEditing ? 'Done' : <><PencilIcon className="w-4 h-4" /> Edit Transactions</>}
            </button>
        </div>
        <div className="border-b border-secondary">
            <nav className="-mb-px flex space-x-6 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('All')}
                    className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'All' ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-500'}`}
                >
                    All Accounts
                </button>
                {bankAccounts.map(account => (
                    <button
                        key={account.id}
                        onClick={() => setActiveTab(account.name)}
                        className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === account.name ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary hover:border-gray-500'}`}
                    >
                        {account.name}
                    </button>
                ))}
            </nav>
        </div>
        <div className="overflow-x-auto mt-4">
            <table className="w-full text-left">
                <thead className="border-b border-secondary">
                    <tr className="text-sm text-text-secondary">
                        <th className="p-4 font-normal">Date</th>
                        <th className="p-4 font-normal">Description</th>
                        <th className="p-4 font-normal">Category</th>
                        <th className="p-4 font-normal text-right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {displayedTransactions.length > 0 ? displayedTransactions.map((t: Transaction) => (
                        <tr key={t.id} className="border-b border-primary hover:bg-primary transition-colors last:border-b-0">
                            {isEditing ? (
                                <>
                                    <td className="p-2">
                                        <input 
                                            type="date"
                                            value={editedTransactions[t.id]?.date ?? t.date}
                                            onChange={e => handleTransactionChange(t.id, 'date', e.target.value)}
                                            className="bg-primary border border-secondary rounded-md px-2 py-1 text-text-primary w-full focus:outline-none focus:ring-1 focus:ring-accent"
                                        />
                                    </td>
                                    <td className="p-2">
                                        <input 
                                            type="text"
                                            value={editedTransactions[t.id]?.description ?? t.description}
                                            onChange={e => handleTransactionChange(t.id, 'description', e.target.value)}
                                            className="bg-primary border border-secondary rounded-md px-2 py-1 text-text-primary w-full focus:outline-none focus:ring-1 focus:ring-accent"
                                        />
                                    </td>
                                    <td className="p-2">
                                        <select
                                            value={editedTransactions[t.id]?.category ?? t.category}
                                            onChange={e => handleTransactionChange(t.id, 'category', e.target.value)}
                                            className="bg-primary border border-secondary rounded-md px-2 py-1 text-text-primary w-full focus:outline-none focus:ring-1 focus:ring-accent"
                                        >
                                            {transactionCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-2">
                                        <input 
                                            type="number"
                                            step="0.01"
                                            value={editedTransactions[t.id]?.amount ?? t.amount}
                                            onChange={e => handleTransactionChange(t.id, 'amount', parseFloat(e.target.value) || 0)}
                                            className="bg-primary border border-secondary rounded-md px-2 py-1 text-text-primary w-full text-right focus:outline-none focus:ring-1 focus:ring-accent"
                                        />
                                    </td>
                                </>
                            ) : (
                                <>
                                    <td className="p-4 text-sm text-text-secondary">{t.date}</td>
                                    <td className="p-4 font-medium">{t.description}</td>
                                    <td className="p-4">
                                        <CategoryPill category={t.category} />
                                    </td>
                                    <td className={`p-4 text-right font-semibold ${t.amount > 0 ? 'text-positive-text' : 'text-text-primary'}`}>
                                        {t.amount > 0 ? `+${formatCurrency(t.amount)}` : formatCurrency(t.amount)}
                                    </td>
                                </>
                            )}
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={4} className="text-center p-8 text-text-secondary">No transactions found.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </Card>
    </div>
  );
};

export default SpendingPage;
