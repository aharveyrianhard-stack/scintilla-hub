import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const SB_URL=Deno.env.get('SUPABASE_URL')||''
const SB_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
const J=(o)=>new Response(JSON.stringify(o),{headers:{'Content-Type':'application/json'}})
// M70 (24 Sep 2026) — INVESTING.COM. Alan: "let's ingest the investing.com news one". They publish RSS and no
// API (https://www.investing.com/webmaster-tools/rss). These five are their NEWS desks; their Analysis &
// Opinion feeds are columns, not news, so they are deliberately left out. Each name below is the channel title
// the feed itself returned when it was read on 24 Sep 2026 — not a guess from the listing page:
//   All News · Economy · Stock Market · Economic Indicators · Commodities & Futures. 10 items each, 200 OK.
// WHAT IS STORED: the headline, its time and its link. NOTHING ELSE — no article text, no description, no
// fetch of the page behind the link. The row's ticker is the market bucket below, because these stories are
// about the market and not about one name.
const INVESTING_FEEDS=[['https://www.investing.com/rss/news.rss','All News'],['https://www.investing.com/rss/news_14.rss','Economy'],['https://www.investing.com/rss/news_25.rss','Stock Market'],['https://www.investing.com/rss/news_95.rss','Economic Indicators'],['https://www.investing.com/rss/news_11.rss','Commodities & Futures']]
// THE HUB ALREADY HAS THIS BUCKET. index.html: "_MARKET LAW - market-wide rows surface on the ALL tab
// ONLY" (l.8825) and "ALL -> global pull (the ONLY tab that shows ticker='_MARKET')" (l.8870). The live
// table already holds _MARKET rows from the 'general' feed (wsj.com, marketwatch.com). So this lane
// joins that convention instead of inventing a second one, and the headlines appear on the NEWS room's
// ALL tab the day it is deployed - no page change needed.
const MARKET_BUCKET='_MARKET'
// the same story rides several of their feeds, so the batch is de-duplicated on its own link and on a
// normalised headline before anything is offered to the table
const normTitle=(t)=>(t||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const normUrl=(u)=>{const s=(u||'').split('#')[0].split('?')[0];return s.replace(/\/$/,'')}
function tag(b,name){const a=b.indexOf('<'+name);if(a<0)return '';const s=b.indexOf('>',a)+1;const e=b.indexOf('</'+name+'>',s);if(e<0)return '';return b.slice(s,e)}
// DECODE ENTITIES BEFORE STRIPPING TAGS, NOT AFTER.
// Google News puts its markup in <description> ENTITY-ENCODED (&lt;a href=...&gt;). Stripping tags
// first therefore removed nothing, and the decode step then turned the entities back into literal
// markup, which was stored in news.snippet and rendered as visible text: every item on Station
// /news showed a raw <a href="https://news.google.com/rss/articles/..."> line under its headline
// (MEASURED 2026-09-17, e.g. SLV snippet stored as '<a href="..." target="_blank">SLV - iShares
// Silver Trust Volatility & Greeks</a> <font color="#6f6f6f">Finviz</font>'). Decoding first and
// stripping afterwards yields the intended plain text; whitespace is collapsed so a multi-line
// description cannot reintroduce ragged output.
function clean(s){s=(s||'').split('<![CDATA[').join('').split(']]>').join('');s=s.split('&amp;').join('&').split('&#39;').join(String.fromCharCode(39)).split('&quot;').join(String.fromCharCode(34)).split('&lt;').join('<').split('&gt;').join('>').split('&nbsp;').join(' ');s=s.replace(/<[^>]*>/g,'');return s.replace(/\s+/g,' ').trim()}
function rssItems(xml){const parts=(xml||'').split('<item>');const out=[];for(let i=1;i<parts.length;i++){const b=parts[i].split('</item>')[0];const t=clean(tag(b,'title'));const l=clean(tag(b,'link'));if(l&&t)out.push({title:t,link:l,desc:clean(tag(b,'description')).slice(0,400),pub:tag(b,'pubDate'),src:clean(tag(b,'source')).slice(0,80)})}return out}
function gts(s){if(!s)return 0;const d=(''+s).replace(/[^0-9]/g,'');if(d.length<14)return 0;const iso=d.slice(0,4)+'-'+d.slice(4,6)+'-'+d.slice(6,8)+'T'+d.slice(8,10)+':'+d.slice(10,12)+':'+d.slice(12,14)+'Z';return Math.floor(Date.parse(iso)/1000)||0}
// FMP `publishedDate` IS US-EASTERN WALL CLOCK WITH NO ZONE SUFFIX ("2026-09-18 15:18:00"). Date.parse() reads a zone-less
// string in the runtime's zone (UTC here), so every FMP row was stamped 4 h (EDT) / 5 h (EST) OLDER than it is.
// MEASURED 2026-09-18, read-only: of 1000 fmp rows stored in the previous 24 h, none had (updated_ts - published_ts)
// below 14,429 s = 4 h 00 m 29 s, while google rows start at 71 s; and two issuers' own pages agree with the Eastern
// reading (Newsfile 315043 "September 18, 2026 3:18 PM EDT" was stored as 15:18:00Z; GlobeNewswire 3364679 "08:17 ET"
// as 08:17:00Z). Hub and Station both list newest-first on published_ts, so a just-published FMP item entered every list
// four hours down: the newest 120 rows were 120 google / 0 fmp, with 0 fmp rows in the newest four hours of the table.
// A string that already carries a zone (or any other shape) keeps the old Date.parse path. Two passes settle DST edges.
const NY_FMT=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'})
function nyOffsetMs(t:number){const p:any={};for(const x of NY_FMT.formatToParts(new Date(t)))p[x.type]=+x.value;return Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)-t}
function fmpEpoch(s:any){const m=/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(s||'').trim());if(!m){const p=Date.parse(String(s||''));return Number.isFinite(p)?Math.floor(p/1000):0}
  const parts=[+m[1],+m[2],+m[3],+m[4],+m[5],+(m[6]||0)];const wall=Date.UTC(parts[0],parts[1]-1,parts[2],parts[3],parts[4],parts[5]);const d=new Date(wall)
  if(d.getUTCFullYear()!==parts[0]||d.getUTCMonth()+1!==parts[1]||d.getUTCDate()!==parts[2]||d.getUTCHours()!==parts[3]||d.getUTCMinutes()!==parts[4]||d.getUTCSeconds()!==parts[5])return 0
  let t=wall-nyOffsetMs(wall);t=wall-nyOffsetMs(t);if(t+nyOffsetMs(t)!==wall)return 0;return Math.floor(t/1000)}
