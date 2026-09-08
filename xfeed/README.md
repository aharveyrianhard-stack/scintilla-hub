# X desk data

The X desk is the Social master tab's X panel. Trading uses the exact 126 handles in `data/HANDLES_TRADING.txt`. Notifications remains unconnected until its handle list is supplied. Video shows native X video and YouTube rows, including unresolved native video.

The collection is a chronological record of observed posts. It has no sentiment filter, summary, recurring collection job, or automatic historical/sample seed.

The current first pass queries each handle separately in X's Latest search and retains the first returned page, up to 20 results. It extracts full available `note_tweet` text, quote data, and media from the browser's SearchTimeline response. Selected real post pages were checked against the extracted fields. It does not visit every post detail page or paginate account history. Latest search does not establish repost coverage; a zero repost-row count cannot establish that the accounts made no reposts.

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
| `original` | Quote/repost source, with `id`, `handle`, optional source `url`, optional extracted `created_at`, `text`, and the same media/link fields. Original media is retained for in-desk playback. |
| `provenance` | Source URL, collection route, extraction/collection timestamps, and supplied evidence/limitations. A string becomes a note. |
| `raw` | Supplied raw post object, or the input post when `raw` is absent. Keep only post extraction data here, never cookies, authorization headers, browser session state, or credentials. |

The URL validator rejects unsupported protocols and embedded credentials. It checks source identity, not remote availability. Text is preserved verbatim; the frontend must render it as text, never unsanitized HTML. Normalized timestamps use UTC ISO format; the frontend displays America/New_York.

A repost must identify `original`. If its source permalink identifies the original author, the URL may match `original.handle` and `original.id`. Reposts retain separate ledger keys for each reposting handle. The source must distinguish the repost action time from the original publication time; if action time is unavailable, preserve that uncertainty in provenance and do not claim it was observed. The importer never invents either timestamp.

Normalized ledger rows add `schema_version`, `record_key`, and `ingested_at`. `ingested_at` is an import event time, not a post/collection timestamp. Keys are `post:ID` for original/reply/quote rows and `repost:ACTOR:ID` for repost rows. A reader must take the **last event for each key** before sorting by `created_at`. Corrections can change text, media, kind, or provenance without destroying earlier evidence.

Identical normalized content, raw evidence, and provenance do not append another post. Observation timestamps alone (`collected_at`, `extracted_at`, `observed_at`, `captured_at`, `fetched_at`, `readAt`, `ingested_at`) do not create duplicates. Other changed raw fields or provenance append an amendment. Separate query-attempt evidence records repeated collection attempts.

## Attempt evidence and incomplete first passes

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

Receipt counters:

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
node --test tests/xfeed-ingest.test.mjs
```

Tests use temporary directories only. They check append idempotency/amendments, actual timestamp handling, source identity/URL validation, distinct coverage statuses, latest attempt precedence, and quote/repost media. They create no production ledger or receipt and do not connect to X.
