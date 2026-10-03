/* R2 Part B (2 Oct 2026) — the UNLOCK watch: IPO lock-up expiry read from the prospectus (edge function unlock-watch,
   table ipo_lockups) and drawn on the EARNINGS → band and in STATS. Fixtures only, no network: the three prospectus
   excerpts under tests/fixtures/r2-unlock/ are real SEC text (Cerebras, SpaceX, Astera Labs), cleaned by lib.ts. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as L from "../supabase/functions/unlock-watch/lib.ts";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const fx = (n) => read("tests/fixtures/r2-unlock/" + n + ".txt");
const TODAY = "2026-10-02";

test("Cerebras: 180 days from the prospectus dated May 13, 2026 → 9 Nov 2026, or 2 trading days after the Q3 report; 19.4M-share steps Oct 14 and Oct 28", () => {
  const lk = L.findLockup(fx("cbrs"), TODAY);
  assert.equal(lk.prospectus_date, "2026-05-13");
  assert.equal(lk.days, 180);
  assert.deepEqual(L.unlockFrom("IPO", lk.prospectus_date, lk), { unlock_date: "2026-11-09", lockup_days: 180, basis: "PROSPECTUS" });
  assert.match(lk.clause, /the earlier of \(i\) 6:00 a\.m\. Eastern Time on the second trading day following our release of earnings for the quarter ending September 30, 2026 or \(ii\) 180 days after the date of this prospectus/);
  assert.match(lk.early_rule, /^or 2 trading days after the Q3 2026 report, if earlier · staged: 2 dated steps before it$/);
  const dated = lk.schedule.filter((s) => s.date).map((s) => s.date + " " + s.shares);
  assert.ok(dated.includes("2026-10-14 19.4 million") && dated.includes("2026-10-28 19.4 million"), dated.join(" | "));
  assert.ok(!lk.schedule.some((s) => s.date === "2026-03-31" || s.date === "2026-06-30" || s.date === "2026-09-30" && s.final), "a quarter-end date is a trigger, never a tranche date");
  const fin = lk.schedule.find((s) => s.final);
  assert.equal(fin.day, 180); assert.equal(fin.trigger, "2 trading days after the Q3 2026 report"); assert.equal(fin.quarter_end, "2026-09-30");
  assert.ok(lk.schedule.find((s) => s.trigger === "2 trading days after the Q1 2026 report").conditional, "the Q1 step depended on a price test");
});

test("SpaceX: prospectus dated June 11, 2026 + 180 = Dec 8, 2026 (the prospectus's own '180th day'), staged: 7% Oct 9 and Oct 24, 28% two trading days after Q3", () => {
  const lk = L.findLockup(fx("spcx"), TODAY);
  assert.equal(lk.prospectus_date, "2026-06-11");
  assert.equal(lk.days, 180, "the Rule 144 '90 days' sentence and the tranche rows (70th, 120th day…) do not outvote the 180-day lock-up");
  assert.equal(L.unlockFrom("IPO", lk.prospectus_date, lk).unlock_date, "2026-12-08");
  const row = (d) => lk.schedule.find((s) => s.date === d);
  assert.equal(row("2026-12-08").day, 180, "the table's own words: December 8, 2026 (180th day after the date of this prospectus)");
  assert.deepEqual([row("2026-10-09").pct, row("2026-10-09").shares, row("2026-10-24").pct], ["7%", "328.4 million", "7%"]);
  const q3 = lk.schedule.find((s) => s.quarter_end === "2026-09-30");
  assert.deepEqual([q3.pct, q3.shares, q3.trigger, q3.conditional], ["28%", "1.3 billion", "2 trading days after the Q3 2026 report", false]);
  assert.ok(lk.schedule.some((s) => s.conditional && s.shares === "455.8 million"), "the +30% price-test release is marked conditional");
  assert.match(lk.early_rule, /staged: 2 dated steps before it and 28% 2 trading days after the Q3 2026 report · an extended lock-up runs to 2027-06-12/);
});

test("Astera Labs: the Rule 701 '90 days' sentence never votes; 180 days from March 19, 2024 → Sep 15, 2024", () => {
  const lk = L.findLockup(fx("alab"), TODAY);
  assert.equal(lk.prospectus_date, "2024-03-19");
  assert.equal(lk.days, 180);
  assert.equal(L.unlockFrom("IPO", lk.prospectus_date, lk).unlock_date, "2024-09-15");
  assert.equal(lk.early_rule, "or 2 trading days after the second earnings report after the listing, if earlier");
});

test("sentences never break on a.m., Inc., U.S. or a decimal", () => {
  const s = L.sentences("Lock-up ends at 6:00 a.m. Eastern Time for Acme Inc. in the U.S. with 1.3 billion shares. Next one.");
  assert.equal(s.length, 2);
  assert.match(s[0], /6:00 a\.m\. Eastern Time for Acme Inc\. in the U\.S\. with 1\.3 billion shares\.$/);
});

test("listing kinds: a relisting, a direct listing and a spin-off carry no date; a SPAC counts from its closing", () => {
  assert.equal(L.classifyListing({ calendarIso: "2024-10-21", profileIpoIso: "2011-05-24", prospectusKind: "IPO", directListing: false, olderAnnualReport: true }), "RELISTING");
  assert.equal(L.classifyListing({ calendarIso: "2026-01-10", profileIpoIso: "2026-01-10", prospectusKind: "UNKNOWN", directListing: true, olderAnnualReport: false }), "DIRECT_LISTING");
  assert.equal(L.classifyListing({ calendarIso: null, profileIpoIso: "2025-12-18", prospectusKind: "SPAC", directListing: false, olderAnnualReport: false }), "SPAC");
  assert.equal(L.classifyListing({ calendarIso: null, profileIpoIso: "2026-04-01", prospectusKind: null, directListing: false, olderAnnualReport: false, form10: true }), "SPINOFF");
  assert.equal(L.classifyListing({ calendarIso: "2026-05-14", profileIpoIso: "2026-05-14", prospectusKind: "IPO", directListing: false, olderAnnualReport: false }), "IPO");
  for (const k of ["RELISTING", "DIRECT_LISTING", "SPINOFF"]) assert.deepEqual(L.unlockFrom(k, "2026-01-10", { days: 180, months: null }), { unlock_date: null, lockup_days: null, basis: null });
  assert.equal(L.statsLine({ listing_kind: "RELISTING", unlock_date: null, lockup_days: null, basis: null, early_rule: null }), "no lock-up (relisting)");
  assert.deepEqual(L.unlockFrom("IPO", "2026-05-13", { days: null, months: null }), { unlock_date: "2026-11-09", lockup_days: 180, basis: "ASSUMED_180" }, "no clause → 180 days, said to be an assumption");
  assert.deepEqual(L.unlockFrom("SPAC", "2025-12-18", { days: null, months: 12 }), { unlock_date: "2026-12-18", lockup_days: 365, basis: "PROSPECTUS" });
  assert.equal(L.monthVote("the founder shares are subject to a lock-up until one year after the closing of the business combination"), 12);
});

test("the calendar is read month by month: 18 windows, newest first, the current month ending today", () => {
  const w = L.monthWindows(TODAY, 18);
  assert.equal(w.length, 18);
  assert.deepEqual(w[0], ["2026-10-01", "2026-10-02"]);
  assert.deepEqual(w[1], ["2026-09-01", "2026-09-30"]);
  assert.deepEqual(w[17], ["2025-05-01", "2025-05-31"]);
  assert.equal(L.addMonths(TODAY, -18), "2025-04-02");
});

test("the document read: the 424B4 near the listing, else a SPAC's merger 424B3, else the S-1", () => {
  const sec = (f, d, n) => ({ formType: f, filingDate: d + " 00:00:00", finalLink: "https://www.sec.gov/Archives/edgar/data/1/" + n + ".htm" });
  assert.equal(L.pickProspectus([sec("S-1", "2026-04-17", "s1"), sec("S-1/A", "2026-05-08", "s1a"), sec("424B4", "2026-05-14", "b4")], "2026-05-14").url.endsWith("b4.htm"), true);
  const spac = L.pickProspectus([sec("S-4", "2025-05-15", "s4"), sec("S-4/A", "2025-10-21", "s4a"), sec("424B3", "2025-11-12", "b3"), sec("8-K", "2025-12-22", "k")], "2025-12-18");
  assert.deepEqual([spac.form, spac.kind], ["424B3", "SPAC"]);
  assert.equal(L.pickProspectus([sec("S-1", "2026-01-02", "s1")], "2026-01-10").kind, "UNKNOWN");
  assert.equal(L.pickProspectus([{ formType: "424B4", filingDate: "2026-05-14", link: "https://example.com/x.htm" }], "2026-05-14"), null, "only sec.gov documents are read");
});

test("the streamed read gives the same answer in 1 KB pieces as in one piece, and stops after the lock-up section", async () => {
  const body = "<html><body><p>" + fx("cbrs").split(/(?<=\.) /).join("</p>\n<p>") + "</p>" + "<p>Experts and financial statements.</p>".repeat(2000) + "</body></html>";
  const bytes = new TextEncoder().encode(body);
  let i = 0;
  const reader = { async read() { if (i >= bytes.length) return { done: true }; const v = bytes.subarray(i, i + 1024); i += 1024; return { value: v, done: false }; } };
  const out = await L.lockupFromStream(reader, TODAY, 16_000_000);
  assert.equal(out.lk.days, 180);
  assert.equal(out.lk.prospectus_date, "2026-05-13");
  assert.ok(out.lk.schedule.some((s) => s.date === "2026-10-28"));
  assert.ok(out.bytes <= bytes.length);
});

/* ---- the Hub (index.html) ---- */
const html = read("index.html");
const grab = (name) => { const s = html.indexOf("function " + name + "("); assert.ok(s > 0, name + " exists"); return html.slice(s, html.indexOf("\n}\n", s) + 3); };
const ctx = {}; vm.createContext(ctx);
const plain = (x) => JSON.parse(JSON.stringify(x));          // results made inside the vm carry its own prototypes
vm.runInContext(["ulkAddTradingDays", "unlockEvents", "unlockStatsText"].map(grab).join("\n") + "; this.E = unlockEvents; this.T = unlockStatsText; this.D = ulkAddTradingDays;", ctx);
const rowOf = (t, name, pd) => { const lk = L.findLockup(fx(name), TODAY); const u = L.unlockFrom("IPO", lk.prospectus_date, lk);
  return { ticker: t, listing_kind: "IPO", unlock_date: u.unlock_date, lockup_days: u.lockup_days, basis: u.basis, early_rule: lk.early_rule, schedule: lk.schedule, prospectus_date: pd }; };
