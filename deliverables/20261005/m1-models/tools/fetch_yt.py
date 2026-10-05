import json,sys,time
from youtube_transcript_api import YouTubeTranscriptApi
S=sys.argv[1]
rows=json.load(open(S+'/data/yt60_raw.json'))['rows']
api=YouTubeTranscriptApi()
out=[]; ok=0
for r in rows:
    t0=time.time(); rec=dict(r)
    try:
        tl=api.list(r['video_id']); tr=None
        try: tr=tl.find_transcript(['en','en-US','en-GB'])
        except Exception: tr=next(iter(tl))
        f=tr.fetch()
        segs=[s.text for s in f]
        rec.update(status='ok',lang=tr.language_code,generated=bool(tr.is_generated),segments=len(segs),text=' '.join(' '.join(segs).split()))
        rec['chars']=len(rec['text']); ok+=1
    except Exception as e:
        rec.update(status='fail',error=type(e).__name__)
    rec['fetch_s']=round(time.time()-t0,2); out.append(rec)
    print(r['video_id'],rec['status'],rec.get('chars'),rec.get('generated'),rec.get('error',''),rec['fetch_s'],flush=True)
    time.sleep(1.0)
    if ok>=26: break
json.dump(out,open(S+'/data/yt_transcripts.json','w'))
print('tried',len(out),'ok',ok)
