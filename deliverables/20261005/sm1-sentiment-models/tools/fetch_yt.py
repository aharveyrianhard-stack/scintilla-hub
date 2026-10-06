import json,sys,time,html
from youtube_transcript_api import YouTubeTranscriptApi
rows=json.load(open('data/yt_raw.json'))
api=YouTubeTranscriptApi(); out=[]; ok=0; fails=0
for r in rows:
    t0=time.time(); rec=dict(r); rec['title']=html.unescape(r['title'])
    try:
        tl=api.list(r['video_id'])
        try: tr=tl.find_transcript(['en','en-US','en-GB'])
        except Exception: tr=None
        if tr is None: rec.update(status='fail',error='no_english')
        else:
            f=tr.fetch()
            rec.update(status='ok',lang=tr.language_code,generated=bool(tr.is_generated),segs=[[round(s.start,1),' '.join(s.text.split())] for s in f])
            rec['chars']=sum(len(s[1]) for s in rec['segs']); ok+=1; fails=0
    except Exception as e:
        rec.update(status='fail',error=type(e).__name__); fails+=1
    rec['fetch_s']=round(time.time()-t0,2); out.append(rec)
    print(r['video_id'],rec['status'],rec.get('chars'),rec.get('generated'),rec.get('error',''),rec['fetch_s'],flush=True)
    json.dump(out,open('data/yt_transcripts.json','w'))
    if ok>=int(sys.argv[1]) or fails>=8: break
    time.sleep(0.8)
print('tried',len(out),'ok',ok)
