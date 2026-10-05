#!/usr/bin/env python3
"""Q4 access audit (5 Oct 2026) — builds the report page and the staged SQL from evidence/*.json.

Read-only audit. Nothing here talks to the database: evidence/ was captured with catalog SELECTs
(through the Management API, as `postgres`) and one `select * limit 1` per relation with the public key.
The SQL this writes under staged/q4-access/ is NOT APPLIED — grants and access rules are Alan's call.
After a rebuild run `python3 scripts/inject-scnav.py` (BACK / CLOSE pair) and `git checkout --` the older pages it touches.
"""
import html, json, os, collections

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
STAGED = os.path.join(ROOT, 'staged', 'q4-access')
E = lambda f: json.load(open(os.path.join(HERE, 'evidence', f)))
cat = E('catalog.json'); funcs = E('functions.json'); buckets = E('storage_buckets.json')
scan = E('secret_shape_scan_counts.json')
JUNE = 25

# ---- who writes with the public key on purpose (found in page code) --------------------------------------
PAGE_WRITES = {
    'station_lists': 'the Hub page and the Station save the watch-lists here with the public key',
    'station_targets': 'the Station saves its target list here with the public key',
    'yt_positions': 'the Hub, the picture-in-picture page and the Station YouTube pane save where each video was paused',
    'scene_layouts': 'the Station saves its pane layouts here',
    'station_x_health': 'the Station X pane posts a health line every few seconds (insert only; the public key cannot read it back)',
    'files': 'the Hub Files room adds and removes file entries with the public key',
    'comps_decisions': 'the Hub company view records a comps decision (insert only)',
}
POLICY_OPEN_UNKNOWN = {
    'desk_status': '35,810 updates since the counters were reset and touched today — something writes it; no page in the Hub, Station or provider code names it',
    'desk_todos': 'no page in the Hub, Station or provider code names it',
    'lab_files': 'not searched in the Indicator Lab (off limits to this lane) — very likely the Lab saves its files here',
    'cli_chat': 'no page in the Hub, Station or provider code names it; anyone can add a message and read all eight',
}
URTH = {'urth_properties', 'urth_cache', 'urth_reviews', 'site_marks', 'usable_plants', 'suppliers', 'plant_flags',
        'plant_master', 'plant_master_backup_predupe', 'plant_library_spec', 'fl_invasive_ref', 'fnm_catalog'}
SHOWN = {'sector_rankings', 'session_continuity', 'composite_history', 'market_calendar', 'market_hours',
         'crypto_volume', 'pivot_compare', 'ts_chart_lines', 'ts_chart_pivots', 'ts_chart_pivots_evidence'}
NOTES = {'sprint_blockers', 'sprint_findings', 'sprint_fmp_ledger', 'sprint_fmp_research_map', 'sprint_function_rollback',
         'sprint_lane_topology', 'sprint_volume_deps', 'relay_escalations', 'relay_inbox', 'relay_orders', 'known_open_items',
         'estate_identity', 'edge_function_inventory', 'data_location_registry', 'preflight_log', 'rule_enforcement',
         'geiger_rollback_20260815', 'indicator_spec', 'fan_spec', 'ref_data', 'visual_marks', 'scin_consolidation_plan',
         'scin_data_stores', 'fmp_streaming_notes'}
BROWSER = ('hub_page', 'hub_other', 'station')

def w_ops(r):
    """What the public key can effectively write (grant + rules), as letters I U D."""
    if r['kind'] != 'table':
        if not r['view_updatable'] or r['view_invoker']:
            return ''   # not writable through, or the caller's own rights apply (none on the base table)
        return ''.join(c for c in 'IUD' if c in r['view_updatable'] and c in r['grants']['anon'])
    return ''.join(c for c in 'IUD' if r['anon_eff'][c])

def readers(r):
    u = r['used_by']
    out = []
    if 'hub_page' in u: out.append('Hub page')
    if 'station' in u: out.append('Station')
    if 'hub_other' in u: out.append('other Hub pages')
    return out

def can_read(r):
    """The probe answered 200 and a rule lets rows through (rules on + no matching rule answers 200 with nothing)."""
    return r['probe_status'] == 200 and (r['kind'] != 'table' or bool(r['anon_eff']['S']))

def classify(r):
    w = w_ops(r)
    if w:
        if r['name'] in PAGE_WRITES: return 'WRITE-OPEN', 'a page needs it'
        if r['kind'] != 'table': return 'WRITE-OPEN', 'through a view'
        if r['name'] in POLICY_OPEN_UNKNOWN: return 'WRITE-OPEN', 'opened by a rule; writer not confirmed'
        return 'WRITE-OPEN', 'no rules at all' if not r['rls'] else 'opened by a rule'
    if can_read(r):
        return ('INTENDED-PUBLIC-READ', '') if readers(r) else ('UNUSED-OPEN', '')
    return 'PRIVATE-OK', ''

for r in cat:
    r['w'] = w_ops(r); r['cls'], r['why'] = classify(r)

pub = [r for r in cat if r['schema'] == 'public']
tables = [r for r in pub if r['kind'] == 'table']
views = [r for r in pub if r['kind'] != 'table']
rls_off = [r for r in tables if not r['rls']]
rls_on_nopol = [r for r in tables if r['rls'] and r['n_policies'] == 0]
w_tables = [r for r in tables if r['w']]
w_norules = [r for r in w_tables if not r['rls']]
w_policy = [r for r in w_tables if r['rls']]
w_views = [r for r in views if r['w']]
unused_open = [r for r in pub if r['cls'] == 'UNUSED-OPEN']
intended = [r for r in pub if r['cls'] == 'INTENDED-PUBLIC-READ']
private = [r for r in pub if r['cls'] == 'PRIVATE-OK']
anon_read = [r for r in pub if can_read(r)]
secdef_anon = [f for f in funcs if f['security_definer'] and f['anon_exec']]
anon_funcs = [f for f in funcs if f['anon_exec']]
ibkr = [r for r in cat if r['schema'] == 'ibkr']

