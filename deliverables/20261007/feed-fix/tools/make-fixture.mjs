/* FD1 · the offline fixture of tests/fd1-comps-feed.test.mjs: the rows the feed reads, as the database returned them,
   and what the deployed v5 answered in the same minutes. Read-only. Run from a folder holding `.anon`:
     node make-fixture.mjs <out.json> */
import { writeFileSync } from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), WT = path.resolve(HERE, "../../../..");
const { readTables, queries, PAGE } = await import(WT + "/supabase/functions/comps-feed/feed.mjs");
const { pg, pgCount, liveFeedText, parseCsv, todayUTC } = await import("./fixed-feed.mjs");
const OUT = process.argv[2] || "fd1-comps-feed.json", TODAY = todayUTC();
/* Micron (a year-end: Q4 and FY on one date), Western Digital (a restated year), Seagate (fiscal years only on file),
   SanDisk, Oracle (a quarter after a year-end), Alphabet (a quarter of paper gains), Nebius (a loss), TSMC (reports in
   Taiwan dollars), Nvidia */
const NAMES = "MU WDC STX SNDK ORCL GOOGL NBIS TSM NVDA".split(" ");
const PAD = "AAPL MSFT META TSLA AMD INTC QCOM TXN ADI KLAC LRCX AMAT ASML ARM MRVL FORM TER CRDO COHR LITE GLW APH ANET SMCI DELL NOK CSCO NTAP AMT CCI SBAC PLD SPG WELL PSA O VTR CBRE LLY JPM BAC AME AVGO AMZN VST CEG BE IREN CRWV EQIX DLR".split(" ");
const BATCH60 = [...NAMES, ...PAD].slice(0, 60);
const tables = await readTables(pg, NAMES, TODAY);
/* what v5 asked for, for Micron alone: every estimate row (no period asked), oldest first; the two newest statement rows */
const muEst = await pg("analyst_estimates?select=ticker,period,fiscal_date,est_eps_avg&ticker=eq.MU&order=fiscal_date.asc&limit=1000");
/* the ratio rows v5 read for the year-end names: every column it printed, the quarter and the fiscal year on one date */
const v5Ratios = await pg("ratios_history?select=ticker,fiscal_date,period,pe,ps,pb,gross_margin,net_margin,debt_to_equity,dividend_yield&ticker=in.(MU,WDC,GOOGL)&fiscal_date=gte.2026-06-01&order=ticker.asc,fiscal_date.desc,period.asc");
const inq = "in.(" + BATCH60.map((s) => encodeURIComponent('"' + s + '"')).join(",") + ")";
const first = await pg(`analyst_estimates?select=ticker,period,fiscal_date&ticker=${inq}&order=fiscal_date.asc&limit=${PAGE}`);
const total = await pgCount(`analyst_estimates?select=ticker&ticker=${inq}`);
const live60 = parseCsv(await liveFeedText(BATCH60.join(","))), liveAlone = parseCsv(await liveFeedText("MU")), live4 = parseCsv(await liveFeedText("MU,SNDK,WDC,STX"));
const pick = (o) => Object.fromEntries(NAMES.filter((t) => o[t]).map((t) => [t, o[t]]));
const doc = { what: "FD1 · the rows comps-feed reads and what the deployed v5 answered, captured read-only", taken: new Date().toISOString(), today: TODAY, names: NAMES, queries: queries(NAMES, TODAY), tables,
  v5: { note: "the deployed function (version 5, bundle sha eca6e361…fd60, last changed 20 Jul 2026), asked by GET as the allocation page asks it",
    batch60: BATCH60, estimate_rows_in_batch60: total, first_page: { rows: first.length, newest_fiscal_date: first.reduce((m, r) => (r.fiscal_date > m ? r.fiscal_date : m), ""), future_rows: first.filter((r) => r.fiscal_date > TODAY).length },
    answered_batch60: pick(live60), answered_four: pick(live4), answered_alone: liveAlone.MU, forward_pe_zero_in_batch60: Object.values(live60).filter((r) => r.fwd_pe === 0).length, batch60_names: Object.keys(live60).length,
    micron_estimates_as_v5_read_them: muEst, ratio_rows_as_v5_read_them: v5Ratios } };
writeFileSync(OUT, JSON.stringify(doc));
console.log("fixture →", OUT, "· rows", Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])), "· v5 batch of 60:", total, "estimate rows, first page newest", doc.v5.first_page.newest_fiscal_date, "future rows", doc.v5.first_page.future_rows, "· forward P/E 0 for", doc.v5.forward_pe_zero_in_batch60, "of", doc.v5.batch60_names, "· MU in the batch", JSON.stringify(live60.MU), "· alone", JSON.stringify(liveAlone.MU));
