import { MarketAsset } from '../types';

// --- API CONFIG ---
const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';
const ALPHA_VANTAGE_API_BASE = 'https://www.alphavantage.co/query';
// Using the free 'demo' key as requested by the user for a key-free experience.
const ALPHA_VANTAGE_API_KEY = 'demo'; 

// --- CACHING LAYER ---
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// --- API HELPERS ---
const apiFetch = async (url: string, source: string) => {
    const now = Date.now();
    const cachedEntry = cache.get(url);

    if (cachedEntry && (now - cachedEntry.timestamp < CACHE_DURATION)) {
        return cachedEntry.data;
    }
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`${source} API request failed: ${response.statusText}`);
        const data = await response.json();
        // Alpha Vantage returns an error message in the response body if the key is invalid or rate limit is hit
        if (data.Note || data['Error Message']) {
            throw new Error(`API Error from ${source}: ${data.Note || data['Error Message']}`);
        }
        
        cache.set(url, { data, timestamp: now });
        return data;
    } catch (error) {
        console.error(`${source} API Fetch Error:`, error);
        throw error;
    }
}

const coingeckoFetch = (endpoint: string) => apiFetch(`${COINGECKO_API_BASE}${endpoint}`, 'CoinGecko');
const alphaVantageFetch = (params: string) => apiFetch(`${ALPHA_VANTAGE_API_BASE}?${params}&apikey=${ALPHA_VANTAGE_API_KEY}`, 'Alpha Vantage');

/**
 * Fetches and caches bulk market data for the top 100 cryptocurrencies.
 * This is the primary method for getting price data to reduce API calls.
 */
const getCryptoMarketData = async (): Promise<Map<string, { price: number; change24h: number }>> => {
    const url = `${COINGECKO_API_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1`;
    const marketData = await apiFetch(url, 'CoinGecko');

    const marketMap = new Map<string, { price: number; change24h: number }>();
    if (Array.isArray(marketData)) {
        marketData.forEach((coin: any) => {
            marketMap.set(coin.id, {
                price: coin.current_price,
                change24h: coin.price_change_percentage_24h,
            });
        });
    }
    return marketMap;
};


// --- SERVICE FUNCTIONS ---

export const fetchExchangeRates = async (): Promise<Record<string, number>> => {
    const data = await coingeckoFetch('/exchange_rates');
    const usdRate = data.rates.usd.value;
    return { 'USD': 1, 'EUR': data.rates.eur.value / usdRate, 'GBP': data.rates.gbp.value / usdRate };
};

export const fetchAssetPrices = async (apiIds: string[]): Promise<Record<string, number>> => {
    const priceMap: Record<string, number> = {};
    const cryptoIds: string[] = [];
    const stockTickers: { apiId: string; ticker: string }[] = [];
    
    apiIds.forEach(id => {
        if (id.includes(':')) { // Heuristic: Stock IDs are stored as 'ticker:name'
            const [ticker] = id.split(':');
            stockTickers.push({ apiId: id, ticker });
        } else {
            cryptoIds.push(id);
        }
    });

    // Strategy: Use bulk market data first, then fallback to simple price for misses.
    if (cryptoIds.length > 0) {
        const marketData = await getCryptoMarketData();
        const missingIds: string[] = [];
        
        cryptoIds.forEach(id => {
            if (marketData.has(id)) {
                priceMap[id] = marketData.get(id)!.price;
            } else {
                missingIds.push(id);
            }
        });

        // Fallback for coins not in the top 100
        if (missingIds.length > 0) {
            const sortedMissingIds = [...new Set(missingIds)].sort();
            const data = await coingeckoFetch(`/simple/price?ids=${sortedMissingIds.join(',')}&vs_currencies=usd`);
            for (const id in data) {
                if(data[id] && data[id].usd) {
                    priceMap[id] = data[id].usd;
                }
            }
        }
    }

    // Fetch stock prices one by one (limitation of free Alpha Vantage API)
    for (const stock of stockTickers) {
       try {
            const data = await alphaVantageFetch(`function=GLOBAL_QUOTE&symbol=${stock.ticker}`);
            if (data && data['Global Quote'] && data['Global Quote']['05. price']) {
                const price = parseFloat(data['Global Quote']['05. price']);
                if (!isNaN(price)) {
                    priceMap[stock.apiId] = price;
                }
            }
       } catch (error) {
           console.error(`Could not fetch price for stock ${stock.ticker}:`, error);
       }
    }
    
    return priceMap;
};

