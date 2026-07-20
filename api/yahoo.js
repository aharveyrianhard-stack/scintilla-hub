// SCINTILLA — same-origin Yahoo Finance relay (kills CORS problem for hub pages)
// Usage: /api/yahoo?path=v8/finance/spark&symbols=XLK,SPY&range=6mo&interval=1d
export default async function handler(req, res) {
  const { path, ...q } = req.query;
  const ALLOWED = /^v(7|8|10)\/finance\//;
  if (!path || !ALLOWED.test(path)) {
    res.status(400).json({ error: 'path must start with v7/finance, v8/finance or v10/finance' });
    return;
  }
  const url = `https://query1.finance.yahoo.com/${path}?${new URLSearchParams(q)}`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' } });
    const j = await r.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.status(r.status).json(j);
  } catch (e) {
    res.status(502).json({ error: 'upstream failed', detail: String(e) });
  }
}
