// numeric-closure (2026-09-18): ONE reconciled screen test for NT-1 (currency basis of F P/E / trailing P/E / EPS label)
// and OP-E (market-cap source date). Extracts the page's OWN functions, like the other tests in this directory.
// Fixture values are EXAMPLE inputs copied from guarded store reads at 2026-09-18T21:50Z (analyst_estimates, fundamentals,
// company_profile) - they exercise the rules; they are not a live check.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
function fn(name) {
  const s = page.search(new RegExp("^(async )?function " + name + "\\b", "m"));
  assert.ok(s >= 0, name + " present");
  const e = page.indexOf("\n}\n", s);
  return page.slice(s, e + 3);
}
const line = (re) => { const m = page.match(re); assert.ok(m, String(re)); return m[0]; };
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const num = (x) => (x == null ? null : Number(x));
const CCY = line(/^const EST_CCY_MEASURED = [^\n]*\n/m) + line(/^const EST_CCY = [^\n]*\n/m) +
  fn("ccyCode") + fn("estCcy") + fn("estNonUsd") + fn("notComparable");
const CONSTS = line(/^const NTM_STORED_MAX_AGE_MS = [^\n]*\n/m) + line(/^const estDate = [^\n]*\n/m);

// board F P/E: NTMLIVE is what fetchBoardRows() builds from the next four quarterly estimates
function boardApi(ntm, prices) {
  const meta = {}; for (const t in ntm) meta[t] = { through: "2027-06-30", at: 1789761423 };
  const src = CONSTS + CCY + fn("fpeBasis") + fn("fpeTitle") + fn("fpeVal") + fn("fpeWithheldText") +
    "return { fpeTitle, fpeVal, fpeWithheldText, estCcy, EST_CCY };";
  return new Function("NTMLIVE", "NTMLIVE_META", "NTMEPS", "NTMEPS_AT", "FEPS", "FEPS_META", "PRICES", "cryptoSet", src)(
    ntm, meta, {}, {}, {}, {}, prices, new Set(["BTCUSD"]));
}
const NTM = { TSM: 620.5797, BABA: 54.19713, BIDU: 41.09448, JD: 27.27855, LI: 0.38163, NIO: -0.41368, PDD: 76.44514,
  ASML: 47.81993, SPOT: 13.70562, CCJ: 2.05963, AAPL: 9.2645, NVDA: 11.9949, MU: 30.0, CRWV: -1.2 };

test("C1: no forward multiple across currencies, at any price; the reason is visible and is not the loss-maker dash", () => {
  const api = boardApi(NTM, {});
  // what the deployed rule painted (2.5x cut only): LI 31.8, ASML 35.1, SPOT 37.2, CCJ 44.5, and BABA/BIDU/JD/PDD above 2.5x at these prices
  for (const [t, px] of [["LI", 12.12], ["ASML", 1680.07], ["SPOT", 509.46], ["CCJ", 91.73], ["BABA", 140], ["BIDU", 109.5], ["JD", 80], ["PDD", 200], ["TSM", 5000]]) {
    assert.equal(api.fpeVal(t, px), null, t + " @" + px + " has no multiple");
    assert.match(api.fpeTitle(t), new RegExp("^not comparable: EPS in " + api.estCcy(t) + " · consensus EPS "), t + " title");
    assert.equal(api.fpeWithheldText(t), "EPS " + api.estCcy(t), t + " cell text names the currency");
  }
  assert.match(api.fpeTitle("TSM"), /^not comparable: EPS in TWD · consensus EPS 620\.58 TWD \(NTM · next 4 quarters to 2027-06-30 · estimate as of 2026-09-18\) against a USD price · no FX rate is stored/);
  assert.equal(api.fpeWithheldText("NIO"), "EPS CNY", "a CNY loss-maker is still labelled by currency (it is not comparable either way)");
  // USD reporters are unchanged
  assert.equal(api.fpeVal("AAPL", 336.13).toFixed(1), "36.3");
  assert.equal(api.fpeVal("NVDA", 219.72).toFixed(1), "18.3");
  assert.equal(api.fpeVal("MU", 200).toFixed(1), "6.7", "a real cheap USD multiple still paints");
  assert.equal(api.fpeVal("CRWV", 100), null);
  assert.equal(api.fpeWithheldText("CRWV"), "—", "a USD loss-maker keeps the dash");
  assert.equal(api.fpeWithheldText("ZZZ"), "—", "no estimate keeps the dash");
  assert.equal(api.fpeWithheldText("BTCUSD"), "—");
  assert.match(api.fpeTitle("CRWV"), /consensus EPS is not positive/);
});

