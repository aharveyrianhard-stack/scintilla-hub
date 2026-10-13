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
// Y5 (12 Oct): Alan, about a channel on the SCINTILLA list: "The videos are not coming through to the Scintilla channel."
// Its feed was answering; every one of its videos is tagged "zxx" (no spoken language) and this function threw
// away any new video whose tag did not start with "en". A followed channel's video is now kept whatever its tag
// or its title's script says (keepSubscribed, _shared/yt-feed-fallback.mjs — Alan, 6 Oct: "Everything subscribed"),
// and the result row counts what the old rule would have dropped (kept_other_language, kept_other_script).
// THE SECOND WAY IN. YouTube's public feed fails in bursts (measured 12–13 Oct: 99–190 of 194 feeds answering
// 404 / 500 for 95 minutes). A followed channel whose feed gave no answer this pass and that nothing has read for
// more than an hour is read through its uploads list instead (YouTube Data API, 1 unit a channel), inside a hard
// budget whose numbers live in app_config (yt_rss_fallback; rules and arithmetic in _shared/yt-feed-fallback.mjs).
// What it finds goes down the same path as a feed entry. Every channel's last read is remembered in one row
// (yt_rss_health), the result row says what the second way did and names the channels nothing has read for more
// than a day, and a third read-only door shows it without writing:  ?dry=fallback[&channels=UC…,UC…]
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore  plain ESM shared with the resolver and the Node tests
import { bridgeChannelIds, withBridge, onAirPass, onAirLine, probeLive, isChannelId, isVideoId, liveProbeDue, liveProbePick, liveCandidateRow, LIVE_EVERY_MIN,
  keepSubscribed, otherLanguage, HEALTH_KEY, SETTINGS_KEY, fallbackSettings, parseHealth, fallbackPlan, capWords, readUploadsPass, feedAnswers, isFeed,
  nextHealth, unreadOverADay, savedChannelLists, carriers, lastRead, UNREAD_NAMED_MAX } from "../_shared/yt-bridge.mjs";

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
  /* ---- READ-ONLY DOOR 3 (Y5): the feed's second way, looked at and not stored. It reads the saved channel lists
     (it signs in nowhere), asks every followed channel's feed as a pass would, works out which channels the
     second way would take under the same rules and budget, asks YouTube's API for exactly those, and reports
     what came back and which of it the table already holds. &channels=UC…,UC… asks about those channels
     whatever their feed says (never more than per_pass of them). No write, no lock, the remembered row left as
     it is — so the units a look spends (1 a channel asked) are NOT added to the day's count; it says how many. ---- */
  if (ask.get("dry") === "fallback") {
    const { data } = await sb.from("app_config").select("key,value").in("key",
      ["YT_API_KEY", ...ACCOUNTS.map((account) => "yt_sub_channels_" + account), "yt_sub_channels", "yt_bridge_channels", HEALTH_KEY, SETTINGS_KEY]);
    const d: Record<string, string> = {};
    for (const row of data || []) d[row.key] = row.value;
    const lookKey = (d.YT_API_KEY || "").trim();
    if (!lookKey) return json({ dry: "fallback", wrote: "nothing", error: "missing YouTube API key" });
    const lists: Record<string, string[]> = savedChannelLists(d, [...ACCOUNTS]);
    let bridged: string[] = [];
    try { bridged = bridgeChannelIds(JSON.parse(d.yt_bridge_channels || "null")); } catch (_) {}
    lists.scintilla = withBridge(lists.scintilla, bridged);
    const followed: string[] = [...carriers(lists, [...ACCOUNTS]).keys()].filter(isChannelId);
    const health = parseHealth(d[HEALTH_KEY]), settings = fallbackSettings(d[SETTINGS_KEY]);
    const named = [...new Set((ask.get("channels") || "").split(",").filter(isChannelId))];
    const toRead = named.length ? named : followed;
    const feedLines: Record<string, any>[] = [];
    for (let i = 0; i < toRead.length; i += 16) {
      feedLines.push(...await Promise.all(toRead.slice(i, i + 16).map((id) => feedAnswers(id, fetch))));
    }
    const answered = new Map(feedLines.map((line) => [line.id as string, line]));
    const unread = toRead.filter((id) => !answered.get(id)?.ok);
    const plan = fallbackPlan({ unread, health, settings, nowSec: now });
    /* a named channel is asked whatever its feed said — that is the point of naming it — but the caps still hold:
       never more than per_pass, none when the second way is off, YouTube has said the day is gone, or the day's
       calls are spent */
    const off = !settings.per_pass || !settings.per_day, quotaGone = health.quota_day === plan.day;
    const spare = Math.max(0, settings.per_day - plan.used_today);
    const pick: string[] = !named.length ? plan.pick : off || quotaGone ? [] : named.slice(0, Math.min(settings.per_pass, spare));
    const cap = !named.length ? plan.cap : pick.length === named.length ? null
      : off ? "off" : quotaGone ? "quota" : spare < Math.min(settings.per_pass, named.length) ? "day" : "pass";
    const reads: Record<string, any>[] = await readUploadsPass(pick, lookKey, fetch, { maxResults: settings.max_results, nowSec: now });
    const found = reads.flatMap((read) => read.rows.map((video: Record<string, any>) => video.video_id as string));
    const have = new Set<string>();
    for (let i = 0; i < found.length; i += 200) {
      const { data: rows } = await sb.from("youtube_videos").select("video_id").in("video_id", found.slice(i, i + 200));
      for (const row of rows || []) have.add(row.video_id);
    }
    const unreadDay: Record<string, any>[] = unreadOverADay(health, now);
    return json({ dry: "fallback", wrote: "nothing", at: new Date().toISOString(), followed: followed.length,
      feeds_read: toRead.length, feed_unread: unread.length, eligible: named.length ? named.length : plan.eligible.length,
      would_ask: pick, skipped_budget: named.length ? named.length - pick.length : plan.skipped_budget, cap, cap_says: capWords(cap, settings, plan),
      budget: { per_pass: settings.per_pass, per_day: settings.per_day, after_min: settings.after_min, max_results: settings.max_results,
        from: settings.from, day: plan.day, used_today: plan.used_today, allowed_by_now: plan.allowed_by_now, quota_gone: quotaGone },
      asked: reads.map((read) => {
        const entry = health.ch[read.id] || {}, last = lastRead(entry), feed = answered.get(read.id);
        return { id: read.id, name: read.name || entry.n || "", why: named.length ? "named in the call" : "feed unread",
          feed: feed?.ok ? "answered" : "no answer (" + (feed?.status || "no reply") + ")",
          last_read_min_ago: last ? Math.round((now - last) / 60) : null,
          outcome: read.outcome, reason: read.reason, videos: read.rows.length,
          newest: read.rows.map((video: Record<string, any>) => video.published_at as string).sort().pop() || null,
          not_stored: read.rows.filter((video: Record<string, any>) => !have.has(video.video_id)).length,
          items: read.rows.map((video: Record<string, any>) => ({ video_id: video.video_id, published_at: video.published_at,
            title: String(video.title).slice(0, 80), stored: have.has(video.video_id) })) };
      }),
      units_spent: reads.filter((read) => read.sent).length,
      note: "a look writes nothing: the units it spends are not added to the day's count in " + HEALTH_KEY,
      unread_over_a_day: { count: unreadDay.length, longest_hours: unreadDay.length ? unreadDay[0].hours : 0,
        names: unreadDay.slice(0, UNREAD_NAMED_MAX).map((line) => line.name || line.id) } });
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
    HEALTH_KEY,
    SETTINGS_KEY,
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
  /* Y5: the channels whose feed gave a readable answer this pass — every other followed channel is "unread" */
  const feedOk = new Set<string>();
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
      if (isFeed(xml)) feedOk.add(channelId);
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

  /* ---- THE SECOND WAY IN (Y5) ----
     A followed channel whose feed gave no readable answer this pass, and that nothing has read for more than
     after_min minutes, is read through its uploads list (YouTube Data API playlistItems, 1 unit a channel):
     oldest-unread first, never more than per_pass a pass, never more than the even share of per_day the Pacific
     day has reached (the rules and the day's arithmetic: _shared/yt-feed-fallback.mjs). What comes back goes
     into the same candidates as a feed entry, under the accounts that carry the channel — so the already-stored
     check, the videos call, shorts and live treat it exactly as they treat the feed. A cap that leaves channels
     unasked is said in the result row. THE NEIGHBOURS: at most per_pass calls, asked together, each bounded to
     8 s — inside the schedule's 120 s wait and the 180 s "busy" lock. Nothing here can fail the pass. */
  let settings: Record<string, any> = fallbackSettings(null);
  let plan: Record<string, any> = { day: "", used_today: 0, allowed_by_now: 0, eligible: [], pick: [], skipped_budget: 0, cap: null };
  let reads: Record<string, any>[] = [];
  let unread: string[] = [];
  let unreadDay: Record<string, any>[] = [];
  let healthNow: Record<string, any> = parseHealth(null);
  let secondWayError: string | null = null;
  const secondWayVideos = new Set<string>();
  try {
    const health = parseHealth(c[HEALTH_KEY]);
    healthNow = health;
    settings = fallbackSettings(c[SETTINGS_KEY]);
    const feedCarriers: Map<string, Set<Account>> = carriers(accountChannels, [...ACCOUNTS]);
    const followed = [...feedCarriers.keys()].filter(isChannelId);
    unread = followed.filter((id) => !feedOk.has(id));
    plan = fallbackPlan({ unread, health, settings, nowSec: now });
    if (plan.pick.length) reads = await readUploadsPass(plan.pick, apiKey, fetch, { maxResults: settings.max_results, nowSec: now });
    for (const read of reads) {
      if (read.outcome !== "ok") continue;
      const carriedBy = feedCarriers.get(read.id) || new Set<Account>();
      for (const row of read.rows) {
        secondWayVideos.add(row.video_id);
        const current = candidates.get(row.video_id);
        if (current) for (const account of carriedBy) current.accounts.add(account);
        else candidates.set(row.video_id, { ...row, accounts: new Set<Account>(carriedBy) });
      }
    }
    /* what is remembered is written at once: the calls just made count against the day whatever the rest of
       the pass does */
    healthNow = nextHealth({ health, channels: followed, feedOk, reads, nowSec: now });
    unreadDay = unreadOverADay(healthNow, now);
    for (const line of unreadDay.filter((entry) => !entry.name).slice(0, 10)) {
      /* a channel dark for a day is named from the videos already held, once; the name then stays in the row */
      const { data: named } = await sb.from("youtube_videos").select("channel_title").eq("channel_id", line.id).limit(1);
      const name = String((named || [])[0]?.channel_title || "");
      if (name) { line.name = name; healthNow.ch[line.id].n = name.slice(0, 60); }
    }
    const { error } = await sb.from("app_config").upsert({ key: HEALTH_KEY, value: JSON.stringify(healthNow) });
    if (error) secondWayError = "the remembered row was not written: " + error.message;
  } catch (e) {
    secondWayError = String((e as Error)?.message || e).split(apiKey).join("…").slice(0, 200);
  }

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
  if (bridgeIds.length && liveProbeDue(now * 1000, +liveState.last_ms || 0, LIVE_EVERY_MIN)) {
    const { pick, cursor } = liveProbePick(bridgeIds, liveState.cursor);
    liveProbe.ran = true;
    const lines: Record<string, any>[] = await onAirPass(pick, fetch);
    for (const line of lines) {
      liveProbe.checked++;
      if (line.state === "unknown") { liveProbe.unknown++; continue; }
      if (!line.live || !line.video) continue;
      liveProbe.on_air.push(line.video);
      forceRefresh.push(line.video);
      const current = candidates.get(line.video);
      if (current) current.accounts.add("scintilla");
      else candidates.set(line.video, { ...liveCandidateRow(line.id, line.live, now), accounts: new Set<Account>(["scintilla"]) });
    }
    /* one line per channel read this pass (id · outcome · marker · way · video · where the read ended), so the next
       miss can be read off the row instead of guessed at */
    await sb.from("app_config").upsert({ key: "yt_bridge_live", value: JSON.stringify({
      last_ms: now * 1000, cursor, checked: liveProbe.checked, on_air: liveProbe.on_air, unknown: liveProbe.unknown,
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
  let keptOtherLanguage = 0;
  let keptOtherScript = 0;
  let secondWayNew = 0;
  /* Y5: a videos call YouTube did not answer OK leaves its rows with no length, no live state and no tag. It was
     silent (93 rows on 10 Oct 13:35Z); it is counted now. */
  let videosNotOk = 0;
  if (fresh.length) {
    const detail: Record<string, ReturnType<typeof liveFields>> = {};
    const language: Record<string, string> = {};
    const freshIds = fresh.map((row) => row.video_id);
    for (let i = 0; i < freshIds.length; i += 50) {
      const r = await apiKeyRequest(
        "videos?part=" + LIVE_PART + "&id=" + freshIds.slice(i, i + 50).join(",") + "&maxResults=50",
        apiKey,
      );
      if (r.status !== 200) videosNotOk++;
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
    /* Y5: what the old rule threw away on every pass, counted now that it is kept (the channel Alan named: tag "zxx") */
    keptOtherLanguage = keep.filter((row) => otherLanguage(language[row.video_id])).length;
    keptOtherScript = keep.filter((row) => FOREIGN.test(String(row.title || ""))).length;
    const rows = keep.map((row) => {
      const accounts = [...row.accounts].sort();
      const { accounts: _, ...plain } = row;
      return {
        ...plain,
        ...(detail[row.video_id] || { duration_sec: null, live_broadcast: null, live_started_at: null,
          live_ended_at: null, live_scheduled_at: null, live_checked_ts: now }),
        is_short: row.is_short === true,
        subscription_accounts: accounts,
      };
    });
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const { error } = await sb.from("youtube_videos").upsert(batch, { onConflict: "video_id" });
      if (error) writeError = error.message;
      else wrote += batch.length;
      if (!error) secondWayNew += batch.filter((written) => secondWayVideos.has(String(written.video_id))).length;
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
    const watchIds = [...new Set([...forceRefresh, ...(stillLive || []).map((row) => row.video_id as string),
      ...(watching || []).map((row) => row.video_id as string)])].slice(0, REFRESH_MAX);
    for (let i = 0; i < watchIds.length; i += 50) {
      const r = await apiKeyRequest(
        "videos?part=" + LIVE_PART + "&id=" + watchIds.slice(i, i + 50).join(",") + "&maxResults=50",
        apiKey,
      );
      const items = r.body?.items || [];
      if (r.status !== 200) videosNotOk++;
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
          const { error } = await sb.from("youtube_videos")
            .update(liveFields(item, now)).eq("video_id", item.id);
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
    /* Y5 · the second way this pass: how many channels' feeds gave no readable answer, how many of those were due
       (unread for more than after_min), how many were asked and read, the videos that brought and how many of
       them were new, how many were left for the budget and which cap did it, and the channels nothing has read
       for more than a day */
    fallback: {
      feed_unread: unread.length,
      eligible: plan.eligible.length,
      asked: reads.filter((read) => read.sent).length,
      read: reads.filter((read) => read.outcome === "ok").length,
      videos: secondWayVideos.size,
      videos_new: secondWayNew,
      skipped_budget: plan.skipped_budget,
      cap: plan.cap,
      cap_says: capWords(plan.cap, settings, plan),
      channels: reads.filter((read) => read.outcome === "ok").map((read) => ({ id: read.id, name: read.name, videos: read.rows.length })),
      could_not_read: reads.filter((read) => read.outcome !== "ok").map((read) => ({ id: read.id, outcome: read.outcome, reason: read.reason })),
      budget: { per_pass: settings.per_pass, per_day: settings.per_day, after_min: settings.after_min, max_results: settings.max_results,
        from: settings.from, day: healthNow.day, used_today: healthNow.used, allowed_by_now: plan.allowed_by_now,
        quota_gone: !!healthNow.quota_day && healthNow.quota_day === healthNow.day },
      unread_over_a_day: { count: unreadDay.length, longest_hours: unreadDay.length ? unreadDay[0].hours : 0,
        names: unreadDay.slice(0, UNREAD_NAMED_MAX).map((line) => line.name || line.id) },
      error: secondWayError,
    },
    new_videos: wrote,
    membership_updates: membershipUpdates,
    live_refreshed: refreshed,
    live_gone: liveGone,
    refresh_error: refreshError,
    videos_calls_not_ok: videosNotOk,
    dropped,
    kept_other_language: keptOtherLanguage,
    kept_other_script: keptOtherScript,
    write_error: writeError,
    at: new Date().toISOString(),
  };
  await sb.from("app_config").upsert({ key: "yt_rss_result", value: JSON.stringify(result) });
  await sb.from("app_config").upsert({ key: "yt_rss_running", value: JSON.stringify({ ts: 0 }) });
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
});

