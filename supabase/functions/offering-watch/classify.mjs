// SCINTILLA · offering-watch — the classifier (R2 Part A, 2 Oct 2026). Pure: no network, no clock unless passed in.
// Imported by index.ts (Deno) and by tests/r2-offering-20261002.test.mjs (node). Nothing here reads a key.
//
// Alan, 2 Oct (pasted notes): "dilution announcements". R1 (deliverables/20261002/research-sources/RESEARCH-SOURCES.html §02)
// found the signal: FMP lists every offering filing the day it is filed, but a 424B5 is also how bonds are sold, so the
// first page of the document has to be read (free, SEC). R1's four patterns sorted 11 of 12 filings; the twelfth (Zeta,
// 11 Sep 2026, "Up to $25,000,000 of Shares of Class A Common Stock") is a DOLLAR amount of shares — the fifth pattern.
//
// THE RULE, in order (the cover page is read first, then the first 12,000 characters):
//   1. every decisive phrase is found with its position; the EARLIEST one is the cover's title and decides —
//      notes whose own words say "convertible"/"exchangeable", or a convertible phrase  → CONVERTIBLE
//      notes with a maturity ("6.800% Senior Notes due 2032")                          → DEBT
//      a share count of common stock / ordinary shares / ADSs (R1 #1)                  → EQUITY
//      a DOLLAR amount of common stock (the fifth pattern, Zeta)                        → EQUITY
//   2. at-the-market words (R1 #3) on a cover that sells common stock                    → ATM (shares sold "from time to time")
//   3. preferred stock alone (R1 #4)                                                     → UNCLASSIFIED, the sentence says preferred
//   4. nothing                                                                           → UNCLASSIFIED (a shelf, a resale, a miss)

export const VERSION = "offering-watch-v2";   // v2 (C1, 2 Oct night): the news step — offering headlines first, joined to the filing
export const FORMS = ["424B5", "424B4", "S-3", "S-3ASR", "S-1"];
export const CLASSES = ["EQUITY", "CONVERTIBLE", "ATM", "DEBT", "UNCLASSIFIED"];
/** alert_log severity by class (the brief: EQUITY/CONVERTIBLE/ATM high, DEBT low/info, UNCLASSIFIED medium).
 *  alert_log already uses high / medium / info — DEBT takes "info".
 *  NOT CALLED YET (Alan, 2 Oct: the filings get a home first — the company view's CAPITAL & DILUTION block; "when it has
 *  a home, it can feed alerts"). index.ts writes no alert_log rows; this map and alertRow() wait for that decision. */
export const SEVERITY = { EQUITY: "high", CONVERTIBLE: "high", ATM: "high", DEBT: "info", UNCLASSIFIED: "medium" };
export const HEAD_BYTES = 61440;        // the first ~60 KB of the document
export const HEAD_BYTES_MAX = 245760;   // a cover drowned in markup may read on to 240 KB (same request, still streamed)
export const HEAD_CHARS = 12000;        // R1 classified on the first 12,000 characters of text
export const COVER_CHARS = 6000;        // the cover page: up to "TABLE OF CONTENTS", never more than this
export const SENTENCE_MAX = 300;

const NAMED = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"',
  mdash: "—", ndash: "–", pound: "£", euro: "€", yen: "¥", sect: "§", reg: "®", trade: "™", copy: "©", bull: "•",
  hellip: "…", middot: "·", ensp: " ", emsp: " ", thinsp: " ", zwsp: "" };
const cp = (n) => { try { return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : " "; } catch { return " "; } };

/** HTML (possibly cut mid-tag at the byte limit) → plain text. R1's cleaner left hex entities (&#x201c;) in place;
 *  this one decodes decimal and hex entities, drops inline-XBRL hidden facts, and folds every odd space to one. */
export function cleanHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<ix:header[\s\S]*?<\/ix:header>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/<[^>]*$/, " ")                                   // a tag cut off at the byte limit
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => cp(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => cp(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => (NAMED[n.toLowerCase()] ?? m))
    .replace(/[  -​  　﻿]/g, " ")
    .replace(/[“”„]/g, '"').replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ").trim();
}

