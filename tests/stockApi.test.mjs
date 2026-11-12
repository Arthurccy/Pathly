import test from 'node:test';
import assert from 'node:assert/strict';
import search from '../api/stock-search.js';
import quote from '../api/stock-quote.js';

function response() {
  return { code: 200, headers: {}, body: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; }, end() { return this; } };
}

test('public stock APIs reject unsupported methods and invalid inputs without fetching', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Unexpected network'); };
  try {
    for (const handler of [search, quote]) {
      const res = response(); await handler({ method: 'POST', query: {} }, res);
      assert.equal(res.code, 405);
      assert.equal(res.headers['Access-Control-Allow-Credentials'], undefined);
    }
    for (const symbols of [['AAPL', 'MSFT'], '', 'AAPL/../../', Array.from({length:21},(_,i)=>`T${i}`).join(','), 'A'.repeat(33)]) {
      const res = response(); await quote({ method: 'GET', query: {symbols} }, res);
      assert.equal(res.code, 400);
    }
    for (const q of [['a','b'], 'A'.repeat(101)]) {
      const res = response(); await search({ method: 'GET', query: {q} }, res);
      assert.equal(res.code, 400);
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('quote API deduplicates valid symbols, limits fanout, and supplies a timeout', async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url, options) => {
    assert.ok(options.signal instanceof AbortSignal);
    urls.push(url);
    return {ok:true,json:async()=>({chart:{result:[{meta:{regularMarketPrice:10,previousClose:8,currency:'EUR'}}]}})};
  };
  try {
    const res = response();
    await quote({method:'GET',query:{symbols:'aapl,AAPL,MSFT'}},res);
    assert.equal(res.code,200);
    assert.equal(urls.length,2);
    assert.equal(res.body.quotes.AAPL.price,10);
    assert.equal(res.body.quotes.AAPL.change,2);
    assert.deepEqual(Object.keys(res.body.quotes),['AAPL','MSFT']);
  } finally { globalThis.fetch = originalFetch; }
});