const ROWS = [rowOf("CBRS", "cbrs", "2026-05-13"), rowOf("SPCX", "spcx", "2026-06-11"), rowOf("ALAB", "alab", "2024-03-19"),
  { ticker: "NBIS", listing_kind: "RELISTING", unlock_date: null, lockup_days: null, basis: null, schedule: null }];

test("the band's UNLOCK chips for the next 90 days, in date order (the brief's words: 'UNLOCK · CBRS · NOV … · or 2 days after Q3')", () => {
  const chips = plain(ctx.E(ROWS, TODAY, 90, {}).map((e) => e.ticker + " · " + e.md + " · " + e.note));
  assert.deepEqual(chips, [
    "SPCX · OCT 9 · 7% · 328.4M sh", "CBRS · OCT 14 · 19.4M sh", "SPCX · OCT 24 · 7% · 328.4M sh", "CBRS · OCT 28 · 19.4M sh",
    "CBRS · NOV 9 · or 2 days after Q3", "SPCX · DEC 8 · the rest of the 180-day lock-up"]);
  assert.ok(!chips.some((c) => /^(ALAB|NBIS)/.test(c)), "a past lock-up and a relisting carry no chip");
});

test("a step that waits on an earnings report sits at an estimated (≈) date only when that report is dated", () => {
  const evs = ctx.E(ROWS, TODAY, 90, { SPCX: { date: "2026-11-10" }, CBRS: { date: "2026-11-04" } });
  const q3 = evs.find((e) => e.ticker === "SPCX" && e.est);
  assert.deepEqual([q3.day, q3.md, q3.note], ["2026-11-12", "≈ NOV 12", "28% · 1.3B sh · 2 days after Q3"]);
  assert.equal(evs.find((e) => e.ticker === "CBRS" && e.main).note, "or 2 days after Q3 (≈ NOV 6)", "Cerebras's Q3 trigger comes first when the report lands Nov 4");
  assert.equal(ctx.E(ROWS, TODAY, 90, { CBRS: { date: "2026-11-12" } }).find((e) => e.ticker === "CBRS" && e.main).note, "or 2 days after Q3",
    "a report after Nov 9 cannot bring the unlock forward, so no ≈ date");
  assert.equal(ctx.D("2026-11-06", 2), "2026-11-10", "trading days skip the weekend");
});

