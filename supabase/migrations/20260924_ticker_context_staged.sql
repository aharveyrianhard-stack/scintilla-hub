-- 2026-09-24 · M37 VERDICT-LIVE — fresh BUSINESS / CATALYSTS / WATCH for five companies,
-- written on an executor lane from data Scintilla already holds. No paid model API was used.
--
-- WHY. The words behind the READ tab's BUSINESS, CATALYSTS and WATCH come from
-- public.ticker_context, written by dossier-refresh, which last ran 2026-07-22. MEASURED
-- 2026-09-24: AAPL's row was enriched 2026-06-15 (epoch 1781496978), NVDA's 2026-06-17,
-- AMD's and MU's 2026-06-16, PANW's 2026-06-16 — 99 to 100 days old. dossier-refresh spends
-- paid Anthropic API credit and the standing rule is no paid model APIs, so it was NOT run,
-- scheduled or invoked. These five were written by hand from rows already in this database.
--
-- WHERE EVERY CLAIM COMES FROM (read-only, 2026-09-24T01:35Z):
--   · earnings_call_transcripts.ai_summary   — the stored summary of the company's own call
--   · earnings_events                        — reported EPS/revenue against estimate, and the
--                                              next scheduled date with its consensus
--   · fundamentals                           — trailing P/E, TTM EPS and revenue
--   · news                                   — headlines, each with its publisher and date
--   · the chart API /quotes                  — the price a multiple is computed against
-- Every sentence below names its source and its date inside the text, so a reader can tell a
-- company fact from a market opinion and can see how old each one is.
--
-- WHAT THIS DOES NOT DO. It does not touch public.ticker_context, and nothing reads this table
-- yet, so it cannot change any screen. It is a staging table for review.
--
-- ROLLBACK:
--   drop policy if exists ticker_context_staged_read on public.ticker_context_staged;
--   drop table if exists public.ticker_context_staged;

create table if not exists public.ticker_context_staged (
  ticker        text primary key,
  business_now  text,
  catalysts     text,
  watch_notes   text,
  sources       jsonb       not null default '[]'::jsonb,
  source_window text,                                     -- oldest→newest date the words rest on
  written_by    text        not null default 'M37 executor lane (subscription; no paid model API)',
  enriched_ts   timestamptz not null default now(),        -- NB: ticker_context.enriched_ts is epoch SECONDS; this is a timestamptz
  updated_ts    timestamptz not null default now()
);

comment on table public.ticker_context_staged is
  'M37 pilot: hand-written BUSINESS/CATALYSTS/WATCH from earnings_events, earnings_call_transcripts, news, fundamentals and the chart API. Staging only - nothing reads it, and public.ticker_context is untouched.';

alter table public.ticker_context_staged enable row level security;

drop policy if exists ticker_context_staged_read on public.ticker_context_staged;
create policy ticker_context_staged_read on public.ticker_context_staged
  for select to anon, authenticated using (true);
grant select on public.ticker_context_staged to anon, authenticated;

