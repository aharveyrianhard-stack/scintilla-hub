# Builds SM1-SENTIMENT-MODELS.html from the evidence files. Usage: python3 build_report.py <deliverable dir>
import json, sys, html, collections
D = sys.argv[1]; e = html.escape
SB = json.load(open(D + '/evidence/scoreboard.json')); T = json.load(open(D + '/evidence/testset-labels-calls.json'))
G = json.load(open(D + '/evidence/grok_cases.json')); F = json.load(open(D + '/evidence/filter_stats.json'))
Y = json.load(open(D + '/evidence/youtube-captions-probe.json')); R2 = json.load(open(D + '/evidence/second-read-32.json'))
DRY = [json.loads(l) for l in open(D + '/evidence/dry-run-20261006.ndjson')]
floor = {k: max(SB['gold'][k].values()) / sum(SB['gold'][k].values()) for k in ('news', 'speech')}
WORD = {'B': 'bullish', 'S': 'bearish', 'N': 'neutral'}
def pct(x): return f'{round(x * 100)}%'
def bar(a, base): c = 'up' if a > base + 0.005 else 'down'; return f'<span class="bar {c}" style="width:{round(a * 100)}px"></span><b class="{"green" if c == "up" else "red"}">{pct(a)}</b>'
def speed(s): return f'{s:.0f} s' if s < 120 else f'{s / 60:.0f} min'
FAMILY = [('ProsusAI/finbert', 'the FinBERT Grok Bot used'), ('yiyanghkust/finbert-tone', 'FinBERT, analyst-report tone'),
          ('mrm8488/distilroberta', 'DistilRoBERTa, financial news'), ('mrm8488/deberta-v3', 'DeBERTa-v3, financial news'),
          ('tabularisai/ModernFinBERT', 'ModernFinBERT (M1\'s pick for X posts)'), ('soleimanian', 'RoBERTa-large, financial'),
          ('FinTwitBERT', 'FinBERT trained on finance tweets'), ('cardiffnlp', 'general tweet sentiment (control)'),
          ('bart-large-mnli', 'zero-shot, BART-large'), ('DeBERTa-v3-base-mnli', 'zero-shot, DeBERTa-v3 base'),
          ('deberta-v3-large-zeroshot', 'zero-shot, DeBERTa-v3 large'), ('qwen2.5-1.5b', 'small instruct, 1.5 B, CPU'),
          ('Llama-3.2-3B', 'small instruct, 3 B, CPU'), ('Qwen2.5-7B', 'instruct, 7 B (the next size up)')]
def fam(m): return next((v for k, v in FAMILY if k.lower() in m.lower()), '')
def short(m): return m.split(' · ')[0].replace('-Q4_K_M.gguf', '').replace('-q4_k_m.gguf', '').replace('MoritzLaurer/', '').replace('mrm8488/', '').replace('-sentiment-analysis', '')
def how(m): return m.split(' · ')[1] if ' · ' in m else 'reads the piece, no ticker'
FLOOR = next(b for b in SB['board'] if b.get('kind') == 'floor'); SB['board'] = [b for b in SB['board'] if b.get('kind') != 'floor']
board = sorted(SB['board'], key=lambda b: -(b['news']['acc'] + b['speech']['acc']))
rows = ''
for b in board:
    pick = 'Qwen2.5-7B' in b['model']
    rows += (f'<tr class="{"pick" if pick else ""}"><td><b>{e(short(b["model"]))}</b><div class=dimsm>{e(fam(b["model"]))} · {e(how(b["model"]))}</div></td>'
             f'<td class=nw>{bar(b["news"]["acc"], floor["news"])}</td><td class="mono {"red" if b["news"]["opposite"] >= 8 else ""}">{b["news"]["opposite"]}</td>'
             f'<td class=nw>{bar(b["speech"]["acc"], floor["speech"])}</td><td class="mono {"red" if b["speech"]["opposite"] >= 8 else ""}">{b["speech"]["opposite"]}</td>'
             f'<td class=mono>{b["speech_video"]["right"]} of {b["speech_video"]["n"]}</td><td class=mono>{speed(b["s_per_1000"])}</td><td class=mono>{b["peak_rss_mb"] / 1000:.1f} GB</td></tr>')
