/* M63 — what the tape, the cards and the bell promise.
 *
 * Headless, offline, no browser: the page's own bytes are the fixture. The M63 block is lifted out
 * of index.html and run with stubs for the things it leans on, so these tests fail the moment the
 * shipped code stops behaving the way this deliverable says it does.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { yahooRows, parseYahooRss, pubSeconds, hostOf } from "../lib/yahoo-news.mjs";
import { detectIndexChanges, INDEX_CHANGE_KIND } from "../scripts/scintillas-detect.mjs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

/* ── the M63 engine, lifted and run with stubs ──────────────────────────────────────────────── */
/* the chip's words live with the strip, the tape and the cards live in the engine block: both are
   lifted verbatim, so a test can never pass against code the page does not actually ship. */
const STRIP = page.slice(page.indexOf("function scintTapeWrapHTML"), page.indexOf("function scintStripHTML"));
const BLOCK = STRIP + page.slice(page.indexOf("/* ══ M63 · ONE TAPE"), page.indexOf("/* ── the four surfaces"));
function engine(o = {}) {
  const rows = o.rows || [];
  const src = `
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    const fmtC = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(+n).toFixed(1) + "%";
    const fmtCap = (n) => "$" + (+n / 1e6).toFixed(1) + "M";
    const ET_DAY = { format: (d) => new Date(d).toISOString().slice(0, 10) };
    const scintDayET = (ts) => ET_DAY.format(new Date(ts));
    let SCINT_ROWS = ${JSON.stringify(rows)};
    const SCINT_GLOW_CAP = 12;
    const scintKey = (kind, subject) => String(kind) + "|" + String(subject == null ? "" : subject).toUpperCase();
    const scintToday = () => SCINT_ROWS;
    const scintWhat = (ev) => ({ price_outlier: "outlier of the day", dilution: "dilution",
      earnings_surprise: "earnings surprise", index_change: "index change" }[ev.kind] || "scintilla");
    const scintSays = (ev) => "LONG(" + ev.kind + ")";
    const scintClass = (ev) => (ev.direction > 0 ? "up" : ev.direction < 0 ? "dn" : "");
    const scintTone = (ev) => (ev.direction > 0);
    const scintUnusual = (ev) => (ev.magnitude != null ? ev.magnitude + "× its usual" : "");
    const favList = () => ${JSON.stringify(o.favs || [])};
    const pg = async () => [];
    ${BLOCK}
    return { scTapeHTML, scTapeChipHTML, scintChipSays, scintTapeItems, scintReason, scintHeadline,
             scintIndexSays, scToastEligible, SCINT_NEWS, SC_TOAST_MS, SC_TOAST_MAX, SC_INDEX_NAMES,
             setNews: (m) => { for (const [k, v] of m) SCINT_NEWS.set(k, v); } };`;
  return new Function("window", "document", "Date", src)(o.window || {}, o.document || undefined, Date);
}
const outlier = (sub, pct, x, extra = {}) => ({ ts: "2026-09-24T14:00:00Z", kind: "price_outlier", subject: sub,
  subject_kind: "ticker", direction: pct > 0 ? 1 : -1, magnitude: x, detail: { move_pct: pct, ...extra } });

test("a chip says exactly what Alan asked for: the name, the move, and how unusual it was", () => {
  const E = engine();
  assert.equal(E.scintChipSays(outlier("EOSE", -12.3, 1.839)), "−12.3% · 1.8× usual");
});

test("the tape is chips in a scroller, and a chip is a button that goes to the name", () => {
  const E = engine({ rows: [outlier("EOSE", -12.3, 1.8)] });
  const html = E.scTapeHTML({ id: "scint", label: "today", items: E.scintTapeItems([outlier("EOSE", -12.3, 1.8)]) });
  assert.match(html, /class="sc-tape"/);
  assert.match(html, /data-act="scchip"/, "a chip goes through the page's one click dispatcher");
  assert.match(html, /data-sub="EOSE"/);
  assert.match(html, /data-isco="1"/, "a ticker chip knows it is a company");
  assert.match(html, /sc-tape__chip dn/, "a fall is red, never grey");
});