// ── the patterns ─────────────────────────────────────────────────────────────────────────────────────────────
// R1 #1 — a share count of common stock ("35,000,000 shares of Class A common stock"), or "common stock offering".
//         Widened for the foreign names we serve (ARM, ASML, TSM, NBIS): ordinary shares and American Depositary Shares.
export const RE_EQUITY = /\d[\d,]*(?:\.\d+)?(?:\s+million)?\s+(?:(?:of\s+)?shares\s+(?:of\s+)?(?:our\s+|its\s+)?(?:Class\s+[A-C]\s+)?(?:common\s+stock|ordinary\s+shares)|(?:Class\s+[A-C]\s+)?ordinary\s+shares|American\s+Depositary\s+Shares|ADSs)|common stock offering/i;
// R1 #2 — notes with a maturity ("6.800% Senior Notes due 2032"). Widened (R2): a PRELIMINARY supplement leaves the numbers
//         blank ("$ % Notes due 20", "Senior Notes Due July , 2037") and utilities sell debentures and bonds — R1's
//         coupon-and-year form missed every one of them in the 120-day backfill. The words in front are kept in the match so
//         "Convertible Senior Notes due 2031" can be told from "Senior Notes due 2031".
export const RE_NOTES = /(?:\b(?:convertible|exchangeable|senior|junior|subordinated|floating|fixed|rate|unsecured|secured|green|first|mortgage|series\s+[A-Z]{1,3})\b[\s\/-]*)*\b(?:notes|debentures|bonds)(?:,?\s+series\s+[\w-]+,?)?\s+due\b/i;
// R1 #3 — an at-the-market programme ("at the market offering" is Rule 415(a)(4)'s own wording).
export const RE_ATM = /at-the-market|at the market offering|\bATM\b\s+(?:offering|program)|equity distribution agreement/i;
// R1 #4 — preferred stock.
export const RE_PREF = /preferred stock|preferred shares|depositary shares,? each representing/i;
// 5th (R2) — a DOLLAR amount of common stock: Zeta 11 Sep 2026 "Up to $25,000,000 of Shares of Class A Common Stock".
export const RE_EQUITY_DOLLARS = /(?:US\$|\$)\s?\d[\d,]*(?:\.\d+)?(?:\s+(?:million|billion))?\s+(?:of\s+)?(?:shares\s+of\s+)?(?:our\s+|its\s+)?(?:Class\s+[A-C]\s+)?(?:common\s+stock|ordinary\s+shares)/i;
// R2 — the cover's own offering sentence, which a PRELIMINARY supplement prints even with the numbers left blank
//      ("We are offering $ of shares of our common stock", "Centrus … is offering … shares of Class A Common Stock")
export const RE_OFFER_EQUITY = /\b(?:we are|is) offering\b[^.]{0,120}?\b(?:shares|common stock|ordinary shares|American Depositary Shares|ADSs)\b/i;
export const RE_OFFER_NOTES = /\b(?:we are|is) offering\b[^.]{0,160}?\b(?:notes|debentures|bonds)\b/i;
// the securities a universal shelf lists after its amount
const RE_MULTI = /^\W{0,6}(?:preferred stock|debt securities|warrants|rights|units|depositary shares|purchase contracts)/i;
// a shelf: what the issuer (or its selling holders) MAY offer from time to time — the sentence for an UNCLASSIFIED row
export const RE_SHELF = /\b(?:we|the company|selling (?:stock|share|security)holders?[^.]{0,80}?)\s+may\s+(?:offer|sell|offer and sell|from time to time)\b/i;
// a convertible phrase outside a "notes due" match (mandatory convertible preferred, exchangeable notes).
export const RE_CONVERTIBLE = /convertible\s+(?:(?:senior|subordinated|unsecured)\s+)*notes|exchangeable\s+(?:senior\s+)?notes|mandatory\s+convertible|convertible\s+(?:perpetual\s+)?preferred/i;

// sizes as printed: "up to 35,000,000 shares", "$1,000,000,000", "£1,000,000,000", "$1.5 billion"
const RE_SIZE_SHARES = /(?:up to\s+)?\d{1,3}(?:,\d{3})+(?:\.\d+)?\s+(?:shares|ordinary shares|American Depositary Shares|ADSs)|(?:up to\s+)?\d+(?:\.\d+)?\s+million\s+(?:shares|ordinary shares|American Depositary Shares|ADSs)/i;
const RE_SIZE_MONEY = /(?:up to\s+)?(?:US\$|\$|£|€)\s?(?:\d{1,3}(?:,\d{3}){2,}(?:\.\d+)?|\d+(?:\.\d+)?\s+(?:million|billion))/i;   // ≥ 1,000,000: never "$2,000 and integral multiples"

