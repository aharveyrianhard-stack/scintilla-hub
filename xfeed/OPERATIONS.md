# Operating the live X feed

The source is Alan's actual Trading list, `1405188850188759047`, viewed through the existing signed-in Chrome session. The collector reads responses that ordinary list navigation and scrolling already produced. The local intake normalizes public post fields, preserves the ledger, verifies source coverage, and publishes completed passes. It does not request an X API, export cookies, or sign into another profile.

The recurring cadence is **every five minutes**, through the active Codex heartbeat `keep-scintilla-x-feed-current` in this same task, installed September 8, 2026. Starting the intake service alone does not schedule collection. Collection requires this host, Chrome login, the retained task group, the CUA integration, and the intake service to be available. An unavailable source leaves the last good feed visible with an error or stale status. Keep unchanged runs quiet; report a meaningful failure or action the user needs to take.

Five minutes is a requested check cadence, not a guaranteed maximum delivery delay. Each heartbeat consumes Codex execution and model usage, even when no new post appears. Browser recovery, pagination, X quota pauses, publication retries, queued execution, or an unavailable host can delay a run. Compare actual source observation and heartbeat times in the desk; do not describe this browser-assisted path as an always-on server collector or an instantaneous push feed.

## Paths and retained browser workspace

Worktree:

`/Users/alanharvey/SCINTILLA 0.5/_worktrees/hub-xfeed-desk-20260907`

Operational data, outside the repository:

`/Users/alanharvey/SCINTILLA 0.5/_orchestration/xfeed-live/runtime`

Before browser work, read the full [workspace browser protocol](</Users/alanharvey/SCINTILLA 0.5/BROWSER_TAB_GROUP_PROTOCOL.md>) and the applicable `AGENTS.md`.

This is continuation of the established source-collection workspace. Its identity, last verified by the root task on 2026-09-08, is:

| Surface | Required identity |
| --- | --- |
| Chrome profile | `AHR Codex AI Sandbox` |
| Existing agent group | `📰 CODEX · XFEED DESK` |
| Group color | Green, verified visually |
| Source | `https://x.com/i/lists/1405188850188759047`; last known tab ID `351858349` |
| Review | Social → X; last known tab ID `351858332`; preserve its verified current URL; production destination is `https://scintillahub.ai/` |
| Reusable intake | `http://127.0.0.1:8766/`, in this same group |

IDs are recovery hints, not authorization to operate a tab. Start each resumed turn with the supported CUA inventory, then match the profile, exact group, current title, and full URL. Reclaim only this task's exact retained tabs. Read the browser and CDP documentation returned by CUA before using those APIs. After a reconnect, re-establish this same named control session and visually verify the green group and control markers. Do not create a replacement on top of another group.

The former samples intake at `http://127.0.0.1:8765/` may be reused only if it is still the exact intake tab in this owned group; navigate that tab to port 8766. Never repurpose the X source or review tab as intake. If intake is absent, create a new intake tab through the same owned browser session. Do not move, rename, close, or claim any other group's tabs.

## Intake startup and health

The ignored `.env.local` in the worktree contains the publication configuration. Do not print it, copy credentials into a browser, or commit it. From the worktree, start the service in a retained terminal:

```sh
node --env-file=.env.local scripts/xfeed-capture-server.mjs --serve --publish
```

It binds only `127.0.0.1:8766`. Restart this owned service after source/server/publisher code changes so it loads the new code. Do not kill an unrelated listener occupying that port. Initialization of the existing runtime is already complete; `--initialize` is an explicit historical-seed operation, not a recurring step.

Read health from the shell before source work, after saving chunks, and immediately before finishing:

```sh
node --input-type=module -e "const r=await fetch('http://127.0.0.1:8766/health');if(!r.ok)throw Error('Intake unavailable');console.log(JSON.stringify(await r.json(),null,2))"
```

