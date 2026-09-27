import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const SB_URL=Deno.env.get('SUPABASE_URL')||''
const SB_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
const J=(o:any)=>new Response(JSON.stringify(o),{headers:{'Content-Type':'application/json'}})
const num=(v:any)=>(v==null||v===''||isNaN(+v))?null:+v
const dstr=(v:any)=>(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v))?v.slice(0,10):null
const dt=(days:number)=>{const d=new Date(Date.now()+days*86400000);return d.toISOString().slice(0,10)}
let _calCalls=0,_calBytes=0,_perCalls=0,_perBytes=0
async function fmpCal(path:string,k:string){try{const r=await fetch('https://financialmodelingprep.com/stable/'+path+(path.includes('?')?'&':'?')+'apikey='+k);_calCalls++;if(!r.ok)return null;const txt=await r.text();_calBytes+=txt.length;const j=JSON.parse(txt);return Array.isArray(j)?j:null}catch(_){return null}}
async function fmpPer(path:string,k:string){try{const r=await fetch('https://financialmodelingprep.com/stable/'+path+(path.includes('?')?'&':'?')+'apikey='+k);_perCalls++;if(!r.ok)return null;const txt=await r.text();_perBytes+=txt.length;const j=JSON.parse(txt);return Array.isArray(j)?j:null}catch(_){return null}}
const SLICE=30
// SUPPRESSION LOOKUP - COMPLETE OR NOTHING. recovery_earnings_archive holds (ticker, original_date) pairs that were removed after a
// per-case review against the company's own release (KR 2026-09-10, NIO 2026-09-09, MU 2026-09-22 ...). This writer creates a
// row for every date the provider lists, so it may write earnings rows ONLY when it knows every archived date of the tickers
// it is about to write. The lookup is bounded by those tickers, read in pages, and counted against the server's own exact
// row count - a page cut short by the API's max-rows setting is simply followed by the next one, and "limit N" is never
// taken to mean "all". Any error, timeout, missing count or short read = ok:false, and the caller writes NO earnings row.
async function archivedDates(sb:any,tickers:string[]):Promise<{ok:boolean,set:Set<string>,rows:number,why?:string}>{
  const set=new Set<string>(); let rows=0
  try{
    for(let i=0;i<tickers.length;i+=100){
      const chunk=tickers.slice(i,i+100); let from=0
      for(let page=0;;page++){
        if(page>=400) return {ok:false,set,rows,why:'archive lookup did not finish within 400 pages'}
        const {data,error,count}=await sb.from('recovery_earnings_archive').select('ticker,original_date',{count:'exact'}).in('ticker',chunk)
          .order('ticker',{ascending:true}).order('original_date',{ascending:true}).order('id',{ascending:true}).range(from,from+499).abortSignal(AbortSignal.timeout(8000))
        if(error) return {ok:false,set,rows,why:'archive read: '+String(error.message||error).slice(0,160)}
        if(!Array.isArray(data)||typeof count!=='number') return {ok:false,set,rows,why:'archive read returned no exact row count'}
        for(const r of data){ set.add(String(r.ticker).toUpperCase()+'|'+String(r.original_date).slice(0,10)); rows++ }
        from+=data.length
        if(from>=count) break
        if(!data.length) return {ok:false,set,rows,why:'archive read stopped at '+from+' of '+count+' rows'}
      }
    }
    return {ok:true,set,rows}
  }catch(e){ return {ok:false,set,rows,why:'archive read: '+String((e as any)&&(e as any).message||e).slice(0,160)} }
}
Deno.serve(async (req)=>{try{
  _calCalls=0;_calBytes=0;_perCalls=0;_perBytes=0 // CC-BOARD-003 C2: reset per invocation so fmp_bandwidth_log rows are accurate per run
  const u=new URL(req.url)
  const sb=createClient(SB_URL,SB_KEY)
  const now=Math.floor(Date.now()/1000)
  const {data:cfg,error:ce}=await sb.from('app_config').select('key,value').in('key',['events_busy','events_offset','FMP_KEY'])
  if(ce)throw new Error('app_config: '+ce.message)
  const C:any={};for(const r of (cfg||[]))C[r.key]=r.value
  const K=(C['FMP_KEY']||'').trim();if(!K)throw new Error('no FMP_KEY')
  const busy=parseInt(C['events_busy']||'0',10)
  if(now-busy<180&&!u.searchParams.get('force'))return J({skipped:'busy'})
  await sb.from('app_config').upsert({key:'events_busy',value:''+now},{onConflict:'key'})
  const {data:tk,error:te}=await sb.from('composite_staged').select('ticker').eq('tf','D')
  if(te)throw new Error('universe: '+te.message)
  const eq=[...new Set((tk||[]).map((x:any)=>''+x.ticker))].filter(t=>!t.endsWith('USD')).sort()
  const L=Math.max(eq.length,1)
  const offP=u.searchParams.get('offset')
  const off=((offP!=null?parseInt(offP,10):parseInt(C['events_offset']||'0',10))%L+L)%L
  let slice=eq.slice(off,off+SLICE);if(slice.length<SLICE&&eq.length>SLICE)slice=slice.concat(eq.slice(0,SLICE-slice.length))
  if(offP==null)await sb.from('app_config').upsert({key:'events_offset',value:''+((off+SLICE)%L)},{onConflict:'key'})
  const counts:any={earnings:0,dividends:0,splits:0};const errs:string[]=[]
  const review:any={not_in_provider_list:[],same_result_twins:[],archived_dates_skipped:[],read_errors:[],suppression:null}
  // v10: NO EARNINGS ROW IS WRITTEN WITHOUT A COMPLETE SUPPRESSION LOOKUP (fail closed). The lookup covers exactly the tickers this
  // run can write - the universe, which bounds both the calendar answer and the slice. If it fails, the calendar call, every
  // per-symbol earnings call, every earnings upsert and the date review are skipped and the failure is reported in errs and in
  // date_review.suppression; dividends and splits, which the archive does not concern, carry on as before.
  const sup=await archivedDates(sb,eq)
  const tomb=sup.set
  review.suppression=sup.ok?{ok:true,rows:sup.rows,tickers:eq.length}:{ok:false,why:sup.why}
  if(!sup.ok)errs.push('SUPPRESSION LOOKUP FAILED - no earnings row written this run: '+sup.why)
  // v10 2026-09-18 - A VALUE THE PROVIDER DOES NOT CARRY IS NOT WRITTEN. v9 sent every column on every row, so a lagging provider
  // (epsActual null for days after a release) blanked actuals another writer had already captured from the press release or
  // the 8-K, and a missing estimate blanked the stored one. A row now carries only the fields the provider actually has
  // (0 is a value, null/'' is not); surprise_pct only when this answer can compute it. A provider CORRECTION (a different
  // non-null actual) is still written, as before. No read-modify-write: nothing is read first, so there is no window in
  // which a concurrent catcher's write could be lost - the statement simply does not name the columns it has nothing for.
  const mkE=(arr:any[],t?:string)=>arr.filter((x:any)=>dstr(x.date)&&(t||x.symbol)).map((x:any)=>{const ea=num(x.epsActual),ee=num(x.epsEstimated),ra=num(x.revenueActual),re=num(x.revenueEstimated)
    const row:any={ticker:t||x.symbol,date:dstr(x.date),updated_ts:now}
    if(ea!=null)row.eps_actual=ea
    if(ee!=null)row.eps_estimate=ee
    if(ra!=null)row.revenue_actual=ra
    if(re!=null)row.revenue_estimate=re
    if(ea!=null&&ee!=null&&ee!==0)row.surprise_pct=(ea-ee)/Math.abs(ee)*100
    return row})
  // PostgREST fills a key that is missing from SOME rows of one bulk request with NULL, which would undo the above. Rows are
  // therefore sent in groups that share exactly the same columns - one upsert per shape (a handful), same conflict key.
  const upE=async(rows:any[])=>{const s=new Set();const ded=rows.filter((r:any)=>{const k=r.ticker+'|'+r.date;if(s.has(k))return false;s.add(k);if(tomb.has(k)){review.archived_dates_skipped.push({ticker:r.ticker,date:r.date});return false};return true});if(!ded.length)return 0
    const shapes=new Map<string,any[]>();for(const r of ded){const k=Object.keys(r).sort().join(',');if(!shapes.has(k))shapes.set(k,[]);shapes.get(k)!.push(r)}
    for(const group of shapes.values()){const {error}=await sb.from('earnings_events').upsert(group,{onConflict:'ticker,date'});if(error)throw new Error('earn '+error.message)}
    return ded.length}
  try{const cal=sup.ok?await fmpCal('earnings-calendar?from='+dt(-7)+'&to='+dt(21),K):null
    if(cal){const setU=new Set(eq);counts.earnings+=await upE(mkE(cal.filter((x:any)=>setU.has(x.symbol))))}
  }catch(e){errs.push('cal: '+String((e as any)&&(e as any).message||e))}
  // v10 2026-09-18 - REPORT ONLY: this block reads; it never writes, archives, moves or deletes. Identity in this table is
  // (ticker,date), so when the provider moves a projected report date the upsert above creates a NEW row and the old one
  // stays (MU 09-22/09-30, NKE 09-29/10-01, NIO 09-09/09-01, FDX 09-17/10-28; KR 09-10/09-11 even carries the same result
  // twice). A date missing from one provider answer proves neither that the event was abandoned nor which fiscal period a
  // row belongs to, and near dates can be distinct events (CRDO 2022-03-09/10, PSA 2023-05-03/04). So the rows are only
  // LISTED in the response for a reviewer, who corrects each case against the company's own release (date + fiscal period).
  const look=async(t:string,er:any[])=>{
    const live=new Set(er.map((x:any)=>dstr(x.date)).filter(Boolean) as string[])
    const {data:rows,error}=await sb.from('earnings_events').select('date,eps_actual,revenue_actual,confirmed').eq('ticker',t).gte('date',dt(-120)).lte('date',dt(400))
    if(error){review.read_errors.push(t+': '+error.message);return}
    const near=(x:string)=>[...live].filter((y)=>Math.abs(Date.parse(y)-Date.parse(x))<=45*86400000).sort()
    for(const r of (rows||[]))if(r.eps_actual==null&&r.revenue_actual==null&&!live.has(r.date))
      review.not_in_provider_list.push({ticker:t,date:r.date,confirmed:r.confirmed??null,provider_dates_within_45d:near(r.date),provider_rows:er.length})
    const done=(rows||[]).filter((r:any)=>r.eps_actual!=null)
    for(const a of done)for(const b of done)if(a.date<b.date&&a.eps_actual===b.eps_actual&&a.revenue_actual===b.revenue_actual&&
      Date.parse(b.date)-Date.parse(a.date)<=7*86400000)review.same_result_twins.push({ticker:t,dates:[a.date,b.date],in_provider_list:[live.has(a.date),live.has(b.date)]})
  }
  async function doT(t:string){
   try{
    const [er,dv,sp]=await Promise.all([sup.ok?fmpPer('earnings?symbol='+t+'&limit=80',K):Promise.resolve(null),fmpPer('dividends?symbol='+t+'&limit=300',K),fmpPer('splits?symbol='+t+'&limit=100',K)])
    if(er&&er.length){counts.earnings+=await upE(mkE(er,t));try{await look(t,er)}catch(e){review.read_errors.push(t+': '+String(e))}}
    if(dv&&dv.length){const rows=dv.filter((x:any)=>dstr(x.date)).map((x:any)=>({ticker:t,date:dstr(x.date),amount:num(x.adjDividend!=null?x.adjDividend:x.dividend),record_date:dstr(x.recordDate),payment_date:dstr(x.paymentDate),declaration_date:dstr(x.declarationDate),yield_pct:num(x.yield),frequency:x.frequency||null,updated_ts:now}))
      const s=new Set();const ded=rows.filter((r:any)=>{if(s.has(r.date))return false;s.add(r.date);return true})
      if(ded.length){await sb.from('dividends').delete().eq('ticker',t);const {error}=await sb.from('dividends').upsert(ded,{onConflict:'ticker,date'});if(error)throw new Error('div '+error.message);counts.dividends+=ded.length}}
    if(sp&&sp.length){const rows=sp.filter((x:any)=>dstr(x.date)).map((x:any)=>({ticker:t,date:dstr(x.date),numerator:num(x.numerator),denominator:num(x.denominator),updated_ts:now}))
      const s=new Set();const ded=rows.filter((r:any)=>{if(s.has(r.date))return false;s.add(r.date);return true})
      if(ded.length){await sb.from('splits').delete().eq('ticker',t);const {error}=await sb.from('splits').upsert(ded,{onConflict:'ticker,date'});if(error)throw new Error('spl '+error.message);counts.splits+=ded.length}}
   }catch(e){errs.push(t+': '+String((e as any)&&(e as any).message||e))}
  }
  for(let i=0;i<slice.length;i+=6){await Promise.all(slice.slice(i,i+6).map(doT))}
  await sb.from('app_config').upsert({key:'events_busy',value:'0'},{onConflict:'key'})
  try{
    await sb.from('fmp_bandwidth_log').insert({fn:'fmp-events-calendar',calls:_calCalls,symbols:eq.length,bytes:_calBytes,status:200,at:new Date().toISOString()})
    await sb.from('fmp_bandwidth_log').insert({fn:'fmp-events-persym',calls:_perCalls,symbols:slice.length,bytes:_perBytes,status:200,at:new Date().toISOString()})
  }catch(_){}
  return J({off,n:slice.length,counts,errs,date_review:review,calCalls:_calCalls,perCalls:_perCalls,bytes:_calBytes+_perBytes})
}catch(e){return J({error:String((e as any)&&(e as any).message||e)})}})
