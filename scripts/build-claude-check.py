#!/usr/bin/env python3
"""Build deliverables/20260923/claude-check/CLAUDE-CHECK.html from three files:

  the collector's bookmark store   (runtime)  — what X returned, unedited
  triage.json                      (repo)     — one worker's reading of each bookmark
  tickers.json                     (repo)     — what the chart API serves, and the cohort call

Run it after any collector pass to refresh the page:
  python3 scripts/build-claude-check.py [--store <runtime>/bookmarks/claude-check/store.json]
"""
import argparse, html, json, os, re, datetime

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "deliverables", "20260923", "claude-check")
DEFAULT_STORE = "/Users/alanharvey/SCINTILLA 0.5/_orchestration/xfeed-live/runtime/bookmarks/claude-check/store.json"
e = lambda s: html.escape(str(s) if s is not None else "")

def linkify(text):
    out = e(text).replace("\n", "<br>")
    return re.sub(r"(https?://[^\s<]+)", r'<a href="\1" rel="noopener noreferrer nofollow">\1</a>', out)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--store", default=DEFAULT_STORE)
    ap.add_argument("--proof", default=os.path.join(OUT, "proof.json"))
    a = ap.parse_args()
    store = json.load(open(a.store))
    triage = json.load(open(os.path.join(OUT, "triage.json")))["posts"]
    tickers = json.load(open(os.path.join(OUT, "tickers.json")))
    proof = json.load(open(a.proof)) if os.path.exists(a.proof) else {}
    posts = sorted(store["posts"].values(), key=lambda p: (p.get("created_at") or ""), reverse=True)
    json.dump({"folder": store.get("folder"), "updated_at": store.get("updated_at"), "count": len(posts),
               "posts": posts}, open(os.path.join(OUT, "bookmarks.json"), "w"), indent=1)

    AREA = {"IDEA": "IDEA / WATCHLIST", "DATA": "DATA", "STATION": "STATION / INDICATOR", "HUB": "HUB ROOM"}
    cards = []
    for p in posts:
        t = triage.get(p["id"], {})
        tags = "".join(f'<span class="cc-tag">${e(c)}</span>' for c in sorted(p.get("cashtags") or []))
        quoted = ""
        if p.get("quoted"):
            q = p["quoted"]
            quoted = (f'<div class="cc-quote"><span class="cc-who">quoting @{e(q.get("author_handle"))}</span>'
                      f'<div>{linkify((q.get("text") or "")[:400])}</div></div>')
        alt = "".join(f'<div class="cc-alt">picture described as: {e(m["alt"])}</div>' for m in (p.get("media_alt") or []))
        links = "".join(f'<div class="cc-link"><a href="{e(u)}" rel="noopener noreferrer nofollow">{e(u[:90])}</a></div>' for u in (p.get("links") or []))
        cards.append(f"""<article class="cc-card" data-area="{e(t.get('area','IDEA'))}">
 <header class="cc-card__hd"><span class="cc-area">{e(AREA.get(t.get('area','IDEA'), t.get('area','IDEA')))}</span>
  <span class="cc-who">@{e(p.get('author_handle'))} · {e((p.get('created_at') or '')[:10])}</span>
  <a class="cc-open" href="{e(p.get('url'))}" rel="noopener noreferrer nofollow">open on X</a></header>
 <p class="cc-about">{e(t.get('about','—'))}</p>
 <p class="cc-action"><span class="cc-lab">proposed:</span> {e(t.get('action','—'))}</p>
 <details class="cc-raw"><summary>the post itself</summary><div class="cc-text">{linkify(p.get('text') or '')}</div>{quoted}{alt}{links}</details>
 <div class="cc-tags">{tags}</div>
</article>""")

    def trow(r):
        served = "yes" if r.get("served") else "no"
        coh = r.get("cohort") or r.get("proposed_cohort") or "—"
        cohnote = "" if r.get("cohort") else (" <span class='cc-prop'>proposed</span>" if r.get("proposed_cohort") else "")
        fav = {"already": "already a favourite", "ADD": "ADD", "no": "—", "after it is served": "after it is served"}.get(r["fav"], r["fav"])
        return (f"<tr><td class='cc-tk'>{e(r['ticker'])}</td><td>{r['mentions']}</td><td>{served}</td>"
                f"<td>{e(coh)}{cohnote}</td><td>{e(r['reason'])}</td><td class='cc-fav'>{e(fav)}</td></tr>")

    groups = [("Served by the chart API", [r for r in tickers if r["decision"] == "already served"]),
              ("Named here, not served — candidates with a proposed cohort", [r for r in tickers if r["decision"] == "candidate"]),
              ("In the Hub but not served by the chart API", [r for r in tickers if r["decision"] == "in the Hub, not served"]),
              ("Not proposed", [r for r in tickers if r["decision"] in ("not proposed", "NOT A TICKER HERE")])]
    tables = "".join(
        f"<h3 class='cc-h3'>{e(title)} <span class='cc-n'>{len(rows)}</span></h3>"
        "<div class='cc-scroll'><table class='cc-table'><thead><tr><th>ticker</th><th>bookmarks</th><th>served?</th><th>cohort</th><th>reason</th><th>favourite</th></tr></thead><tbody>"
        + "".join(trow(r) for r in sorted(rows, key=lambda r: (-r["mentions"], r["ticker"]))) + "</tbody></table></div>"
        for title, rows in groups if rows)

    counts = {k: sum(1 for p in posts if triage.get(p["id"], {}).get("area") == k) for k in ("IDEA", "DATA", "STATION")}
    built = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    snippet = open(os.path.join(HERE, "scripts", "scnav-snippet.html")).read()
    page = TEMPLATE.format(
        scnav=snippet,
        n=len(posts), folder=e(store.get("folder", "Claude Check")), built=built,
        updated=e((store.get("updated_at") or "")[:16].replace("T", " ") + " UTC"),
        cards="\n".join(cards), tables=tables,
        idea=counts["IDEA"], data=counts["DATA"], station=counts["STATION"],
        served=sum(1 for r in tickers if r.get("served")), cand=sum(1 for r in tickers if r["decision"] == "candidate"),
        favadd=", ".join(r["ticker"] for r in tickers if r["fav"] == "ADD"),
        nfav=sum(1 for r in tickers if r["fav"] == "ADD"),
        proof_status=e(proof.get("status", "—")), proof_posts=e(proof.get("observed_posts", "—")),
        proof_when=e((proof.get("finished_at","—") or "")[:16].replace("T"," ") + " UTC"), proof_bm=e(proof.get("bookmarks_posts", "—")),
        distinct=len(tickers))
    open(os.path.join(OUT, "CLAUDE-CHECK.html"), "w").write(page)
    print(f"wrote CLAUDE-CHECK.html · {len(posts)} bookmarks · {len(tickers)} tickers")

