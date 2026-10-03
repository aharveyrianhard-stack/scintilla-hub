/* R2 Part A (2 Oct 2026) — THE OFFERING ALERT. Alan, 2 Oct (pasted notes): "dilution announcements".
   offering-watch (supabase/functions/offering-watch) lists every 424B5 / 424B4 / S-3 / S-3ASR / S-1 a Hub stock files,
   reads the first ~60 KB at the SEC and sorts it EQUITY / CONVERTIBLE / ATM / DEBT / UNCLASSIFIED (classify.mjs). Its home
   on the Hub is the company view's FINANCIALS tab, a CAPITAL & DILUTION block with the cash on hand and the last four
   quarters of capex beside the filings (Alan, 2 Oct: "before alerts, things need to have a home on hub"). No alert_log
   rows, no ALERTS-tab section, no board mark — those were built and removed the same evening.
   Everything here runs on fixtures — the opening text of 30 real filings (tests/fixtures/r2-offering-20261002.json) and
   the page's own functions pulled out of index.html. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import * as C from "../supabase/functions/offering-watch/classify.mjs";

const FIX = JSON.parse(fs.readFileSync(new URL("./fixtures/r2-offering-20261002.json", import.meta.url), "utf8")).cases;
const fnSrc = fs.readFileSync(new URL("../supabase/functions/offering-watch/index.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("R1's twelve filings: the classes R1 found, Zeta now decided by the fifth pattern, CoreWeave read as the ATM its cover describes", () => {
  const want = { KR: "DEBT", SYY: "DEBT", AXON: "CONVERTIBLE", NVT: "DEBT", AON: "DEBT", OKE: "ATM", AMZN: "DEBT", ZETA: "EQUITY",
    FDX: "DEBT", GLW: "ATM", OKLO: "ATM",
    // R1 printed EQUITY for CoreWeave because its code tested the share count first; the cover sells the 35,000,000 shares
    // "under an Equity Distribution Agreement … through the Sales Agents" — R1's own third (at-the-market) pattern.
    CRWV: "ATM" };
  for (const [k, cls] of Object.entries(want)) assert.equal(C.classify(FIX[k].text).cls, cls, k);
  assert.equal(C.classify(FIX.CRWV.text).size_text, "Up to 35,000,000 shares");
  assert.match(C.classify(FIX.CRWV.text).sentence, /up to 35,000,000 shares of our Class A common stock.*Equity Distribution Agreement/);
  assert.equal(C.classify(FIX.AXON.text).size_text, "$1,000,000,000");
  assert.match(C.classify(FIX.AXON.text).sentence, /0% Convertible Senior Notes due 2031/);
  assert.equal(C.classify(FIX.ZETA.text).size_text, "Up to $25,000,000");
  assert.equal(C.classify(FIX.ZETA.text).rule, "dollars@cover");                 // the fifth pattern, not R1's four
  assert.equal(C.classify(FIX.KR.text).size_text, "$1,500,000,000");
  assert.equal(C.classify(FIX.OKE.text).size_text, "Up to $1,000,000,000");      // the title's "aggregate offering price"
  assert.equal(C.classify(FIX.AMZN.text).size_text, "£1,250,000,000");
});

test("R1's four patterns, exactly as r1-probe2.mjs wrote them, leave Zeta unclassified — the case the fifth pattern exists for", () => {
  const head = FIX.ZETA.text.slice(0, 12000);
  const equity = /\d[\d,]*\s+shares of (?:our |its )?(?:Class [AB] )?common stock/i.test(head) || /common stock offering/i.test(head);
  const notes = /%\s*(?:senior |convertible |subordinated |fixed[- ]rate )*notes due \d{4}/i.test(head) || /\bNotes due \d{4}/i.test(head);
  const atm = /at-the-market|\bATM\b offering|equity distribution agreement/i.test(head);
  const pref = /preferred stock/i.test(head) && !equity;
  assert.deepEqual([equity, notes, atm, pref], [false, false, false, false]);
  assert.equal(C.RE_EQUITY_DOLLARS.test(head), true);
});

test("preliminary supplements leave the numbers blank and are still sorted (the backfill's 33 → 6 unclassified 424B5s)", () => {
  for (const k of ["ABBV_424B5_2026-08-04", "AMZN_424B5_2026-09-09", "GOOGL_424B5_2026-08-06", "INTU_424B5_2026-06-08", "PNC_424B5_2026-07-16", "NEE_424B5_2026-06-16", "CNP"])
    assert.equal(C.classify(FIX[k].text).cls, "DEBT", k);
  for (const k of ["LEU", "OUST", "VSH"]) assert.equal(C.classify(FIX[k].text).cls, "EQUITY", k);
  assert.equal(C.classify(FIX["INTU_424B5_2026-06-08"].text).size_text, null);   // never "$2,000" (a note denomination)
  assert.equal(C.classify(FIX.VSH.text).size_text, "15,000,000 Shares");
});

test("registration statements: share counts are EQUITY, a universal shelf with an amount stays UNCLASSIFIED with its title as the reason", () => {
  for (const k of ["CRWD_S-3ASR_2026-09-11", "LOW_S-3ASR_2026-08-28", "QCOM_S-3_2026-10-02", "TLN_S-3ASR_2026-06-18", "OKE_S-3ASR_2026-06-18"])
    assert.equal(C.classify(FIX[k].text).cls, "EQUITY", k);
  const u = C.classify(FIX["USAR_S-3_2026-09-04"].text);
  assert.equal(u.cls, "UNCLASSIFIED"); assert.equal(u.size_text, "$1,250,000,000"); assert.match(u.sentence, /Common Stock Preferred Stock Debt Securities/);
  assert.match(C.classify(FIX["QCOM_S-3_2026-10-02"].text).sentence, /25,000,000 Shares of Common Stock/);
});

test("every fixture still classifies as recorded, and no sentence is longer than 300 characters", () => {
  for (const [k, v] of Object.entries(FIX)) {
    const r = C.classify(v.text);
    assert.equal(r.cls, v.cls, k); assert.equal(r.size_text, v.size_text, k);
    assert.ok(C.CLASSES.includes(r.cls), k);
    assert.ok(r.sentence == null || r.sentence.length <= 300, k + " " + (r.sentence || "").length);
  }
  assert.equal(C.classify("").cls, "UNCLASSIFIED"); assert.equal(C.classify(null).sentence, null);
});

test("the cleaner decodes hex and decimal entities, drops inline-XBRL hidden facts and a tag cut at the byte limit", () => {
  const html = '<html><ix:header><ix:hidden>dei:Junk 123 shares of common stock</ix:hidden></ix:header><style>p{x}</style>' +
    '<p>Up to $25,000,000 of Shares&#x200a;of Class A Common Stock &#x201c;Shares&#x201d; &#8220;Q&#8221; &amp; S.&#192; R.L.</p><td sty';
  const t = C.cleanHtml(html);
  assert.equal(t, 'Up to $25,000,000 of Shares of Class A Common Stock "Shares" "Q" & S.À R.L.');
  assert.equal(C.cleanHtml(undefined), "");
});

test("New York time: EDGAR's acceptance clock to UTC in summer and winter; pass days; weekdays only", () => {
  assert.equal(C.etToUtcIso("2026-10-02 14:25:28"), "2026-10-02T18:25:28.000Z");     // EDT, UTC-4
  assert.equal(C.etToUtcIso("2026-01-15 09:00:00"), "2026-01-15T14:00:00.000Z");     // EST, UTC-5
  assert.equal(C.etToUtcIso("not a date"), null);
  assert.deepEqual(C.passDays(Date.parse("2026-10-02T23:00:00Z")), ["2026-10-01", "2026-10-02"]);   // Friday 19:00 ET
  assert.deepEqual(C.passDays(Date.parse("2026-10-05T23:00:00Z")), ["2026-10-02", "2026-10-05"]);   // Monday: Friday + Monday
  assert.deepEqual(C.passDays(Date.parse("2026-10-03T02:30:00Z")), ["2026-10-01", "2026-10-02"]);   // 22:30 ET Friday, UTC already Saturday
  assert.deepEqual(C.weekdays("2026-09-25", "2026-10-02"), ["2026-09-25", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  assert.deepEqual(C.weekdays("2026-10-02", "2026-09-25"), []);
  assert.equal(C.weekdays("2026-06-04", "2026-10-02").length, 87);                    // the backfill: 120 days, 87 weekdays
});

test("an FMP row becomes a table row only for a Hub stock with an SEC document link; the document beats the index page", () => {
  const uni = new Set(["CRWV"]);
  const fmp = { symbol: "crwv", cik: "0001769628", filingDate: "2026-09-17 00:00:00", acceptedDate: "2026-09-17 07:11:05", formType: "424B5",
    link: "https://www.sec.gov/Archives/edgar/data/1769628/000162828026062362/0001628280-26-062362-index.htm",
    finalLink: "https://www.sec.gov/Archives/edgar/data/1769628/000162828026062362/coreweave-424b5.htm" };
  assert.deepEqual(C.filingFromFmp(fmp, uni), { url: fmp.finalLink, ticker: "CRWV", cik: "0001769628", form: "424B5", filed_date: "2026-09-17",
    accepted_utc: "2026-09-17T11:11:05.000Z" });
  assert.equal(C.filingFromFmp({ ...fmp, symbol: "JEF" }, uni), null);                                   // not ours
  assert.equal(C.filingFromFmp({ ...fmp, finalLink: "https://evil.example/x.htm", link: "" }, uni), null);  // never a non-SEC link
  assert.equal(C.filingFromFmp({ ...fmp, finalLink: "" }, uni).url, fmp.link);
});

test("the alert row, kept for later and NOT called (alerts wait for the home): severity by class as the brief set it, the message", () => {
  assert.deepEqual(C.SEVERITY, { EQUITY: "high", CONVERTIBLE: "high", ATM: "high", DEBT: "info", UNCLASSIFIED: "medium" });
  const row = { ticker: "ZETA", form: "424B5", class: "EQUITY", size_text: "Up to $25,000,000", filed_date: "2026-09-11",
    accepted_utc: "2026-09-11T20:05:00.000Z", url: "https://www.sec.gov/Archives/edgar/data/1851003/000119312526389369/zeta-20260911.htm" };
  const a = C.alertRow(row, 0);
  assert.equal(a.kind, "offering_filed"); assert.equal(a.severity, "high"); assert.equal(a.ticker, "ZETA");
  assert.equal(a.ts, Date.parse("2026-09-11T20:05:00Z") / 1000);
  assert.equal(a.message, "424B5 · EQUITY · Up to $25,000,000 · filed 2026-09-11 · " + row.url);
  assert.equal(C.alertRow({ ...row, class: "DEBT", accepted_utc: null }, 1e12).ts, 1e9);
  assert.equal(C.alertRow({ ...row, class: "DEBT" }, 0).severity, "info");
});

test("the function: key from app_config with the service role, never printed; /stable/ routes; the SEC agent; NO alert_log write", () => {
  assert.match(fnSrc, /from\("app_config"\)\.select\("key,value"\)\.in\("key", \["FMP_KEY"\]\)/);
  assert.match(fnSrc, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(fnSrc, /console\.(log|error|warn)/);                                   // nothing logged at all
  assert.ok(!/out\.\w+\s*=\s*K\b|J\(\{[^)]*\bK\b/.test(fnSrc));                              // the key never goes into the answer
  for (const m of fnSrc.matchAll(/financialmodelingprep\.com\/(\w+)\//g)) assert.equal(m[1], "stable");
  assert.match(fnSrc, /"ScintillaHub research research@scintillahub\.ai"/);
  assert.match(fnSrc, /SEC_GAP_MS = 260/);                                                   // ≤ 4 requests a second
  assert.equal((fnSrc.match(/from\("alert_log"\)/g) || []).length, 0);                    // Alan, 2 Oct: alerts come later
  assert.ok(!/\balertRow\b/.test(fnSrc));
  assert.equal((fnSrc.match(/\.from\("(\w+)"\)/g) || []).filter((x) => !/app_config|tickers|company_profile|offering_filings|offering_news|"news"/.test(x)).length, 0);   // C1: + news (read) and offering_news
  assert.match(fnSrc, /x-region: us-west-2/);                                                // the SEC wall is written down where it bites
  assert.match(fnSrc, /\.upsert\(rows, \{ onConflict: "url", ignoreDuplicates: true \}\)/);  // a filing is filed once
  for (const f of ["424B5", "424B4", "S-3", "S-3ASR", "S-1"]) assert.ok(C.FORMS.includes(f));
});

/* ── the Hub: CAPITAL & DILUTION in FINANCIALS ─────────────────────────────────────────────────────────── */
const grab = (re) => { const m = page.match(re); assert.ok(m, "not found in index.html: " + re); return m[0]; };
const hubSrc =
  grab(/const esc = \(s\) => String[\s\S]*?&#39;"\);/) + "\n" +
  grab(/const OF_TTL_MS = [\s\S]*?\nfunction ofCapFill\(t, balq\) \{[\s\S]*?\n\}/) + "\n";
function hub() {
  const ctx = { el: () => null, pg: async () => [], console };
  vm.createContext(ctx); vm.runInContext(hubSrc + "\nthis.OF = OF;", ctx); return ctx;
}
const R = (o) => ({ ticker: "CRWV", form: "424B5", filed_date: "2026-09-17", accepted_utc: null, class: "ATM",
  sentence: "sell up to 35,000,000 shares of our Class A common stock … under an Equity Distribution Agreement", size_text: "Up to 35,000,000 shares",
  url: "https://www.sec.gov/Archives/edgar/data/1769628/000162828026062362/coreweave-424b5.htm", ...o });
const CFQ = [{ period: "Q2", fiscal_year: 2026, fiscal_date: "2026-06-30", capex: -6422000000 }, { period: "Q1", fiscal_year: 2026, fiscal_date: "2026-03-31", capex: -7695000000 },
  { period: "Q4", fiscal_year: 2025, fiscal_date: "2025-12-31", capex: -4060000000 }, { period: "Q3", fiscal_year: 2025, fiscal_date: "2025-09-30", capex: -2388888000 }];
const BALQ = { period: "Q2", fiscal_date: "2026-06-30", cash_and_equiv: 6397000000 };

test("Hub · one filing row reads date · form · class chip · size, then the deciding sentence and the SEC link (sec.gov only, escaped)", () => {
  const h = hub();
  const html = h.ofRowHTML(R({ sentence: 'say "<b>hi</b>"' }));
  assert.match(html, /<span class="of-date">Sep 17, 2026<\/span><span class="of-meta">424B5<\/span><span class="of-chip of-atm" title="shares sold over time \(at-the-market\)">ATM<\/span><span class="of-size">Up to 35,000,000 shares<\/span>/);
  assert.match(html, /“say &quot;&lt;b&gt;hi&lt;\/b&gt;&quot;” <a class="of-sec" href="https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/1769628\/000162828026062362\/coreweave-424b5\.htm"/);
  assert.ok(!h.ofRowHTML(R({ url: "javascript:alert(1)" })).includes("href="));
  assert.match(h.ofRowHTML(R({ sentence: null, size_text: null })), /size not printed on the cover[\s\S]*no deciding sentence/);
  for (const c of ["EQUITY", "CONVERTIBLE", "ATM", "DEBT", "UNCLASSIFIED"]) assert.match(h.ofChipHTML(c), new RegExp('class="of-chip of-' + c.toLowerCase() + '"[^>]*>' + c + "<"));
  assert.match(h.ofChipHTML("NONSENSE"), /UNCLASSIFIED/);
});

test("Hub · cash on hand and the last four quarters of capex, plain numbers, no projection", () => {
  const h = hub();
  const cash = h.ofCashHTML(BALQ, CFQ);
  assert.match(cash, /CASH ON HAND<\/div><div class="of-v">\$6\.40B<\/div><div class="of-d">cash and equivalents · Jun 30, 2026 balance sheet/);
  assert.match(cash, /<td>Q2·26<\/td><td>Jun 30, 2026<\/td><td>\$6\.42B<\/td>/);
  assert.match(cash, /<td>Q3·25<\/td><td>Sep 30, 2025<\/td><td>\$2\.39B<\/td>/);
  assert.match(cash, /the four together<\/td><td>\$20\.57B</);
  assert.ok(!/dilution|runway|months|project/i.test(cash));                       // C1: a plain coverage count, no model
  assert.match(cash, /cash \$6\.40B covers about 1\.2 quarters of capital spending at the last four quarters&#39; pace/);   // C1 (Alan's own example)
  assert.match(h.ofCashHTML(null, []), /—<\/div>[\s\S]*not stored — no quarterly balance sheet<[\s\S]*not stored — no quarterly cash-flow statement</);   // H10 — no table names on the face
  assert.match(h.ofCashHTML(BALQ, null), /CAPITAL SPENDING · LAST 4 QUARTERS<\/div><div class="of-d">reading …/);
  assert.ok(!h.ofCashHTML(BALQ, CFQ.slice(0, 2)).includes("the four together"));   // a sum only over four real quarters
  assert.equal(h.ofMoney(850000000), "$850M"); assert.equal(h.ofMoney(null), "—"); assert.equal(h.ofMoney(-2.5e11), "$250B");
});

test("Hub · the block: reading, none since the record starts, the rows newest first as read, the legend", () => {
  const h = hub();
  assert.match(h.ofCapBodyHTML("NVDA", undefined, BALQ), /<h3 class="fn3-h">CAPITAL <span>[\s\S]*reading the filings/);   // C1: the short title
  assert.match(h.ofCapBodyHTML("NVDA", { rows: [], cfq: [], at: 1 }, null), /no offering filing by \$NVDA since Jun 4, 2026 \(when the record starts\)/);
  assert.match(h.ofCapBodyHTML("X", { rows: [], cfq: [], at: 1, err: "pg offering_filings → 500" }, null), /could not read offering_filings — pg offering_filings → 500/);
  const b = h.ofCapBodyHTML("CRWV", { rows: [R({}), R({ filed_date: "2026-06-05", class: "UNCLASSIFIED", form: "S-3ASR" })], cfq: CFQ, at: 1 }, BALQ);
  assert.ok(b.indexOf("Sep 17, 2026") < b.indexOf("Jun 5, 2026"));
  assert.match(b, /<div class="of-grid"><div class="of-list">[\s\S]*<div class="of-cash">CASH|<div class="of-cash"><div class="of-k">CASH ON HAND/);
  assert.match(b, /EQUITY new shares sold now · CONVERTIBLE notes that can turn into shares · ATM shares sold over time · DEBT bonds, no new shares/);
  assert.match(h.ofCapSectionHTML({ t: "CRWV", _balq: BALQ }), /<section class="fn3-sec of-cap" id="ofCap_CRWV">/);
});

test("Hub · its home is FINANCIALS only: the ALERTS room is still parked, the board row and the EVENTS tab are as they were", () => {
  assert.match(page, /const ofCap = typeof ofCapSectionHTML === "function" \? ofCapSectionHTML\(data\) : "";/);   // guarded: the page's
  assert.match(page, /if \(ofCap && typeof setTimeout === "function"\) setTimeout\(\(\) => ofCapFill\(data\.t, data\._balq\), 0\);/);   // own tests lift
  assert.match(page, /out \+= ofCap;/);                                                                                       // financialsTabHTML alone
  assert.match(page, /return \(ofCap \? '<div class="fn3">' \+ ofCap \+ "<\/div>" : ""\) \+ '<div class="sc-senttxt">No financial statements on record for/);   // H10 — plain words
  assert.match(page, /case "ALERTS":\s+return parkedRoomHTML\("ALERTS"\);/);
  assert.match(page, /'<span class="sc-ctk' \+ \(d\.nf \? " has-nf" : ""\) \+ '">' \+ esc\(d\.t\) \+\n/);
  assert.match(page, /return '<div class="sc-evtab">' \+ fixed \+ relScroll \+ pastScroll \+ "<\/div>";/);
  for (const gone of ["ofRoomHTML", "ofMarkHTML", "ofBoardPass", "ofCoFill", "of-mark"]) assert.ok(!page.includes(gone), gone);
  assert.equal((page.match(/offering_filings\?select=/g) || []).length, 1);              // one read: this company's filings
  assert.match(page, /cashflow_history\?ticker=eq\." \+ e \+ "&period=in\.\(Q1,Q2,Q3,Q4\)&select=period,fiscal_year,fiscal_date,capex&order=fiscal_date\.desc&limit=4"/);
});
