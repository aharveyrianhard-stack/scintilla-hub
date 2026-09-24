import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const SB_URL=Deno.env.get('SUPABASE_URL')||''
const SB_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
const d2=(x:any)=> x==null?'n/a':(+x).toFixed(2)
const p1=(x:any)=> x==null?'n/a':(Math.abs(+x)).toFixed(1)+'%'
const lab=(v:number)=> v>=0.5?'strongly bullish':v>=0.15?'bullish':v>-0.15?'neutral':v>-0.5?'bearish':'strongly bearish'
function parseDD(dd:string){
  const labels=['BUSINESS','SEGMENTS','MOAT','10YR FINANCIALS','BULL CASE','BEAR CASE','KEY RISKS','BULL','BEAR','NOW','CATALYSTS','SENTIMENT']
  const found=labels.map(l=>({l,i:dd.indexOf(l+':')})).filter(x=>x.i>=0).sort((a,b)=>a.i-b.i)
  const out:any={}
  for(let k=0;k<found.length;k++){const start=found[k].i+found[k].l.length+1; const end=k+1<found.length?found[k+1].i:dd.length; out[found[k].l]=dd.slice(start,end).trim()}
  return out
}
// ===== v13 2026-09-18: THE READ SPEAKS FROM THE SAME ACCEPTED GEIGER THE BOARD SHOWS, AND SAYS HOW OLD EVERYTHING ELSE IS =====
// composite_staged (tf D) is the retired legacy pipeline: its equity rows have not moved since 2026-08-24 (MEASURED
// 2026-09-18), yet this function re-stamped every verdict every ten minutes, so "the daily composite reads bullish at
// +0.30" was a month-old number wearing a fresh timestamp. The Hub board and company Geiger read the provider artifact
// (chart API /geiger) and accept it only under the rules in the Hub's geiger-authority-contract.js. This function now
// applies THE SAME acceptance rules (ported below, behaviour-identical; no Geiger value is computed here):
//   artifact  : HTTP 200 JSON; equalizer receipt + participating rungs + exclusions equal the CURRENT operator_weights
//               profile (deriveOperatorEqualizer / validateArtifactProfile); accounting failed=0 and no unexplained cell
//               (auditArtifactAccounting); symbol set equals the declared equity universe (tickers table, the exporter's
//               rule); scale SIGNED_-1_TO_+1; computed_utc parseable and not in the future.
//   symbol    : composite, trend AND momentum are finite numbers inside [-1,+1].
//   freshness : computed_utc is the provider's own compute time. The provider recomputes around the clock, so valid
//               off-hours readings are fresh and are used as-is. Older than 45 minutes (the Station's STALE rule for
//               provider /geiger) the reading is still the best one, but the rendered verdict SAYS how old it is.
// WHEN THE PROVIDER CANNOT BE USED the reason is kept distinct:
//   ABSENT      - the symbol is not a declared equity (crypto, futures, indices: the legacy composite is their approved
//                 owner), so the provider is never expected to carry it - in an outage too. The verdict is written from
//                 the legacy row and says so, with its date when stale.
//   UNAVAILABLE - outage, HTTP error, contract rejection, or a malformed symbol. The last provider-based verdict is
//                 RETAINED (marked, with its compute time, row timestamp preserved) whenever it is newer than the legacy
//                 row; only otherwise is the legacy row used, labelled with its age. A month-old legacy number never
//                 replaces a ten-minute-old provider reading, and never appears as a fresh unqualified read.
// Every supporting claim carries THIS TICKER's own source dates (never a newer peer's): regime_state rows by ticker,
// ribbon_signals TREND rows by ticker for the multi-timeframe summary (mtf_summary has no timestamp column), and the
// legacy daily composite date for the cohort comparison (recompute_cohort_divergence reads composite_staged tf D).
// ath_state/sr_tiers have no scheduled writer and a stale price basis (AAPL 305.26 vs 336 live) - that sentence is no
// longer written and those tables are no longer read. A 'basis' section records all of the above per ticker.
const GEIGER_URL='https://scintilla-massive-chart-api.fly.dev/geiger'
const GEIGER_STALE_MS=45*60*1000        // Station: spineAge(provider /geiger, 45*60)
const SOURCE_STALE_MS=24*3600*1000      // Hub READ tab: READ_STALE_MS
const FUTURE_SKEW_MS=60*1000
const HUB_PINNED_UNIVERSE_SHA256='ab8f7965258d939f0a97fbfeac9a271547c258df7a2616aff6ccff746bb5d9d3' // reported, not gating
const GLOBAL_OWNER_ID='00000000-0000-0000-0000-000000000000'
const NUL=String.fromCharCode(0)
const TIMEFRAME_TOKENS:any={'1m':'1m','3m':'3m','5m':'5m','10m':'10m','15m':'15','30m':'30','1h':'60','2h':'120','3h':'180','4h':'240','6h':'6h','12h':'12h','1d':'D','3d':'3D','1w':'W','2w':'2W','1M':'M'}
const TIMEFRAME_KEYS=Object.keys(TIMEFRAME_TOKENS)
const EXPECTED_KEYS:any={fam_handle:['0','1'],family:['MOMENTUM','TREND'],momentum:['RSI','WILLIAMS'],momentum_mix:['rsi','williams'],tf_handle:Array.from({length:17},(_:any,i:number)=>String(i)),timeframe:TIMEFRAME_KEYS}
const EXPECTED_ROW_COUNT=Object.values(EXPECTED_KEYS).reduce((n:number,k:any)=>n+k.length,0)
const ROW_FIELDS=['dim','enabled','key','owner_id','weight']
const ACTIVE_DIMENSIONS=new Set(['family','momentum_mix'])
const cmp=(a:any,b:any)=>a<b?-1:a>b?1:0
const sameArray=(a:any,b:any)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v:any,i:number)=>v===b[i])
function stableJson(v:any):string{
  if(Array.isArray(v))return '['+v.map(stableJson).join(',')+']'
  if(v&&typeof v==='object')return '{'+Object.keys(v).sort(cmp).map((k)=>JSON.stringify(k)+':'+stableJson(v[k])).join(',')+'}'
  return JSON.stringify(v)
}
async function sha256Hex(text:string){
  const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))
  return Array.from(new Uint8Array(d)).map((b)=>b.toString(16).padStart(2,'0')).join('')
}
async function deriveOperatorEqualizer(inputRows:any){
  if(!Array.isArray(inputRows))throw new Error('EQUALIZER_ROWS_NOT_ARRAY')
  if(inputRows.length!==EXPECTED_ROW_COUNT)throw new Error('EQUALIZER_ROW_COUNT_INVALID:found='+inputRows.length+';expected='+EXPECTED_ROW_COUNT)
  const expectedDims=Object.keys(EXPECTED_KEYS).sort(cmp); const seen=new Set()
  const rows=inputRows.map((input:any,index:number)=>{
    if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('EQUALIZER_ROW_NOT_OBJECT:'+index)
    if(!sameArray(Object.keys(input).sort(cmp),ROW_FIELDS))throw new Error('EQUALIZER_ROW_FIELDS_INVALID:'+index)
    if(typeof input.dim!=='string'||typeof input.key!=='string'||input.owner_id!==GLOBAL_OWNER_ID)throw new Error('EQUALIZER_ROW_IDENTITY_INVALID:'+index)
    if(typeof input.enabled!=='boolean')throw new Error('EQUALIZER_ENABLED_INVALID:'+input.dim+':'+input.key)
    if(typeof input.weight!=='number'||!Number.isFinite(input.weight)||input.weight<0||Object.is(input.weight,-0))throw new Error('EQUALIZER_WEIGHT_INVALID:'+input.dim+':'+input.key)
    const scaled=input.weight*1000000
    if(!Number.isSafeInteger(Math.round(scaled))||Math.abs(scaled-Math.round(scaled))>1e-6)throw new Error('EQUALIZER_WEIGHT_PRECISION_INVALID:'+input.dim+':'+input.key)
    const identity=input.dim+NUL+input.key
    if(seen.has(identity))throw new Error('EQUALIZER_ROW_DUPLICATE:'+input.dim+':'+input.key)
    seen.add(identity)
    return {dim:input.dim,key:input.key,weight:input.weight,enabled:input.enabled,owner_id:input.owner_id}
  })
  const actualDims=Array.from(new Set(rows.map((r:any)=>r.dim))).sort(cmp)
  if(!sameArray(actualDims,expectedDims))throw new Error('EQUALIZER_DIMENSIONS_INVALID')
  for(const dim of expectedDims){
    const actual=rows.filter((r:any)=>r.dim===dim).map((r:any)=>r.key).sort(cmp)
    if(!sameArray(actual,Array.from(EXPECTED_KEYS[dim]).sort(cmp)))throw new Error('EQUALIZER_KEYS_INVALID:'+dim)
  }
  for(const r of rows)if(ACTIVE_DIMENSIONS.has(r.dim)&&!r.enabled)throw new Error('EQUALIZER_ACTIVE_DIMENSION_DISABLED:'+r.dim+':'+r.key)
  const rowsFor=(dim:string)=>Object.fromEntries(rows.filter((r:any)=>r.dim===dim).map((r:any)=>[r.key,r]))
  const family:any=rowsFor('family'),mix:any=rowsFor('momentum_mix'),tfs:any=rowsFor('timeframe')
  if(!(Object.values(family).reduce((n:number,r:any)=>n+r.weight,0)>0))throw new Error('EQUALIZER_FAMILY_WEIGHT_SUM_ZERO')
  if(!(Object.values(mix).reduce((n:number,r:any)=>n+r.weight,0)>0))throw new Error('EQUALIZER_MOMENTUM_MIX_SUM_ZERO')
  const participating=TIMEFRAME_KEYS.filter((k)=>tfs[k].enabled&&tfs[k].weight>0).map((k)=>({equalizer_key:k,tf_token:TIMEFRAME_TOKENS[k],weight:tfs[k].weight})).sort((a,b)=>cmp(a.equalizer_key,b.equalizer_key))
  if(!participating.length)throw new Error('TIMEFRAME_PROFILE_HAS_NO_ENABLED_POSITIVE_WEIGHT')
  const canonicalRows=rows.sort((a:any,b:any)=>cmp(a.dim,b.dim)||cmp(a.key,b.key))
  return {receipt:await sha256Hex(stableJson(canonicalRows)),participating_rungs:participating,
    excluded_zero_weight:TIMEFRAME_KEYS.filter((k)=>tfs[k].enabled&&tfs[k].weight===0).sort(cmp),
    excluded_disabled:TIMEFRAME_KEYS.filter((k)=>!tfs[k].enabled).sort(cmp)}
}
function normalizedRungs(value:any,label:string){
  if(!Array.isArray(value))throw new Error('GEIGER_'+label+'_MISMATCH')
  const seen=new Set()
  return value.map((rung:any)=>{
    if(!rung||typeof rung!=='object'||Array.isArray(rung)||!sameArray(Object.keys(rung).sort(cmp),['equalizer_key','tf_token','weight'])||
       typeof rung.equalizer_key!=='string'||typeof rung.tf_token!=='string'||typeof rung.weight!=='number'||!Number.isFinite(rung.weight)||rung.weight<=0||seen.has(rung.equalizer_key))throw new Error('GEIGER_'+label+'_MISMATCH')
    seen.add(rung.equalizer_key)
    return {equalizer_key:rung.equalizer_key,tf_token:rung.tf_token,weight:rung.weight}
  }).sort((a:any,b:any)=>cmp(a.equalizer_key,b.equalizer_key))
}
function normalizedStringSet(value:any,label:string){
  if(!Array.isArray(value)||value.some((e:any)=>typeof e!=='string')||new Set(value).size!==value.length)throw new Error('GEIGER_'+label+'_MISMATCH')
  return Array.from(value).sort(cmp)
}
function validateArtifactProfile(artifact:any,equalizer:any){
  if(!artifact||typeof artifact!=='object'||Array.isArray(artifact))throw new Error('GEIGER_ARTIFACT_NOT_OBJECT')
  if(!equalizer||artifact.equalizer_receipt_sha256!==equalizer.receipt)throw new Error('GEIGER_EQUALIZER_DIGEST_MISMATCH')
  if(stableJson(normalizedRungs(artifact.participating_rungs,'PARTICIPATING_RUNGS'))!==stableJson(normalizedRungs(equalizer.participating_rungs,'PARTICIPATING_RUNGS')))throw new Error('GEIGER_PARTICIPATING_RUNGS_MISMATCH')
  if(!sameArray(normalizedStringSet(artifact.excluded_zero_weight,'EXCLUDED_ZERO_WEIGHT'),normalizedStringSet(equalizer.excluded_zero_weight,'EXCLUDED_ZERO_WEIGHT')))throw new Error('GEIGER_EXCLUDED_ZERO_WEIGHT_MISMATCH')
  if(!sameArray(normalizedStringSet(artifact.excluded_disabled,'EXCLUDED_DISABLED'),normalizedStringSet(equalizer.excluded_disabled,'EXCLUDED_DISABLED')))throw new Error('GEIGER_EXCLUDED_DISABLED_MISMATCH')
  return true
}
function auditArtifactAccounting(artifact:any,expectedSymbolCount:number){
  const participating=artifact&&artifact.participating_rungs, accounting=artifact&&artifact.accounting
  if(!Array.isArray(participating)||!participating.length)throw new Error('GEIGER_PARTICIPATING_RUNGS_INVALID')
  if(!Number.isInteger(expectedSymbolCount)||expectedSymbolCount<1)throw new Error('GEIGER_EXPECTED_SYMBOL_COUNT_INVALID')
  if(!accounting||typeof accounting!=='object'||Array.isArray(accounting))throw new Error('GEIGER_ACCOUNTING_MISSING')
  const computed=accounting.rungs_computed,absent=accounting.rung_absent,failed=accounting.failed,failures=accounting.failures,named=accounting.named_rung_absences
  if(![computed,absent,failed].every((n:any)=>Number.isInteger(n)&&n>=0)||!Array.isArray(failures)||!Array.isArray(named))throw new Error('GEIGER_ACCOUNTING_INVALID')
  if(failed!==0||failures.length!==0)throw new Error('GEIGER_ACCOUNTING_FAILED')
  if(named.length!==absent)throw new Error('GEIGER_NAMED_ABSENCE_COUNT_MISMATCH')
  const unexplained=expectedSymbolCount*participating.length-computed-absent
  if(unexplained!==0)throw new Error('GEIGER_ACCOUNTING_UNEXPLAINED:'+unexplained)
  const validKeys=new Set(participating.map((r:any)=>r.equalizer_key)); const ids=new Set()
  named.forEach((e:any,i:number)=>{
    if(!e||typeof e.symbol!=='string'||!e.symbol||typeof e.state!=='string'||!e.state||!validKeys.has(e.equalizer_key))throw new Error('GEIGER_NAMED_ABSENCE_INVALID:'+i)
    const id=e.symbol+NUL+e.equalizer_key
    if(ids.has(id))throw new Error('GEIGER_NAMED_ABSENCE_DUPLICATE:'+id)
    ids.add(id)
  })
  return {computed,named_absent:absent,unexplained,failed}
}
// ---- time helpers: every stored stamp is epoch seconds, epoch ms, or ISO. An unreadable stamp is null, never "now" -
// and so is an IMPLAUSIBLE one: a stamp in the future (beyond the same 60 s skew allowed for computed_utc) or before 2000
// is a unit mix-up or a bad row (1.79e15 "ms" is the year 58692), and must read "unknown", never "0m old".
const EPOCH_FLOOR_MS=Date.UTC(2000,0,1)
const toMs=(v:any,nowMs:number):number|null=>{
  if(v==null||v==='')return null
  let ms:number
  if(typeof v==='number'||/^\d+(\.\d+)?$/.test(String(v))){const n=+v;if(!Number.isFinite(n)||n<=0)return null;ms=n<1e12?Math.round(n*1000):Math.round(n)}
  else{ms=Date.parse(String(v));if(!Number.isFinite(ms))return null}
  return ms<EPOCH_FLOOR_MS||ms>nowMs+FUTURE_SKEW_MS?null:ms
}
const day=(ms:number|null)=>ms==null||!Number.isFinite(ms)||Math.abs(ms)>8.64e15?'unknown date':new Date(ms).toISOString().slice(0,10)
// days are ROUNDED ELAPSED days - the Hub's readAgeLabel formula - so the same row never shows two different ages on one screen
const ageWords=(ms:number|null,nowMs:number)=>{if(ms==null)return 'age unknown';const d=Math.max(0,nowMs-ms);return d<90*60000?Math.round(d/60000)+'m old':d<48*3600000?Math.round(d/3600000)+'h old':Math.round(d/86400000)+'d old'}
const CONTROL_CHARS=new RegExp('['+String.fromCharCode(0)+'-'+String.fromCharCode(31)+']','g')   // Postgres text cannot hold U+0000: one such byte in a body fails the whole upsert batch
const isStale=(ms:number|null,nowMs:number,limit:number)=>ms==null||nowMs-ms>limit
const unit=(v:any)=>typeof v==='number'&&Number.isFinite(v)&&v>=-1&&v<=1
const finiteNum=(v:any)=>v!=null&&v!==''&&Number.isFinite(+v)
// PostgREST serves at most 1,000 rows per request; pages are only a partition of the table under a STABLE order
async function pageAll(sb:any,table:string,select:string,eq:[string,string]|null,orderBy:string[],maxPages:number){
  const out:any[]=[]; let error:any=null
  for(let p=0;p<maxPages;p++){
    let q=sb.from(table).select(select); if(eq)q=q.eq(eq[0],eq[1])
    for(const col of orderBy)q=q.order(col)
    const r=await q.range(p*1000,p*1000+999)
    if(r.error){error={message:r.error.message};break}
    out.push(...(r.data||[])); if((r.data||[]).length<1000)break
    if(p===maxPages-1)error={message:'PAGE_CAP_REACHED'}
  }
  return {data:out,error}
}
// The provider artifact, accepted under the Hub's rules or rejected with a named reason. Never throws.
async function acceptedGeiger(sb:any,nowMs:number){
  const out:any={state:'UNAVAILABLE',reason:null,symbols:{},computed:null,computedMs:null,stale:false,receipt:null,rungs:null,universe:null,declared:null}
  try{
    const u=await sb.from('tickers').select('ticker,type,active').eq('active',true).or('type.is.null,type.not.in.(crypto,future,index,rate)')
    if(u.error)throw new Error('UNIVERSE_READ_FAILED:'+u.error.message)
    const declared=[...new Set((u.data||[]).map((r:any)=>String(r.ticker??'').trim().toUpperCase()).filter(Boolean))].sort()
    // an EMPTY answer with no error (RLS, a table mid-rewrite) is not "no symbol is an equity any more": membership is UNKNOWN
    if(!declared.length)throw new Error('UNIVERSE_EMPTY')
    out.declared=declared          // read FIRST and kept even if everything after fails: an outage must not be blamed on a non-equity
    const w=await sb.from('operator_weights').select('dim,key,weight,enabled,owner_id').eq('owner_id',GLOBAL_OWNER_ID)
      .in('dim',['fam_handle','family','momentum','momentum_mix','tf_handle','timeframe']).order('dim').order('key').limit(43)
    if(w.error)throw new Error('EQUALIZER_READ_FAILED:'+w.error.message)
    const equalizer=await deriveOperatorEqualizer(w.data)
    let r:any
    try{r=await fetch(GEIGER_URL,{signal:AbortSignal.timeout(15000)})}catch(e){throw new Error('GEIGER_TRANSPORT:'+String((e as any)&&(e as any).message||e).slice(0,80))}
    if(!r.ok)throw new Error('GEIGER_HTTP_'+r.status)
    let j:any; try{j=await r.json()}catch(_){throw new Error('GEIGER_BODY_NOT_JSON')}
    validateArtifactProfile(j,equalizer)
    if(!j.symbols||typeof j.symbols!=='object'||Array.isArray(j.symbols))throw new Error('GEIGER_SYMBOLS_INVALID')
    const syms=Object.keys(j.symbols).sort()
    const digest=await sha256Hex(JSON.stringify(syms)), declaredDigest=await sha256Hex(JSON.stringify(declared))
    out.universe={count:syms.length,digest,declared_count:declared.length,matches_declared:digest===declaredDigest,matches_hub_pin:digest===HUB_PINNED_UNIVERSE_SHA256}
    if(!declared.length||digest!==declaredDigest)throw new Error('GEIGER_EQUITY_UNIVERSE_MISMATCH')
    auditArtifactAccounting(j,declared.length)
    if(j.scale!=='SIGNED_-1_TO_+1')throw new Error('GEIGER_SCALE_UNEXPECTED')
    const cms=typeof j.computed_utc==='string'?Date.parse(j.computed_utc):NaN
    if(!Number.isFinite(cms))throw new Error('GEIGER_COMPUTED_UTC_INVALID')
    if(cms-nowMs>FUTURE_SKEW_MS)throw new Error('GEIGER_COMPUTED_UTC_IN_FUTURE')
    // computed is NORMALISED to ...Z form: it is written into the basis, which the next run re-reads to retain a verdict
    out.symbols=j.symbols; out.computed=new Date(cms).toISOString(); out.computedMs=cms; out.receipt=j.equalizer_receipt_sha256
    out.rungs=equalizer.participating_rungs.length
    out.stale=nowMs-cms>GEIGER_STALE_MS; out.state=out.stale?'ACCEPTED_STALE':'ACCEPTED'
  }catch(e){out.state='UNAVAILABLE';out.reason=String((e as any)&&(e as any).message||e).replace(CONTROL_CHARS,' ').slice(0,120);out.symbols={}}
  return out
}
const RETAIN_MARK='[Provider Geiger unavailable'
Deno.serve(async()=>{
  const sb=createClient(SB_URL,SB_KEY)
  const nowMs=Date.now()
  // U23 2026-08-19: composite_staged.volume was retired 08-10 (column dropped); selecting it made
  // PostgREST 400 and this engine silently emitted blocks:0 for days. structure_state was dropped
  // 08-19 (lane operator-archived) - its query is stubbed empty so the structure sentence stays
  // honestly absent instead of erroring on every run.
  const [comp,reg,mtf,st,coh,tc,rib,prevV,prevB,G]=await Promise.all([
    sb.from('composite_staged').select('ticker,composite,trend,momentum,updated_ts').eq('tf','D'),
    pageAll(sb,'regime_state','ticker,term,state,updated_ts',null,['ticker','term'],4),
    sb.from('mtf_summary').select('ticker,n_bull,n_bear,n_tf,aligned,cascade'),
    Promise.resolve({data:[]} as any),
    sb.from('cohort_divergence').select('ticker,cohort,geiger,cohort_mean,flag'),
    sb.from('ticker_context').select('ticker,business_now,catalysts,watch_notes,narrative,deep_dive'),
    pageAll(sb,'ribbon_signals','ticker,tf,updated_ts',['family','TREND'],['ticker','tf'],12),
    sb.from('read_blocks').select('ticker,body,updated_ts').eq('section','verdict'),
    sb.from('read_blocks').select('ticker,body').eq('section','basis'),
    acceptedGeiger(sb,nowMs)])
  const readErrors:any={}
  for(const [k,r] of Object.entries({composite_staged:comp,regime_state:reg,mtf_summary:mtf,cohort_divergence:coh,ticker_context:tc,ribbon_signals:rib,read_blocks_verdict:prevV,read_blocks_basis:prevB}))if((r as any).error)readErrors[k]=String((r as any).error.message||(r as any).error).slice(0,120)
  const idx=(rows:any)=>{const m:any={};for(const r of rows||[])m[r.ticker]=r;return m}
  const C=idx(comp.data),M=idx(mtf.data),S=idx(st.data),CO=idx(coh.data),TC=idx(tc.data),PV=idx(prevV.data),PB=idx(prevB.data)
  // per-ticker dates ONLY: a ticker is never dated by a newer peer
  const R:any={},RAT:any={};for(const r of reg.data||[]){(R[r.ticker]=R[r.ticker]||{})[r.term]=r.state;const ms=toMs(r.updated_ts,nowMs);if(ms!=null){const a=RAT[r.ticker]=RAT[r.ticker]||{min:ms,max:ms};if(ms<a.min)a.min=ms;if(ms>a.max)a.max=ms}}
  const RIB:any={};for(const r of rib.data||[]){const ms=toMs(r.updated_ts,nowMs);if(ms!=null){const a=RIB[r.ticker]=RIB[r.ticker]||{min:ms,max:ms};if(ms<a.min)a.min=ms;if(ms>a.max)a.max=ms}}
  const now=new Date(nowMs).toISOString(); const rows:any[]=[]
  // every ticker anyone may be reading: provider symbols, legacy rows, declared equities AND whatever already has a verdict or
  // basis - so an equity with no legacy row is still marked during an outage, and a failed legacy read cannot hide the outage
  const tickers=[...new Set([...Object.keys(G.symbols||{}),...Object.keys(C),...(Array.isArray(G.declared)?G.declared:[]),...Object.keys(PV),...Object.keys(PB)])].sort()
  const DECL:Set<string>|null=Array.isArray(G.declared)?new Set(G.declared):null
  const tally:any={from_provider:0,from_provider_stale:0,retained:0,from_legacy_absent:0,from_legacy_unavailable:0,skipped_no_valid_source:0}
  for(const t of tickers){ try{
    const b:any={}; const rg=R[t]||{}; const m=M[t]; const s=S[t]; const co=CO[t]; const L=C[t]
    const accepted=G.state!=='UNAVAILABLE'
    const g=accepted&&G.symbols?G.symbols[t]:undefined
    const gValid=!!(g&&unit(g.composite)&&unit(g.trend)&&unit(g.momentum))
    const lValid=!!(L&&finiteNum(L.composite)&&finiteNum(L.trend)&&finiteNum(L.momentum))
    const lMs=L?toMs(L.updated_ts,nowMs):null
    const prevBasis=PB[t]&&typeof PB[t].body==='string'?PB[t].body:''
    const prevComputed=(()=>{const x=/provider artifact computed (\d{4}-\d{2}-\d{2}T[0-9:.]+Z)/.exec(prevBasis);const ms=x?Date.parse(x[1]):NaN;return Number.isFinite(ms)&&ms<=nowMs+FUTURE_SKEW_MS?ms:null})()
    // ABSENT vs UNAVAILABLE. A declared equity is expected from the provider; anything else (crypto, futures, indices) is
    // owned by the legacy composite and is merely ABSENT - also during an outage. If the universe itself could not be
    // read (or came back empty), membership is UNKNOWN: a ticker is treated as absent only if its last basis already said so;
    // everything else is "the provider could not be consulted" - and its last provider-based verdict is retained.
    const expected=DECL?DECL.has(t):!/is not in the provider equity universe/.test(prevBasis)
    const absent=!expected&&!gValid
    const providerIssue=gValid||absent?null:!accepted?`provider Geiger unavailable (${G.reason})`:`provider Geiger reading for ${t} is malformed (composite/trend/momentum not all finite numbers in [-1,+1])`
    const regAt=RAT[t]||null, ribAt=RIB[t]||null
    const supportBasis=`Regime: ${regAt?('this ticker\'s rows last updated '+(day(regAt.min)===day(regAt.max)?day(regAt.max):day(regAt.min)+' to '+day(regAt.max))+' (oldest '+ageWords(regAt.min,nowMs)+')'):'no dated rows for this ticker'}. `+
      `Multi-timeframe: ${ribAt?('ribbon inputs for this ticker last updated '+(day(ribAt.min)===day(ribAt.max)?day(ribAt.max):day(ribAt.min)+' to '+day(ribAt.max))+' (oldest '+ageWords(ribAt.min,nowMs)+')'):'source age unknown'}; the summary table carries no timestamp. `+
      `Cohort comparison: legacy daily composite of ${day(lMs)} (${ageWords(lMs,nowMs)}). `+
      `Levels/all-time-high: omitted (engine unscheduled, stale price basis). Structure: omitted (lane retired 2026-08-19).`
    // RETAIN the last provider-based verdict through a provider problem whenever it is newer than the legacy row
    if(providerIssue&&prevComputed!=null&&PV[t]&&typeof PV[t].body==='string'&&PV[t].body.trim()&&(lMs==null||prevComputed>lMs)){
      const cut=PV[t].body.startsWith(RETAIN_MARK)?PV[t].body.indexOf(']\n\n'):-1
      const kept=cut>=0?PV[t].body.slice(cut+3):PV[t].body
      const keptAt=new Date(prevComputed).toISOString()
      rows.push({ticker:t,section:'verdict',body:`${RETAIN_MARK} — ${providerIssue.replace(/^provider Geiger (unavailable )?/,'')}. The reading below was computed ${keptAt} and is retained, not re-measured.]\n\n${kept}`,updated_ts:toMs(PV[t].updated_ts,nowMs)!=null?PV[t].updated_ts:keptAt})
      rows.push({ticker:t,section:'basis',body:`Geiger: RETAINED from provider artifact computed ${keptAt} (${ageWords(prevComputed,nowMs)}) — ${providerIssue} at ${now}. ${supportBasis}`,updated_ts:now})
      tally.retained++
    }else if(!gValid&&!lValid){tally.skipped_no_valid_source++   // nothing valid to say: the previous verdict row is left to age honestly
    }else{
    const c=gValid?{trend:g.trend,momentum:g.momentum,composite:g.composite}:{trend:+L.trend,momentum:+L.momentum,composite:+L.composite}
    const tr=+c.trend, mo=+c.momentum, cv=+c.composite
    const trendWord = tr>=0.5?'a firm uptrend, price stacked above most of its moving-average ladder':tr>=0.15?'a steady uptrend':tr>-0.15?'a flat, rangebound tape':tr<=-0.5?'a firm downtrend':'a downtrend'
    let momPhrase = tr>=0.15&&mo<-0.05?', though momentum has rolled over — it is losing short-term steam':tr<=-0.15&&mo>0.05?', though momentum is starting to turn up':mo>=0.15?', with momentum confirming the move':mo<=-0.15?', with momentum still pressing lower':', with momentum roughly neutral'
    let regPhrase=''
    if(rg.SHORT){const sh=rg.SHORT,md=rg.MID||'n/a',lg=rg.LONG||'n/a'; regPhrase=(sh==='bear'&&lg==='bull')?`The regime stack is near-term defensive inside a longer-term uptrend (short ${sh}, mid ${md}, long ${lg})`:(sh==='bull'&&lg==='bear')?`Near-term firm but the longer trend is still down (short ${sh}, mid ${md}, long ${lg})`:`The regime stack reads short ${sh}, mid ${md}, long ${lg}`}
    // every claim from a source older than a day says so IN THE RENDERED VERDICT, with this ticker's own date
    // a claim is as old as the OLDEST row it rests on (one fresh row must not hide two month-old ones); the note shows the range
    const staleNote=(at:{min:number,max:number}|null,what:string)=>!at?` (${what} of unknown date)`:isStale(at.min,nowMs,SOURCE_STALE_MS)?` (${what} of ${day(at.min)===day(at.max)?day(at.min):day(at.min)+' to '+day(at.max)}, ${ageWords(at.min,nowMs)})`:''
    if(regPhrase)regPhrase+=staleNote(regAt,'legacy regime rows')
    let lead='', compWord='Geiger composite'
    if(gValid){
      if(G.stale)lead=`As of ${G.computed} (${ageWords(G.computedMs,nowMs)} — the provider has not recomputed since), `
    }else{
      compWord='legacy daily composite'
      const why=absent?`${t} is not in the provider equity universe`:providerIssue
      const legacyStale=isStale(lMs,nowMs,SOURCE_STALE_MS)
      lead=legacyStale?`[${why} — the legacy daily composite ${lMs==null?'of unknown date':'as of '+day(lMs)+' ('+ageWords(lMs,nowMs)+', not re-measured since)'} is shown.] `:(absent?'':`[${why} — the legacy daily composite of ${day(lMs)} is shown.] `)
    }
    const para1=`${lead}${t} sits in ${trendWord} — the ${compWord} reads ${lab(cv)} at ${cv>=0?'+':''}${cv.toFixed(2)}${momPhrase}.${regPhrase?' '+regPhrase+'.':''}`
    let para2=''
    if(m)para2+= (m.aligned?`All ${m.n_tf} timeframes are aligned ${m.cascade}`:`Across ${m.n_tf} timeframes the signals are split (${m.n_bull} up, ${m.n_bear} down) — no clean alignment, consistent with consolidation`)+staleNote(ribAt,'legacy ribbon inputs')+'. '
    if(s){const sw=(+s.state>0)?'a higher-high bias':((+s.state<0)?'a lower-low bias':'no clear bias'); para2+=`Daily structure shows ${sw} (${s.n_up} higher highs vs ${s.n_down} lower lows). `}
    if(co)para2+=`Against its ${co.cohort} peers it is ${co.flag==='DIVERGENT'?'diverging from the group':'roughly in line'}${gValid||isStale(lMs,nowMs,SOURCE_STALE_MS)?` (compared on the legacy daily composite of ${day(lMs)}, ${ageWords(lMs,nowMs)})`:''}.`
    b.verdict=(para1+'\n\n'+para2.trim()).trim()
    b.basis=(gValid?`Geiger: provider artifact computed ${G.computed} (${G.stale?'STALE, '+ageWords(G.computedMs,nowMs):'current'}; accepted under equalizer ${String(G.receipt).slice(0,12)}, ${Number.isInteger(g.tf_contributors)?g.tf_contributors:'?'} of ${G.rungs} timeframes contributing). `
      :`Geiger: legacy daily composite as of ${day(lMs)} (${ageWords(lMs,nowMs)}) — ${absent?t+' is not in the provider equity universe':providerIssue+' at '+now}. `)+supportBasis
    tally[gValid?(G.stale?'from_provider_stale':'from_provider'):(absent?'from_legacy_absent':'from_legacy_unavailable')]++   // counted only once the verdict and its basis exist
    }
    const x=TC[t]
    if(x){ try{
      const P = x.deep_dive ? parseDD(x.deep_dive) : {}
      const biz=[P['BUSINESS'], P['SEGMENTS']?('Segments — '+P['SEGMENTS']):'', P['MOAT']?('Moat — '+P['MOAT']):'', P['10YR FINANCIALS']?('Financials — '+P['10YR FINANCIALS']):''].filter(Boolean).join('\n\n').trim()
      b.business = biz || (x.business_now||x.narrative||'').trim() || undefined
      const bull=P['BULL']||P['BULL CASE']
      const cat=[P['CATALYSTS']||x.catalysts, bull?('Bull case — '+bull):'', P['NOW']?('Now — '+P['NOW']):''].filter(Boolean).join('\n\n').trim()
      if(cat)b.catalysts=cat
      const bear=P['BEAR']||P['BEAR CASE']
      const watch=[bear?('Bear case / risks — '+bear):'', P['KEY RISKS']?('Key risks — '+P['KEY RISKS']):'', P['SENTIMENT']?('Sentiment — '+P['SENTIMENT']):'', x.watch_notes||''].filter(Boolean).join('\n\n').trim()
      if(watch)b.watch=watch
    }catch(e){tally.context_errors=(tally.context_errors||0)+1} }   // a malformed dossier costs its own sections, never the verdict
    for(const sec of Object.keys(b))if(b[sec])rows.push({ticker:t,section:sec,body:b[sec],updated_ts:now})
  }catch(e){tally.ticker_errors=(tally.ticker_errors||0)+1;if(!tally.first_ticker_error)tally.first_ticker_error=t+': '+String((e as any)&&(e as any).message||e).slice(0,100)} }   // one bad ticker never costs the others their read
  let e=null
  // a ticker's rows travel together (<=400 rows a chunk, never split inside a ticker): a failed chunk must not leave a new basis beside an old verdict
  const chunks:any[][]=[[]];for(let i=0;i<rows.length;){let k=i;while(k<rows.length&&rows[k].ticker===rows[i].ticker)k++;if(chunks[chunks.length-1].length&&chunks[chunks.length-1].length+(k-i)>400)chunks.push([]);chunks[chunks.length-1].push(...rows.slice(i,k));i=k}
  for(const ch of chunks){if(!ch.length)continue;const {error}=await sb.from('read_blocks').upsert(ch,{onConflict:'ticker,section'});if(error)e=error.message}
  return new Response(JSON.stringify({blocks:rows.length,err:e,read_errors:readErrors,
    geiger:{state:G.state,reason:G.reason,computed:G.computed,age_min:G.computedMs==null?null:Math.round((nowMs-G.computedMs)/60000),receipt:G.receipt,universe:G.universe,...tally}}),{headers:{'Content-Type':'application/json'}})
})
