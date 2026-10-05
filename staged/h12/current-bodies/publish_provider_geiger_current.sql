CREATE OR REPLACE FUNCTION public.publish_provider_geiger_current(p jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
declare
  expected_count integer;
  incoming_count integer;
  unique_count integer;
  allowed_count integer;
  written integer;
  computed_utc timestamptz;
begin
  if p->>'provider' is distinct from 'MASSIVE'
     or p->>'bar_authority' is distinct from 'PROVIDER_BUILT'
     or p->>'equalizer_receipt_sha256' is distinct from 'f6cf97b57cf26a37aeb8393dec676f1776b02da282dffcce95786e5762697ad1'
     or coalesce(p->>'content_sha256','') !~ '^[0-9a-f]{64}$'
     or jsonb_typeof(p->'rows') is distinct from 'array' then
    raise exception 'provider geiger current contract mismatch';
  end if;
  computed_utc := (p->>'computed_utc')::timestamptz;
  if computed_utc < now() - interval '20 minutes' or computed_utc > now() + interval '5 minutes' then
    raise exception 'provider geiger current artifact is not current';
  end if;

  select count(*) into expected_count from public.provider_owned_equities();
  with incoming as (
    select upper(e->>'ticker') ticker,
           (e->>'composite')::double precision composite,
           (e->>'trend')::double precision trend,
           (e->>'momentum')::double precision momentum,
           (e->>'tf_contributors')::integer tf_contributors,
           (e->>'updated_ts')::bigint updated_ts
    from jsonb_array_elements(p->'rows') e
  )
  select count(*), count(distinct i.ticker), count(poe.ticker)
    into incoming_count, unique_count, allowed_count
  from incoming i left join public.provider_owned_equities() poe on poe.ticker=i.ticker;
  if incoming_count <> expected_count or unique_count <> expected_count or allowed_count <> expected_count then
    raise exception 'provider geiger current universe mismatch: %/%/% expected %', incoming_count, unique_count, allowed_count, expected_count;
  end if;
  if exists (
    select 1 from jsonb_array_elements(p->'rows') e
    where e->>'composite' is null or e->>'trend' is null or e->>'momentum' is null
       or e->>'tf_contributors' is null or e->>'updated_ts' is null
       or (e->>'composite')::double precision not between -1 and 1
       or (e->>'trend')::double precision not between -1 and 1
       or (e->>'momentum')::double precision not between -1 and 1
       or (e->>'tf_contributors')::integer not between 1 and 17
       or abs((e->>'updated_ts')::bigint - extract(epoch from computed_utc)::bigint) > 1
  ) then
    raise exception 'provider geiger current value bounds mismatch';
  end if;

  insert into public.composite_staged
    (ticker, tf, composite, trend, momentum, core, tf_contributors, updated_ts)
  select upper(e->>'ticker'), 'D',
         (e->>'composite')::double precision,
         (e->>'trend')::double precision,
         (e->>'momentum')::double precision,
         (e->>'composite')::double precision,
         (e->>'tf_contributors')::integer,
         (e->>'updated_ts')::bigint
  from jsonb_array_elements(p->'rows') e
  on conflict (ticker,tf) do update set
    composite=excluded.composite, trend=excluded.trend, momentum=excluded.momentum,
    core=excluded.core, tf_contributors=excluded.tf_contributors, updated_ts=excluded.updated_ts;
  get diagnostics written = row_count;
  return written;
end
$function$
