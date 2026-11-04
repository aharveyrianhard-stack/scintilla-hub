-- 3 Nov 2026. The alarm on the daily Geiger (the off-Hub, tree-style reading). Alan: "it has to hold dude it can't fail and be stale".
-- It froze at 6 Oct when its Fly timers were lost on 7 Oct, and nothing said so for four weeks.
-- A market day's reading is due by 22:30 ET (the job works after the 20:00 close of extended hours). At 22:35 ET this reads the newest market day the daily Geiger holds.
-- If it is behind, one alert per missed market day goes through the one door: phone and both Macs. The cron is hourly because pg_cron runs on UTC and New York moves; the function picks the hour. p_send = false only reports, at any hour.
-- The closed dates are the machines' own calendar (services/rest-accel/market-session-contract.mjs), printed through 2030: no table in this database holds a current market day.
create or replace function public.daily_geiger_watch(p_now timestamptz default now(), p_send boolean default true)
 returns text
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
declare
  et      timestamp := p_now at time zone 'America/New_York';
  closed  date[] := array['2026-11-26','2026-12-25','2027-01-01','2027-01-18','2027-02-15','2027-03-26','2027-05-31','2027-06-18','2027-07-05','2027-09-06','2027-11-25','2027-12-24','2028-01-17','2028-02-21','2028-04-14','2028-05-29','2028-06-19','2028-07-04','2028-09-04','2028-11-23','2028-12-25','2029-01-01','2029-01-15','2029-02-19','2029-03-30','2029-05-28','2029-06-19','2029-07-04','2029-09-03','2029-11-22','2029-12-25','2030-01-01','2030-01-21','2030-02-18','2030-04-19','2030-05-27','2030-06-19','2030-07-04','2030-09-02','2030-11-28','2030-12-25']::date[];
  due     date := case when et::time >= '22:30' then et::date else et::date - 1 end;
  have    date;
  have_n  int;
  new_id  bigint;
begin
  if p_send and et::time not between '22:30' and '23:29:59' then return 'not the hour'; end if;
  while extract(isodow from due) > 5 or due = any(closed) loop due := due - 1; end loop;
  select max(last_session) into have from massive_stocks.scout_geiger_seven;
  -- a few names on a newer day is not a run: a real one writes thousands
  select count(*) into have_n from massive_stocks.scout_geiger_seven where last_session = have;
  if have >= due and have_n >= 3000 then return 'ok: has ' || have || ' (' || have_n || ' names), due ' || due; end if;
  if not p_send then return 'STALE: has ' || coalesce(have::text, 'nothing') || ' (' || have_n || ' names), due ' || due; end if;
  insert into public.notify_stream(level, kind, title, body, source, key)
  values (3, 'alert', 'The daily Geiger missed a day',
          'Newest reading is ' || coalesce(to_char(have, 'FMDD Mon'), 'missing') || '; it should have ' || to_char(due, 'FMDD Mon') || '. The tree readings on the Hub are old until its job runs. Tell the Scintilla session.',
          'Daily Geiger', 'daily-geiger-stale|' || due)
  on conflict (key) do nothing returning id into new_id;
  return 'STALE: has ' || coalesce(have::text, 'nothing') || ', due ' || due || case when new_id is null then ', already told' else ', alert ' || new_id end;
end $function$;

revoke all on function public.daily_geiger_watch(timestamptz, boolean) from public, anon, authenticated;

select cron.schedule('daily-geiger-watch', '35 * * * *', 'select public.daily_geiger_watch()');