The intake page exposes **Capture JSON** / **Save capture**, and **Pass JSON** / **Finish pass**. Successful submissions show **Capture saved** or **Pass finished**, followed by a **New capture** link. Equivalent JSON endpoints are `POST /capture` and `POST /finish`; they require the same loopback origin or the intake form token. Do not POST directly from an X page.

## Load the trusted browser helper

Read `scripts/xfeed-browser-cycle.js` from the worktree with the shell tool. Paste its complete function definition as ordinary JavaScript into the persistent CUA REPL. Do not import it through browser JavaScript, fetch it from a site, or use Node filesystem APIs inside CUA. The helper only uses the documented, tab-scoped CUA APIs.

After exact inventory matching, obtain the native source and intake handles from the recovered owned `feedBrowser` session. `sourceExact` and `intakeExact` below mean the records selected from that fresh inventory, not a guessed ID:

```js
var xfeedSource = await feedBrowser.tabs.get(sourceExact.id);
var xfeedIntake = await feedBrowser.tabs.get(intakeExact.id);
var xfeedUi = await cua.getTab(sourceExact.id, { browser: feedBrowser.browserId });
```

The separate `xfeedUi` is the supported tab-scoped UI target. Read the CDP capability documentation before first use. Create a new pass for each recurring run:

```js
var xfeedPassId = 'live-' + new Date().toISOString().replace(/[:.]/g, '-');
var xfeedCycle = await createXfeedBrowserCycle({
  source: xfeedSource, intake: xfeedIntake, ui: xfeedUi, passId: xfeedPassId
});
```

Do not reuse a finished pass ID. An interrupted pass is different: reuse its own
pass ID and pass its `resume` record from `/health` `pending_passes`, so the
helper continues from the deepest stored cursor:

```js
var xfeedPending = (await (await fetch('http://127.0.0.1:8766/health')).json())
  .pending_passes.find(p => p.pass_id === xfeedPassId);
var xfeedCycle = await createXfeedBrowserCycle({
  source: xfeedSource, intake: xfeedIntake, ui: xfeedUi, passId: xfeedPassId,
  resume: xfeedPending && xfeedPending.resume
});
```

With a resume record the helper does not reload the list (a reload restarts the
timeline at its newest page) and does not collect or save a page whose request
cursor is already stored. Its summary reports `resumed`, `resume_cursor`, and
`skipped_stored_pages`. Before calling `begin()`, inspect any persisted `collector_retry_at` in runtime `heartbeat.json`. If its actual source reset time is still in the future, do not navigate or query X.

## One recurring pass

1. Save the before-state from intake health: the previous source checkpoint, last completed pass, and source event time. Preserve the last published version and post count from the review panel or public feed metadata. A response captured in this new pass must not become its own baseline.
2. In one CUA call, run `await xfeedCycle.begin()`. It enables network observation, refreshes the exact Trading list, and reads the responses. Read the returned summary.
3. Run `await xfeedCycle.read()` in separate bounded calls while response bodies are pending or new source events are arriving. A body not yet ready stays pending. Never call `older()` with pending bodies. Actual event truncation invalidates continuity: stop that pass and use a fresh pass ID after safely preserving already captured evidence.
4. Run `await xfeedCycle.save(8)` in separate CUA calls until `pending_chunks` is zero. Each call saves at most eight chunks and stops starting new work near its 15-second deadline. Read the summary after every call. Do not combine multiple read/save/paging loops into one long tool invocation. Target less than 20 seconds per tool call.
5. Read `/health` from the shell after saves. The matching pending pass must show all response chunks accounted for. When `previous_frontier_observed` is still false, inspect a current screenshot of the source tab and confirm `[500, 480]` is inside the list column before calling `await xfeedCycle.older()` in its own CUA call. It makes an ordinary tab-scoped scroll and immediately reads source events. Then repeat read/save/health. Recheck the exact group and source after navigation, interruption, focus changes, or reconnect.
6. Before finish, require all of these: helper `pending_chunks === 0`, `pending_bodies === 0`, `blocked === null`; server `response_integrity.missing_chunks` empty; server `response_integrity.cursor_chain_verified === true`; and server `previous_frontier_observed === true`. A timestamp from an old conversation parent alone does not prove that the page sequence reached the frontier.
7. Run `await xfeedCycle.finish('overlap')` separately. A successful pass publishes once. Manifest readback may take up to 90 seconds because the public CDN can retain the previous pointer for 60 seconds. The browser helper's short UI wait can time out while the server continues publishing; a UI timeout is not evidence of publication failure. Read `/health` and the exact pass in runtime `state.json` (`completed_at`, `published`, `publication_error`, and `publication`) before taking another action. Wait for the existing operation to settle; do not blindly resubmit finish or start a competing publisher. If the saved pass has an actual publication error after completion, retry finishing that same pass only after the prior operation has settled. Recovery verifies an already committed identical feed and raw archive prefixes without writing a fresh heartbeat version. Distinguish completed source collection from verified publication.
8. Verify the after-state: the completed pass ID, new source observation time, prior-frontier evidence, public version, and post count. Compare actual new row IDs/counts against the before-state. A source run can validly contain zero new rows; do not invent a post or advance a post timestamp to make it look active.

