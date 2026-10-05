// fmp-analyst v9 — 2026-08-17 EMPTY-UNIVERSE REPAIR (BIG SPRINT CONTINUATION 002 §D).
// WAS: universe = composite_staged tf='D' — a VOLATILE derived table that refresh_geiger
// drains whenever ribbon momentum goes stale (>4h), so this job ran on an EMPTY universe
// and wrote nothing while consuming its cron slot (analyst_estimates stale 133h).
// NOW: universe = public.tickers where active (the explicit, stable 366-symbol map),
// equities only. Everything else — sinks, dedupe, attribution log — unchanged.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const SB_URL=Deno.env.get('SUPABASE_URL')||''
const SB_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
const J=(o:any)=>new Response(JSON.stringify(o),{headers:{'Content-Type':'application/json'}})
const num=(v:any)=>(v==null||v===''||isNaN(+v))?null:+v
const pick=(o:any,ks:string[])=>{for(const k of ks){if(o&&o[k]!=null)return o[k]}return null}
let _calls=0,_bytes=0
async function fmp(path:string,k:string){try{const r=await fetch('https://financialmodelingprep.com/stable/'+path+(path.includes('?')?'&':'?')+'apikey='+k);_calls++;if(!r.ok)return null;const txt=await r.text();_bytes+=txt.length;const j=JSON.parse(txt);return Array.isArray(j)?j:null}catch(_){return null}}
const SLICE=30
Deno.serve(async (req)=>{try{
  _calls=0;_bytes=0
  const u=new URL(req.url)
  const sb=createClient(SB_URL,SB_KEY)
  const now=Math.floor(Date.now()/1000)
  const {data:cfg,error:ce}=await sb.from('app_config').select('key,value').in('key',['analyst_busy','analyst_offset','FMP_KEY'])
  if(ce)throw new Error('app_config: '+ce.message)
  const C:any={};for(const r of (cfg||[]))C[r.key]=r.value
  const K=(C['FMP_KEY']||'').trim();if(!K)throw new Error('no FMP_KEY')
  const busy=parseInt(C['analyst_busy']||'0',10)
  if(now-busy<180&&!u.searchParams.get('force'))return J({skipped:'busy'})
  await sb.from('app_config').upsert({key:'analyst_busy',value:''+now},{onConflict:'key'})
  // v9: explicit stable universe. tickers.active is the frozen Hub map, never drained by derives.
  // ADMISSION V2 (27 Sep): the same list minus geiger-only names (Alan: they "don't need analysts or
  // financials"). fmp_full_universe applies the type and *USD exclusions below as well; kept for safety.
  const {data:tk,error:te}=await sb.from('fmp_full_universe').select('ticker')
  if(te)throw new Error('universe: '+te.message)
  const eq=[...new Set((tk||[]).filter((x:any)=>!['crypto','future','index'].includes(x.type||'')).map((x:any)=>''+x.ticker))].filter(t=>!t.endsWith('USD')).sort()
  if(eq.length===0)throw new Error('universe EMPTY - refusing to run silently')
  const L=Math.max(eq.length,1)
  const offP=u.searchParams.get('offset')
  const off=((offP!=null?parseInt(offP,10):parseInt(C['analyst_offset']||'0',10))%L+L)%L
  let slice=eq.slice(off,off+SLICE);if(slice.length<SLICE&&eq.length>SLICE)slice=slice.concat(eq.slice(0,SLICE-slice.length))
  if(offP==null)await sb.from('app_config').upsert({key:'analyst_offset',value:''+((off+SLICE)%L)},{onConflict:'key'})
  const counts:any={est:0,ratings:0,ptc:0};const errs:string[]=[]
  async function doT(t:string){
   try{
    const [ea,eqr,gr,pt]=await Promise.all([
      fmp('analyst-estimates?symbol='+t+'&period=annual&limit=40',K),
      fmp('analyst-estimates?symbol='+t+'&period=quarter&limit=120',K),
      fmp('grades-consensus?symbol='+t,K),
      fmp('price-target-consensus?symbol='+t,K)
    ])
    const p0=(pt&&pt[0])||null
    const mk=(arr:any[],period:string)=>(arr||[]).filter((x:any)=>x.date).map((x:any)=>({ticker:t,period,fiscal_date:''+x.date,est_eps_avg:num(x.epsAvg),est_eps_high:num(x.epsHigh),est_eps_low:num(x.epsLow),est_revenue_avg:num(x.revenueAvg),est_ebitda_avg:num(x.ebitdaAvg),est_ebit_avg:num(x.ebitAvg),est_net_income_avg:num(x.netIncomeAvg),num_analysts_eps:num(x.numAnalystsEps),num_analysts_rev:num(pick(x,['numAnalystsRevenue','numAnalystsRev'])),price_target_avg:p0?num(p0.targetConsensus):null,updated_ts:now}))
    const rows=[...mk(ea||[],'annual'),...mk(eqr||[],'quarter')]
    const s=new Set();const ded=rows.filter(r=>{const k=r.period+'|'+r.fiscal_date;if(s.has(k))return false;s.add(k);return true})
    if(ded.length){await sb.from('analyst_estimates').delete().eq('ticker',t);const {error}=await sb.from('analyst_estimates').upsert(ded,{onConflict:'ticker,period,fiscal_date'});if(error)throw new Error('est '+error.message);counts.est+=ded.length}
    const g=(gr&&gr[0])||null
    if(g){const sbn=num(g.strongBuy)??0,b=num(g.buy)??0,h=num(g.hold)??0,sl=num(g.sell)??0,ss=num(g.strongSell)??0;const n=sbn+b+h+sl+ss
      const score=n>0?(5*sbn+4*b+3*h+2*sl+1*ss)/n:null
      const {error}=await sb.from('analyst_ratings').upsert({ticker:t,consensus:g.consensus||null,rating_score:score,strong_buy:sbn,buy:b,hold:h,sell:sl,strong_sell:ss,updated_ts:now},{onConflict:'ticker'});if(error)throw new Error('rat '+error.message);counts.ratings++}
    if(p0){const {error}=await sb.from('price_target_consensus').upsert({ticker:t,target_high:num(p0.targetHigh),target_low:num(p0.targetLow),target_avg:num(p0.targetConsensus),target_median:num(p0.targetMedian),updated_ts:now},{onConflict:'ticker'});if(error)throw new Error('ptc '+error.message);counts.ptc++}
   }catch(e){errs.push(t+': '+String((e as any)&&(e as any).message||e))}
  }
  for(let i=0;i<slice.length;i+=5){await Promise.all(slice.slice(i,i+5).map(doT))}
  await sb.from('app_config').upsert({key:'analyst_busy',value:'0'},{onConflict:'key'})
  try{ await sb.from('fmp_bandwidth_log').insert({fn:'fmp-analyst',calls:_calls,symbols:slice.length,bytes:_bytes,status:200,at:new Date().toISOString()}) }catch(_){}
  return J({off,n:slice.length,universe:eq.length,counts,errs:errs.slice(0,5),calls:_calls,bytes:_bytes})
}catch(e){return J({error:String((e as any)&&(e as any).message||e)})}})
