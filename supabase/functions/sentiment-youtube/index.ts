// SCINTILLA · sentiment-youtube — one reading per (video, ticker), on the same stick.
//
// WHY. youtube_video_sentiment held 0 rows for the same reason the headline table did:
// the scorer lived on a Mac and needed a key nobody should copy. The room therefore read
// video TITLES in the browser and said so on the page. This writes the real per-video
// rows, in Supabase, with no key on any laptop.
//
// THE READING IS TAKEN AROUND THE MENTION, NOT OVER THE WHOLE CLIP. A forty-minute
// video is not "about" one stock; scoring the whole transcript once would paint every
// ticker it names with the same number. So for each (video, ticker) the score is the mean
// of the ±40-word windows around that ticker's mentions — and when no transcript row
// exists, the title is scored instead and the row SAYS SO in sample_src, because a title
// is written to be clicked.
//
// It never fetches YouTube, never touches the collector, and never writes a video row.
import { pg, pgAll, upsert, cfgPut, claim, lexicon } from "../_shared/db.ts";
// @ts-ignore  the shared stick is plain ESM, read by Deno, Node and the browser alike
import { prepare, scoreText, scoreMentions, dailyRollup, dayOf, dayBounds, WEIGHTING, METHOD } from "../_shared/sentiment-core.mjs";

const clampInt = (v: string | null, d: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, +(v || d) || d));

async function rebuildDay(day: string, sha: string, dry: boolean) {
  const b = dayBounds(day);
  /* the per-video rows carry no published time of their own, so the day is taken from
     the video row the reading belongs to */
  const vids = await pgAll(
    `youtube_videos?select=video_id,published_at&published_at=gte.${new Date(b.from * 1000).toISOString()}` +
    `&published_at=lt.${new Date(b.to * 1000).toISOString()}`, 1000, 6,
  );
  const ids = vids.map((v: any) => v.video_id);
  if (!ids.length) return { day, read: 0, ticker_rows: 0 };
  const rows: any[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const slice = ids.slice(i, i + 100).map((x: string) => `"${x}"`).join(",");
    rows.push(...await pgAll(`youtube_video_sentiment?select=video_id,ticker,lean,hits&video_id=in.(${slice})`, 1000, 4));
  }
  const items = rows.map((r: any) => ({
    ticker: r.ticker, day,
    score: r.lean == null ? null : +r.lean,
    question: false,
    marks: Array.isArray(r.hits) ? r.hits : [],
  }));
  const daily = dailyRollup(items, { source: "youtube", lexicon_sha: sha });
  if (!dry && daily.length) {
    await upsert("sentiment_ticker_daily", daily.map((d: any) => ({ ...d, updated_at: new Date().toISOString() })), "day,ticker,source");
  }
  return { day, read: rows.length, ticker_rows: daily.length };
}

Deno.serve(async (req) => {
  const started = Date.now();
  const u = new URL(req.url);
  const days = clampInt(u.searchParams.get("days"), 7, 1, 60);
  const limit = clampInt(u.searchParams.get("limit"), 800, 50, 2000);
  const maxDays = clampInt(u.searchParams.get("max_days"), 8, 1, 30);
  const dry = u.searchParams.get("dry") === "1";
  let release: null | (() => unknown) = null;
  try {
    release = await claim("sentiment_youtube_busy", 50 * 60e3);
    if (!release) return Response.json({ skipped: "ANOTHER_RUN_IN_FLIGHT" });

    const { lex, sha } = await lexicon();
    const L = prepare(lex);
    const since = new Date(Date.now() - days * 864e5).toISOString();

    const vids = await pg(
      `youtube_videos?select=video_id,ticker,channel_title,title,description,published_at` +
      `&ticker=not.is.null&published_at=gte.${since}&order=published_at.desc&limit=${limit}`,
    );
    if (!vids.length) {
      const empty = { ran_utc: new Date().toISOString(), read: 0, note: "no ticker-tagged clips in the window", days };
      await cfgPut("sentiment_youtube_last", JSON.stringify(empty));
      return Response.json(empty);
    }

    /* transcripts, where they exist — the reading prefers them and says which it used */
    const tmap = new Map<string, string>();
    const ids = vids.map((v: any) => v.video_id);
    for (let i = 0; i < ids.length; i += 100) {
      const slice = ids.slice(i, i + 100).map((x: string) => `"${x}"`).join(",");
      const tr = await pgAll(`youtube_transcripts?select=video_id,text,status&status=eq.ok&video_id=in.(${slice})`, 1000, 4)
        .catch(() => []);
      for (const t of tr as any[]) if (t.text) tmap.set(t.video_id, t.text);
    }

    const out: any[] = [];
    const touched = new Set<string>();
    let fromTranscript = 0, fromTitle = 0, noReading = 0;
    for (const v of vids) {
      const tk = String(v.ticker).toUpperCase();
      const transcript = tmap.get(v.video_id) || null;
      let row: any;
      if (transcript) {
        const m = scoreMentions(transcript, tk, L, { radius: 40 });
        if (m.mentions === 0) {
          /* the transcript never says the name the collector filed it under: that is a
             fact about the collector, not a bearish opinion. No score. */
          row = { mentions: 0, windows: 0, lean: null, pos: 0, neg: 0, marks: [], sample: null, src: "transcript" };
        } else { row = { ...m, src: "transcript" }; fromTranscript++; }
      } else {
        const s = scoreText(String(v.title || "") + (v.description ? ". " + String(v.description).slice(0, 400) : ""), L);
        row = { mentions: 1, windows: s.score == null ? 0 : 1, lean: s.score == null ? null : +s.score.toFixed(3),
                pos: s.pos, neg: s.neg, marks: s.marks, sample: s.sample, src: "title" };
        fromTitle++;
      }
      if (row.lean == null) noReading++;
      const d = dayOf(Date.parse(v.published_at));
      if (d) touched.add(d);
      out.push({
        video_id: v.video_id, ticker: tk,
        mentions: row.mentions, lean: row.lean, windows: row.windows,
        method: METHOD, bullish_hits: row.pos, bearish_hits: row.neg,
        hits: row.marks, sample: row.sample, sample_src: row.src,
        computed_at: new Date().toISOString(),
      });
    }

    let written = 0;
    if (!dry && out.length) written = await upsert("youtube_video_sentiment", out, "video_id,ticker");

    const ordered = [...touched].sort().reverse();
    const rebuilt = [];
    for (const d of ordered.slice(0, maxDays)) rebuilt.push(await rebuildDay(d, sha, dry));

    const receipt = {
      ran_utc: new Date().toISOString(), ms: Date.now() - started, dry,
      lexicon_sha: sha, method: METHOD, weighting: WEIGHTING,
      window_days: days, clips_read: vids.length, rows_written: written,
      scored_from_transcript: fromTranscript, scored_from_title: fromTitle, no_reading: noReading,
      transcripts_available: tmap.size,
      days_touched: ordered, days_rebuilt: rebuilt, days_deferred: ordered.slice(maxDays),
    };
    await cfgPut("sentiment_youtube_last", JSON.stringify(receipt));
    return Response.json(receipt);
  } catch (e) {
    await cfgPut("sentiment_youtube_error", JSON.stringify({ at: new Date().toISOString(), error: String((e as Error).message || e) }));
    return Response.json({ failed: String((e as Error).message || e) }, { status: 500 });
  } finally {
    if (release) await release();
  }
});
