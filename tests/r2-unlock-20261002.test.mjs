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

/* ---- the Hub (index.html): the EARNINGS page card and the STATS line — NOT the dashboard band (Alan, 2 Oct:
   "dashboard strips are very precious, I decide when we put a dashboard strip") ---- */
const html = read("index.html");
const grab = (name) => { const s = html.indexOf("function " + name + "("); assert.ok(s > 0, name + " exists"); return html.slice(s, html.indexOf("\n}\n", s) + 3); };
const ctx = {}; vm.createContext(ctx);
const plain = (x) => JSON.parse(JSON.stringify(x));          // results made inside the vm carry its own prototypes
vm.runInContext(["ulkTerms", "unlockListModel"].map(grab).join("\n") + "; this.M = unlockListModel;", ctx);   /* C1: unlockStatsText is gone (the STATS line moved to CAPITAL) */
const rowOf = (t, name, extra) => { const lk = L.findLockup(fx(name), TODAY); const u = L.unlockFrom("IPO", lk.prospectus_date, lk);
  return Object.assign({ ticker: t, company: t + " Inc.", listing_kind: "IPO", unlock_date: u.unlock_date, lockup_days: u.lockup_days, basis: u.basis, early_rule: lk.early_rule,
    early_release: lk.early_release, schedule: lk.schedule, prospectus_date: lk.prospectus_date, source_form: "424B4" }, extra || {}); };
const ROWS = [rowOf("CBRS", "cbrs"), rowOf("SPCX", "spcx"), rowOf("ALAB", "alab"),
  { ticker: "SHAZ", listing_kind: "IPO", unlock_date: "2026-05-19", lockup_days: 90, basis: "PROSPECTUS", schedule: null, early_release: null, prospectus_date: "2026-02-18" },
  { ticker: "OLD1", listing_kind: "IPO", unlock_date: "2026-03-01", lockup_days: 180, basis: "PROSPECTUS", schedule: null },
  { ticker: "FAR1", listing_kind: "IPO", unlock_date: "2027-11-01", lockup_days: 540, basis: "PROSPECTUS", schedule: null },
  { ticker: "NBIS", listing_kind: "RELISTING", ipo_date: "2026-07-01", unlock_date: null, lockup_days: null, basis: null, schedule: null }];

test("the EARNINGS page list: lock-ups ending in the next 12 months soonest first, with days to go, the basis, the early-release words and sentence", () => {
  const m = plain(ctx.M(ROWS, TODAY, 365, 183));
  assert.deepEqual(m.ahead.map((x) => x.ticker + " " + x.dateTxt + " " + x.days), ["CBRS 9 Nov 2026 38", "SPCX 8 Dec 2026 67"], "FAR1 (more than 12 months out) is not listed");
  const c = m.ahead[0];
  assert.deepEqual([c.basis, c.alt, c.steps, c.dated], ["prospectus: 180 days", "or 2 trading days after the Q3 report", ["19.4M sh Oct 14", "19.4M sh Oct 28"], "13 May 2026"]);
  assert.match(c.sentence, /the earlier of \(i\) 6:00 a\.m\. Eastern Time on the second trading day following our release of earnings/);
  const x = m.ahead[1];
  assert.deepEqual([x.basis, x.alt, x.steps], ["prospectus: 180 days", null, ["7% Oct 9", "7% Oct 24", "28% 2 trading days after the Q3 report"]]);
  assert.match(x.sentence, /^The second full trading day on Nasdaq immediately following the First Earnings Release Date/, "the staged table's heading is not part of the sentence");
});

test("the last 6 months, dimmed: ended lock-ups newest first, and a relisting that says it has none; older ones are not listed", () => {
  const m = plain(ctx.M(ROWS, TODAY, 365, 183));
  assert.deepEqual(m.past.map((x) => x.ticker + " " + x.days + " " + x.past), ["NBIS -93 true", "SHAZ -136 true"], "OLD1 (215 days ago) and ALAB (2024) are not listed");
  assert.equal(m.past[0].basis, "no lock-up (relisting)");
  assert.equal(m.past[1].basis, "prospectus: 90 days");
});

