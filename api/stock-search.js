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

  const { q } = req.query;
  if (q !== undefined && (typeof q !== 'string' || q.length > 100)) {
    return res.status(400).json({ error: 'Invalid search query' });
  }
  if (!q || q.trim().length === 0) {
    return res.status(200).json({ results: [] });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q.trim())}&quotesCount=10&newsCount=0`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ results: [] });
    }

    const data = await response.json();
    const rawQuotes = Array.isArray(data.quotes) ? data.quotes.slice(0, 10) : [];

    const results = rawQuotes
      .filter(item => item.symbol && (item.quoteType === 'EQUITY' || item.quoteType === 'ETF' || item.quoteType === 'MUTUALFUND' || item.quoteType === 'CRYPTOCURRENCY' || item.quoteType === 'CURRENCY'))
      .map(item => ({
        symbol: item.symbol,
        name: item.shortname || item.longname || item.symbol,
        type: item.quoteType === 'EQUITY' ? 'stock' : item.quoteType === 'ETF' ? 'etf' : item.quoteType === 'CRYPTOCURRENCY' ? 'crypto' : 'other',
        exchange: item.exchDisp || item.exchange || '',
        currency: item.currency || 'EUR'
      }));

    return res.status(200).json({ results });
  } catch (err) {
    console.error('Error searching stocks:', err);
    return res.status(500).json({ error: 'Search failed', results: [] });
  }
}
