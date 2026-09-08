# X desk: source, publication, and data contract

The X desk is scintillahub.ai → Social → X. Trading uses the exact 126 handles in `data/HANDLES_TRADING.txt`. Notifications filters the same retained feed to the Trading members whose native X notification flag is enabled. On September 8, 2026, seven observed `ListMembers` pages verified all 126 members against that file: 18 enabled, 108 disabled, and zero unknown. The configuration carries its actual verification time; it is not inferred from post frequency. Video shows native X video and YouTube rows, including unresolved native video items.

The collection retains observed originals, replies, quotes, and reposts in chronological order, with available source text, media, links, and nested originals. It applies no sentiment filter or summary and never inserts demo posts or automatically seeds unrelated historical datasets.

## Live source and scope

The authenticated personal X account exposes the native [Trading list](https://x.com/i/lists/1405188850188759047), ID `1405188850188759047`. The collector observes the browser's `ListLatestTweetsTimeline` responses while navigating and scrolling that list. These responses include repost actions, available `note_tweet` text, quote/repost structure, and media. Membership and notification flags come from observed `ListMembers` responses. The source is the existing signed-in Chrome session; no separate Python search service or official X API integration has been established.

`scripts/xfeed-browser-cycle.js` is a helper for the Codex CUA JavaScript session. It reads responses delivered to the exact controlled source tab, retains response identity, request cursor, and chunk count, and submits content through the loopback intake page. It does not independently call X endpoints. Each cycle starts at the list's newest window and pages toward the saved frontier. A continuous interval is claimed only when complete response chunks, linked cursors, and the prior frontier are verified. Blocked or rate-limited observations remain incomplete; obtained records are retained while collection waits for the actual reset.

The initial live list pass retained 123 list-source rows, producing 2,622 current rows together with the earlier 2,500-row search snapshot. Its 35 saved response/chunks were not 35 verified network pages. That bootstrap pass left the interval from the earlier search snapshot to the initial list window open and did not verify a continuous cursor chain. Later receipts state each pass's actual evidence; reaching a recent frontier does not retroactively close an earlier historical gap. Unavailable originals and media stay explicit. No pass establishes complete account history or separate permalink checks for every row.

The earlier search snapshot queried each of the 126 handles separately in Latest search and retained only its first returned page, up to 20 results. It extracted available full text and media from `SearchTimeline`, with selected real post pages checked. It did not visit every detail page or establish repost coverage. Those attempts remain historical evidence and are not relabeled as current list coverage. The exact handoff and implementation differences are recorded in [HANDOFF-REVIEW.md](</Users/alanharvey/SCINTILLA 0.5/_orchestration/xfeed-live/HANDOFF-REVIEW.md>).

## Update path and operating requirements

The exact retained Chrome group, collector cycle, retry procedure, and runtime checks are documented in [OPERATIONS.md](OPERATIONS.md).

The implemented path is:

1. Codex observes the signed-in Chrome Trading list through CUA.
2. The local capture service at `http://127.0.0.1:8766/` validates and imports saved response chunks into the operational append-only ledger.
3. A completed source pass writes a separate source receipt and actual collector heartbeat. A service started with `--publish` then publishes one complete current feed.
4. Vercel Blob stores an immutable compact feed JSON and separate immutable raw-ledger archive chunks. After the feed's public bytes and CORS are verified, publication replaces the small current manifest.
5. `/api/xfeed` reads the fixed store manifest and redirects to its verified immutable feed URL. The desk polls every 30 seconds and retains its prior tape if an update fails. A failed initial live load is shown explicitly when using the static snapshot fallback.

The active Codex task heartbeat `keep-scintilla-x-feed-current` is installed with a five-minute attempt cadence. This schedule is not a delivery-time guarantee: a cycle may need pagination, source retry/reset waits, or recovery. The browser helper and capture service do not schedule themselves. Collection requires the local Mac, Codex, Chrome, and the signed-in X session to remain available; it is not an independent cloud collector. Sleep, logout, app shutdown, or source access failure can interrupt it. The desk marks the published collector heartbeat stale after 600 seconds, independently of the newest post's age. A quiet Trading list is distinct from a stale collector.

Operational files live outside the deployable repository:

```text
/Users/alanharvey/SCINTILLA 0.5/_orchestration/xfeed-live/runtime/
  captures/                 saved transformed browser responses and raw post fields
  state.json                pass records, publication result, and source frontier
  heartbeat.json            actual collector state and heartbeat timestamp
  membership-progress.json  latest observed membership verification progress
  data/
    HANDLES_TRADING.txt      exact configured population
    ledger.jsonl            append-only post events, including raw/provenance
    query-attempts.jsonl    retained historical search-attempt evidence
    receipt.json            ledger counts and historical attempt receipt
    source-receipt.json     current list pass, cursor evidence, and open gaps
    notifications.json     last fully verified notification-enabled subset
```

Only one capture service/publisher should own that runtime. The service serializes writes; `.ingest.lock` and `.publish.lock` guard their operations. Do not start a second service while the existing process is listening on port 8766. With the provisioned Blob credentials available in the ignored `.env.local`, the explicit service command from the repository root is:

```sh
node --env-file=.env.local scripts/xfeed-capture-server.mjs \
  --serve --publish \
  --runtime-dir '/Users/alanharvey/SCINTILLA 0.5/_orchestration/xfeed-live/runtime'
```

This starts the loopback intake and publication hook, not browser collection or its schedule. Credentials remain server-side and outside Git. The capture form uses a local request token. Captures must never include cookies, authorization headers, or browser session credentials.

## Durable publication and endpoint

`scripts/xfeed-publish.mjs` uses `@vercel/blob` server-side. The dedicated public store is `scintilla-xfeed-live`, with origin `https://qmukdur29avitsgx.public.blob.vercel-storage.com`. The API requires `XFEED_BLOB_BASE_URL` set to that exact origin. Its [current manifest](https://qmukdur29avitsgx.public.blob.vercel-storage.com/xfeed/current.json) points to the latest complete publication; data updates need no code deployment.

The public payload is `{posts, receipt, notifications, version}`. `posts` contains every current retained row, with full normalized text/media and originals through four nested levels, but omits bulky raw/provenance fields. The version is a stable content hash. Raw ledger and attempt bytes remain local and are archived as immutable appended chunks with chained indexes and hashes. Published prefixes cannot be rewritten. The immutable compact feed is uploaded first; public JSON type, full bytes, and CORS for scintillahub.ai are checked before committing `xfeed/current.json`. Transient public-read failures receive at most six attempts within a 30-second budget; access, CORS, or content-integrity failures are not treated as propagation delays. A failure before the manifest commit leaves that pointer untouched. An uncertain post-commit readback can mean the write succeeded; inspect metadata and content rather than blindly repeating the write. The current manifest has a 60-second cache lifetime, while immutable artifacts have a one-year lifetime. Replacement uses a strong metadata ETag matched against the just-read body ETag, so competing changes cannot silently be overwritten. Post-commit readback uses a trusted metadata-derived cache key and bounded reads, requiring the committed strong ETag and exact manifest bytes; it never retries the write. Unchanged content produces no replacement writes.

`/api/xfeed` accepts no user-selected source URL. It validates the configured public Blob origin and manifest feed path, then returns a `307` redirect with `no-store` cache headers. Redirecting avoids the Function response-size limit as the tape grows. Missing configuration or an invalid/unavailable manifest returns an explicit `503`, with collector state `unconfigured` or `error`.

Use publisher flags `--data-dir`, `--status-file`, and `--notifications-file` to select operational inputs. `--dry-run --output /absolute/path/feed.json` validates and builds a local preview without uploading. A standalone publication must not run concurrently with the service's publication hook:

```sh
node --env-file=.env.local scripts/xfeed-publish.mjs \
  --data-dir '/Users/alanharvey/SCINTILLA 0.5/_orchestration/xfeed-live/runtime/data' \
  --status-file '/Users/alanharvey/SCINTILLA 0.5/_orchestration/xfeed-live/runtime/heartbeat.json' \
  --notifications-file '/Users/alanharvey/SCINTILLA 0.5/_orchestration/xfeed-live/runtime/data/notifications.json'
```

Collector status is `running`, `idle`, `error`, or `unconfigured`. Configured status requires an actual heartbeat and positive `stale_after_seconds`. In a live receipt, `collected_at` comes from the source's actual `observed_at`; `collector_heartbeat_at` comes from the separate heartbeat; `latest_source_event_at` is the newest observed post publication time. None is replaced by import/publication time. `collector_retry_at`, when present, is the actual source retry/reset time. `publishLastGoodStatus({statusFile, dataDir})` publishes only collector-state changes over the previously published feed, retaining its posts, source evidence, Notifications, and archive pointers. It never reads an active partial pass's ledger or receipt.

The old search receipt is retained under `historical_search_coverage`, with `handle_attempts_scope: historical_search_attempts`. `source_receipt` preserves list scope, response/chunk integrity, cursor continuity, source times, unresolved fields, and historical gaps. The desk displays this evidence separately from historical per-handle attempts. An absent/incomplete Notifications configuration stays visibly unconfigured. Only complete membership matching the exact Trading roster, with explicit notification flags, can replace the verified subset. Notifications is a handle filter over retained posts; the flag does not imply that every row caused an X notification event.

## Offline import

`scripts/xfeed-ingest.mjs` imports saved browser extraction JSON. It does not access X, make API requests, fetch media, or start a browser. Run from the repository root after saving an actual extraction:

```sh
node scripts/xfeed-ingest.mjs --input /absolute/path/to/browser-extraction.json
```

Optional `--data-dir` and `--handles` select different output and population files. The default output is this repository's `xfeed/data`, independent of the shell's working directory.

The input is an object with required `posts` and `attempts` arrays. Either may be empty. Optional envelope fields are `collected_at` (actual ISO collection time), `source` (description of the collection route), and `scope` (default scope for its attempts). The importer validates the entire input before writing data. It never fills missing post timestamps from IDs, import time, other posts, or old datasets.

Outputs after an explicitly requested import:

- `data/ledger.jsonl`: append-only post events. Amendments append another event; old lines remain intact.
- `data/query-attempts.jsonl`: append-only per-handle attempt evidence. An identical attempt is not written twice.
- `data/receipt.json`: regenerated receipt from the latest post versions and actual attempts.

Only one writer may import at a time. An exclusive `.ingest.lock` prevents concurrent imports. A crashed process can leave this lock; inspect the process before removing a stale lock. No command in this document removes it automatically.

## Post contract

Each input post must have:

| Field | Meaning |
| --- | --- |
| `id` | Actual decimal post ID as a string. Numbers are rejected because X IDs exceed JavaScript's exact integer range. |
| `handle` | Extracted actor/author from the configured population, without `@`. |
| `created_at` | Extracted ISO timestamp with date, time, and `Z` or an explicit UTC offset. `at` is accepted as an input alias. |
| `kind` | Explicit `original`, `reply`, `quote`, or `repost`. Video is media, not a post kind. |
| `text` | Extracted text, including an empty string for a media-only post. No generated or reconstructed text. |
| `url` | Actual HTTPS X/Twitter post URL with matching ID and author. An `i/web/status/ID` source URL is accepted. |

Optional fields are normalized consistently:

| Field | Output |
| --- | --- |
| `photos` | Array of HTTPS photo URL strings. Input photo objects may provide `url`; their other source fields remain in `raw`. `img` is an input alias for one photo. |
| `videos` | Every native video item in source order as `{url, poster, alt}`. `url` is the extracted HTTPS file/stream URL or `null` for a known unresolved item; `poster` is an extracted HTTPS image URL or `null`; `alt` is extracted text or an empty string. Preserve all items, including unresolved ones. |
| `video_url` | Compatibility alias to the first resolved native file, or a legacy extracted HTTPS MP4/stream URL. `file` is an input alias. If no `videos` array is supplied, a legacy file becomes one native video item. A URL is not proof of successful playback. |
| `has_video` | Boolean. True for a video marker, native URL, YouTube ID, or original-post video. A marker with no usable URL remains unresolved. |
| `youtube_id` | Actual 11-character ID or `null`; may be read from an extracted YouTube link. |
| `links` | Array of `{url, title}`. URLs use HTTP(S), titles are source titles only. No article bodies are collected by this utility. |
| `original` | Quote/repost source, with `id`, `handle`, `kind`, optional source `url`, optional extracted `created_at`, `text`, the same media/link fields, and optional nested `original`. Up to four original levels are retained. Unavailable nested source content remains unresolved. |
| `provenance` | Source URL, collection route, extraction/collection timestamps, and supplied evidence/limitations. A string becomes a note. |
| `raw` | Supplied raw post object, or the input post when `raw` is absent. Keep only post extraction data here, never cookies, authorization headers, browser session state, or credentials. |

The URL validator rejects unsupported protocols and embedded credentials. It checks source identity, not remote availability. Text is preserved verbatim; the frontend must render it as text, never unsanitized HTML. Normalized timestamps use UTC ISO format; the frontend displays America/New_York.

A repost must identify `original`. If its source permalink identifies the original author, the URL may match `original.handle` and `original.id`. Reposts retain separate ledger keys for each reposting handle. The source must distinguish the repost action time from the original publication time; if action time is unavailable, preserve that uncertainty in provenance and do not claim it was observed. The importer never invents either timestamp.

Normalized ledger rows add `schema_version`, `record_key`, and `ingested_at`. `ingested_at` is an import event time, not a post/collection timestamp. Keys are `post:ID` for original/reply/quote rows and `repost:ACTOR:ID` for repost rows. A reader must take the **last event for each key** before sorting by `created_at`. Corrections can change text, media, kind, or provenance without destroying earlier evidence.

Identical normalized content, raw evidence, and provenance do not append another post. Observation timestamps alone (`collected_at`, `extracted_at`, `observed_at`, `captured_at`, `fetched_at`, `readAt`, `ingested_at`) do not create duplicates. Other changed raw fields or provenance append an amendment. Separate query-attempt evidence records repeated collection attempts.

## Historical search-attempt evidence and incomplete passes

Each attempt contains:

- `handle`: one configured handle.
- `status`: `success`/`successful`, `no_results`, `blocked`, or `failed`. `success` normalizes to `successful`.
- `attempted_at`: actual timezone-bearing ISO timestamp; actual envelope `collected_at` is accepted as the batch timestamp fallback.
- `query_url`: optional actual X search/profile URL.
- `scope`: explicit observation boundary, for example `latest_page_per_handle` or `latest_page_of_6_handle_batch`.
- `observed_posts`: optional nonnegative count of rows observed for this handle in that attempt.
- `queried`: whether a query actually ran. Defaults true for successful/no-results and false for blocked/failed; set true for an actual query that subsequently failed.
- `reason`: source limitation/error or explanatory note.
- `full_post_extraction_complete`: defaults false. This legacy field name certifies that available post fields in the returned records were extracted within `scope`; it does not certify visits to every permalink, playback of every media file, or complete account history. Set true only with collection evidence; a failed/blocked attempt cannot claim it.
- `raw`: optional attempt evidence; otherwise the input attempt is retained.

A successful batch page returning no rows for one member means **no rows observed in that returned batch page**. Keep its status successful, `observed_posts: 0`, and the batch scope/reason. It does not establish no posts from that account. Use `no_results` only when the actual query result explicitly supports that claim, within its stated scope.

The latest `attempted_at` determines each handle's current status, regardless of import order. Thus a later individual-handle query supersedes an earlier batch observation. Equal-time attempts use the last appended attempt. Older evidence remains in the attempt ledger.

These counters describe the historical search-attempt receipt. Live publication preserves its coverage under `historical_search_coverage` and uses the separate list source receipt for current collection scope:

- `handles_attempted` counts handles with any attempt; `handles_queried` counts handles with evidence that a query ran.
- `handles_successful`, `handles_no_results`, `handles_blocked`, `handles_failed`, and `handles_unattempted` are distinct current statuses. Missing coverage never becomes zero activity.
- `query_pass_complete` means every latest handle attempt succeeded or explicitly returned no results. It does not certify complete history or complete detail extraction.
- `first_pass_complete` and `status: complete` additionally require every latest handle attempt to explicitly assert `full_post_extraction_complete`. They remain incomplete by default and refer to the recorded collection scope. For this run, complete means the first Latest search page was processed for each handle, not that every post or repost was collected or independently checked.
- For `latest_page_per_handle`, `completion_scope`, `source_completeness`, and `collection_method` state the one-page/20-result boundary, SearchTimeline text source, selected detail-page checks, and unestablished history/repost coverage. The frontend displays `source_completeness` instead of interpreting the legacy completion flag as exhaustive verification. `limitations` contains these actual collection boundaries.
- `collection_scopes` and `handles[]` preserve the per-handle boundary, attempt time, observed row count, and reason.
- `collection_started_at` and `collected_at` are the earliest and latest actual timestamps among the retained per-handle attempts. They describe that pass's source-attempt bounds, not post publication times, superseded attempts, or receipt generation time. Both remain `null` unless every configured handle has a retained attempt with a valid source timestamp. `collection_time_basis: retained_per_handle_attempts` identifies complete time evidence; it does not change failed/blocked coverage statuses. `generated_at` is only the receipt-generation clock and is never substituted for a missing collection time.
- `posts_kept` counts latest row identities, while `ledger_events` includes amendments.
- `videos_resolved` counts native-video rows with at least one extracted native URL, including original media. `videos_still_missing` counts rows with **any** unresolved known native video item. A row with four videos, three resolved and one unresolved, counts once in each counter. A video marker without native items/URLs remains missing unless it only identifies YouTube/original resolved media. YouTube-only rows do not count as missing native video. These are row counts, not file counts, and neither counter verifies playback. `youtube_ids` counts rows with a YouTube ID, and `outbound_links` counts distinct link URLs per row, including original links.

A latest search page for all 126 handles is a bounded pass. Full `note_tweet` text is retained when provided by SearchTimeline; search omissions and unavailable original posts still remain possible. Record actual truncation, unavailable originals, unresolved media, and access/rate failures in provenance and attempt reasons. Preserve obtained posts while further queries wait for an actual rate-limit reset; do not use another account/profile or bypass controls to evade the limit.

## Verification

```sh
npm run test:xfeed
```

Tests use temporary data and mocked remote services. They cover append idempotency/amendments, actual timestamps, source identity, distinct coverage statuses, nested media, response/cursor evidence, Notifications membership, safe rendering, complete publication, conditional manifest writes, public CORS checks, and status-only preservation of the last-good feed. They create no production ledger or receipt and do not connect to X or publish real Blob artifacts.
