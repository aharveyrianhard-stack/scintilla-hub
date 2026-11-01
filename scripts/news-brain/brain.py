#!/usr/bin/python3
# brain.py (1 Nov 2026, coordinator). The news and YouTube brain's worker on the MacBook. launchd runs "tick" every 15 minutes (com.scintilla.brain).
# VIDEOS: new videos from the deep list -> the transcript from this Mac (gently, a few at a time) -> Kimi reads it by section -> stored, a card on every device, a note in the Obsidian vault.
# READS: pre-market, midday, close on trading days and a weekly on Sunday -> the real headlines and prices -> Kimi writes a short read -> stored, a card on every device, a note in the vault.
# Alan: "All I care about is that ... Kimmy is not blocked ... whoever takes the job does it fully, and cheaply". Nothing is lost when a worker is blocked: the job stays pending and the next tick
# tries again; after one Kimi failure in a tick the Codex worker on his ChatGPT login takes it. No paid API, no key in this file. Secrets: the Scintilla config (600) and the Keychain.
import datetime, json, os, re, subprocess, sys, tempfile, time, urllib.parse, urllib.request, warnings, zoneinfo
warnings.filterwarnings("ignore")
HOME = os.path.expanduser("~"); SUP = HOME + "/Library/Application Support/Scintilla"; WORK = SUP + "/brain"; os.makedirs(WORK, exist_ok=True)
CFG = json.load(open(SUP + "/config.json")); URL, ANON, TOKEN = CFG["url"], CFG["anon"], CFG["token"]
KIMI = "/Users/alanharvey/AlanOS/Operating System/system/tools/kimi-code/executor/launch_kimi.py"; CODEX = "/Users/alanharvey/AlanOS/Operating System/system/tools/codex-executor/run.py"
CODEX_DIR = "/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin"
def claude_bin():   # the desktop app keeps its command-line tool in a versioned folder; the newest one
    import glob
    c = glob.glob(HOME + "/Library/Application Support/Claude/claude-code/*/*/claude.app/Contents/MacOS/claude") + glob.glob(HOME + "/Library/Application Support/Claude/claude-code/*/claude.app/Contents/MacOS/claude")
    return max(c, key=os.path.getmtime) if c else "claude"
WORKERS = os.environ.get("BRAIN_WORKERS", "kimi,codex,claude").split(",")   # Alan: "if Kimmy is blocked, the job goes to ChatGPT. And if that fails too, it goes to you ... I don't want this to fail."
REPORT_URL = "https://volume-pulse-pied.vercel.app/story.html"
# Alan, 1 Nov: "No, I don't want the Newsbrain and Obsidian vault that I already have. It would be a completely separate thing ... Let's think about it first." Notes wait in a private folder until he decides.
VAULT = SUP + "/brain-notes"; NOTIFY = HOME + "/.local/bin/scintilla-notify"; PAGE = "https://station.scintillahub.ai/notify/read.html"
NY = zoneinfo.ZoneInfo("America/New_York"); MAX_VIDEOS_PER_TICK = 3; MIN_VIDEO_MIN = 5
DESK = {"reuters.com","cnbc.com","wsj.com","barrons.com","marketwatch.com","benzinga.com","businessinsider.com","techcrunch.com","investors.com","nytimes.com","foxbusiness.com","ft.com","bloomberg.com","theguardian.com","news.sky.com","apnews.com","axios.com","theinformation.com","businesswire.com","globenewswire.com","prnewswire.com","newsfilecorp.com"}
LAWYERS = re.compile(r"(class action|lead plaintiff|securities (fraud|litigation|investigation|class)|shareholder (alert|investigation|rights|class)|investor (alert|deadline|notice)|investors? (have|has|face|should|are encouraged|who (lost|suffered|purchased|bought))|law (firm|offices)|\bLLP\b|encourages? .{0,80}(investors|shareholders)|on behalf of (investors|shareholders)|fraud investigation|deadline (alert|reminder))", re.I)

