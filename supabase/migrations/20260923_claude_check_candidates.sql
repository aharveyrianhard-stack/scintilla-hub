-- 2026-09-23 · M35 CLAUDE CHECK — the tickers the folder names that Scintilla cannot price yet.
--
-- WHY. 34 names in the folder are not in the chart API's universe, so the Hub has no
-- bars, no Geiger and no price for them. Adding a name to THAT universe is not an
-- additive change: the served universe is pinned by count and digest in two places
--   · the chart API's own universe file and /universe digest (364 symbols today)
--   · the Hub's SC_EXPECTED_EQUITY_COUNT = 364 and SC_EQUITY_UNIVERSE_DIGEST = ab8f7965…
-- so a ticker cannot be favourited into existence. It needs the coordinator to extend
-- the universe file, re-pin the digest and redeploy. That is deliberately NOT done here.
--
-- WHAT THIS DOES. It parks the proposal where it can be acted on: one additive table
-- holding each candidate, how many bookmarks named it, the cohort it would join and
-- why that cohort. Nothing reads this table yet, so it cannot change any screen.
--
-- ROLLBACK: drop table public.claude_check_candidates;

create table if not exists public.claude_check_candidates (
  ticker           text primary key,
  mentions         integer not null,
  proposed_cohort  text    not null,
  reason           text    not null,
  source           text    not null default 'x-bookmark-folder:CLAUDE CHECK',
  proposed_at      timestamptz not null default now()
);

comment on table public.claude_check_candidates is
  'Tickers named in Alan''s X bookmark folder CLAUDE CHECK that the chart API does not serve. A proposal list, not a universe: adding any of these to the served universe re-pins the universe digest and needs a deploy.';

insert into public.claude_check_candidates (ticker, mentions, proposed_cohort, reason)
values
  ('AAOI', 4, 'AI_HARDWARE', 'optical transceivers — sits beside LITE and CRDO'),
  ('PL', 3, 'THEMATIC', 'satellite imagery — beside ASTS and RKLB'),
  ('BKSY', 2, 'THEMATIC', 'satellite imagery — beside PL and RDW'),
  ('COHR', 2, 'AI_HARDWARE', 'photonics components — beside LITE'),
  ('CRML', 2, 'THEMATIC', 'critical minerals — beside MP and USAR'),
  ('LUNR', 2, 'THEMATIC', 'lunar landers — beside RKLB and ASTS'),
  ('RDW', 2, 'THEMATIC', 'space infrastructure'),
  ('TSEM', 2, 'AI_HARDWARE', 'specialty foundry — beside TSM'),
  ('UUUU', 2, 'THEMATIC', 'uranium and rare earths — beside CCJ'),
  ('ACHR', 1, 'THEMATIC', 'eVTOL — beside JOBY'),
  ('ALB', 1, 'MATERIALS', 'lithium — beside the other materials names'),
  ('AMKR', 1, 'AI_HARDWARE', 'chip packaging — beside AMAT/KLAC'),
  ('AVAV', 1, 'THEMATIC', 'defence drones'),
  ('BTDR', 1, 'CRYPTO', 'bitcoin miner — beside COIN in CRYPTO'),
  ('CLSK', 1, 'CRYPTO', 'bitcoin miner — beside COIN in CRYPTO'),
  ('GLW', 1, 'AI_HARDWARE', 'optical fibre and glass for data centres'),
  ('HIVE', 1, 'CRYPTO', 'bitcoin miner — beside COIN in CRYPTO'),
  ('HUBB', 1, 'BLUE_CHIP', 'grid equipment — beside PWR'),
  ('KTOS', 1, 'THEMATIC', 'defence drones'),
  ('NOK', 1, 'AI_HARDWARE', 'optical transport for data-centre interconnect'),
  ('NVTS', 1, 'AI_HARDWARE', 'power semiconductors — beside ADI/ALAB'),
  ('OUST', 1, 'THEMATIC', 'lidar sensors — sits with the other hardware bets in THEMATIC'),
  ('RIOT', 1, 'CRYPTO', 'bitcoin miner — beside COIN in CRYPTO'),
  ('SATL', 1, 'THEMATIC', 'satellite operator — beside the other space names'),
  ('SERV', 1, 'THEMATIC', 'delivery robots'),
  ('SIDU', 1, 'THEMATIC', 'space services — beside the other space names'),
  ('SIVE', 1, 'AI_HARDWARE', 'photonics, named beside AXTI and LITE'),
  ('SPIR', 1, 'THEMATIC', 'space weather and ship-tracking data'),
  ('SQM', 1, 'MATERIALS', 'lithium — beside the other materials names'),
  ('STM', 1, 'AI_HARDWARE', 'European semiconductor — beside ADI'),
  ('SYM', 1, 'THEMATIC', 'warehouse robotics — the robotics leg of THEMATIC'),
  ('TECK', 1, 'MATERIALS', 'copper — beside SCCO and FCX'),
  ('TMRC', 1, 'THEMATIC', 'rare earth exploration'),
  ('VSH', 1, 'AI_HARDWARE', 'discrete components')
on conflict (ticker) do nothing;
