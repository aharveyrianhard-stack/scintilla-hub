import json,sys,time,re,os
S=sys.argv[1]; wav=S+'/audio/a.wav'; DUR=654.9
ref=[r for r in json.load(open(S+'/data/yt_transcripts.json')) if r['video_id']=='_4_lvPcaT_g'][0]['text']
def norm(t): return re.sub(r"[^a-z0-9' ]"," ",t.lower()).split()
def wer(r,h):
    r,h=norm(r),norm(h); prev=list(range(len(h)+1))
    for i,rw in enumerate(r,1):
        cur=[i]+[0]*len(h)
        for j,hw in enumerate(h,1): cur[j]=min(prev[j]+1,cur[j-1]+1,prev[j-1]+(rw!=hw))
        prev=cur
    return prev[-1]/max(1,len(r))
out=[]
from faster_whisper import WhisperModel
for name,threads in [('base',4),('small',4),('small',2),('large-v3-turbo',4)]:
    t0=time.time(); m=WhisperModel(name,device='cpu',compute_type='int8',cpu_threads=threads,download_root=S+'/hf/fw'); load=time.time()-t0
    t0=time.time(); segs,info=m.transcribe(wav,beam_size=1,vad_filter=True); txt=' '.join(s.text for s in segs); el=time.time()-t0
    out.append({'engine':'faster-whisper (CTranslate2, CPU int8)','model':name,'cpu_threads':threads,'seconds_for_655s_audio':round(el,1),'times_faster_than_real_time':round(DUR/el,1),'minutes_per_hour_of_video':round(el/DUR*60,1),'word_error_vs_human_captions':round(wer(ref,txt),3),'load_s':round(load,1)})
    print(out[-1],flush=True); del m
import mlx_whisper
for repo in ['mlx-community/whisper-large-v3-turbo','mlx-community/whisper-small-mlx']:
    try:
        t0=time.time(); r=mlx_whisper.transcribe(wav,path_or_hf_repo=repo); el=time.time()-t0
        t0=time.time(); r=mlx_whisper.transcribe(wav,path_or_hf_repo=repo); el2=time.time()-t0
        out.append({'engine':'mlx-whisper (Metal)','model':repo.split('/')[-1],'seconds_for_655s_audio':round(el2,1),'first_run_incl_download_s':round(el,1),'times_faster_than_real_time':round(DUR/el2,1),'minutes_per_hour_of_video':round(el2/DUR*60,1),'word_error_vs_human_captions':round(wer(ref,r['text']),3)})
        print(out[-1],flush=True)
    except Exception as e: print('FAIL',repo,repr(e)[:200])
json.dump(out,open(S+'/data/whisper_timing.json','w'),indent=1)