def log(*a): print(datetime.datetime.now().strftime("%m-%d %H:%M:%S"), *a, flush=True)
def http(url, data=None, headers=None, timeout=25):
    r = urllib.request.Request(url, data=data, headers=headers or {}); return urllib.request.urlopen(r, timeout=timeout).read()
PG = {"apikey": ANON, "Authorization": "Bearer " + ANON, "Content-Type": "application/json"}
def rest(path): return json.loads(http(URL + "/rest/v1/" + path, headers=PG))
def rpc(fn, args): return json.loads(http(URL + "/rest/v1/rpc/" + fn, data=json.dumps(args).encode(), headers=PG) or b"null")
def put(what, row): return rpc("brain_put", {"p_token": TOKEN, "p_what": what, "p_row": row})
def notify(**k):
    args = [NOTIFY]
    for a, b in k.items():
        if b is not None and b != "": args += ["--" + a, str(b)]
    subprocess.run(args, capture_output=True, timeout=30)
def fmp_key():
    return subprocess.run(["/usr/bin/security", "find-generic-password", "-s", "FMP_API_KEY", "-w"], capture_output=True, text=True).stdout.strip()
def fmp(path, key): return json.loads(http("https://financialmodelingprep.com/stable/" + path + ("&" if "?" in path else "?") + "apikey=" + urllib.parse.quote(key), timeout=20))
def safe(s, n=80): return re.sub(r"\s+", " ", re.sub(r'[\\/:*?"<>|#^\[\]]+', " ", str(s or ""))).strip()[:n].strip()
def links(tickers): return " ".join("[[" + re.sub(r"[^A-Za-z0-9.\-^]", "", t) + "]]" for t in tickers if t)

# ---- the worker: Kimi first; if he is blocked or fails, Codex on the ChatGPT login; nothing is lost either way ----
def run_worker(job_id, folder, task, out_name, timeout=720):
    brief = folder + "/TASK.md"; open(brief, "w").write(task); out = folder + "/" + out_name; runs = WORK + "/runs"; os.makedirs(runs, exist_ok=True); safe_id = re.sub(r"[^A-Za-z0-9_-]", "-", job_id)[:60]
    for w in WORKERS:
        try:
            if w == "kimi":
                jf = folder + "/kimi-job.json"; json.dump({"id": safe_id, "domain": "scintilla", "cwd": folder, "brief": brief, "result_root": runs, "timeout_seconds": timeout, "authorized": True, "source_issue": "alan-20261101-news-brain"}, open(jf, "w"))
                r = subprocess.run(["/usr/bin/python3", KIMI, "--job", jf], capture_output=True, text=True, timeout=timeout + 60)
            elif w == "codex":
                jf = folder + "/codex-job.json"; json.dump({"id": safe_id + "-codex", "owner": "scintilla", "authorized": True, "cwd": folder, "brief": brief, "result_root": runs, "model": "gpt-6-sol", "effort": "low", "sandbox": "workspace-write", "timeout_seconds": timeout}, open(jf, "w"))
                r = subprocess.run(["/usr/bin/python3", CODEX, jf], env={**os.environ, "PATH": CODEX_DIR + ":" + os.environ.get("PATH", "/usr/bin:/bin")}, capture_output=True, text=True, timeout=timeout + 60)
            elif w == "claude":
                env = {k: v for k, v in os.environ.items() if k not in ("ANTHROPIC_BASE_URL", "ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN", "CLAUDE_CONFIG_DIR")}
                r = subprocess.run([claude_bin(), "-p", "Follow the instructions in TASK.md in this folder exactly. Read only files in this folder and write only the one output file it names.", "--model", "sonnet", "--allowedTools", "Read,Write", "--permission-mode", "acceptEdits"], cwd=folder, env=env, capture_output=True, text=True, timeout=timeout + 60, stdin=subprocess.DEVNULL)
            else: continue
            if _json_ok(out): return w
            log(w, "did not finish", job_id, (r.stdout + r.stderr)[-200:].replace("\n", " "))
        except Exception as e: log(w, "error", job_id, str(e)[:160])
    notify(title="A read could not run: every worker failed", body=job_id, kind="ops", level=1, key="ops|workers|" + datetime.datetime.now().strftime("%Y%m%d%H"), source="News brain")
    return None
