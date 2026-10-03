/* A4 (3 Oct 2026) — analyst targets you can trust: every analyst_target_news row classified by one rule set
   (supabase/functions/analyst-revisions/quality.ts), junk quarantined (never deleted), the collector classifying on the way in,
   the ESTIMATES tab on this branch reading only clean rows. The rows below are real stored rows (titles and numbers as FMP sent
   them). No network. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as Q from "../supabase/functions/analyst-revisions/quality.ts";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const T = (o) => ({ kind: "TARGET", adj_target: o.target, ...o });
const NOW = "2026-10-03T15:30:00Z";
const one = (rows, splits = []) => Q.classify(rows, splits, NOW);

/* ---------- the rule set ---------- */
test("AMZN 17 Sep: 'FTC announces additional payments … Prime settlement' filed as UBS $200 → quarantined, not about a target", () => {
  const [r] = one([T({ ticker: "AMZN", published_utc: "2026-09-17T17:21:17Z", firm: "UBS", target: 200, price_when_posted: 251.5499,
    title: "FTC announces additional payments to consumers from Amazon Prime settlement" })]);
  assert.equal(r.quality, "quarantine");
  assert.match(r.quality_reason, /^not_about_target/);
});
test("NVDA 2 Oct: 'Morgan Stanley Renames NVIDIA (NVDA) to Top Pick' filed as Wells Fargo $210 → firm_mismatch; Morgan Stanley's $230 kept", () => {
  const title = "Morgan Stanley Renames NVIDIA (NVDA) to Top Pick";
  const [wf, ms] = one([
    T({ ticker: "NVDA", published_utc: "2026-10-02T09:25:00Z", firm: "Wells Fargo", target: 210, price_when_posted: 230.86, title }),
    T({ ticker: "NVDA", published_utc: "2026-10-02T09:25:00Z", firm: "Morgan Stanley", target: 230, price_when_posted: 230.86, title }),
  ]);
  assert.equal(wf.quality, "quarantine"); assert.match(wf.quality_reason, /^firm_mismatch\(Morgan Stanley\)/);
  assert.equal(ms.quality, "ok");
});
test("the firm-alias table: 'at Baird' is Robert W. Baird, 'Citizens JMP' is not Citigroup, StreetInsider's 'Member Login' tail is ignored", () => {
  const [baird, citi, jef] = one([
    T({ ticker: "CRWD", published_utc: "2026-01-05T10:00:00Z", firm: "Robert W. Baird", target: 235, price_when_posted: 203.42, title: "CrowdStrike price target raised to $235 from $230 at Baird" }),
    T({ ticker: "SPOT", published_utc: "2026-01-05T10:00:00Z", firm: "Citigroup", target: 700, price_when_posted: 579, title: "Citizens JMP Starts Spotify (SPOT) at Market Outperform" }),
    T({ ticker: "AMZN", published_utc: "2026-07-16T10:00:00Z", firm: "KeyBanc", target: 335, price_when_posted: 254.96, title: "Amazon.com (AMZN) PT Raised to $335 at KeyBancMember Login" }),
  ]);
  assert.equal(baird.quality, "ok"); assert.match(baird.quality_reason, /headline_confirms/);
  assert.equal(citi.quality, "quarantine"); assert.match(citi.quality_reason, /^firm_mismatch\(JMP Securities\)/);
  assert.equal(jef.quality, "ok"); assert.ok(!/firm_unverified/.test(jef.quality_reason || ""), "KeyBanc is found before 'Member Login'");
});
test("the number in the headline: 'lowered to $472 from $493' stored as $493 → number_mismatch; 'ups target by $115' is a change, not a target", () => {
  const [spgi, tsla] = one([
    T({ ticker: "SPGI", published_utc: "2022-02-28T00:00:00Z", firm: "Robert W. Baird", target: 493, price_when_posted: 375.7, title: "S&P Global price target lowered to $472 from $493 at Baird" }),
    T({ ticker: "TSLA", published_utc: "2024-12-16T10:26:00Z", firm: "Wedbush", target: 515, price_when_posted: 400.99, title: "Wedbush ups Tesla target by $115 with Trump 'total game changer'" }),
  ]);
  assert.match(spgi.quality_reason, /^number_mismatch\(\$472\)/);
  assert.equal(tsla.quality, "ok");
  assert.equal(Q.headlineTarget("Micron price target raised to $2,100 from $2,000 at DA Davidson"), 2100);
  assert.equal(Q.headlineTarget("Wedbush ups Tesla target by $115 with Trump"), null);
});
test("a jump against the firm's previous target nets out the stock's own move (MU at New Street $190 → $1,250 while MU went $187 → $980)", () => {
  const rows = [
    T({ ticker: "MU", published_utc: "2025-10-14T12:42:00Z", firm: "New Street", target: 190, price_when_posted: 187.23, title: "New Street downgrades Micron on risk of multiple compression" }),
    T({ ticker: "MU", published_utc: "2026-08-14T12:12:00Z", firm: "New Street", target: 1250, price_when_posted: 979.87, title: "Micron upgraded to Buy from Neutral at New Street" }),
  ];
  assert.deepEqual(one(rows).map((r) => r.quality), ["ok", "ok"]);
  /* the same jump with the stock flat and no firm in the headline is not believable */
  const flat = [rows[0], { ...rows[1], price_when_posted: 190, title: "Chip stocks: what the analysts expect" }];
  assert.match(one(flat)[1].quality_reason, /jump_vs_firm_prior\(x6\.48\)/);   // (and 6.6× the price: target_vs_price too)
});
test("another stock's note in a multi-stock roundup: the price when posted is not this stock's → price_not_this_stock", () => {
  const near = (h, p) => T({ ticker: "ABT", published_utc: "2024-09-19T" + h + ":00:00Z", firm: "Leerink Partners", target: 130, price_when_posted: p, title: "Abbott price target raised to $130 at Leerink" });
  const res = one([near("07", 115.1), near("09", 115.4),
    T({ ticker: "ABT", published_utc: "2024-09-19T08:42:00Z", firm: "Roth Capital", target: 50, price_when_posted: 54.49, title: "This Abbott Analyst Begins Coverage On A Bullish Note; Here Are Top 5 Initiations" })]);
  assert.equal(res[2].quality, "quarantine"); assert.match(res[2].quality_reason, /price_not_this_stock/);
});
test("a second copy of the same note within 3 days → duplicate; the first stays", () => {
  const a = T({ ticker: "UNH", published_utc: "2026-07-16T11:50:00Z", firm: "Piper Sandler", target: 477, price_when_posted: 446.7, title: "UnitedHealth price target raised to $477 at Piper Sandler" });
  const b = { ...a, published_utc: "2026-07-16T11:57:00Z", title: "UnitedHealth Group (UNH) PT Raised to $477 at Piper Sandler, 'We would be buyers'" };
  assert.deepEqual(one([b, a]).map((r) => r.quality), ["quarantine", "ok"]);
  assert.match(one([a, b])[1].quality_reason, /^duplicate/);
});
test("splits: FMP's adj_target lagging a split is kept, named split_mismatch, and adj_target_checked carries target ÷ the split", () => {
  const sp = [{ ticker: "MNST", date: "2026-08-11", numerator: 2, denominator: 1 }];
  const [r] = one([T({ ticker: "MNST", published_utc: "2026-06-12T08:03:00Z", firm: "Roth Capital", target: 80, adj_target: 80, price_when_posted: 70,
    title: "Monster Beverage price target raised to $80 from $75 at Roth MKM" })], sp);
  assert.equal(r.quality, "ok"); assert.equal(r.adj_target_checked, 40); assert.match(r.quality_reason, /split_mismatch\(fmp 80 → 40\)/);
  assert.equal(Q.splitFactorAfter([{ ticker: "NVDA", date: "2024-06-10", numerator: 10, denominator: 1 }, { ticker: "NVDA", date: "2021-07-20", numerator: 4, denominator: 1 }],
    "NVDA", "2021-01-01T00:00:00Z", NOW), 40);
});
test("a rating row: no analyst words and no firm named → not_about_rating; 'Jefferies on NVIDIA: …' names the firm → kept", () => {
  const G = (o) => ({ kind: "GRADE", new_grade: "Buy", ...o });
  const [a, b] = one([G({ ticker: "AMGN", published_utc: "2025-02-05T15:45:00Z", firm: "Citigroup", price_when_posted: 306.17, title: "Amgen Options Trading: A Deep Dive into Market Sentiment" }),
    G({ ticker: "NVDA", published_utc: "2024-11-22T19:39:00Z", firm: "Jefferies", price_when_posted: 141.95, title: "Jefferies on NVIDIA (NVDA): 'Increasingly convinced the stock is setup well into 2025'" })]);
  assert.equal(a.quality, "quarantine"); assert.match(a.quality_reason, /^not_about_rating/);
  assert.equal(b.quality, "ok");
});

