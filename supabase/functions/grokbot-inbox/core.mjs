// SCINTILLA · grokbot-inbox — the rules of the inbox, as plain ESM.
//
// Everything the function decides lives here: who may post, how big, which kinds, what a valid item is, which
// row it becomes. index.ts only hands this file the function's environment. The same file runs under Node in
// tests/grokbot-inbox.test.mjs with a pretend database, so the checks are tested, not just described.
//
// X posts are validated by the X collector's OWN validators (../_shared/xfeed-normalize.mjs is cut, unchanged,
// from scripts/xfeed-ingest.mjs): ids are decimal strings, handles are X handles, times carry a zone, and the
// address must be an x.com / twitter.com status address that matches the id and the author.
import { normalizePost, recordKey, timestamp } from "../_shared/xfeed-normalize.mjs";
import { cashTags } from "../_shared/sentiment-core.mjs";

export const KINDS = ["x_posts", "youtube_chunks", "youtube_channel_map", "x_following", "news_scores", "heartbeat"];
export const MAX_BYTES = 1024 * 1024;        // 1 MB per POST
export const MAX_ITEMS = 2000;               // per POST
export const MIN_TOKEN_CHARS = 32;           // a shorter configured token is treated as "not configured"
export const HEARTBEAT_JOB = "grokbot:inbox";
export const SUBSCRIPTION_ACCOUNTS = ["personal", "scintilla", "soundscapes", "golf", "ai_research", "fitness"];
export const TEXT_NOT_STORED = "transcript text was not stored: Alan has not approved storing it yet (send preview only)";

const HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const TICKER = /^[A-Z0-9.\-^=]{1,15}$/;
const SLUG = /^[a-z0-9_]{1,40}$/;
const CONFIDENCE = new Set(["high", "medium", "low"]);