test("the STATS line: 'lock-up ends … (prospectus: 180 days, or 2 trading days after the Q3 report)'; 'no lock-up (relisting)'; nothing once it is past", () => {
  assert.deepEqual(plain(ctx.T(ROWS[0], TODAY)), { k: "lock-up ends", v: "9 Nov 2026 (prospectus: 180 days, or 2 trading days after the Q3 report · before it: 19.4M sh Oct 14, 19.4M sh Oct 28)" });
  assert.deepEqual(plain(ctx.T(ROWS[1], TODAY)), { k: "lock-up ends", v: "8 Dec 2026 (prospectus: 180 days · before it: 7% Oct 9, 7% Oct 24, 28% 2 trading days after the Q3 report)" });
  assert.equal(ctx.T(ROWS[2], TODAY), null, "Astera's lock-up ended in 2024: nothing for an older listing");
  assert.deepEqual(plain(ctx.T(ROWS[3], TODAY)), { k: "lock-up", v: "no lock-up (relisting)" });
  assert.match(ctx.T({ ticker: "X", listing_kind: "IPO", unlock_date: "2026-12-01", lockup_days: 180, basis: "ASSUMED_180", schedule: [] }, TODAY).v, /assumed: 180 days — the prospectus clause was not found/);
});

test("the hooks: the live EARNINGS band merges and appends UNLOCKs; STATS asks for its line; one switch; one read; nothing written", () => {
  const band = grab("ernDayTapeHTML");
  assert.match(band, /unlockMergeDay\(p\.items, p\.day, today\)/);
  assert.match(band, /it\.ulk \? unlockChipHTML\(it\.ulk, today\) : ernEcItemHTML\(it, ernEcState\(it, now\), today\)/);
  assert.match(band, /seg \+= unlockRunHTML\(today, shownDay\)/);
  assert.match(grab("statsActivityHTML"), /if \(!fund && typeof unlockStatsRowHTML === "function"\)/);
  assert.match(html, /var UNLOCK_ON = ernSwitchFromUrl\("unlock", "on", "off", true\);/);
  assert.match(html, /var ULK_HUE = "#8E9BFF";/);
  const blk = html.slice(html.indexOf("R2 · 2 OCT · UNLOCK — IPO lock-up expiry"), html.indexOf("/* THE ECONOMIC SEGMENT'S SLIDE"));
  assert.match(blk, /pg\("ipo_lockups\?select=/);
  assert.doesNotMatch(blk, /pgPatch|method:\s*"(POST|PATCH|DELETE)"/, "the Hub only reads");
  assert.match(html, /\.st-blk > div\.st-ulk > b, \.cv-side \.st1 \.st-blk > div\.st-ulk > b\{ white-space:normal; flex:1 1 0; min-width:0;/);
});

test("the function: the FMP key from app_config, never printed; /stable/ routes; the SEC research User-Agent; writes only ipo_lockups", () => {
  const src = read("supabase/functions/unlock-watch/index.ts");
  assert.match(src, /app_config\?select=key,value&key=eq\.FMP_KEY/);
  assert.doesNotMatch(src, /console\.(log|error|warn|info)/, "nothing is logged");
  assert.doesNotMatch(src, /apikey=\$\{|"apikey=" \+|K\b[^\n]*JSON\.stringify/, "the key never rides in a message");
  const fmpRoutes = [...src.matchAll(/fmp\("([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(fmpRoutes)].sort(), ["ipos-calendar", "profile", "sec-filings-search/symbol"]);
  assert.match(src, /https:\/\/financialmodelingprep\.com\/stable\//);
  assert.match(src, /"User-Agent": "ScintillaHub research research@scintillahub\.ai"/);
  const writes = [...src.matchAll(/rest\/v1\/([a-z_]+)[^"`]*`?,\s*\{\s*method:\s*"POST"/g)].map((m) => m[1]);
  assert.deepEqual(writes, ["ipo_lockups"]);
  const mig = read("supabase/migrations/20261002_ipo_lockups.sql"), rb = read("supabase/migrations/20261002_ipo_lockups_ROLLBACK.sql");
  assert.match(mig, /create policy ipo_lockups_read on public\.ipo_lockups for select to anon, authenticated using \(true\)/);
  assert.match(rb, /drop table if exists public\.ipo_lockups;/);
});
