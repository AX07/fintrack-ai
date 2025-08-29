import React, { useState, useEffect } from 'react';
// FIX: The MarketAsset type is not exported from the service, so it's imported directly from types.
import { searchAssets, getTrendingAssets, getTopMovers } from '../services/marketDataService';
import type { MarketAsset } from '../types';
import { useFinance, useCurrency } from '../hooks/useFinance';
import { Account, Holding } from '../types';
import Card from '../components/Card';
import { TrendingUpIcon, TrendingDownIcon, PlusIcon } from '../components/Icons';

const AssetCard: React.FC<{ asset: MarketAsset; onAdd: (asset: MarketAsset) => void; formatCurrency: (value: number) => string }> = ({ asset, onAdd, formatCurrency }) => {
    const isPositive = asset.change24h >= 0;
    return (
        <Card className="flex items-center justify-between">
            <div>
                <p className="font-bold text-lg">{asset.name} <span className="text-sm text-text-secondary">{asset.ticker}</span></p>
                <p className="text-2xl font-semibold">{formatCurrency(asset.price)}</p>
                <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-positive-text' : 'text-negative-text'}`}>
                    {isPositive ? <TrendingUpIcon className="w-4 h-4" /> : <TrendingDownIcon className="w-4 h-4" />}
                    <span>{asset.change24h.toFixed(2)}% (24h)</span>
                </div>
            </div>
            <button
                onClick={() => onAdd(asset)}
                className="p-2 bg-accent text-white rounded-full hover:opacity-90"
                aria-label={`Add ${asset.name} to portfolio`}
            >
                <PlusIcon className="w-6 h-6" />
            </button>
        </Card>
    );
};

const AddAssetModal: React.FC<{
    asset: MarketAsset;
    accounts: Account[];
    onClose: () => void;
    onConfirm: (payload: { accountId: string; holding: Omit<Holding, 'id' | 'value'> }) => void;
    formatCurrency: (value: number) => string;
}> = ({ asset, accounts, onClose, onConfirm, formatCurrency }) => {
    const [quantity, setQuantity] = useState('');
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    
    const investmentAccounts = accounts.filter(acc => acc.category === 'Equities' || acc.category === 'Crypto');

    useEffect(() => {
        if (investmentAccounts.length > 0) {
            const compatibleAccount = investmentAccounts.find(acc => acc.category === asset.type);
            setSelectedAccountId(compatibleAccount?.id || investmentAccounts[0].id);
        }
    }, [asset.type, investmentAccounts]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numQuantity = parseFloat(quantity);
        if (numQuantity > 0 && selectedAccountId) {
            onConfirm({
                accountId: selectedAccountId,
                holding: {
                    name: asset.name,
                    ticker: asset.ticker,
                    quantity: numQuantity,
                    price: asset.price, // Price is always in USD from API
                    apiId: asset.apiId,
                }
            });
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <Card className="max-w-md w-full">
                <h2 className="text-xl font-bold mb-2">Add {asset.name}</h2>
                <p className="text-text-secondary mb-6">Current Price: {formatCurrency(asset.price)}</p>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="quantity" className="block text-sm font-medium text-text-secondary mb-1">Quantity</label>
                            <input id="quantity" type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full bg-primary border border-secondary rounded-lg px-4 py-2" placeholder="e.g., 1.5" required autoFocus />
                        </div>
                        <div>
                            <label htmlFor="account" className="block text-sm font-medium text-text-secondary mb-1">Add to Account</label>
                            {investmentAccounts.length > 0 ? (
                                <select id="account" value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} className="w-full bg-primary border border-secondary rounded-lg px-4 py-2" required>
                                    <option value="" disabled>Select an account...</option>
                                    {investmentAccounts.map(acc => (<option key={acc.id} value={acc.id}>{acc.name} ({acc.category})</option>))}
                                </select>
                            ) : ( <p className="text-sm text-text-secondary p-3 bg-primary rounded-lg">No investment accounts found. Please create one first.</p> )}
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={onClose} className="bg-secondary hover:bg-primary font-semibold py-2 px-4 rounded-lg">Cancel</button>
                        <button type="submit" disabled={!quantity || !selectedAccountId} className="bg-accent hover:opacity-90 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">Add Asset</button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

const ExplorePage: React.FC = () => {
    const { accounts, addHolding } = useFinance();
    const { formatCurrency } = useCurrency();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<MarketAsset[]>([]);
    const [trending, setTrending] = useState<MarketAsset[]>([]);
    const [topMovers, setTopMovers] = useState<MarketAsset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const [assetToAdd, setAssetToAdd] = useState<MarketAsset | null>(null);

    useEffect(() => {
        const fetchInitialData = async () => {
            setIsLoading(true);
            const [trendingData, moversData] = await Promise.all([getTrendingAssets(), getTopMovers()]);
            setTrending(trendingData);
            setTopMovers(moversData);
            setIsLoading(false);
        };
        fetchInitialData();
    }, []);
    
    useEffect(() => {
        const handler = setTimeout(() => {
            if (searchQuery.trim()) {
                setIsSearching(true);
                searchAssets(searchQuery).then(results => {
                    setSearchResults(results);
                    setIsSearching(false);
                });
            } else {
                setSearchResults([]);
            }
        }, 300);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    const handleAddAsset = (payload: { accountId: string; holding: Omit<Holding, 'id' | 'value'> }) => {
        addHolding(payload);
        setAssetToAdd(null);
    };
    
    const AssetCardWithCurrency = (props: { asset: MarketAsset }) => <AssetCard {...props} onAdd={setAssetToAdd} formatCurrency={formatCurrency} />;

    return (
        <div className="space-y-8">
            {assetToAdd && <AddAssetModal asset={assetToAdd} accounts={accounts} onClose={() => setAssetToAdd(null)} onConfirm={handleAddAsset} formatCurrency={formatCurrency} />}
            <div className="hidden md:block">
                <h1 className="text-2xl sm:text-3xl font-bold">Explore Assets</h1>
                <p className="text-text-secondary">Discover trending assets and search the market.</p>
            </div>
            <div>
                <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search for stocks or crypto (e.g., BTC, Apple)" className="w-full bg-surface border-2 border-secondary rounded-lg px-5 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-accent"/>
            </div>

            <div className="space-y-6">
                {isSearching && <p className="text-center text-text-secondary">Searching...</p>}
                
                {searchQuery.trim() && !isSearching && !searchResults.length && (
                    <p className="text-center text-text-secondary">No results found for "{searchQuery}".</p>
                )}
                
                {searchResults.length > 0 && (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {searchResults.map(asset => <AssetCardWithCurrency key={asset.apiId} asset={asset} />)}
                    </div>
                )}
                
                {!searchQuery.trim() && (
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-2xl font-bold mb-4">Trending Assets</h2>
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {isLoading ? Array(3).fill(0).map((_, i) => <Card key={i} className="h-40 animate-pulse">{null}</Card>) 
                                           : trending.map(asset => <AssetCardWithCurrency key={asset.apiId} asset={asset} />)}
                            </div>
                        </div>
                        <div>
                             <h2 className="text-2xl font-bold mb-4">Top Movers (24h)</h2>
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {isLoading ? Array(3).fill(0).map((_, i) => <Card key={i} className="h-40 animate-pulse">{null}</Card>) 
                                           : topMovers.map(asset => <AssetCardWithCurrency key={asset.apiId} asset={asset} />)}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExplorePage;
