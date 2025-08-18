
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, BarChart, Bar } from 'recharts';
import Card from '../components/Card';
import { useFinance } from '../hooks/useFinance';
import { AssetCategory } from '../types';
import { DollarSignIcon, TrendingDownIcon, TrendingUpIcon, LogoIcon } from '../components/Icons';
import EmptyState from '../components/EmptyState';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatCurrencyWithCents = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-primary p-3 rounded-lg border border-secondary shadow-lg">
        <p className="text-text-secondary text-sm">{label}</p>
        <p className="text-text-primary font-bold">{formatCurrencyWithCents(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};


const Dashboard: React.FC = () => {
    const { transactions, accounts } = useFinance();

    const totalAssetsValue = useMemo(() => accounts.reduce((sum, account) => sum + account.balance, 0), [accounts]);
    
    const totalSpendingThisMonth = useMemo(() => {
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return transactions
            .filter(t => t.amount < 0 && new Date(t.date) >= firstDayOfMonth)
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    }, [transactions]);

    const allocationData = useMemo(() => {
        if (accounts.length === 0) {
            return [];
        }
        const byCategory = accounts.reduce((acc, account) => {
            acc[account.category] = (acc[account.category] || 0) + account.balance;
            return acc;
        }, {} as Record<AssetCategory, number>);
        return Object.entries(byCategory).map(([name, value]) => ({ name, value }));
    }, [accounts]);
    
    const portfolioHistoryData = useMemo(() => {
        if (accounts.length === 0 && transactions.length === 0) {
            return [];
        }

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

            data.push({
                date: dateString,
                value: runningValue,
            });
            
            const netChange = dailyNetChange[dateString] || 0;
            runningValue -= netChange;
        }

        return data.reverse().map(d => ({
            ...d,
            date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        }));
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
    
        return Object.entries(categoryTotals)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [transactions]);

    const COLORS = ['#58A6FF', '#3FB950', '#FFBB28', '#FF8042', '#8B5CF6', '#E040FB'];

    if (transactions.length === 0 && accounts.length === 0) {
        return (
            <EmptyState
                icon={<LogoIcon className="w-8 h-8"/>}
                title="Welcome to FinTrack AI"
                message="Your intelligent financial dashboard is ready. Add your first transaction or account using the AI Agent to see your overview here."
                action={
                    <Link to="/ai" className="bg-accent text-white font-semibold py-2 px-4 rounded-lg hover:opacity-90 transition-opacity">
                        Go to AI Agent
                    </Link>
                }
            />
        )
    }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-text-secondary mt-1">Your financial overview at a glance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
              <div className="flex justify-between items-start">
                  <h3 className="font-medium text-text-secondary">Total Assets</h3>
                  <TrendingUpIcon className="w-6 h-6 text-text-secondary" />
              </div>
              <p className="text-3xl font-bold text-text-primary mt-2">{formatCurrency(totalAssetsValue)}</p>
              <div className="flex items-center text-sm mt-1 text-positive-text">
                  <span>Current total value of all assets</span>
              </div>
          </Card>
          <Card>
              <div className="flex justify-between items-start">
                <h3 className="font-medium text-text-secondary">Total Spending (This Month)</h3>
                <DollarSignIcon className="w-5 h-5 text-text-secondary mt-1" />
              </div>
              <p className="text-3xl font-bold text-text-primary mt-2">{formatCurrencyWithCents(totalSpendingThisMonth)}</p>
              <div className="flex items-center text-sm mt-1 text-negative-text">
                  <TrendingDownIcon className="w-4 h-4 mr-1" />
                  <span>Monthly spending total</span>
              </div>
          </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
            <h2 className="text-xl font-semibold mb-1">Portfolio Overview</h2>
            <p className="text-text-secondary mb-4">Asset value over the last 30 days</p>
            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={portfolioHistoryData}>
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#58A6FF" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#58A6FF" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <XAxis 
                            dataKey="date" 
                            stroke="#8B949E" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false} 
                        />
                        <YAxis 
                            stroke="#8B949E" 
                            fontSize={12} 
                            tickLine={false} 
                            axisLine={false} 
                            tickFormatter={(value) => `$${Number(value)/1000}k`} 
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#30363D', strokeWidth: 1 }} />
                        <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#58A6FF" 
                            fillOpacity={1} 
                            fill="url(#colorValue)" 
                            strokeWidth={2}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </Card>

        <Card className="lg:col-span-2">
            <h2 className="text-xl font-semibold mb-1">Asset Allocation</h2>
            <p className="text-text-secondary mb-4">Distribution by category</p>
            <div className="h-80">
                {allocationData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie 
                                data={allocationData} 
                                dataKey="value" 
                                nameKey="name" 
                                cx="50%" 
                                cy="50%" 
                                innerRadius={60} 
                                outerRadius={90} 
                                fill="#8884d8" 
                                paddingAngle={3}
                                labelLine={false}
                                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
                                    const RADIAN = Math.PI / 180;
                                    const radius = innerRadius + (outerRadius - innerRadius) * 1.2;
                                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                    return (
                                    <text x={x} y={y} fill="#C9D1D9" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12}>
                                        {allocationData[index].name}
                                    </text>
                                    );
                                }}
                            >
                                {allocationData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke={COLORS[index % COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #3a3a3a', borderRadius: '0.5rem' }}/>
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-text-secondary">
                        <p>Add assets to see your allocation.</p>
                    </div>
                )}
            </div>
        </Card>
      </div>
      <Card>
            <h2 className="text-xl font-semibold mb-1">Spending by Category (This Month)</h2>
            <p className="text-text-secondary mb-4">Your top spending categories in the current month.</p>
            <div className="h-80">
                {spendingByCategoryThisMonth.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                            data={spendingByCategoryThisMonth} 
                            layout="vertical" 
                            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                        >
                            <XAxis type="number" stroke="#8B949E" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                            <YAxis dataKey="name" type="category" stroke="#8B949E" fontSize={12} tickLine={false} axisLine={false} width={80} interval={0} />
                            <Tooltip 
                                formatter={(value: number) => formatCurrencyWithCents(value)}
                                contentStyle={{ backgroundColor: '#161B22', border: '1px solid #30363D', borderRadius: '0.5rem' }}
                                cursor={{ fill: 'rgba(48, 54, 61, 0.5)' }}
                            />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                {spendingByCategoryThisMonth.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-text-secondary">
                        <p>No spending data for this month.</p>
                    </div>
                )}
            </div>
        </Card>
    </div>
  );
};

export default Dashboard;
