
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, BarChart, Bar } from 'recharts';
import Card from '../components/Card';
import { useFinance, useCurrency } from '../hooks/useFinance';
import { AssetCategory } from '../types';
import { DollarSignIcon, TrendingDownIcon, TrendingUpIcon, LogoIcon } from '../components/Icons';
import EmptyState from '../components/EmptyState';

const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-primary p-3 rounded-lg border border-secondary shadow-lg">
        <p className="text-text-secondary text-sm">{label}</p>
        <p className="text-text-primary font-bold">{formatter(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

const ActivityChart: React.FC<{ data: { date: string; count: number }[]; streak: number }> = ({ data, streak }) => {
    const getColor = (count: number) => {
        if (count === 0) return 'bg-primary';
        if (count <= 2) return 'bg-accent/30';
        if (count <= 5) return 'bg-accent/60';
        return 'bg-accent';
    };

    const monthLabels = useMemo(() => {
        const labels: { month: string; weekIndex: number }[] = [];
        let lastMonth = -1;
        data.forEach((day, i) => {
            const date = new Date(day.date);
            const month = date.getMonth();
            if (month !== lastMonth) {
                const weekIndex = Math.floor(i / 7);
                if (labels.length === 0 || labels[labels.length - 1].weekIndex < weekIndex - 2) {
                    labels.push({
                        month: date.toLocaleString('default', { month: 'short' }),
                        weekIndex,
                    });
                }
            }
            lastMonth = month;
        });
        return labels;
    }, [data]);

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Activity</h2>
                <div className="text-right">
                    <p className="font-bold text-lg flex items-center gap-1.5">
                        <svg className="w-5 h-5 text-accent" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201-4.42 5.5 5.5 0 0110.89 2.166l.531 2.653a1.5 1.5 0 01-2.22 1.604l-3.39-2.034a1.5 1.5 0 01-.137-2.476l2.36-2.95a.5.5 0 00-.326-.842l-2.378.34a.5.5 0 01-.5-.486l.24-1.203a.5.5 0 00-.475-.552l-1.638-.234a.5.5 0 01-.447-.527l.188-1.13a.5.5 0 00-.46-.563l-1.928-.275a.5.5 0 00-.528.468l-.25.5a.5.5 0 01-.486.499l-1.203.24a.5.5 0 00-.552.475l-.234 1.638a.5.5 0 01-.527.447l-1.13.188a.5.5 0 00-.563.46l-.275 1.928a.5.5 0 00.468.528l.5.25a.5.5 0 01.499.486l.24 1.203a.5.5 0 00.475.552l1.638.234a.5.5 0 01.447.527l.188 1.13a.5.5 0 00.563.46l1.928.275a.5.5 0 00.528-.468l.25-.5a.5.5 0 01.486-.499l1.203-.24a.5.5 0 00.552-.475l.234-1.638a.5.5 0 01.527-.447l1.13-.188a.5.5 0 00.563-.46z" clipRule="evenodd" /></svg>
                        {streak} Day Streak
                    </p>
                    <p className="text-xs text-text-secondary">Consecutive days with transactions</p>
                </div>
            </div>
            <div className="flex gap-3">
                <div className="grid grid-rows-7 text-xs text-text-secondary py-1">
                    <span className="row-start-2">M</span>
                    <span className="row-start-4">W</span>
                    <span className="row-start-6">F</span>
                </div>
                <div className="relative overflow-x-auto w-full pb-2">
                    <div className="flex gap-1 absolute top-0 left-0 h-4">
                        {monthLabels.map(({ month, weekIndex }) => (
                            <div key={`${month}-${weekIndex}`} className="text-xs text-text-secondary absolute" style={{ left: `${weekIndex * 16}px` }}>
                                {month}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-rows-7 grid-flow-col gap-1 mt-6" style={{ gridAutoColumns: '12px' }}>
                        {data.map((day) => (
                            <div
                                key={day.date}
                                className={`w-3 h-3 rounded-sm ${getColor(day.count)}`}
                                title={`${day.count} transaction${day.count !== 1 ? 's' : ''} on ${new Date(day.date).toLocaleDateString()}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const Dashboard: React.FC = () => {
    const { transactions, accounts } = useFinance();
    const { formatCurrency } = useCurrency();

    const totalAssetsValue = useMemo(() => accounts.reduce((sum, account) => sum + account.balance, 0), [accounts]);
    
    const totalSpendingThisMonth = useMemo(() => {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return transactions
            .filter(t => t.amount < 0 && new Date(t.date) >= firstDayOfMonth)
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    }, [transactions]);

    const allocationData = useMemo(() => {
        if (accounts.length === 0) return [];
        const byCategory = accounts.reduce((acc, account) => {
            acc[account.category] = (acc[account.category] || 0) + account.balance;
            return acc;
        }, {} as Record<AssetCategory, number>);
        return Object.entries(byCategory).map(([name, value]) => ({ name, value }));
    }, [accounts]);
    
    const portfolioHistoryData = useMemo(() => {
        if (accounts.length === 0 && transactions.length === 0) return [];

        const dailyNetChange = transactions.reduce((acc, t) => {
            acc[t.date] = (acc[t.date] || 0) + t.amount;
            return acc;
        }, {} as Record<string, number>);

        const totalAssets = accounts.reduce((sum, account) => sum + account.balance, 0);
        const data = [];
        let runningValue = totalAssets;
        const today = new Date();

        for (let i = 0; i < 30; i++) {
            const date = new Date();
            date.setDate(today.getDate() - i);
            const dateString = date.toISOString().split('T')[0];
            data.push({ date: dateString, value: runningValue });
            runningValue -= (dailyNetChange[dateString] || 0);
        }
        return data.reverse().map(d => ({ ...d, date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }));
    }, [transactions, accounts]);

    const spendingByCategoryThisMonth = useMemo(() => {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const categoryTotals = transactions
            .filter(t => t.amount < 0 && new Date(t.date) >= firstDayOfMonth)
            .reduce((acc, t) => {
                acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
                return acc;
            }, {} as Record<string, number>);

        return Object.entries(categoryTotals).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }, [transactions]);

    const activityData = useMemo(() => {
        const dailyCounts: { [date: string]: number } = {};
        transactions.forEach(t => { dailyCounts[t.date] = (dailyCounts[t.date] || 0) + 1; });
        const data = [];
        const today = new Date();
        for (let i = 364; i >= 0; i--) {
            const date = new Date();
            date.setDate(today.getDate() - i);
            const dateString = date.toISOString().split('T')[0];
            data.push({ date: dateString, count: dailyCounts[dateString] || 0 });
        }
        return data;
    }, [transactions]);
    
    const activityStreak = useMemo(() => {
        if (transactions.length === 0) return 0;
        const transactionDates = new Set(transactions.map(t => t.date));
        let currentDate = new Date();
        if (!transactionDates.has(currentDate.toISOString().split('T')[0])) {
            currentDate.setDate(currentDate.getDate() - 1);
        }
        if (!transactionDates.has(currentDate.toISOString().split('T')[0])) return 0;
        let streak = 0;
        while (transactionDates.has(currentDate.toISOString().split('T')[0])) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        }
        return streak;
    }, [transactions]);

    const portfolioChange = useMemo(() => {
        if (portfolioHistoryData.length < 2) return { value: 0, percentage: 0 };
        const startValue = portfolioHistoryData[0].value;
        const endValue = portfolioHistoryData[portfolioHistoryData.length - 1].value;
        const value = endValue - startValue;
        const percentage = startValue !== 0 ? (value / startValue) * 100 : 0;
        return { value, percentage };
    }, [portfolioHistoryData]);

    if (transactions.length === 0 && accounts.length === 0) {
        return (
            <EmptyState
                icon={
                    <div className="flex flex-col items-center gap-2">
                        <a href="https://www.cryptoax07.com/" target="_blank" rel="noopener noreferrer">
                          <img src="https://static.wixstatic.com/media/4a78c1_0ce55f39403f46ccbe0ef5e7f6c799f3~mv2.png/v1/fill/w_958,h_360,al_c,lg_1,q_85,enc_avif,quality_auto/4a78c1_0ce55f39403f46ccbe0ef5e7f6c799f3~mv2.png" alt="Company Logo" className="w-48 object-contain" />
                        </a>
                        <LogoIcon className="w-8 h-8" />
                    </div>
                }
                title="Welcome to FinTrack AI"
                message="Your dashboard is empty. Get started by adding a transaction or uploading a bank statement in the AI Agent tab."
                action={<Link to="/ai" className="bg-accent text-white font-semibold py-2 px-4 rounded-lg hover:opacity-90">Go to AI Agent</Link>}
            />
        );
    }
    
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

    return (
        <div className="space-y-6">
            <div className="hidden md:block">
                <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">Dashboard</h1>
                <p className="text-text-secondary">A summary of your financial health.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1">
                    <div className="flex items-center gap-3 text-text-secondary"><DollarSignIcon className="w-5 h-5" /><h2 className="font-medium">Total Net Worth</h2></div>
                    <p className="text-3xl font-bold text-text-primary mt-2">{formatCurrency(totalAssetsValue, { maximumFractionDigits: 0 })}</p>
                    <div className={`mt-2 flex items-center gap-1 text-sm ${portfolioChange.value >= 0 ? 'text-positive-text' : 'text-negative-text'}`}>
                        {portfolioChange.value >= 0 ? <TrendingUpIcon className="w-4 h-4" /> : <TrendingDownIcon className="w-4 h-4" />}
                        <span>{formatCurrency(portfolioChange.value)} ({portfolioChange.percentage.toFixed(2)}%)</span>
                        <span className="text-text-secondary text-xs">past 30 days</span>
                    </div>
                </Card>
                <Card className="md:col-span-1">
                    <div className="flex items-center gap-3 text-text-secondary"><TrendingDownIcon className="w-5 h-5" /><h2 className="font-medium">Spent This Month</h2></div>
                    <p className="text-3xl font-bold text-text-primary mt-2">{formatCurrency(totalSpendingThisMonth, { maximumFractionDigits: 0 })}</p>
                </Card>
                <Card className="md:col-span-1">
                    <h2 className="font-medium text-text-secondary">Asset Allocation</h2>
                     <div className="h-24">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={allocationData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={25} outerRadius={40}>
                                    {allocationData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #3a3a3a', borderRadius: '0.5rem' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
            
            <Card>
                <h2 className="text-xl font-semibold mb-4">Portfolio History (30 Days)</h2>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={portfolioHistoryData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <defs><linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00C49F" stopOpacity={0.8}/><stop offset="95%" stopColor="#00C49F" stopOpacity={0}/></linearGradient></defs>
                            <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value: number) => formatCurrency(value, { notation: 'compact', maximumFractionDigits: 1 })}/>
                            <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} />
                            <Area type="monotone" dataKey="value" stroke="#00C49F" fillOpacity={1} fill="url(#colorValue)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <Card>
                     <ActivityChart data={activityData} streak={activityStreak} />
                </Card>
                <Card>
                    <h2 className="text-xl font-semibold mb-4">Top Spending Categories (This Month)</h2>
                    <div className="h-72">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={spendingByCategoryThisMonth.slice(0, 5)} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={80} stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip cursor={{fill: 'rgba(107, 114, 128, 0.1)'}} contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #3a3a3a', borderRadius: '0.5rem' }} formatter={(value: number) => formatCurrency(value)} />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                    {spendingByCategoryThisMonth.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;