/** the cover page: everything before "TABLE OF CONTENTS" (when it comes early enough), at most COVER_CHARS */
export function coverOf(text) {
  const t = String(text || "");
  const i = t.search(/TABLE OF CONTENTS/);
  const end = i > 200 && i < COVER_CHARS ? i : COVER_CHARS;
  return t.slice(0, end);
}

function find(re, s) { const m = re.exec(s); return m ? { i: m.index, m: m[0] } : null; }

/** the sentence around position i, no more than SENTENCE_MAX characters. A period inside a number ($0.0001,
 *  6.800%) is not a sentence end; the title text of a cover page has no periods, so the window is capped. */
export function sentenceAt(text, i, len) {
  const s = String(text || "");
  const isEnd = (k) => s[k] === "." && (k + 1 >= s.length || (s[k + 1] === " " && /[A-Z"'(]/.test(s[k + 2] || "")));
  let a = i; const aMin = Math.max(0, i - 120);
  while (a > aMin && !isEnd(a - 1)) a--;
  if (a > 0 && a === aMin) { const sp = s.indexOf(" ", a); if (sp > 0 && sp < i) a = sp + 1; }   // start on a word
  let b = i + Math.max(1, len || 1); const bMax = Math.min(s.length, a + SENTENCE_MAX);
  while (b < bMax && !isEnd(b)) b++;
  const ended = b < s.length && isEnd(b);
  if (ended) b++;                                                                                // keep the period
  let out = s.slice(a, b).trim();
  if (!ended && b < s.length || out.length > SENTENCE_MAX) {                                     // capped, not ended: say so
    const room = out.slice(0, SENTENCE_MAX - 1); const cut = room.lastIndexOf(" ");
    out = (cut > 200 ? room.slice(0, cut) : room).trim() + "…";
  }
  return out.slice(0, SENTENCE_MAX);
}

/** the size as printed, nearest the deciding phrase: a share count for an equity count, else the money amount */
export function sizeNear(text, i, cls, kind) {
  const s = String(text || "");
  const win = s.slice(Math.max(0, i - 80), i + 420);
  const sh = find(RE_SIZE_SHARES, win), mo = find(RE_SIZE_MONEY, win);
  let pick = null;
  if (cls === "EQUITY" && kind === "count") pick = sh || mo;
  else if (cls === "EQUITY" || cls === "ATM" || cls === "DEBT" || cls === "CONVERTIBLE") pick = mo || sh;
  else pick = sh || mo;
  return pick ? pick.m.replace(/\s+/g, " ").trim() : null;
}

/** the first amount on the cover's title area (2,500 characters): money first for ATM/DEBT/CONVERTIBLE, shares first otherwise */
export function firstSize(cover, cls) {
  const t = String(cover || "").slice(0, 2500);
  const sh = find(RE_SIZE_SHARES, t), mo = find(RE_SIZE_MONEY, t);
  const pick = cls === "EQUITY" || cls === "UNCLASSIFIED" ? (sh || mo) : (mo || sh);
  return pick ? pick.m.replace(/\s+/g, " ").trim() : null;
}

function decide(s, allowPref) {
  const c = [];
  const notes = find(RE_NOTES, s);
  if (notes) c.push({ cls: /convertible|exchangeable/i.test(notes.m) ? "CONVERTIBLE" : "DEBT", i: notes.i, m: notes.m, kind: "notes" });
  const conv = find(RE_CONVERTIBLE, s); if (conv) c.push({ cls: "CONVERTIBLE", i: conv.i, m: conv.m, kind: "convertible" });
  const eq = find(RE_EQUITY, s); if (eq) c.push({ cls: "EQUITY", i: eq.i, m: eq.m, kind: "count" });
  const eq$ = find(RE_EQUITY_DOLLARS, s);
  // a universal shelf's title lists several securities after the amount ("$1,250,000,000 Common Stock Preferred Stock Debt
  // Securities Warrants …"): that is a shelf, not a sale of common stock
  if (eq$ && !RE_MULTI.test(s.slice(eq$.i + eq$.m.length, eq$.i + eq$.m.length + 80))) c.push({ cls: "EQUITY", i: eq$.i, m: eq$.m, kind: "dollars" });
  const oe = find(RE_OFFER_EQUITY, s), on = find(RE_OFFER_NOTES, s);
  if (oe && (!on || oe.i <= on.i)) c.push({ cls: "EQUITY", i: oe.i, m: oe.m, kind: "offering" });
  if (on && (!oe || on.i < oe.i)) c.push({ cls: /convertible|exchangeable/i.test(on.m) ? "CONVERTIBLE" : "DEBT", i: on.i, m: on.m, kind: "offering" });
  c.sort((x, y) => x.i - y.i);
  let best = c[0] || null;
  const atm = find(RE_ATM, s);
  if (atm && (!best || best.cls === "EQUITY")) best = { cls: "ATM", i: atm.i, m: atm.m, kind: "atm", title: best };
  if (!best && allowPref) {                                   // the cover only, and never a contents line ("Description of … Preferred Stock")
    const pref = find(RE_PREF, s);
    if (pref && !/description of\b[^.]{0,40}$/i.test(s.slice(Math.max(0, pref.i - 50), pref.i))) best = { cls: "UNCLASSIFIED", i: pref.i, m: pref.m, kind: "preferred" };
  }
  return best;
}

/** text → { cls, sentence, size_text, rule }. Reads the cover first, then the first HEAD_CHARS. */
export function classify(text) {
  const head = String(text || "").slice(0, HEAD_CHARS);
  const cover = coverOf(head);
  for (const [scope, where] of [[cover, "cover"], [head, "head"]]) {
    const d = decide(scope, where === "cover");
    if (!d) continue;
    // the sentence: an ATM decision quotes the at-the-market words; the size comes from the title it sells
    const sentence = sentenceAt(scope, d.i, d.m.length);
    const at = d.kind === "atm" && d.title ? d.title : d;
    const size = sizeNear(scope, at.i, d.cls, at.kind) || (d.kind === "atm" ? sizeNear(scope, d.i, d.cls, "atm") : null) ||
      firstSize(cover, d.cls);                                    // the title's own amount ("… Offering Price of Up to $1,000,000,000")
    return { cls: d.cls, sentence, size_text: size, rule: d.kind + "@" + where };
  }
  // nothing decided: a shelf registration says what it MAY sell "from time to time" — keep that sentence as the reason
  const shelf = find(RE_SHELF, head);
  if (shelf) return { cls: "UNCLASSIFIED", sentence: sentenceAt(head, shelf.i, shelf.m.length), size_text: firstSize(cover, "UNCLASSIFIED"), rule: "shelf" };
  return { cls: "UNCLASSIFIED", sentence: null, size_text: firstSize(cover, "UNCLASSIFIED"), rule: "none" };
}

// ── New York time ───────────────────────────────────────────────────────────────────────────────────────────
const NY = "America/New_York";
const wallFmt = new Intl.DateTimeFormat("en-CA", { timeZone: NY, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
function nyWall(ms) {
  const p = Object.fromEntries(wallFmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}
/** FMP's acceptedDate ("2026-10-02 14:25:28") is EDGAR's acceptance time, New York wall clock → ISO UTC */
export function etToUtcIso(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(s || ""));
  if (!m) return null;
  const want = `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6]}`;
  for (const off of [4, 5]) {
    const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] + off, +m[5], +m[6]);
    if (nyWall(ms) === want) return new Date(ms).toISOString();
  }
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] + 5, +m[5], +m[6])).toISOString();
}
/** the market's calendar day in New York (the UTC day rolls at 8 pm ET) */
export function nyDay(ms) { return nyWall(ms).slice(0, 10); }
export function shiftDay(day, n) { const d = new Date(day + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function isWeekday(day) { const w = new Date(day + "T12:00:00Z").getUTCDay(); return w !== 0 && w !== 6; }
export function prevWeekday(day) { let d = shiftDay(day, -1); while (!isWeekday(d)) d = shiftDay(d, -1); return d; }
/** EDGAR files on weekdays only; holidays simply return no rows */
export function weekdays(from, to) {
  const out = []; if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return out;
  for (let d = from; d <= to && out.length < 400; d = shiftDay(d, 1)) if (isWeekday(d)) out.push(d);
  return out;
}
/** pass mode: the previous weekday and today (New York) — "yesterday + today", and Friday's late filings on a Monday */
export function passDays(nowMs) { const t = nyDay(nowMs); return [prevWeekday(t), t]; }

// ── rows ────────────────────────────────────────────────────────────────────────────────────────────────────
/** one FMP sec-filings-search row ∩ the universe → the table row it becomes (class filled in later) */
export function filingFromFmp(r, universe) {
  const sym = String((r && r.symbol) || "").trim().toUpperCase();
  if (!sym || !universe.has(sym)) return null;
  const url = String(r.finalLink || r.link || "").trim();
  if (!/^https:\/\/www\.sec\.gov\//.test(url)) return null;
  const filed = String(r.filingDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(filed)) return null;
  return { url, ticker: sym, cik: r.cik ? String(r.cik) : null, form: String(r.formType || "").trim(), filed_date: filed,
    accepted_utc: etToUtcIso(r.acceptedDate) };
}
/** the alert_log message: form · class · size · filed date · the SEC link */
export function alertMessage(row) {
  return [row.form, row.class, row.size_text || "size not printed on the cover", "filed " + row.filed_date, row.url].join(" · ");
}
/** the alert_log row for a filing seen for the first time — not called yet (see SEVERITY) */
export function alertRow(row, nowMs) {
  const at = row.accepted_utc ? Date.parse(row.accepted_utc) : NaN;
  return { ticker: row.ticker, kind: "offering_filed", severity: SEVERITY[row.class] || "medium", message: alertMessage(row),
    ts: Math.floor((Number.isFinite(at) ? at : nowMs) / 1000) };
}

// ── C1 (2 Oct 2026, night) · the press release first ──────────────────────────────────────────────────────────
// Alan ~22:00 ET: "If Massive news has the press release a day earlier — why would we design this on a source that is
// slower?" Our news table (news-feed, cron 6) carries FMP's press-release feed (businesswire, globenewswire …), Google
// News and investing.com — not Massive's /v2/reference/news, and no Massive key sits in app_config. Measured: CoreWeave's
// "Announces At-the-Market Offering Program" (businesswire via FMP) was stored for 03:29 ET on 17 Sep; the 424B5 was
// accepted at 07:11 ET. Its $3.0B convertible notes were a private (144A) sale: no SEC offering filing at all — the
// headline is the only sighting. A headline counts when it names an offering AND a security or an amount, so a "cloud
// offering" or "CEO holds convertible shares" does not.
export const NEWS_DAYS = 2;
const RE_NEWS_ACT = /\b(?:prices?|priced|pricing|announces?|announced|proposed?|proposes|launch(?:es|ed)?|upsized?|files?|filed|completes?|completed|closes?|closed|commences?|plans?)\b[^.!?]{0,90}\boffering\b/i;
const RE_NEWS_DIRECT = /\b(?:public|secondary|follow-on|underwritten|stock|share|equity|common stock|notes?|debt|bond|convertible|registered direct|at-the-market|ATM)\s+(?:offering|program)\b|\b(?:convertible\s+)?(?:debt|notes?)\s+(?:sale|raise)\b|\bconvertible (?:senior |subordinated )?notes?\b|\bat-the-market\b|\bregistered direct\b|\bprivate placement\b|\b(?:mixed|universal)\s+shelf\b|\bshelf (?:registration|offering|filing)\b|\boffering (?:of )?up to \$/i;
const RE_NEWS_WHAT = /\b(?:shares?|stock|notes?|debentures?|bonds?|convertible|at-the-market|ATM|units|warrants|ADSs?|private placement|registered direct|shelf|public offering|secondary offering)\b|\$\s?\d|\d\s?(?:million|billion|M|B)\b/i;
const RE_NEWS_NOT = /\b(?:cloud|product|service|AI|software|platform|insurance|menu|solutions?)\s+offerings?\b/i;
/** the offering kind a headline names, or null when it is not about raising money */
export function newsKind(title) {
  const t = String(title || "");
  if (!(RE_NEWS_ACT.test(t) || RE_NEWS_DIRECT.test(t)) || !RE_NEWS_WHAT.test(t)) return null;
  if (RE_NEWS_NOT.test(t) && !RE_NEWS_DIRECT.test(t.replace(RE_NEWS_NOT, ""))) return null;
  if (/\b(?:redemption|redeems?|redeemed|repurchases?|buys? back|tender offer)\b/i.test(t)) return null;          // paying notes back, not raising money
  if (/convertible|exchangeable/i.test(t)) return "CONVERTIBLE";
  if (/at-the-market|\bATM\b|equity distribution/i.test(t)) return "ATM";
  if (/registered direct|private placement/i.test(t)) return "PLACEMENT";
  if (/\bshelf\b/i.test(t)) return "SHELF";
  if (/\b(?:notes?|debentures?|bonds?|debt)\s+(?:offering|sale|raise)\b|\bsenior notes\b|\bnotes due\b/i.test(t) && !/\b(?:shares|common stock)\s+offering\b|\bof\s+[\d,.]+\s*(?:million\s+)?shares\b/i.test(t)) return "DEBT";
  return "EQUITY";
}
// Google News files a headline under every ticker its query matched: measured on the first run (2 Oct, 21 days), COST got
// "Yarrow Bioscience … Public Offering", LOW got Oklo's, TGT got "Agree Realty stock price target". So a headline must
// name the company itself (its short name, as written, or its ticker in "(OKLO)" / "NYSE: OKLO" / "$OKLO" form).
const GENERIC = /^(?:american|first|general|united|national|international|global|southern|western|eastern|northern|royal|federal|public|digital|applied|advanced|texas|pacific|atlantic|old|new|bank|the)$/i;
/** "Axon Enterprise, Inc." → "Axon" · "American Tower Corporation" → "American Tower" · "SharonAI Holdings, Inc. Class A Common Stock" → "SharonAI" */
export function shortName(name) {
  const s = String(name || "").replace(/\b(?:Class [A-C] )?(?:Common|Ordinary) (?:Stock|Shares)\b.*$/i, "").replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/[,.]?\s+(?:Inc|Corp|Corporation|Incorporated|Company|Co|Holdings?|Group|plc|Ltd|Limited|N\.V|S\.A|SE|AG|L\.P|LP|Technologies|Enterprises?)\.?\b.*$/i, "").trim();
  const w = s.split(/\s+/).filter(Boolean);
  if (!w.length) return null;
  return GENERIC.test(w[0]) && w[1] ? w[0] + " " + w[1] : w[0];
}
export function namesCompany(title, ticker, name) {
  const t = String(title || ""), tk = String(ticker || "").toUpperCase();
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (tk && new RegExp("\\((?:[A-Z]+:\\s?)?" + esc(tk) + "\\)|\\b(?:NASDAQ|NYSE|NYSEARCA|AMEX|OTC)\\s?:\\s?" + esc(tk) + "\\b|\\$" + esc(tk) + "\\b").test(t)) return true;
  if (tk.length >= 4 && new RegExp("(?:^|[^A-Za-z])" + esc(tk) + "(?![A-Za-z])").test(t)) return true;   // "CRWV Stock Drops …"
  const n = shortName(name);
  if (!n || n.length < 3) return false;
  return new RegExp("(?:^|[^A-Za-z])(?:" + esc(n) + "|" + esc(n.toUpperCase()) + ")(?![A-Za-z])").test(t);   // as written: "Target" ≠ "price target"
}
/** one stored news row ∩ the Hub stocks → the offering_news row, or null. `names` maps ticker → company name; a headline
 *  that does not name the company is dropped (when a name is known). */
export function newsFromRow(r, universe, names) {
  const tk = String((r && r.ticker) || "").toUpperCase();
  if (!tk || !universe.has(tk)) return null;
  if (names && names[tk] && !namesCompany(r.title, tk, names[tk])) return null;
  const url = String(r.url || "").trim(), title = String(r.title || "").trim(), ts = Number(r.published_ts);
  if (!/^https?:\/\//.test(url) || !title || !Number.isFinite(ts) || ts <= 0) return null;
  const kind = newsKind(title);
  if (!kind) return null;
  return { ticker: tk, url, published_utc: new Date(ts * 1000).toISOString(), source: String(r.site || "").slice(0, 80) || null,
    feed: String(r.feed || "").slice(0, 20) || null, title: title.slice(0, 400), kind };
}
const KIND_CLASS = { CONVERTIBLE: ["CONVERTIBLE"], ATM: ["ATM"], EQUITY: ["EQUITY", "ATM"], DEBT: ["DEBT"], PLACEMENT: ["EQUITY"], SHELF: ["UNCLASSIFIED", "EQUITY", "ATM"] };
/** the filing a headline announced: same ticker, filed from the day before the headline (New York) to 7 days after,
 *  a class that fits the headline's kind; the nearest one after the headline wins. null when none has arrived. */
export function joinFiling(n, filings) {
  const day = nyDay(Date.parse(n.published_utc));
  const lo = shiftDay(day, -1), hi = shiftDay(day, 7), want = KIND_CLASS[n.kind] || [];
  const at = (f) => (f.accepted_utc ? Date.parse(f.accepted_utc) : Date.parse(f.filed_date + "T21:00:00Z"));
  const c = (filings || []).filter((f) => f && f.ticker === n.ticker && f.filed_date >= lo && f.filed_date <= hi && want.includes(f.class))
    .sort((a, b) => Math.abs(at(a) - Date.parse(n.published_utc)) - Math.abs(at(b) - Date.parse(n.published_utc)));
  const after = c.filter((f) => at(f) >= Date.parse(n.published_utc) - 86400e3);
  return (after[0] || c[0] || null);
}