test("C1: a served reporting currency outranks the measured set; malformed codes are ignored", () => {
  const api = boardApi(NTM, {});
  api.EST_CCY.TSM = "USD";           // e.g. a future served value
  assert.equal(api.fpeVal("TSM", 5000).toFixed(2), (5000 / 620.5797).toFixed(2));
  api.EST_CCY.AAPL = "eur";
  assert.equal(api.estCcy("AAPL"), "EUR");
  assert.equal(api.fpeVal("AAPL", 336.13), null);
  api.EST_CCY.NVDA = "<b>";
  assert.equal(api.estCcy("NVDA"), null, "only a 3-letter code is ever used");
  assert.equal(api.fpeVal("NVDA", 219.72).toFixed(1), "18.3");
});

// fwdTrailPE + STATS (price & value) tab
const todayISO = () => "2026-09-18";
function statsApi() {
  const ageSrc = line(/^const MCAP_MAX_AGE_MS = [^\n]*\n/m) + fn("scCapAge") + fn("scCapTitle");
  const s0 = page.indexOf("const fmtBig = "), s1 = page.indexOf("function statsFundHTML");
  assert.ok(s0 > 0 && s1 > s0);
  const src = CCY + ageSrc + fn("fwdTrailPE") + page.slice(s0, s1) + "return { statsPriceHTML, fwdTrailPE, scCapAge, scCapTitle };";
  return new Function("num", "esc", "todayISO", "fmtPxIdent", src)(num, esc, todayISO, (v) => "$" + (+v).toFixed(2));
}
const est = (q) => q.map(([d, e], i) => ({ period: "quarter", fiscal_date: d, est_eps_avg: e, est_eps_low: e * 0.9 }));
const Q = ["2026-09-30", "2026-12-31", "2027-03-31", "2027-06-30"];

test("C1 STATS: TSM EPS is labelled TWD and both multiples read 'not comparable: EPS in TWD'; AAPL unchanged", () => {
  const api = statsApi();
  const tsm = api.fwdTrailPE(433.7, { eps_ttm: 434.95 }, est(Q.map((d) => [d, 155.14])), "TSM");
  assert.equal(tsm.trail, null); assert.equal(tsm.fwd, null); assert.equal(tsm.mismatch, true); assert.equal(tsm.ccy, "TWD");
  const html = api.statsPriceHTML({ t: "TSM", price: 433.7, _profile: { market_cap: 2249376376000, updated_ts: 1789761483 }, _fund: { eps_ttm: 434.95 }, _est: est(Q.map((d) => [d, 155.14])) });
  assert.match(html, /<span>EPS \(ttm\)<\/span><b>TWD 434\.95<\/b>/);
  assert.match(html, /<span>trailing P\/E<\/span><b>not comparable: EPS in TWD<\/b>/);
  assert.match(html, /<span>forward P\/E<\/span><b>not comparable: EPS in TWD<\/b>/);
  assert.doesNotMatch(html, /\$434\.95|<b>1\.0<\/b>/, "the deployed '$434.95' and trailing '1.0' are gone");
  // 3-argument callers (no ticker) keep the old behaviour for USD rows
  const aapl3 = api.fwdTrailPE(336.13, { eps_ttm: 8.27 }, est(Q.map((d) => [d, 9.2645 / 4])));
  assert.equal(aapl3.trail.toFixed(1), "40.6"); assert.equal(aapl3.fwd.toFixed(1), "36.3"); assert.equal(aapl3.mismatch, false);
  const a = api.statsPriceHTML({ t: "AAPL", price: 336.13, _profile: { market_cap: 4935832857360, updated_ts: 1789761483 }, _fund: { eps_ttm: 8.27 }, _est: est(Q.map((d) => [d, 9.2645 / 4])) });
  assert.match(a, /<span>EPS \(ttm\)<\/span><b>\$8\.27<\/b>/);
  assert.match(a, /<span>trailing P\/E<\/span><b>40\.6<\/b>/);
  assert.doesNotMatch(a, /not comparable/);
  // a served currency on the fundamentals row wins over the ticker map
  const served = api.fwdTrailPE(12.12, { eps_ttm: -1.87, reported_currency: "CNY" }, est(Q.map((d) => [d, 0.0954])), "ZZZ");
  assert.equal(served.ccy, "CNY"); assert.equal(served.fwd, null);
  // a USD loss-maker keeps the plain dash (no fake 'not comparable')
  const loss = api.statsPriceHTML({ t: "CRWV", price: 100, _profile: {}, _fund: { eps_ttm: -2 }, _est: [] });
  assert.match(loss, /<span>trailing P\/E<\/span><b>—<\/b>/);
});