The helper attaches an observed `response_id`, an explicit `request_cursor` (`null` for the first response), and zero-based `response_chunk_index` with `response_chunk_count`. All chunks from a single response share that identity and count. The service rejects missing or conflicting indexed chunks and audits the returned bottom cursor against the next request cursor. Manually saved legacy chunks without this metadata remain observations and retain an explicit unverified-chain limitation.

An HTTP 200 response with remaining quota zero may still contain valid data. Save its already captured chunks and finish only if the full overlap proof is present; the helper separately sets `rate_exhausted` so it cannot request another page. An actual non-200 source response sets `blocked` and cannot finish successfully.

## Failure and quota handling

On actual HTTP 429, remaining quota zero, login loss, missing owned source workspace, or lost source events, preserve the observed failure and pause source requests. Use the actual `x-rate-limit-reset` Unix seconds, or actual `Retry-After` response value with its observation time, to establish the retry time. If the source provides no usable reset, leave retry time unavailable; do not guess quota or switch profiles/accounts to evade it.

The status command changes only collector error state over the **last successfully published feed**. It preserves that feed's posts, Notifications subset, source clocks, and archive pointers, even if the runtime contains an unfinished newer pass. From the worktree:

```sh
node --env-file=.env.local scripts/xfeed-collector-status.mjs --error 'X returned HTTP 429' --retry-at '<ACTUAL_ISO_RESET_TIME>'
```

Replace the placeholder with the observed ISO reset instant. Omit `--retry-at` when unavailable. Use a concise factual error description, never headers, cookies, credentials, or a page dump. The command saves local error status first; if publication fails, that error remains saved. It has no option to declare the collector healthy. Only a successful source pass can establish collection health again.

Keep existing append-only ledger/capture evidence and the last good public feed. Do not relabel an incomplete pass as a successful individual-handle query. Notifications is configured only from a full exact 126-member audit with actual boolean notification flags; missing flags remain unknown. The historical interval between the original search seed and the first list window remains explicitly unverified unless a later separately proven catch-up closes it. Four nested original levels are retained in the display contract; deeper/unavailable originals remain explicit source limitations.

## End of every recurring turn

Use `markHandoff()` on every retained controlled tab in this exact group, then verify the final profile, green group name, tab titles, and full URLs. Handoff marks are renewed each turn. Never use `markDeliverable()` for this continuing collector. Leave other user and agent groups untouched. Keep only the source, reusable intake, and single review tab required for this run; do not accumulate source or diagnostic duplicates.

Report completed, failed, or blocked units through the workspace Hermes reporter. Record a one-line result and the operational receipt path, not long logs or credentials. The recurring automation should continue in this task, preserve these workspace rules, remain quiet for unchanged non-actionable results, and notify the user only on meaningful failure or required action.
