/* M59 — DILUTION. What is pinned here is the promise a dilution row makes: it comes from a real
   filing, it counts shares the filing itself states, it measures them against a share count it can
   defend, and it refuses to fire on the filings that merely SOUND like dilution.

   Four of these tests run against VERBATIM text from filings made in the last 90 days
   (tests/fixtures/dilution/), entities and all — including the "&#160;" that broke the first run. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  detectDilution, classifyDilution, dilutionTerms, shareBase, priceFrom, normalizeFilingText,
  discountPct, DILUTION_FORMS,
} from "../scripts/scintillas-detect.mjs";

const RULES = JSON.parse(fs.readFileSync(new URL("../data/scintilla-rules.json", import.meta.url), "utf8"));
const fixture = (n) => fs.readFileSync(new URL("./fixtures/dilution/" + n, import.meta.url), "utf8");
const TS = "2026-09-24T02:00:00.000Z";
/* Beyond Meat as it actually stood: 515,818,978 shares on its last filed cover page (5 Aug), then a
   1-for-30 reverse split on 13 Aug. Both numbers are from the company's own filings. */
const BYND_MKT = { last_close: 7.9, shares_out: 515818978, shares_out_asof: "2026-08-05",
                   reverse_split: { ratio: 30, effective_date: "2026-08-13" } };
const byndFiling = () => ({ ticker: "BYND", form: "8-K", items: "3.02,8.01", filed_date: "2026-09-23",
  accession: "0001193125-26-398531", url: "https://www.sec.gov/Archives/edgar/data/1655210/0001193125-26-398531.txt",
  text: fixture("BYND-2026-09-23-8K.txt") });
const run = (filings, marketBy) => detectDilution({ filings, marketBy, ts: TS, rules: RULES });

test("the real BYND 8-K is found, and its numbers are the filing's own", () => {
  const { events, skipped } = run([byndFiling()], { BYND: BYND_MKT });
  assert.equal(skipped.length, 0);
  assert.equal(events.length, 1);
  const e = events[0], d = e.detail;
  assert.equal(e.kind, "dilution");
  assert.equal(e.subject, "BYND");
  assert.equal(e.direction, -1, "more shares is bad news for every share already held");
  assert.equal(e.magnitude, null, "a company has no 'usual' issuance, so no multiple is claimed");
  assert.equal(d.pattern, "note_exchange_for_shares");
  /* 1,097,444 issued now + up to 848,265 in the true-up = 1,945,709 — read from the filing */
  assert.equal(d.shares_added, 1945709);
  assert.equal(d.priced_at, 7.4009, "the exchange's floor price");
  assert.equal(d.price_is_floor, true);
  assert.equal(Math.round(d.discount_pct * 10) / 10, -6.3, "6.3% below the last close of 7.90");
  assert.equal(d.principal_usd, 15000000);
  assert.ok(d.quote.includes("1,097,444"), "the sentence the number came from travels with the row");
  assert.equal(e.dedupe_key, "dilution|BYND|0001193125-26-398531");
});

test("the entity a real filing is written with cannot swallow the share count", () => {
  /* the SEC writes "1,097,444&#160;shares". Squeezing whitespace without decoding that entity left
     only the SECOND, smaller number, and an 11% dilution read as 0.8%. */
  const raw = fixture("BYND-2026-09-23-8K.txt");
  assert.ok(raw.includes("&#160;"), "the fixture is the filing as published, entities and all");
  assert.match(normalizeFilingText(raw), /1,097,444 shares of Common Stock/);
  const terms = dilutionTerms({ text: raw }, "note_exchange_for_shares", {});
  assert.equal(terms.shares_added, 1945709);
});

test("the percentage is measured against a share count that survives a reverse split", () => {
  /* BYND's newest FILED count predates its 1-for-30 reverse split, so dividing by it says 0.4%. */
  const naive = run([byndFiling()], { BYND: { last_close: 7.9, shares_out: 515818978, shares_out_asof: "2026-08-05" } });
  assert.equal(naive.events.length, 0);
  assert.equal(naive.skipped[0].reason, "BELOW_THRESHOLD");
  assert.equal(naive.skipped[0].pct_of_shares_out, 0.377, "the trap: 30x too small, and invisible");

  const split = run([byndFiling()], { BYND: BYND_MKT }).events[0].detail;
  assert.equal(split.shares_out, 515818978 / 30);
  assert.equal(split.pct_of_shares_out, 11.316);
  assert.equal(split.shares_out_source, "filed count ÷ the reverse split");
  assert.match(split.shares_out_note, /1-for-30 reverse split/);

  /* and with no split known, the market's own arithmetic catches the same thing */
  const implied = shareBase({ shares_out: 515818978, shares_out_asof: "2026-08-05", market_cap: 136e6 }, 7.9);
  assert.equal(implied.source, "market value ÷ last close");
  assert.ok(Math.abs(implied.shares_out - 515818978 / 30) / (515818978 / 30) < 0.01,
    "the two independent routes agree within a percent");
});

