import json,random,collections,sys,html
sys.path.insert(0,'job'); import lf_chunk as L, lf_ticker as T
random.seed(20261005)
gaz=T.Gazetteer(json.load(open('data/gaz.json')))
stats=collections.Counter(); pool={'news':[], 'speech':[]}
# ---- news
arts=[r for r in json.load(open('data/news_full.json')) if r['article_chars']>1200]
random.shuffle(arts); site=collections.Counter(); tick=collections.Counter(); docs=[]
for r in arts:
    if site[r['site'].lower()]>=7 or tick[r['ticker']]>=2: continue
    site[r['site'].lower()]+=1; tick[r['ticker']]+=1; docs.append(r)
docs=docs[:95]
for r in docs:
    cs=L.chunk_article(r['article'])
    for k,c in enumerate(cs):
        why=L.drop_reason(c['text'],'news',len(gaz.mentions(c['text']))); stats['news_'+(why or 'kept')]+=1
        c.update(kind='news',doc=r['url'],doc_title=r['title'],filed=r['ticker'],site=r['site'],k=k,of=len(cs),drop=why)
        pool['news'].append(c)
# ---- speech
vids=[]
m1=json.load(open('data/m1_yt_transcripts.json'))
for r in m1:
    if r.get('status')=='ok': vids.append(dict(video_id=r['video_id'],title=html.unescape(r['title']),channel=r['channel_title'],filed=r.get('ticker'),segs=[[None,r['text']]],src='m1-mac-captions'))
meta={r['video_id']:r for r in json.load(open('data/yt_pick.json'))}
for l in open('data/yt_fly.ndjson'):
    r=json.loads(l)
    if r['status']=='ok':
        m=meta[r['video_id']]; vids.append(dict(video_id=r['video_id'],title=html.unescape(m['title']),channel=m['channel_title'],filed=m.get('ticker'),segs=r['segs'],src='fly-captions'))
json.dump(vids,open('data/yt_docs.json','w'))
for v in vids:
    cs=L.chunk_transcript(v['segs'])
    for k,c in enumerate(cs):
        why=L.drop_reason(c['text'],'speech',len(gaz.mentions(c['text']))); stats['speech_'+(why or 'kept')]+=1
        c.update(kind='speech',doc=v['video_id'],doc_title=v['title'],filed=v['filed'],site=v['channel'],k=k,of=len(cs),drop=why)
        pool['speech'].append(c)
print(dict(stats)); print('news docs',len(docs),'videos',len(vids))
# ---- sample 150 + 150 kept chunks, spread over documents
def sample(kind,n):
    by=collections.defaultdict(list)
    for c in pool[kind]:
        if not c['drop']: by[c['doc']].append(c)
    for d in by: random.shuffle(by[d])
    out=[]; i=0
    while len(out)<n:
        took=False
        for d in sorted(by):
            if i<len(by[d]) and len(out)<n: out.append(by[d][i]); took=True
        if not took: break
        i+=1
    return out
S=sample('news',150)+sample('speech',150)
S.sort(key=lambda c:(c['kind'],c['doc'],c['k']))
for i,c in enumerate(S):
    c['id']=('N' if c['kind']=='news' else 'Y')+f"{i%150+1 if c['kind']=='news' else i-149:03d}"
    c['gaz_mentions']=gaz.mentions(c['text']); c['gaz_about']=gaz.about(c['text'],c['filed'])[0]
json.dump(S,open('data/testset.json','w'),ensure_ascii=False,indent=0)
json.dump({'stats':dict(stats),'dropped_examples':[{'kind':c['kind'],'why':c['drop'],'text':c['text'][:240]} for c in random.sample([c for k in pool for c in pool[k] if c['drop'] and c['drop']!='too_short'],24)]},open('data/filter_stats.json','w'),ensure_ascii=False,indent=1)
import statistics
for k in ('news','speech'):
    cs=[c for c in S if c['kind']==k]; print(k,len(cs),'docs',len({c['doc'] for c in cs}),'median words',statistics.median(len(c['text'].split()) for c in cs),'max',max(len(c['text'].split()) for c in cs))