TEMPLATE = r"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>CLAUDE CHECK — the bookmark backlog</title>
<style>
  :root {{ --bg:#0c0c0c; --panel:#141414; --line:#262626; --ink:#c6c6c6; --ink2:#8f8f8f; --ink3:#6e6e6e; --hi:#d2d2d2; }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; background:var(--bg); color:var(--ink); font:13px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; }}
  .cc-wrap {{ max-width:1180px; margin:0 auto; padding:22px 16px 70px; }}
  .cc-top {{ margin:0 0 14px; }}
  h1 {{ font:600 20px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.06em; color:var(--hi); margin:0 0 4px; }}
  .cc-sub {{ color:var(--ink2); font-size:12px; margin:0 0 20px; }}
  .cc-panel {{ background:var(--panel); border:1px solid var(--line); border-radius:6px; padding:14px 16px; margin:0 0 16px; }}
  .cc-panel h2 {{ font:600 12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.1em; color:var(--ink2); text-transform:uppercase; margin:0 0 10px; }}
  .cc-panel p {{ margin:0 0 9px; font-size:13px; }}
  .cc-panel p:last-child {{ margin-bottom:0; }}
  .cc-stats {{ display:flex; flex-wrap:wrap; gap:10px; margin:0 0 16px; }}
  .cc-stat {{ background:var(--panel); border:1px solid var(--line); border-radius:6px; padding:9px 13px; min-width:104px; }}
  .cc-stat b {{ display:block; font:600 19px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace; color:var(--hi); }}
  .cc-stat span {{ font-size:11px; color:var(--ink3); letter-spacing:.04em; }}
  .cc-h3 {{ font:600 12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.08em; color:var(--ink2); text-transform:uppercase; margin:20px 0 8px; }}
  .cc-n {{ color:var(--ink3); }}
  .cc-scroll {{ overflow-x:auto; border:1px solid var(--line); border-radius:6px; }}
  .cc-table {{ width:100%; border-collapse:collapse; font-size:12px; background:var(--panel); }}
  .cc-table th {{ text-align:left; font:600 11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.06em; color:var(--ink3); text-transform:uppercase; padding:8px 10px; border-bottom:1px solid var(--line); white-space:nowrap; }}
  .cc-table td {{ padding:7px 10px; border-bottom:1px solid #1d1d1d; vertical-align:top; }}
  .cc-table tr:last-child td {{ border-bottom:0; }}
  .cc-tk {{ font:600 12px ui-monospace,SFMono-Regular,Menlo,monospace; color:var(--hi); white-space:nowrap; }}
  .cc-fav {{ font:600 11px ui-monospace,SFMono-Regular,Menlo,monospace; color:var(--ink2); white-space:nowrap; }}
  .cc-prop {{ color:var(--ink3); font-size:10px; }}
  .cc-filters {{ display:flex; flex-wrap:wrap; gap:6px; margin:18px 0 12px; }}
  .cc-filters button {{ background:var(--panel); border:1px solid var(--line); color:var(--ink2); font:600 11px ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.06em; padding:7px 11px; border-radius:5px; cursor:pointer; }}
  .cc-filters button[aria-pressed="true"] {{ color:var(--hi); border-color:#3a3a3a; }}
  .cc-cards {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(330px,1fr)); gap:10px; }}
  .cc-card {{ background:var(--panel); border:1px solid var(--line); border-radius:6px; padding:12px 13px; }}
  .cc-card__hd {{ display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:baseline; gap:8px; margin:0 0 8px; }}
  .cc-area {{ font:600 10px ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.09em; color:var(--ink3); border:1px solid var(--line); border-radius:3px; padding:2px 6px; }}
  .cc-who {{ font-size:11px; color:var(--ink3); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }}
  .cc-open {{ font-size:11px; white-space:nowrap; color:var(--ink2); text-decoration:none; border-bottom:1px solid var(--line); }}
  .cc-about {{ margin:0 0 7px; font-size:13px; color:var(--ink); }}
  .cc-action {{ margin:0 0 8px; font-size:12px; color:var(--ink2); }}
  .cc-lab {{ font:600 10px ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.08em; color:var(--ink3); text-transform:uppercase; }}
  .cc-raw summary {{ cursor:pointer; font:600 10px ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.08em; color:var(--ink3); text-transform:uppercase; }}
  .cc-text {{ margin:8px 0 0; font-size:12px; color:var(--ink2); white-space:normal; }}
  .cc-quote {{ margin:8px 0 0; padding:8px 10px; border-left:2px solid var(--line); font-size:12px; color:var(--ink3); }}
  .cc-alt, .cc-link {{ margin:7px 0 0; font-size:11px; color:var(--ink3); word-break:break-all; }}
  .cc-card a {{ color:var(--ink2); }}
  .cc-tags {{ display:flex; flex-wrap:wrap; gap:4px; margin:9px 0 0; }}
  .cc-tag {{ font:600 10px ui-monospace,SFMono-Regular,Menlo,monospace; color:var(--ink3); border:1px solid var(--line); border-radius:3px; padding:1px 5px; }}
  code {{ font:12px ui-monospace,SFMono-Regular,Menlo,monospace; color:var(--ink2); }}
  @media (max-width:560px) {{ .cc-cards {{ grid-template-columns:1fr; }} .cc-wrap {{ padding:16px 12px 60px; }} }}
</style></head>
<body><div class="cc-wrap">

<header class="cc-top"><span data-scnav-slot></span></header>
<h1>CLAUDE CHECK</h1>
<p class="cc-sub">Your X bookmark folder “{folder}”, read by the collector on this MacBook · {n} bookmarks · folder last read {updated} · page built {built}</p>

<div class="cc-stats">
  <div class="cc-stat"><b>{n}</b><span>BOOKMARKS</span></div>
  <div class="cc-stat"><b>{distinct}</b><span>TICKERS NAMED</span></div>
  <div class="cc-stat"><b>{served}</b><span>ALREADY SERVED</span></div>
  <div class="cc-stat"><b>{cand}</b><span>NOT SERVED YET</span></div>
  <div class="cc-stat"><b>{nfav}</b><span>NEW FAVOURITES</span></div>
</div>

<section class="cc-panel">
  <h2>What this page shows</h2>
  <p>Every post in your bookmark folder, as a card: what it is about, which part of Scintilla it touches, and one suggested next step. Nothing on this page was built — it is a list for you to go through and say yes or no to.</p>
  <p>Under the cards is every ticker those posts name: whether Scintilla can already price it, which cohort it sits in (or would sit in), and whether it has been made a favourite.</p>
  <p>The three kinds of card: <b>IDEA / WATCHLIST</b> ({idea}) is somebody's trade or ticker, <b>DATA</b> ({data}) is a number Scintilla does not hold yet, <b>STATION / INDICATOR</b> ({station}) is a way of reading a chart.</p>
</section>

<section class="cc-panel">
  <h2>Where each number comes from</h2>
  <p><b>The posts</b> come from the folder itself, read by the collector's own signed-in browser on this MacBook. Nothing was retyped: the text, author, date, links, picture descriptions and $tickers are as X returned them.</p>
  <p><b>“Served?”</b> is a live read of the chart API's universe list ({served} of the names here are in it; the universe holds 364 symbols in total).</p>
  <p><b>The cohorts and the favourites</b> are read from the same tables the Hub reads — the favourites list is the cross-device one, not your browser's.</p>
  <p><b>The reading of each post</b> — “what it is about” and “proposed” — is one worker's judgement, not a measurement. Disagree freely.</p>
</section>

<section class="cc-panel">
  <h2>The proof run</h2>
  <p>One manual pass on this MacBook, on {proof_when}, with the real folder and the real Trading list. The Trading list came back with <b>{proof_posts}</b> posts and published as usual; in the same pass the bookmark folder returned <b>{proof_bm}</b> posts. Both halves are in the pass's own receipt.</p>
  <p>The folder is read as a sidecar after the Trading list has finished and written its receipt, in the same browser, on the same nine-times-a-day schedule. No new background job was installed. If the folder read fails, the Trading list result is untouched.</p>
  <p>Running it twice changes nothing: the second pass added 0 and changed 0.</p>
</section>

<section class="cc-panel">
  <h2>What could be wrong</h2>
  <p>A $word in a post is not always a ticker. <code>$ES</code> here is the S&amp;P future, not Eversource Energy, and a few others are option shorthand or a truncated word — those are listed at the bottom of the table as “not a ticker here”, not silently counted.</p>
  <p>The folder is read by scrolling until X stops sending more. If X changes that page, the read stops and says so rather than inventing a shorter folder.</p>
  <p>A ticker being “not served” does not mean it is a bad name — it means Scintilla has no bars for it, so nothing on the board would be real until the universe is extended.</p>
  <p>Favourites were added only for names this folder mentions in two or more separate bookmarks, because favourites are what your board opens on. The one-mention names are listed and can be added in one line.</p>
</section>

<section class="cc-panel">
  <h2>What I did not do</h2>
  <p>Nothing was deployed, pushed or published. No bookmark was added, removed or changed on X — the folder was only read. No price table was written.</p>
  <p>The new favourites and the candidate list are written as two database migrations for the coordinator to apply; they have not been applied.</p>
  <p>No ticker was added to the chart API's universe. That is not an additive change: the universe is pinned by a count and a digest in both the chart API and the Hub, so a new symbol needs the universe file extended, the digest re-pinned and a deploy.</p>
  <p>Nothing on the cards was built. This page is the triage list, not the work.</p>
</section>

<h3 class="cc-h3">The tickers</h3>
{tables}

<section class="cc-panel" style="margin-top:16px">
  <h2>Rollback for each additive change</h2>
  <p><b>Favourites</b> (<code>20260923_claude_check_favorites.sql</code>): adds {nfav} rows — {favadd}. To undo: the delete statement at the bottom of that file removes exactly those tickers and nothing else.</p>
  <p><b>Candidate list</b> (<code>20260923_claude_check_candidates.sql</code>): creates one new table that nothing reads yet. To undo: <code>drop table public.claude_check_candidates;</code></p>
  <p><b>The collector</b>: the folder read is a sidecar with an off switch — <code>--no-bookmarks</code>, or remove the one line that calls it. The Trading list code is untouched either way, and the folder's posts are kept in their own directory, beside the Trading list's files, never inside them.</p>
</section>

<h3 class="cc-h3">The backlog <span class="cc-n">{n}</span></h3>
<div class="cc-filters">
  <button type="button" data-f="ALL" aria-pressed="true">ALL {n}</button>
  <button type="button" data-f="IDEA" aria-pressed="false">IDEA / WATCHLIST {idea}</button>
  <button type="button" data-f="DATA" aria-pressed="false">DATA {data}</button>
  <button type="button" data-f="STATION" aria-pressed="false">STATION {station}</button>
</div>
<div class="cc-cards" id="ccCards">
{cards}
</div>

</div>
<script>
(function () {{
  var buttons = document.querySelectorAll(".cc-filters button");
  var cards = document.querySelectorAll("#ccCards .cc-card");
  buttons.forEach(function (b) {{
    b.addEventListener("click", function () {{
      buttons.forEach(function (o) {{ o.setAttribute("aria-pressed", String(o === b)); }});
      var want = b.getAttribute("data-f");
      cards.forEach(function (c) {{ c.style.display = (want === "ALL" || c.getAttribute("data-area") === want) ? "" : "none"; }});
    }});
  }});
}})();
</script>
{scnav}
</body></html>
"""

if __name__ == "__main__":
    main()