# ---- staged SQL ------------------------------------------------------------------------------------------
HDR = """-- Q4 access audit · 5 Oct 2026 · STAGED — NOT APPLIED.
-- Grants and access rules are Alan's call (red). A lane never applies this file; the coordinator does, after his yes.
-- Project: scintilla-live. Measured state: deliverables/20261005/q4-access-audit/evidence/catalog.json
"""
def write(name, body):
    os.makedirs(STAGED, exist_ok=True)
    open(os.path.join(STAGED, name), 'w').write(HDR + body.rstrip() + '\n')

import re
def sig(k):   # identity args -> types only
    name, args = k.split('(', 1); args = args[:-1]
    types = []
    for a in filter(None, [x.strip() for x in args.split(',')]):
        a = re.sub(r'^(IN|OUT|INOUT|VARIADIC)\s+', '', a)
        types.append(a.split(' ', 1)[1] if ' ' in a else a)
    return f'public.{name}({", ".join(types)})'
ARGS = {f['name'] + '(' + f['args'] + ')': f for f in secdef_anon}
RELAY_NAMES = ('scin_dispatch', 'scin_record', 'scin_dispatch_reap')
RELAY = [sig(k) for k, f in sorted(ARGS.items()) if f['name'] in RELAY_NAMES]
assert len(RELAY) == 3, RELAY
write('01_close_job_relay_function.sql', """--
-- WHAT: three job-plumbing functions run with the database owner's rights and can be called by anyone holding the
--       public key. scin_dispatch makes the DATABASE send a web request to any address with any headers and body.
-- CLOSES: the public key (and any signed-up user) calling them. Scheduled jobs run as the owner and keep working;
--         edge functions use the service key and keep working (granted explicitly below).
-- BREAKS: nothing found — no Hub, Station or provider page calls these three.
-- CHECK FIRST: the argument lists below match the live functions:
--   select oid::regprocedure from pg_proc where proname in ('scin_dispatch','scin_record','scin_dispatch_reap');
begin;
""" + '\n'.join(f"revoke execute on function {f} from public, anon, authenticated;\ngrant  execute on function {f} to service_role;" for f in RELAY) + "\ncommit;\n")
write('01_close_job_relay_function_ROLLBACK.sql', "-- Restores today's state (PUBLIC, anon and authenticated may execute).\nbegin;\n" +
      '\n'.join(f"grant execute on function {f} to public, anon, authenticated;" for f in RELAY) + "\ncommit;\n")

vw_all = sorted(r['name'] for r in views if any(c in r['grants']['anon'] or c in r['grants']['authenticated'] for c in 'IUD'))
vw_list = ',\n  '.join(f'public."{n}"' for n in vw_all)
write('02_views_read_only_for_the_public_key.sql', f"""--
-- WHAT: {len(vw_all)} views carry insert/update/delete for the public key. {len(w_views)} of them are simple enough that a
--       write passes THROUGH the view into the table behind it, with the view owner's rights — so the rules on that
--       table do not apply. cohorts, all_tickers and v_fundamentals_universe write into `tickers` (the Hub's universe
--       and cohorts); coldstore_current writes into the archive register.
--       Writable through today: {', '.join(r['name'] for r in w_views)}.
-- CLOSES: every write through a view by the public key or a signed-up user. Reads are untouched.
-- BREAKS: nothing found — no page writes a view. onboard_register() inserts into `cohorts`, but it is run by
--         jobs with the owner's or the service key's rights, which this does not change.
begin;
revoke insert, update, delete, truncate on
  {vw_list}
from anon, authenticated;
commit;
""")
write('02_views_read_only_for_the_public_key_ROLLBACK.sql', f"-- Restores today's state.\nbegin;\ngrant insert, update, delete, truncate on\n  {vw_list}\nto anon, authenticated;\ncommit;\n")

core = sorted(r['name'] for r in w_norules if r['name'] not in URTH)
urth_norules = sorted(r['name'] for r in rls_off if r['name'] in URTH)
def rls_on(names, keep_read=True):
    out = []
    for n in names:
        out.append(f'alter table public."{n}" enable row level security;')
        if keep_read:
            out.append(f'create policy q4_public_read on public."{n}" for select to anon, authenticated using (true);')
    return '\n'.join(out)
def rls_off_sql(names, keep_read=True):
    out = []
    for n in names:
        if keep_read: out.append(f'drop policy if exists q4_public_read on public."{n}";')
        out.append(f'alter table public."{n}" disable row level security;')
    return '\n'.join(out)
write('03_rules_on_keep_reads_scintilla_tables.sql', f"""--
-- WHAT: {len(core)} Scintilla tables have no access rules at all: the public key can read, add, change and delete
--       every row. This switches the rules on and adds ONE rule per table: anyone may read (exactly as today).
-- CLOSES: add / change / delete by the public key or a signed-up user.
-- KEEPS: every read, by every page, unchanged. Jobs (database owner) and edge functions (service key) skip
--        the rules and keep writing.
-- BREAKS: only a writer that uses the PUBLIC key. None found in the Hub, Station or provider code for these tables.
--         Not checked: scripts outside those three code lines. Watch the first day: archive_gap_check, composite_history,
--         crypto_volume, market_calendar, sector_rankings, preflight_log, visual_marks (the ones with recent writes).
begin;
{rls_on(core)}
commit;
""")
write('03_rules_on_keep_reads_scintilla_tables_ROLLBACK.sql', f"-- Restores today's state (no rules).\nbegin;\n{rls_off_sql(core)}\ncommit;\n")

