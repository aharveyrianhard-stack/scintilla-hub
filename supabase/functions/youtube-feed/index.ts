// SCINTILLA · youtube-feed v11 — TICKER-SEARCH collector only.
// The subscription lane moved to yt-rss-sweep (free RSS, every 5 min) — removed here,
// saving ~30 quota units per run. Search lane unchanged.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const SB_URL=Deno.env.get('SUPABASE_URL')||''
const SB_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
const iso2sec=(d:string)=>{const m=(d||'').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);if(!m)return 0;return (+(m[1]||0))*3600+(+(m[2]||0))*60+(+(m[3]||0))}
const FOREIGN=/[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u
async function yt(path:string,K:string){const r=await fetch('https://www.googleapis.com/youtube/v3/'+path+'&key='+K);const t=await r.text();try{return {status:r.status,j:JSON.parse(t)}}catch(_){return {status:r.status,j:null}}}
async function isShort(vid:string){try{const r=await fetch('https://www.youtube.com/shorts/'+vid,{method:'HEAD',redirect:'manual'});return r.status>=200&&r.status<300}catch(_){return false}}
Deno.serve(async()=>{
  const sb=createClient(SB_URL,SB_KEY)
  const {data:cfg}=await sb.from('app_config').select('key,value').in('key',['YT_API_KEY','yt_search_tickers'])
  const C:any={};for(const r of (cfg||[]))C[r.key]=r.value
  const K=(C['YT_API_KEY']||'').trim()
  if(!K)return new Response(JSON.stringify({error:'missing key'}),{headers:{'Content-Type':'application/json'}})
  const now=Math.floor(Date.now()/1000)
  let searchTk=(C['yt_search_tickers']||'').split(',').map((s:string)=>s.trim().toUpperCase()).filter(Boolean)
  searchTk=[...new Set(searchTk)].slice(0,12)
  const rows:any[]=[]; const vidIds:string[]=[]
  for(const tk of searchTk){
    const {j}=await yt('search?part=snippet&type=video&order=date&maxResults=5&relevanceLanguage=en&regionCode=US&q='+encodeURIComponent('$'+tk+' stock'),K)
    for(const it of ((j&&j.items)||[])){const s=it.snippet; const vid=it.id&&it.id.videoId; if(!vid)continue; vidIds.push(vid)
      rows.push({video_id:vid,channel_id:s.channelId,channel_title:s.channelTitle,title:s.title,description:(s.description||'').slice(0,500),thumbnail:(s.thumbnails&&(s.thumbnails.medium||s.thumbnails.default)||{}).url||null,url:'https://www.youtube.com/watch?v='+vid,published_at:s.publishedAt,source:'search',ticker:tk,updated_ts:now})}
  }
  const dur:Record<string,number>={}; const lang:Record<string,string>={}; const live:Record<string,string>={}
  for(let i=0;i<vidIds.length;i+=50){const ids=[...new Set(vidIds.slice(i,i+50))].join(',')
    const {j}=await yt('videos?part=contentDetails,snippet&id='+ids+'&maxResults=50',K)
    for(const it of ((j&&j.items)||[])){dur[it.id]=iso2sec(it.contentDetails&&it.contentDetails.duration); const s=it.snippet||{}; lang[it.id]=String(s.defaultAudioLanguage||s.defaultLanguage||'').toLowerCase(); live[it.id]=String(s.liveBroadcastContent||'none')}}
  const seen=new Set<string>(); const uniq=rows.filter(r=>{
    if(FOREIGN.test(r.title||''))return false
    const L=lang[r.video_id]||''; if(L && L.slice(0,2)!=='en')return false
    if((live[r.video_id]||'none')==='upcoming')return false
    if(seen.has(r.video_id))return false; seen.add(r.video_id); return true})
  const shortMap:Record<string,boolean>={}
  for(let i=0;i<uniq.length;i+=16){const b=uniq.slice(i,i+16); await Promise.all(b.map(async r=>{shortMap[r.video_id]=await isShort(r.video_id)}))}
  for(const r of uniq){r.duration_sec=dur[r.video_id]||null; r.is_short=shortMap[r.video_id]===true}
  const upcomingIds=Object.keys(live).filter(id=>live[id]==='upcoming')
  if(upcomingIds.length){await sb.from('youtube_videos').delete().in('video_id',upcomingIds)}
  let wrote=0, upErr=null
  for(let i=0;i<uniq.length;i+=200){const {error}=await sb.from('youtube_videos').upsert(uniq.slice(i,i+200),{onConflict:'video_id'}); if(error){upErr=error.message}else{wrote+=uniq.slice(i,i+200).length}}
  await sb.from('app_config').upsert({key:'yt_feed_result',value:JSON.stringify({lane:'search-only (subs → yt-rss-sweep)',searchTickers:searchTk,videos:uniq.length,wrote,shorts:Object.values(shortMap).filter(Boolean).length,dropped_upcoming:upcomingIds.length,upErr,at:new Date().toISOString()})})
  return new Response(JSON.stringify({lane:'search-only',searchTickers:searchTk,videos:uniq.length,wrote,upErr}),{headers:{'Content-Type':'application/json'}})
})