insert into public.ticker_context_staged (ticker, business_now, catalysts, watch_notes, sources, source_window)
values
('AAPL',
$b$Apple reported its June quarter on 2026-07-30: EPS $2.02 against a $1.89 estimate, a 6.9% surprise, on revenue of $109.4B (earnings_events, 2026-07-30). On that call the company guided the September quarter to 9-11% revenue growth against roughly 12% consensus, naming two quantified headwinds: about 250bps of sequential FX drag and a "significantly increasing" supply constraint across iPhone, Mac and iPad (earnings call summary, 2026-07-30). Management described the constraint as demand-driven rather than supplier failure — iPhone revenue ran +22% year over year and Mac +29%, both above internal forecasts, against limited advanced-node SoC availability (same call). Services grew 12% and paid subscriptions crossed 1.5 billion (same call). Trailing twelve months: revenue $451.4B, EPS $8.27, trailing P/E 38.9 against the chart API price of $336.94 (fundamentals + chart API, 2026-09-24).$b$,
$b$The next scheduled report is 2026-10-29, with consensus EPS of $1.99; the report time is not recorded in the table (earnings_events, read 2026-09-24). That print is the first under a new chief executive: the 2026-07-30 call was confirmed as Tim Cook's last earnings call, with John Ternus, the incoming CEO, on the call (earnings call summary, 2026-07-30). The guided September quarter — 9-11% revenue growth, gross margin 47-48% including about 100bps of tariff-refund benefit — is the number that print will be judged against (same call). On 2026-09-24 CNBC reported Apple positioned to take a larger share of India, the second-largest smartphone market (news, cnbc.com, 2026-09-24).$b$,
$b$Memory cost is the margin risk management itself flagged: DRAM costs stepped up March, June and September, the carry-in inventory benefit was expected to diminish after September, the call used the phrase "100-year flood" for memory pricing, and iPhone and Mac prices were raised "reluctantly" (earnings call summary, 2026-07-30). The June-quarter headline flattered the underlying business — gross margin of 50.1% carried about 200bps of tariff refund and EPS about $0.11, so the organic beat was modest (same call). Services decelerated roughly 250bps sequentially against about 500bps of cumulative FX drag from March to September, with App Store mobile-gaming softness and a court-mandated link-out headwind (same call). A BofA note cautioning on iPhone 18 ran on 2026-09-23 (news, Yahoo Finance) — a headline, not a rating: the newest stored analyst action for AAPL is Wedbush maintaining Outperform on 2026-06-05 (analyst_grades, read 2026-09-24).$b$,
'["earnings_events 2026-07-30 and 2026-10-29","earnings_call_transcripts Q3 2026 call 2026-07-30","fundamentals trailing P/E 38.9 on EPS 8.27","chart API /quotes price 336.94 2026-09-24","news cnbc.com 2026-09-24, Yahoo Finance 2026-09-23","analyst_grades newest 2026-06-05"]'::jsonb,
'2026-06-05 to 2026-09-24'),

('NVDA',
$b$NVIDIA reported its July quarter on 2026-08-26: EPS $2.22 against a $2.09 estimate, a 6.2% surprise, on revenue of $96.2B (earnings_events, 2026-08-26, sourced from the FMP earnings feed). The call put revenue at $96B, more than double a year earlier, with growth accelerating for a fourth consecutive quarter; data centre revenue was $89B, up 18% sequentially, hyperscale $49B, up 13%, and the ACIE line $40B, up 25% sequentially and 138% year over year; networking set a record, up 18% sequentially, with Spectrum-X Ethernet up 2.6x year over year; gross margin was 75% on both GAAP and non-GAAP bases (earnings call summary, 2026-08-26). Trailing twelve months: revenue $303.0B, EPS $7.91, trailing P/E 28.1 against the chart API price of $225.04 (fundamentals + chart API, 2026-09-24).$b$,
$b$Guidance from the same call: the October quarter is guided to $108B plus or minus 2%, with ACIE the sequential driver and hyperscale re-acceleration expected in the January quarter. Preliminary FY28 guidance is roughly 70% revenue growth, described as explicitly supply-constrained, with management saying unconstrained demand would imply 100% or more (earnings call summary, 2026-08-26). Vera Rubin has begun production shipments and was expected to be about 20% of data centre revenue in the October quarter, with revenue opportunity per gigawatt scaling from about $18B on Hopper to $25B on Blackwell to $40B on Vera Rubin; an AWS agreement covers 2 million additional GPUs through Q2 FY29 (same call). The next scheduled report is 2026-11-18, consensus EPS $2.47 (earnings_events, read 2026-09-24).$b$,
$b$Management called the gross-margin move a reset rather than a transient issue: memory pricing is running above prior expectations and heading higher, with gross margin guided to 74% in the October quarter, troughing at 71-72% in the January quarter and recovering to 72-73% in FY28 as executed price increases take effect (earnings call summary, 2026-08-26). The stored summary also records roughly $50B invested in or committed to the ecosystem, but that paragraph is cut short in the stored text, so the commitment structure is not fully readable from this row (earnings_call_transcripts, read 2026-09-24). In the news feed, insider selling was reported on 2026-09-23 (MarketBeat), and the feed for both NVDA and AMD is dominated by the same head-to-head comparison piece carried by four outlets on 2026-09-23 and 2026-09-24 — one story, not four (news, read 2026-09-24).$b$,
'["earnings_events 2026-08-26 and 2026-11-18","earnings_call_transcripts Q2 2027 call 2026-08-26","fundamentals trailing P/E 28.1 on EPS 7.91","chart API /quotes price 225.04 2026-09-24","news MarketBeat 2026-09-23, The Globe and Mail 2026-09-24"]'::jsonb,
'2026-08-26 to 2026-09-24'),