// RETURNS BOTH NUMBERS. `cand` is what it always returned (rows offered after in-call de-duplication); `ins` is what the
// table actually took: with ignoreDuplicates the statement is INSERT .. ON CONFLICT DO NOTHING, and asking for the
// representation returns only the rows that were inserted. The receipt's bySource was read as "stored" (1964 google /
// 100 fmp a batch) while about 2.5 google and 0.7 fmp rows a batch were new. If the representation request is refused for
// any reason, the exact v20 statement runs instead and `ins` is null (unknown) — storing is never traded for counting.
// That second attempt happens at most ONCE per run (W.rep flips off), so a struggling database is not written to twice per chunk.
async function upsertNews(sb,rows,W:any){if(!rows.length)return {cand:0,ins:0};const k=new Set();const fresh=rows.filter(n=>{const key=n.ticker+'|'+n.url;if(k.has(key))return false;k.add(key);return true})
  if(W&&W.rep){const r=await sb.from('news').upsert(fresh,{onConflict:'ticker,url',ignoreDuplicates:true}).select('ticker')
    if(!r.error)return {cand:fresh.length,ins:Array.isArray(r.data)?r.data.length:null}
    W.rep=false}
  const {error}=await sb.from('news').upsert(fresh,{onConflict:'ticker,url',ignoreDuplicates:true});if(error)throw new Error('upsert: '+error.message);return {cand:fresh.length,ins:null}}
