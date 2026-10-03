import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-ignore  plain ESM shared with youtube-feed and the Node tests
import { searchList, dayPlan, bestCohort, NEVER_SEARCH, SEARCH_BUDGET_UNITS, DAILY_QUOTA, COST_PER_SEARCH } from '../_shared/yt-search-plan.mjs'
const SB_URL=Deno.env.get('SUPABASE_URL')||''
const SB_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
// v3: search-ticker cap raised 8 → 10 (funded by retiring the overnight search runs)
// v4 (Y1, 2 Oct): the searches follow the RADAR list (station_lists, list = radar), SPY and QQQ never —
//   GET says so (source:'radar') and the Hub window shows that list read-only; POST no longer changes
//   what is searched and says so. The cohort read asked for a column ticker_cohorts does not have
//   (is_primary), so it failed and every name fell into OTHER; it now reads ticker + cohort and keeps the
//   most specific cohort. GET ?status=1 returns only the YouTube jobs' last-run times for the Hub's
//   "updated" line (no key, no token — times and counts only).
const MAX=10
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'}
const J=(o:any,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{'Content-Type':'application/json',...CORS}})
const parse=(v:any)=>{try{return JSON.parse(v||'null')}catch(_){return null}}
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:CORS})
  const sb=createClient(SB_URL,SB_KEY)
  const u=new URL(req.url)
  if(req.method==='GET' && u.searchParams.get('status')==='1'){
    const {data:cfg}=await sb.from('app_config').select('key,value').in('key',['yt_rss_result','yt_feed_result','sentiment_youtube_last'])
    const c:Record<string,any>={}; for(const r of (cfg||[])) c[r.key]=parse(r.value)
    const rss=c.yt_rss_result||{}, feed=c.yt_feed_result||{}, sent=c.sentiment_youtube_last||{}
    const fails=Object.values(rss.accounts||{}).filter((a:any)=>a&&a.error).length
    return J({jobs:{
      subscriptions:{at:rss.at||null,seen:rss.rss_seen??null,new_videos:rss.new_videos??null,rss_failed:rss.rss_failed??null,accounts_not_refreshing:fails},
      searches:{at:feed.at||null,searched:feed.searchTickers||[],searches_today:(feed.plan&&feed.plan.searches_today)??null,error:feed.searchErr||null},
      sentiment:{at:sent.ran_utc||null,clips_read:sent.clips_read??null}}})
  }
  const {data:radar}=await sb.from('station_lists').select('ticker,position').eq('list','radar').order('position')
  const radarAll=(radar||[]).map((r:any)=>String(r.ticker||'').toUpperCase()).filter(Boolean)
  const searched=searchList(radar||[])
  const {data:coh}=await sb.from('ticker_cohorts').select('ticker,cohort').in('ticker',radarAll.length?radarAll:['-'])
  const cl:Record<string,string[]>={}
  for(const r of (coh||[])){ (cl[r.ticker]=cl[r.ticker]||[]).push(String(r.cohort||'')) }
  const rank=(c:string)=> c==='INDEXES' ? '0' : ('1_'+(c||'ZZZ'))
  const radarRows=radarAll.map((t:string)=>({ticker:t,cohort:cl[t]?bestCohort(cl[t]):'OTHER',searched:searched.includes(t)}))
    .sort((a,b)=>{ const ra=rank(a.cohort), rb=rank(b.cohort); if(ra!==rb) return ra<rb?-1:1; return a.ticker<b.ticker?-1:(a.ticker>b.ticker?1:0); })
  if(req.method==='POST'){
    return J({ok:false,source:'radar',searched,error:'searches follow the RADAR list — change RADAR to change them'},409)
  }
  const {data:c2}=await sb.from('app_config').select('value').eq('key','yt_feed_result').maybeSingle()
  const feed=parse(c2&&c2.value)||{}
  const every=(feed.plan&&feed.plan.every_min)||20
  return J({source:'radar',radar:radarRows,searched,excluded:NEVER_SEARCH,max:searched.length,
    plan:{...dayPlan(searched.length,every,SEARCH_BUDGET_UNITS),every_min:every,daily_quota:DAILY_QUOTA,cost_per_search:COST_PER_SEARCH,
      searches_today:(feed.plan&&feed.plan.searches_today)??null,last_run:feed.at||null,last_searched:feed.searchTickers||[]}})
})
