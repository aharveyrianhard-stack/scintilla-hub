import { CURRENT_MANIFEST_PATH, publicStoreBase, validateManifest, unavailableFeed } from '../lib/xfeed-store.mjs';

const MAX_MANIFEST_BYTES = 65536;

export function createHandler({ env = process.env, fetchImpl = fetch } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('CDN-Cache-Control', 'no-store');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (!['GET', 'HEAD'].includes(req.method ?? 'GET')) {
      res.setHeader('Allow', 'GET, HEAD, OPTIONS');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    if (!env.XFEED_BLOB_BASE_URL) return res.status(503).json(unavailableFeed('unconfigured', 'The live X feed store is not configured.'));
    try {
      const base = publicStoreBase(env.XFEED_BLOB_BASE_URL);
      // No request URL, query parameter, header, or body can choose an upstream.
      const response = await fetchImpl(`${base}/${CURRENT_MANIFEST_PATH}`, {
        method: 'GET', redirect: 'error', cache: 'no-store',
        headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error('Manifest request failed');
      const length = Number(response.headers.get('content-length'));
      if (Number.isFinite(length) && length > MAX_MANIFEST_BYTES) throw new Error('Manifest is too large');
      const body = await response.text();
      if (Buffer.byteLength(body) > MAX_MANIFEST_BYTES) throw new Error('Manifest is too large');
      const manifest = validateManifest(JSON.parse(body), base);
      // The immutable feed is delivered directly by Blob, avoiding the Function
      // response-size limit. Publication verifies its body and public CORS first.
      res.setHeader('Location', manifest.feed_url);
      res.setHeader('X-Xfeed-Version', manifest.version);
      return res.status(307).end();
    } catch {
      return res.status(503).json(unavailableFeed('error', 'The live X feed manifest is unavailable.'));
    }
  };
}

export default createHandler();