const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
});
function fail(message) { throw new Error(message); }
function object(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${name} must be an object`);
  return value;
}
function str(value, name, max, { optional = false, min = 1 } = {}) {
  if (value == null || value === "") { if (optional) return null; fail(`${name} is required`); }
  if (typeof value !== "string") fail(`${name} must be a string`);
  if (value.length < min) fail(`${name} is too short`);
  if (value.length > max) fail(`${name} is longer than ${max} characters`);
  return value;
}
function handle(value, name) {
  const v = typeof value === "string" ? value.replace(/^@/, "") : value;
  if (typeof v !== "string" || !HANDLE.test(v)) fail(`${name} must be an X handle (letters, digits, underscore; 1–15)`);
  return v;
}
function ticker(value, name = "ticker") {
  if (typeof value !== "string") fail(`${name} must be a string`);
  const v = value.trim().replace(/^\$/, "").toUpperCase();
  if (!TICKER.test(v)) fail(`${name} is not a ticker`);
  return v;
}
/** one ticker, a list of tickers, or none ('' = the item names no ticker) */
function tickersOf(source) {
  if (source.ticker != null && source.tickers != null) fail("send ticker or tickers, not both");
  if (source.tickers != null) {
    if (!Array.isArray(source.tickers) || source.tickers.length > 20) fail("tickers must be a list of at most 20");
    const out = [...new Set(source.tickers.map((t) => ticker(t, "tickers[]")))];
    return out.length ? out : [""];
  }
  return [source.ticker == null || source.ticker === "" ? "" : ticker(source.ticker)];
}
function score(value) {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < -1 || value > 1) fail("score must be a number from -1 to 1, or null");
  return +value.toFixed(3);
}
function seconds(value, name, { optional = false } = {}) {
  if (value == null) { if (optional) return null; fail(`${name} is required`); }
  if (!Number.isInteger(value) || value < 0 || value > 864000) fail(`${name} must be whole seconds from the start of the video`);
  return value;
}
function when(value, name, fallback) {
  if (value == null) { if (fallback) return fallback; fail(`${name} is required`); }
  return timestamp(value, name);
}
function slug(value, name, { optional = false } = {}) {
  if (value == null || value === "") { if (optional) return null; fail(`${name} is required`); }
  if (typeof value !== "string" || !SLUG.test(value)) fail(`${name} must be lower-case letters, digits or underscore (1–40)`);
  return value;
}
function webUrl(value, name) {
  const v = str(value, name, 1000);
  let parsed;
  try { parsed = new URL(v); } catch { fail(`${name} must be a web address`); }
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) fail(`${name} must be a plain http(s) address`);
  return parsed.href;
}
/** the collector keeps the whole submitted item under `raw`; the table keeps the fields, not a second copy */
function withoutRaw(post) {
  if (!post) return null;
  const { raw: _raw, ...rest } = post;
  return { ...rest, original: withoutRaw(post.original) };
}

/* ---- one item → rows. Each returns { table, conflict, rows:[…], warnings?:[…] } or throws with the reason ---- */
const ITEM = {
  x_posts(item, ctx) {
    const source = object(item, "item");
    const list = slug(source.list, "list", { optional: true });
    if (typeof source.text === "string" && source.text.length > 30000) fail("text is longer than 30000 characters");
    const post = normalizePost(source, { collected_at: ctx.sent_at, source: "grokbot" });
    return { table: "x_posts", conflict: "record_key", rows: [{
      record_key: recordKey(post), post_id: post.id, handle: post.handle, kind: post.kind, created_at: post.created_at,
      text: post.text, url: post.url, tickers: cashTags(post.text + " " + (post.original?.text || "")),
      photos: post.photos, videos: post.videos, video_url: post.video_url, has_video: post.has_video,
      youtube_id: post.youtube_id, links: post.links, original: withoutRaw(post.original), provenance: post.provenance,
      list, source: "grokbot", updated_at: ctx.now,
    }] };
  },
  youtube_chunks(item, ctx) {
    const source = object(item, "item");
    if (typeof source.video_id !== "string" || !VIDEO_ID.test(source.video_id)) fail("video_id must be the 11-character YouTube id");
    const t_start = seconds(source.t_start, "t_start"), t_end = seconds(source.t_end, "t_end", { optional: true });
    if (t_end != null && t_end < t_start) fail("t_end is before t_start");
    const model = str(source.model, "model", 80);
    const preview = str(source.preview, "preview", 200, { optional: true });
    const text = str(source.text, "text", 20000, { optional: true });
    if (source.channel_id != null && !CHANNEL_ID.test(String(source.channel_id))) fail("channel_id must be a UC… channel id");
    const base = { video_id: source.video_id, t_start, t_end, model, score: score(source.score), preview,
      channel_id: source.channel_id ?? null, source: "grokbot", updated_at: ctx.now };
    const keep = text != null && ctx.textAllowed;
    return { table: "youtube_chunks", conflict: "video_id,t_start,ticker,model",
      /* a row is only ever sent WITH its text or WITHOUT the column, so a later score-only resend never blanks
         text that was stored, and text never reaches the table before Alan allows it */
      group: keep ? "with_text" : "no_text",
      rows: tickersOf(source).map((t) => (keep ? { ...base, ticker: t, text } : { ...base, ticker: t })),
      warnings: text != null && !ctx.textAllowed ? [TEXT_NOT_STORED] : [] };
  },
  youtube_channel_map(item, ctx) {
    const source = object(item, "item");
    if (typeof source.channel_id !== "string" || !CHANNEL_ID.test(source.channel_id)) fail("channel_id must be a UC… channel id (24 characters)");
    if (source.confidence != null && !CONFIDENCE.has(source.confidence)) fail("confidence must be high, medium or low");
    return { table: "x_youtube_channel_map", conflict: "x_handle_lc,channel_id", rows: [{
      x_handle: handle(source.x_handle, "x_handle"), channel_id: source.channel_id,
      channel_title: str(source.channel_title, "channel_title", 200, { optional: true }),
      channel_handle: source.channel_handle == null ? null : str(String(source.channel_handle).replace(/^@/, ""), "channel_handle", 100),
      confidence: source.confidence ?? null, evidence: str(source.evidence, "evidence", 500, { optional: true }),
      seen_at: when(source.seen_at, "seen_at", ctx.sent_at), source: "grokbot",
    }] };
  },
  x_following(item, ctx) {
    const source = object(item, "item");
    return { table: "x_following", conflict: "handle_lc,list", rows: [{
      handle: handle(source.handle, "handle"), list: slug(source.list, "list"),
      name: str(source.name, "name", 100, { optional: true }),
      seen_at: when(source.seen_at, "seen_at", ctx.sent_at), source: "grokbot",
    }] };
  },
  news_scores(item, ctx) {
    const source = object(item, "item");
    const base = { url: webUrl(source.url, "url"), model: str(source.model, "model", 80), score: score(source.score),
      title: str(source.title, "title", 300, { optional: true }),
      published_at: source.published_at == null ? null : timestamp(source.published_at, "published_at"),
      scored_at: when(source.scored_at, "scored_at", ctx.sent_at), source: "grokbot" };
    return { table: "grokbot_news_scores", conflict: "url,ticker,model", rows: tickersOf(source).map((t) => ({ ...base, ticker: t })) };
  },
};
const keyOf = (row, conflict) => conflict.split(",").map((c) => {
  const col = c.endsWith("_lc") ? c.slice(0, -3) : c;      // handle_lc is the database's lower(handle)
  return c.endsWith("_lc") ? String(row[col]).toLowerCase() : String(row[col]);
}).join("\u0001");

/** validate one envelope's items. Pure: no database, no clock but the one handed in. */
export function sortItems(kind, items, ctx) {
  const rejected = [], warnings = new Set(), batches = new Map();
  let accepted = 0;
  items.forEach((item, i) => {
    try {
      const out = ITEM[kind](item, ctx);
      const id = out.table + "|" + (out.group || "");
      if (!batches.has(id)) batches.set(id, { table: out.table, conflict: out.conflict, byKey: new Map() });
      /* the same key twice in one POST is one row (the later item wins) — a database upsert refuses to touch
         the same row twice in one statement, so duplicates are folded here */
      for (const row of out.rows) batches.get(id).byKey.set(keyOf(row, out.conflict), row);
      for (const w of out.warnings || []) warnings.add(w);
      accepted++;
    } catch (e) {
      rejected.push({ i, reason: String(e?.message || e).slice(0, 200) });
    }
  });
  return { accepted, rejected, warnings: [...warnings],
    batches: [...batches.values()].map((b) => ({ table: b.table, conflict: b.conflict, rows: [...b.byKey.values()] })) };
}

/** compare two secrets without the time taken saying how much of the guess was right: both are hashed first
    (so neither length nor a matching prefix shows), then every byte of the two digests is compared. */
export async function sameSecret(given, expected) {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(String(given))), crypto.subtle.digest("SHA-256", enc.encode(String(expected)))]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
async function sha256Hex(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** read at most `max` bytes of a request body; null when it is larger */
async function readCapped(req, max) {
  if (!req.body) return new Uint8Array(0);
  const reader = req.body.getReader(), parts = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) { await reader.cancel().catch(() => {}); return null; }
    parts.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.byteLength; }
  return out;
}
/* a lone half of an emoji is escaped by JSON.stringify but refused by the database API (see _shared/db.ts) */
const wellFormed = (_k, v) => typeof v !== "string" ? v
  : v.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "�");

/** the database, through its REST API with the service role. Errors carry the table and the status, never a header. */
export function restDb({ url, serviceKey, fetch: doFetch = fetch }) {
  const H = { apikey: serviceKey, Authorization: "Bearer " + serviceKey };
  const write = async (path, body, prefer) => {
    const r = await doFetch(url + "/rest/v1/" + path, { method: "POST", headers: { ...H, "Content-Type": "application/json", Prefer: prefer }, body: JSON.stringify(body, wellFormed) });
    if (!r.ok) throw new Error("write " + path.split("?")[0] + " -> " + r.status + " " + (await r.text().catch(() => "")).slice(0, 200));
  };
  return {
    async upsert(table, rows, conflict, chunk = 500) {
      for (let i = 0; i < rows.length; i += chunk) await write(`${table}?on_conflict=${conflict}`, rows.slice(i, i + chunk), "resolution=merge-duplicates,return=minimal");
    },
    insert: (table, row) => write(table, row, "return=minimal"),
    rpc: (name, args) => write("rpc/" + name, args, "return=minimal"),
    async select(path) {
      const r = await doFetch(url + "/rest/v1/" + path, { headers: H });
      if (!r.ok) throw new Error("read " + path.split("?")[0] + " -> " + r.status);
      return r.json();
    },
  };
}

/** the YouTube channels we follow: the bridge row (X accounts' channels) plus our own subscription lists */
export async function channelList(db, accounts) {
  const keys = ["yt_bridge_channels", ...accounts.map((a) => "yt_sub_channels_" + a)];
  const rows = await db.select(`app_config?select=key,value&key=in.(${keys.join(",")})`);
  const byId = new Map();
  const add = (id, from) => {
    if (typeof id !== "string" || !CHANNEL_ID.test(id)) return;
    if (!byId.has(id)) byId.set(id, { channel_id: id, from: [], rss: "https://www.youtube.com/feeds/videos.xml?channel_id=" + id });
    if (!byId.get(id).from.includes(from)) byId.get(id).from.push(from);
  };
  for (const row of rows || []) {
    let v = null;
    try { v = JSON.parse(row.value || "null"); } catch { continue; }
    const list = Array.isArray(v) ? v : (v && (v.ids || v.channels || v.rows)) || [];
    const from = row.key === "yt_bridge_channels" ? "bridge" : "subscription:" + row.key.slice("yt_sub_channels_".length);
    for (const entry of list) add(typeof entry === "string" ? entry : entry?.channel_id, from);
  }
  return [...byId.values()];
}

/**
 * The function. `env` = { url, serviceKey, token, textAllowed, channelAccounts }; `deps` lets a test hand in a
 * pretend database and clock.
 */
export function createHandler(env, deps = {}) {
  const now = deps.now || (() => new Date());
  const configured = typeof env.token === "string" && env.token.length >= MIN_TOKEN_CHARS && env.url && env.serviceKey;
  const db = deps.db || (configured ? restDb({ url: env.url, serviceKey: env.serviceKey, fetch: deps.fetch }) : null);
  const accounts = (env.channelAccounts || ["scintilla"]).filter((a) => SUBSCRIPTION_ACCOUNTS.includes(a));
  const ping = (ok, cause, detail) => db.rpc("job_heartbeat_ping", { p_job: HEARTBEAT_JOB, p_ok: ok, p_cause: cause, p_detail: detail ?? null }).catch(() => {});
  const log = (row) => db.insert("grokbot_inbox", row).catch(() => {});

  return async function serve(req) {
    if (req.method !== "POST" && req.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, 405, { Allow: "GET, POST" });
    /* no token configured = closed. Never open by accident. */
    if (!configured) return json({ ok: false, error: "inbox_not_configured" }, 503);
    const header = req.headers.get("authorization") || "";
    const given = /^Bearer\s+(.+)$/i.exec(header)?.[1] ?? "";
    if (!(await sameSecret(given, env.token))) return json({ ok: false, error: "unauthorized" }, 401, { "WWW-Authenticate": "Bearer" });

    if (req.method === "GET") {
      const last = Object.fromEntries(KINDS.map((k) => [k, null]));
      let channels = [], problems = [];
      try { for (const r of await db.select("grokbot_inbox_last?select=kind,last_received_at")) if (r.kind in last) last[r.kind] = r.last_received_at; }
      catch { problems.push("last_received_per_kind could not be read"); }
      try { channels = await channelList(db, accounts); } catch { problems.push("channels could not be read"); }
      return json({ ok: true, kinds: KINDS, limits: { max_bytes: MAX_BYTES, max_items: MAX_ITEMS }, transcript_text_stored: !!env.textAllowed,
        last_received_per_kind: last, channels_from: ["bridge", ...accounts.map((a) => "subscription:" + a)], channels, ...(problems.length ? { problems } : {}) });
    }

    /* ---- POST ---- */
    const declared = Number(req.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_BYTES) return json({ ok: false, error: "too_large", max_bytes: MAX_BYTES }, 413);
    const bytes = await readCapped(req, MAX_BYTES);
    if (bytes === null) return json({ ok: false, error: "too_large", max_bytes: MAX_BYTES }, 413);
    const at = now().toISOString();
    const receipt = { received_at: at, bytes: bytes.byteLength, body_sha256: await sha256Hex(bytes) };
    const bad = async (reason) => {
      await log({ ...receipt, kind: null, outcome: "bad_envelope", rejections: [{ i: -1, reason }] });
      await ping(false, "BAD_ENVELOPE", reason);
      return json({ ok: false, error: "bad_envelope", reason, accepted: 0, rejected: [] }, 400);
    };
    let body;
    try { body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { return bad("the body is not valid UTF-8 JSON"); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return bad("the body must be an object: {kind, sent_at, items}");
    if (!KINDS.includes(body.kind)) return bad("kind must be one of: " + KINDS.join(", "));
    let sent_at;
    try { sent_at = timestamp(body.sent_at, "sent_at"); } catch (e) { return bad(String(e.message)); }
    const items = body.items ?? (body.kind === "heartbeat" ? [] : null);
    if (!Array.isArray(items)) return bad("items must be a list");
    if (items.length > MAX_ITEMS) return bad(`items carries more than ${MAX_ITEMS} entries; split it`);

    const sorted = body.kind === "heartbeat"
      ? { accepted: items.length, rejected: [], warnings: [], batches: [] }
      : sortItems(body.kind, items, { sent_at, now: at, textAllowed: !!env.textAllowed });

    /* what is logged is what may be kept: transcript text is cut from the log too until Alan allows it */
    const envelope = body.kind === "youtube_chunks" && !env.textAllowed
      ? { ...body, items: items.map((it) => (it && typeof it === "object" && !Array.isArray(it) && "text" in it ? (({ text: _t, ...rest }) => rest)(it) : it)) }
      : body;
    const row = { ...receipt, kind: body.kind, sent_at, items: items.length, accepted: sorted.accepted, rejected: sorted.rejected.length,
      rejections: sorted.rejected.slice(0, 100), envelope };

    try {
      for (const b of sorted.batches) await db.upsert(b.table, b.rows, b.conflict);
    } catch (e) {
      const detail = String(e?.message || e).slice(0, 300);
      await log({ ...row, accepted: 0, outcome: "store_failed", rejections: [{ i: -1, reason: detail }] });
      await ping(false, "STORE_FAILED", detail);
      /* nothing is half-acknowledged: every write is an upsert, so sending the same POST again is safe */
      return json({ ok: false, error: "store_failed", retry: true, accepted: 0, rejected: sorted.rejected }, 503, { "Retry-After": "60" });
    }
    const allBad = items.length > 0 && sorted.accepted === 0;
    await log({ ...row, outcome: allBad ? "all_rejected" : sorted.rejected.length ? "partial" : "ok" });
    await ping(!allBad, allBad ? "ALL_REJECTED" : "OK:" + body.kind, allBad ? sorted.rejected[0]?.reason : null);
    return json({ ok: true, kind: body.kind, accepted: sorted.accepted, rejected: sorted.rejected,
      ...(sorted.warnings.length ? { warnings: sorted.warnings } : {}) });
  };
}
