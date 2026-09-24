# read-engine: date a row by its words, not by the run (CANDIDATE - nothing deployed or scheduled)

**Status: written and reviewed here only.** read-engine is a deployed Supabase edge function living
in another repository; this lane does not deploy, schedule or invoke it. `dossier-refresh` is not
touched at all - it spends Anthropic API credit per ticker, which this lane may not run.

## The defect, in one line of the deployed source
`repo/_LIVE_SNAPSHOT/functions/read-engine/index.ts:56`

```ts
for(const sec of Object.keys(b))if(b[sec])rows.push({ticker:t,section:sec,body:b[sec],updated_ts:now})
```

`now` is the time of the run. Every row is then upserted whether or not its body moved, so
`read_blocks.updated_ts` answers "when did the job last run" - and the Hub, having nothing else to
date these sections with, showed that as the age of the words.

## What the patch changes
A row whose body is byte-identical to the stored one is **not written**, so its `updated_ts` keeps
the date the words last changed. One extra read per 200 tickers; no schema change; no new column;
the generated text itself is untouched.

## After it is deployed (coordinator's call)
`read_blocks.updated_ts` becomes a true content date and the Hub's chip can prefer it. **Until
then the Hub does not trust it** - which is why this lane dates BUSINESS / CATALYSTS / WATCH from
`ticker_context.enriched_ts`, dates VERDICT from the composite it was written from, and shows the
re-stamp only in the chip's tooltip.

## What this does NOT fix
The words are still from June and July. Only `dossier-refresh` writes them, it last ran
**2026-07-22**, and restarting it is a coordinator decision. The Hub change makes the staleness
visible; it cannot make the words current.
