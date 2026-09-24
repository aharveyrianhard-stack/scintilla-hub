// Bar extraction from the Scintilla chart API (the only permitted price source).
// Read-only GETs. Every extract records the API's own provenance fields verbatim, so a table
// can always name feed, session anchor, adjustment basis and source namespace.
import { canonicalJson, sha256 } from "./settings.mjs";
export const API = "https://scintilla-massive-chart-api.fly.dev";
export const ORIGIN = "https://scintillahub.ai";
export const BARS_VERSION = "bars-0.1.0";

/** Packet timeframes -> the API's accepted `tf` tokens (from GET /intervals). */
export const TF = Object.freeze({ "1H": "60", "3H": "180", "4H": "240", "1D": "D" });

export async function fetchJson(path, { timeoutMs = 90000 } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API}${path}`, { headers: { Origin: ORIGIN }, signal: ctl.signal });
    const body = await res.json();
    if (!res.ok) throw new Error(`${path} -> HTTP ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
    return body;
  } finally { clearTimeout(timer); }
}

const ET = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour12: false,
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
/** ET wall clock for a bar's open, so session membership is stated rather than assumed. */
export function etParts(epochMs) {
  const p = Object.fromEntries(ET.formatToParts(new Date(epochMs)).filter((x) => x.type !== "literal").map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, minute: Number(p.minute) };
}

/** Fetch one symbol/timeframe with full provenance and a content hash of the bar array. */
export async function fetchBars(symbol, tfKey, { limit = 5000 } = {}) {
  const tf = TF[tfKey];
  if (!tf) throw new Error(`unsupported packet timeframe ${tfKey}`);
  const body = await fetchJson(`/candles?symbol=${encodeURIComponent(symbol)}&tf=${tf}&limit=${limit}`);
  const series = (body.series ?? []).map((b, i) => ({ i, t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v, n: b.n ?? null }));
  for (let i = 1; i < series.length; i++) {
    if (!(series[i].t > series[i - 1].t)) throw new Error(`${symbol} ${tfKey}: non-monotonic bar at ${i}`);
  }
  return {
    symbol, timeframe: tfKey, api_tf: tf, bars: series, bar_count: series.length,
    bars_sha256: sha256(canonicalJson(series.map((b) => [b.t, b.o, b.h, b.l, b.c, b.v]))),
    provenance: {
      provider: body.provider, surface: body.surface, price_basis: body.price_basis,
      volume_basis: body.volume_basis, bar_authority: body.bar_authority, aggregation: body.aggregation,
      session_anchor: body.session_anchor, served_from: body.served_from,
      source_namespace: body.source_namespace, display: body.display,
      full_series_count: body.full_series_count, provider_symbol: body.provider_symbol,
      newest: body.newest, requested_through_et: body.provider_refresh?.requested_through_et ?? null,
      acquired_utc: body.provider_refresh?.acquired_utc ?? null,
      refresh_run_id: body.provider_refresh?.run_id ?? null,
      no_rebucket: body.provider_refresh?.no_rebucket ?? null,
      no_fill: body.provider_refresh?.no_fill ?? null,
      incomplete_trailing_dropped: body.incomplete_trailing_dropped ?? null,
      bar_finality_policy: body.bar_finality?.policy ?? null,
      current_session_policy: body.current_session?.policy ?? null,
    },
    // The API exposes ONE stream and ignores session parameters; the session mode is therefore
    // whatever the provider anchors, recorded verbatim rather than claimed.
    session_mode: `provider_stream:${body.session_anchor ?? "unknown"}`,
    adjustment_mode: body.price_basis ?? "unknown",
    et_first: series.length ? etParts(series[0].t) : null,
    et_last: series.length ? etParts(series[series.length - 1].t) : null,
    fetched_utc: new Date().toISOString(),
    bars_version: BARS_VERSION,
  };
}

/** Bars whose ET open falls inside 09:30–16:00, i.e. the regular equity session. */
export const regularSessionBars = (bars) => bars.filter((b) => {
  const { hour, minute } = etParts(b.t);
  const m = hour * 60 + minute;
  return m >= 570 && m < 960;
});