export const searchAssets = async (query: string): Promise<MarketAsset[]> => {
    const lowercasedQuery = query.toLowerCase();
    if (!lowercasedQuery) return [];
    
    // Fetch stocks
    const stockData = await alphaVantageFetch(`function=SYMBOL_SEARCH&keywords=${lowercasedQuery}`);
    const stockResults: MarketAsset[] = (stockData.bestMatches || []).map((match: any): MarketAsset => ({
        apiId: `${match['1. symbol']}:${match['2. name']}`,
        name: match['2. name'],
        ticker: match['1. symbol'],
        price: 0, // Search results from Alpha Vantage don't include price
        change24h: 0,
        type: 'Equities',
    }));
    
    // Fetch crypto
    const cryptoData = await coingeckoFetch(`/search?query=${lowercasedQuery}`);
    const cryptoResults: MarketAsset[] = (cryptoData.coins || []).slice(0, 10).map((coin: any): MarketAsset => ({
        apiId: coin.id,
        name: coin.name,
        ticker: coin.symbol,
        price: 0, // Search results from CoinGecko don't include price
        change24h: 0,
        type: 'Crypto',
    }));

    return [...stockResults, ...cryptoResults].slice(0, 15);
};

export const getTrendingAssets = async (): Promise<MarketAsset[]> => {
    // For stocks, we will use Top Gainers as a proxy for "trending"
    const stockData = await alphaVantageFetch(`function=TOP_GAINERS_LOSERS`);
    const stockResults: MarketAsset[] = (stockData.top_gainers || []).slice(0, 4).map((stock: any): MarketAsset => ({
        apiId: `${stock.ticker}:${stock.ticker}`, // Name isn't provided, so we use ticker twice.
        name: stock.ticker,
        ticker: stock.ticker,
        price: parseFloat(stock.price) || 0,
        change24h: parseFloat(String(stock.change_percentage || '0').replace('%', '')) || 0,
        type: 'Equities',
    }));
    
    // For crypto, use CoinGecko's dedicated trending endpoint then get prices efficiently.
    const trendingData = await coingeckoFetch('/search/trending');
    const trendingCoinsInfo = (trendingData.coins || []).slice(0, 3).map((c: any) => ({
        id: c.item.id,
        name: c.item.name,
        ticker: c.item.symbol,
    }));
    
    const marketData = await getCryptoMarketData();
    const prices: Record<string, { price: number; change24h: number }> = {};
    const missingIds = trendingCoinsInfo.map(c => c.id).filter(id => !marketData.has(id));

    trendingCoinsInfo.forEach(coin => {
        if(marketData.has(coin.id)) {
            prices[coin.id] = marketData.get(coin.id)!;
        }
    });

    if (missingIds.length > 0) {
        const sortedMissingIds = [...new Set(missingIds)].sort();
        const fallbackPriceData = await coingeckoFetch(`/simple/price?ids=${sortedMissingIds.join(',')}&vs_currencies=usd&include_24hr_change=true`);
        for (const id in fallbackPriceData) {
            prices[id] = {
                price: fallbackPriceData[id].usd || 0,
                change24h: fallbackPriceData[id].usd_24h_change || 0,
            };
        }
    }
    
    const cryptoResults: MarketAsset[] = trendingCoinsInfo.map((coin): MarketAsset => ({
        apiId: coin.id,
        name: coin.name,
        ticker: coin.ticker,
        price: prices[coin.id]?.price || 0,
        change24h: prices[coin.id]?.change24h || 0,
        type: 'Crypto',
    }));
    
    return [...cryptoResults, ...stockResults];
};

export const getTopMovers = async (): Promise<MarketAsset[]> => {
    // For stocks, we will use Top Gainers as a proxy for "top movers"
    const stockData = await alphaVantageFetch(`function=TOP_GAINERS_LOSERS`);
    const stockResults: MarketAsset[] = (stockData.top_gainers || []).slice(0, 5).map((stock: any): MarketAsset => ({
        apiId: `${stock.ticker}:${stock.ticker}`,
        name: stock.ticker,
        ticker: stock.ticker,
        price: parseFloat(stock.price) || 0,
        change24h: parseFloat(String(stock.change_percentage || '0').replace('%', '')) || 0,
        type: 'Equities',
    }));

    // For crypto, we get the top market cap coins which includes price data.
    const cryptoData = await coingeckoFetch(`/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=5&page=1`);
    const cryptoResults: MarketAsset[] = (cryptoData || []).map((coin: any): MarketAsset => ({
        apiId: coin.id,
        name: coin.name,
        ticker: coin.symbol.toUpperCase(),
        price: coin.current_price || 0,
        change24h: coin.price_change_percentage_24h || 0,
        type: 'Crypto',
    }));

    return [...stockResults, ...cryptoResults];
};