# Which company is this about? Test on the 100 hand-flagged news rows: is the filed ticker's company actually named in title+snippet?
import json,sys,time,re
S=sys.argv[1]
gaz={r['ticker']:r['name'] for r in json.load(open(S+'/data/gaz_raw.json'))['rows']}
news=json.load(open(S+'/data/news100.json')); NL=json.load(open(S+'/data/news100_labels.json')); notabout=set(NL['not_about_filed_ticker'])
STOP=r'\b(inc\.?|corporation|corp\.?|company|co\.?|ltd\.?|limited|holdings?|group|plc|n\.v\.|s\.a\.|technologies|technology|platforms|class [a-c]|trust|etf|common stock|incorporated|the|and|&|fund|lp|systems|international|global|ishares|spdr|state street|invesco|united states)\b'
def core(name): return ' '.join(re.sub(r'[^a-z0-9 ]',' ',re.sub(STOP,' ',name.lower())).split())
def text(r): return (r['title'] or '')+'. '+(r['snippet'] or '')
def exact_ticker(t,tk): return bool(re.search(r'(?<![A-Za-z])\$?'+re.escape(tk)+r'(?![A-Za-z])',t))
def score(name,pred_about,ms):
    caught=sum((not pred_about[r['i']]) for r in news if r['i'] in notabout); fa=sum((not pred_about[r['i']]) for r in news if r['i'] not in notabout)
    d={'method':name,'wrong_tags_caught_of_12':caught,'good_rows_wrongly_rejected_of_88':fa,'ms_per_row':round(ms,2)}; print(d,flush=True); return d
out=[]
# 1 gazetteer: exact ticker token, or the core of the company name (all its words) appears
t0=time.time(); p={}
for r in news:
    t=text(r); c=core(gaz.get(r['ticker'],'')); tl=re.sub(r'[^a-z0-9 ]',' ',t.lower())
    p[r['i']]=exact_ticker(t,r['ticker']) or (len(c)>2 and (c in tl or c.split()[0] in tl.split() and len(c.split()[0])>3))
out.append(score('ticker + company-name list (plain matching, no model)',p,(time.time()-t0)/len(news)*1000))
def link(ents,tk):
    c=core(gaz.get(tk,'')); 
    for e in ents:
        e2=core(e)
        if not e2: continue
        if e.strip('$').upper()==tk or (c and (e2==c or (len(e2)>3 and (e2 in c or c in e2)))): return True
    return False
# 2 spaCy small NER (ORG/PRODUCT/GPE) -> name list
import spacy
nlp=spacy.load('en_core_web_sm'); t0=time.time(); p={}
for r in news:
    doc=nlp(text(r)); p[r['i']]=exact_ticker(text(r),r['ticker']) or link([e.text for e in doc.ents if e.label_ in ('ORG','PRODUCT','PERSON','GPE','NORP','FAC')],r['ticker'])
out.append(score('spaCy en_core_web_sm entities -> name list',p,(time.time()-t0)/len(news)*1000))
# 3 GLiNER zero-shot (company, stock ticker, fund) -> name list
from gliner import GLiNER
g=GLiNER.from_pretrained('urchade/gliner_medium-v2.1'); t0=time.time(); p={}
for r in news:
    ents=g.predict_entities(text(r)[:1500],['company','stock ticker','fund','commodity'],threshold=0.4)
    p[r['i']]=exact_ticker(text(r),r['ticker']) or link([e['text'] for e in ents],r['ticker'])
out.append(score('GLiNER medium v2.1 (company / stock ticker / fund) -> name list',p,(time.time()-t0)/len(news)*1000))
json.dump(out,open(S+'/data/ner_test.json','w'),indent=1)
