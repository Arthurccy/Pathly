export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbols } = req.query;
  if (typeof symbols !== 'string' || symbols.length > 660) {
    return res.status(400).json({ error: 'Invalid symbols parameter' });
  }
  const symbolList = [...new Set(symbols.split(',').map(s => s.trim().toUpperCase()))];
  if (symbolList.length === 0 || symbolList.length > 20 || symbolList.some(s => !/^[A-Z0-9^=.-]{1,32}$/.test(s))) {
    return res.status(400).json({ error: 'Provide 1 to 20 valid ticker symbols' });
  }

  const quotes = {};

  await Promise.allSettled(
    symbolList.map(async (symbol) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
        const response = await fetch(url, {
          signal: AbortSignal.timeout(8000),
      headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });

        if (!response.ok) return;

        const data = await response.json();
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
      } catch (err) {
        console.error(`Error fetching quote for ${symbol}:`, err.message);
      }
    })
  );

  return res.status(200).json({ quotes });
}
