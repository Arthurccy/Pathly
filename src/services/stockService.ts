import { StockQuote, StockSearchResult } from '../types';

export interface PopularAsset {
  symbol: string;
  name: string;
  type: 'etf' | 'stock' | 'crypto';
  envelope: 'pea' | 'cto' | 'both';
  category: string;
}

export const POPULAR_FRENCH_ASSETS: PopularAsset[] = [
  // ETF PEA
  { symbol: 'CW8.PA', name: 'Amundi MSCI World Swap UCITS ETF', type: 'etf', envelope: 'pea', category: 'Monde' },
  { symbol: 'WPEA.PA', name: 'iShares MSCI World Swap PEA ETF', type: 'etf', envelope: 'pea', category: 'Monde' },
  { symbol: 'ESE.PA', name: 'BNP Paribas Easy S&P 500 UCITS ETF', type: 'etf', envelope: 'pea', category: 'USA' },
  { symbol: 'PE500.PA', name: 'Amundi PEA S&P 500 UCITS ETF', type: 'etf', envelope: 'pea', category: 'USA' },
  { symbol: 'PAASI.PA', name: 'Amundi PEA MSCI Emerging Asia', type: 'etf', envelope: 'pea', category: 'Asie' },
  { symbol: 'PUST.PA', name: 'Amundi PEA Nasdaq-100 UCITS ETF', type: 'etf', envelope: 'pea', category: 'Tech' },

  // Actions CAC 40 (PEA & CTO)
  { symbol: 'MC.PA', name: 'LVMH Moët Hennessy', type: 'stock', envelope: 'pea', category: 'Luxe' },
  { symbol: 'AIR.PA', name: 'Airbus SE', type: 'stock', envelope: 'pea', category: 'Industrie' },
  { symbol: 'AI.PA', name: 'Air Liquide', type: 'stock', envelope: 'pea', category: 'Chimie' },
  { symbol: 'TTE.PA', name: 'TotalEnergies SE', type: 'stock', envelope: 'pea', category: 'Énergie' },
  { symbol: 'RMS.PA', name: 'Hermès International', type: 'stock', envelope: 'pea', category: 'Luxe' },
  { symbol: 'SAN.PA', name: 'Sanofi', type: 'stock', envelope: 'pea', category: 'Santé' },
  { symbol: 'BNP.PA', name: 'BNP Paribas', type: 'stock', envelope: 'pea', category: 'Finance' },
  { symbol: 'SU.PA', name: 'Schneider Electric', type: 'stock', envelope: 'pea', category: 'Industrie' },

  // CTO US / Tech
  { symbol: 'NVDA', name: 'NVIDIA Corporation', type: 'stock', envelope: 'cto', category: 'Tech US' },
  { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', envelope: 'cto', category: 'Tech US' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', type: 'stock', envelope: 'cto', category: 'Tech US' },
  { symbol: 'GOOGL', name: 'Alphabet Inc. - Classe A (Google)', type: 'stock', envelope: 'cto', category: 'Tech US' },
  { symbol: 'GOOG', name: 'Alphabet Inc. - Classe C (Google)', type: 'stock', envelope: 'cto', category: 'Tech US' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', type: 'stock', envelope: 'cto', category: 'E-Commerce' },
  { symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock', envelope: 'cto', category: 'Automobile' },

  // Cryptos majeures
  { symbol: 'BTC-EUR', name: 'Bitcoin (EUR)', type: 'crypto', envelope: 'both', category: 'Crypto' },
  { symbol: 'ETH-EUR', name: 'Ethereum (EUR)', type: 'crypto', envelope: 'both', category: 'Crypto' },
];

/**
 * Search for stocks/ETFs by symbol or name
 */
export async function searchStocks(query: string): Promise<StockSearchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  try {
    const response = await fetch(`/api/stock-search?q=${encodeURIComponent(cleanQuery)}`);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.results) && data.results.length > 0) {
        return data.results;
      }
    }
  } catch (err) {
    console.warn('API stock-search error, using fallback:', err);
  }

  // Fallback to local presets
  const lower = cleanQuery.toLowerCase();
  return POPULAR_FRENCH_ASSETS
    .filter(a => a.symbol.toLowerCase().includes(lower) || a.name.toLowerCase().includes(lower))
    .map(a => ({
      symbol: a.symbol,
      name: a.name,
      type: a.type,
      exchange: a.symbol.endsWith('.PA') ? 'Euronext Paris' : 'US Market',
      currency: a.symbol.endsWith('.PA') || a.symbol.endsWith('-EUR') ? 'EUR' : 'USD'
    }));
}

/**
 * Fetch real-time quotes for multiple symbols
 */
export async function fetchStockQuotes(symbols: string[]): Promise<Record<string, StockQuote>> {
  const cleanSymbols = Array.from(new Set(symbols.map(s => s.trim().toUpperCase()).filter(Boolean)));
  if (cleanSymbols.length === 0) return {};

  try {
    const response = await fetch(`/api/stock-quote?symbols=${encodeURIComponent(cleanSymbols.join(','))}`);
    if (response.ok) {
      const data = await response.json();
      if (data.quotes && typeof data.quotes === 'object') {
        return data.quotes;
      }
    }
  } catch (err) {
    console.warn('API stock-quote error:', err);
  }

  return {};
}

/**
 * Fetch EUR/USD exchange rate (default to ~1.08 if unavailable)
 */
export async function fetchEurUsdRate(): Promise<number> {
  try {
    const quotes = await fetchStockQuotes(['EURUSD=X']);
    if (quotes['EURUSD=X']?.price) {
      return quotes['EURUSD=X'].price;
    }
  } catch {}
  return 1.08;
}
