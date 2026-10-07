# staged/q4-access — NOT APPLIED

Proposed access changes from the Q4 audit (5 Oct 2026). Each file sits beside its `_ROLLBACK.sql`.
Nothing here has been run. Grants and access rules are Alan's call; the coordinator applies what he approves.

Order = rank (highest risk for the least breakage first):

| # | file | closes | known breakage |
|---|------|--------|----------------|
| 1 | `01_close_job_relay_function.sql` | the public key making the database send web requests anywhere | none found |
| 2 | `02_views_read_only_for_the_public_key.sql` | writes through 7 views into `tickers`, the archive register and others (35 views lose write grants) | none found |
| 3 | `03_rules_on_keep_reads_scintilla_tables.sql` | add/change/delete on 63 rule-less Scintilla tables; reads unchanged | a writer using the public key (none found) |
| 4 | `04_rules_on_urth_tables.sql` | rule-less Urth tables (11); dormant rules take effect | an Urth tool writing the plant library with the public key (not audited) |
| 5 | `05_private_working_notes.sql` | public reading of 20 working-note tables (needs 3) | none found |
| 6 | `06_other_owner_rights_functions.sql` | the public key triggering 10 owner-rights maintenance functions | none found |

Not staged, because closing them needs a page change first: the tables the Hub and Station write with the public key
(comps_decisions, files, scene_layouts, station_lists, station_targets, station_x_health, yt_positions), the rule-opened tables whose writer is not confirmed
(cli_chat, desk_status, desk_todos, lab_files), and the `inbox` storage bucket (anyone may upload and delete).

Report: `deliverables/20261005/q4-access-audit/Q4-ACCESS-AUDIT.html`
