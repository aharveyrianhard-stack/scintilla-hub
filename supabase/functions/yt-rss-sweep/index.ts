// SCINTILLA · yt-rss-sweep v2 — dual-identity subscription collector.
// Personal and SCINTILLA subscriptions are authorized independently, then
// polled through free channel RSS. One video row can belong to both accounts.
// v8 (Y2, 5 Oct): the BRIDGE. Alan: "bridge the gap: subscribe to all of those, have the feed. Wolf Trading is live
// right now … I don't see it on our YouTube feed." The channels of the X accounts he reads (app_config
// yt_bridge_channels, built by scripts/yt-bridge-resolve.mjs) ride with the SCINTILLA account's own channels —
// nobody has to subscribe. Every 20 minutes each bridged channel's /live address is read (free, no quota) and a
// stream found on air enters the feed at once instead of waiting for YouTube's RSS. A stored row that says "live"
// is re-asked about however old it is, so a stream that ended days ago stops saying LIVE.
// v9 (Y2b, 5 Oct evening): the first v8 pass from this data centre read 29 channels, found nobody on air and could
// not read one, while WOLF Trading was on air in a browser — and the three counts it stored could not say which
// channel or what came back. The check (onAirPass / checkOnAir, _shared/yt-bridge.mjs) now reads scoped markers, asks the
// channel's Live tab when the /live read could not be read, and stores one line per channel. Two read-only doors,
// neither touching a table or the YouTube API:  ?probe=live&channel=UC…[&video=…]  what each way of asking looks
// like from here;  ?dry=live[&also=UC…][&ways=both]  the whole on-air pass, reported, nothing written.
// v10 (Y4, 6 Oct): "Tyler Wilson … is on a live video. The live video is not on my grid at all … Verified Investing
// slips through the cracks … it depended on when the video was scheduled or released … Everything subscribed."
// (the Y4 rules at the end of _shared/yt-bridge.mjs)  1. the on-air check asks every carried channel that streams, not only the bridged
// ones, and the rest in turn;  2. a scheduled stream is re-asked about by its START time, whatever its publish
// date;  3. a stream YouTube calls live without a start time takes the first moment we saw it live;  4. a
// subscribed video is never dropped for its language tag or its title's script.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore  plain ESM shared with the resolver and the Node tests
// @ts-ignore  plain ESM shared with the resolver and the Node tests
import { bridgeChannelIds, withBridge, onAirPass, onAirLine, probeLive, isChannelId, isVideoId, liveProbeDue, liveProbePick, liveCandidateRow, LIVE_EVERY_MIN,
  onAirPlan, watchableStart, refreshOrder, keepSubscribed, STREAMER_DAYS, UPCOMING_BACK_DAYS, UPCOMING_MAX } from "../_shared/yt-bridge.mjs";

const SB_URL = Deno.env.get("SUPABASE_URL") || "";