test("OP-E: the market cap carries its source date (epoch SECONDS); a fresh value is never dimmed", () => {
  const api = statsApi();
  const now = Date.parse("2026-09-18T21:50:46Z");
  const fresh = api.scCapAge(1789761483, now);                 // company_profile.updated_ts written by fmp-backfill v12
  assert.deepEqual(fresh, { known: true, aged: false, days: 0, date: "2026-09-18" });
  assert.equal(api.scCapTitle(1789761483, now), "market cap as stored 2026-09-18 (company_profile)");
  const old = api.scCapAge(1781331901, now);                   // UUP / VXX rows, 2026-06-13
  assert.equal(old.aged, true); assert.equal(old.days, 97); assert.equal(old.date, "2026-06-13");
  assert.match(api.scCapTitle(1781331901, now), /2026-06-13 \(company_profile\) - 97 days old, not a current value/);
  assert.equal(api.scCapAge(null, now).known, false);
  assert.equal(api.scCapAge(1789761483 * 1000, now).known, false, "a millisecond stamp is refused, never read as seconds");
  // the board cell
  const cellSrc = line(/^const MCAP_MAX_AGE_MS = [^\n]*\n/m) + fn("fmtCap") + fn("scCapAge") + fn("scCapTitle") + fn("mcapCellHTML") + "return mcapCellHTML;";
  const cell = new Function("num", "esc", cellSrc)(num, esc);
  const c1 = cell("AAPL", 4935832857360, 1789761483, now);
  assert.equal(c1, '<span class="sc-mcap" id="lmc_AAPL" title="market cap as stored 2026-09-18 (company_profile)" data-sc-mcap-asof="2026-09-18">$4.9T</span>');
  const c2 = cell("UUP", 163274257, 1781331901, now);
  assert.match(c2, /^<span class="sc-mcap is-aged" id="lmc_UUP" title="market cap as stored 2026-06-13 \(company_profile\) - 97 days old, not a current value"/);
  assert.match(c2, />\$163M<\/span>$/, "the number is kept");
  assert.equal(cell("BTCUSD", null, null, now), '<span class="sc-mcap" id="lmc_BTCUSD">—</span>', "no value: plain dash, no title");
  assert.match(cell("BRK.A", 1056009969102, null, now), /class="sc-mcap is-aged".*no source date/);
  // STATS row
  const s = api.statsPriceHTML({ t: "AAPL", price: 336.13, _profile: { market_cap: 4935832857360, updated_ts: Math.floor(Date.now() / 1000) - 3600 }, _fund: {}, _est: [] });
  assert.match(s, /<span>market cap<\/span><b>4\.94T <i class="sc-asof"[^>]*title="market cap as stored \d{4}-\d\d-\d\d \(company_profile\)">as of \d{4}-\d\d-\d\d<\/i><\/b>/);
  const fb = api.statsPriceHTML({ t: "X", price: 1, _profile: {}, _fund: { market_cap: 5e9 }, _est: [] });
  assert.match(fb, /5\.00B <i[^>]*>stored fundamentals value · source date not recorded<\/i>/, "fundamentals.updated_ts is never shown as a cap age");
});

test("wiring: reads, row field, cells and tick path", () => {
  assert.match(page, /pg\("company_profile\?select=ticker,name,exchange,avg_volume,market_cap,updated_ts"\)/, "board read carries updated_ts");
  assert.match(page, /company_profile\?ticker=eq\." \+ e \+ "&select=[^"]*,ir_url,updated_ts"/, "company read carries updated_ts");
  assert.match(page, /mcAsOf: \(function \(\) \{ const ts = num\(pf\[m\.ticker\] && pf\[m\.ticker\]\.updated_ts\);/);
  assert.match(page, /mcapCellHTML\(d\.t, d\.mc, d\.mcAsOf\) \+/);
  assert.doesNotMatch(page, /'<span class="sc-mcap" id="lmc_' \+ esc\(d\.t\) \+ '">' \+ fmtCap\(d\.mc\)/, "the undated cell is gone");
  assert.match(page, /\(d\.fpe != null \? d\.fpe\.toFixed\(1\) \+ "×" : fpeWithheldText\(d\.t\)\)/);
  assert.match(page, /lf\.textContent = fv != null \? fv\.toFixed\(1\) \+ "×" : fpeWithheldText\(t\);/, "the price tick keeps the currency label");
  for (const c of ["fwdTrailPE(data.price, f, data._est, data.t)", "fwdTrailPE(data.price, data._fund, data._est, data.t)", "fwdTrailPE(price, fund, est, t)"])
    assert.ok(page.includes(c), c);
  // NT-2 ordering guard: no screen may select reported_currency until the column exists and v11 writes it
  assert.doesNotMatch(page, /fundamentals\?[^"]*reported_currency/, "reported_currency is not selected by this patch");
});

test("every inline script still parses", () => {
  const re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g; let m, n = 0;
  while ((m = re.exec(page))) { n++; assert.doesNotThrow(() => new vm.Script(m[2], { filename: "inline" + n }), "inline script " + n); }
  assert.equal(n, 6);
});
