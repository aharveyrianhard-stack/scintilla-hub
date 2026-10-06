# Grok Bot inbox — what to post, and what comes back

For Grok Bot, from the Scintilla coordinator, with Alan's approval (5 Oct 2026). One page. Everything you send
goes to one address as JSON over HTTPS. Nothing here asks you to push to a repo or to open anything on our side.

## 1. Where and how

- **Address:** `https://wadinxqplrggagkvrdag.supabase.co/functions/v1/grokbot-inbox`
- **Method:** `POST` to send, `GET` to ask what we have and which YouTube channels we follow.
- **Header:** `Authorization: Bearer <token>` and `Content-Type: application/json`.
- **The token** is given to you by Alan through your secure prompt. It never goes through chat, a file, a repo
  or a log. If you ever see it in a chat, tell Alan and we replace it.
- **Size:** at most 1 MB per POST and at most 2,000 items per POST. Split anything bigger.
- **Sending twice is safe.** Every item has a natural key (shown per kind below). The same key again updates the
  same row; it never makes a second one.

## 2. The envelope (the same for every kind)

```json
{ "kind": "<one of the six kinds>", "sent_at": "2026-10-06T13:45:00Z", "items": [ ] }
```

- `kind` — `x_posts`, `youtube_chunks`, `youtube_channel_map`, `x_following`, `news_scores` or `heartbeat`.
- `sent_at` — your clock when you send, ISO 8601 **with a zone** (`Z` or `-04:00`). No zone = refused.
- `items` — a list. One kind per POST.

## 3. What comes back

| Answer | Meaning | What you do |
| --- | --- | --- |
| `200` `{"ok":true,"kind":…,"accepted":N,"rejected":[{"i":3,"reason":"…"}]}` | Read and filed. `i` is the position in your `items` (first = 0). `warnings` may be added. | Fix rejected items before resending them; do not resend them unchanged. |
| `400` `{"error":"bad_envelope","reason":"…"}` | The envelope itself is wrong (not JSON, unknown kind, no zone, too many items). | Fix it. Do not retry unchanged. |
| `401` | Token missing or wrong. | Stop and tell Alan. Do not retry in a loop. |
| `413` | Over 1 MB. | Split and resend. |
| `503` with `"retry":true`, or any other `5xx`, or no answer | Our side could not store it. Nothing was half-accepted. | Send the same POST again after 60 seconds, then 5 minutes, then 15. |

## 4. The six kinds, one example each

### `x_posts` — the tape (key: the post id; a repost: who reposted + the id)

```json
{
  "kind": "x_posts",
  "sent_at": "2026-10-06T13:45:00Z",
  "items": [
    {
      "id": "1975000000000000001",
      "handle": "alphatrends",
      "kind": "original",
      "created_at": "2026-10-06T13:31:07Z",
      "text": "$NVDA holding the 5-day. $AMD lagging.",
      "url": "https://x.com/alphatrends/status/1975000000000000001",
      "list": "tracked",
      "photos": ["https://pbs.twimg.com/media/example.jpg"],
      "links": [{ "url": "https://youtu.be/dQw4w9WgXcQ", "title": "Morning video" }]
    },
    {
      "id": "1975000000000000002",
      "handle": "ripster47",
      "kind": "repost",
      "created_at": "2026-10-06T13:40:00Z",
      "text": "",
      "url": "https://x.com/ripster47/status/1975000000000000002",
      "list": "bell",
      "original": {
        "id": "1975000000000000001",
        "handle": "alphatrends",
        "text": "$NVDA holding the 5-day. $AMD lagging.",
        "url": "https://x.com/alphatrends/status/1975000000000000001",
        "created_at": "2026-10-06T13:31:07Z"
      }
    }
  ]
}
```

- **Required:** `id` (a **string** of digits, never a number — the ids do not fit a JavaScript number), `handle`
  (no `@`), `kind` (`original`, `reply`, `quote` or `repost`), `created_at` (when X says it was posted, with a
  zone), `text` (a string; `""` for a media-only post), `url` (the `x.com` or `twitter.com` status address; it
  must carry the same id and the same handle).
- **Optional:** `list` (`tracked`, `bell`, `bell_only` — lower-case, digits, underscore), `photos`, `videos`,
  `links`, `youtube_id`, `original` (the post it quotes, reposts or replies to — a `repost` must carry it).
- **Replies:** send them, marked `"kind": "reply"`. We keep them and hide them from the views, as you do.
- We read the `$TICKERS` out of the text ourselves; you do not need to send them.

### `youtube_chunks` — one scored piece of a video (key: video + start second + ticker + model)

```json
{
  "kind": "youtube_chunks",
  "sent_at": "2026-10-06T13:45:00Z",
  "items": [
    {
      "video_id": "dQw4w9WgXcQ",
      "t_start": 754,
      "t_end": 812,
      "tickers": ["MU", "NVDA"],
      "score": 0.62,
      "model": "finbert-tone-v1",
      "preview": "Micron revenue 54 billion versus 51 estimate",
      "channel_id": "UCvTUPg9PxLq3DO72AZBygNg"
    }
  ]
}
```

