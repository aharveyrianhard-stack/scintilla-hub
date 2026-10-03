import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const SB_URL=Deno.env.get('SUPABASE_URL')||''
const SB_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
// v3: search-ticker cap raised 8 → 10 (funded by retiring the overnight search runs)
const MAX=10
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'}
const J=(o:any,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{'Content-Type':'application/json',...CORS}})
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS})
  const sb=createClient(SB_URL,SB_KEY)
  const {data:fav}=await sb.from('hub_favorites').select('ticker')
  const favTk=[...new Set((fav||[]).map((f:any)=>f.ticker).filter(Boolean))]
  const {data:coh}=await sb.from('ticker_cohorts').select('ticker,cohort,is_primary').in('ticker',favTk)
  const cmap:Record<string,string>={}
  for(const r of (coh||[])){ if(!(r.ticker in cmap) || r.is_primary) cmap[r.ticker]=r.cohort }
  const rank=(c:string)=> c==='INDEXES' ? '0' : ('1_'+(c||'ZZZ'))
  const favorites=favTk.map((t:string)=>({ticker:t,cohort:cmap[t]||'OTHER'}))
    .sort((a,b)=>{ const ra=rank(a.cohort), rb=rank(b.cohort); if(ra!==rb) return ra<rb?-1:1; return a.ticker<b.ticker?-1:(a.ticker>b.ticker?1:0); })
  if(req.method==='POST'){
    let body:any={}; try{body=await req.json()}catch(_){}
    const favSet=new Set(favTk)
    let tickers=(body.tickers||[]).map((s:any)=>String(s).trim().toUpperCase()).filter(Boolean)
    tickers=[...new Set(tickers)].filter((t:string)=>favSet.has(t)).slice(0,MAX)
    await sb.from('app_config').upsert({key:'yt_search_tickers',value:tickers.join(',')})
    return J({ok:true,searched:tickers})
  }
  const {data:c2}=await sb.from('app_config').select('value').eq('key','yt_search_tickers').maybeSingle()
  const searched=((c2&&c2.value)||'').split(',').map((s:string)=>s.trim().toUpperCase()).filter(Boolean)
  return J({favorites,searched,max:MAX})
})
