import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const SB_URL=Deno.env.get('SUPABASE_URL')||''
const SB_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
const J=(o)=>new Response(JSON.stringify(o),{headers:{'Content-Type':'application/json'}})
const N=(v)=>{const x=+v;return isFinite(x)?x:null}
const dedup=(rows,keyf)=>{const s=new Set();return rows.filter(r=>{const k=keyf(r);if(s.has(k))return false;s.add(k);return true})}
// CC-BOARD-003 C2: st = per-invocation FMP bandwidth accounting (passed in, NOT module-level — warm isolates must not accumulate across runs)
async function fj(u,st){try{const r=await fetch(u);if(st)st.calls++;if(!r.ok){if(st)st.errs++;return null}const txt=await r.text();if(st)st.bytes+=txt.length;return JSON.parse(txt)}catch(_){return null}}
async function chunked(arr,n,fn){for(let i=0;i<arr.length;i+=n){await Promise.all(arr.slice(i,i+n).map(fn))}}
Deno.serve(async (req)=>{
  const job=new URL(req.url).searchParams.get('job')||'globals'
  const sb=createClient(SB_URL,SB_KEY)
  const {data:cfg}=await sb.from('app_config').select('value').eq('key','FMP_KEY').maybeSingle()
  const K=(cfg&&cfg.value)?cfg.value.trim():''
  if(!K)return J({error:'no FMP key'})
  const base='https://financialmodelingprep.com/stable'
  const now=Math.floor(Date.now()/1000)
  // ?sym=X single-ticker mode: restrict the whole run (and its per-ticker deletes) to one symbol.
  const symParam=(new URL(req.url).searchParams.get('sym')||'').toUpperCase().trim()
  let eq
  if(symParam){eq=[symParam]}
  // ADMISSION V2 (27 Sep): the full-treatment list, not composite_staged (frozen at 386 names since 24 Aug).
  else{const {data:tk}=await sb.from('fmp_full_universe').select('ticker');eq=((tk||[]).map((x)=>x.ticker)).filter((t)=>!(''+t).endsWith('USD'))}
  const out={job,sym:symParam||null,wrote:0,errors:[]}
  const st={calls:0,bytes:0,errs:0} // CC-BOARD-003 C2: FMP bandwidth accounting (per invocation)
  try{
  if(job==='treasury'||job==='globals'){
    const a=await fj(base+'/treasury-rates?apikey='+K,st)
    if(Array.isArray(a)){const rows=dedup(a.slice(0,400).map(d=>({date:d.date,m1:N(d.month1),m2:N(d.month2),m3:N(d.month3),m6:N(d.month6),y1:N(d.year1),y2:N(d.year2),y3:N(d.year3),y5:N(d.year5),y7:N(d.year7),y10:N(d.year10),y20:N(d.year20),y30:N(d.year30),updated_ts:now})),r=>r.date)
      await sb.from('treasury_rates').delete().neq('date','1900-01-01');const {error}=await sb.from('treasury_rates').insert(rows);if(error)out.errors.push('treasury:'+error.message);else out.wrote+=rows.length}
  }
  if(job==='econ'||job==='globals'){
    const series=['CPI','GDP','realGDP','unemploymentRate','federalFunds','inflationRate','retailSales','consumerSentiment']
    let rows=[]
    for(const s of series){const a=await fj(base+'/economic-indicators?name='+s+'&apikey='+K,st);if(Array.isArray(a))for(const d of a.slice(0,60))rows.push({series:s,date:d.date,value:N(d.value),source:'FMP',updated_ts:now})}
    rows=dedup(rows,r=>r.series+'|'+r.date)
    if(rows.length){await sb.from('econ_history').delete().in('series',series);const {error}=await sb.from('econ_history').insert(rows);if(error)out.errors.push('econ:'+error.message);else out.wrote+=rows.length}
  }
  if(job==='ratings'){
    const rows=[]
    await chunked(eq,10,async(t)=>{const a=await fj(base+'/grades-consensus?symbol='+t+'&apikey='+K,st);const d=Array.isArray(a)?a[0]:a;if(d&&d.symbol){const tot=(d.strongBuy||0)+(d.buy||0)+(d.hold||0)+(d.sell||0)+(d.strongSell||0)||1;const score=((d.strongBuy||0)*5+(d.buy||0)*4+(d.hold||0)*3+(d.sell||0)*2+(d.strongSell||0))/tot;rows.push({ticker:d.symbol,consensus:d.consensus||null,rating_score:+score.toFixed(2),strong_buy:d.strongBuy||0,buy:d.buy||0,hold:d.hold||0,sell:d.sell||0,strong_sell:d.strongSell||0,updated_ts:now})}})
    const fr=dedup(rows,r=>r.ticker);if(fr.length){await sb.from('analyst_ratings').delete().in('ticker',eq);const {error}=await sb.from('analyst_ratings').insert(fr);if(error)out.errors.push('ratings:'+error.message);else out.wrote+=fr.length}
  }
  if(job==='targets'){
    const rows=[]
    await chunked(eq,10,async(t)=>{const a=await fj(base+'/price-target-consensus?symbol='+t+'&apikey='+K,st);const d=Array.isArray(a)?a[0]:a;if(d&&(d.symbol||d.targetConsensus!=null))rows.push({ticker:d.symbol||t,target_high:N(d.targetHigh),target_low:N(d.targetLow),target_avg:N(d.targetConsensus),target_median:N(d.targetMedian),num_analysts:null,updated_ts:now})})
    const fr=dedup(rows,r=>r.ticker);if(fr.length){await sb.from('price_target_consensus').delete().in('ticker',eq);const {error}=await sb.from('price_target_consensus').insert(fr);if(error)out.errors.push('targets:'+error.message);else out.wrote+=fr.length}
  }
  if(job==='profile'){
    // PROFILE REFRESH — NON-DESTRUCTIVE (candidate, lane profile-mcap-writer 2026-09-18).
    // Before: delete().in('ticker',eq) then insert(). That (a) removed every row in the universe even when the
    // provider answered for only some of them, and (b) nulled every column this job does not send (cik, is_adr,
    // is_fund, country, is_actively_trading, fmp_tags, etf_info, ir_url), which other functions own.
    // Now: upsert on ticker, sending ONLY the columns this job sources from the provider profile. A symbol the
    // provider does not answer for, or answers without a positive marketCap, is SKIPPED: its stored row and its
    // stored updated_ts are left exactly as they were, so updated_ts stays the source time of market_cap and an
    // unrefreshed row keeps reading as old. Nothing is deleted. live_quotes is not touched by this job.
    // Row key is the Scintilla ticker (t); the provider is asked for tickers.fmp_symbol when one is set
    // (e.g. BRK.A -> BRK-A), instead of keying the row on the provider's own symbol string.
    const {data:tkm}=await sb.from('tickers').select('ticker,fmp_symbol').in('ticker',eq)
    const FS={};for(const r of (tkm||[]))if(r&&r.fmp_symbol)FS[r.ticker]=r.fmp_symbol
    // N(null) is 0 in this file (+null===0). A provider null must never be stored as the number 0, so this branch
    // uses NN: null/''/non-finite -> null.
    const NN=(v)=>(v==null||v==='')?null:N(v)
    const rows=[];let noProfile=0,noCap=0
    await chunked(eq,8,async(t)=>{
      const a=await fj(base+'/profile?symbol='+encodeURIComponent(FS[t]||t)+'&apikey='+K,st)
      const d=Array.isArray(a)?a[0]:a
      if(!d||!d.symbol){noProfile++;return}
      const mc=NN(d.marketCap)
      if(mc==null||!(mc>0)){noCap++;return}
      const row={ticker:t,market_cap:mc,updated_ts:now}
      // optional fields are sent only when the provider supplied them, so an omitted field never blanks a stored one
      const put=(k,v)=>{if(v!=null&&v!=='')row[k]=v}
      put('price',NN(d.price));put('name',d.companyName);put('exchange',d.exchange||d.exchangeFullName);put('sector',d.sector);put('industry',d.industry)
      put('beta',NN(d.beta));put('avg_volume',NN(d.averageVolume??d.volAvg));put('last_div',NN(d.lastDividend??d.lastDiv))
      put('range_52wk',d.range);put('shares_out',NN(d.sharesOutstanding));put('ipo_date',d.ipoDate);put('website',d.website)
      put('description',(d.description||'').slice(0,1000))
      if(d.isEtf===true||d.isEtf===false)row.is_etf=d.isEtf
      rows.push(row)
    })
    out.profile_skipped={no_profile:noProfile,no_market_cap:noCap}
    const fr=dedup(rows,r=>r.ticker)
    // PostgREST bulk upsert requires every object to carry the same keys; rows differ in optional fields, so they
    // are written grouped by key-set (a handful of groups), never padded with nulls.
    const groups={};for(const r of fr){const k=Object.keys(r).sort().join(',');(groups[k]=groups[k]||[]).push(r)}
    for(const k of Object.keys(groups)){const {error}=await sb.from('company_profile').upsert(groups[k],{onConflict:'ticker'});if(error)out.errors.push('profile:'+error.message);else out.wrote+=groups[k].length}
  }
  if(job==='etf'){
    // F1 (3 Oct 2026) — FUND HOLDINGS. No job wrote etf_holdings after 22 Jul, so every served fund opened FINANCIALS → HOLDINGS on
    // "No etf_holdings rows … yet" (measured 3 Oct: 69 of 70 full-treatment funds). For each fund in the list (tickers.type = 'etf'):
    // the holdings are REPLACED only when FMP answered with at least one line (a failed or empty answer leaves the stored list as it
    // was), and etf_info is upserted with only the columns FMP supplied (the H8 facts other jobs own are never blanked).
    const {data:ty}=await sb.from('tickers').select('ticker,type,fmp_symbol').in('ticker',eq)
    const funds=(ty||[]).filter((r)=>r.type==='etf'),FS={};for(const r of funds)if(r.fmp_symbol)FS[r.ticker]=r.fmp_symbol
    const done={replaced:0,lines:0,no_answer:[]}
    await chunked(funds.map((r)=>r.ticker),4,async(t)=>{
      const sym=encodeURIComponent(FS[t]||t)
      const [h,i]=await Promise.all([fj(base+'/etf/holdings?symbol='+sym+'&apikey='+K,st),fj(base+'/etf/info?symbol='+sym+'&apikey='+K,st)])
      const seen=new Set(),rows=[]
      for(const x of (Array.isArray(h)?h:[])){const name=String(x.name||x.asset||'');if(!x.asset||!name||seen.has(name))continue;seen.add(name)
        rows.push({ticker:t,asset:x.asset,name,shares:N(x.sharesNumber),weight_pct:N(x.weightPercentage),market_value:N(x.marketValue),updated_ts:new Date().toISOString()})}
      if(rows.length){await sb.from('etf_holdings').delete().eq('ticker',t);const {error}=await sb.from('etf_holdings').insert(rows);if(error)out.errors.push('etf_holdings '+t+':'+error.message);else{done.replaced++;done.lines+=rows.length}}
      else done.no_answer.push(t)
      const d=Array.isArray(i)?i[0]:null
      if(d&&d.symbol){const row={ticker:t,updated_ts:new Date().toISOString()};const put=(k,v)=>{if(v!=null&&v!=='')row[k]=v}
        put('name',d.name);put('description',d.description);put('website',d.website);put('etf_company',d.etfCompany);put('expense_ratio',d.expenseRatio==null?null:N(d.expenseRatio))
        put('aum',d.assetsUnderManagement==null?null:N(d.assetsUnderManagement));put('avg_volume',d.avgVolume==null?null:N(d.avgVolume));put('inception_date',d.inceptionDate);put('nav',d.nav==null?null:N(d.nav))
        put('holdings_count',d.holdingsCount==null?null:N(d.holdingsCount));if(Array.isArray(d.sectorsList))row.sectors=d.sectorsList
        const {error}=await sb.from('etf_info').upsert(row,{onConflict:'ticker'});if(error)out.errors.push('etf_info '+t+':'+error.message)}
    })
    out.etf=done;out.wrote+=done.lines
  }
  if(job==='earnings'){
    const rows=[]
    await chunked(eq,8,async(t)=>{const a=await fj(base+'/earnings-calendar?symbol='+t+'&apikey='+K,st);if(Array.isArray(a))for(const d of a.slice(0,12)){const ee=N(d.epsEstimated);rows.push({ticker:d.symbol||t,date:d.date,eps_actual:N(d.epsActual),eps_estimate:ee,revenue_actual:N(d.revenueActual),revenue_estimate:N(d.revenueEstimated),surprise_pct:(d.epsActual!=null&&ee)?+(((+d.epsActual-ee)/Math.abs(ee))*100).toFixed(2):null,updated_ts:now})}})
    const fr=dedup(rows,r=>r.ticker+'|'+r.date);if(fr.length){await sb.from('earnings_events').delete().in('ticker',eq);const {error}=await sb.from('earnings_events').insert(fr);if(error)out.errors.push('earnings:'+error.message);else out.wrote+=fr.length}
  }
  if(job==='estimates'){
    const rows=[]
    await chunked(eq,8,async(t)=>{const a=await fj(base+'/analyst-estimates?symbol='+t+'&period=annual&limit=6&apikey='+K,st);if(Array.isArray(a))for(const d of a){rows.push({ticker:d.symbol||t,period:'annual',fiscal_date:d.date,est_eps_avg:N(d.epsAvg),est_eps_high:N(d.epsHigh),est_eps_low:N(d.epsLow),est_revenue_avg:N(d.revenueAvg),price_target_avg:null,est_ebitda_avg:N(d.ebitdaAvg),est_ebit_avg:N(d.ebitAvg),est_net_income_avg:N(d.netIncomeAvg),num_analysts_eps:N(d.numAnalystsEps),num_analysts_rev:N(d.numAnalystsRevenue),updated_ts:now})}})
    const fr=dedup(rows,r=>r.ticker+'|'+r.fiscal_date);if(fr.length){await sb.from('analyst_estimates').delete().in('ticker',eq);const {error}=await sb.from('analyst_estimates').insert(fr);if(error)out.errors.push('estimates:'+error.message);else out.wrote+=fr.length}
  }
  }catch(e){out.errors.push('fatal:'+String(e&&e.message||e))}
  if(st.calls){try{await sb.from('fmp_bandwidth_log').insert({fn:'fmp-backfill',calls:st.calls,symbols:eq.length,bytes:st.bytes,status:st.errs?207:200,at:new Date().toISOString()})}catch(_){/* logging must never break the run */}}
  return J(out)
})