def _json_ok(p):
    try: json.load(open(p)); return True
    except Exception: return False

# ---- the house report, read only. Alan: "you've seen the .com analysis that we've hosted ... the tone of that is important to track ... the tracking of things that support certain scenarios"; "Kimmy should be aware of the .com analysis too". The markets session owns it; we only read it. ----
def report_context(limit=9000):
    try:
        h = http(REPORT_URL, timeout=20).decode("utf-8", "replace"); parts = re.split(r"(?=<h2[ >])", h); keep = []
        for part in parts:
            m = re.match(r"<h2[^>]*>(.*?)</h2>", part, re.S); name = re.sub(r"<[^>]+>", " ", m.group(1)).strip() if m else ""
            if re.search(r"whole story|four paths|how we will know", name, re.I): keep.append("## " + name + "\n" + strip_html(part)[:limit // 2])
        return "\n\n".join(keep)[:limit]
    except Exception as e: log("no report context", str(e)[:120]); return ""

# ---- videos ----
def chapters_of(desc):
    out = []
    for line in (desc or "").splitlines():
        m = re.match(r"^\s*\(?(\d{1,2}:\d{2}(?::\d{2})?)\)?\s*[-–—:|]?\s*(.+)$", line)
        if m: out.append({"at": m.group(1), "title": m.group(2).strip()[:120]})
    return out if len(out) >= 2 else []
def description(video_id):
    h = http("https://www.youtube.com/watch?v=" + video_id, headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"}).decode("utf-8", "replace")
    m = re.search(r'"shortDescription":"((?:[^"\\]|\\.)*)"', h)
    return json.loads('"' + m.group(1) + '"') if m else ""
def secs(at):
    p = [int(x) for x in str(at).split(":") if x.isdigit()]; n = 0
    for x in p: n = n * 60 + x
    return n
VIDEO_TASK = """You are reading one YouTube video for a professional trader. Do not browse the web, do not run anything except reading these files and writing the one output file.

Files in this folder: transcript.txt (auto captions with [mm:ss] times; words may be misheard), description.txt (the video's description; it may list chapters), report.txt (our own research report on the AI trade, for context only).
Video: "{title}" by {channel}, {duration}.{note}

Write read.json, valid JSON, with exactly these keys:
- "takeaway": one sentence, under 25 words: what this person is actually saying the market or the stock will do and why.
- "sections": a list, one per topic in the order spoken. {chapters} At most 10. Each item: {{"at":"mm:ss","title":"short title","points":["2 or 3 short plain sentences with the specifics: tickers, price levels, dates, numbers"]}}.
- "tickers": every stock, ETF or index discussed with a real view, each {{"t":"MU","view":"bullish|bearish|neutral","why":"under 15 words","levels":"price levels named, or empty"}}.
- "calls": the specific calls with a level or a date, each one short sentence.
- "vs_report": one sentence: does this video support or go against the paths in report.txt, and on what? Empty if it has nothing to do with them.
Fix obviously misheard names (for example "micron" is MU, "nvidia" is NVDA). Say what they said; do not add your own opinion, no disclaimers, no adjectives like "notable". If something is unclear, leave it out.
When read.json is written and parses as JSON, stop.
"""
def videos(limit=MAX_VIDEOS_PER_TICK, hours=48):
    deep = rpc("brain_deep", {"p_token": TOKEN}) or {}; ids = list((deep.get("ids") or {}).keys())
    if not ids: return
    since = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%SZ")
    rows = rest("youtube_feed?select=video_id,title,channel,channel_id,duration,published_at,is_short,live_state&channel_id=in.(" + ",".join(ids) + ")&published_at=gte." + since + "&order=published_at.desc&limit=60")
    def mins(d):
        m = re.match(r"(\d+):", str(d or "")); return int(m.group(1)) if m else 0
    rows = [r for r in rows if not r.get("is_short") and r.get("live_state") not in ("live", "upcoming") and mins(r.get("duration")) >= MIN_VIDEO_MIN]
    if not rows: return
    done = {x["video_id"] for x in rest("youtube_reads?select=video_id&tier=eq.deep&video_id=in.(" + ",".join(r["video_id"] for r in rows) + ")")}
    state = {x["video_id"]: x for x in rpc("brain_transcript_state", {"p_token": TOKEN, "p_ids": [r["video_id"] for r in rows]})}
    n = 0
    for r in rows:
        v = r["video_id"]
        if v in done or n >= limit: continue
        st = state.get(v)
        if st and st["status"] == "none":
            age = datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(st["fetched_at"].replace("Z", "+00:00"))
            if age < datetime.timedelta(minutes=55): continue
        n += 1
        channel = (deep["ids"].get(r["channel_id"]) or r.get("channel") or "").strip()
        if read_one(r, channel) == "blocked": break
        time.sleep(4)
def read_one(r, channel, note=None):
    from youtube_transcript_api import YouTubeTranscriptApi
    v = r["video_id"]; folder = tempfile.mkdtemp(prefix=v + "-", dir=WORK)
    try:
        tr = YouTubeTranscriptApi().fetch(v, languages=["en", "en-US", "en-GB"])
        lines = [f"[{int(s.start)//60:02d}:{int(s.start)%60:02d}] {s.text}" for s in tr]; text = "\n".join(lines)
        put("transcript", {"video_id": v, "status": "ok", "lang": getattr(tr, "language_code", "en"), "generated": getattr(tr, "is_generated", True), "segments": len(lines), "chars": len(text), "text": text})
    except Exception as e:
        log("no transcript yet", v, type(e).__name__); put("transcript", {"video_id": v, "status": "none", "error": type(e).__name__ + ": " + str(e)[:200]}); time.sleep(4); return "none"
    desc = ""
    try: desc = description(v)
    except Exception as e: log("no description", v, str(e)[:120])
    open(folder + "/transcript.txt", "w").write(text); open(folder + "/description.txt", "w").write(desc); open(folder + "/report.txt", "w").write(report_context(5000))
    ch = chapters_of(desc)
    task = VIDEO_TASK.format(title=r["title"], channel=channel, duration=r.get("duration") or "", note="\nHe sent this video himself with this note, so answer it in the takeaway or the first section: " + note if note else "", chapters="Use exactly the description's chapters as the sections." if ch else "The description has no chapters: cut by topic yourself.")
    worker = run_worker("yt-" + v, folder, task, "read.json")
    if not worker: log("left pending", v); return "blocked"
    d = json.load(open(folder + "/read.json"))
    put("read", {"video_id": v, "channel": channel, "channel_id": r.get("channel_id"), "title": r["title"], "published_at": r.get("published_at"), "duration": r.get("duration"), "tier": "deep", "takeaway": d.get("takeaway"), "sections": d.get("sections"), "tickers": d.get("tickers"), "calls": d.get("calls"), "chapters": ch, "worker": worker, "vs_report": d.get("vs_report") or None, "note": note})
    notify(title=d.get("takeaway") or r["title"], url=PAGE + "?v=" + v, kind="video", level=2, key="video|" + v, ticker=channel, source="YouTube · " + str(r.get("duration") or ""))
    note_video(r, channel, d, ch); log("read", channel, v, worker)
    return "ok"
def note_video(r, channel, d, ch):
    day = str(r.get("published_at") or "")[:10]; folder = VAULT + "/YouTube/" + safe(channel); os.makedirs(folder, exist_ok=True); tick = [t.get("t") for t in d.get("tickers") or []]
    out = ["---", "type: video", "channel: " + json.dumps(channel), "date: " + day, "video: https://youtu.be/" + r["video_id"], "tickers: " + json.dumps(tick), "---", "", "# " + r["title"], "", "**" + (d.get("takeaway") or "") + "**", "", links(tick), ""]
    for s in d.get("sections") or []:
        out += ["## [" + str(s.get("at")) + "](https://youtu.be/" + r["video_id"] + "?t=" + str(secs(s.get("at"))) + ") " + str(s.get("title")), ""] + ["- " + str(p) for p in s.get("points") or []] + [""]
    if d.get("tickers"): out += ["## Names", ""] + ["- [[" + str(t.get("t")) + "]] " + str(t.get("view")) + ": " + str(t.get("why")) + (" (" + t["levels"] + ")" if t.get("levels") else "") for t in d["tickers"]] + [""]
    if d.get("calls"): out += ["## Calls", ""] + ["- " + str(c) for c in d["calls"]] + [""]
    open(folder + "/" + day + " " + safe(r["title"]) + ".md", "w").write("\n".join(out))

# ---- the reads ----
READ_TASK = """You write the {label} read for a professional trader who has no time. Do not browse the web and do not run anything except reading these files and writing the one output file.

Files here: prices.txt (index, sectors, macro and his names with today's % move), headlines.txt (real headlines, newest first, each with time, name, source), his_names.txt (the names he follows), report.txt (our own research report on the AI trade: its story, its four paths and the signs it tracks).

Write read.json, valid JSON, with exactly these keys:
- "title": at most 8 words, what this {label} is about.
- "takeaway": one sentence, at most 25 words: the single thing that matters most.
- "points": 4 to 6 short lines, each at most 25 words, the most important first: what moved, why, with the real numbers from prices.txt. Name the tickers. One line must say where money went, not only what fell: the sectors and areas that were up, from prices.txt (do not claim fund flows you cannot see).
- "scenario": one or two sentences in the tone of report.txt: which of its paths this supports or weakens and which of its signs moved, naming them as the report names them. Empty if nothing relevant moved.
- "names": up to 8 of his names that actually had news or a big move: {{"t":"MU","pct":-3.4,"why":"under 15 words"}}. Use the % from prices.txt.
- "watch": up to 3 short lines: what is next (a report, a release, a level), only if the headlines or the files say so.
Write like a desk note: plain, direct, no hype, no disclaimers, no advice wording, no adjectives like "notable". Do not invent numbers or events that are not in the files. If little happened, say so in fewer points.
When read.json is written and parses as JSON, stop.
"""
LABELS = {"premarket": "pre-market", "midday": "midday", "close": "market close", "weekly": "weekly", "test": "market"}
def make_read(kind, hours, stamp=None):
    now = datetime.datetime.now(NY); key = kind + "|" + (stamp or now.strftime("%Y-%m-%d"))
    if kind != "test" and rest("news_reads?select=id&read_key=eq." + urllib.parse.quote(key)): return
    k = fmp_key(); since = time.time() - hours * 3600
    mine = [r["ticker"] for r in rest("station_lists?select=ticker,list&list=in.(mine,radar)&order=position.asc")]; mine = list(dict.fromkeys(mine))
    macro = ["SPY", "QQQ", "DIA", "IWM", "RSP", "SMH", "XLK", "XLC", "XLY", "XLF", "XLI", "XLE", "XLV", "XLP", "XLU", "XLB", "XLRE", "VTV", "VUG", "TLT", "HYG", "GLD", "SLV", "^VIX", "ESUSD", "NQUSD", "CLUSD", "GCUSD", "BTCUSD", "DX-Y.NYB"]
    quotes = fmp("batch-quote?symbols=" + urllib.parse.quote(",".join(dict.fromkeys(macro + mine))), k); qmap = {q["symbol"]: q for q in quotes}
    p = ["MARKET"] + [f"{s}: {qmap[s]['price']} ({qmap[s].get('changePercentage', 0):+.2f}%)" for s in macro if s in qmap] + ["", "HIS NAMES"] + [f"{s}: {qmap[s]['price']} ({qmap[s].get('changePercentage', 0):+.2f}%)" for s in mine if s in qmap]
    rows = rest("news?select=ticker,title,site,published_ts&feed=eq.fmp&published_ts=gte." + str(int(since)) + "&order=published_ts.desc&limit=800")
    try:
        for a in fmp("news/general-latest?page=0&limit=80", k):
            d = datetime.datetime.strptime(a["publishedDate"], "%Y-%m-%d %H:%M:%S").replace(tzinfo=NY).timestamp() if a.get("publishedDate") else 0
            if d >= since: rows.append({"ticker": "MARKET", "title": a.get("title"), "site": a.get("site"), "published_ts": int(d)})
    except Exception as e: log("no market news", str(e)[:120])
    seen, keep = set(), []
    for r in sorted(rows, key=lambda x: -(x.get("published_ts") or 0)):
        site = str(r.get("site") or "").lower().replace("www.", ""); t = str(r.get("title") or ""); nt = re.sub(r"[^a-z0-9]+", " ", t.lower()).strip()
        if site not in DESK or LAWYERS.search(t) or nt in seen: continue
        seen.add(nt); keep.append(r)
    head = [datetime.datetime.fromtimestamp(r["published_ts"], NY).strftime("%a %H:%M") + " | " + str(r.get("ticker")) + " | " + str(r.get("site")) + " | " + str(r.get("title")) for r in keep[:220]]
    folder = tempfile.mkdtemp(prefix="read-" + kind + "-", dir=WORK)
    open(folder + "/prices.txt", "w").write("\n".join(p)); open(folder + "/headlines.txt", "w").write("\n".join(head)); open(folder + "/his_names.txt", "w").write(" ".join(mine)); open(folder + "/report.txt", "w").write(report_context())
    worker = run_worker("read-" + kind + "-" + now.strftime("%H%M"), folder, READ_TASK.format(label=LABELS[kind]), "read.json", timeout=420)
    if not worker: log("read left pending", kind); return
    d = json.load(open(folder + "/read.json"))
    rid = put("news_read", {"kind": kind, "read_key": key, "title": d.get("title"), "takeaway": d.get("takeaway"), "points": d.get("points"), "names": d.get("names"), "watch": d.get("watch"), "sources": len(head), "worker": worker, "scenario": d.get("scenario") or None})
    notify(title=d.get("takeaway") or d.get("title"), url=PAGE + "?r=" + str(rid), kind="read", level=2, key="read|" + key, ticker="AI READ", source=LABELS[kind].capitalize())
    folder2 = VAULT + "/Reads"; os.makedirs(folder2, exist_ok=True); names = [n.get("t") for n in d.get("names") or []]
    out = ["---", "type: read", "kind: " + kind, "date: " + now.strftime("%Y-%m-%d"), "tickers: " + json.dumps(names), "---", "", "# " + str(d.get("title")), "", "**" + str(d.get("takeaway")) + "**", ""] + ["- " + str(x) for x in d.get("points") or []] + ["", "## Names", ""] + ["- [[" + str(n.get("t")) + "]] " + str(n.get("pct")) + "%: " + str(n.get("why")) for n in d.get("names") or []] + ["", "## Next", ""] + ["- " + str(x) for x in d.get("watch") or []] + [""]
    open(folder2 + "/" + now.strftime("%Y-%m-%d") + " " + kind + ".md", "w").write("\n".join(out))
    log("read", kind, rid, worker, len(head), "headlines")
def reads_due():
    now = datetime.datetime.now(NY); hm = now.hour * 60 + now.minute; wd = now.weekday()
    if wd < 5:
        if 8 * 60 + 45 <= hm < 11 * 60: make_read("premarket", 17)
        if 12 * 60 + 30 <= hm < 15 * 60: make_read("midday", 5)
        if 16 * 60 + 20 <= hm < 20 * 60: make_read("close", 8)
    if wd == 6 and hm >= 18 * 60: make_read("weekly", 7 * 24)

# ---- what he pushes: a star on a card, a list row or a read; any link ----
ARTICLE_TASK = """A professional trader pushed this story into his notes. Do not browse the web and do not run anything except reading page.txt and writing the one output file.
Link: {url}
Headline, if known: {title}
His note, if any: {note}

Write read.json, valid JSON, with exactly these keys: "title" (the story's headline), "takeaway" (one sentence, under 25 words), "points" (2 to 5 short lines with the specifics: numbers, names, dates), "tickers" (the stock symbols it is really about).
If page.txt is a login wall or has no real story, use only what the headline says and keep points short. No opinion, no disclaimers.
When read.json is written and parses as JSON, stop.
"""
def strip_html(h):
    h = re.sub(r"(?is)<(script|style|noscript|svg|nav|footer|header)[^>]*>.*?</\\1>", " ", h); h = re.sub(r"(?s)<[^>]+>", " ", h)
    return re.sub(r"[ \t\r\f\v]+", " ", re.sub(r"\n\s*\n+", "\n", h)).strip()
def kept():
    for k in rpc("brain_kept_pending", {"p_token": TOKEN}) or []:
        u = k["url"]; m = re.search(r"(?:youtu\.be/|youtube\.com/(?:watch\?(?:.*&)?v=|live/|shorts/))([A-Za-z0-9_-]{11})", u)
        try:
            if m:
                v = m.group(1); rows = rest("youtube_feed?select=video_id,title,channel,channel_id,duration,published_at&video_id=eq." + v); r = rows[0] if rows else None
                if not r:
                    o = json.loads(http("https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote("https://youtu.be/" + v))); r = {"video_id": v, "title": o.get("title"), "channel": o.get("author_name"), "channel_id": None, "duration": None, "published_at": None}
                res = read_one(r, (r.get("channel") or "").strip(), k.get("note"))
                if res == "blocked": return
                rpc("brain_kept_done", {"p_token": TOKEN, "p_id": k["id"], "p_state": "done" if res == "ok" else "failed", "p_result": res}); continue
            folder = tempfile.mkdtemp(prefix="kept-", dir=WORK); page = ""
            try: page = strip_html(http(u, headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"}).decode("utf-8", "replace"))[:40000]
            except Exception as e: log("page not read", u[:80], str(e)[:80])
            open(folder + "/page.txt", "w").write(page)
            worker = run_worker("kept-" + str(k["id"]), folder, ARTICLE_TASK.format(url=u, title=k.get("title") or "", note=k.get("note") or ""), "read.json", timeout=300)
            if not worker: return
            d = json.load(open(folder + "/read.json")); day = datetime.datetime.now(NY).strftime("%Y-%m-%d"); f2 = VAULT + "/Pushed"; os.makedirs(f2, exist_ok=True); tick_ = d.get("tickers") or []
            out = ["---", "type: pushed", "date: " + day, "url: " + u, "tickers: " + json.dumps(tick_), "---", "", "# " + str(d.get("title") or k.get("title") or u), "", "**" + str(d.get("takeaway") or "") + "**", "", links(tick_), ""] + ["- " + str(x) for x in d.get("points") or []] + ["", u, ""]
            if k.get("note"): out += ["His note: " + str(k["note"]), ""]
            open(f2 + "/" + day + " " + safe(d.get("title") or u) + ".md", "w").write("\n".join(out))
            rpc("brain_kept_done", {"p_token": TOKEN, "p_id": k["id"], "p_state": "done", "p_result": d.get("takeaway") or ""}); log("kept", u[:80], worker)
            notify(title=d.get("takeaway") or d.get("title") or k.get("title") or u, url=u, kind="read", level=2, key="kept|" + str(k["id"]), source="Your push", ticker=(tick_[0] if tick_ else None))   # what he sent comes back as a card, like everything else
        except Exception as e:
            log("kept failed", u[:80], str(e)[:160]); rpc("brain_kept_done", {"p_token": TOKEN, "p_id": k["id"], "p_state": "failed", "p_result": str(e)[:200]})

# ---- the light reads: one line from the free local model on what a chapter list says. Alan: "it seemed like ... just a raw extraction of the chapters"; "put in open source models into these processes" ----
def light_lines(limit=12):
    llm = SUP + "/llm/venv/bin/python"
    if not os.path.exists(llm): return
    rows = rest("youtube_reads?select=video_id,title,chapters&tier=eq.light&takeaway=is.null&worker=eq.none&order=published_at.desc&limit=80")
    job = [{"id": r["video_id"], "title": r["title"], "chapters": [c.get("title", "") for c in r["chapters"]][:14]} for r in rows if r.get("chapters")][:limit]
    if not job: return
    try:
        p = subprocess.run([llm, SUP + "/lines.py"], input=json.dumps(job), capture_output=True, text=True, timeout=240)
        got = json.loads(p.stdout.strip().splitlines()[-1])
    except Exception as e: log("lines failed", str(e)[:160]); return
    for j in job:
        line = re.sub(r"^(the|this) (video|episode|podcast) \w+( that)?\s+", "", str(got.get(j["id"]) or "").strip().strip('"'), flags=re.I); line = line[:1].upper() + line[1:]; src = j["title"] + " " + " ".join(j["chapters"])
        bad = not line or len(line.split()) > 34 or any(t not in src for t in re.findall(r"\b[A-Z]{2,5}\b", line))   # the model once invented a ticker; a line that names one the video does not is dropped
        put("line", {"video_id": j["id"], "takeaway": None if bad else line, "worker": "qwen"})
    log("lines", len(job))

def backup_check():   # once a day: is the last worker in the chain still signed in? Its sign-in expires, and only Alan can renew it, so say so before it is needed
    mark = WORK + "/backup-check-" + datetime.datetime.now(NY).strftime("%Y%m%d")
    if os.path.exists(mark): return
    open(mark, "w").write("1")
    env = {k: v for k, v in os.environ.items() if k not in ("ANTHROPIC_BASE_URL", "ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN", "CLAUDE_CONFIG_DIR")}
    r = subprocess.run([claude_bin(), "auth", "status", "--json"], env=env, capture_output=True, text=True, timeout=30, stdin=subprocess.DEVNULL)
    if not json.loads(r.stdout or "{}").get("loggedIn"): notify(title="The Claude backup worker is signed out: double-click SIGN_IN_GMAIL_WORKER on the Desktop", kind="ops", level=1, key="ops|claude-signin|" + os.path.basename(mark), source="News brain")

def tick():
    lock = WORK + "/tick.lock"
    try:
        if os.path.exists(lock) and time.time() - os.path.getmtime(lock) < 3000: return
        open(lock, "w").write(str(os.getpid()))
        try: backup_check()
        except Exception as e: log("backup check error", str(e)[:160])
        try: light_lines()
        except Exception as e: log("lines error", str(e)[:160])
        reads_due(); kept(); videos()
    finally:
        try: os.remove(lock)
        except OSError: pass
if __name__ == "__main__":
    a = sys.argv[1:] or ["tick"]
    if a[0] == "tick": tick()
    elif a[0] == "videos": videos(limit=int(a[1]) if len(a) > 1 else MAX_VIDEOS_PER_TICK, hours=int(a[2]) if len(a) > 2 else 48)
    elif a[0] == "read": make_read(a[1], int(a[2]) if len(a) > 2 else 24, stamp=a[3] if len(a) > 3 else None)
    elif a[0] == "kept": kept()
    elif a[0] == "lines": light_lines(int(a[1]) if len(a) > 1 else 12)
    elif a[0] == "testworker":   # BRAIN_WORKERS=codex brain.py testworker <folder with TASK.md inputs>: does this worker finish a real job?
        f = a[1]; print(run_worker("test-" + WORKERS[0], f, open(f + "/TASK.md").read(), "read.json", timeout=600))
