-- Read-only proof for STAGED D: builds each new command exactly as STAGED D would, EXPLAINs it (plans, never runs),
-- and reports job ids only. Run inside "begin transaction read only; ... commit;". It ends by raising its summary as an
-- error on purpose, so even a writable session changes nothing.
do $$
declare r record; inner_call text; cond text; url text; newcmd text; ok int := 0; bad text := '';
  targets int[] := array[18,220,221,222,223,227,228,232,261,262,263,264,266,267,268,270,271,272,278,279,280,281,282,283,284,285,286];
begin
  for r in select jobid, jobname, command from cron.job where jobid = any(targets) loop
    url := (regexp_match(r.command, '(https://[a-z0-9.-]+/functions/v1/[A-Za-z0-9_-]+)'))[1];
    if (regexp_replace(regexp_replace(r.command, '^\s+|\s+$', '', 'g'), ';\s*$', '')) ~ ';' then bad := bad || r.jobid || ':MULTI '; continue; end if;
    inner_call := (regexp_match(regexp_replace(r.command, '^\s+|\s+$', '', 'g'), '^select\s+(net\.http_(?:post|get)\(.*\))\s*(?:where\s+(.*?))?\s*;?\s*$', 'is'))[1];
    cond       := (regexp_match(regexp_replace(r.command, '^\s+|\s+$', '', 'g'), '^select\s+(net\.http_(?:post|get)\(.*\))\s*(?:where\s+(.*?))?\s*;?\s*$', 'is'))[2];
    if inner_call is null or url is null then bad := bad || r.jobid || ':SHAPE '; continue; end if;
    newcmd := 'select scin_record(' || quote_literal(r.jobname) || ', ' || quote_literal(url) || ', ' || inner_call || ')'
              || coalesce(' where ' || cond, '');
    begin
      execute 'explain ' || newcmd;
      -- the call must be carried over unchanged
      if position(inner_call in newcmd) = 0 or (cond is not null and position(cond in r.command) = 0) then bad := bad || r.jobid || ':ALTERED '; else ok := ok + 1; end if;
      if r.jobid = 278 then bad := bad || '278cond=' || (cond is not null)::text || '/' || length(coalesce(cond,'')) || ' '; end if;
    exception when others then
      bad := bad || r.jobid || ':' || left(regexp_replace(sqlerrm, 'eyJ[A-Za-z0-9._-]{10,}', '***', 'g'), 60) || ' ';
    end;
  end loop;
  raise exception 'Q2B_EXPLAIN_RESULT ok=% of % | %', ok, cardinality(targets), bad;
end $$