async function run(req){
  const u=new URL(req.url); const one=u.searchParams.get('ticker')
  const sb=createClient(SB_URL,SB_KEY); const now=Math.floor(Date.now()/1000)
  const {data:cfg,error:ce}=await sb.from('app_config').select('key,value').in('key',['news_busy','news_offset','gdelt_offset','FMP_KEY','fmp_enabled','investing_enabled'])
  if(ce) throw new Error('app_config read: '+ce.message)
  const C={}; for(const r of (cfg||[])) C[r.key]=r.value
  // One parser for every stored number (lock stamp, offsets): tolerates JSON-quoted values and falls back to 0 on
  // anything non-numeric, so a stray value can neither disable the lock nor pin the rotation to NaN.
  const cfgInt=(v:any)=>{const n=parseInt(String(v??'').replace(/"/g,''),10);return Number.isFinite(n)?n:0}
  const FMPK=(C['FMP_KEY']||'').trim()
  const FMP_ON=((C['fmp_enabled']||'').trim()==='1')
  // GDELT LANE DISABLED (GDELT_PER_BATCH=0) — OPENLY UNRESOLVED. Independent review 2026-09-18 measured, read-only:
  // GDELT answered in 9.7-12 s (above any budget that keeps a batch under 60 s) and returned HTTP 429 even at 20-45 s
  // spacing; and an exact-phrase search on a company name stores off-topic hits permanently (e.g. "JPMorgan Chase"
  // returned 6/6 articles about other companies, from broker rating notes). v18's GDELT lane has stored nothing since
  // 2026-09-13, so disabling it removes no news. The serial lane below stays in place, inert, for a later design with a
  // relevance filter and its own schedule; with 0 it makes no request and moves no offset.
  // Request budget (batch mode): the FMP news lane (FMP_TIMEOUT_MS, only when fmp_enabled='1' — ON today) runs first,
  // then the Google lane (4 chunks of 6 in parallel, 4 x GOOGLE_TIMEOUT_MS). Worst case network time = 10 + 4x8 = 42 s,
  // measured by the runtime test from these constants. Database round trips carry no client timeout. A batch under
  // 60 s keeps the one-per-minute cadence; the caller timeout is 100 s (cron job 6) and the lock window 120 s.
  // Declared here, before either branch uses them (a later placement threw ReferenceError at runtime).
  const GDELT_PER_BATCH=0, GDELT_TIMEOUT_MS=8000, GDELT_SPACING_MS=5200, GOOGLE_TIMEOUT_MS=8000, FMP_TIMEOUT_MS=10000
  let tickers=[]
  let eq:string[]=[], L=1
  let gdeltList:string[]=[]           // batch mode only: its own rotating window over the whole universe
  if(one){tickers=[one.toUpperCase()]}
  else{
    const busy=cfgInt(C['news_busy']); if(now-busy<120) return J({skipped:true})
    await sb.from('app_config').upsert({key:'news_busy',value:''+now},{onConflict:'key'})
    const {data:tk,error:te}=await sb.from('composite_staged').select('ticker').eq('tf','D')
    if(te) throw new Error('composite read: '+te.message)
    eq=[...new Set((tk||[]).map(x=>''+x.ticker))].filter(t=>!t.endsWith('USD')).sort()
    L=Math.max(eq.length,1); const off=cfgInt(C['news_offset'])%L
    tickers=eq.slice(off,off+24); if(tickers.length<24)tickers=tickers.concat(eq.slice(0,24-tickers.length))
    await sb.from('app_config').upsert({key:'news_offset',value:''+((off+24)%L)},{onConflict:'key'})
    // GDELT WINDOW (inert while GDELT_PER_BATCH=0): GDELT_PER_BATCH tickers from its own offset, advancing by the same
    // amount, so every ticker is reached every ceil(L/GDELT_PER_BATCH) batches regardless of the Google window.
    if(GDELT_PER_BATCH>0){
      const goff=cfgInt(C['gdelt_offset'])%L
      gdeltList=eq.slice(goff,goff+GDELT_PER_BATCH); if(gdeltList.length<GDELT_PER_BATCH&&eq.length>GDELT_PER_BATCH)gdeltList=gdeltList.concat(eq.slice(0,GDELT_PER_BATCH-gdeltList.length))
      await sb.from('app_config').upsert({key:'gdelt_offset',value:''+((goff+GDELT_PER_BATCH)%L)},{onConflict:'key'})
    }
  }
  const bySource={google:0,gdelt:0,fmp:0,investing:0}   // CANDIDATES offered to the table (unchanged meaning, kept for receipt readers)
  const stored:any={google:0,gdelt:0,fmp:0,investing:0}  // rows the table actually INSERTED this run; null = unknown for that source
  const INVESTING_ON=((C['investing_enabled']||'1').trim()!=='0')   // a free source: on unless it is switched off
  const INVESTING_TIMEOUT_MS=8000
  const investingErrors:string[]=[]
  const addStored=(k:string,n:any)=>{stored[k]=(n==null||stored[k]==null)?null:stored[k]+n}
  const W={rep:true}     // representation (inserted-row) counting; switched off for the rest of the run after one refusal
  // Preserve the article but never invent its publication time. Undated/future dates remain null and are counted.
  let fmpFutureRejected=0,fmpInvalidDates=0
  const fmpPublished=(value:any)=>{const p=fmpEpoch(value);if(!Number.isFinite(p)||p<=0){fmpInvalidDates++;return null}if(p>now+300){fmpFutureRejected++;return null}return p}
  let fmpCalls=0,fmpBytes=0,fmpStatus=200 // CC-BOARD-003 C2: FMP bandwidth accounting (per invocation; free sources not counted)
  // FMP news — gated OFF by app_config.fmp_enabled (master FMP switch). Free sources below still run.
  if(FMPK&&FMP_ON){try{const r=await fetch('https://financialmodelingprep.com/stable/news/stock?symbols='+tickers.join(',')+'&limit=100&apikey='+FMPK,{signal:AbortSignal.timeout(FMP_TIMEOUT_MS)});fmpCalls++;if(!r.ok)fmpStatus=r.status;if(r.ok){const txt=await r.text();fmpBytes+=txt.length;const j=JSON.parse(txt);if(Array.isArray(j)){const rows=[];for(const a of j){const url=a.url||a.link,ti=a.title,sym=a.symbol;if(url&&ti&&sym)rows.push({ticker:sym,url,title:ti,site:a.site||a.publisher||'FMP',snippet:(a.text||'').slice(0,400),published_ts:fmpPublished(a.publishedDate),updated_ts:now,feed:'fmp'});}const w=await upsertNews(sb,rows,W);bySource.fmp+=w.cand;addStored('fmp',w.ins);}}}catch(_){}}
  // RELEVANCE: a ticker that is also an English word ("NOW", "ALL", "ON", "IT", "BE"...) pulls generic
  // articles when searched as a bare word. MEASURED 2026-09-18: 221 of 250 rows tagged $NOW over 7 days
  // were unrelated to ServiceNow (AMD, Netflix, Sandisk headlines). Such tickers are searched on Google News by their
  // company name from company_profile; every other ticker keeps the exact Google query it always had.
  // Pacing note: on-view calls make NO GDELT request, so user views cannot breach GDELT's 1-per-5 s limit.
  // Batch calls are issued once a minute by cron and skip while news_busy is recent; that check is
  // read-then-write (not atomic), so two batches can overlap if they start within the same instant or if a batch
  // outlives the 120 s window. Effects are bounded: stored rows are upsert-ignoreDuplicates (never deleted or
  // overwritten), one offset window may repeat, and GDELT may answer 429 (surfaced in gdelt_errors, never fatal).
  const AMBIGUOUS=/^(NOW|ALL|ON|IT|BE|ARE|KEY|CAT|GO|SO|AN|A|C|D|F|V|T|P|O|ES|EH|ED|AME|DE|RUN|PATH|COST|TGT|WELL|MP|BILL|FAST|LOVE|PLAY|OPEN|NEXT|BIG|GOOD|CAR|EAT|FUN|FIT|HD|LOW)$/
  const NAME:any={}
  try{const {data:cp}=await sb.from('company_profile').select('ticker,name').in('ticker',[...new Set([...tickers,...gdeltList])]);for(const r of (cp||[]))if(r&&r.ticker&&r.name)NAME[r.ticker]=String(r.name).replace(/(?:,\s*|\s+)(?:Inc\.?|Corp\.?|Corporation|Incorporated|plc|Ltd\.?|Limited|Holdings|Company|Co\.?|N\.V\.|S\.A\.|American Depositary.*)$/i,'').replace(/[\s,&]+$/,'').trim()}catch(_){}
  // (the suffix needs a separator before it: "U.S. Bancorp" stays whole instead of becoming "U.S. Ban"; a trailing
  // "&" left by "... & Co." is dropped, so "Deere & Company" searches as "Deere")
  const phraseFor=(t:string)=>(AMBIGUOUS.test(t)&&NAME[t])?('"'+NAME[t]+'" stock'):(t+' stock')
  async function fetchT(t){
    const out=[]
    try{const r=await fetch('https://news.google.com/rss/search?q='+encodeURIComponent(phraseFor(t))+'&hl=en-US&gl=US&ceid=US:en',{signal:AbortSignal.timeout(GOOGLE_TIMEOUT_MS)});if(r.ok){const xml=await r.text();for(const x of rssItems(xml))out.push({ticker:t,url:x.link,title:x.title,site:x.src||'Google News',snippet:x.desc,published_ts:x.pub?Math.floor(Date.parse(x.pub)/1000)||now:now,updated_ts:now,feed:'google'})}}catch(_){}
    return out
  }
  // GDELT (inert while GDELT_PER_BATCH=0): the API refuses short phrases ("The specified phrase is too short.", HTTP 200
  // + plain text; short tickers and 4-letter names like "Visa") and rate-limits with HTTP 429. The old lane fanned out six
  // tickers at once and swallowed both errors, so it has written nothing since 2026-09-13. When re-enabled, this lane runs
  // serially alongside the Google lane and reports its errors; it still needs a relevance filter before storing hits.
  // M70 — the Investing.com lane. Five feeds in parallel, one timeout each, so it adds at most
  // INVESTING_TIMEOUT_MS to this invocation's network time (it runs beside Google and GDELT, not after them).
  // Batch mode only: an on-view ?ticker= lookup asks about one name, and these stories are not about one name.
  async function fetchInvesting(){
    const out:any[]=[],seenUrl=new Set(),seenTitle=new Set()
    const pages=await Promise.all(INVESTING_FEEDS.map(async ([url,name])=>{
      try{const r=await fetch(url,{signal:AbortSignal.timeout(INVESTING_TIMEOUT_MS),headers:{'User-Agent':'Mozilla/5.0 (compatible; ScintillaHub/1.0)'}})
        if(!r.ok){investingErrors.push(name+':HTTP_'+r.status);return []}
        return rssItems(await r.text())
      }catch(e){investingErrors.push(name+':'+String((e as any)&&(e as any).message||e).slice(0,40));return []}
    }))
    for(const items of pages)for(const x of items){
      const u=normUrl(x.link),t=normTitle(x.title)
      if(!u||!t||seenUrl.has(u)||seenTitle.has(t))continue          // the same story on two of their feeds
      seenUrl.add(u);seenTitle.add(t)
      const ts=gts(x.pub)||Math.floor(Date.parse(x.pub||'')/1000)||now
      if(ts>now+3600)continue                                        // a stamp in the future is a feed fault, not news
      out.push({ticker:MARKET_BUCKET,url:x.link,title:x.title,site:'Investing.com',snippet:'',published_ts:ts,updated_ts:now,feed:'investing'})
    }
    // and against what the table already holds. MEASURED 24 Sep: news is indexed on (ticker,url), so a
    // lookup scoped to this bucket answers in ~0.14 s, while a url-only lookup across every ticker hits
    // the 3 s statement timeout (57014) — so the bucket-scoped read is what runs. The (ticker,url) unique
    // index already makes a repeat insert a no-op; the only case this read adds is a link that arrived in
    // an earlier batch. A story that also exists under a real ticker from Google or FMP is a DIFFERENT row
    // by design. To dedupe across every ticker as well, apply the index in
    // migrations/20260924_news_url_index.sql and set INVESTING_GLOBAL_DEDUPE to true.
    const INVESTING_GLOBAL_DEDUPE=false
    if(out.length){try{const q=sb.from('news').select('url').in('url',out.map(r=>r.url))
      const {data:have}=await (INVESTING_GLOBAL_DEDUPE?q:q.eq('ticker',MARKET_BUCKET))
      const held=new Set((have||[]).map((r:any)=>r.url));return out.filter(r=>!held.has(r.url))
    }catch(e){investingErrors.push('dedupe:'+String((e as any)&&(e as any).message||e).slice(0,40))}}
    return out
  }
  const gdeltErrors:string[]=[]
  async function fetchGdeltSerial(list){
    const out=[]
    for(const t of list){
      const phrase=(NAME[t]?NAME[t]:t+' stock')
      try{const r=await fetch('https://api.gdeltproject.org/api/v2/doc/doc?query='+encodeURIComponent('"'+phrase+'"')+'&mode=ArtList&format=json&maxrecords=6&sort=DateDesc',{signal:AbortSignal.timeout(GDELT_TIMEOUT_MS)})
        const txt=await r.text()
        if(!r.ok){gdeltErrors.push(t+':HTTP_'+r.status);}
        else{let j:any=null;try{j=JSON.parse(txt)}catch(_){gdeltErrors.push(t+':'+txt.slice(0,60))}
          if(j)for(const a of ((j&&j.articles)||[]))if(a.url&&a.title)out.push({ticker:t,url:a.url,title:a.title,site:a.domain||'GDELT',snippet:'',published_ts:gts(a.seendate)||now,updated_ts:now,feed:'gdelt'})}
      }catch(e){gdeltErrors.push(t+':'+String(e).slice(0,40))}
      if(t!==list[list.length-1])await new Promise(res=>setTimeout(res,GDELT_SPACING_MS))
    }
    return out
  }
  // GDELT serial lane, batch mode only, over its own rotating window (see above); started now, collected below.
  // A failed news upsert no longer abandons the batch: the remaining chunks still run, the lock is still released and
  // the failure is reported in the receipt (store_errors) instead of surfacing as a bare error that leaves the lock held.
  const storeErrors:string[]=[]
  const gdP=(one||!gdeltList.length)?Promise.resolve([]):fetchGdeltSerial(gdeltList)
  const invP=(one||!INVESTING_ON)?Promise.resolve([]):fetchInvesting()
  for(let i=0;i<tickers.length;i+=6){
    const chunk=tickers.slice(i,i+6)
    const arrs=await Promise.all(chunk.map(fetchT)); const got=[].concat.apply([],arrs)
    if(got.length){try{const w=await upsertNews(sb,got,W);bySource.google+=got.length;addStored('google',w.ins)}catch(e){storeErrors.push('google: '+String((e as any)&&(e as any).message||e).slice(0,80))}}
  }
  const gd=await gdP
  if(gd.length){try{const w=await upsertNews(sb,gd,W);bySource.gdelt+=gd.length;addStored('gdelt',w.ins)}catch(e){storeErrors.push('gdelt: '+String((e as any)&&(e as any).message||e).slice(0,80))}}
  const inv=await invP
  if(inv.length){try{const w=await upsertNews(sb,inv,W);bySource.investing+=inv.length;addStored('investing',w.ins)}catch(e){storeErrors.push('investing: '+String((e as any)&&(e as any).message||e).slice(0,80))}}
  // COMPARE-AND-CLEAR: release the lock only if it still carries THIS batch's stamp. An unconditional clear let a
  // batch that outlived the 120 s window release the lock of the batch that had since taken it over, opening the
  // door to a third. The read-then-write leaves a millisecond window (not atomic; an atomic release needs a
  // conditional UPDATE whose filter matches the column's type — see the run evidence); the write itself is the
  // same statement as before. Values are compared after stripping any JSON quotes.
  if(!one){try{const {data:lk}=await sb.from('app_config').select('key,value').eq('key','news_busy')
    const cur=cfgInt(((lk||[]).find((r:any)=>r&&r.key==='news_busy')||{}).value)
    if(cur===now)await sb.from('app_config').upsert({key:'news_busy',value:'0'},{onConflict:'key'})
  }catch(_){/* an unreleased lock self-expires after 120 s */}}
  if(fmpCalls){try{await sb.from('fmp_bandwidth_log').insert({fn:'news-feed',calls:fmpCalls,symbols:tickers.length,bytes:fmpBytes,status:fmpStatus,at:new Date().toISOString()})}catch(_){/* logging must never break the run */}}
  return J({mode:one?'on-view':'batch',tickers:tickers.length,gdelt:GDELT_PER_BATCH>0?'enabled':'disabled',gdelt_window:gdeltList.length,universe:one?null:L,bySource,stored,fmp_tz:'America/New_York',fmp_future_rejected:fmpFutureRejected,fmp_invalid_dates:fmpInvalidDates,fmp_on:FMP_ON,gdelt_errors:gdeltErrors.slice(0,30),investing:INVESTING_ON?'enabled':'disabled',investing_feeds:INVESTING_FEEDS.length,investing_errors:investingErrors.slice(0,10),store_errors:storeErrors.slice(0,10)})
}
Deno.serve(async (req)=>{ try{ return await run(req) }catch(e){ return J({error:String(e&&e.message||e)}) } })
