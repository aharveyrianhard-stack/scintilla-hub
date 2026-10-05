# Builds M1-MODELS.html from models.json and the bake-off files. Usage: python3 build_report.py <deliverable dir>
import json,sys,html
D=sys.argv[1]; e=html.escape
M=json.load(open(D+'/models.json')); X=json.load(open(D+'/bakeoff/x-short-text.json')); L=json.load(open(D+'/bakeoff/long-form.json')); T=json.load(open(D+'/bakeoff/transcripts-and-speech.json')); E=json.load(open(D+'/bakeoff/extras.json'))
G=json.load(open(D+'/grok-bot-channel.json')); XF=json.load(open(D+'/xfeed-recommendation.json'))
def vcls(v):
    w=v.split(' ')[0]; return {'ADOPT':'v-adopt','KEEP':'v-adopt','TRY':'v-try','NO':'v-no','REPLACE':'v-no'}.get(w,'v-try')
def bar(a,base):
    return f'<span class="bar {"up" if a>base else "down"}" style="width:{round(a*100)}px"></span><b class="{"green" if a>base else "red"}">{round(a*100)}%</b>'
rows=M['rows']
# ---- adopt table: only ADOPT / KEEP / REPLACE / TRY rows, grouped by job
order=[]; 
for r in rows:
    if r['job'] not in order: order.append(r['job'])
adopt=''
for j in order:
    first=True
    for r in [r for r in rows if r['job']==j and r['verdict'].split(' ')[0] in ('ADOPT','KEEP','REPLACE')]:
        adopt+=f'<tr><td>{e(j) if first else ""}</td><td><b>{e(r["candidate"])}</b></td><td>{e(r.get("runs_where","-"))}</td><td>{e(r.get("cost","-"))}</td><td class="v {vcls(r["verdict"])}">{e(r["verdict"])}</td><td>{e(r["why"])}</td></tr>'; first=False
full=''
for j in order:
    full+=f'<tr><th colspan=5 class=grp>{e(j)}</th></tr>'
    for r in [r for r in rows if r['job']==j]:
        full+=f'<tr><td><b>{e(r["candidate"])}</b><div class=dimsm>{e(r.get("licence","-"))} · {e(r.get("needs","-"))}</div></td><td>{e(r.get("runs_where","-"))}</td><td>{e(r.get("cost","-"))}</td><td class="v {vcls(r["verdict"])}">{e(r["verdict"])}</td><td>{e(r["why"])}</td></tr>'
xb=X['always_bullish_accuracy']
xt=''.join(f'<tr><td>{e(r["model"].replace("mlx-community/",""))}</td><td class=nw>{bar(r["accuracy_100"],xb)}</td><td class=mono>{r["f1_bull"]:.2f} / {r["f1_bear"]:.2f} / {r["f1_neutral"]:.2f}</td><td class="mono {"red" if r["opposite_calls_100"]>=8 else ""}">{r["opposite_calls_100"]}</td><td class=mono>{r["ms_per_item"]:g} ms</td></tr>' for r in X['results'])
def lt(sec,base,n=None):
    rs=L[sec][:n] if n else L[sec]
    return ''.join(f'<tr><td>{e(r["method"].replace("-4bit",""))}</td><td class=nw>{bar(r["accuracy"],base)}</td><td class="mono {"red" if r["opposite_calls"]>=3 else ""}">{r["opposite_calls"]}</td><td class=mono>{r["ms"]:g} ms</td></tr>' for r in rs)
