import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const SB_URL=Deno.env.get('SUPABASE_URL')||''
const SB_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
const GLOBAL='00000000-0000-0000-0000-000000000000'
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}
const J=(o:any,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{'Content-Type':'application/json',...CORS}})
Deno.serve(async (req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS})
  try{
    const sb=createClient(SB_URL,SB_KEY)
    let owner=GLOBAL
    const auth=req.headers.get('Authorization')||''
    const tok=auth.startsWith('Bearer ')?auth.slice(7):''
    if(tok){ try{ const {data}=await sb.auth.getUser(tok); if(data&&data.user&&data.user.id) owner=data.user.id }catch(_){ } }
    const b=await req.json()
    const a=String(b.action||'')
    const tk=b.ticker
    // FAVORITES: single global list (the hub reads hub_favorites owner-agnostically). Always write/remove
    // under GLOBAL, and fav_remove deletes the ticker across ALL owners so a star can never resurrect from
    // a stray owner_id (fixed 2026-07-22 — the split-owner resurrection bug).
    if(a==='fav_add'){const {error}=await sb.from('hub_favorites').upsert({ticker:tk,owner_id:GLOBAL},{onConflict:'ticker,owner_id'});if(error)throw error;return J({ok:true,owner:GLOBAL})}
    if(a==='fav_remove'){const {error}=await sb.from('hub_favorites').delete().eq('ticker',tk);if(error)throw error;return J({ok:true,removed_all_owners:true})}
    if(a==='cohort_set'){
      const {error:e1}=await sb.from('ticker_cohorts').upsert({ticker:tk,cohort:b.cohort,is_primary:b.is_primary===true,owner_id:owner},{onConflict:'ticker,cohort,owner_id'});if(e1)throw e1
      const {error:e2}=await sb.from('cohorts').delete().eq('ticker',tk);if(e2)throw e2
      const {error:e3}=await sb.from('cohorts').insert({ticker:tk,cohort:b.cohort});if(e3)throw e3
      return J({ok:true,owner,moved_in_cohorts:true})
    }
    if(a==='cohort_remove'){const {error}=await sb.from('ticker_cohorts').delete().eq('ticker',tk).eq('cohort',b.cohort).eq('owner_id',owner);if(error)throw error;return J({ok:true,owner})}
    if(a==='block_add'){const {error}=await sb.from('ticker_blocklist').upsert({ticker:tk,reason:b.reason||'hub',owner_id:owner},{onConflict:'ticker,owner_id'});if(error)throw error;return J({ok:true,owner})}
    if(a==='block_remove'){const {error}=await sb.from('ticker_blocklist').delete().eq('ticker',tk).eq('owner_id',owner);if(error)throw error;return J({ok:true,owner})}
    if(a==='weights_save'){
      const now=Math.floor(Date.now()/1000)
      const rows=(b.rows||[]).filter((r:any)=>r&&r.dim&&r.key).map((r:any)=>({dim:String(r.dim),key:String(r.key),weight:Number(r.weight),enabled:r.enabled!==false,updated_ts:now,owner_id:owner}))
      if(!rows.length)return J({error:'no rows'},400)
      const {error}=await sb.from('operator_weights').upsert(rows,{onConflict:'dim,key,owner_id'});if(error)throw error
      let recomputed=false, rpc_err=null
      if(owner===GLOBAL){ const {error:re}=await sb.rpc('refresh_geiger'); recomputed=!re; rpc_err=re?String((re as any).message||re):null }
      return J({ok:true,saved:rows.length,owner,recomputed,rpc_err})
    }
    // 24 Sep (M39): Alan's swipes on the allocation page. One row per choice, appended, never
    // updated: right = interested, left = pass, up = watch. Read back by the page to weight itself.
    if(a==='allocation_vote'){
      const choice=String(b.choice||'')
      if(!['right','left','up'].includes(choice))return J({error:'bad choice: '+choice},400)
      const t=String(tk||'').toUpperCase().trim()
      if(!/^[A-Z0-9.\-^=]{1,15}$/.test(t))return J({error:'bad ticker'},400)
      const arr=(v:any)=>Array.isArray(v)?v.map((x:any)=>String(x)).slice(0,40):null
      const num=(v:any)=>v==null||v===''||!isFinite(Number(v))?null:Number(v)
      const {error}=await sb.from('allocation_operator_votes').insert({ticker:t,choice,owner_id:GLOBAL,
        sector:b.sector?String(b.sector):null,cohorts:arr(b.cohorts),kinds:arr(b.kinds),
        score:num(b.score),quality:b.quality==null?null:Math.round(Number(b.quality))||null,dist_200d:num(b.dist_200d),
        voted_at:b.at&&!isNaN(Date.parse(b.at))?new Date(b.at).toISOString():new Date().toISOString()})
      if(error)throw error
      return J({ok:true,stored:'allocation_operator_votes'})
    }
    return J({error:'unknown action: '+a},400)
  }catch(e){return J({error:String((e as any)&&(e as any).message||e)},500)}
})
