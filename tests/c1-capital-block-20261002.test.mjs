/* C1 (2 Oct 2026, night) — the CAPITAL block: a short title, the company's lock-up inside it, cash coverage in one plain
   sentence, the offering headline as the first sighting, grey RESALE / PLAN chips, and a former SPAC's sponsor lock-up.
   Fixtures only, no network: tests/fixtures/c1-capital/shaz-424b4-excerpt.txt is real SEC text (SharonAI's 424B4, 18 Feb
   2026); the numbers below are the stored rows read on 2 Oct (CRWV, SPCX, CBRS; AXON has no quarterly rows). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as C from "../supabase/functions/offering-watch/classify.mjs";
import * as L from "../supabase/functions/unlock-watch/lib.ts";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const page = read("index.html");
const TODAY = "2026-10-02";
const g = (re) => { const m = page.match(re); assert.ok(m, "not found: " + re); return m[0]; };
const ctx = { el: () => null, pg: async () => [], console };
vm.createContext(ctx);
vm.runInContext(g(/const esc = \(s\) => String[\s\S]*?&#39;"\);/) + "\n" + g(/const OF_TTL_MS = [\s\S]*?\nfunction ofCapFill\(t, balq\) \{[\s\S]*?\n\}/) + "\nthis.OF = OF;", ctx);
const H = ctx, plain = (x) => JSON.parse(JSON.stringify(x));
const text = (h) => String(h).replace(/<[^>]+>/g, " ").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();

const CRWV_Q = [{ period: "Q2", fiscal_year: 2026, fiscal_date: "2026-06-30", capex: -6422e6 }, { period: "Q1", fiscal_year: 2026, fiscal_date: "2026-03-31", capex: -7695e6 },
  { period: "Q4", fiscal_year: 2025, fiscal_date: "2025-12-31", capex: -4060e6 }, { period: "Q3", fiscal_year: 2025, fiscal_date: "2025-09-30", capex: -2388888e3 }];
const SPCX = { ticker: "SPCX", listing_kind: "IPO", unlock_date: "2026-12-08", lockup_days: 180, basis: "PROSPECTUS", prospectus_date: "2026-06-11",
  early_release: "The second full trading day on Nasdaq immediately following the First Earnings Release Date …", source_url: "https://www.sec.gov/a/spcx-424b4.htm", source_form: "424B4",
  schedule: [{ date: "2026-09-24", pct: "7%", shares: "328.4 million" }, { date: "2026-10-09", pct: "7%", shares: "328.4 million" }, { date: "2026-10-24", pct: "7%", shares: "328.4 million" },
    { date: null, pct: "28%", shares: "1.3 billion", quarter_end: "2026-09-30", trigger: "2 trading days after the Q3 2026 report" }, { date: "2026-12-08", final: true, shares: "328.4 million" },
    { date: null, pct: "20%", shares: "351.9 million", quarter_end: "2026-12-31", trigger: "2 trading days after the Q4 2026 report" }] };

test("1 · the title is CAPITAL, in the same place (FINANCIALS opens with it) and the same look", () => {
  assert.match(H.ofCapBodyHTML("CRWV", { rows: [], cfq: [], at: 1 }, null, TODAY), /^<h3 class="fn3-h">CAPITAL <span>/);
  assert.ok(!page.includes("CAPITAL &amp; DILUTION <span>"));
  assert.match(page, /out \+= ofCap;/);
});

test("2 · the lock-up in CAPITAL: SpaceX ends 8 Dec 2026, 'next step in 7 days · 7% of shares', the steps still ahead, the prospectus sentence", () => {
  const m = plain(H.ofLockModel(SPCX, TODAY));
  assert.deepEqual([m.endTxt, m.endDays, m.basis], ["8 Dec 2026", 67, "prospectus: 180 days"]);
  assert.deepEqual(m.next, { date: "2026-10-09", days: 7, what: "7% of shares", sponsor: false });
  assert.deepEqual(m.steps.map((s) => (s.date || "") + " " + s.label), ["2026-10-09 7% of shares", "2026-10-24 7% of shares", " 28% of shares 2 trading days after the Q3 report"],
    "24 Sep is behind; the Q4 step is after the main end");
  const t = text(H.ofLockHTML(H.ofLockModel(SPCX, TODAY)));
  assert.match(t, /LOCK-UP ends 8 Dec 2026 in 67 days · prospectus: 180 days next step in 7 days · 7% of shares \(9 Oct\)/);
  assert.match(t, /steps still ahead: 9 Oct 7% of shares · 24 Oct 7% of shares · 28% of shares 2 trading days after the Q3 report · 8 Dec the rest/);
  assert.match(t, /the prospectus: “The second full trading day on Nasdaq/);
  // Cerebras: no percentage printed → the share count; the final row's earnings leg
  const cb = plain(H.ofLockModel({ ticker: "CBRS", listing_kind: "IPO", unlock_date: "2026-11-09", lockup_days: 180, basis: "PROSPECTUS",
    schedule: [{ date: "2026-10-14", shares: "19.4 million" }, { date: "2026-10-28", shares: "19.4 million" }, { day: 180, final: true, quarter_end: "2026-09-30", trigger: "2 trading days after the Q3 2026 report", shares: "all remaining" }] }, TODAY));
  assert.deepEqual([cb.next.days, cb.next.what, cb.alt], [12, "19.4M shares", "or 2 trading days after the Q3 report, if earlier"]);
  assert.equal(H.ofLockModel(null, TODAY), null);
  assert.equal(H.ofLockModel({ listing_kind: "RELISTING" }, TODAY).text, "no lock-up (relisting)");
});

test("2 · one home per company fact: STATS has no lock-up line; the EARNINGS page card stays", () => {
  assert.equal(page.indexOf("unlockStatsRowHTML"), -1);
  assert.match(page, /<h4>IPO LOCK-UPS · NEXT 12 MONTHS<\/h4>/);
  assert.match(page, /pg\("ipo_lockups\?select=" \+ OF_LK_SEL \+ "&ticker=eq\." \+ e \+ "&limit=1"\)/);
});

test("3 · cash coverage, plainly: CRWV 1.2 quarters (Alan's example); fewer quarters stored are named; AXON says 'not stored' and which statement", () => {
  assert.equal(H.ofCoverText({ cash_and_equiv: 6397e6 }, CRWV_Q), "cash $6.40B covers about 1.2 quarters of capital spending at the last four quarters' pace");
  assert.equal(H.ofCoverText({ cash_and_equiv: 93522e6 }, [{ fiscal_date: "2026-06-30", capex: -18369e6 }, { fiscal_date: "2026-03-31", capex: -10107e6 }]),
    "cash $93.52B covers about 6.6 quarters of capital spending at the pace of the 2 quarters stored (2 of the last four quarterly cash-flow statements not stored)");
  assert.match(H.ofCoverText({ cash_and_equiv: 7426837e3 }, [{ fiscal_date: "2026-06-30", capex: -416903e3 }, { fiscal_date: "2026-03-31", capex: -131970e3 }, { fiscal_date: "2025-06-30", capex: -86850e3 }]),
    /covers about 27 quarters [\s\S]*2 quarters stored/, "a quarter more than a year older than the newest does not set the pace");
  assert.equal(H.ofCoverText(null, []), "cash and capital spending: not stored — no quarterly balance sheet and no quarterly cash-flow statement in our tables");
  assert.match(H.ofCoverText(null, CRWV_Q), /^cash: not stored — no quarterly balance sheet in our tables \(balance_history\)/);
  assert.match(H.ofCoverText({ cash_and_equiv: 1e9 }, []), /^capital spending: not stored — no quarterly cash-flow statement in our tables \(cashflow_history\)/);
});

test("4 · the news step: offering headlines only, about the company itself, never a redemption; joined to the filing it announced", () => {
  assert.equal(C.VERSION, "offering-watch-v2"); assert.equal(C.NEWS_DAYS, 2);
  const K = (t) => C.newsKind(t);
  assert.equal(K("CoreWeave Announces Proposed $3.0 Billion Convertible Senior Notes Offering"), "CONVERTIBLE");
  assert.equal(K("CoreWeave Announces At-the-Market Offering Program"), "ATM");
  assert.equal(K("Acme Prices Public Offering of 10,000,000 Shares"), "EQUITY");
  assert.equal(K("nVent Electric Announces $800 Million Senior Notes Offering"), "DEBT");
  assert.equal(K("Acme announces $50M registered direct offering"), "PLACEMENT");
  assert.equal(K("Acme files mixed shelf"), "SHELF");
  for (const no of ["CoreWeave's Rubin Deployment Broadens Its Next-Gen AI Cloud Offering", "CoreWeave (CRWV) CEO still holds 21.9M convertible shares after stock sale",
    "Western Digital Announces Redemption of 3.00% Convertible Senior Notes Due 2028", "Acme launches new AI offering for banks"]) assert.equal(K(no), null, no);
  // the company must be named: Google files a story under every ticker its query matched
  assert.equal(C.namesCompany("Yarrow Bioscience Details Pricing for $150 Million Public Offering of Common Stock", "COST", "Costco Wholesale Corporation"), false);
  assert.equal(C.namesCompany("Stifel cuts Agree Realty stock price target on debt offering terms", "TGT", "Target Corporation"), false);
  assert.equal(C.namesCompany("Oklo (NYSE: OKLO) Drops Near 52-Week Low After $1 Billion Stock Offering", "LOW", "Lowe's Companies, Inc."), false);
  assert.equal(C.namesCompany("AXON Plans To Raise $1B Through Convertible Notes", "AXON", "Axon Enterprise, Inc."), true);
  assert.equal(C.namesCompany("American Tower stock gains on $1.6 billion notes sale", "AMT", "American Tower Corporation"), true);
  assert.equal(C.shortName("SharonAI Holdings, Inc. Class A Common Stock"), "SharonAI");
  const uni = new Set(["CRWV"]);
  const row = C.newsFromRow({ ticker: "CRWV", url: "https://www.businesswire.com/x", published_ts: Date.parse("2026-09-17T07:29:00Z") / 1000, title: "CoreWeave Announces At-the-Market Offering Program", site: "businesswire.com", feed: "fmp" }, uni, { CRWV: "CoreWeave, Inc." });
  assert.deepEqual(row, { ticker: "CRWV", url: "https://www.businesswire.com/x", published_utc: "2026-09-17T07:29:00.000Z", source: "businesswire.com", feed: "fmp", title: "CoreWeave Announces At-the-Market Offering Program", kind: "ATM" });
  assert.equal(C.newsFromRow({ ...row, ticker: "NVDA", published_ts: 1 }, uni), null, "not a Hub stock");
  const FIL = [{ ticker: "CRWV", filed_date: "2026-09-17", accepted_utc: "2026-09-17T11:11:05Z", class: "ATM", url: "atm-424b5" }, { ticker: "CRWV", filed_date: "2026-06-05", class: "UNCLASSIFIED", url: "shelf" }];
  assert.equal(C.joinFiling(row, FIL).url, "atm-424b5");
  assert.equal(C.joinFiling({ ...row, kind: "CONVERTIBLE" }, FIL), null, "CoreWeave's convertible was a private 144A sale: no SEC offering filing, nothing to join");
  const src = read("supabase/functions/offering-watch/index.ts");
  assert.match(src, /if \(mode === "pass"\) \{ try \{ await newsStep\(sb, uni, newsDays, out\);/);
  assert.match(src, /\.from\("offering_news"\)\.upsert\(rows, \{ onConflict: "ticker,url", ignoreDuplicates: true \}\)/);
  const code = src.replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(code, /reference\/news|MASSIVE_KEY|massive\.com|polygon\.io/i, "Massive's news is not read: no key in app_config");
});

test("4 · the Hub: a joined headline sits on its filing with how much earlier it came; an unjoined one is its own first-seen line", () => {
  const news = [{ url: "https://www.businesswire.com/atm", published_utc: "2026-09-17T07:29:00Z", source: "businesswire.com", title: "CoreWeave Announces At-the-Market Offering Program", kind: "ATM", filing_url: "https://www.sec.gov/atm.htm" },
    { url: "https://finance.yahoo.com/atm2", published_utc: "2026-09-17T11:29:00Z", source: "Google News", title: "CoreWeave Announces At-the-Market Offering Program - finance.yahoo.com", kind: "ATM", filing_url: "https://www.sec.gov/atm.htm" },
    { url: "https://www.businesswire.com/cv", published_utc: "2026-09-17T07:05:00Z", source: "businesswire.com", title: "CoreWeave Announces Proposed $3.0 Billion Convertible Senior Notes Offering", kind: "CONVERTIBLE", filing_url: null }];
  const rows = [{ ticker: "CRWV", form: "424B5", filed_date: "2026-09-17", accepted_utc: "2026-09-17T11:11:05Z", class: "ATM", sentence: "sell up to 35,000,000 shares …", size_text: "Up to 35,000,000 shares", url: "https://www.sec.gov/atm.htm" }];
  const t = text(H.ofCapBodyHTML("CRWV", { rows, cfq: CRWV_Q, news, lock: null, at: 1 }, { cash_and_equiv: 6397e6, fiscal_date: "2026-06-30" }, TODAY));
  assert.match(t, /FIRST SEEN IN THE NEWS · CONVERTIBLE · no SEC offering filing joined Sep 17, 03:05 ET businesswire\.com CoreWeave Announces Proposed \$3\.0 Billion Convertible Senior Notes Offering/);
  assert.match(t, /FIRST SEEN IN THE NEWS · 3 h 42 min before the SEC filing Sep 17, 03:29 ET businesswire\.com CoreWeave Announces At-the-Market Offering Program \+1 more headline/);
  assert.ok(!H.ofNewsLineHTML({ url: "javascript:alert(1)", title: "x", published_utc: "2026-09-17T07:05:00Z" }).includes("href="));
});

test("5 · RESALE / PLAN chips are grey and grey the class, so only real new shares keep the colour", () => {
  assert.equal(H.ofTagOf({ sentence: "provides you with a general description of the Common Shares offered hereby and the general manner in which the selling shareholder, upon conversion of the Yorkville Debentures, may offer such securities." }), "RESALE");
  assert.equal(H.ofTagOf({ sentence: "In addition, certain selling stockholders to be identified in a prospectus supplement may offer and sell our common stock from time to time." }), null, "a company shelf that also lets holders sell is not a resale");
  assert.equal(H.ofTagOf({ sentence: "We are offering 555,555,555 shares of our Class A common stock." }), null);
  assert.equal(H.ofTagOf({ sentence: "which covers the offering, issuance and sale by us of up to an indeterminate amount of our Class A common stock, preferred stock, debt securities, warrants, subscription rights and units, and the offering by certain selling stockh" }), null, "CoreWeave's June shelf: the company sells too");
  assert.equal(H.ofTagOf({ sentence: "This prospectus relates to 2,000,000 shares issuable under our 2024 Employee Stock Purchase Plan." }), "PLAN");
  const r = H.ofRowHTML({ form: "S-3ASR", filed_date: "2026-08-17", class: "EQUITY", sentence: "the selling stockholders named herein may offer 10,000,000 shares of common stock", url: "https://www.sec.gov/r.htm" });
  assert.match(r, /class="of-row is-muted" data-of-class="EQUITY" data-of-tag="RESALE"/);
  assert.match(r, /<span class="of-chip of-equity of-muted"[^>]*>EQUITY<\/span><span class="of-chip of-tag"[^>]*>RESALE<\/span>/);
  assert.match(page, /\.of-chip\.of-muted\{ color:#8A8A92; \} \.of-chip\.of-tag\{ color:#A8A8AE;/);
});

test("6 · a former SPAC's sponsor lock-up: SharonAI's founder shares, 1 year after the merger closed 17 Dec 2025 → 17 Dec 2026, or earlier above $12", () => {
  const raw = read("tests/fixtures/c1-capital/shaz-424b4-excerpt.txt");
  const sp = L.sponsorLockup(raw);
  assert.equal(sp.date, "2026-12-17");
  assert.equal(sp.sponsor, true);
  assert.equal(sp.trigger, "1 year after the SPAC merger closed (2025-12-17)");
  assert.equal(sp.price_rule, "or earlier if the price holds above $12.00 (20 of 30 trading days)");
  assert.match(sp.clause, /each of the Former Sponsor and our independent directors agreed[\s\S]*until the earlier to occur of: \(i\) one year after the completion of our initial business combination/);
  const lk = L.findLockup(raw, TODAY);
  assert.equal(lk.days, 90, "the IPO lock-up is unchanged");
  assert.equal(lk.early_rule, "founder shares (former SPAC sponsor) 2026-12-17");
  for (const f of ["cbrs", "spcx", "alab"]) assert.equal(L.findLockup(read("tests/fixtures/r2-unlock/" + f + ".txt"), TODAY).sponsor, null, f + " is not a former SPAC");
  assert.equal(L.sponsorLockup("founder shares until the earlier of (i) one year after the completion of our initial business combination"), null, "no closing date printed → no date assumed");
  // the Hub: the sponsor step is the company's next step, and the EARNINGS card lists the name while it is ahead
  const shaz = { ticker: "SHAZ", listing_kind: "IPO", unlock_date: "2026-05-19", lockup_days: 90, basis: "PROSPECTUS", clause: "… ninety (90) days …", source_url: "https://www.sec.gov/shaz.htm", source_form: "424B4", schedule: [sp] };
  const m = plain(H.ofLockModel(shaz, TODAY));
  assert.deepEqual([m.endAhead, m.next.date, m.next.days, m.next.sponsor], [false, "2026-12-17", 76, true]);
  assert.match(text(H.ofLockHTML(H.ofLockModel(shaz, TODAY))), /LOCK-UP ended 19 May 2026 136 days ago · prospectus: 90 days next step in 76 days · the former sponsor's founder shares \(17 Dec\) steps still ahead: 17 Dec founder shares \(former SPAC sponsor\), or earlier if the price holds above \$12\.00/);
  const uw = read("supabase/functions/unlock-watch/index.ts");
  assert.match(uw, /const VERSION = "unlock-watch-v2";/);
  assert.match(uw, /\(!only\.length \|\| only\.includes\(t\)\) && uni\.set\.has\(t\)/, "a named ticker reads the IPO calendar too");
});

test("rollback written first, and the table is new (no existing table changed)", () => {
  const mig = read("supabase/migrations/20261002_offering_news.sql"), rb = read("supabase/migrations/20261002_offering_news_ROLLBACK.sql");
  assert.match(mig, /create table if not exists public\.offering_news/);
  assert.doesNotMatch(mig, /alter table public\.(?!offering_news)/);
  assert.match(rb, /drop table if exists public\.offering_news;/);
});
