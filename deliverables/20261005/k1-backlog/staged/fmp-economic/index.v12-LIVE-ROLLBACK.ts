import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const SB_URL=Deno.env.get('SUPABASE_URL')||''
const SB_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
const J=(o:any)=>new Response(JSON.stringify(o),{headers:{'Content-Type':'application/json'}})
const num=(v:any)=>(v==null||v===''||isNaN(+v))?null:+v
const dstr=(v:any)=>(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v))?v.slice(0,10):null
const dt=(days:number)=>{const d=new Date(Date.now()+days*86400000);return d.toISOString().slice(0,10)}
let _calls=0,_bytes=0 // CC-BOARD-003 C2: FMP bandwidth accounting
async function fmp(path:string,k:string){try{const r=await fetch('https://financialmodelingprep.com/stable/'+path+(path.includes('?')?'&':'?')+'apikey='+k);_calls++;if(!r.ok)return null;const txt=await r.text();_bytes+=txt.length;const j=JSON.parse(txt);return Array.isArray(j)?j:null}catch(_){return null}}
const SERIES=['CPI','GDP','realGDP','federalFunds','unemploymentRate','totalNonfarmPayroll','inflationRate','retailSales','consumerSentiment','durableGoods','initialClaims','totalVehicleSales','industrialProductionTotalIndex','30YearFixedRateMortgageAverage']
/* R52j — quarterly series print rarely, so a 90-day window can contain nothing at
   all; they get a year. Everything else is monthly or weekly and wants the SHORT
   window (see the block below for why). */
