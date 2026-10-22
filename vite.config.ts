function inferCurrency(item: any): string {
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

function stockApiPlugin() {
  return {
    name: 'stock-api-plugin',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url?.startsWith('/api/stock-search')) {
          const urlObj = new URL(req.url, 'http://localhost');
          const q = urlObj.searchParams.get('q');
          if (!q) {
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ results: [] }));
          }
          try {
            const resp = await fetch(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`, {
              headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const data = await resp.json();
            const results = (data.quotes || [])
              .filter((item: any) => item.symbol && (item.quoteType === 'EQUITY' || item.quoteType === 'ETF' || item.quoteType === 'MUTUALFUND' || item.quoteType === 'CRYPTOCURRENCY' || item.quoteType === 'CURRENCY'))
              .map((item: any) => ({
                symbol: item.symbol,
                name: item.shortname || item.longname || item.symbol,
                type: item.quoteType === 'EQUITY' ? 'stock' : item.quoteType === 'ETF' ? 'etf' : item.quoteType === 'CRYPTOCURRENCY' ? 'crypto' : 'other',
                exchange: item.exchDisp || item.exchange || '',
                currency: inferCurrency(item)
              }));
            // Sort: exact matches & primary US / Euronext Paris first
            results.sort((a: any, b: any) => {
              const qLower = q.toLowerCase();
              if (a.symbol.toLowerCase() === qLower) return -1;
              if (b.symbol.toLowerCase() === qLower) return 1;
              const aMain = (!a.symbol.includes('.') || a.symbol.endsWith('.PA')) ? 1 : 0;
              const bMain = (!b.symbol.includes('.') || b.symbol.endsWith('.PA')) ? 1 : 0;
              return bMain - aMain;
            });
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ results }));
          } catch (e) {
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ results: [] }));
          }
        }
        if (req.url?.startsWith('/api/stock-quote')) {
          const urlObj = new URL(req.url, 'http://localhost');
          const symbolsStr = urlObj.searchParams.get('symbols') || '';
          const symbolList = symbolsStr.split(',').map((s: string) => s.trim().toUpperCase()).filter(Boolean);
          const quotes: Record<string, any> = {};
          await Promise.allSettled(
            symbolList.map(async (symbol: string) => {
              try {
                const resp = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`, {
                  headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                if (!resp.ok) return;
                const data = await resp.json();
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
              } catch {}
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
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api/bridge-proxy': {
        target: 'https://api.bridgeapi.io/v2',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/bridge-proxy/, ''),
      },
      '/api/gocardless-proxy': {
        target: 'https://bankaccountdata.gocardless.com/api/v2',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gocardless-proxy/, ''),
      },
    },
  },
});