best_vote = max(SB['votes'], key=lambda v: v['news']['acc'] + v['speech']['acc'])
vote_news = max(SB['votes'], key=lambda v: v['news']['acc']); vote_sp = max(SB['votes'], key=lambda v: v['speech']['acc'])
is7 = lambda v: 'Qwen2.5-7B' in v['a'] + v['b']; isbig = lambda v: 'large-zeroshot' in v['a'] + v['b']
V7 = max((v for v in SB['votes'] if is7(v) and isbig(v)), key=lambda v: v['news']['acc'] + v['speech']['acc'])
VN = max((v for v in SB['votes'] if not is7(v)), key=lambda v: v['news']['acc']); VS = max((v for v in SB['votes'] if not is7(v)), key=lambda v: v['speech']['acc'])
cheapv = [v for v in SB['votes'] if not is7(v) and not isbig(v)]; VC = max(cheapv, key=lambda v: v['news']['acc']); VCS = max(cheapv, key=lambda v: v['speech']['acc'])
tk = SB['ticker']
def trow(label, key):
    r = tk[key]; return f'<tr><td>{e(label)}</td><td class=mono>{r["news"]["named_right"]} of {r["news"]["named_chunks"]} ({pct(r["news"]["named_acc"])})</td><td class=mono>{r["speech"]["named_right"]} of {r["speech"]["named_chunks"]} ({pct(r["speech"]["named_acc"])})</td></tr>'
tkeys = list(tk.keys())
trows = trow('The ticker the article / video is filed under (what we do today)', next(k for k in tkeys if k.startswith('filed ticker')))
trows += trow('Name list, first version', next(k for k in tkeys if k.startswith('name list v1')))
trows += trow('Name list + how captions mis-hear names + filed ticker as fallback (in the job)', next(k for k in tkeys if k.startswith('name list v2 +')))
for k in tkeys:
    if 'instruct' in k: trows += trow(short(k) + ' asked to name the ticker', k)
gc = G['calls']
grok = ''.join(f'<tr><td>{e(t[:150])}{"…" if len(t) > 150 else ""}</td>' + ''.join(
    (lambda v: f'<td class="mono {("green" if v.startswith("B") else "red" if v.startswith("S") else "")}">{e(WORD.get(v[0], v)) + (" · " + e(v.split("/")[1]) if "/" in v else "")}</td>')(gc[m][i]) for m in ('ProsusAI/finbert', 'tabularisai/ModernFinBERT', 'Qwen2.5-7B-Instruct')) +
    f'<td class=mono>{e(gc["filter"][i] or "kept")}</td></tr>' for i, t in enumerate(G['texts']))
