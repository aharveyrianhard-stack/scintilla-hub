-- M70 (24 Sep 2026) — THE SAME-SCALE TRIO, in the database.
-- Alan, 24 Sep, about New Home Sales: the row carried actual 684 and previous 607 (thousands) with
-- estimate 0.62 (millions), so any surprise computed from it was a thousand times too big.
-- This is ADDITIVE ONLY: two new functions and one new view. Nothing existing is altered, renamed or
-- deleted, and public.econ_calendar is not touched. Rollback is at the bottom.
--
-- THE RULE (identical to the Hub's ecNormalize and to scintillas-detect's econUnify):
--   * one row at a time — its own actual / estimate / previous, never across rows;
--   * a value is corrected only when it sits a factor of 1,000 or 1,000,000 from the scale the rest of
--     the row uses (band: 316x - 3,163x). 10x and 100x are never touched: those can be a real miss;
--   * the winning scale must be a MAJORITY: at least two of the three values sharing it. Two values a
--     thousand apart with no third to break the tie are NOT corrected - unit_rule says 'ambiguous' and
--     the consumer computes no surprise from them;
--   * zero and null take no part; the supplier's own values stay in the _raw columns.

create or replace function public.econ_scale_gap(v double precision, ref double precision)
returns double precision language sql immutable as $$
  select case
    when v is null or ref is null or v = 0 or ref = 0 then 1
    when abs(v)/abs(ref) >  1e3/sqrt(10.0) and abs(v)/abs(ref) <  1e3*sqrt(10.0) then  1e3
    when abs(v)/abs(ref) > 1/(1e3*sqrt(10.0)) and abs(v)/abs(ref) < sqrt(10.0)/1e3 then 1/1e3
    when abs(v)/abs(ref) >  1e6/sqrt(10.0) and abs(v)/abs(ref) <  1e6*sqrt(10.0) then  1e6
    when abs(v)/abs(ref) > 1/(1e6*sqrt(10.0)) and abs(v)/abs(ref) < sqrt(10.0)/1e6 then 1/1e6
    else 1 end;
$$;
comment on function public.econ_scale_gap(double precision, double precision) is
  'M70: how far v sits from ref in scale - 1 = the same scale, 1000 = v is a thousand times bigger. 10x and 100x read as 1.';

create or replace function public.econ_unify(a double precision, e double precision, p double precision)
returns table(actual double precision, estimate double precision, previous double precision, unit_rule text)
language plpgsql immutable as $$
declare
  refs text[] := array['previous','actual','estimate'];   -- reference priority when the vote ties
  vals double precision[] := array[p, a, e];
  best_i int := 0; best_n int := -1; k int; j int; n int; f double precision; ref double precision;
  present int := 0;
begin
  actual := a; estimate := e; previous := p; unit_rule := 'as supplied';
  for k in 1..3 loop if vals[k] is not null and vals[k] <> 0 then present := present + 1; end if; end loop;
  if present < 2 then return next; return; end if;
  for k in 1..3 loop
    if vals[k] is null or vals[k] = 0 then continue; end if;
    n := 0;
    for j in 1..3 loop
      if vals[j] is null or vals[j] = 0 then continue; end if;
      if public.econ_scale_gap(vals[j], vals[k]) = 1 then n := n + 1; end if;
    end loop;
    if n > best_n then best_n := n; best_i := k; end if;
  end loop;
  if best_n = present then return next; return; end if;                 -- already one scale
  if best_n < 2 then unit_rule := 'ambiguous'; return next; return; end if;   -- no majority: change nothing
  ref := vals[best_i];
  f := public.econ_scale_gap(p, ref); if f <> 1 then previous := p / f; end if;
  f := public.econ_scale_gap(a, ref); if f <> 1 then actual   := a / f; end if;
  f := public.econ_scale_gap(e, ref); if f <> 1 then estimate := e / f; end if;
  unit_rule := 'rescaled to ' || refs[best_i];
  return next;
end;
$$;
comment on function public.econ_unify(double precision, double precision, double precision) is
  'M70: one release row put on one scale. unit_rule is "as supplied", "rescaled to <field>" or "ambiguous".';

create or replace view public.econ_calendar_unified as
select
  e.event_ts, e.country, e.event, e.impact,
  e.actual   as actual_raw,
  e.estimate as estimate_raw,
  e.previous as previous_raw,
  u.actual, u.estimate, u.previous, u.unit_rule,
  case when u.unit_rule = 'ambiguous' or u.actual is null or u.estimate is null
       then null else u.actual - u.estimate end as surprise
from public.econ_calendar e
cross join lateral public.econ_unify(e.actual::double precision, e.estimate::double precision, e.previous::double precision) u;
comment on view public.econ_calendar_unified is
  'M70: econ_calendar with the same-scale trio applied. *_raw are the supplier''s own values; surprise is null when the row is ambiguous.';

grant select on public.econ_calendar_unified to anon, authenticated, service_role;

-- ROLLBACK (nothing else has to be undone: the base table was never touched)
-- drop view if exists public.econ_calendar_unified;
-- drop function if exists public.econ_unify(double precision, double precision, double precision);
-- drop function if exists public.econ_scale_gap(double precision, double precision);