('AMD',
$b$AMD reported its June quarter on 2026-08-04: EPS $1.66 against a $1.62 estimate, a 2.5% surprise, on revenue of $11.54B (earnings_events, 2026-08-04). The call described a record quarter: revenue $11.5B, up 50% year over year and 13% sequentially; data centre $6.7B, up 107% year over year and now 58% of the mix against 42% a year earlier; client $3.1B, up 23% on record mobile; gaming $779M, down 31% at the trough of the semi-custom cycle; embedded $977M, up 19%; gross margin 56%, up 200bps year over year (earnings call summary, 2026-08-04). Trailing twelve months: revenue $37.5B, EPS $3.06 (fundamentals, read 2026-09-24).$b$,
$b$The September quarter is guided to about $13B plus or minus $300M, up 41% year over year, at about 56% gross margin, with the December quarter expected higher on the Helios ramp (earnings call summary, 2026-08-04). Helios — EPYC Venice with the MI450-series rack-scale platform — began initial shipments in the September quarter with a material ramp in the December quarter into 2027; an Anthropic partnership covers up to 2GW of MI450 with the first gigawatt in the first half of 2027, alongside a Microsoft Azure expansion for frontier inference and ongoing OpenAI and Meta deployments (same call). Management raised its 2027 targets on that call: server CPU revenue growing more than 70% year over year in FY2027 and the data centre segment more than doubling. The next scheduled report is 2026-11-03, consensus EPS $1.90 (earnings_events, read 2026-09-24).$b$,
$b$The multiple is the exposure: trailing P/E of 176 on $3.06 of TTM EPS at the chart API price of $614.51 (fundamentals + chart API, 2026-09-24), which prices in the 2027 targets above — and those targets are management's own, made on 2026-08-04, not an outside estimate. Gaming fell 31% year over year in the reported quarter (same call). Two data cautions measured on 2026-09-24: the stored analyst_estimates rows for AMD begin in 1996, so the first rows of that table are not a forward view and must be filtered by date before use; and the newest stored analyst action is from 2026-06-02 (analyst_grades), so no recent rating change is on file either way.$b$,
'["earnings_events 2026-08-04 and 2026-11-03","earnings_call_transcripts Q2 2026 call 2026-08-04","fundamentals trailing P/E 176.4 on EPS 3.06","chart API /quotes price 614.51 2026-09-24","analyst_estimates row dates begin 1996 (data caution)","analyst_grades newest 2026-06-02"]'::jsonb,
'2026-08-04 to 2026-09-24'),