test("par value is never read as an offering price", () => {
  /* "common stock, $0.0001 par value per share" appears in nearly every filing. Read as a price it
     makes a $7 stock look 99.99% discounted. */
  assert.equal(priceFrom("shares of common stock, $0.0001 par value per share, of the Company"), null);
  assert.equal(priceFrom("at a public offering price of $12.50 per share"), 12.5);
  assert.equal(priceFrom("$0.0001 par value per share ... at a purchase price of $3.25 per share"), 3.25);
  assert.equal(discountPct(3.25, 4), -18.75);
  assert.equal(discountPct(3.25, 0), null, "no last close, no discount claimed");
});

test("the filings that only SOUND like dilution do not fire — each one real", () => {
  const cases = [
    ["IBM-2026-08-10-424B3.txt", "424B3", "private_placement_of_debt",
     "a bond prospectus whose Canadian selling restriction says 'private placement ... accredited investors'"],
    ["GILD-2026-08-06-S3ASR.txt", "S-3ASR", "shelf_capacity_only",
     "a universal shelf that lists 'at the market offerings' among everything it MAY sell one day"],
    ["AMZN-2026-08-18-424B3.txt", "424B3", "merger_stock_consideration",
     "shares issued to buy another company: new shares, but an acquisition, not a raise"],
  ];
  for (const [file, form, expected, why] of cases) {
    const c = classifyDilution({ form, items: "", text: fixture(file) });
    assert.equal(c.pattern, null, why);
    assert.equal(c.excluded_by, expected, file + " → " + expected);
  }
});

test("a convertible note being PAID OFF is the opposite of dilution", () => {
  const repaid = { ticker: "X", form: "8-K", items: "1.01,2.03", filed_date: "2026-09-20", accession: "a1",
    text: "On September 20, 2026 the Company repurchased $200.0 million aggregate principal amount of its " +
          "0.50% Convertible Senior Notes due 2027 for cash consideration of $198.0 million. No shares of " +
          "common stock were issued in connection with the repurchase." };
  const c = classifyDilution(repaid);
  assert.equal(c.pattern, null);
  assert.equal(c.excluded_by, "repaid_or_redeemed_for_cash");
  assert.equal(run([repaid], { X: { last_close: 10, shares_out: 1e8 } }).events.length, 0);
});

test("a resale by existing holders issues nothing", () => {
  const resale = { ticker: "Y", form: "424B3", items: "", filed_date: "2026-09-02", accession: "b1",
    text: "This prospectus relates to the resale of up to 12,000,000 shares of our common stock by the selling " +
          "stockholders identified herein. We will not receive any proceeds from the sale of shares by the selling stockholders." };
  assert.equal(classifyDilution(resale).excluded_by, "resale_by_existing_holders");
});

test("the bank note shelf — thousands of filings a quarter — is never read as dilution", () => {
  const b2 = { ticker: "Z", form: "424B2", items: "", filed_date: "2026-09-10", accession: "c1",
    text: "Medium-Term Notes, Series N. We may offer and sell notes from time to time. Market-linked notes." };
  assert.equal(classifyDilution(b2).excluded_by, "structured_or_medium_term_notes");
  assert.ok(DILUTION_FORMS.indexOf("424B2") < 0, "424B2 is not even a tracked form");
});

test("convertible notes: the share count is principal ÷ the conversion the filing states", () => {
  const conv = { ticker: "C", form: "8-K", items: "1.01,2.03", filed_date: "2026-09-15", accession: "d1",
    text: "The Company entered into a purchase agreement to sell $500.0 million aggregate principal amount of " +
          "1.00% Convertible Senior Notes due 2031. The initial conversion rate is 20.0000 shares of common " +
          "stock per $1,000 principal amount of notes, representing an initial conversion price of approximately $50.00 per share." };
  const { events } = run([conv], { C: { last_close: 40, shares_out: 200e6 } });
  const d = events[0].detail;
  assert.equal(d.shares_added, 10000000, "500,000,000 ÷ 1,000 × 20 shares");
  assert.equal(d.pct_of_shares_out, 5);
  assert.equal(d.priced_at, 50, "notes are priced by their conversion price, not by any 'per share' nearby");
  assert.equal(Math.round(d.discount_pct), 25, "a conversion price ABOVE the last close is a premium, and says so");
  assert.match(d.shares_basis, /conversion rate of 20 shares/);
});

