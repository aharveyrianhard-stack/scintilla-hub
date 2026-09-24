// SCINTILLA · shared plumbing for the sentiment functions.
// Copied from the pattern the estate already trusts (supabase/functions/earnings-report-time):
// keys are read from the FUNCTION environment and never printed, every job takes a single-flight
// flag before it writes, and every run leaves a receipt in app_config so a job nobody watches is
// still a job anybody can check.
export const SB = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
export const H = { apikey: SERVICE, Authorization: "Bearer " + SERVICE };
export const LEXICON_URL = Deno.env.get("SENTIMENT_LEXICON_URL") ||
  "https://scintillahub.ai/data/news-lexicon/lm-headline-v1.json";

export async function pg(path: string) {
  const r = await fetch(SB + "/rest/v1/" + path, { headers: H });
  if (!r.ok) throw new Error("read " + path.split("?")[0] + " -> " + r.status);
  return r.json();
}
/** PostgREST hands out 1,000 rows at a time; walk pages until a short page arrives. */
export async function pgAll(path: string, page = 1000, cap = 20) {
  const out: any[] = [];
  for (let i = 0; i < cap; i++) {
    const rows = await pg(path + (path.includes("?") ? "&" : "?") + `limit=${page}&offset=${i * page}`);
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}
/* 24 Sep: a snippet cut around a matched word can split an emoji in half, leaving a lone
   UTF-16 surrogate. JSON.stringify escapes it, but PostgREST rejects the body as invalid JSON
   (PGRST102) and the whole slice is lost. Every string is made well-formed before it is sent:
   a broken half-emoji becomes U+FFFD, nothing else changes. */
function wellFormed(_k: string, v: unknown) {
  if (typeof v !== "string") return v;
  return v.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD");
}
export async function upsert(table: string, rows: unknown[], onConflict: string, chunk = 500) {
  let written = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const r = await fetch(SB + `/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: "POST",
      headers: { ...H, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(slice, wellFormed),
    });
    if (!r.ok) throw new Error("write " + table + " -> " + r.status + " " + (await r.text()).slice(0, 300));
    written += slice.length;
  }
  return written;
}
export function cfgPut(key: string, value: string) {
  return fetch(SB + "/rest/v1/app_config?on_conflict=key", {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key, value: value.slice(0, 4000) }),
  }).catch(() => {});
}
/** SINGLE FLIGHT. Two runs over the same rows would do the same work twice and could
 *  write a rollup from half a day. Returns null when another run holds the flag. */
export async function claim(key: string, maxMs: number) {
  const busy = await pg(`app_config?select=value&key=eq.${key}`).catch(() => []);
  const since = busy?.[0]?.value && +busy[0].value ? Date.now() - +busy[0].value : Infinity;
  if (since < maxMs) return null;
  await cfgPut(key, String(Date.now()));
  return () => cfgPut(key, "0");
}
/** the lexicon, with the sha of the exact bytes that scored the rows */
export async function lexicon() {
  const r = await fetch(LEXICON_URL, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error("lexicon " + r.status);
  const bytes = new Uint8Array(await r.arrayBuffer());
  const sha = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  return { lex: JSON.parse(new TextDecoder().decode(bytes)), sha };
}