urth_tbl = [r for r in rls_off if r['name'] in URTH]
dormant = [(r['name'], p) for r in urth_tbl for p in r['policies']]
need_read = sorted(r['name'] for r in urth_tbl if not any(p['cmd'] in ('SELECT', 'ALL') for p in r['policies']))
write('04_rules_on_urth_tables.sql', f"""--
-- WHAT: {len(urth_norules)} Urth (landscaping) tables live in this database with no rules: client properties with names,
--       addresses and map coordinates; supplier contacts with emails and phones; the plant library.
--       Some already carry rules that were written but never switched on ({len(dormant)} dormant rules). Switching rules
--       on makes those take effect as their author meant, and adds a read rule where none exists.
-- CLOSES: writes to the plant library and its flags; deletes on site_marks and urth_cache.
-- STAYS OPEN (because a dormant rule says so): urth_properties and usable_plants — full write for the public key;
--       suppliers — full write for everyone; urth_cache and site_marks — add and change; urth_reviews — add.
--       Tightening those needs to know how the Urth tools sign in. That is a separate decision.
-- BREAKS: an Urth tool that writes plant_master / plant_flags / fl_invasive_ref / plant_library_spec with the
--         public key. No Scintilla code touches these tables; the Urth tools were not in scope for this audit.
begin;
{rls_on(urth_norules, keep_read=False)}
{chr(10).join(f'create policy q4_public_read on public."{n}" for select to anon, authenticated using (true);' for n in need_read)}
commit;
""")
write('04_rules_on_urth_tables_ROLLBACK.sql', "-- Restores today's state (no rules; the dormant rules stay written but inactive).\nbegin;\n" +
      '\n'.join(f'drop policy if exists q4_public_read on public."{n}";' for n in need_read) + '\n' + rls_off_sql(urth_norules, keep_read=False) + "\ncommit;\n")

PRIV = sorted(n for n in NOTES if n in {r['name'] for r in w_norules} and n not in ('visual_marks', 'ref_data', 'fan_spec', 'indicator_spec'))
write('05_private_working_notes.sql', f"""--
-- NEEDS 03 FIRST. WHAT: {len(PRIV)} tables hold the estate's own working notes (sprint blockers, relay orders,
--       the function inventory, the "which database is this" row). No page reads them. After 03 they are still
--       readable by anyone with the public key; this removes that read.
-- CLOSES: public reading of working notes. BREAKS: any tool that reads them with the public key (none found).
begin;
{chr(10).join(f'drop policy if exists q4_public_read on public."{n}";' for n in PRIV)}
commit;
""")
write('05_private_working_notes_ROLLBACK.sql', "-- Restores the state after 03 (readable by anyone).\nbegin;\n" +
      '\n'.join(f'create policy q4_public_read on public."{n}" for select to anon, authenticated using (true);' for n in PRIV) + "\ncommit;\n")

KEEP_FN = {'plant_library_refresh', 'station_x_health_latest', 'geiger_for_user', 'job_heartbeat_status_board', 'scin_daily_span', 'scin_preflight', 'autoconfirm_new_user'}
rest = sorted(k for k, f in ARGS.items() if f['name'] not in KEEP_FN and f['name'] not in RELAY_NAMES)
write('06_other_owner_rights_functions.sql', f"""--
-- WHAT: {len(rest)} more functions run with the owner's rights and are callable with the public key. They rebuild,
--       de-duplicate or log (dedup_ohlcv deletes duplicate price bars; log_fmp writes the bandwidth log;
--       job_heartbeat_* run the job watchdog). None hands out data, but anyone can trigger them.
-- LEFT ALONE on purpose: {', '.join(sorted(KEEP_FN))} (a page calls it, it only reads, or it belongs to the Urth tools).
-- CLOSES: the public key triggering maintenance. BREAKS: nothing found in page code; jobs run as the owner.
-- CHECK FIRST: select oid::regprocedure from pg_proc where prosecdef and pronamespace='public'::regnamespace;
begin;
""" + '\n'.join(f"revoke execute on function {sig(k)} from public, anon, authenticated;\ngrant  execute on function {sig(k)} to service_role;" for k in rest) + "\ncommit;\n")
write('06_other_owner_rights_functions_ROLLBACK.sql', "-- Restores today's effect (PUBLIC, the public key and signed-in users may execute). job_heartbeat_* had no explicit list\n-- before (PUBLIC by default); the grants below give the same result.\nbegin;\n" + '\n'.join(f"grant execute on function {sig(k)} to public, anon, authenticated;" for k in rest) + "\ncommit;\n")