wt=''.join(f'<tr><td>{e(r["engine"])}</td><td>{e(r["model"])}{" · "+str(r["cpu_threads"])+" threads" if r.get("cpu_threads") else ""}</td><td class=mono>{r["times_faster_than_real_time"]:g}×</td><td class=mono>{r["minutes_per_hour_of_video"]:g} min</td></tr>' for r in T['speech_to_text']['runs'])
et=''.join(f'<tr><td>{e(r["model"])}</td><td class=mono>{r.get("repost_to_original_recall_at_1","—") if "skipped" not in r else "not run"}</td><td class=mono>{r.get("cpu_headlines_per_s","—")}</td><td class=mono>{r.get("mps_headlines_per_s","—")}</td><td class=mono>{r.get("dim","—")}</td></tr>' for r in E['embeddings']['results'])
nt=''.join(f'<tr><td>{e(r["method"])}</td><td class=mono>{r["wrong_tags_caught_of_12"]} of 12</td><td class=mono>{r["good_rows_wrongly_rejected_of_88"]} of 88</td><td class=mono>{r["ms_per_row"]:g} ms</td></tr>' for r in E['ticker_linking']['results'])
at=''.join(f'<tr><td>{e(r["method"])}</td><td class=mono>{r["share_of_name_days_flagged"]*100:.1f}%</td><td class=mono>{r["overlap_with_ours_jaccard"]:.2f}</td><td class="mono {"green" if r["next_day_move_vs_normal"]>=1.2 else ""}">{r["next_day_move_vs_normal"]:.2f}×</td></tr>' for r in E['anomaly']['results'])
A=G['answers']; P=G['proposed_protocol']; R=XF['recommendation']; W=XF['what_happened']
routes=''.join(f'<tr><td class=mono>{e(k)}</td><td>{e(v)}</td></tr>' for k,v in A['1_deep_links']['routes'].items())
opts=''.join(f'<tr><td><b>{e(o["option"])}</b></td><td>{e(o["evidence"])}</td><td>{e(str(o["cost"]))}</td><td class="v {"v-adopt" if o["verdict"].startswith("REC") else "v-no" if o["verdict"].startswith("NO") else "v-try"}">{e(o["verdict"])}</td></tr>' for o in XF['options'])
srcs=sorted({r.get('source','') for r in rows if r.get('source')})
vc=M['verdict_counts']
page=f'''<!doctype html>
<html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>M1 — open-source models Scintilla can run</title>
<style>
:root{{--bg:#0b0b0c;--panel:#131315;--line:#2a2a2d;--text:#cfcfd2;--dim:#8d8d92;--up:#3ddc84;--down:#e5484d;--amber:#d1a04a}}
*{{box-sizing:border-box}} body{{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 -apple-system,Inter,Helvetica,Arial,sans-serif;padding:24px 16px 64px}}
main{{max-width:1240px;margin:0 auto}} h1{{font-size:22px;margin:0 0 4px;letter-spacing:.2px}} h2{{font-size:16px;margin:36px 0 10px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim)}} h3{{font-size:14px;margin:18px 0 6px}}
.sub{{color:var(--dim);font-family:ui-monospace,Menlo,monospace;font-size:12px}} .panel{{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:14px 16px;margin:12px 0}}
.mono{{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;white-space:nowrap}} .nw{{white-space:nowrap}} table{{border-collapse:collapse;width:100%;font-size:12px}} th,td{{border-top:1px solid var(--line);padding:6px 8px;vertical-align:top;text-align:left}} th{{color:var(--dim);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.06em}} th.grp{{color:var(--text);background:#18181b;font-size:11.5px}}
.wrap{{overflow-x:auto;max-width:100%}} .wrap table{{min-width:680px}} p .mono,li .mono{{white-space:normal;word-break:break-word}} .panel{{min-width:0;overflow-wrap:anywhere}} td,th{{overflow-wrap:normal}} .kpi b{{overflow-wrap:anywhere}} .v{{font-family:ui-monospace,Menlo,monospace;font-weight:600;font-size:11.5px}} .v-adopt{{color:var(--up)}} .v-try{{color:var(--amber)}} .v-no{{color:var(--down)}}
.kpi{{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0}} .kpi div{{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:10px 12px}} .kpi b{{display:block;font-size:22px;font-family:ui-monospace,Menlo,monospace}} .kpi span{{color:var(--dim);font-size:12px}}
.bar{{display:inline-block;height:9px;border-radius:2px;margin-right:8px;vertical-align:middle}} .bar.up{{background:var(--up)}} .bar.down{{background:var(--down)}}
.dimsm{{color:var(--dim);font-size:11px}} a{{color:var(--text)}} li{{margin:4px 0}} .green{{color:var(--up)}} .red{{color:var(--down)}} .amber{{color:var(--amber)}}
details.sc-pagespecs{{margin-top:40px;color:var(--dim)}} details.sc-pagespecs summary{{cursor:pointer;font-family:ui-monospace,Menlo,monospace;letter-spacing:.12em;font-size:12px}} details.sc-pagespecs li{{font-size:12px;word-break:break-word}}
</style></head><body><main>
<span data-scnav-slot></span><h1>Open-source models Scintilla can run — the review, the bake-offs, the Grok Bot channel, the X feed</h1>
<div class=sub>M1 · 5 Oct 2026 · branch hub/m1-models-20261005 · report only: nothing installed outside a scratch folder, nothing deployed, no table written, no paid model called</div>

<h2>What to adopt</h2>
<div class=kpi><div><b>{len(rows)}</b><span>candidates reviewed</span></div><div><b class=green>{vc["ADOPT"]+vc["KEEP"]}</b><span>adopt / keep</span></div><div><b class=amber>{vc["TRY"]}</b><span>try</span></div><div><b class=red>{vc["NO"]+vc["REPLACE"]}</b><span>no / replace</span></div><div><b>0</b><span>dollars spent</span></div></div>
<div class="panel wrap"><table><tr><th>Job</th><th>Model</th><th>Runs where</th><th>Cost</th><th>Verdict</th><th>Why</th></tr>{adopt}</table></div>

<h2>Bake-off 1 — X posts (300 real posts, 100 hand-labelled)</h2>
<div class="panel wrap"><table><tr><th>Model</th><th>Right, of 100 (guessing "bullish" every time = {round(xb*100)}%)</th><th>Score on bullish / bearish / neutral</th><th>Opposite calls</th><th>Time per post</th></tr>{xt}</table></div>

<h2>Bake-off 2 — news and YouTube transcripts</h2>
<div class=panel><b>News rows as we store them</b> — 100 rows, title + snippet (guessing "neutral" every time = 60%)<div class=wrap><table><tr><th>Method</th><th>Right, of 100</th><th>Opposite calls</th><th>Time per row</th></tr>{lt("news_snippet",0.60)}</table></div></div>
<div class=panel><b>Full articles</b> — 58 fetched for this test (guessing "neutral" = 64%)<div class=wrap><table><tr><th>Method</th><th>Right, of 58</th><th>Opposite calls</th><th>Time per article</th></tr>{lt("news_article",0.64)}</table></div></div>
<div class=panel><b>YouTube transcripts</b> — 20 videos, 8 to 47 minutes (guessing "neutral" = 50%) — top 10 of 24 methods<div class=wrap><table><tr><th>Method</th><th>Right, of 20</th><th>Opposite calls</th><th>Time per video</th></tr>{lt("youtube",0.50,10)}</table></div></div>

<h2>Transcripts: captions first, speech-to-text second</h2>
<div class=kpi><div><b class=green>{T["captions_first"]["answered"]} of {T["captions_first"]["videos_tried"]}</b><span>videos gave free captions</span></div><div><b>{T["captions_first"]["median_fetch_s"]} s</b><span>per caption fetch</span></div><div><b class=red>0</b><span>rows in our youtube_transcripts table today</span></div></div>
<div class="panel wrap"><table><tr><th>Engine</th><th>Model</th><th>Faster than real time</th><th>Compute per hour of video</th></tr>{wt}</table></div>

<h2>The other jobs</h2>
<div class=panel><b>Embeddings</b> — find the full original of a cut-off repost among 5,500 posts<div class=wrap><table><tr><th>Model</th><th>Found first (of 1.0)</th><th>Headlines / s, CPU</th><th>Headlines / s, Metal</th><th>Numbers per text</th></tr>{et}</table></div></div>
<div class=panel><b>Which company is this about</b> — 12 of our 100 news rows are filed under the wrong ticker<div class=wrap><table><tr><th>Method</th><th>Wrong tags caught</th><th>Good rows wrongly rejected</th><th>Time per row</th></tr>{nt}</table></div></div>
<div class=panel><b>Scintillas detector</b> — 89 names × 250 days<div class=wrap><table><tr><th>Method</th><th>Name-days flagged</th><th>Same flags as ours (1 = all)</th><th>Size of the next day vs a normal day</th></tr>{at}</table></div></div>

<h2>Grok Bot — how we exchange work with it</h2>
<div class=kpi><div><b class=red>HUMAN ONLY</b><span>the channel today</span></div><div><b class=amber>1 paste</b><span>by Alan to make it machine-to-machine</span></div><div><b>0</b><span>captured posts on this Mac</span></div></div>
<div class=panel><p><b>{e(G["the_channel_in_one_line"])}</b></p>
<p><b>Deep links</b> open things; they cannot speak. <span class=mono>{e(A["1_deep_links"]["found"].split(" (")[0])}</span></p>
<div class=wrap><table><tr><th>Link</th><th>What it does</th></tr>{routes}</table></div>
<p><b>Local server:</b> {e(A["2_local_server_cli_mcp_watched_folder"]["local_server"])} <b>Command line:</b> {e(A["2_local_server_cli_mcp_watched_folder"]["cli"])} <b>MCP:</b> {e(A["2_local_server_cli_mcp_watched_folder"]["mcp"])} <b>Watched folder:</b> none found.</p>
<p><b>Where its work lives:</b> {e(G["app"]["where_the_agent_works"])} On this Mac the app keeps only a small copy of the chat text: the FinBERT conversation is there (148 entries, 3 to 4 Oct), but it holds no captured posts, so our collector cannot read the feed from it.</p></div>
<div class=panel><h3 style="margin-top:0">Proposed exchange — Dispatch &amp; Return</h3>
<ol><li><b>Set up once, by a person.</b> {e(" ".join(P["setup_once_by_a_person"]))}</li>
<li><b>Dispatch (what we send).</b> {e(P["dispatch_what_we_send"]["transport"])} Job 1, the X feed: {e(P["dispatch_what_we_send"]["DISPATCH-0_xfeed_job_spec"]["source"])}, {e(P["dispatch_what_we_send"]["DISPATCH-0_xfeed_job_spec"]["cadence"])}. Job 2, the FinBERT bake-off: the same 300 posts we scored here, so its FinBERT can be marked on the same sheet.</li>
<li><b>Return (what it sends back).</b> {e(P["return_what_it_sends_back"]["transport"])} Its last line: <span class=mono>{e(P["return_what_it_sends_back"]["return_line"])}</span></li>
<li><b>Into our tables.</b> {e(" ".join(P["how_its_output_enters_our_tables"]))}</li></ol></div>

<h2>The X feed — one recommendation</h2>
<div class=panel><p><b>{e(R["one_line"])}</b></p>
<div class=wrap><table><tr><th>Option</th><th>Evidence</th><th>Cost</th><th>Verdict</th></tr>{opts}</table></div>
<h3>What happened to it</h3><ul>{"".join("<li>"+e(t)+"</li>" for t in W["timeline_utc"])}</ul>
<p><b>What deleted it:</b> {e(W["what_deleted_it"])}</p>
<h3>Rules it touches</h3><ul>{"".join("<li>"+e(t)+"</li>" for t in R["neighbours_checked_together"])}</ul></div>

<h2>Every candidate</h2>
<div class="panel wrap"><table><tr><th>Candidate · licence · needs</th><th>Runs where</th><th>Cost</th><th>Verdict</th><th>Why</th></tr>{full}</table></div>

<h2>What could be wrong, and what was not done</h2>
<div class=panel><ul>
<li><b>Small answer sheets, one marker.</b> 100 X posts, 100 news rows and 20 videos, labelled by the reviewing model, not by Alan. A gap under about 10 points (20 for videos) is a tie. The order of the top four on X posts could change with Alan's own labels.</li>
<li><b>ADOPT means "best of what was measured, stage it beside what we have".</b> Nothing here was switched on. The word list still scores the Hub.</li>
<li><b>Bearish is the weak spot everywhere.</b> Only 10 of the 100 X labels and 3 of the 20 videos are bearish, and the best transcript method missed all three.</li>
<li><b>Full-article and transcript labels were made from short text</b> (the title + snippet; the passages naming the ticker), so those two tables under-rate methods that read more than the marker did.</li>
<li><b>No Fly machine was started.</b> Fly speeds and costs are estimates from Mac CPU timings; Fly has no GPU machines to price.</li>
<li><b>Grok Bot was not started, messaged or changed.</b> What its webhook accepts, whether it is connected to GitHub, and what its capture holds were not verifiable from this Mac.</li>
<li><b>The X collector was not restored.</b> The restore was rehearsed in a scratch folder only (its 118 tests pass); whether its X sign-in still works is untested.</li>
<li><b>Not run:</b> nomic-embed (needs remote code), Ollama / llama.cpp / whisper.cpp (system installs), Prophet, Kats, tsfresh (judged from their documentation).</li>
</ul></div>

<details class=sc-pagespecs><summary>PAGE SPECS</summary>
<ul>
<li><b>What this page shows.</b> A review of open-source models for seven Scintilla jobs, each measured on our own data where possible, with a verdict per candidate; how the Grok Bot desktop app can and cannot exchange work with us; and what to do about the dead X-feed collector.</li>
<li><b>Machine.</b> {e(X["machine"])}. Classifiers timed on CPU with 4 threads; instruct models as 4-bit MLX builds on Metal.</li>
<li><b>X posts.</b> {e(X["source"])}. Rubric: {e(X["rubric"])} "Opposite calls" = bullish called bearish or the reverse. Score = F1.</li>
<li><b>News.</b> {e(L["what_our_tables_hold"]["news"])} {e(L["what_our_tables_hold"]["full_articles"])} Rubric: {e(L["news_rubric"])}</li>
<li><b>YouTube.</b> {e(L["what_our_tables_hold"]["youtube_transcripts"])} Rubric: {e(L["youtube_rubric"])} {e(L["caveat"])}</li>
<li><b>Speech-to-text.</b> {e(T["speech_to_text"]["audio"])}. {e(T["speech_to_text"]["note"])} Fly estimate: {e(T["cost_per_hour_of_video"]["fly_cpu_performance_4x_ESTIMATE"])}</li>
<li><b>Embeddings.</b> {e(E["embeddings"]["test"])} {e(E["embeddings"]["vector_index"])} {e(E["embeddings"]["note"])}</li>
<li><b>Ticker linking.</b> {e(E["ticker_linking"]["test"])} {e(E["ticker_linking"]["note"])}</li>
<li><b>Anomaly.</b> {e(E["anomaly"]["test"])} {e(E["anomaly"]["what_the_rules_file_intends"])}</li>
<li><b>Fly.</b> {e(E["fly"]["gpu"])} {e(E["fly"]["not_measured"])}</li>
<li><b>Grok Bot.</b> {e(G["how"])} Not verified: {e(" ".join(G["not_verified"]))}</li>
<li><b>X feed.</b> {e(XF["what_happened"]["correction_to_the_job_register"])} Pattern followed: {e(R["pattern_followed"])}</li>
<li><b>Files beside this page.</b> models.json (one row per candidate) · bakeoff/x-short-text.json · bakeoff/long-form.json · bakeoff/transcripts-and-speech.json · bakeoff/extras.json · grok-bot-channel.json · xfeed-recommendation.json · tools/ (every script that produced a number).</li>
<li><b>Sources (model cards, papers, repositories).</b><ul>{"".join("<li>"+e(s)+"</li>" for s in srcs)}<li>{e(E["fly"]["source"])}</li><li>{e(P["pattern_followed"])}</li></ul></li>
</ul></details>
</main></body></html>'''
open(D+'/M1-MODELS.html','w').write(page); print(len(page),'bytes')
