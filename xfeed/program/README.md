# The X Trading-list collector as a program

Since 22 September 2026 the collector is a **program**, not a chat session: `scripts/xfeed-program.mjs`
drives the collector's own persistent Chrome profile with Playwright, reuses the trusted helper
`scripts/xfeed-browser-cycle.js` unchanged, and feeds the unchanged loopback intake
`scripts/xfeed-capture-server.mjs`, which finishes and publishes passes exactly as before.
The older CUA/heartbeat procedure in `../OPERATIONS.md` remains the reference for the intake
contract; its "Load the trusted browser helper" and "One recurring pass" sections are what the
program now does by itself.

| What | Where |
| --- | --- |
| Program | `scripts/xfeed-program.mjs` (`run`, `sign-in`, `status`) |
| Schedule (iMac) | `com.alanharvey.scintilla-xfeed-collector.plist`: 06:30, 10:30, 14:30, 18:30 America/New_York |
| Install on the iMac | `install-imac.sh` (run there, in Terminal) |
| One human step | `Sign-in-to-X-collector.command` → copied to the Desktop as “Sign in to X (Scintilla collector)” |
| Health | `<runtime>/program-health.json` (last run, last good pass, next four slots); intake `/health` while a run is up; per-run `<runtime>/runs/program-*/receipt.json` and `<runtime>/logs/` |
| Offline proof | `node tests/manual/xfeed-program-proof.mjs --out DIR` (synthetic list, never x.com) |
| Tests | `node --test tests/xfeed-*.test.mjs` |

## One run

1. Use the intake already listening on `127.0.0.1:8766` for this runtime, otherwise start one for
   the run (`--serve --publish` when `.env.local` exists next to the program; without it the pass
   finishes locally and a preview feed is written under `<runtime>/preview/`).
2. If the intake's heartbeat carries a `collector_retry_at` still in the future, do nothing and say so.
3. Open the Trading list in the collector profile, read the timeline responses through CDP, save
   every chunk through the intake form, and page older until the intake reports the previous
   frontier inside a verified cursor chain. Then `finish('overlap')`. The first pass in an empty
   runtime finishes its window; a timeline that ends before the frontier finishes as `timeline_end`.
4. Budgets: `--max-pages 60` and `--budget-seconds 1500` by default; `--catch-up` raises them to
   600 pages / 50 minutes for the first run after a long gap. A pass stopped by a budget stays
   pending and is reported loudly; nothing half-done is published.

## Loud failure

Signed out, HTTP 429/blocked, no timeline response (layout change), stalled paging, exhausted
budget, intake unavailable, crash: the program runs the documented status command
(`xfeed-collector-status.mjs`) so the public feed carries `collector_status: error` with the words
and, for 429, the actual retry instant. The X Desk then reads
**“Collector down since … · <reason> · last good source <time>”** and, if a run is simply missing,
**“Collector silent · no run since … · last good source <time>”**. Never a quiet stale list.

## Never

No X API. No cookie export. No credential copy. `.env.local` is handed to the intake as
`--env-file` and to the status command in a child process; it is never read into the program.
The profile directory is the collector's own; Alan's everyday Chrome is never opened or touched.