open(os.path.join(STAGED, 'README.md'), 'w').write(f"""# staged/q4-access — NOT APPLIED

Proposed access changes from the Q4 audit (5 Oct 2026). Each file sits beside its `_ROLLBACK.sql`.
Nothing here has been run. Grants and access rules are Alan's call; the coordinator applies what he approves.

Order = rank (highest risk for the least breakage first):

| # | file | closes | known breakage |
|---|------|--------|----------------|
| 1 | `01_close_job_relay_function.sql` | the public key making the database send web requests anywhere | none found |
| 2 | `02_views_read_only_for_the_public_key.sql` | writes through {len(w_views)} views into `tickers`, the archive register and others ({len(vw_all)} views lose write grants) | none found |
| 3 | `03_rules_on_keep_reads_scintilla_tables.sql` | add/change/delete on {len(core)} rule-less Scintilla tables; reads unchanged | a writer using the public key (none found) |
| 4 | `04_rules_on_urth_tables.sql` | rule-less Urth tables ({len(urth_norules)}); dormant rules take effect | an Urth tool writing the plant library with the public key (not audited) |
| 5 | `05_private_working_notes.sql` | public reading of {len(PRIV)} working-note tables (needs 3) | none found |
| 6 | `06_other_owner_rights_functions.sql` | the public key triggering {len(rest)} owner-rights maintenance functions | none found |

Not staged, because closing them needs a page change first: the tables the Hub and Station write with the public key
({', '.join(sorted(PAGE_WRITES))}), the rule-opened tables whose writer is not confirmed
({', '.join(sorted(POLICY_OPEN_UNKNOWN))}), and the `inbox` storage bucket (anyone may upload and delete).

Report: `deliverables/20261005/q4-access-audit/Q4-ACCESS-AUDIT.html`
""")

# ---- the page --------------------------------------------------------------------------------------------
h = html.escape
def names(rs, n=999): return ', '.join(h(r['name']) for r in rs[:n]) + (f' … +{len(rs)-n}' if len(rs) > n else '')
def fmt(n): return f'{n:,}'
def group(pred): return sorted([r for r in w_norules if pred(r['name'])], key=lambda r: -r['rows'])
g_shown = group(lambda n: n in SHOWN); g_notes = group(lambda n: n in NOTES)
g_urth = sorted([r for r in w_tables if r['name'] in URTH], key=lambda r: -r['rows'])
g_pipe = group(lambda n: n not in SHOWN and n not in NOTES and n not in URTH)
emails = {x['t']: x['emails'] for x in scan if x['emails']}

def card(rank, title, tags, what, writes, reads, breaks, fix, extra=''):
    return f"""<article class="card"><div class="rk">{rank}</div><div class="cb">
<h3>{title}</h3><div class="tg">{''.join(f'<span class="st {c}">{h(t)}</span>' for t, c in tags)}</div>
<dl><dt>What it is for</dt><dd>{what}</dd><dt>Who writes it</dt><dd>{writes}</dd><dt>Who reads it</dt><dd>{reads}</dd>
<dt>What breaks if closed</dt><dd>{breaks}</dd><dt>The change</dt><dd>{fix}</dd></dl>{extra}</div></article>"""