('PANW',
$b$Palo Alto Networks reported its fiscal fourth quarter on 2026-09-01: non-GAAP EPS $1.02 against a $0.978 estimate, on revenue of $3.41B (earnings_events, 2026-09-01). The call put revenue growth at 34% year over year with EPS beating the high end of guidance by $0.04; remaining performance obligation was $21.2B, up 34%, and next-generation security ARR $9.1B, up 63% (earnings call summary, 2026-09-01). Net new NGS ARR was close to $1B in the quarter alone, about double a year earlier; SASE bookings grew 40% across FY26; XSIAM passed $700M ARR, up 70%, and 1,000 customers; Prisma AIRS reached $100M ARR in four quarters, the fastest product ramp the company has recorded; the platformized cohort's net retention was above 120% with a record 22 net new platformizations (same call).$b$,
$b$FY27 guidance from that call: revenue $14.1-14.2B, up 23-24%; non-GAAP EPS $4.16-4.19; adjusted free-cash-flow margin 38%; operating margin 29.5% against 29.2% in FY26. The first quarter of FY27 is guided to $3.30-3.31B, up 33-34% (earnings call summary, 2026-09-01). Acquisition integration is running ahead of plan on management's account: CyberArk, now Idira, is three to six months ahead on synergies with margins up about 1,000bps in two quarters and FY27 revenue guided to about $1.5B, while Chronosphere observability ARR passed $500M (same call). The next scheduled report is 2026-11-18, consensus EPS $0.97 (earnings_events, read 2026-09-24).$b$,
$b$Two things to hold apart. First, the GAAP multiple is not the one management guides to: trailing P/E is 825 on $0.44 of TTM EPS at the chart API price of $392.19 (fundamentals + chart API, 2026-09-24), against non-GAAP FY27 EPS guidance of $4.16-4.19 — a gap that size means any "P/E" quoted for this company has to say which basis it is on. Second, the growth above is bought as well as built: the quarter's record depends on CyberArk/Idira and Chronosphere integrating, and on 2026-09-24 Yahoo Finance asked whether the stock is fully priced after its AI-security gains (news, 2026-09-24). Two data faults measured on 2026-09-24: earnings_events holds a 2026-08-17 row with no actuals, dated BEFORE the 2026-09-01 report, so any "next report" logic that picks an unreported row can show a date in the past; and PANW has no rows at all in analyst_grades, so the absence of rating changes is missing data, not quiet coverage.$b$,
'["earnings_events 2026-09-01, 2026-11-18, and the stale 2026-08-17 row","earnings_call_transcripts Q4 2026 call 2026-09-01","fundamentals trailing P/E 825 on EPS 0.44","chart API /quotes price 392.19 2026-09-24","news Yahoo Finance 2026-09-24","analyst_grades: zero rows for PANW"]'::jsonb,
'2026-09-01 to 2026-09-24'),

('MU',
$b$Micron reported its May quarter on 2026-06-24: EPS $25.11 against a $20.98 estimate, a 19.7% surprise, on revenue of $41.46B (earnings_events, 2026-06-24). The call described sixteen strategic customer agreements covering about 40% of revenue and targeting about 50%, carrying more than $22B of customer commitments including $18B in cash, structured as take-or-pay five-year contracts with price floors and ceilings, quarterly resets and back-end-loaded deposit returns — visibility the company frames as running to 2030 (earnings call summary, 2026-06-24). Data centre revenue was $25B in that quarter, and the last two quarters produced more free cash flow than the whole prior history of the company (same call). Trailing twelve months: revenue $90.3B, EPS $44.18, trailing P/E 23.0 against the chart API price of $1,072.50 (fundamentals + chart API, 2026-09-24).$b$,
$b$The next report is 2026-09-30, after the close, with consensus EPS of $31.43 — six days from this writing (earnings_events, read 2026-09-24), and it is the nearest dated event of the five companies in this pilot. From the last call: management pulled the HBM TAM forward, expecting it to cross $100B in 2027 rather than 2028, and said demand for HBM3E, HBM4 and HBM4E exceeds supply not only through 2027 but into 2028 and beyond; the dividend was raised 30% and a buyback ramp was set to begin on 9 December, framed around 100% of free cash flow with no quantum committed (earnings call summary, 2026-06-24).$b$,
$b$The spending is the other side of the agreements: FY2026 capital expenditure was raised to about $27B with roughly $10B in the August quarter alone, FY2027 capex is guided above the mid-40s as a percentage of revenue, and the majority of FY2027 spend is construction — Idaho One, Tongluo and Idaho Two — whose bits do not flow until calendar 2028, with startup costs running $100-200M per quarter as a margin headwind through 2027 (earnings call summary, 2026-06-24). The stored words rest on a call from 2026-06-24, three months old and one week before the next print, which is the oldest input of the five dossiers in this pilot. In the feed, Wells Fargo cut its valuation forecast (The Globe and Mail, 2026-09-23) and MarketWatch called the stock a "battleground" as the AI narrative shifts (2026-09-23).$b$,
'["earnings_events 2026-06-24 and 2026-09-30 (AMC)","earnings_call_transcripts Q3 2026 call 2026-06-24","fundamentals trailing P/E 23.0 on EPS 44.18","chart API /quotes price 1072.50 2026-09-24","news The Globe and Mail 2026-09-23, MarketWatch 2026-09-23"]'::jsonb,
'2026-06-24 to 2026-09-24')
on conflict (ticker) do update set
  business_now = excluded.business_now, catalysts = excluded.catalysts, watch_notes = excluded.watch_notes,
  sources = excluded.sources, source_window = excluded.source_window, updated_ts = now();