test("nothing is invented: no size, no share count, no row — with the reason kept", () => {
  const vague = { ticker: "V", form: "8-K", items: "3.02", filed_date: "2026-09-11", accession: "e1",
    text: "The Company entered into exchange agreements in respect of its Convertible Senior Notes. " +
          "Shares of common stock will be issued in the exchange transactions." };
  const { events, skipped } = run([vague], { V: { last_close: 5, shares_out: 1e8 } });
  assert.equal(events.length, 0);
  assert.equal(skipped[0].reason, "NO_SIZE_IN_FILING");
  const noCount = run([byndFiling()], { BYND: { last_close: 7.9 } });
  assert.equal(noCount.events.length, 0, "no share count to measure against → no percentage, no row");
  assert.equal(noCount.skipped[0].reason, "NO_SHARE_COUNT");
});

test("running it twice over the same filing cannot make two rows", () => {
  const a = run([byndFiling()], { BYND: BYND_MKT }).events[0];
  const b = run([byndFiling(), byndFiling()], { BYND: BYND_MKT }).events;
  assert.equal(b[0].dedupe_key, a.dedupe_key);
  assert.equal(b[1].dedupe_key, a.dedupe_key, "the key is the accession number, so the database keeps one");
  assert.match(a.dedupe_key, /^dilution\|BYND\|\d{10}-\d{2}-\d{6}$/);
});

test("the size bar is the rules file's, and the rules file explains itself", () => {
  const D = RULES.dilution;
  assert.ok(D, "data/scintilla-rules.json carries the dilution rule");
  assert.equal(typeof D.min_pct_of_shares_out, "number");
  assert.ok(D.why && D.why_min_pct && D.excluded, "every threshold says why, in plain words");
  const small = { ticker: "S", form: "8-K", items: "3.02", filed_date: "2026-09-12", accession: "f1",
    text: "The Company entered into exchange agreements and 100,000 shares of common stock will be issued " +
          "in the exchange transactions for $1.0 million aggregate principal amount of its Convertible Senior Notes." };
  const { skipped } = run([small], { S: { last_close: 10, shares_out: 1e8 } });
  assert.equal(skipped[0].reason, "BELOW_THRESHOLD", "0.1% of the company is inside an ordinary day's noise");
});

test("the Hub says it in plain words, on the ident and the board row, through the one primitive", () => {
  const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(page, /case "dilution": return "dilution";/);
  assert.match(page, /ev\.kind === "dilution"/, "the strip and the bell have a sentence for it");
  assert.match(page, /up to " \+ \(\+d\.pct_of_shares_out\)\.toFixed\(1\) \+ "% more shares"/);
  assert.match(page, /function boardDilutionPass/);
  assert.match(page, /scintGlow\("board-dilution"/);
  assert.match(page, /scintGlow\("ident-dilution"/);
  /* one primitive, and no new strip: every glow above goes through scScint via scintGlow */
  const dilutionBlock = page.slice(page.indexOf("function boardDilutionPass"), page.indexOf("function boardScintPass"));
  assert.ok(!/animate\(|classList\.add\("sc-scint/.test(dilutionBlock), "no second glow mechanism");
});

test("the migration only widens the kinds, and its rollback is exact", () => {
  const sql = fs.readFileSync(new URL("../supabase/migrations/20260924_scintillas_dilution.sql", import.meta.url), "utf8");
  assert.match(sql, /add constraint scintillas_kind_ck check \(kind in/);
  assert.match(sql, /'dilution'/);
  const body = sql.replace(/^--.*$/gm, "");
  assert.ok(!/drop table|delete from|alter column|drop column/i.test(body), "nothing is dropped, deleted or rewritten");
  const rb = fs.readFileSync(new URL("../supabase/migrations/20260924_scintillas_dilution_ROLLBACK.sql", import.meta.url), "utf8");
  assert.match(rb, /delete from public\.scintillas where kind = 'dilution'/);
  assert.ok(!/price_outlier'\)\)/.test(rb.replace(/\s/g, "")) || /breadth_thrust'\)\)/.test(rb.replace(/\s+/g, "")),
    "the old kind list comes back");
  const cron = fs.readFileSync(new URL("../supabase/migrations/20260924_scintillas_dilution_cron.sql", import.meta.url), "utf8");
  assert.match(cron, /cron\.schedule\('scintillas-dilution-hourly'/);
  assert.match(cron, /cron\.schedule\('scintillas-dilution-evening'/);
  assert.match(cron, /mode=dilution/);
  assert.ok(!/eyJ|service_role_key\s*:=\s*'/.test(cron), "no key value in the migration");
  const cronRb = fs.readFileSync(new URL("../supabase/migrations/20260924_scintillas_dilution_cron_ROLLBACK.sql", import.meta.url), "utf8");
  assert.match(cronRb, /unschedule\('scintillas-dilution-hourly'\)/);
  const fn = fs.readFileSync(new URL("../supabase/functions/scintillas-detect/index.ts", import.meta.url), "utf8");
  assert.match(fn, /mode === "dilution"/);
  assert.ok(!/FMP_API_KEY|apikey=/.test(fn.replace(/apikey: SERVICE/g, "")), "no key value and no FMP call");
});
