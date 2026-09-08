export const CURRENT_MANIFEST_PATH = 'xfeed/current.json';
export const PUBLIC_SITE_ORIGIN = 'https://scintillahub.ai';
export const MANIFEST_CACHE_SECONDS = 60;
export const IMMUTABLE_CACHE_SECONDS = 31536000;
export const HASH_PATTERN = /^[a-f0-9]{64}$/;

export function publicStoreBase(value) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error('XFEED_BLOB_BASE_URL must be a public Vercel Blob store origin'); }
  if (parsed.protocol !== 'https:' || !/^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/.test(parsed.hostname) || parsed.port || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
    throw new Error('XFEED_BLOB_BASE_URL must be an exact public Vercel Blob store origin');
  }
  return parsed.origin;
}

export function verifiedBlobUrl(value, { base, pathname } = {}) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error('Invalid Blob URL'); }
  const origin = publicStoreBase(parsed.origin);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash || (base && origin !== publicStoreBase(base)) || (pathname && parsed.pathname !== `/${pathname}`)) {
    throw new Error('Blob URL does not match the configured store and artifact path');
  }
  return parsed.href;
}

export function validateManifest(value, base) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schema_version !== 1 || !HASH_PATTERN.test(value.version) || !HASH_PATTERN.test(value.feed_sha256) || !Number.isSafeInteger(value.feed_bytes) || value.feed_bytes < 1 || value.feed_cors_verified !== true || value.cors_origin !== PUBLIC_SITE_ORIGIN) {
    throw new Error('Live feed manifest is invalid');
  }
  verifiedBlobUrl(value.feed_url, { base, pathname: `xfeed/feeds/${value.version}.json` });
  return value;
}

export function unavailableFeed(status, message) {
  return {
    posts: [],
    receipt: { collector_status: status, collector_error: message, collector_heartbeat_at: null, latest_source_event_at: null, stale_after_seconds: null },
    notifications: { status: 'unconfigured', handles: [] },
    version: null,
  };
}