cards = [
card(1, 'The job relay — the database will send a web request for anyone', [('WRITE-OPEN', 's-w'), ('a function, not a table', 's-n')],
  'The scheduled jobs use one database function (<code>scin_dispatch</code>) to call the edge functions. It runs with the database owner\'s rights and takes the address, the headers and the body from whoever calls it.',
  'Meant for: the scheduler only (1 scheduled job names it directly; the others go through it). Today: <b>anyone holding the public key</b> — the key that ships inside the Hub page — can call it and have the database send a GET or POST to any address, and each call adds a line to the job log. Two helpers (<code>scin_record</code>, <code>scin_dispatch_reap</code>) are open the same way.',
  'No page.',
  'Nothing found. Jobs run as the owner; edge functions use the service key. No Hub, Station or provider page calls it.',
  '<code>01_close_job_relay_function.sql</code> — take "execute" away from the public key and signed-up users.',
  '<p class="nt">Not tested by calling it (that would be a write). The finding is the function\'s own text plus its permission list, both read from the catalog.</p>'),
card(2, 'cohorts · all_tickers · v_fundamentals_universe — a side door into the Hub\'s universe', [('WRITE-OPEN', 's-w'), ('through a view', 's-n')],
  f'<code>tickers</code> is the list of what the Hub covers and which cohort each name sits in ({fmt(next((r["rows"] for r in tables if r["name"]=="tickers"),0))} rows est.). The table itself is protected. These three views are simple windows onto it — and the public key was given insert / update / delete on the views.',
  'Meant for: jobs. Today: a write sent to the view passes through into <code>tickers</code> with the owner\'s rights, so the table\'s own rules do not apply. Anyone with the public key could move a name to another cohort, add one or remove one. The same pattern opens <code>coldstore_current</code> (the archive register) and four more: ' + names([r for r in w_views if r['name'] not in ('cohorts','all_tickers','v_fundamentals_universe','coldstore_current')]) + '.',
  'Hub page and Station read <code>cohorts</code>, <code>ticker_cohorts</code> and <code>all_tickers</code> — reads stay.',
  'Nothing found. No page writes a view.',
  f'<code>02_views_read_only_for_the_public_key.sql</code> — views become read-only for the public key ({len(vw_all)} views lose write grants; {len(w_views)} of them were really writable).',
  '<p class="nt">Not tested by writing. The catalog says each of these is "automatically updatable", is owned by the owner role and is not marked to use the caller\'s rights.</p>'),
card(3, f'{len(g_shown)} rule-less tables whose numbers reach the screen', [('WRITE-OPEN', 's-w'), ('no rules at all', 's-n')],
  'Stored results the pages or the engines lean on: ' + ', '.join(f'<code>{h(r["name"])}</code> ({fmt(r["rows"])})' for r in g_shown) + '. <code>composite_history</code> is the daily Geiger snapshot — the record the "check the weights against what prices did next" backlog item needs intact.',
  'Jobs (as the owner). Today also: anyone with the public key can add, change or delete any row.',
  'Station reads <code>sector_rankings</code> and <code>session_continuity</code>; the Hub\'s other pages read <code>sector_rankings</code>; the pivot tables reach the Station through the <code>pivot_union</code> view.',
  'Nothing, if reads are kept: file 03 switches rules on and adds a read-for-all rule, so every page sees what it sees today.',
  '<code>03_rules_on_keep_reads_scintilla_tables.sql</code>'),
card(4, f'{len(g_pipe)} rule-less pipeline tables', [('WRITE-OPEN', 's-w'), ('no rules at all', 's-n')],
  'Bookkeeping for the data pipeline — coverage maps, backfill queues, gap lists, the timeframe and symbol maps (purpose read from the names and columns, not from documentation): ' + names(g_pipe, 60) + '.',
  'Jobs (as the owner). Today also anyone with the public key. Changing a queue or a coverage row could make a job skip or redo work.',
  'No page directly. Several feed views the pages read (<code>station_coverage</code>, <code>data_health</code>, <code>ticker_classification</code>).',
  'Nothing, with the read rule kept.', '<code>03_rules_on_keep_reads_scintilla_tables.sql</code>'),
card(5, f'{len(g_urth)} Urth landscaping tables — client and supplier details', [('WRITE-OPEN', 's-w'), ('personal data', 's-p')],
  f'The landscaping business\'s data sits in the Scintilla database: <code>urth_properties</code> ({fmt(next(r["rows"] for r in tables if r["name"]=="urth_properties"))} client properties — client name, address, map coordinates), <code>suppliers</code> ({fmt(next(r["rows"] for r in tables if r["name"]=="suppliers"))} suppliers; {emails.get("suppliers",0)} rows carry an email; phone and address columns), the plant library and its flags, cached site data.',
  'The Urth tools (not audited). Today: anyone with the Scintilla public key can read all of it and change or delete it.',
  'The Urth tools. No Scintilla page.',
  'Switching rules on activates rules that were written for these tables but never turned on, so the tools that follow them keep working. A tool that writes the plant library with the public key would stop.',
  '<code>04_rules_on_urth_tables.sql</code> — and a separate decision on whether client addresses should be readable with a public key at all.'),
card(6, f'{len(g_notes)} rule-less working-note tables', [('WRITE-OPEN', 's-w'), ('no rules at all', 's-n')],
  'The estate\'s own notes: sprint blockers and findings, relay orders, the function inventory, known open items, and <code>estate_identity</code> — the one row the pre-flight check reads to decide "this is the right database".',
  'Agents and jobs. Today anyone with the public key — including the identity row the safety check trusts.',
  'No page.', 'Nothing found.',
  '<code>03</code> closes the writes; <code>05_private_working_notes.sql</code> then removes public reading.'),
card(7, f'{len(PAGE_WRITES)} tables the pages write on purpose', [('WRITE-OPEN', 's-w'), ('a page needs it', 's-k')],
  'There is no sign-in on the Hub or Station, so what they save, they save with the public key: ' + '; '.join(f'<code>{h(k)}</code> — {h(v)}' for k, v in PAGE_WRITES.items()) + '.',
  'The pages. And therefore anyone who has the key: the watch-lists (80 rows) or the saved video positions (737) could be changed or wiped from outside.',
  'The same pages.',
  '<b>The page\'s save would stop.</b> These cannot be closed by a rule alone — the save has to move behind a small server function first.',
  'Not staged. A product call: accept the exposure, or put the saves behind a function (the Hub already has one, <code>operator-write</code>, for the equalizer).'),
card(8, f'{len(POLICY_OPEN_UNKNOWN)} tables opened by a rule, writer not confirmed', [('WRITE-OPEN', 's-w'), ('opened by a rule', 's-n')],
  '; '.join(f'<code>{h(k)}</code> — {h(v)}' for k, v in POLICY_OPEN_UNKNOWN.items()) + '.',
  'Unknown from the code this lane may read.', 'Unknown.',
  'Unknown until the writer is named — so nothing is staged.',
  'Find the writer first (the coordinator can read the request log for these tables), then decide.'),
]

def yes(b): return '<b>yes</b>' if b else '<span class="d">no</span>'
def trow(r):
    rd = ', '.join(readers(r)) or '<span class="d">—</span>'
    rules = ('<span class="d">view</span>' if r['kind'] != 'table' else ('on · ' + str(r['n_policies']) if r['rls'] else '<b>OFF</b>'))
    c = {'WRITE-OPEN': 's-w', 'INTENDED-PUBLIC-READ': 's-k', 'UNUSED-OPEN': 's-n', 'PRIVATE-OK': 's-d'}[r['cls']]
    wr = ('<b>' + {'I': 'add', 'U': 'change', 'D': 'delete'}[r['w'][0]] + ''.join(' · ' + {'I': 'add', 'U': 'change', 'D': 'delete'}[x] for x in r['w'][1:]) + '</b>') if r['w'] else '<span class="d">no</span>'
    g = r['grants']
    return (f'<tr data-c="{r["cls"]}"><td class="w">{h(r["name"])}{"<div class=wh>"+h(r["schema"])+"</div>" if r["schema"]!="public" else ""}</td><td>{r["kind"]}</td><td>{rules}</td>'
            f'<td>{yes(can_read(r))}</td><td>{wr}</td><td class="n">{("<span class=d>—</span>" if r["kind"]=="view" else fmt(r["rows"])+("" if r["rows_exact"] else "<span class=d> est</span>"))}</td>'
            f'<td class="g">{g["anon"] or "—"} / {g["authenticated"] or "—"} / {g["service_role"] or "—"}</td><td>{rd}</td>'
            f'<td><span class="st {c}">{r["cls"]}</span>{"<div class=wh>"+h(r["why"])+"</div>" if r["why"] else ""}</td></tr>')
