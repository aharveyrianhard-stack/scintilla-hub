-- ROLLBACK · Q2b STAGED D as corrected by K1 (5 Oct 2026): put every saved command back exactly (the bearer never leaves the database),
-- then drop the backup table.
do $$
declare r record;
begin
  if to_regclass('scin_private.q2b_cron_command_backup_20261003') is null then return; end if;
  for r in select b.jobid, b.command from scin_private.q2b_cron_command_backup_20261003 b join cron.job j on j.jobid = b.jobid loop
    perform cron.alter_job(r.jobid, command := r.command);
  end loop;
end $$;
drop table if exists scin_private.q2b_cron_command_backup_20261003;