/* ---------- the collector: on the way in, not deployed ---------- */
test("analyst-revisions v3: every upsert into analyst_target_news goes through withQuality (pass feeds, backfill, deep backfill)", () => {
  const src = read("supabase/functions/analyst-revisions/index.ts");
  assert.match(src, /const VERSION = "analyst-revisions-v3"/);
  assert.match(src, /import \{ classify, type QRow, type Split \} from "\.\/quality\.ts"/);
  const ups = [...src.matchAll(/upsert\(sb, "analyst_target_news", ([^,]+(?:\([^)]*\))?)/g)].map((m) => m[1]);
  assert.equal(ups.length, 3, "three writes to analyst_target_news");
  for (const u of ups) assert.match(u, /withQuality|^q$/, "classified before it is written: " + u);
  assert.match(src, /quality check: /, "a failed check stores the rows unclassified and says so");
  assert.ok(!/\.delete\(/.test(src), "nothing is deleted");
});
test("the migration is additive (three nullable columns) and its rollback drops only those", () => {
  const up = read("supabase/migrations/20261003_analyst_target_news_quality.sql").replace(/--.*$/gm, "");
  const down = read("supabase/migrations/20261003_analyst_target_news_quality_ROLLBACK.sql").replace(/--.*$/gm, "");
  assert.match(up, /add column if not exists quality text check \(quality in \('ok', 'quarantine'\)\)/);
  assert.match(up, /add column if not exists quality_reason text/); assert.match(up, /add column if not exists adj_target_checked numeric/);
  assert.ok(!/\b(drop|delete|update|truncate)\b/i.test(up), "no destructive statement in the migration");
  assert.match(down, /drop column if exists quality, drop column if exists quality_reason, drop column if exists adj_target_checked/);
  assert.ok(!/drop table|delete|truncate/i.test(down));
});

/* ---------- the Hub on this branch: only clean rows ---------- */
const html = read("index.html");
test("the ESTIMATES reads leave quarantined rows out (an unclassified row is kept) and prefer our split-adjusted target", () => {
  assert.match(html, /const REV_CLEAN = "&or=\(quality\.is\.null,quality\.neq\.quarantine\)";/);
  assert.equal((html.match(/pg\("analyst_target_news\?[^)]*REV_CLEAN/g) || []).length, 3, "the notes, the firms' targets, the firms' ratings");
  assert.equal((html.match(/pg\("analyst_target_news\?/g) || []).length, 3, "no read of analyst_target_news without the filter");
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(html.slice(html.indexOf("function revNum(v)"), html.indexOf("\n", html.indexOf("function revNum(v)"))) + "\n" +
    html.slice(html.indexOf("const revTgt = "), html.indexOf("\n", html.indexOf("const revTgt = "))) + "; this.revTgt = revTgt;", ctx);
  assert.equal(ctx.revTgt({ target: 80, adj_target: 80, adj_target_checked: 40 }), 40);
  assert.equal(ctx.revTgt({ target: 80, adj_target: 79 }), 79);
  assert.equal(ctx.revTgt({ target: 80 }), 80);
});
test("AMZN: with the FTC row quarantined the price target reads the checked notes — low $300, not $200 — and shows FMP's mean in the header line", () => {
  const fx = JSON.parse(read("tests/fixtures/a3-target-notes-20261003.json"));
  const blk = (b, e) => html.slice(html.indexOf(b), html.indexOf(e));
  const ctx = { todayISO: () => "2026-10-03", pg: () => Promise.resolve([]), S: { estSub: null }, LS: {} };
  ctx.lsGet = (k) => ctx.LS[k] || null; vm.createContext(ctx);
  vm.runInContext(html.slice(html.indexOf("const esc = (s) =>"), html.indexOf("const el = (id) =>")) +
    blk("/* R2C-REVISIONS:BEGIN", "/* R2C-REVISIONS:END */") + blk("/* R3-REVISIONS:BEGIN", "/* R3-REVISIONS:END */") +
    blk("/* A3-ESTIMATES:BEGIN", "/* A3-ESTIMATES:END */") + "; Object.assign(this, { estPtcBody, ptcFirmSet });", ctx);
  const notes = fx.notes.AMZN, junk = notes.filter((r) => /FTC announces/.test(r.title || ""));
  assert.equal(junk.length, 1, "the fixture holds the FTC row");
  const clean = notes.filter((r) => !/FTC announces/.test(r.title || ""));   // what the server returns now
  const pt = fx.consensus.AMZN, anchor = pt.updated_ts * 1000;
  const before = ctx.ptcFirmSet(notes, anchor, 183), after = ctx.ptcFirmSet(clean, anchor, 183);
  assert.equal(before.lo, 200); assert.equal(after.lo, 300); assert.equal(after.n, 30, "UBS stays counted, on its $318 of 31 Jul");
  assert.equal(+after.mean.toFixed(2), 330.77);
  const h = ctx.estPtcBody("AMZN", pt, 251.37, { hist: clean }, Date.parse(NOW));
  assert.match(h, /\$330\.77<\/span><span class="sc-ptc-l">mean/);
  assert.match(h, /low \$300/); assert.ok(!/low \$200/.test(h));
  assert.match(h, /<span class="asof">FMP \$326\.83 · /, "FMP's mean sits in the header line (the hero stays one row)");
});