order = {'WRITE-OPEN': 0, 'UNUSED-OPEN': 1, 'INTENDED-PUBLIC-READ': 2, 'PRIVATE-OK': 3}
allrows = sorted(pub + ibkr, key=lambda r: (order[r['cls']], r['name']))
cls_n = collections.Counter(r['cls'] for r in pub)

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Q4 · database access rules · 5 Oct 2026</title>
<style>
  :root{{ --bg:#0b0b0e; --panel:#121216; --line:#2a2a30; --ink:#d2d2d2; --ink2:#b4b4b8; --ink3:#8c8c92; }}
  *{{ box-sizing:border-box; }}
  body{{ margin:0; background:var(--bg); color:var(--ink2); font:14px/1.6 "SF Mono", Menlo, Consolas, monospace; }}
  main{{ max-width:1500px; margin:0 auto; padding:56px 16px 80px; }}
  h1{{ font-size:15px; letter-spacing:.3em; text-transform:uppercase; color:var(--ink); margin:10px 0 4px; }}
  .lead{{ color:var(--ink); font-size:15px; margin:8px 0 6px; max-width:1100px; }}
  .sub{{ color:var(--ink3); margin-bottom:16px; max-width:1100px; }}
  .big{{ display:flex; align-items:baseline; gap:18px; flex-wrap:wrap; border:1px solid var(--line); background:var(--panel); padding:16px 18px; margin:14px 0 8px; }}
  .big .a{{ font-size:44px; color:var(--ink3); }} .big .b{{ font-size:64px; color:var(--ink); font-weight:600; line-height:1; }}
  .big .ar{{ font-size:30px; color:var(--ink3); }} .big .c{{ flex:1 1 320px; color:var(--ink2); font-size:13px; }}
  .k{{ display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:8px; margin:8px 0 18px; }}
  .k div{{ border:1px solid var(--line); background:var(--panel); padding:10px 12px; font-size:12px; letter-spacing:.1em; color:var(--ink3); }}
  .k b{{ display:block; font-size:24px; letter-spacing:0; color:var(--ink); font-weight:600; }}
  section{{ background:var(--panel); border:1px solid var(--line); margin:0 0 14px; padding:14px 16px; }}
  h2{{ font-size:13px; letter-spacing:.2em; text-transform:uppercase; margin:0 0 8px; color:var(--ink); font-weight:600; }}
  h3{{ font-size:14px; margin:0 0 6px; color:var(--ink); font-weight:600; }}
  p{{ margin:6px 0; max-width:1100px; }} code{{ color:var(--ink); font-size:13px; }} b{{ color:var(--ink); }}
  .card{{ display:flex; gap:14px; border-top:1px solid var(--line); padding:14px 0; }} .card:first-of-type{{ border-top:0; }}
  .rk{{ flex:0 0 38px; font-size:28px; color:var(--ink3); line-height:1; padding-top:2px; }} .cb{{ flex:1; min-width:0; }}
  dl{{ display:grid; grid-template-columns:170px 1fr; gap:4px 14px; margin:8px 0 0; }} dt{{ color:var(--ink3); font-size:12px; letter-spacing:.08em; }} dd{{ margin:0; overflow-wrap:anywhere; }}
  .nt{{ color:var(--ink3); font-size:12px; margin-top:8px; }}
  .tg{{ margin:0 0 4px; }}
  .st{{ display:inline-block; font-size:11px; letter-spacing:.12em; padding:1px 6px; border:1px solid var(--line); white-space:nowrap; margin:0 4px 3px 0; }}
  .s-w{{ color:#0b0b0e; background:#c8c8c8; border-color:#c8c8c8; font-weight:600; }} .s-k{{ color:var(--ink); border-color:#8c8c92; }}
  .s-n{{ color:var(--ink); border-style:dashed; border-color:#8c8c92; }} .s-d{{ color:var(--ink3); border-style:dotted; }} .s-p{{ color:var(--ink); border-width:2px; border-color:#b4b4b8; }}
  .tw{{ overflow-x:auto; }} table{{ border-collapse:collapse; width:100%; min-width:1080px; }}
  th{{ text-align:left; font-size:11px; letter-spacing:.14em; color:var(--ink3); font-weight:400; padding:6px 8px; border-bottom:1px solid var(--line); white-space:nowrap; }}
  td{{ padding:6px 8px; border-bottom:1px solid #1c1c22; vertical-align:top; font-size:13px; }}
  td.w{{ color:var(--ink); }} td.n{{ text-align:right; white-space:nowrap; }} td.g{{ color:var(--ink3); white-space:nowrap; font-size:12px; }}
  .wh{{ color:var(--ink3); font-size:12px; }} .d{{ color:var(--ink3); }}
  .fl{{ display:flex; flex-wrap:wrap; gap:6px; margin:6px 0 10px; }}
  .fl button{{ font:12px "SF Mono", Menlo, monospace; letter-spacing:.1em; background:var(--bg); color:var(--ink2); border:1px solid var(--line); padding:5px 9px; cursor:pointer; }}
  .fl button.on{{ color:#0b0b0e; background:#c8c8c8; border-color:#c8c8c8; }}
  ol,ul{{ max-width:1100px; padding-left:22px; }} li{{ margin:4px 0; }}
  details.sc-pagespecs{{ border:1px solid var(--line); background:var(--panel); padding:10px 16px; }} details.sc-pagespecs summary{{ cursor:pointer; letter-spacing:.2em; font-size:12px; color:var(--ink); }}
  @media (max-width:700px){{ dl{{ grid-template-columns:1fr; }} .big .b{{ font-size:48px; }} .card{{ gap:8px; }} .rk{{ flex-basis:24px; font-size:20px; }} }}
</style>
</head>
<body>
<main>
<h1>Q4 · which tables have no access rules</h1>
<p class="lead">Counted today, 5 October 2026, straight from the database's own catalog, then checked by reading one row from every table with the public key. Nothing was changed.</p>

<div class="big"><span class="a">{JUNE}</span><span class="ar">→</span><span class="b">{len(rls_off)}</span>
<div class="c"><b>Tables with no access rules: 17 June {JUNE} → today {len(rls_off)}</b>, out of {len(tables)} tables. On {len(w_norules)} of the {len(rls_off)} the public key — the one that ships inside the Hub page for every visitor — can read, add, change and delete every row. The other {len(rls_off)-len(w_norules)} have no rules but were never handed to the public key for writing.</div></div>

<div class="k">
<div><b>{len(tables)}</b>tables (+{len(views)} views)</div>
<div><b>{len(rls_off)}</b>tables, rules off</div>
<div><b>{len(w_tables)}</b>tables the public key can write</div>
<div><b>{len(w_views)}</b>views it can write through</div>
<div><b>{len(unused_open)}</b>readable by anyone, read by no page</div>
<div><b>{len(intended)}</b>readable, a page reads it</div>
<div><b>{len(private)}</b>private</div>
<div><b>{len(secdef_anon)}</b>owner-rights functions the public key can run</div>
</div>

<section><h2>The three biggest risks</h2>
<ol>
<li><b>The database will send a web request for anyone.</b> The job relay function accepts the address, headers and body from the caller and runs with the owner's rights; the public key may call it. Fix 1 closes it and breaks nothing found.</li>
<li><b>The Hub's universe has a side door.</b> <code>tickers</code> is protected, but three plain views onto it (<code>cohorts</code>, <code>all_tickers</code>, <code>v_fundamentals_universe</code>) accept writes from the public key and pass them through. Fix 2 makes views read-only and breaks nothing found.</li>
<li><b>{len(w_norules)} tables have no rules and full public write</b> — among them the daily Geiger history ({fmt(next(r['rows'] for r in tables if r['name']=='composite_history'))} rows), the market calendar, sector rankings, the pipeline's queues, and the Urth client and supplier details (names, addresses, emails). Fixes 3 and 4 switch rules on and keep every read as it is.</li>
</ol>
<p class="sub">No table that holds a key is open: <code>kv_secrets</code>, <code>app_config</code> and <code>app_settings</code> all refused the public key. A scan of {len(scan)} publicly readable tables for key-shaped text found only the public key itself (inside two stored pages) and three chance matches inside two multi-megabyte terrain files.</p>
</section>

<section><h2>What the public key can write — {len(w_tables)} tables, {len(w_views)} views, 3 functions</h2>
{''.join(cards)}
</section>

<section><h2>Ranked fixes — each is Alan's call; none is applied</h2>
<div class="tw"><table><thead><tr><th>#</th><th>FILE (staged/q4-access/)</th><th>CLOSES</th><th>BREAKS</th><th>WAY BACK</th></tr></thead><tbody>
<tr><td>1</td><td class="w">01_close_job_relay_function.sql</td><td>the public key making the database call any web address</td><td>nothing found</td><td>…_ROLLBACK.sql</td></tr>
<tr><td>2</td><td class="w">02_views_read_only_for_the_public_key.sql</td><td>writes through views into <code>tickers</code>, the archive register and others</td><td>nothing found</td><td>…_ROLLBACK.sql</td></tr>
<tr><td>3</td><td class="w">03_rules_on_keep_reads_scintilla_tables.sql</td><td>add / change / delete on {len(core)} rule-less Scintilla tables; reads unchanged</td><td>a writer using the public key (none found)</td><td>…_ROLLBACK.sql</td></tr>
<tr><td>4</td><td class="w">04_rules_on_urth_tables.sql</td><td>{len(urth_norules)} rule-less Urth tables; rules already written take effect</td><td>an Urth tool writing the plant library with the public key (not audited)</td><td>…_ROLLBACK.sql</td></tr>
<tr><td>5</td><td class="w">05_private_working_notes.sql</td><td>public reading of {len(PRIV)} working-note tables (after 3)</td><td>nothing found</td><td>…_ROLLBACK.sql</td></tr>
<tr><td>6</td><td class="w">06_other_owner_rights_functions.sql</td><td>the public key triggering {len(rest)} maintenance functions</td><td>nothing found</td><td>…_ROLLBACK.sql</td></tr>
</tbody></table></div>
<p class="sub">Not staged: the {len(PAGE_WRITES)} tables the pages save into (needs a page change first), the {len(POLICY_OPEN_UNKNOWN)} whose writer is not confirmed, and the storage bucket <code>inbox</code>.</p>
</section>

<section><h2>Also open, outside the tables</h2>
<ul>
<li><b>Storage.</b> All {len(buckets)} buckets are public to read ({', '.join(f"{h(b['name'])} {fmt(b['objects'])}" for b in buckets)} files). In <code>inbox</code> anyone may also upload and delete.</li>
<li><b>Functions.</b> {len(anon_funcs)} of {len(funcs)} database functions can be run with the public key. Most run with the caller's own rights, so they can only touch what the tables above already allow — once the tables are closed, so are they. {len(secdef_anon)} run with the owner's rights; fixes 1 and 6 cover them.</li>
<li><b>Signing up.</b> A trigger confirms every new account at once, and {sum(1 for r in tables if any(r['auth_eff'][c] for c in 'IUD'))} tables accept writes from any signed-in account. Whether sign-up is switched on could not be read from here (see below). There are 2 accounts today, none new in 30 days.</li>
<li><b>The <code>ibkr</code> area</b> is also reachable with the public key: 4 of its 6 tables are readable (bars, quotes, collector health, an archived symbol map), none writable.</li>
<li><b>Views read past the rules.</b> {sum(1 for r in views if r['probe_status']==200 and not r['view_invoker'])} of the {len(views)} views and stored views show their table with the owner's rights, so a table can be private while its view is public. None of them shows a key table's values (checked: <code>fmp_usage_now</code> and <code>tzfix_progress</code> read <code>app_config</code> but return only usage numbers and progress rows).</li>
</ul></section>

<section><h2>Every table and view — {len(allrows)}</h2>
<div class="fl" id="fl"><button data-f="" class="on">ALL {len(allrows)}</button><button data-f="WRITE-OPEN">WRITE-OPEN {cls_n['WRITE-OPEN']}</button><button data-f="UNUSED-OPEN">UNUSED-OPEN {cls_n['UNUSED-OPEN']}</button><button data-f="INTENDED-PUBLIC-READ">INTENDED-PUBLIC-READ {cls_n['INTENDED-PUBLIC-READ']}</button><button data-f="PRIVATE-OK">PRIVATE-OK {cls_n['PRIVATE-OK']}</button></div>
<div class="tw"><table id="t"><thead><tr><th>NAME</th><th>KIND</th><th>RULES · COUNT</th><th>PUBLIC KEY READS</th><th>PUBLIC KEY WRITES</th><th>ROWS</th><th>GRANTS public / signed-in / service</th><th>READ BY</th><th>CLASS</th></tr></thead>
<tbody>{''.join(trow(r) for r in allrows)}</tbody></table></div>
</section>

<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<p><b>What this page shows.</b> Every table and view the public key can reach (the <code>public</code> area, {len(pub)} of them, plus the 6 in <code>ibkr</code>), whether access rules are switched on, what the public key can do, and who reads it.</p>
<p><b>Where each number comes from.</b> "Rules on/off", the rule count and the grants come from the database catalog, read today. "Public key reads" is a real test: one row asked for with the public key, per table ({sum(1 for r in cat if r['probe_status']==200)} answered, {sum(1 for r in cat if r['probe_status'] not in (200,None))} refused; 2 answered with nothing because a rule lets no row through — counted as private). "Public key writes" is worked out from the grants and the rules — <b>it was not tested</b>, because a test would be a write. Row counts are exact where the table is open, estimates ("est") elsewhere. "Read by" is a search of the Hub page, the Hub's other pages and the Station code for the table's name. The June figure of 25 is the one quoted in the 17 June roadmap; that count was not re-derived.</p>
<p><b>Letters in the grants column.</b> S read · I add · U change · D delete. A grant is only the first gate; with rules on, a rule must also allow it.</p>
<p><b>What could be wrong.</b> A page that builds a table name at run time, or a tool outside the three code lines searched (the Indicator Lab, the Urth tools, scripts on other machines), would not show under "read by" — so an UNUSED-OPEN table may have a reader this audit could not see, and "breaks: nothing found" means nothing found in that code. What each rule-less table is for was read from its name and columns. {len(rls_on_nopol)} tables have rules on and no rule written: those are closed to the public key, which is correct.</p>
<p><b>What was not done.</b> No write of any kind. No sign-in settings, request logs or storage listing were read. The functions were read, never called. The Urth tools were not audited.</p>
</details>
</main>
<script>
document.getElementById('fl').addEventListener('click',function(e){{var b=e.target.closest('button');if(!b)return;
 [].forEach.call(this.children,function(x){{x.classList.toggle('on',x===b);}});var f=b.getAttribute('data-f');
 [].forEach.call(document.querySelectorAll('#t tbody tr'),function(r){{r.style.display=(!f||r.getAttribute('data-c')===f)?'':'none';}});}});
</script>
</body>
</html>
"""
open(os.path.join(HERE, 'Q4-ACCESS-AUDIT.html'), 'w').write(page)
summary = dict(tables=len(tables), views=len(views), rls_off=len(rls_off), june=JUNE, rls_on_no_policy=len(rls_on_nopol),
               anon_writable_tables=len(w_tables), of_which_no_rules=len(w_norules), of_which_policy=len(w_policy),
               anon_writable_views=len(w_views), anon_readable=len(anon_read), anon_readable_unused=len(unused_open),
               intended_public_read=len(intended), private=len(private), secdef_anon_functions=len(secdef_anon),
               anon_functions=len(anon_funcs), functions=len(funcs), classes=dict(cls_n),
               staged=sorted(os.listdir(STAGED)), groups=dict(shown=len(g_shown), pipeline=len(g_pipe), urth=len(g_urth), notes=len(g_notes)))
json.dump(summary, open(os.path.join(HERE, 'summary.json'), 'w'), indent=1)
print(json.dumps(summary, indent=1))
