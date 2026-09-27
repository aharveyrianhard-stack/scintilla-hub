import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const SB_URL=Deno.env.get('SUPABASE_URL')||''
const SB_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
Deno.serve(async()=>{
  const sb=createClient(SB_URL,SB_KEY)
  const {data:cfg}=await sb.from('app_config').select('value').eq('key','FMP_KEY').maybeSingle()
  const K=(cfg&&cfg.value)?cfg.value.trim():''
  if(!K)return new Response(JSON.stringify({error:'no FMP key'}),{status:500})
  const {data:tk}=await sb.from('composite_staged').select('ticker').eq('tf','D')
  const syms=(tk||[]).map((r:any)=>r.ticker).filter((t:string)=>!t.endsWith('USD'))
  let updated=0; let e=null; let calls=0; let bytes=0
  for(let i=0;i<syms.length;i+=50){
    const batch=syms.slice(i,i+50).join(',')
    try{
      const r=await fetch('https://financialmodelingprep.com/stable/batch-quote?symbols='+batch+'&apikey='+K)
      calls++
      if(!r.ok)continue
      const txt=await r.text(); bytes+=txt.length
      const j=JSON.parse(txt)
      if(Array.isArray(j))for(const q of j){
        if(q.symbol&&q.marketCap!=null){
          const {error}=await sb.from('fundamentals').update({market_cap:q.marketCap,price:q.price}).eq('ticker',q.symbol)
          if(error)e=error.message; else updated++
        }
      }
    }catch(err){e=''+err}
  }
  try{ await sb.from('fmp_bandwidth_log').insert({fn:'mcap-refresh',calls,symbols:syms.length,bytes,status:200,at:new Date().toISOString()}) }catch(_){}
  return new Response(JSON.stringify({updated,total:syms.length,err:e,calls,bytes}),{headers:{'Content-Type':'application/json'}})
})