function adminKey() {
  const current = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (current) {
    try {
      const keys = JSON.parse(current);
      if (typeof keys.default === "string" && keys.default) return keys.default;
      const first = Object.values(keys).find((v) => typeof v === "string" && v);
      if (typeof first === "string") return first;
    } catch (_) {}
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

const SB_KEY = adminKey();
/* Every channel feed is one account key here, in the video shell's FEED_PROFILES and in the
   deck's VIDEO_FEEDS. An account with no refresh token and no project-side channel cache simply
   contributes no channels this pass and is reported as "not connected" — it never fails the sweep. */
const ACCOUNTS = ["personal", "scintilla", "soundscapes", "golf", "ai_research", "fitness"] as const;
type Account = typeof ACCOUNTS[number];
const iso2sec = (d: string) => {
  const m = (d || "").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
};
/* YouTube dates a stream from when it was SCHEDULED. The only honest "when did
   this happen" is liveStreamingDetails.actualStartTime, so every pass that asks
   about a video asks for it too, and stores the three times unchanged. A live
   or upcoming stream has no length yet: 0 seconds is stored as no length at all
   rather than as a zero. */
const LIVE_PART = "contentDetails,snippet,liveStreamingDetails";
function liveFields(item: Record<string, any>, now: number) {
  const live = item?.liveStreamingDetails || {};
  const secs = iso2sec(item?.contentDetails?.duration);
  return {
    duration_sec: secs > 0 ? secs : null,
    live_broadcast: String(item?.snippet?.liveBroadcastContent || "none"),
    live_started_at: live.actualStartTime || null,
    live_ended_at: live.actualEndTime || null,
    live_scheduled_at: live.scheduledStartTime || null,
    live_checked_ts: now,
  };
}
/* How far back a stream is still worth re-asking about, and how many rows one
   pass will re-ask about. Both bound the API cost of the second pass. */
const REFRESH_DAYS = 3;
const REFRESH_MAX = 200;

const FOREIGN = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;
const unesc = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

async function apiKeyRequest(path: string, key: string) {
  const r = await fetch("https://www.googleapis.com/youtube/v3/" + path + "&key=" + key);
  const text = await r.text();
  try {
    return { status: r.status, body: JSON.parse(text) };
  } catch (_) {
    return { status: r.status, body: null };
  }
}

async function oauthRequest(path: string, token: string) {
  const r = await fetch("https://www.googleapis.com/youtube/v3/" + path, {
    headers: { Authorization: "Bearer " + token },
  });
  const text = await r.text();
  try {
    return { status: r.status, body: JSON.parse(text) };
  } catch (_) {
    return { status: r.status, body: null };
  }
}

async function accessToken(clientId: string, clientSecret: string, refreshToken: string) {
  if (!clientId || !clientSecret || !refreshToken) return { error: "not connected" };
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const body = await r.json();
  if (!r.ok || !body.access_token) return { error: body.error || "token refresh failed" };
  return { token: body.access_token as string };
}

async function isShort(videoId: string) {
  try {
    const r = await fetch("https://www.youtube.com/shorts/" + videoId, {
      method: "HEAD",
      redirect: "manual",
    });
    return r.status >= 200 && r.status < 300;
  } catch (_) {
    return false;
  }
}

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

Deno.serve(async (req?: Request) => {
  if (!SB_URL || !SB_KEY) {
    return new Response(JSON.stringify({ error: "backend credentials unavailable" }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  let ask = new URLSearchParams();
  try { ask = new URL(req!.url).searchParams; } catch (_) {}
  /* ---- READ-ONLY DOOR 1: what YouTube answers this data centre for one channel. No table, no API, no key. ---- */
  if (ask.get("probe") === "live") {
    const channel = ask.get("channel") || "", video = ask.get("video") || "";
    if (!isChannelId(channel)) return json({ error: "channel must be a YouTube channel id (UC…)" });
    return json({ probe: "live", wrote: "nothing", ...(await probeLive(channel, isVideoId(video) ? video : null)) });
  }
  const sb = createClient(SB_URL, SB_KEY);
  const now = Math.floor(Date.now() / 1000);
  /* ---- READ-ONLY DOOR 2: the whole on-air pass, reported and not stored. One read of the bridge row; no write,
     no API call, no lock taken, the 20-minute clock and the cursor left as they are. ---- */
  if (ask.get("dry") === "live") {
    const { data } = await sb.from("app_config").select("key,value").in("key", ["yt_bridge_channels"]);
    let ids: string[] = [];
    try { ids = bridgeChannelIds(JSON.parse((data || [])[0]?.value || "null")); } catch (_) {}
    const also = (ask.get("also") || "").split(",").filter(isChannelId).filter((id) => !ids.includes(id)).slice(0, 5);
    const lines: Record<string, any>[] = await onAirPass([...ids, ...also], fetch, { both: ask.get("ways") === "both" });
    return json({ dry: "live", wrote: "nothing", at: new Date().toISOString(), bridged: ids.length, probe_only: also,
      checked: lines.length,
      on_air: lines.filter((l) => l.live).map((l) => ({ id: l.id, video: l.video, title: l.live.title, channel: l.live.channel_title, marker: l.marker, way: l.way, bridged: ids.includes(l.id) })),
      upcoming: lines.filter((l) => l.state === "upcoming").map((l) => l.id),
      could_not_read: lines.filter((l) => l.state === "unknown").map((l) => l.id),
      channels: lines.map(onAirLine) });
  }
  const configKeys = [
    "YT_API_KEY",
    "YT_OAUTH_CLIENT_ID",
    "YT_OAUTH_CLIENT_SECRET",
    ...ACCOUNTS.map((account) => "YT_REFRESH_TOKEN_" + account.toUpperCase()),
    ...ACCOUNTS.map((account) => "yt_sub_channels_" + account),
    "yt_sub_channels",
    "yt_rss_running",
    "yt_bridge_channels",
    "yt_bridge_live",
  ];
  const { data: cfg } = await sb.from("app_config").select("key,value").in("key", configKeys);
  const c: Record<string, string> = {};
  for (const row of cfg || []) c[row.key] = row.value;
  const apiKey = (c.YT_API_KEY || "").trim();
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "missing YouTube API key" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const running = JSON.parse(c.yt_rss_running || "{}");
    if (running.ts && now - running.ts < 180) {
      return new Response(JSON.stringify({ skipped: "busy" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (_) {}
  await sb.from("app_config").upsert({ key: "yt_rss_running", value: JSON.stringify({ ts: now }) });

  const accountChannels = Object.fromEntries(ACCOUNTS.map((account) => [account, [] as string[]])) as Record<Account, string[]>;
  const accountErrors: Partial<Record<Account, string>> = {};

  for (const account of ACCOUNTS) {
    const suffix = account.toUpperCase();
    const cacheKey = "yt_sub_channels_" + account;
    // The old unsuffixed cache is known to be the SCINTILLA identity. Keeping
    // it as a fallback prevents feed loss while the new OAuth pair is connected.
    const cacheRaw = c[cacheKey] || (account === "scintilla" ? c.yt_sub_channels : "") || "{}";
    let channels: string[] = [];
    let cacheTs = 0;
    try {
      const cached = JSON.parse(cacheRaw);
      channels = Array.isArray(cached.ids) ? cached.ids : [];
      cacheTs = +cached.ts || 0;
    } catch (_) {}

    if (!channels.length || now - cacheTs > 3600) {
      const auth = await accessToken(
        c.YT_OAUTH_CLIENT_ID || "",
        c.YT_OAUTH_CLIENT_SECRET || "",
        c["YT_REFRESH_TOKEN_" + suffix] || "",
      );
      if (!auth.token) {
        accountErrors[account] = auth.error || "not connected";
      } else {
        const fresh: string[] = [];
        let pageToken = "";
        for (let page = 0; page < 10; page++) {
          const r = await oauthRequest(
            "subscriptions?part=snippet&mine=true&maxResults=50" +
              (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : ""),
            auth.token,
          );
          if (r.status !== 200 || !r.body) {
            accountErrors[account] = r.body?.error?.message || ("status " + r.status);
            break;
          }
          for (const item of r.body.items || []) {
            const id = item.snippet?.resourceId?.channelId;
            if (id) fresh.push(id);
          }
          pageToken = r.body.nextPageToken || "";
          if (!pageToken) break;
        }
        if (fresh.length || !accountErrors[account]) {
          channels = [...new Set(fresh)];
          await sb.from("app_config").upsert({
            key: cacheKey,
            value: JSON.stringify({ ids: channels, ts: now }),
          });
        }
      }
    }
    accountChannels[account] = channels;
  }

  /* ---- THE BRIDGE: the X accounts' channels ride with our own list ----
     Added to this pass only — the SCINTILLA account's own cache (yt_sub_channels_scintilla) is never written
     with them, so removing the yt_bridge_channels row takes them out again on the next pass. */
  let bridgeIds: string[] = [];
  try { bridgeIds = bridgeChannelIds(JSON.parse(c.yt_bridge_channels || "null")); } catch (_) {}
  const ownScintilla = accountChannels.scintilla.length;
  accountChannels.scintilla = withBridge(accountChannels.scintilla, bridgeIds);
  const bridgeAdded = accountChannels.scintilla.length - ownScintilla;

  type Candidate = Record<string, unknown> & { video_id: string; accounts: Set<Account> };
  const candidates = new Map<string, Candidate>();
  /* Y1 (2 Oct): YouTube's channel RSS answers 404 / 500 for a share of channels at a time (measured: a pass that
     normally sees ~2,360 entries saw 0–255 from 01:05Z). One retry after a short pause, and the channels still
     failing are COUNTED in the result (rss_failed) instead of vanishing silently. */
  let rssFailed = 0;
  const rssFetch = async (url: string) => {
    let r = await fetch(url).catch(() => null);
    if (!r || !r.ok) { await new Promise((ok) => setTimeout(ok, 700)); r = await fetch(url).catch(() => null); }
    return r;
  };
  await Promise.all(ACCOUNTS.flatMap((account) => accountChannels[account].map(async (channelId) => {
    try {
      const r = await rssFetch("https://www.youtube.com/feeds/videos.xml?channel_id=" + channelId);
      if (!r || !r.ok) { rssFailed++; return; }
      const xml = await r.text();
      const author = unesc((xml.match(/<name>([^<]*)/) || [])[1] || "");
      for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
        const entry = match[1];
        const videoId = (entry.match(/<yt:videoId>([^<]+)/) || [])[1];
        if (!videoId) continue;
        const title = unesc((entry.match(/<title>([^<]*)/) || [])[1] || "");
        const published = (entry.match(/<published>([^<]+)/) || [])[1] || null;
        const thumbnail = (entry.match(/<media:thumbnail url="([^"]+)"/) || [])[1] || null;
        const description = unesc(
          (entry.match(/<media:description>([\s\S]{0,500}?)<\/media:description>/) || [])[1] || "",
        ).slice(0, 500);
        const current = candidates.get(videoId);
        if (current) {
          current.accounts.add(account);
        } else {
          candidates.set(videoId, {
            video_id: videoId,
            channel_id: channelId,
            channel_title: author,
            title,
            description,
            thumbnail,
            url: "https://www.youtube.com/watch?v=" + videoId,
            published_at: published,
            source: "subscription",
            ticker: null,
            updated_ts: now,
            accounts: new Set([account]),
          });
        }
      }
    } catch (_) {}
  })));

  /* ---- ON AIR NOW, WITHOUT WAITING FOR RSS ----
     youtube.com/channel/<id>/live lands on the stream when the channel is on air and on the channel page when it
     is not. Free (no quota), bounded (MAX_LIVE_PROBES a pass, a rotating cursor), every LIVE_EVERY_MIN minutes.
     A stream found here goes down the same path as a new RSS entry, so the YouTube API — not the page — is what
     finally says "live" and gives the real start time. A page we could not read is counted as unknown, and the
     channel's Live tab is asked instead (Y2b); only when neither can be read does the channel stay unknown. */
  let liveState: Record<string, any> = {};
  try { liveState = JSON.parse(c.yt_bridge_live || "{}") || {}; } catch (_) {}
  const liveProbe: Record<string, any> = { ran: false, checked: 0, on_air: [] as string[], unknown: 0 };
  const forceRefresh: string[] = [];
  /* Y4: which accounts carry a channel — a stream found on air is filed under the accounts that carry its channel */
  const channelAccounts = new Map<string, Set<Account>>();
  for (const account of ACCOUNTS) for (const id of accountChannels[account]) {
    if (!channelAccounts.has(id)) channelAccounts.set(id, new Set<Account>());
    channelAccounts.get(id)!.add(account);
  }
  if (channelAccounts.size && liveProbeDue(now * 1000, +liveState.last_ms || 0, LIVE_EVERY_MIN)) {
    /* the carried channels that have streamed lately are asked EVERY check; the others take turns */
    let streamers: string[] = [];
    try {
      const { data: streamRows } = await sb.from("youtube_videos").select("channel_id")
        .gte("live_started_at", new Date((now - STREAMER_DAYS * 86400) * 1000).toISOString()).limit(3000);
      streamers = [...new Set((streamRows || []).map((row: Record<string, any>) => row.channel_id as string))];
    } catch (_) {}
    const plan = onAirPlan({ bridgeIds, carried: [...channelAccounts.keys()], streamers, cursor: liveState.turn_cursor });
    const pick: string[] = plan.pick, cursor = liveProbePick(bridgeIds, liveState.cursor).cursor;
    liveProbe.ran = true;
    liveProbe.asked = { always: plan.always, in_turn: plan.in_turn, waiting: plan.waiting, full_round_checks: plan.full_round_checks };
    const lines: Record<string, any>[] = await onAirPass(pick, fetch);
    for (const line of lines) {
      liveProbe.checked++;
      if (line.state === "unknown") { liveProbe.unknown++; continue; }
      if (!line.live || !line.video) continue;
      liveProbe.on_air.push(line.video);
      forceRefresh.push(line.video);
      const current = candidates.get(line.video);
      const carriers = channelAccounts.get(line.id) || new Set<Account>(["scintilla"]);
      if (current) for (const account of carriers) current.accounts.add(account);
      else candidates.set(line.video, { ...liveCandidateRow(line.id, line.live, now), accounts: new Set<Account>(carriers) });
    }
    /* one line per channel read this pass (id · outcome · marker · way · video · where the read ended), so the next
       miss can be read off the row instead of guessed at */
    await sb.from("app_config").upsert({ key: "yt_bridge_live", value: JSON.stringify({
      last_ms: now * 1000, cursor, turn_cursor: plan.cursor, asked: liveProbe.asked, checked: liveProbe.checked, on_air: liveProbe.on_air, unknown: liveProbe.unknown,
      at: new Date(now * 1000).toISOString(), channels: lines.map(onAirLine) }) });
  }

  const ids = [...candidates.keys()];
  const known = new Map<string, string[]>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await sb.from("youtube_videos")
      .select("video_id,subscription_accounts")
      .in("video_id", ids.slice(i, i + 200));
    for (const row of data || []) known.set(row.video_id, row.subscription_accounts || []);
  }

  let membershipUpdates = 0;
  const membershipWrites: Promise<unknown>[] = [];
  for (const [videoId, existing] of known) {
    const candidate = candidates.get(videoId);
    if (!candidate) continue;
    const merged = [...new Set([...existing, ...candidate.accounts])].sort();
    if (merged.length !== existing.length || merged.some((value, i) => value !== [...existing].sort()[i])) {
      membershipUpdates++;
      membershipWrites.push(
        Promise.resolve(sb.from("youtube_videos").update({ subscription_accounts: merged }).eq("video_id", videoId)),
      );
    }
  }
  for (let i = 0; i < membershipWrites.length; i += 50) {
    await Promise.all(membershipWrites.slice(i, i + 50));
  }

  const seen = new Set<string>();
  const fresh = [...candidates.values()].filter((candidate) => {
    if (known.has(candidate.video_id)) return false;
    if (!keepSubscribed(candidate) && FOREIGN.test(String(candidate.title || ""))) return false;
    if (seen.has(candidate.video_id)) return false;
    seen.add(candidate.video_id);
    return true;
  });

  let wrote = 0;
  let writeError: string | null = null;
  let dropped = 0;
  if (fresh.length) {
    const detail: Record<string, ReturnType<typeof liveFields>> = {};
    const language: Record<string, string> = {};
    const freshIds = fresh.map((row) => row.video_id);
    for (let i = 0; i < freshIds.length; i += 50) {
      const r = await apiKeyRequest(
        "videos?part=" + LIVE_PART + "&id=" + freshIds.slice(i, i + 50).join(",") + "&maxResults=50",
        apiKey,
      );
      for (const item of r.body?.items || []) {
        detail[item.id] = liveFields(item, now);
        const snippet = item.snippet || {};
        language[item.id] = String(snippet.defaultAudioLanguage || snippet.defaultLanguage || "").toLowerCase();
      }
    }
    /* A stream that has not started yet is KEPT: the tile shows its start time.
       It used to be dropped here, which is why a scheduled stream could only
       appear once some later pass happened to catch it after it went on air. */
    const keep = fresh.filter((row) => {
      const lang = language[row.video_id] || "";
      /* Y4: "Everything subscribed." A carried channel's video is kept whatever its language tag says. */
      if (lang && lang.slice(0, 2) !== "en" && !keepSubscribed(row, lang)) { dropped++; return false; }
      return true;
    });
    for (let i = 0; i < keep.length; i += 16) {
      await Promise.all(keep.slice(i, i + 16).map(async (row) => {
        row.is_short = await isShort(row.video_id);
      }));
    }
    const rows = keep.map((row) => {
      const accounts = [...row.accounts].sort();
      const { accounts: _, ...plain } = row;
      const fields = detail[row.video_id] || { duration_sec: null, live_broadcast: null, live_started_at: null,
        live_ended_at: null, live_scheduled_at: null, live_checked_ts: now };
      return {
        ...plain,
        ...fields,
        /* a stream YouTube calls live without a start time: the first moment we saw it live */
        live_started_at: watchableStart({ broadcast: fields.live_broadcast, actualStart: fields.live_started_at,
          storedStart: null, nowIso: new Date(now * 1000).toISOString() }),
        is_short: row.is_short === true,
        subscription_accounts: accounts,
      };
    });
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const { error } = await sb.from("youtube_videos").upsert(batch, { onConflict: "video_id" });
      if (error) writeError = error.message;
      else wrote += batch.length;
    }
  }

  /* ---- STORED STREAMS KEEP CHANGING AFTER WE FIRST SEE THEM ----
     The first pass writes a row once and never looks at it again, so a stream
     caught while it was scheduled kept its scheduled date for ever and a
     finished stream never got its real length. Every pass now re-asks YouTube
     about the recent rows that are still moving: on air, still to come, or with
     no length yet. Bounded to REFRESH_MAX rows over REFRESH_DAYS days. */
  let refreshed = 0;
  let liveGone = 0;
  let refreshError: string | null = null;
  try {
    const since = new Date((now - REFRESH_DAYS * 86400) * 1000).toISOString();
    const { data: watching, error: watchError } = await sb.from("youtube_videos")
      .select("video_id")
      .gte("published_at", since)
      .or("duration_sec.is.null,live_broadcast.in.(live,upcoming)")
      .order("published_at", { ascending: false })
      .limit(REFRESH_MAX);
    if (watchError) refreshError = watchError.message;
    /* Y2: a row that says "live" is re-asked about whatever its age — the three-day window above left streams
       that ended weeks ago still marked LIVE (measured 5 Oct: 13 rows said live, the oldest from 21 Sep). They
       and the streams the /live read just found go FIRST, inside the same REFRESH_MAX, so this costs no extra call. */
    const { data: stillLive } = await sb.from("youtube_videos")
      .select("video_id").eq("live_broadcast", "live")
      .order("live_checked_ts", { ascending: true, nullsFirst: true }).limit(50);
    const liveSaid = new Set((stillLive || []).map((row) => row.video_id as string));
    /* Y4: a scheduled stream is re-asked about by its START time. The window above is on the publish date, and a
       stream is "published" the day it is scheduled — one scheduled more than three days ahead was never asked
       about again and stayed "upcoming" through its own broadcast (17 such rows on 6 Oct). */
    const { data: scheduled } = await sb.from("youtube_videos")
      .select("video_id").eq("live_broadcast", "upcoming")
      .gte("live_scheduled_at", new Date((now - UPCOMING_BACK_DAYS * 86400) * 1000).toISOString())
      .order("live_scheduled_at", { ascending: true }).limit(UPCOMING_MAX);
    const watchIds: string[] = refreshOrder({ found: forceRefresh,
      stillLive: (stillLive || []).map((row) => row.video_id as string),
      upcoming: (scheduled || []).map((row) => row.video_id as string),
      recent: (watching || []).map((row) => row.video_id as string) }).slice(0, REFRESH_MAX);
    /* the start time we already hold, so "the first moment we saw it live" is written once and never moved */
    const heldStart = new Map<string, string | null>();
    for (let i = 0; i < watchIds.length; i += 200) {
      const { data: held } = await sb.from("youtube_videos").select("video_id,live_started_at").in("video_id", watchIds.slice(i, i + 200));
      for (const row of held || []) heldStart.set(row.video_id as string, (row.live_started_at as string) || null);
    }
    for (let i = 0; i < watchIds.length; i += 50) {
      const r = await apiKeyRequest(
        "videos?part=" + LIVE_PART + "&id=" + watchIds.slice(i, i + 50).join(",") + "&maxResults=50",
        apiKey,
      );
      const items = r.body?.items || [];
      /* YouTube answered, and a row we hold as "live" is not in the answer: the video was removed or made
         private. It is not on air. Only on a clean answer — a failed call must never end a stream. */
      if (r.status === 200 && Array.isArray(r.body?.items)) {
        const answered = new Set(items.map((item: Record<string, any>) => item.id));
        const gone = watchIds.slice(i, i + 50).filter((id) => liveSaid.has(id) && !answered.has(id));
        if (gone.length) {
          const { error } = await sb.from("youtube_videos")
            .update({ live_broadcast: "none", live_checked_ts: now }).in("video_id", gone);
          if (error) refreshError = error.message; else liveGone += gone.length;
        }
      }
      for (let j = 0; j < items.length; j += 16) {
        await Promise.all(items.slice(j, j + 16).map(async (item: Record<string, any>) => {
          const fields = liveFields(item, now);
          fields.live_started_at = watchableStart({ broadcast: fields.live_broadcast, actualStart: fields.live_started_at,
            storedStart: heldStart.get(item.id) || null, nowIso: new Date(now * 1000).toISOString() });
          const { error } = await sb.from("youtube_videos")
            .update(fields).eq("video_id", item.id);
          if (error) refreshError = error.message;
          else refreshed++;
        }));
      }
    }
  } catch (e) {
    refreshError = String((e as Error)?.message || e);
  }

  const result = {
    accounts: Object.fromEntries(ACCOUNTS.map((account) => [account, {
      channels: accountChannels[account].length,
      error: accountErrors[account] || null,
    }])),
    rss_seen: ids.length,
    rss_failed: rssFailed,
    rss_channels: ACCOUNTS.reduce((n, account) => n + accountChannels[account].length, 0),
    bridge: { channels: bridgeIds.length, added_to_scintilla: bridgeAdded, live_check: liveProbe },
    new_videos: wrote,
    membership_updates: membershipUpdates,
    live_refreshed: refreshed,
    live_gone: liveGone,
    refresh_error: refreshError,
    dropped,
    write_error: writeError,
    at: new Date().toISOString(),
  };
  await sb.from("app_config").upsert({ key: "yt_rss_result", value: JSON.stringify(result) });
  await sb.from("app_config").upsert({ key: "yt_rss_running", value: JSON.stringify({ ts: 0 }) });
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
});

