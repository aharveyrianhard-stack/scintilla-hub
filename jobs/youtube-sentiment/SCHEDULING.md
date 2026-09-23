# Keeping the YouTube reading fresh — what would schedule it (nothing here was installed)

The job runs by hand today. Lane M20 found its launch agent **is not installed**, so the
YouTube voice only moves when somebody remembers to run it. This file is the exact thing
to install, and the two things that are wrong with the plist as it stands. **Lane M27
installed nothing, loaded nothing and started nothing.**

## 1 · The plist points at a lane worktree, which will not survive
`jobs/youtube-sentiment/launchd/com.scintilla.youtube-sentiment.plist` runs

```
/Users/alanharvey/SCINTILLA 0.5/_worktrees/youtube-sentiment-20260922/jobs/youtube-sentiment/youtube_sentiment.py
```

That is lane M20's worktree. A worktree is deleted when its branch is merged, and the
scheduled job then fails silently every half hour. **Point it at the deployed checkout**
(`/Users/alanharvey/SCINTILLA 0.5/_VERCEL_DEPLOY/jobs/youtube-sentiment/youtube_sentiment.py`)
and at that checkout's `vendor` directory in `PYTHONPATH`, or at a copy that is not a worktree.

## 2 · What to run, once the path is fixed

```bash
# 1. the write key goes in a file the job reads, mode 600, never in git:
#    (root does this once; the key is never printed and never committed)
mkdir -p ~/.config/scintilla && chmod 700 ~/.config/scintilla
printf 'SUPABASE_SERVICE_ROLE_KEY=%s\n' "$KEY" > ~/.config/scintilla/youtube-sentiment.env
chmod 600 ~/.config/scintilla/youtube-sentiment.env

# 2. the per-video tables (001 may already be applied; 002 is lane M27's evidence columns)
psql "$SUPABASE_DSN" -f jobs/youtube-sentiment/sql/001_youtube_sentiment.sql
psql "$SUPABASE_DSN" -f jobs/youtube-sentiment/sql/002_youtube_video_evidence.sql

# 3. one pass by hand first, and read what it says before scheduling anything
python3 jobs/youtube-sentiment/youtube_sentiment.py run --days 7 --limit 40 --pause 8 --dry-run

# 4. only then, the schedule
cp jobs/youtube-sentiment/launchd/com.scintilla.youtube-sentiment.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.scintilla.youtube-sentiment.plist
launchctl kickstart -p gui/$(id -u)/com.scintilla.youtube-sentiment     # run it once now
launchctl print gui/$(id -u)/com.scintilla.youtube-sentiment | head -20 # state, last exit code
tail -f ~/Library/Logs/scintilla-youtube-sentiment.log
```

`StartInterval` is 1,800 s (half an hour) with `RunAtLoad`. The job paces its transcript
fetches at 8 s and takes at most 40 new transcripts a pass, because YouTube rate-limits the
timedtext endpoint per IP — that pacing is why the interval is short and the limit is low.

To stop it: `launchctl bootout gui/$(id -u)/com.scintilla.youtube-sentiment`.

## 3 · What changed in the job itself (lane M27)
* `score_marks()` keeps **every word that fired**, which way it counted and whether a
  negator flipped it. `score_text()` is unchanged arithmetic — it is now the sum of those
  marks — so no number the room already shows moves.
* `analyze` stores, per video and ticker, the bullish and bearish hit counts, the words,
  and **the ±40-word transcript window the lean came from**.
* `apply` now also upserts **`youtube_video_sentiment`** (one row per video and ticker).
  This is what makes the blend cover every ticker the channels talked about instead of the
  nine the pooled roll-up happens to carry, and what lets the Hub show the transcript
  window behind a reading instead of only a number.
* The evidence columns are written only when migration 002 has been applied; the job
  probes for them read-only first, exactly as it already does for `social_sentiment`.
