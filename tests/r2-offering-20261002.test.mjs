/* R2 Part A (2 Oct 2026) — THE OFFERING ALERT. Alan, 2 Oct (pasted notes): "dilution announcements".
   offering-watch (supabase/functions/offering-watch) lists every 424B5 / 424B4 / S-3 / S-3ASR / S-1 a Hub stock files,
   reads the first ~60 KB at the SEC and sorts it EQUITY / CONVERTIBLE / ATM / DEBT / UNCLASSIFIED (classify.mjs); the Hub
   shows it in the ALERTS room, the company EVENTS tab and as a ◆ beside the ticker on the board.
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

test("alert rows (pass mode only): severity by class as the brief sets it; the message carries form, class, size, date and the SEC link", () => {
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

test("the function: key from app_config with the service role, never printed; /stable/ routes; the SEC agent; alert_log only in pass mode", () => {
  assert.match(fnSrc, /from\("app_config"\)\.select\("key,value"\)\.in\("key", \["FMP_KEY"\]\)/);
  assert.match(fnSrc, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(fnSrc, /console\.(log|error|warn)/);                                   // nothing logged at all
  assert.ok(!/out\.\w+\s*=\s*K\b|J\(\{[^)]*\bK\b/.test(fnSrc));                              // the key never goes into the answer
  for (const m of fnSrc.matchAll(/financialmodelingprep\.com\/(\w+)\//g)) assert.equal(m[1], "stable");
  assert.match(fnSrc, /"ScintillaHub research research@scintillahub\.ai"/);
  assert.match(fnSrc, /SEC_GAP_MS = 260/);                                                   // ≤ 4 requests a second
  const alertWrites = [...fnSrc.matchAll(/from\("alert_log"\)/g)];
  assert.equal(alertWrites.length, 1);
  const at = fnSrc.indexOf('from("alert_log")');
  assert.match(fnSrc.slice(at - 260, at), /if \(mode === "pass" && inserted\.length\)/);
  assert.match(fnSrc, /x-region: us-west-2/);                                                // the SEC wall is written down where it bites
  assert.match(fnSrc, /\.upsert\(rows, \{ onConflict: "url", ignoreDuplicates: true \}\)/);  // a filing is filed once
  for (const f of ["424B5", "424B4", "S-3", "S-3ASR", "S-1"]) assert.ok(C.FORMS.includes(f));
});

/* ── the Hub ──────────────────────────────────────────────────────────────────────────────────────────── */
const grab = (re) => { const m = page.match(re); assert.ok(m, "not found in index.html: " + re); return m[0]; };
const hubSrc =
  grab(/const esc = \(s\) => String[\s\S]*?&#39;"\);/) + "\n" +
  grab(/const OF_ROOM_DAYS = [\s\S]*?\nfunction ofBoardPass\(\) \{[\s\S]*?\n\}/) + "\n";
function hub(today) {
  const ctx = { S: { sec: "ALERTS" }, todayISO: () => today, el: () => null, pg: async () => [], document: undefined, console };
  vm.createContext(ctx); vm.runInContext(hubSrc + "\nthis.OF = OF;", ctx); return ctx;
}
const R = (o) => ({ ticker: "CRWV", form: "424B5", filed_date: "2026-09-17", accepted_utc: null, class: "ATM",
  sentence: "sell up to 35,000,000 shares of our Class A common stock … under an Equity Distribution Agreement", size_text: "Up to 35,000,000 shares",
  url: "https://www.sec.gov/Archives/edgar/data/1769628/000162828026062362/coreweave-424b5.htm", ...o });

test("Hub · the board ◆: EQUITY / CONVERTIBLE / ATM within 10 days only; hover = class · size · date", () => {
  const h = hub("2026-09-24");
  const rows = [R({}), R({ ticker: "KR", class: "DEBT", filed_date: "2026-09-23" }), R({ ticker: "ZETA", class: "EQUITY", filed_date: "2026-09-11", size_text: "Up to $25,000,000" })];
  const m = h.ofMarkHTML("CRWV", rows, "2026-09-24");
  assert.match(m, /class="of-mark of-atm"/); assert.match(m, /title="ATM · Up to 35,000,000 shares · Sep 17, 2026 · 424B5/); assert.match(m, />◆</);
  assert.equal(h.ofMarkHTML("KR", rows, "2026-09-24"), "");                        // bonds: no mark
  assert.equal(h.ofMarkHTML("ZETA", rows, "2026-09-24"), "");                      // 13 days old: no mark
  assert.match(h.ofMarkHTML("ZETA", rows, "2026-09-21"), /of-equity/);            // 10 days old: still marked
  assert.equal(h.ofMarkHTML("NVDA", rows, "2026-09-24"), "");
});

test("Hub · a filing row: chip, size, form and date, the quoted sentence, an SEC link only to sec.gov, everything escaped", () => {
  const h = hub("2026-10-02");
  const html = h.ofRowHTML(R({ sentence: 'say "<b>hi</b>"' }), true);
  assert.match(html, /<span class="of-chip of-atm" title="shares sold over time \(at-the-market\)">ATM<\/span>/);
  assert.match(html, /data-tkopen="CRWV"/); assert.match(html, /Up to 35,000,000 shares/); assert.match(html, /424B5 · filed Sep 17, 2026/);
  assert.match(html, /href="https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/1769628\/000162828026062362\/coreweave-424b5\.htm"/);
  assert.ok(!html.includes("<b>hi</b>")); assert.match(html, /&lt;b&gt;hi&lt;\/b&gt;/);
  assert.ok(!h.ofRowHTML(R({ url: "javascript:alert(1)" }), true).includes("href="));
  assert.match(h.ofRowHTML(R({ sentence: null, size_text: null }), false), /size not printed on the cover[\s\S]*no deciding sentence/);
  assert.ok(!h.ofRowHTML(R({}), false).includes("data-tkopen"));                  // the company tab does not repeat the ticker
});

test("Hub · the ALERTS room: counts per class, newest first as given, honest reading / empty / error states", () => {
  const h = hub("2026-10-02");
  assert.match(h.ofRoomBodyHTML(null, null), /reading the filings/);
  assert.match(h.ofRoomBodyHTML(null, "pg offering_filings → 500"), /could not read offering_filings — pg offering_filings → 500/);
  assert.match(h.ofRoomBodyHTML([], null), /no offering filing by a Hub stock in the last 30 days/);
  const body = h.ofRoomBodyHTML([R({}), R({ ticker: "AXON", class: "CONVERTIBLE" }), R({ ticker: "KR", class: "DEBT" }), R({ ticker: "SYY", class: "DEBT" })], null);
  assert.match(body, /ATM<\/span><b>1<\/b>/); assert.match(body, /DEBT<\/span><b>2<\/b>/); assert.match(body, /EQUITY<\/span><b>0<\/b>/);
  assert.ok(body.indexOf("CRWV") < body.indexOf("AXON") && body.indexOf("AXON") < body.indexOf(">KR<"));
  assert.match(h.ofRoomHTML(), /alerts · offerings — dilution filings, last 30 days/);
});

test("Hub · the company EVENTS list: reading, none since the record starts, the rows", () => {
  const h = hub("2026-10-02");
  assert.match(h.ofCoBodyHTML("NVDA", undefined), /reading the filings/);
  assert.match(h.ofCoBodyHTML("NVDA", { rows: [], at: 1 }), /no offering filing by \$NVDA since Jun 4, 2026 \(when the record starts\)/);
  assert.match(h.ofCoBodyHTML("CRWV", { rows: [R({})], at: 1 }), /OFFERINGS · SEC FILINGS[\s\S]*of-chip of-atm/);
  assert.match(h.ofCoSectionHTML("CRWV"), /<div class="of-co" id="ofCo_CRWV">/);
});

test("Hub · wired into the three places and nowhere else: ALERTS room, afterMount, the board's ticker cell, the company EVENTS tab", () => {
  assert.match(page, /case "ALERTS":\s+return ofRoomHTML\(\);/);
  assert.match(page, /else if \(S\.sec === "ALERTS"\) ofRoomFill\(\);/);
  assert.match(page, /try \{ ofLoad\(\)\.then\(ofBoardPass\); \} catch \(_\) \{\}/);
  assert.match(page, /'<span class="sc-ctk' \+ \(d\.nf \? " has-nf" : ""\) \+ '">' \+ esc\(d\.t\) \+ \(typeof ofMarkHTML === "function" \? ofMarkHTML\(d\.t\) : ""\)/);
  assert.match(page, /return '<div class="sc-evtab">' \+ fixed \+ ofCoSectionHTML\(data\.t\) \+ relScroll \+ pastScroll/);
  assert.match(page, /setTimeout\(\(\) => ofCoFill\(data\.t\), 0\)/);
  assert.match(page, /case "SCREENER":\s+return parkedRoomHTML\("SCREENER"\);/);       // the other parked room is untouched
  assert.equal((page.match(/offering_filings\?select=/g) || []).length, 2);              // two reads: the 30 days, one name
  assert.ok(!/offering_filings[^"\n]*(?:POST|PATCH|DELETE)/.test(page));
});
