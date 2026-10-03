import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { planSlice, fmpSymbolMap } from '../_shared/loader-slice.mjs'   // F1 (3 Oct): newcomers first, bounded; tickers.fmp_symbol honoured
const SB_URL=Deno.env.get('SUPABASE_URL')||''
const SB_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
const J=(o:any)=>new Response(JSON.stringify(o),{headers:{'Content-Type':'application/json'}})
const num=(v:any)=>(v==null||v===''||isNaN(+v))?null:+v
const pick=(o:any,ks:string[])=>{for(const k of ks){if(o&&o[k]!=null)return o[k]}return null}
let _calls=0,_bytes=0
async function fmp(path:string,k:string){try{const r=await fetch('https://financialmodelingprep.com/stable/'+path+'&apikey='+k);_calls++;if(!r.ok)return null;const txt=await r.text();_bytes+=txt.length;const j=JSON.parse(txt);return Array.isArray(j)?j:null}catch(_){return null}}
const SLICE=10
Deno.serve(async (req)=>{try{
  _calls=0;_bytes=0 // CC-BOARD-003 C2: reset per invocation so fmp_bandwidth_log gets one accurate row per run
  const u=new URL(req.url)
  const sb=createClient(SB_URL,SB_KEY)
  const now=Math.floor(Date.now()/1000)
  const {data:cfg,error:ce}=await sb.from('app_config').select('key,value').in('key',['fund_busy','fund_offset','FMP_KEY'])
  if(ce)throw new Error('app_config: '+ce.message)
  const C:any={};for(const r of (cfg||[]))C[r.key]=r.value
  const K=(C['FMP_KEY']||'').trim();if(!K)throw new Error('no FMP_KEY')
  const busy=parseInt(C['fund_busy']||'0',10)
  if(now-busy<180&&!u.searchParams.get('force')&&!u.searchParams.get('sym'))return J({skipped:'busy'})
  await sb.from('app_config').upsert({key:'fund_busy',value:''+now},{onConflict:'key'})
  const symP=(u.searchParams.get('sym')||u.searchParams.get('symbols')||'').toUpperCase().trim()
  let slice:string[]
  let off=0
  if(symP){ slice=symP.split(',').map(s=>s.trim()).filter(Boolean) }
  else {
    // ADMISSION V2 (27 Sep): the full-treatment list, not composite_staged (frozen at 386 names since
    // 24 Aug, so a newly admitted name never got fundamentals). Geiger-only names are skipped by design.
    const {data:tk,error:te}=await sb.from('fmp_full_universe').select('ticker')
    if(te)throw new Error('universe: '+te.message)
    const eq=[...new Set((tk||[]).map((x:any)=>''+x.ticker))].filter(t=>!t.endsWith('USD')).sort()
    const L=Math.max(eq.length,1)
    const offP=u.searchParams.get('offset')
    off=((offP!=null?parseInt(offP,10):parseInt(C['fund_offset']||'0',10))%L+L)%L
    if(offP!=null){slice=eq.slice(off,off+SLICE);if(slice.length<SLICE&&eq.length>SLICE)slice=slice.concat(eq.slice(0,SLICE-slice.length))}
    else{
      // F1 (3 Oct): a company with no statements yet goes first (at most 5 a run, rotated), then the old round-robin. Measured 3 Oct:
      // 70 of the 104 names admitted 28 Sep had none (a lap of this loader is ~13 days). Funds are never newcomers (no statements).
      const [{data:hv},{data:ty}]=await Promise.all([sb.from('fundamentals').select('ticker').not('revenue_ttm','is',null),sb.from('tickers').select('ticker,type').in('ticker',eq)])
      const plan=planSlice({universe:eq,have:new Set((hv||[]).map((r:any)=>r.ticker)),newcomerPool:(ty||[]).filter((r:any)=>r.type!=='etf').map((r:any)=>r.ticker),offset:off,size:SLICE,cap:5})
      slice=plan.slice
      await sb.from('app_config').upsert({key:'fund_offset',value:''+plan.next},{onConflict:'key'})
    }
  }
  const {data:fsr}=await sb.from('tickers').select('ticker,fmp_symbol').in('ticker',slice);const FSY=fmpSymbolMap(fsr||[])   // F1: MOG.A → MOG-A
  // PRICE COMES FROM THE PROVIDER QUOTE, NOT THE RETIRED live_quotes LANE.
  // live_quotes equity rows stopped being written at the provider cutover (last 2026-08-18), so every
  // fundamentals.price and the trailing P/E derived from it were a month old while carrying a fresh
  // updated_ts (MEASURED 2026-09-18: AAPL 310.3 vs provider 336; Station /analytics displayed the
  // stale multiple). The provider contract serves the current price for every provider-owned equity;
  // a symbol the provider does not price is left WITHOUT a price (null), never given a stale one.
  const PX:any={}
  try{
    const qr=await fetch('https://scintilla-massive-chart-api.fly.dev/quotes?symbols='+encodeURIComponent(slice.join(',')),{signal:AbortSignal.timeout(20000)})
    if(qr.ok){const qj=await qr.json();for(const [t,q] of Object.entries((qj&&qj.quotes)||{}) as any){if(q&&q.state==='OK'&&q.price!=null&&isFinite(+q.price)&&+q.price>0)PX[t]=+q.price}}
  }catch(_){/* no price rather than a retired one */}
  const counts:any={fh:0,bh:0,ch:0,rh:0,fu:0};const errs:string[]=[]
  async function doT(t:string){
   try{
    const [ia,iq,ba,bq,ca,cq,ra,rq,ka,kq]=await Promise.all([
      fmp('income-statement?symbol='+FSY(t)+'&period=annual&limit=50',K),
      fmp('income-statement?symbol='+FSY(t)+'&period=quarter&limit=160',K),
      fmp('balance-sheet-statement?symbol='+FSY(t)+'&period=annual&limit=50',K),
      fmp('balance-sheet-statement?symbol='+FSY(t)+'&period=quarter&limit=160',K),
      fmp('cash-flow-statement?symbol='+FSY(t)+'&period=annual&limit=50',K),
      fmp('cash-flow-statement?symbol='+FSY(t)+'&period=quarter&limit=160',K),
      fmp('ratios?symbol='+FSY(t)+'&period=annual&limit=50',K),
      fmp('ratios?symbol='+FSY(t)+'&period=quarter&limit=160',K),
      fmp('key-metrics?symbol='+FSY(t)+'&period=annual&limit=50',K),
      fmp('key-metrics?symbol='+FSY(t)+'&period=quarter&limit=160',K)
    ])
    const inc=[...(ia||[]),...(iq||[])],bal=[...(ba||[]),...(bq||[])],cf=[...(ca||[]),...(cq||[])],rat=[...(ra||[]),...(rq||[])],km=[...(ka||[]),...(kq||[])]
    const KM:any={};for(const m of km)if(m.date)KM[m.date+'|'+m.period]=m
    const fhRows=inc.filter((x:any)=>x.date&&x.period).map((x:any)=>({ticker:t,fiscal_date:x.date,period:x.period,fiscal_year:parseInt(x.fiscalYear,10)||null,eps:num(x.eps),eps_diluted:num(x.epsDiluted),revenue:num(x.revenue),gross_profit:num(x.grossProfit),operating_income:num(x.operatingIncome),net_income:num(x.netIncome),ebitda:num(x.ebitda),shares_dil:num(pick(x,['weightedAverageShsOutDil','weightedAverageShsOut'])),updated_ts:now}))
    const bhRows=bal.filter((x:any)=>x.date&&x.period).map((x:any)=>({ticker:t,fiscal_date:x.date,period:x.period,fiscal_year:parseInt(x.fiscalYear,10)||null,total_assets:num(x.totalAssets),total_liabilities:num(x.totalLiabilities),total_equity:num(pick(x,['totalStockholdersEquity','totalEquity'])),cash_and_equiv:num(x.cashAndCashEquivalents),total_debt:num(x.totalDebt),net_debt:num(x.netDebt),current_assets:num(x.totalCurrentAssets),current_liabilities:num(x.totalCurrentLiabilities),inventory:num(x.inventory),goodwill_intangibles:num(x.goodwillAndIntangibleAssets),updated_ts:now}))
    const chRows=cf.filter((x:any)=>x.date&&x.period).map((x:any)=>{const ocf=num(pick(x,['netCashProvidedByOperatingActivities','operatingCashFlow']));const cap=num(pick(x,['investmentsInPropertyPlantAndEquipment','capitalExpenditure']));let fcf=num(x.freeCashFlow);if(fcf==null&&ocf!=null&&cap!=null)fcf=ocf+cap;return {ticker:t,fiscal_date:x.date,period:x.period,fiscal_year:parseInt(x.fiscalYear,10)||null,operating_cf:ocf,capex:cap,free_cf:fcf,dividends_paid:num(pick(x,['netDividendsPaid','commonDividendsPaid','dividendsPaid'])),buybacks:num(pick(x,['commonStockRepurchased','netCommonStockIssuance'])),debt_repayment:num(pick(x,['netDebtIssuance','debtRepayment'])),acquisitions:num(x.acquisitionsNet),stock_comp:num(x.stockBasedCompensation),net_change_cash:num(x.netChangeInCash),updated_ts:now}})
    const rhRows=rat.filter((x:any)=>x.date&&x.period).map((x:any)=>{const m=KM[x.date+'|'+x.period]||{};return {ticker:t,fiscal_date:x.date,period:x.period,pe:num(x.priceToEarningsRatio),pb:num(x.priceToBookRatio),ps:num(x.priceToSalesRatio),gross_margin:num(x.grossProfitMargin),operating_margin:num(x.operatingProfitMargin),net_margin:num(x.netProfitMargin),roe:num(m.returnOnEquity),debt_to_equity:num(x.debtToEquityRatio),dividend_yield:num(x.dividendYield),updated_ts:now}})
    const dedupe=(rows:any[])=>{const s=new Set();return rows.filter(r=>{const k=r.ticker+'|'+r.fiscal_date+'|'+r.period;if(s.has(k))return false;s.add(k);return true})}
    if(fhRows.length){await sb.from('fundamentals_history').delete().eq('ticker',t);const {error}=await sb.from('fundamentals_history').upsert(dedupe(fhRows),{onConflict:'ticker,fiscal_date,period'});if(error)throw new Error('fh '+error.message);counts.fh+=fhRows.length}
    if(bhRows.length){await sb.from('balance_history').delete().eq('ticker',t);const {error}=await sb.from('balance_history').upsert(dedupe(bhRows),{onConflict:'ticker,fiscal_date,period'});if(error)throw new Error('bh '+error.message);counts.bh+=bhRows.length}
    if(chRows.length){await sb.from('cashflow_history').delete().eq('ticker',t);const {error}=await sb.from('cashflow_history').upsert(dedupe(chRows),{onConflict:'ticker,fiscal_date,period'});if(error)throw new Error('ch '+error.message);counts.ch+=chRows.length}
    if(rhRows.length){await sb.from('ratios_history').delete().eq('ticker',t);const {error}=await sb.from('ratios_history').upsert(dedupe(rhRows),{onConflict:'ticker,fiscal_date,period'});if(error)throw new Error('rh '+error.message);counts.rh+=rhRows.length}
    const q4=(iq||[]).slice(0,4)
    const epsTtm=q4.length===4?q4.reduce((s:number,x:any)=>s+((num(x.epsDiluted)??num(x.eps))??0),0):((ia&&ia[0])?(num(ia[0].epsDiluted)??num(ia[0].eps)):null)
    const revTtm=q4.length===4?q4.reduce((s:number,x:any)=>s+(num(x.revenue)??0),0):((ia&&ia[0])?num(ia[0].revenue):null)
    const kmAll=km.filter((x:any)=>x.date).sort((a:any,b:any)=>a.date<b.date?1:-1)
    const mcap=kmAll.length?num(kmAll[0].marketCap):null
    const px=PX[t]??null
    // PROVENANCE (behaviour unchanged from v9; only the price source above changed):
    //  - price: provider quote (state OK) at run time, or NULL when the provider has none. NULL price is the only
    //    stored marker that trailing_pe below is a fallback.
    //  - trailing_pe WITH a provider price: price / trailing EPS (sum of the last four quarterly statements; their
    //    fiscal dates are in fundamentals_history), i.e. a multiple as of this run.
    //  - trailing_pe WITHOUT a provider price: FMP's own priceToEarningsRatio from rat[0]. rat = [annual..., quarterly...],
    //    so this is the latest ANNUAL ratios row (fiscal-year-end price / annual EPS, up to ~12 months old); only when
    //    FMP returns no annual rows is it the latest QUARTERLY row (quarterly EPS basis, not comparable). A fiscal-date
    //    multiple, never a current one.
    //  - market_cap: FMP key-metrics marketCap at the latest FISCAL PERIOD END (kmAll[0]), not a current value.
    //  - updated_ts: ingestion time of this run; it is neither a quote time nor a fiscal date.
    const tpe=(px!=null&&epsTtm)?px/epsTtm:((rat&&rat[0])?num(rat[0].priceToEarningsRatio):null)
    if(mcap!=null||epsTtm!=null||revTtm!=null||px!=null){const {error}=await sb.from('fundamentals').upsert({ticker:t,price:px,market_cap:mcap,trailing_pe:tpe,eps_ttm:epsTtm,revenue_ttm:revTtm,source:'fmp',updated_ts:now},{onConflict:'ticker'});if(error)throw new Error('fund '+error.message);counts.fu++}
   }catch(e){errs.push(t+': '+String((e as any)&&(e as any).message||e))}
  }
  for(let i=0;i<slice.length;i+=2){await Promise.all(slice.slice(i,i+2).map(doT))}
  await sb.from('app_config').upsert({key:'fund_busy',value:'0'},{onConflict:'key'})
  try{ await sb.from('fmp_bandwidth_log').insert({fn:'fmp-fundamentals',calls:_calls,symbols:slice.length,bytes:_bytes,status:200,at:new Date().toISOString()}) }catch(_){}
  return J({mode:symP?'sym':'offset',off,slice,counts,errs,calls:_calls,bytes:_bytes})
}catch(e){return J({error:String((e as any)&&(e as any).message||e)})}})
