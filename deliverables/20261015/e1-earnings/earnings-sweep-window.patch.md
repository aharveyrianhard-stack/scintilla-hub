# earnings-sweep · the report window must open for names that report from abroad

**Status:** proposed, NOT deployed (E1 lane, 15 Oct 2026). The function is deployed code (v14, 18 Sep 2026); it is not in the
Hub repository. Read with `supabase functions download earnings-sweep` (read-only) on 15 Oct.

## What the deployed code does (v14, lines 61–69)

```ts
function etParts(){ const s=new Date().toLocaleString('en-US',{timeZone:'America/New_York',hour:'2-digit',hour12:false}); return parseInt(s,10) }
function windowOpen(rt:string, isToday:boolean, h:number){
  const morning = h>=6 && h<12, evening = h>=16 && h<24, lateNight = h>=0 && h<3
  if(isToday){ if(rt==='bmo') return morning; if(rt==='amc') return evening; return morning||evening }
  return lateNight||morning
}
```

A BMO row is worked only from 06:00 ET. TSMC publishes at 01:30 ET, ASML at 01:00 ET: even with the cron running through the
night (see `cron-earnings-sweep-hours.sql`) the run finds the row off-window and does nothing until 06:00 ET.

## The change (one function, no new table)

The sweep already reads each in-window row's ticker. `company_profile.country` (ISO-2) says where the company is at home
(TSM = TW, ASML = NL; 179 of 613 profiles have no country and read as US). A BMO row whose company is at home in Asia or Europe
opens its window at 00:00 ET instead of 06:00 ET; everything else is unchanged.

```ts
const EARLY = new Set(['TW','JP','KR','CN','HK','SG','IN','AU','NZ','IL','NL','DE','FR','GB','IE','CH','SE','DK','NO','FI','ES','IT','BE','LU','AT','PL'])
function windowOpen(rt:string, isToday:boolean, h:number, country?:string|null){
  const abroad = !!country && EARLY.has(country)
  const morning = (abroad ? h>=0 : h>=6) && h<12, evening = h>=16 && h<24, lateNight = h>=0 && h<3
  if(isToday){ if(rt==='bmo') return morning; if(rt==='amc') return evening; return morning||evening }
  return lateNight||morning
}
```

and at the call site (line 95) pass the country, read once per run for the rows of the day:

```ts
const {data:prof}=await sb.from('company_profile').select('ticker,country').in('ticker',rows.map((r:any)=>r.ticker))
const home=new Map((prof||[]).map((p:any)=>[p.ticker,p.country]))
const inWin=rows.filter((r:any)=>windowOpen(String(r.report_time||'').toLowerCase(), r.date===today, h, home.get(r.ticker)))
```

## Cost

The sweep touches only rows dated today or yesterday (a handful); the added night runs find at most the foreign BMO names.
FMP calls per run are unchanged (one calendar read when a row is unproven, then the four collectors for the in-window rows,
capped at MAX = 8 a run).

## Rollback

Redeploy v14 (`supabase functions deploy earnings-sweep` from the v14 source, or the dashboard's version history), and run the
rollback statement in `cron-earnings-sweep-hours.sql`.
