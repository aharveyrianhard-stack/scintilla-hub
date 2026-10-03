// SCINTILLA · yt-rss-sweep v2 — dual-identity subscription collector.
// Personal and SCINTILLA subscriptions are authorized independently, then
// polled through free channel RSS. One video row can belong to both accounts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Deno.serve(async () => {
  if (!SB_URL || !SB_KEY) {
    return new Response(JSON.stringify({ error: "backend credentials unavailable" }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  const sb = createClient(SB_URL, SB_KEY);
  const now = Math.floor(Date.now() / 1000);
  const configKeys = [
    "YT_API_KEY",
    "YT_OAUTH_CLIENT_ID",
    "YT_OAUTH_CLIENT_SECRET",
    ...ACCOUNTS.map((account) => "YT_REFRESH_TOKEN_" + account.toUpperCase()),
    ...ACCOUNTS.map((account) => "yt_sub_channels_" + account),
    "yt_sub_channels",
    "yt_rss_running",
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

  type Candidate = Record<string, unknown> & { video_id: string; accounts: Set<Account> };
  const candidates = new Map<string, Candidate>();
  await Promise.all(ACCOUNTS.flatMap((account) => accountChannels[account].map(async (channelId) => {
    try {
      const r = await fetch("https://www.youtube.com/feeds/videos.xml?channel_id=" + channelId);
      if (!r.ok) return;
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
    if (FOREIGN.test(String(candidate.title || ""))) return false;
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
      if (lang && lang.slice(0, 2) !== "en") { dropped++; return false; }
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
    }
  }

  /* ---- STORED STREAMS KEEP CHANGING AFTER WE FIRST SEE THEM ----
     The first pass writes a row once and never looks at it again, so a stream
     caught while it was scheduled kept its scheduled date for ever and a
     finished stream never got its real length. Every pass now re-asks YouTube
     about the recent rows that are still moving: on air, still to come, or with
     no length yet. Bounded to REFRESH_MAX rows over REFRESH_DAYS days. */
  let refreshed = 0;
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
    const watchIds = (watching || []).map((row) => row.video_id as string);
    for (let i = 0; i < watchIds.length; i += 50) {
      const r = await apiKeyRequest(
        "videos?part=" + LIVE_PART + "&id=" + watchIds.slice(i, i + 50).join(",") + "&maxResults=50",
        apiKey,
      );
      const items = r.body?.items || [];
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
    new_videos: wrote,
    membership_updates: membershipUpdates,
    live_refreshed: refreshed,
    refresh_error: refreshError,
    dropped,
    write_error: writeError,
    at: new Date().toISOString(),
  };
  await sb.from("app_config").upsert({ key: "yt_rss_result", value: JSON.stringify(result) });
  await sb.from("app_config").upsert({ key: "yt_rss_running", value: JSON.stringify({ ts: 0 }) });
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
});

