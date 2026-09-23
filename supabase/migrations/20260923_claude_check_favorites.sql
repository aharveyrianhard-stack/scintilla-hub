-- 2026-09-23 · M35 CLAUDE CHECK — favourite the tickers Alan's own bookmark folder keeps naming.
--
-- WHY. Alan asked for the tickers in his X bookmark folder "CLAUDE CHECK" to get the
-- full treatment and to be favourited automatically. Favourites are already the
-- cross-device store the Hub trusts (hub_favorites, read by favLoad(), written by the
-- operator-write function), so this is an insert, not a new mechanism.
--
-- WHAT THIS DOES. It adds 12 tickers that the folder names in TWO OR MORE separate
-- bookmarks and that the chart API already serves. It changes nothing else: no cohort
-- moves, no deletes, no price data.
--
-- WHY NOT EVERY TICKER IN THE FOLDER. FAV is the board's default scope on boot, so
-- every name added here shows up on Alan's first screen. 16 further served tickers
-- appear exactly once, inside somebody's long list (ADBE, CCJ, CORZ, CRWD, ETN, FCX, GOOG, JOBY, KLAC, LLY, MDB, NKE, SCCO, SMCI, STX, UBER).
-- They are left out on purpose; the block at the bottom adds them if Alan wants them.
--
-- ROLLBACK is the last statement in this file (commented out).

insert into public.hub_favorites (ticker, owner_id)
select v.ticker, '00000000-0000-0000-0000-000000000000'::uuid
from (values
  ('CBRS'),
  ('NOW'),
  ('DELL'),
  ('LITE'),
  ('SPCX'),
  ('AAPL'),
  ('CRM'),
  ('IBM'),
  ('LMT'),
  ('MP'),
  ('SMR'),
  ('WDC')
) as v(ticker)
where not exists (
  select 1 from public.hub_favorites f
  where f.ticker = v.ticker
    and f.owner_id = '00000000-0000-0000-0000-000000000000'::uuid
);

-- ROLLBACK (removes exactly what this migration added, nothing else):
-- delete from public.hub_favorites
--  where owner_id = '00000000-0000-0000-0000-000000000000'::uuid
--    and ticker in ('CBRS', 'NOW', 'DELL', 'LITE', 'SPCX', 'AAPL', 'CRM', 'IBM', 'LMT', 'MP', 'SMR', 'WDC');

-- THE ONCE-MENTIONED NAMES, if Alan wants them too (not applied):
-- insert into public.hub_favorites (ticker, owner_id)
-- select v.ticker, '00000000-0000-0000-0000-000000000000'::uuid
-- from (values ('ADBE'), ('CCJ'), ('CORZ'), ('CRWD'), ('ETN'), ('FCX'), ('GOOG'), ('JOBY'), ('KLAC'), ('LLY'), ('MDB'), ('NKE'), ('SCCO'), ('SMCI'), ('STX'), ('UBER')) as v(ticker)
-- where not exists (select 1 from public.hub_favorites f where f.ticker = v.ticker and f.owner_id = '00000000-0000-0000-0000-000000000000'::uuid);