st = F['stats']; nk, nd = st['news_kept'], st['news_boilerplate']; sk, sd = st['speech_kept'], st['speech_chit_chat'] + st['speech_promo']
doubt = sum(t['ref']['doubt_stance'] for t in T); q7 = next(b for b in SB['board'] if 'Qwen2.5-7B' in b['model'])
news = [t for t in T if t['kind'] == 'news']; sp = [t for t in T if t['kind'] == 'speech']
r2 = R2['rows']; r2a = sum(r['stance_agree'] for r in r2); r2t = sum(r['ticker_agree'] for r in r2)
dd = [r for r in DRY if r['type'] == 'doc']; dchunks = [r for r in DRY if r['type'] == 'chunk']
def lean(r): c = 'green' if r['label'] == 'B' else 'red' if r['label'] == 'S' else ''; return f'<b class="{c}">{WORD[r["label"]]} {r["lean"]:+.2f}</b>'
dry = ''.join(f'<tr><td>{"video" if r["doc_kind"] == "speech" else "article"}</td><td>{e(r["title"][:70])}</td><td class=mono>{"whole" if r["ticker"] == "*" else e(r["ticker"])}</td><td class=mono>{lean(r)}</td><td class=mono>{r["chunks"]} read · {r["chunks_dropped"]} dropped</td><td class=mono><a href="{e(r["top_link"])}">{e(r["top_link"].split("watch?v=")[-1][:34]) if "youtube" in r["top_link"] else "article"}</a></td></tr>' for r in dd)
vsp = [r for r in dchunks if r['doc_kind'] == 'speech' and not r['dropped_reason']][3:8]
vch = ''.join(f'<tr><td class=mono><a href="{e(r["link"])}">{int(r["t_start_s"] // 60)}:{int(r["t_start_s"] % 60):02d}</a></td><td class="mono {("green" if r["label"] == "B" else "red" if r["label"] == "S" else "")}">{WORD[r["label"]]}</td><td class=mono>{e(r["ticker"] or "—")}</td><td>{e(r["excerpt"][:130])}…</td></tr>' for r in vsp)
miss = [t for t in T if t['calls']['Qwen2.5-7B-Instruct-Q4_K_M.gguf'].split('/')[0] != t['ref']['stance'] and not t['ref']['doubt_stance']][:6]
misses = ''.join(f'<tr><td>{"video" if t["kind"] == "speech" else "article"}</td><td>{e(t["excerpt"][:170])}…</td><td class=mono>{WORD[t["ref"]["stance"]]}</td><td class=mono>{WORD[t["calls"]["Qwen2.5-7B-Instruct-Q4_K_M.gguf"][0]]}</td></tr>' for t in miss)
zs = next(b for b in SB['board'] if 'large-zeroshot' in b['model'] and 'told' in b['model'])
cheap = next(b for b in SB['board'] if b['model'].startswith('mrm8488/deberta')); mfb = next(b for b in SB['board'] if 'ModernFinBERT' in b['model']); fb = next(b for b in SB['board'] if b['model'] == 'ProsusAI/finbert')
page = f'''<!doctype html>
<html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>SM1 — which open model reads our news and YouTube</title>
<style>
:root{{--bg:#0b0b0c;--panel:#131315;--line:#2a2a2d;--text:#cfcfd2;--dim:#8d8d92;--up:#3ddc84;--down:#e5484d;--amber:#d1a04a}}
*{{box-sizing:border-box}} body{{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 -apple-system,Inter,Helvetica,Arial,sans-serif;padding:24px 16px 64px}}
main{{max-width:1240px;margin:0 auto}} h1{{font-size:22px;margin:0 0 4px;letter-spacing:.2px}} h2{{font-size:16px;margin:36px 0 10px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim)}} h3{{font-size:14px;margin:18px 0 6px}}
.sub{{color:var(--dim);font-family:ui-monospace,Menlo,monospace;font-size:12px}} .panel{{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:14px 16px;margin:12px 0;min-width:0;overflow-wrap:anywhere}}
.mono{{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;white-space:nowrap}} .nw{{white-space:nowrap}} table{{border-collapse:collapse;width:100%;font-size:12px}} th,td{{border-top:1px solid var(--line);padding:6px 8px;vertical-align:top;text-align:left;overflow-wrap:normal}} th{{color:var(--dim);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.06em}}
tr.pick td{{background:#18181b}} tr.floor td{{color:var(--dim)}} .wrap{{overflow-x:auto;max-width:100%}} .wrap table{{min-width:720px}} p .mono,li .mono,div.panel>.mono{{white-space:normal;word-break:break-word}}
.kpi{{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:12px 0}} .kpi div{{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:10px 12px}} .kpi b{{display:block;font-size:22px;font-family:ui-monospace,Menlo,monospace;overflow-wrap:anywhere}} .kpi span{{color:var(--dim);font-size:12px}}
.bar{{display:inline-block;height:9px;border-radius:2px;margin-right:8px;vertical-align:middle}} .bar.up{{background:var(--up)}} .bar.down{{background:var(--down)}}
.dimsm{{color:var(--dim);font-size:11px}} a{{color:var(--text)}} li{{margin:4px 0}} .green{{color:var(--up)}} .red{{color:var(--down)}} .amber{{color:var(--amber)}}
pre{{background:#0f0f11;border:1px solid var(--line);border-radius:4px;padding:10px;font:11.5px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-word;color:var(--text);margin:8px 0}}
details.sc-pagespecs{{margin-top:40px;color:var(--dim)}} details.sc-pagespecs summary{{cursor:pointer;font-family:ui-monospace,Menlo,monospace;letter-spacing:.12em;font-size:12px}} details.sc-pagespecs li{{font-size:12px;word-break:break-word}}
</style></head><body><main>
<span data-scnav-slot></span><h1>Which open model reads our news articles and YouTube videos</h1>
<div class=sub>SM1 · 5–6 Oct 2026 · report branch hub/sm1-report-20261005 · job branch provider/sm1-sentiment-models-20261005 · nothing armed: no table created, no row written, no schedule, no paid model called</div>

<h2>The answer</h2>
<div class=kpi><div><b class=green>{pct(q7["news"]["acc"])}</b><span>news pieces read right by the pick (always-neutral = {pct(floor["news"])})</span></div><div><b class=green>{pct(q7["speech"]["acc"])}</b><span>spoken pieces read right by the pick (always-neutral = {pct(floor["speech"])})</span></div><div><b class=red>{pct(fb["speech"]["acc"])}</b><span>spoken pieces read right by FinBERT</span></div><div><b>{len(SB["board"])}</b><span>open models and settings tried, 300 hand-labelled pieces</span></div><div><b class=red>{Y["fly_machine_2"]["answered"]} of {Y["fly_machine_2"]["videos_tried"]}</b><span>transcripts YouTube gave a data-centre machine</span></div></div>
<div class="panel wrap"><table><tr><th>For</th><th>Pick</th><th>Why, in plain words</th></tr>
<tr><td><b>YouTube videos</b></td><td><b class=green>Qwen2.5-7B-Instruct</b><div class=dimsm>Alibaba, Apache-2.0, run locally through llama.cpp, asked "which ticker is this piece about, and is the speaker bullish, bearish or neutral on it"</div></td><td>It is the only model that reads talk. Every FinBERT-style model sits within ten points of "always say neutral" on spoken pieces ({pct(fb["speech"]["acc"])} to {pct(mfb["speech"]["acc"])} against {pct(floor["speech"])}); this one is at {pct(q7["speech"]["acc"])}, with 3 opposite calls in 150, and it names the ticker itself. On whole videos it got the lean right for {q7["speech_video"]["right"]} of {q7["speech_video"]["n"]} with no opposite call.</td></tr>
<tr><td><b>News, where a graphics chip is available</b> (this MacBook)</td><td><b class=green>the same model</b></td><td>{pct(q7["news"]["acc"])} right, 3 opposite calls in 150. One model for both jobs, 0.4 s a piece on the MacBook.</td></tr>
<tr><td><b>News, on a plain Fly machine</b></td><td><b class=amber>deberta-v3 financial-news classifier</b><div class=dimsm>mrm8488/deberta-v3-ft-financial-news-sentiment-analysis</div></td><td>A night of news is about 22,000 pieces: the 7 B model would need about 20 hours on an 8-core machine, this one about ten minutes. It is right {pct(cheap["news"]["acc"])} of the time, a little better than FinBERT ({pct(fb["news"]["acc"])}) with half the opposite calls (5 against 10). It is the fallback, not the answer.</td></tr>
<tr><td><b>A vote of two</b></td><td><b class=amber>not by default</b></td><td>All {len(SB["votes"])} pairs were tried (a piece counts as bullish or bearish only when both models say so). No pair is more often right than the 7 B model alone. The best partner for it, the large zero-shot model, leaves it just as accurate ({pct(V7["news"]["acc"])} news, {pct(V7["speech"]["acc"])} speech) and cuts the opposite calls from 3 to {V7["news"]["opposite"]} on news and 3 to {V7["speech"]["opposite"]} on speech, but adds a second slow model (39 minutes per 1,000 pieces on a processor). Without the 7 B, the best pair reaches {pct(VN["news"]["acc"])} on news and {pct(VS["speech"]["acc"])} on speech, and the best pair of fast classifiers only {pct(VC["news"]["acc"])} and {pct(VCS["speech"]["acc"])}. Worth switching on later only if opposite calls turn out to matter more than speed.</td></tr></table></div>

<h2>The scoreboard — 150 news pieces, 150 spoken pieces</h2>
<div class="panel wrap"><table><tr><th>Model</th><th>News: right, of 150</th><th>News: opposite</th><th>Speech: right, of 150</th><th>Speech: opposite</th><th>Whole videos right</th><th>Time per 1,000 pieces</th><th>Memory</th></tr>
<tr class=floor><td><b>always say "neutral"</b><div class=dimsm>the floor: a model at or under this has read nothing</div></td><td class=mono>{pct(floor["news"])}</td><td class=mono>0</td><td class=mono>{pct(floor["speech"])}</td><td class=mono>0</td><td class=mono>{FLOOR["speech_video"]["right"]} of {FLOOR["speech_video"]["n"]}</td><td class=mono>—</td><td class=mono>—</td></tr>
{rows}</table></div>
<div class=panel><b>Reading the table.</b> "Opposite" = said bullish where the reference says bearish, or the reverse: the mistake that hurts. A green bar is above the floor, a red one at or below it. Times are from this MacBook: the classifiers and the two small instruct models on its processor, the zero-shot rows on its processor, the 7 B on its graphics chip (on the processor alone the 7 B takes 54 minutes per 1,000 with 8 threads, 95 minutes with 4, and holds about 9 GB). Nothing was timed on Fly.</div>

<h2>Grok Bot's four cases, re-run</h2>
<div class="panel wrap"><table><tr><th>The piece</th><th>FinBERT</th><th>ModernFinBERT</th><th>Qwen2.5-7B</th><th>Ad filter</th></tr>{grok}</table></div>
<div class=panel>These four are the earlier pass's rewordings of what Grok Bot described, not his exact text, and on them FinBERT did <b>not</b> repeat two of the misses he reported (it read the Micron beat and the index high as bullish here). Wording changes its answer; that instability is itself the problem. The 7 B model's instructions name two of these cases outright ("'Not a sell' is not bearish. A number that beats the estimate is bullish"), so its passing them here proves little: the 300-piece table is the evidence.</div>

<h2>Dropping the ads and the small print</h2>
<div class=kpi><div><b>{nd} of {nk + nd}</b><span>news pieces dropped (legal boilerplate, "about the company")</span></div><div><b>{sd} of {sk + sd}</b><span>spoken pieces dropped ({st["speech_promo"]} sponsor reads, {st["speech_chit_chat"]} chit-chat)</span></div><div><b class=amber>a word list</b><span>not a model: two promo phrases, or one with no market word, or (speech) no market word and no company name</span></div></div>
<div class=panel>It is blunt. A few dropped news pieces were real content, and at least one dropped spoken piece was real talk about a data-centre power contract; a few sign-offs get through and score neutral. The first version threw away real market talk and was loosened before labelling.</div>

<h2>Which ticker is the piece about</h2>
<div class="panel wrap"><table><tr><th>Method</th><th>News pieces that name a ticker we track</th><th>Spoken pieces that name one</th></tr>{trows}</table></div>
<div class=panel>The list of mis-heard names ("Iron" and "Irene" for IREN, "Nibius" for Nebius, "in video" for Nvidia) was written after reading these same transcripts, so its 90% flatters it: expect less on a channel it has not seen.</div>

<h2>The job, run once by hand on 6 Oct (4 articles, 1 video, nothing written)</h2>
<div class="panel wrap"><table><tr><th>Kind</th><th>Title</th><th>Ticker</th><th>Lean</th><th>Pieces</th><th>Strongest piece</th></tr>{dry}</table></div>
<div class="panel wrap"><b>Inside the video: each piece keeps the second it was said</b><table><tr><th>At</th><th>Read</th><th>Ticker</th><th>What was said</th></tr>{vch}</table></div>
<div class=panel>The MongoDB rows are the cheap news classifier's known fault, left in on purpose: an article titled "MongoDB Stock Tumbles" reads <b class=green>bullish</b>, because the paragraph it scored says the company reaffirmed its guidance. The classifier reads a paragraph, not a ticker. The 7 B model does not make this mistake.</div>

<h2>Transcripts — what needs Grok Bot</h2>
<div class=kpi><div><b class=red>0 of {Y["mac"]["videos_tried"]}</b><span>this MacBook, 5 Oct evening (YouTube: too many requests)</span></div><div><b class=amber>{Y["fly_machine_1"]["answered"]} of {Y["fly_machine_1"]["videos_tried"]}</b><span>first Fly machine</span></div><div><b class=red>{Y["fly_machine_2"]["answered"]} of {Y["fly_machine_2"]["videos_tried"]}</b><span>second Fly machine ("sign in to confirm you're not a bot")</span></div><div><b class=red>0</b><span>rows in our youtube_transcripts table</span></div></div>
<div class=panel>YouTube lets a data-centre address fetch a handful of caption files and then closes; the MacBook, which gave M1 26 of 26 earlier on 5 Oct, was refused by the evening. So the job does not fetch captions: it reads <span class=mono>youtube_transcripts</span>. Someone has to fill that table from an address YouTube accepts. <b>That is the one thing this needs from Grok Bot:</b> for each new video in our feed, the caption lines with their start second, as <span class=mono>{{"video_id": "...", "segs": [[12.4, "caption line"], ...]}}</span>. He offered 5 to 10 videos a day; our feed carries about 180. The test itself used the 26 transcripts M1 fetched (no timings) and one with timings from Fly.</div>

<h2>What is staged (provider branch, nothing armed)</h2>
<div class=panel><ul>
<li><b>The job</b> — <span class=mono>services/sentiment-long-form/pipeline.py</span>: put sentence breaks back into captions (wtpsplit) → cut where the topic changes (Chonkie) → drop ads and small print → find the ticker → score → one lean per article or video and one per ticker inside it, each piece with its link (for video, the second). Prints by default; writes only with <span class=mono>--write</span> and <span class=mono>SENTIMENT_LONG_FORM_WRITE=1</span>. 13 tests; the provider's own 803 still pass.</li>
<li><b>The Fly machine</b> — <span class=mono>fly.machine.md</span>: an 8-core, 16 GB machine started once a night, three commands (build, one dry night, the nightly). The image was written, not built.</li>
<li><b>The tables</b> — <span class=mono>sql/0001_sentiment_long_form.sql</span>: two new tables (<span class=mono>sentiment_long_form</span>, <span class=mono>sentiment_long_form_chunks</span>) and one new empty column (<span class=mono>youtube_transcripts.segs</span>). Nothing existing is changed. <span class=mono>sql/0001_sentiment_long_form.rollback.sql</span> removes exactly those.</li></ul></div>

<h2>What could be wrong</h2>
<div class=panel><ul>
<li><b>One labeller, and it is a language model.</b> The reference labels were written by the reviewing model, {doubt} of 300 marked doubtful. A second, blind read of 32 pieces on 6 Oct agreed on {r2a} of 32 leans (no opposite) and {r2t} of 32 tickers; scored against that second read the order of the models does not change. Figures carry about ±8 points. Fifty pieces labelled by Alan would settle it.</li>
<li><b>The winner may be flattered.</b> Its instructions were written by the same hand that wrote the labels and share their definitions. On the {q7["news"]["n_sure"] + q7["speech"]["n_sure"]} clear-cut pieces it is right {pct(q7["news"]["acc_sure"])} (news) and {pct(q7["speech"]["acc_sure"])} (speech).</li>
<li><b>The brief asked for a 1.5 to 3 B model on a processor; neither worked.</b> Qwen2.5-1.5B is below the floor on speech (33%), Llama-3.2-3B is no better than FinBERT. The pick is the next size up, which is slow without a graphics chip.</li>
<li><b>Speeds are this MacBook's.</b> A Fly core is slower; the speech half (about 4,900 pieces a night) is 4.5 hours on the MacBook's processor at 8 threads and unmeasured on Fly.</li>
<li><b>The test videos lean to a few channels</b> (26 videos, 22 channels, two of them machine-read "technical analysis" channels with 18 pieces each).</li></ul></div>
<div class="panel wrap"><b>Where the pick was plainly wrong</b> (clear-cut pieces only)<table><tr><th>Kind</th><th>The piece</th><th>Reference</th><th>It said</th></tr>{misses}</table></div>

<h2>Decisions for Alan</h2>
<div class=panel><ol>
<li><b>Where does the reading run?</b> Recommended: <b>on this MacBook, at night</b> — a whole night of news and video in about 3 hours, nothing to pay, one model for both. The Fly machine is the fallback (cheap classifier for news, 7 B for video, several hours).</li>
<li><b>Ask Grok Bot for the transcripts with timings?</b> Recommended: <b>yes</b> — it is the only missing part, and it is what his isolated browser is for.</li>
<li><b>Label 50 pieces yourself?</b> Recommended: <b>yes, once</b> — ten minutes, and every number on this page stops resting on a machine's opinion.</li></ol></div>

<details class="sc-pagespecs"><summary>PAGE SPECS</summary><ul>
<li><b>The test set.</b> {len(news)} news pieces from {len({t["doc"] for t in news})} stored articles ({len({t["source"] for t in news})} sites, {len({t["filed"] for t in news})} tickers, 22 Sep to 5 Oct 2026, bodies fetched from the stored links) and {len(sp)} spoken pieces from {len({t["doc"] for t in sp})} videos of {len({t["source"] for t in sp})} channels in our feed. Pieces were cut by the same chunker the job uses, after the ad filter.</li>
<li><b>The labelling rule.</b> Each piece gets one lean toward the price of the one name it is mainly about. Bullish: good news, a positive opinion, a beat, an upgrade, "undervalued", expects it up. Bearish: bad news, a negative opinion, a miss, a downgrade, a lawsuit, "overvalued", expects it down. Neutral: plain facts, two-sided, "if it breaks this level" talk with no stated lean, or off-topic. Ticker: the one name it is mainly about; MARKET for an index, the economy, a sector or several names equally; NONE for no tradable subject; OTHER for a company outside our list. A piece is marked doubtful when a careful reader could fairly choose the neighbouring answer. (File <span class=mono>evidence/labels.txt</span>; the prose rule was written out on 6 Oct from its header and the labels themselves.)</li>
<li><b>Who did what.</b> The test set, labels, model runs, job and SQL were made by the SM1 pass of 5 Oct (about 20:50 to 21:53 ET), which stopped on an account error before writing this page. This page was written on 6 Oct after re-deriving every accuracy figure from the stored per-piece calls (all {len(SB["board"])} rows match), re-reading 32 pieces blind, re-running the job end to end, and confirming no throw-away Fly machine was left (two were used, both gone). One fault found and fixed: a scorer that failed to start used to discard the other half's results.</li>
<li><b>Not done.</b> No model was timed on Fly; the Docker image was not built; no GPU machine was tried; ModernBERT-size "modern FinBERTs" beyond tabularisai/ModernFinBERT were not found from a publisher worth trusting; Chonkie and wtpsplit were used as Grok Bot proposed and not compared against alternatives.</li>
<li><b>Files.</b> evidence/scoreboard.json · evidence/testset-labels-calls.json (every piece, its label, every model's call) · evidence/labels.txt · evidence/second-read-32.json · evidence/grok_cases.json · evidence/filter_stats.json · evidence/youtube-captions-probe.json · evidence/dry-run-20261006.ndjson · tools/ (the scripts).</li>
<li><b>Models, all open.</b> ProsusAI/finbert · yiyanghkust/finbert-tone · mrm8488 distilroberta and deberta-v3 financial-news · tabularisai/ModernFinBERT · soleimanian/financial-roberta-large-sentiment · StephanAkkerman/FinTwitBERT-sentiment · cardiffnlp/twitter-roberta-base-sentiment-latest · facebook/bart-large-mnli · MoritzLaurer DeBERTa-v3-base-mnli-fever-anli and deberta-v3-large-zeroshot-v2.0 · Qwen2.5-1.5B and 7B Instruct (Apache-2.0) · Llama-3.2-3B-Instruct (Meta community licence) · llama.cpp (MIT) · Chonkie, wtpsplit, model2vec (MIT).</li></ul></details>
</main></body></html>'''
open(D + '/SM1-SENTIMENT-MODELS.html', 'w').write(page); print('wrote', len(page))
