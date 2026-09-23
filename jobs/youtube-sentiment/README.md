# YouTube → SENTIMENT job (SCI-16 / SCI-26)

Fills `public.social_sentiment` (the Hub SOCIAL › SENTIMENT box) from the videos of the channels Alan
subscribes to (`youtube_videos.source = subscription`, both the personal and SCINTILLA identities), using
their English transcripts. Zero YouTube Data API quota: transcripts come from the public timedtext track
(`youtube-transcript-api`); the official `captions.download` endpoint only works for videos the caller owns.

## What runs, how often, where
* `youtube_sentiment.py run --days 7 --limit 60` every **30 minutes** via launchd on the MacBook
  (`launchd/com.scintilla.youtube-sentiment.plist`). Each pass: fetch up to 60 new transcripts (1 request/s,
  never re-fetching a held one) → analyze the 7-day window → upsert one row per ticker.
* Cache: `~/Library/Application Support/scintilla/youtube-sentiment/transcripts/<video_id>.json`, outputs in
  `…/out/{rows,videos,summary,aliases}.json`.
* Log: `~/Library/Logs/scintilla-youtube-sentiment.log`.

## Install (root, once)
```
python3 -m pip install --target vendor youtube-transcript-api          # vendored, gitignored
install -m 600 /dev/null ~/.config/scintilla/youtube-sentiment.env    # then put SUPABASE_SERVICE_ROLE_KEY=… in it
psql "$SCINTILLA_PG_DSN" -f sql/001_youtube_sentiment.sql             # latest-mention columns + DB-side tables
cp launchd/com.scintilla.youtube-sentiment.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.scintilla.youtube-sentiment.plist
```
See it running: `launchctl print gui/$(id -u)/com.scintilla.youtube-sentiment | head -20` and `tail -f ~/Library/Logs/scintilla-youtube-sentiment.log`.
Stop it: `launchctl bootout gui/$(id -u)/com.scintilla.youtube-sentiment`.
Caveat: launchd on a laptop only runs while the Mac is awake; the 30-minute interval catches up on wake.

## Tests (offline)
`python3 tests/test_youtube_sentiment.py`

## Data rules honoured
Reads: youtube_videos, cohorts, company_profile (anon). Writes: social_sentiment only (plus the two YouTube
tables once the migration exists). Never a price table. Keys come from the environment / the 600-mode env file only.
