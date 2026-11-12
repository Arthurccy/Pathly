import type { Plugin } from 'vite';
import type { StockQuote } from './src/types';
interface YahooQuote {
  currency?: string;
  symbol: string;
  exchDisp?: string;
  exchange?: string;
  quoteType?: string;
  shortname?: string;
  longname?: string;
}
interface YahooResponse {
  quotes?: YahooQuote[];
  chart?: { result?: { meta?: {
    regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number;
    currency?: string; shortName?: string; longName?: string; regularMarketTime?: number;
  } }[] };
}

function inferCurrency(item: YahooQuote): string {
  if (item.currency) return item.currency;
  const sym = (item.symbol || '').toUpperCase();
  const exch = (item.exchDisp || item.exchange || '').toUpperCase();
  if (sym.endsWith('.PA') || sym.endsWith('.AS') || sym.endsWith('.DE') || sym.endsWith('.MI') || sym.endsWith('.MC') || sym.endsWith('.TI') || sym.endsWith('-EUR')) {
    return 'EUR';
  }
  if (sym.endsWith('.L')) return 'GBP';
  if (sym.endsWith('.TO')) return 'CAD';
  if (sym.endsWith('.SW')) return 'CHF';
  if (['NASDAQ', 'NYSE', 'AMEX', 'NMS', 'NYQ', 'NCM', 'NGM', 'BATS', 'OTC'].some((e: string) => exch.includes(e))) {
    return 'USD';
  }
  if (!sym.includes('.')) {
    return 'USD';
  }
  return 'EUR';
}

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function stockApiPlugin(): Plugin {
  return {
    name: 'stock-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0];
        if (pathname === '/api/stock-search' || pathname === '/api/stock-quote') {
          res.setHeader('Content-Type', 'application/json');
          if (req.method === 'OPTIONS') { res.statusCode = 200; return res.end(); }
          if (req.method !== 'GET') {
            res.statusCode = 405; res.setHeader('Allow', 'GET, OPTIONS');
            return res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
        }
        if (pathname === '/api/stock-search') {
          const urlObj = new URL(req.url || '/', 'http://localhost');
          const q = urlObj.searchParams.get('q');
          if (q && (q.length > 100 || urlObj.searchParams.getAll('q').length > 1)) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'Invalid search query' }));
          }
          if (!q) {
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ results: [] }));
          }
          try {
            const resp = await fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`, {
              headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000)
            });
            const data = await resp.json() as YahooResponse;
            const results = (data.quotes || [])
              .filter((item: YahooQuote) => item.symbol && (item.quoteType === 'EQUITY' || item.quoteType === 'ETF' || item.quoteType === 'MUTUALFUND' || item.quoteType === 'CRYPTOCURRENCY' || item.quoteType === 'CURRENCY'))
              .map((item: YahooQuote) => ({
                symbol: item.symbol,
                name: item.shortname || item.longname || item.symbol,
                type: item.quoteType === 'EQUITY' ? 'stock' : item.quoteType === 'ETF' ? 'etf' : item.quoteType === 'CRYPTOCURRENCY' ? 'crypto' : 'other',
                exchange: item.exchDisp || item.exchange || '',
                currency: inferCurrency(item)
              }));
            // Sort: exact matches & primary US / Euronext Paris first
            results.sort((a, b) => {
              const qLower = q.toLowerCase();
              if (a.symbol.toLowerCase() === qLower) return -1;
              if (b.symbol.toLowerCase() === qLower) return 1;
              const aMain = (!a.symbol.includes('.') || a.symbol.endsWith('.PA')) ? 1 : 0;
              const bMain = (!b.symbol.includes('.') || b.symbol.endsWith('.PA')) ? 1 : 0;
              return bMain - aMain;
            });
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ results }));
          } catch {
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ results: [] }));
          }
        }
        if (pathname === '/api/stock-quote') {
          const urlObj = new URL(req.url || '/', 'http://localhost');
          const symbolsStr = urlObj.searchParams.get('symbols') || '';
          const symbolList = [...new Set(symbolsStr.split(',').map(s => s.trim().toUpperCase()))];
          if (symbolsStr.length > 660 || symbolList.length > 20 || urlObj.searchParams.getAll('symbols').length > 1 || symbolList.some(s => !/^[A-Z0-9^=.-]{1,32}$/.test(s))) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'Provide 1 to 20 valid ticker symbols' }));
          }
          const quotes: Record<string, StockQuote> = {};
          await Promise.allSettled(
            symbolList.map(async (symbol: string) => {
              try {
                const resp = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`, {
                  headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000)
                });
                if (!resp.ok) return;
                const data = await resp.json() as YahooResponse;
                const meta = data.chart?.result?.[0]?.meta;
                if (!meta || typeof meta.regularMarketPrice !== 'number') return;
                const price = meta.regularMarketPrice;
                const previousClose = meta.chartPreviousClose || meta.previousClose || price;
                const change = price - previousClose;
                const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
                quotes[symbol] = {
                  symbol,
                  price,
                  previousClose,
                  change: Math.round(change * 10000) / 10000,
                  changePercent: Math.round(changePercent * 100) / 100,
                  currency: meta.currency || 'EUR',
                  name: meta.shortName || meta.longName || symbol,
                  timestamp: meta.regularMarketTime || Math.floor(Date.now() / 1000),
                };
              } catch { /* Individual unavailable symbols are omitted. */ }
            })
          );
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ quotes }));
        }
        next();
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), stockApiPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/@supabase/')) return 'supabase';
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
