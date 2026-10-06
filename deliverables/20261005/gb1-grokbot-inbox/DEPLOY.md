# GB1 — what the coordinator runs to switch the Grok Bot inbox on

Nothing below has been run. Branch `hub/gb1-grokbot-inbox-20261005`. Run from the Hub checkout, in this order.
Project `wadinxqplrggagkvrdag`. No command here prints the token.

## 1. The token — made on this Mac, kept in the Keychain, never on screen

```sh
# make it (48 letters and digits) straight into the Keychain
security add-generic-password -U -a scintilla -s grokbot-inbox-token \
  -w "$(openssl rand -base64 60 | tr -dc 'A-Za-z0-9' | cut -c1-48)"

# hand it to the function as a secret, without it appearing in the terminal or in shell history
supabase secrets set --project-ref wadinxqplrggagkvrdag \
  --env-file <(printf 'GROKBOT_INBOX_TOKEN=%s\n' "$(security find-generic-password -s grokbot-inbox-token -w)")
```

Alan gives it to Grok Bot through Grok Bot's secure prompt: `security find-generic-password -s grokbot-inbox-token -w | pbcopy`,
paste into the prompt, then copy something else so the clipboard no longer holds it. A token shorter than 32
characters, or no token, leaves the inbox closed (every request answers 503).

Leave `GROKBOT_TEXT_ALLOWED` unset. Set it to `1` only on the day Alan OKs storing transcript text.

## 2. The tables

```sh
supabase db query --linked --project-ref wadinxqplrggagkvrdag -f supabase/migrations/20261005_grokbot_inbox.sql
```

Additive only: six new tables, one view, one `job_heartbeat` row (`grokbot:inbox`), one nightly clean-up job
(`grokbot-inbox-retention`, 03:17 UTC, deletes log rows older than 30 days). Safe to run twice. The undo is
`20261005_grokbot_inbox_ROLLBACK.sql` — it drops the stored rows too, so it needs Alan's word; to stop the inbox
without losing anything, unset the secret instead.

## 3. The function

```sh
supabase functions deploy grokbot-inbox --no-verify-jwt --project-ref wadinxqplrggagkvrdag
```

`--no-verify-jwt` is required: Grok Bot's token is not a Supabase key, so Supabase's own gate must let the
request reach the function, which checks the token itself.

## 4. Prove it (four requests; none leaves a made-up post in a table)

```sh
U=https://wadinxqplrggagkvrdag.supabase.co/functions/v1/grokbot-inbox
T() { security find-generic-password -s grokbot-inbox-token -w; }

# a) a wrong token is refused: expect 401
curl -sS -o /dev/null -w '%{http_code}\n' -H 'Authorization: Bearer not-the-token' "$U"

# b) a heartbeat is accepted: expect {"ok":true,"kind":"heartbeat","accepted":0,"rejected":[]}
curl -sS -X POST "$U" -H "Authorization: Bearer $(T)" -H 'Content-Type: application/json' \
  -d "{\"kind\":\"heartbeat\",\"sent_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"status\":{\"note\":\"coordinator deploy test\"}}"

# c) a bad X post is refused with its reason and nothing is stored: expect "accepted":0 and one "rejected"
curl -sS -X POST "$U" -H "Authorization: Bearer $(T)" -H 'Content-Type: application/json' \
  -d "{\"kind\":\"x_posts\",\"sent_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"items\":[{\"id\":12345}]}"

# d) what we have: expect last_received_per_kind.heartbeat = a moment ago, and the channel list
curl -sS -H "Authorization: Bearer $(T)" "$U"
```

Then, read-only: `select job, status, last_ok_at, last_cause from job_heartbeat where job = 'grokbot:inbox';`
(`last_cause` reads `ALL_REJECTED` after test c — the next good POST clears it) and
`select kind, outcome, accepted, rejected, received_at from grokbot_inbox order by id desc limit 5;`.

## 5. Then paste `CONTRACT.md` to Grok Bot

The address in it is already the live one.

## Tests behind this

- `node --test tests/grokbot-inbox.test.mjs` — 13 tests of the function against a pretend database.
- `PGLITE_DIR=<folder with node_modules/@electric-sql/pglite> node deliverables/20261005/gb1-grokbot-inbox/sqltest/run.mjs`
  — the migration and rollback on a throw-away Postgres, 10 checks.
- Not tested: the function has never run under Deno or on Supabase (no Deno on this Mac; nothing was deployed).
  Step 4 is that test.