/* C1 (2 Oct, night) — the STATS line moved to FINANCIALS → CAPITAL (one home per company fact); its words are now tested in
   tests/c1-capital-block-20261002.test.mjs (ofLockModel). */
test("C1: the STATS lock-up line is gone — its function, its row and its CSS", () => {
  for (const gone of ["function unlockStatsText(", "function unlockStatsRowHTML(", "function unlockStatsRepaint(", "div.st-ulk", "unlockStatsRowHTML(data.t)"]) assert.equal(html.indexOf(gone), -1, gone + " is gone");
});

test("the homes: an IPO LOCK-UPS card on the EARNINGS page (C1: the company's own lock-up is in CAPITAL) — and nothing on the dashboard's EARNINGS band", () => {
  const room = grab("eventsRoomHTML");
  assert.match(room, /<h4>IPO LOCK-UPS · NEXT 12 MONTHS<\/h4><div class="ev-ulkwrap" id="evLockups">' \+ unlockSectionHTML\(\)/);
  assert.ok(room.indexOf('id="evUpcoming"') < room.indexOf('id="evLockups"') && room.indexOf('id="evLockups"') < room.indexOf('id="evPastRail"'), "between UPCOMING and PAST");
  assert.doesNotMatch(grab("statsActivityHTML"), /unlockStats/);
  assert.doesNotMatch(grab("ernDayTapeHTML"), /unlock|ulk/i, "the band is exactly the live one");
  assert.doesNotMatch(grab("topTapeHTML"), /unlock|ulk/i);
  for (const gone of ["unlockChipHTML", "unlockMergeDay", "unlockRunHTML", "unlockEvents", ".ulk-it", "ULK_HUE"]) assert.equal(html.indexOf(gone), -1, gone + " is gone");
  assert.match(html, /var UNLOCK_ON = ernSwitchFromUrl\("unlock", "on", "off", true\);/);
  const blk = html.slice(html.indexOf("R2 · 2 OCT · IPO LOCK-UPS — on the EARNINGS page"), html.indexOf("/* THE ECONOMIC SEGMENT'S SLIDE"));
  assert.match(blk, /pg\("ipo_lockups\?select=/);
  assert.doesNotMatch(blk, /pgPatch|method:\s*"(POST|PATCH|DELETE)"|renderTopTape/, "the Hub only reads, and never repaints the band");
  assert.match(html, /@media \(max-width:560px\)\{ \.ev-uptbl\.ulk-tbl th:nth-child\(3\), \.ev-uptbl\.ulk-tbl td:nth-child\(3\)\{ display:table-cell; \} \}/, "the days to go stay on a phone");
});

test("the function: the FMP key from app_config, never printed; /stable/ routes; the SEC research User-Agent; writes only ipo_lockups; a refused SEC read writes nothing", () => {
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
  assert.match(src, /if \(pick && \(!sec \|\| sec\.status !== 200 \|\| !sec\.bytes\)\) \{[\s\S]{0,260}nothing written, the stored row is kept[\s\S]{0,40}continue;/, "a 429 / empty read never overwrites (2 Oct: the SEC refused the edge address and a run wrote assumptions)");
  assert.match(src, /prev\.basis === "PROSPECTUS" && un\.basis === "ASSUMED_180"/, "a read clause is never traded for an assumption");
  assert.match(src, /r\.status === 429/);
  const mig = read("supabase/migrations/20261002_ipo_lockups.sql"), rb = read("supabase/migrations/20261002_ipo_lockups_ROLLBACK.sql");
  assert.match(mig, /create policy ipo_lockups_read on public\.ipo_lockups for select to anon, authenticated using \(true\)/);
  assert.match(rb, /drop table if exists public\.ipo_lockups;/);
});