const QUARTERLY=new Set(['GDP','realGDP'])
Deno.serve(async (req)=>{try{
  _calls=0;_bytes=0 // CC-BOARD-003 C2: reset per invocation so fmp_bandwidth_log gets one accurate row per run
  const u=new URL(req.url)
  const sb=createClient(SB_URL,SB_KEY)
  const now=Math.floor(Date.now()/1000)
  const {data:cfg,error:ce}=await sb.from('app_config').select('key,value').in('key',['econ_busy','FMP_KEY'])
  if(ce)throw new Error('app_config: '+ce.message)
  const C:any={};for(const r of (cfg||[]))C[r.key]=r.value
  const K=(C['FMP_KEY']||'').trim();if(!K)throw new Error('no FMP_KEY')
  const busy=parseInt(C['econ_busy']||'0',10)
  if(now-busy<180&&!u.searchParams.get('force'))return J({skipped:'busy'})
  await sb.from('app_config').upsert({key:'econ_busy',value:''+now},{onConflict:'key'})
  const counts:any={treasury:0,econ:{},calendar:0};const errs:string[]=[]
  const _only=(u.searchParams.get('only')||'').toLowerCase()
  if(_only!=='recent') try{
    const tr=await fmp('treasury-rates?from='+dt(-90)+'&to='+dt(0),K)
    if(tr&&tr.length){const rows=tr.filter((x:any)=>dstr(x.date)).map((x:any)=>({date:dstr(x.date),m1:num(x.month1),m2:num(x.month2),m3:num(x.month3),m6:num(x.month6),y1:num(x.year1),y2:num(x.year2),y3:num(x.year3),y5:num(x.year5),y7:num(x.year7),y10:num(x.year10),y20:num(x.year20),y30:num(x.year30),updated_ts:now}))
      const s=new Set();const ded=rows.filter((r:any)=>{if(s.has(r.date))return false;s.add(r.date);return true})
      const {error}=await sb.from('treasury_rates').upsert(ded,{onConflict:'date'});if(error)throw new Error(error.message);counts.treasury=ded.length}
  }catch(e){errs.push('treasury: '+String((e as any)&&(e as any).message||e))}
  /* ---------------------------------------------------------------------------
     R52j FIX (2026-08-14) — the SAME bug the calendar had, in the series feed.
     `economic-indicators` returns a SMALL SLICE STARTING AT `from`, never a range
     ending today. Measured on 2026-08-14:
         from = 450 days back  ->  3 rows, 2025-09 … 2025-11
         from =  90 days back  ->  2 rows, 2026-06 … 2026-07   <- the current ones
     The old code asked with back=450, so for months it has been faithfully
     collecting data from fifteen months ago on every single run, and every series
     in the macro rail sat frozen while the job reported success. Short window now.
     Note this feed does NOT backfill history — asking further back returns older
     rows, not more of them, so deep history has to come from somewhere else.
     --------------------------------------------------------------------------- */
  for(const s of (_only==='recent'?[]:SERIES)){
    try{
      const back = QUARTERLY.has(s) ? 400 : 90
      const rows=await fmp('economic-indicators?name='+encodeURIComponent(s)+'&from='+dt(-back),K)
      if(rows&&rows.length){const ins=rows.filter((x:any)=>dstr(x.date)).map((x:any)=>({series:s,date:dstr(x.date),value:num(x.value),source:'fmp',updated_ts:now}))
        const sn=new Set();const ded=ins.filter((r:any)=>{if(sn.has(r.date))return false;sn.add(r.date);return true})
        if(ded.length){const {error}=await sb.from('econ_history').upsert(ded,{onConflict:'series,date'});if(error)throw new Error(error.message);counts.econ[s]=ded.length}}
      else counts.econ[s]=0
    }catch(e){errs.push(s+': '+String((e as any)&&(e as any).message||e))}
  }
  /* ---------------------------------------------------------------------------
     R52 FIX (2026-08-12) — economic calendar: ask in SMALL WINDOWS, not one big one.
     FMP caps a wide range and returns the FAR END of it, so a single -3d..+150d call
     answered with October–December only: 1,183 rows, zero actuals. Today and the
     recent past were never re-read, so a number that printed at 08:30 was never
     written down, and US rows carrying an actual fell 92% -> 45% -> 0% while the job
     reported success every run. The range is walked in chunks small enough to come
     back whole. ?only=recent runs just the actuals window, for an hourly pass.
     Rollback: _ROLLBACK/fmp-economic.v7.ORIGINAL.ts on Alan's Mac.
     --------------------------------------------------------------------------- */
  async function calWindow(fromISO:string,toISO:string){
    const cal=await fmp('economic-calendar?from='+fromISO+'&to='+toISO,K)
    if(!cal||!cal.length)return 0
    const seen=new Set()
    const crows=cal.filter((x:any)=>x&&x.date&&x.event&&x.country).map((x:any)=>{const ts=Math.floor(new Date(String(x.date).replace(' ','T')+'Z').getTime()/1000);return {event_ts:ts,country:String(x.country),event:String(x.event),actual:num(x.actual),previous:num(x.previous),estimate:num(x.estimate),impact:x.impact||null,updated_ts:now}}).filter((r:any)=>{if(!r.event_ts||isNaN(r.event_ts))return false;const k=r.event_ts+'|'+r.country+'|'+r.event;if(seen.has(k))return false;seen.add(k);return true})
    if(!crows.length)return 0
    const {error}=await sb.from('econ_calendar').upsert(crows,{onConflict:'event_ts,country,event'})
    if(error)throw new Error(error.message)
    return crows.length
  }
  async function calRange(fromDays:number,toDays:number,step:number){
    let n=0
    for(let d=fromDays;d<toDays;d+=step) n+=await calWindow(dt(d),dt(Math.min(d+step,toDays)))
    return n
  }
  try{ counts.cal_recent=await calRange(-9,3,3) }catch(e){errs.push('calendar recent: '+String((e as any)&&(e as any).message||e))}
  if(_only!=='recent'){
    try{ counts.cal_near=await calRange(3,24,7) }catch(e){errs.push('calendar near: '+String((e as any)&&(e as any).message||e))}
    try{ counts.cal_far=await calWindow(dt(24),dt(150)) }catch(e){errs.push('calendar far: '+String((e as any)&&(e as any).message||e))}
  }
  counts.calendar=(counts.cal_recent||0)+(counts.cal_near||0)+(counts.cal_far||0)
  counts.mode=_only||'full'
  await sb.from('app_config').upsert({key:'econ_busy',value:'0'},{onConflict:'key'})
  try{ await sb.from('fmp_bandwidth_log').insert({fn:'fmp-economic',calls:_calls,symbols:0,bytes:_bytes,status:errs.length?207:200,at:new Date().toISOString()}) }catch(_){/* logging must never break the run */}
  return J({counts,errs,calls:_calls,bytes:_bytes})
}catch(e){return J({error:String((e as any)&&(e as any).message||e)})}})