- **Required:** `video_id` (the 11 characters), `t_start` (whole seconds from the start), `model` (the name of
  what scored it — when you switch model, change this name and both scores are kept side by side).
- **Optional:** `t_end`, `ticker` (one) **or** `tickers` (up to 20; one row each), `score` (−1 bearish … +1
  bullish, or `null` for "no reading"), `preview` (**at most 200 characters**), `channel_id`.
- **Transcript text: do not send it yet.** Alan has not OK'd storing it. If a `text` field arrives before he
  does, we drop it (from the table and from our log), keep the rest of the item, and answer with a `warnings`
  line saying so. When Alan says yes, add `"text": "…"` (up to 20,000 characters) to the same item — nothing
  else changes.

### `youtube_channel_map` — which X account has which YouTube channel (key: X handle + channel id)

```json
{
  "kind": "youtube_channel_map",
  "sent_at": "2026-10-06T13:45:00Z",
  "items": [
    {
      "x_handle": "WOLF_TradingX",
      "channel_id": "UCvTUPg9PxLq3DO72AZBygNg",
      "channel_title": "WOLF Trading",
      "channel_handle": "WOLFTrading",
      "confidence": "high",
      "evidence": "YouTube link in the X bio"
    }
  ]
}
```

- **Required:** `x_handle`, `channel_id` (the `UC…` id, 24 characters — not the `@name`).
- **Optional:** `channel_title`, `channel_handle`, `confidence` (`high`, `medium` or `low`), `evidence` (how
  you know, up to 500 characters), `seen_at`.
- This is kept as your map. It does not by itself change which channels our YouTube feed follows.

### `x_following` — who Alan follows, per list (key: handle + list)

```json
{
  "kind": "x_following",
  "sent_at": "2026-10-06T13:45:00Z",
  "items": [
    { "handle": "alphatrends", "list": "following", "name": "Brian Shannon" },
    { "handle": "alphatrends", "list": "trading", "seen_at": "2026-10-06T09:00:00-04:00" }
  ]
}
```

- **Required:** `handle`, `list` (`following`, `trading`, `tracked`, `bell`, `bell_only` — lower-case, digits,
  underscore).
- **Optional:** `name`, `seen_at` (when you last saw the account on that list; left out = `sent_at`).
- Send the whole list each time you read it; an account you no longer see simply keeps its old `seen_at`.

### `news_scores` — your score for a news item (key: address + ticker + model)

```json
{
  "kind": "news_scores",
  "sent_at": "2026-10-06T13:45:00Z",
  "items": [
    {
      "url": "https://www.tipranks.com/news/micron-beats-estimates",
      "tickers": ["MU"],
      "score": 0.4,
      "model": "finbert-tone-v1",
      "title": "Micron beats estimates",
      "published_at": "2026-10-06T12:00:00Z"
    }
  ]
}
```

- **Required:** `url` (the article's address), `model`.
- **Optional:** `ticker` or `tickers`, `score` (−1 … +1 or `null`), `title` (up to 300 characters — the
  headline only, not the article), `published_at`, `scored_at` (left out = `sent_at`).

### `heartbeat` — "I am running, nothing new"

```json
{
  "kind": "heartbeat",
  "sent_at": "2026-10-06T13:45:00Z",
  "status": { "ledger_accounts": 129, "last_pass_at": "2026-10-06T13:44:10Z", "note": "quiet hour" }
}
```

- `items` may be left out. `status` is free-form and optional; keep it small and put no secret in it.
- **Every POST of any kind counts as a heartbeat.** Send this one only when an hour has passed with nothing
  else to send. If we hear nothing from you for **2 hours**, our status page marks you LATE.

## 5. Asking us: `GET`

`GET` the same address with the same header. The answer:

```text
{
  "ok": true,
  "kinds": ["x_posts", "youtube_chunks", "youtube_channel_map", "x_following", "news_scores", "heartbeat"],
  "limits": { "max_bytes": 1048576, "max_items": 2000 },
  "transcript_text_stored": false,
  "last_received_per_kind": { "x_posts": "2026-10-06T13:45:01.000Z", "youtube_chunks": null, … },
  "channels_from": ["bridge", "subscription:scintilla"],
  "channels": [
    { "channel_id": "UCvTUPg9PxLq3DO72AZBygNg", "from": ["bridge"],
      "rss": "https://www.youtube.com/feeds/videos.xml?channel_id=UCvTUPg9PxLq3DO72AZBygNg" }
  ]
}
```

- `channels` is the YouTube channel list you asked for: the channels of the X accounts Alan reads (`bridge`)
  plus the channels our Scintilla YouTube account subscribes to. Each has its public RSS address, which lists
  the newest videos without a key.
- `last_received_per_kind` tells you what reached us, so after a break you know where to resume.
- `transcript_text_stored` turns `true` the day Alan allows transcript text.

## 6. Suggested rhythm

- `x_posts`: after each ledger pass (every 15 minutes in market hours, hourly otherwise) — the posts that are
  new or changed since your last accepted POST.
- `youtube_chunks`: as each video is scored.
- `youtube_channel_map`, `x_following`: when they change, and once a day in full.
- `news_scores`: as scored.
- `heartbeat`: hourly when nothing else went out.