test("the tape scrolls sideways and its chips never wrap — no second row appears on the dashboard", () => {
  const css = page.slice(page.indexOf("/* ── M63 · THE TAPE"), page.indexOf("/* ── M63 · THE TOASTS"));
  assert.match(css, /\.sc-tape\{[^}]*overflow-x:auto/);
  assert.match(css, /\.sc-tape\{[^}]*flex:1 1 auto/);
  assert.match(css, /\.sc-tape__chip\{[^}]*flex:0 0 auto/);
  assert.match(css, /\.sc-tape__chip\{[^}]*white-space:nowrap/);
  assert.match(css, /scroll-snap-type:x/, "a swipe lands on a chip, not between two");
  assert.ok(!/\.sc-tape\{[^}]*flex-wrap:wrap/.test(css), "wrapping would grow the strip and push the board down");
});

test("the strip is still ONE line in the same place: same host, same label, no new row", () => {
  assert.match(page, /function scintTapeWrapHTML/);
  assert.match(page, /TODAY’S SCINTILLAS/);
  assert.equal((page.match(/id="scintStrip"/g) || []).length, 1, "one strip, where it always was");
  assert.match(page, /const tape = scTapeHTML\(\{ id: "scint"/);
});

test("a swipe is not a tap: past four pixels the click that ends the drag is swallowed", () => {
  assert.match(page, /if \(Math\.abs\(dx\) > 4\) \{ t\.classList\.add\("is-drag"\)/);
  assert.match(page, /if \(t\.dataset\.moved === "1"\) \{ e\.preventDefault\(\); e\.stopPropagation\(\)/);
});

test("the reason is stored fact or nothing: dilution first, then earnings, then an index change", () => {
  const px = outlier("BYND", -12.2, 2.3);
  const dil = { ts: "2026-09-24T12:00:00Z", kind: "dilution", subject: "BYND", subject_kind: "ticker",
                direction: -1, magnitude: null, detail: { principal_usd: 15000000, pattern: "note_exchange_for_shares" } };
  const ern = { ts: "2026-09-24T11:00:00Z", kind: "earnings_surprise", subject: "BYND", subject_kind: "ticker",
                direction: -1, magnitude: 2, detail: { measure: "eps", measures: [{ name: "eps", surprise_pct: -18.4 }] } };
  const idx = { ts: "2026-09-24T10:00:00Z", kind: "index_change", subject: "BYND", subject_kind: "ticker",
                direction: 1, magnitude: null, detail: { index: "S&P 500", action: "added", effective_date: "2026-09-29" } };
  assert.equal(engine({ rows: [px, dil, ern, idx] }).scintReason(px).kind, "dilution");
  assert.equal(engine({ rows: [px, ern, idx] }).scintReason(px).kind, "earnings");
  assert.equal(engine({ rows: [px, idx] }).scintReason(px).kind, "index_change");
  assert.equal(engine({ rows: [px] }).scintReason(px), null, "nothing found means nothing shown");
  const E = engine({ rows: [px, dil] });
  assert.match(E.scintReason(px).short, /dilution · \$15\.0M/);
});

test("a headline is a reason only when the store has one for that name, on that day", () => {
  const px = outlier("EOSE", -12.3, 1.8);
  const E = engine({ rows: [px] });
  E.setNews([["EOSE", { title: "Eos Energy prices $50M offering - Reuters", url: "https://x/y",
                        ts: Math.floor(Date.parse("2026-09-24T13:00:00Z") / 1000) }]]);
  const why = E.scintReason(px);
  assert.equal(why.kind, "news");
  assert.equal(why.short, "Eos Energy prices $50M offering", "Google's publisher tail is not part of the story");
  const stale = engine({ rows: [px] });
  stale.setNews([["EOSE", { title: "old", url: "u", ts: Math.floor(Date.parse("2026-09-21T13:00:00Z") / 1000) }]]);
  assert.equal(stale.scintReason(px), null, "yesterday's headline does not explain today's move");
});

test("only the four things Alan named get a card", () => {
  const E = engine({ favs: ["MU", "SPY"] });
  assert.equal(E.scToastEligible(outlier("MU", -6, 2.2)), true, "a favourite");
  assert.equal(E.scToastEligible(outlier("SPY", -1.4, 2.1)), true, "an index he holds");
  assert.equal(E.scToastEligible(outlier("QQQ", -1.2, 2.0)), true, "an index by name");
  assert.equal(E.scToastEligible(outlier("XEL", 4.2, 3.4)), false, "a name he does not follow stays in the bell");
  assert.equal(E.scToastEligible(outlier("SHAZ", -9.8, 1.2, { asset_class: "index_etf" })), true);
  assert.equal(E.scToastEligible({ kind: "dilution", subject: "BYND" }), true);
  assert.equal(E.scToastEligible({ kind: "earnings_surprise", subject: "NKE" }), true);
  assert.equal(E.scToastEligible({ kind: "index_change", subject: "BE" }), true);
  assert.equal(E.scToastEligible({ kind: "econ_imminent", subject: "US|CPI" }), false, "the econ tape already says this");
});

test("three at a time, six seconds, and never over the board's first row", () => {
  const E = engine();
  assert.equal(E.SC_TOAST_MS, 6000);
  assert.equal(E.SC_TOAST_MAX, 3);
  const css = page.slice(page.indexOf("/* ── M63 · THE TOASTS"), page.indexOf("/* M55 — a scintilla in the notifications list"));
  const stack = css.match(/\.sc-toasts\{([^}]*)\}/)[1];
  assert.match(stack, /position:fixed/);
  assert.match(stack, /bottom:12px/);
  assert.ok(!/\btop:/.test(stack), "a top-anchored stack is the one thing that could cover the first row");
  assert.match(css, /prefers-reduced-motion/, "reduced motion stops the movement, not the notification");
  assert.match(page, /if \(at < SC_BOOT_MS - 60000\) continue;|at < SC_BOOT_MS - 60000/, "history goes to the bell, not to a card");
});

test("every card is also a bell row, and the card is dismissable", () => {
  assert.match(page, /window\.scToastNews = function/);
  assert.match(page, /sc-toast__x/);
  assert.match(page, /scToastDrop\(n\), SC_TOAST_MS/);
});

/* ── the bell ───────────────────────────────────────────────────────────────────────────────── */
test("the badge IS the list, counted — the 99 that nobody could see is gone", () => {
  const src = page.match(/  function unreadCount\(\)\{[\s\S]*?\n  \}\n/)[0];
  const store = { sc_alerts: JSON.stringify([{ ticker: "MU", read: false }, { ticker: "BE", read: true }, { kind: "dilution", read: false }]) };
  const f = new Function("jget", "ALERTS_KEY", src + "return unreadCount;")((k, d) => (store[k] ? JSON.parse(store[k]) : d), "sc_alerts");
  assert.equal(f(), 2, "two unread rows, so the badge reads 2");
  assert.ok(!/var unread = \(\+jget\(UNREAD_KEY,0\)\|\|0\) \+ added;/.test(page), "the free-running counter is gone");
  assert.match(page, /function paintBadge\(\)\{\s*\n\s*var n = unreadCount\(\);/);
});

test("news in the bell is one row per name, with how many more that name has had", () => {
  assert.match(page, /row\.more = \(row\.more\|\|0\) \+ 1;/);
  assert.match(page, /if\(tsMs\(it\.ts\) >= tsMs\(row\.ts\)\)\{ row\.title=it\.title/, "the row keeps the NEWEST headline");
  assert.match(page, / more on '\+esc\(a\.ticker\)\+' today/);
});

test("the bell watches favourites, plus a name that just scintillated", () => {
  assert.match(page, /function watchList\(\)\{/);
  assert.match(page, /scintNewsSubjects\(\)\.forEach\(function\(t\)\{ if\(out\.indexOf\(t\)<0\) out\.push\(t\); \}\);/);
  assert.match(page, /var favs = watchList\(\);/);
});

test("an empty bell says what would land in it, in his own numbers", () => {
  assert.ok(!/No notifications yet\./.test(page), "the old text is gone");
  assert.match(page, /Nothing yet today\./);
  assert.match(page, /favourites<\/b> \(one line per name, newest headline\)/);
  assert.match(page, /a dilution filing, an earnings surprise/);
});

/* ── index changes ──────────────────────────────────────────────────────────────────────────── */
test("one provider row that swaps two names becomes two events, each with its effective date", () => {
  const { events, skipped } = detectIndexChanges({
    changes: [{ date: "2026-09-22", symbol: "BE", addedSecurity: "Bloom Energy",
                removedTicker: "MRO", removedSecurity: "Marathon Oil", reason: "Market capitalization change" }],
    index: "S&P 500", ts: "2026-09-24T13:00:00Z", today: "2026-09-24",
  });
  assert.equal(skipped.length, 0);
  assert.equal(events.length, 2);
  const [add, rem] = events;
  assert.equal(add.kind, INDEX_CHANGE_KIND);
  assert.equal(add.subject, "BE"); assert.equal(add.direction, 1);
  assert.equal(add.detail.effective_date, "2026-09-22");
  assert.equal(add.detail.announced_date, null, "this endpoint does not publish it, so nothing is claimed");
  assert.equal(add.detail.replaces, "MRO");
  assert.equal(add.magnitude, null, "a company has no usual number of index changes");
  assert.equal(rem.subject, "MRO"); assert.equal(rem.direction, -1);
  assert.equal(rem.detail.replaced_by, "BE");
  assert.equal(add.dedupe_key, "index_change|S&P 500|BE|added|2026-09-22");
});

test("a change is dated, recent, and in this universe — or it is skipped with a reason", () => {
  const base = { index: "S&P 500", ts: "2026-09-24T13:00:00Z", today: "2026-09-24" };
  assert.equal(detectIndexChanges({ ...base, changes: [{ symbol: "BE" }] }).skipped[0].reason, "NO_DATE");
  assert.equal(detectIndexChanges({ ...base, changes: [{ date: "2026-01-02", symbol: "BE" }] }).skipped[0].reason, "TOO_OLD");
  const future = detectIndexChanges({ ...base, changes: [{ date: "2026-10-01", symbol: "BE" }] });
  assert.equal(future.events.length, 1, "an announced change that has not bound yet is exactly the signal");
  const out = detectIndexChanges({ ...base, changes: [{ date: "2026-09-22", symbol: "ZZZZ" }], universe: ["BE", "MU"] });
  assert.equal(out.events.length, 0);
  assert.equal(out.skipped[0].reason, "NOT_IN_UNIVERSE");
  assert.equal(detectIndexChanges({ ...base, changes: [{ date: "September 22, 2026", symbol: "BE" }] }).events[0].detail.effective_date,
    "2026-09-22", "the provider's own words for a date are read, not rejected");
});

test("the Hub says an index change in plain words, with the date it binds", () => {
  const E = engine();
  const ev = { kind: "index_change", subject: "BE", detail: { index: "S&P 500", action: "added", effective_date: "2026-09-29" } };
  assert.equal(E.scintIndexSays(ev), "added to S&P 500 · effective 2026-09-29");
  assert.equal(E.scintChipSays(ev), "added to S&P 500 · effective 2026-09-29");
  assert.match(page, /case "index_change": return "index change";/);
});

/* ── Yahoo ──────────────────────────────────────────────────────────────────────────────────── */
const YAHOO = fs.readFileSync(new URL("./fixtures/news/yahoo-BE-20260924.xml", import.meta.url), "utf8");
test("Yahoo's real BE feed parses into storable rows, and the link keeps its publisher", () => {
  assert.equal(parseYahooRss(YAHOO).length, 20, "the feed as it answered on 24 Sep 2026");
  const { rows, skipped } = yahooRows({ ticker: "be", xml: YAHOO, now: Date.parse("2026-09-24T13:00:00Z") });
  assert.equal(skipped.length, 0);
  assert.equal(rows.length, 20);
  assert.equal(rows[0].ticker, "BE");
  assert.equal(rows[0].feed, "yahoo", "so a bad pass can be deleted by feed alone");
  assert.ok(Number.isInteger(rows[0].published_ts) && rows[0].published_ts > 1.7e9, "epoch SECONDS, the column's units");
  assert.ok(rows.every((r) => /^https?:\/\//.test(r.url)));
  assert.ok(rows.some((r) => r.site && !/yahoo/i.test(r.site)), "the site is the publisher, not the aggregator");
  assert.ok(rows.every((r) => !r.snippet || r.snippet.length <= 280), "a trimmed description, never the article");
});

test("a headline with no link, no date or an old date is refused, and says why", () => {
  const xml = (items) => "<rss><channel>" + items + "</channel></rss>";
  const item = (o) => "<item><title>" + (o.t ?? "T") + "</title>" + (o.l ? "<link>" + o.l + "</link>" : "") +
    (o.d ? "<pubDate>" + o.d + "</pubDate>" : "") + "</item>";
  const now = Date.parse("2026-09-24T13:00:00Z");
  const fresh = "Thu, 24 Sep 2026 12:45:01 +0000";
  const r1 = yahooRows({ ticker: "BE", xml: xml(item({ l: "", d: fresh })), now });
  assert.equal(r1.skipped[0].reason, "NO_LINK");
  const r2 = yahooRows({ ticker: "BE", xml: xml(item({ l: "https://a/b" })), now });
  assert.equal(r2.skipped[0].reason, "NO_DATE");
  const r3 = yahooRows({ ticker: "BE", xml: xml(item({ l: "https://a/b", d: "Mon, 01 Sep 2026 12:00:00 +0000" })), now });
  assert.equal(r3.skipped[0].reason, "TOO_OLD");
  const r4 = yahooRows({ ticker: "BE", xml: xml(item({ l: "https://a/b", d: fresh }) + item({ l: "https://a/b", d: fresh })), now });
  assert.equal(r4.rows.length, 1);
  assert.equal(r4.skipped[0].reason, "DUPLICATE_IN_FEED");
  assert.equal(pubSeconds("not a date"), null);
  assert.equal(hostOf("https://www.fool.com/x"), "fool.com");
});

test("the collector writes ignore-duplicates on (ticker,url), so Google's copy is not stored twice", () => {
  const runner = fs.readFileSync(new URL("../scripts/yahoo-news-pull.mjs", import.meta.url), "utf8");
  assert.match(runner, /news\?on_conflict=ticker,url/);
  assert.match(runner, /resolution=ignore-duplicates/);
  assert.ok(!/console\.log\([^)]*KEY/.test(runner), "no key is ever printed");
  assert.match(runner, /SUPABASE_SERVICE_ROLE_KEY \|\| ""/);
});

test("the migration adds one kind and nothing else, and has an exact rollback", () => {
  const mig = fs.readFileSync(new URL("../supabase/migrations/20260924_scintillas_index_change.sql", import.meta.url), "utf8");
  assert.match(mig, /'price_outlier','earnings_surprise','econ_surprise','econ_imminent','sentiment_spike','breadth_thrust','dilution','index_change'/);
  assert.ok(!/drop table|delete from|update /i.test(mig.split("\n").filter((l) => !l.startsWith("--")).join("\n")),
    "nothing is deleted or rewritten by the migration itself");
  const rb = fs.readFileSync(new URL("../supabase/migrations/20260924_scintillas_index_change_ROLLBACK.sql", import.meta.url), "utf8");
  assert.match(rb, /delete from public\.scintillas where kind = 'index_change';/);
});

test("the index pass is its own function, so the dilution pass keeps its promise of no FMP call", () => {
  const det = fs.readFileSync(new URL("../supabase/functions/scintillas-detect/index.ts", import.meta.url), "utf8");
  assert.ok(!/FMP_API_KEY|apikey=/.test(det.replace(/apikey: SERVICE/g, "")),
    "scintillas-detect still never calls a paid provider — the M59 guard is untouched");
  const fn = fs.readFileSync(new URL("../supabase/functions/scintillas-index/index.ts", import.meta.url), "utf8");
  assert.match(fn, /Deno\.env\.get\("FMP_API_KEY"\)/, "the key comes from the environment");
  assert.ok(!/console\.log/.test(fn), "nothing is logged, so the key cannot reach a log");
  assert.match(fn, /report\.notes\.push\(name \+ ": read failed/, "a failure names the index, never the url that carries the key");
  assert.match(fn, /on_conflict=dedupe_key/);
  assert.match(fn, /resolution=ignore-duplicates/);
  assert.match(fn, /MAX_ROWS_PER_INDEX = 60/, "bandwidth is bounded and stated");
  const cron = fs.readFileSync(new URL("../supabase/migrations/20260924_scintillas_index_cron.sql", import.meta.url), "utf8");
  assert.match(cron, /cron\.schedule\('scintillas-index-morning'/);
  assert.match(cron, /cron\.schedule\('scintillas-index-evening'/);
  assert.ok(!/eyJ|apikey=|FMP_API_KEY\s*:?=\s*'/.test(cron), "no key value in the migration");
  assert.equal((cron.match(/cron\.schedule\(/g) || []).length, 2, "twice a day: six provider reads, no more");
});
