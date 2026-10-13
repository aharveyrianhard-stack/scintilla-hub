// SCINTILLA · yt-upload-notice — notice a new upload cheaply, and read a channel only where something moved (Y6).
//
// Alan, 12 Oct 22:48 ET: "Why are we getting shit hidden? … Just get my shit on there, please."
//
// WHAT WAS MEASURED (12–13 Oct, the collector's own stored answers and YouTube's API):
//   · The public feed is mostly gone, not occasionally late: of 72 passes (21:20Z–03:15Z) the first 26 had every
//     feed answering, then came runs of 99–190 of 194 failing, and 162–184 of 195 for most of the last hour. Y5's
//     blind read — 6 channels a pass, a channel once an hour — needs two and a half hours to go round 186.
//   · channels.list?part=statistics answers for 50 channels in ONE call (1 unit, 154 ms) with each channel's
//     videoCount, and the number is fresh, mostly: 50 channels watched for 75 minutes with a look every 75
//     seconds. Of 14 rises that matched a new publish, 12 were in the number at the first look after it (3 to
//     70 seconds); the other two, both on one channel that posts Shorts in pairs, took 4 and 6½ minutes. The
//     number also fell (22, then 6: videos removed) and rose twice with no new publish behind it.
//   · What the number counts: videos, Shorts, and streams once they have started. A stream still to come sits in
//     the uploads list and is NOT counted (one channel: 678 in the list, 663 counted, 15 streams still to come).
//   · The uploads list "UU…" holds all three kinds; it is exactly "UULF…" (videos) + "UULV…" (streams) + "UUSH…"
//     (Shorts) — 469 = 38 + 305 + 126 on one channel, 3,281 = 1,140 + 953 + 1,188 on another. "UULF…" alone
//     holds no stream and no Short.
//
// THE RULES
//   NOTICE   On every pass each channel of the SCINTILLA list whose feed gave no readable answer is counted, 50
//            to a call. The places left over in those calls go to the other lists' unread channels — personal
//            first — and then to channels whose feed DID answer, whose counts are thereby kept fresh for
//            nothing. A call that exists only for the other lists is made when one of their unread channels has
//            waited notice_min for a count, and only inside the day's even share. While the SCINTILLA list's
//            feeds answer, its counts are taken afresh every baseline_min, all at once, so that a burst starts
//            from counts that are minutes old and not days.
//   READ     A channel whose count is not the one remembered is read through its uploads list (1 unit) in the
//            same pass: the SCINTILLA list first, then personal, then the rest, longest-unread first inside
//            each, up to moved_per_pass. A moved count is taken over only by a pass that read the channel
//            (nextHealth), so a cap can delay a read and can never lose one.
//   EXPLAIN  YouTube's count and its uploads list are two answers, and need not agree to the second. So a count
//            that went UP is taken over only when the read shows the videos that account for it: as many
//            published since the old count was last seen (ten minutes' grace for a count that runs late) as
//            the count rose by. If it does not, the old count stays and the channel is read again on the next
//            pass; after two such reads the count is taken as it stands — a video made public again and a
//            stream that has just started both raise the count without a new publish time. A count that went
//            DOWN (videos removed: one channel dropped 22 and then 6 inside two minutes while this was
//            measured) needs no explaining; it is read once, because a new video can hide behind a removal.
//   VOUCH    "The count has not moved" means "nothing new" only once a read has stood behind that count. Such a
//            channel is no longer read blind every hour (Y5): the blind read becomes a check every verify_min.
//            A channel the count cannot vouch for — never read, or its count call failed — keeps Y5's hour.
//            The blind read keeps Y5's order too, the longest unread first whatever its list: it is the net
//            under everything, and with the counts down it must still reach every list.
//   HOW LATE  A pass every five minutes, and a count that is on time, put a new video in the table five to six
//            minutes after it is posted at worst (6 min 3 s over a made-up day of 165 uploads; 1.6 and 6.9
//            minutes for the two real ones caught while this was written). A count that runs late adds its
//            lateness: still inside 10 minutes at 4 minutes late, 11½ minutes at the 6½ measured once.
//   STREAMS AND SHORTS   The read is the whole uploads list, as in Y5, not "UULF…": a burst must not change WHAT
//            reaches the table, and the feed carries all three kinds. A Short moves the count like a video and
//            is stored with is_short, as from the feed. A stream that starts moves the count and is read; one
//            still to come moves nothing — it arrives with the channel's next read (at latest the verify_min
//            check), and the on-air check finds it when it starts.
//   THE DAY  Everything here spends from the same number as Y5's read (yt_rss_fallback.per_day), counted in the
//            one remembered row. The SCINTILLA list's counts and reads, and the lists' own refresh, are held to
//            the day's number; everything else also to the day's even share so far. And the day's number itself
//            gives way to the neighbours: it is never more than the 10,000 less RADAR's 7,979, less what this
//            sweep's own videos calls have used today and will need for the rest of it (dayGuard).
//
// Plain ESM, read by Deno (yt-rss-sweep, through _shared/yt-bridge.mjs) and Node (the tests) alike. No key is
// returned, stored or put in a message here.
import { pacificClock, DAILY_QUOTA } from "./yt-search-plan.mjs";
import { SEARCH_MAX_UNITS, SWEEP_EVERY_MIN, lastRead, retryAfterMin, allowedByNow, fallbackPlan, readUploadsPass, apiGet } from "./yt-feed-fallback.mjs";

const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
export const COUNTS_PER_CALL = 50;
/* this sweep's own videos calls: measured 137 in 72 passes before Y5 (1.9 a pass), 5 in the first 3 after */
export const OWN_CALLS_A_PASS = 2;
export const GUARD_MARGIN = 50;
/* a count that went up and a read that does not account for it: read again on this many further passes, then believe the count */
export const UNEXPLAINED_READS = 2;
export const COUNT_GRACE_SEC = 600;

/** which turn a channel takes: 0 the SCINTILLA list and the channels that ride with it, 1 personal, 2 the rest */
export function tiersOf(accountChannels, accounts) {
  const tier = new Map();
  for (const id of accountChannels.scintilla || []) tier.set(id, 0);
  for (const id of accountChannels.personal || []) if (!tier.has(id)) tier.set(id, 1);
  for (const account of accounts) for (const id of accountChannels[account] || []) if (!tier.has(id)) tier.set(id, 2);
  return tier;
}

/** THE NEIGHBOURS' GUARD: the most the second way may come to today, whatever its own number says — the day's
    allowance less RADAR's searches, less this sweep's own videos calls so far, less two a pass for the passes
    still to come, less a margin. ownToday comes from the last result row (ownCallsToday). */
export function dayGuard({ nowSec, ownToday = 0 }) {
  const clock = pacificClock(nowSec * 1000);
  const passesLeft = Math.ceil((1440 - clock.minute) / SWEEP_EVERY_MIN);
  return Math.max(0, DAILY_QUOTA - SEARCH_MAX_UNITS - Math.max(0, ownToday) - OWN_CALLS_A_PASS * passesLeft - GUARD_MARGIN);
}
/** this sweep's own videos calls so far in the Pacific day, as the last pass's result row left them */
export function ownCallsToday(raw, nowSec) {
  let row = null;
  try { row = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (_) { row = null; }
  const today = row && row.units && row.units.today;
  if (!today || today.day !== pacificClock(nowSec * 1000).day) return 0;
  const n = Math.floor(Number(today.videos_calls));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** THE PASS'S PURSE. room() is what anything may still spend today; paced() is what may be spent by whatever is
    held to the day's even share. spend(n) is called as the pass goes. Nothing here calls anything. */
export function passBudget({ health, settings, nowSec, ownToday = 0 }) {
  const clock = pacificClock(nowSec * 1000);
  const usedBefore = health.day === clock.day ? health.used : 0;
  const guard = dayGuard({ nowSec, ownToday });
  const ceiling = Math.max(0, Math.min(settings.per_day, guard));
  const byNow = Math.min(allowedByNow(settings.per_day, clock.minute), ceiling);
  const budget = {
    day: clock.day, used_before: usedBefore, spent: 0, per_day: settings.per_day, guard, ceiling, by_now: byNow,
    passes_left: Math.ceil((1440 - clock.minute) / SWEEP_EVERY_MIN),
    /* set by noticePlan when the day's number could not carry the SCINTILLA list's counts to midnight */
    held: false,
    off: !settings.per_day, quota_gone: health.quota_day === clock.day,
    closed: () => budget.off || budget.quota_gone,
    room: () => (budget.closed() ? 0 : Math.max(0, ceiling - usedBefore - budget.spent)),
    paced: () => (budget.closed() ? 0 : Math.max(0, byNow - usedBefore - budget.spent)),
    spend: (n) => { budget.spent += Math.max(0, n || 0); },
    /* why nothing more may be spent, in the cap names Y5's result row uses */
    why: () => (budget.off ? "off" : budget.quota_gone ? "quota" : ceiling < settings.per_day ? "neighbours" : "day"),
  };
  return budget;
}

/** WHOSE COUNT IS ASKED THIS PASS. followed = every followed channel in turn order (the SCINTILLA list first);
    feedOk = the channels whose feed answered this pass. Returns the ids in the order they fill the calls, how
    many calls, and how many of those the SCINTILLA list needs. Nothing here calls anything. */
export function noticePlan({ followed, tier, feedOk, health, notice, nowSec, budget }) {
  const none = { ask: [], calls: 0, must_calls: 0, extra_calls: 0, refresh: false, why: null, must: 0, wanting: 0, fill: 0, short: 0 };
  if (!notice.notice) return { ...none, why: "off" };
  if (budget.closed()) return { ...none, why: budget.why() };
  const turn = (id) => tier.get(id) ?? 2, entry = (id) => health.ch[id] || {};
  const due = (id, minutes) => { const e = entry(id); return e.c == null || !e.ca || nowSec - e.ca >= minutes * 60 - 30; };
  const oldestCountFirst = (a, b) => turn(a) - turn(b) || (entry(a).ca || 0) - (entry(b).ca || 0);
  const list = (followed || []).filter((id) => CHANNEL_ID.test(String(id)));
  const unread = list.filter((id) => !feedOk.has(id)), answered = list.filter((id) => feedOk.has(id));
  /* longest-uncounted first, so that when a call is all there is, it is not always the same 50 */
  const longestUncounted = (a, b) => (entry(a).ca || 0) - (entry(b).ca || 0);
  const first = unread.filter((id) => turn(id) === 0).sort(longestUncounted);
  const firstAnswered = answered.filter((id) => turn(id) === 0).sort(longestUncounted);
  const refresh = notice.baseline_min > 0 && firstAnswered.some((id) => due(id, notice.baseline_min));
  const must = [...first, ...(refresh ? firstAnswered : [])];
  const others = unread.filter((id) => turn(id) !== 0).sort(oldestCountFirst);
  const wanting = others.filter((id) => due(id, notice.notice_min));
  const notYet = others.filter((id) => !due(id, notice.notice_min));
  const spare = answered.filter((id) => !must.includes(id)).sort(oldestCountFirst);
  /* THE DAY MUST LAST. The SCINTILLA list's counts are not held to the day's even share — unless the day's number
     could not carry them at this rate to midnight Pacific. Then they are: a number set too low thins the counts
     through the whole day instead of leaving the evening dark. (The reads of channels that moved are never
     thinned this way: a video known to be there is worth more than another look.) */
  const mustNeeded = Math.ceil(must.length / COUNTS_PER_CALL);
  /* "this rate" is what the UNREAD channels need on every pass; the hourly refresh is not a rate and is not held */
  const everyPass = Math.ceil(first.length / COUNTS_PER_CALL);
  if (everyPass && budget.room() < everyPass * budget.passes_left) budget.held = true;
  const mustCalls = Math.min(mustNeeded, budget.held ? budget.paced() : budget.room());
  const wantCalls = Math.ceil((must.length + wanting.length) / COUNTS_PER_CALL);
  const whole = mustCalls * COUNTS_PER_CALL >= must.length;                 // the day had room for all the SCINTILLA list needs
  const extraCalls = whole ? Math.max(0, Math.min(wantCalls - mustCalls, budget.paced() - mustCalls)) : 0;
  const calls = mustCalls + extraCalls;
  const wanted = must.length + wanting.length;
  /* what held a count back, when one was: the day's number (or the neighbours'), else the day's even share */
  const held = whole || (budget.held && budget.room() > 0) ? "pace" : budget.why();
  if (!calls) return { ...none, refresh, must: must.length, wanting: wanting.length, short: wanted, why: wanted ? held : null };
  const places = calls * COUNTS_PER_CALL;
  const ask = [...must, ...wanting, ...notYet, ...spare].slice(0, places);
  const served = Math.min(places, wanted);
  return { ask, calls, must_calls: mustCalls, extra_calls: extraCalls, refresh, must: must.length, wanting: wanting.length,
    fill: ask.length - served, short: wanted - served, why: wanted > served ? held : null };
}

/** ONE COUNT CALL: up to 50 channels, 1 unit. { sent, status, outcome, reason, asked, counts: Map id → videoCount } */
export async function countsCall(ids, apiKey, fetchFn = globalThis.fetch) {
  const r = await apiGet("channels?part=statistics&id=" + ids.join(",") + "&maxResults=" + COUNTS_PER_CALL, apiKey, fetchFn);
  const counts = new Map();
  if (r.outcome === "ok" && !Array.isArray(r.body.items) && r.body.items != null) r.outcome = "unreadable";
  if (r.outcome === "ok") {
    for (const item of r.body.items || []) {
      const n = Math.floor(Number(item && item.statistics && item.statistics.videoCount));
      if (item && ids.includes(item.id) && item.statistics && item.statistics.videoCount != null && Number.isFinite(n) && n >= 0) counts.set(item.id, n);
    }
  }
  return { sent: r.sent, status: r.status, outcome: r.outcome, reason: r.reason, asked: ids.length, counts };
}
/** the pass's count calls, asked together. { sent, calls: [{ status, outcome, reason, asked, answered }], counts, quota } */
export async function readCounts(ids, apiKey, fetchFn = globalThis.fetch) {
  const list = [...new Set(ids || [])].filter((id) => CHANNEL_ID.test(String(id)));
  const batches = [];
  for (let i = 0; i < list.length; i += COUNTS_PER_CALL) batches.push(list.slice(i, i + COUNTS_PER_CALL));
  const lines = await Promise.all(batches.map((batch) => countsCall(batch, apiKey, fetchFn)));
  const counts = new Map();
  for (const line of lines) for (const [id, n] of line.counts) counts.set(id, n);
  return { sent: lines.filter((line) => line.sent).length, counts, quota: lines.some((line) => line.outcome === "quota"),
    calls: lines.map((line) => ({ status: line.status, outcome: line.outcome, reason: line.reason, asked: line.asked, answered: line.counts.size })) };
}

/** WHAT THE COUNTS SAY about the channels whose feed is unread:  moved — not the number remembered;  confirmed —
    the number remembered, and a read stands behind it;  first — no number was remembered. */
export function readCountsAgainst({ unread, health, counts }) {
  const moved = [], confirmed = new Set(), first = [];
  for (const id of unread || []) {
    const count = counts.get(id);
    if (count == null) continue;
    const e = health.ch[id] || {};
    if (e.c == null) first.push(id);
    else if (count !== e.c) moved.push(id);
    else if (e.cr) confirmed.add(id);
  }
  return { moved, confirmed, first };
}

/** WHICH MOVED CHANNELS ARE READ THIS PASS: the SCINTILLA list first, then personal, then the rest; inside a turn
    the one unread longest. The SCINTILLA list is held to the day's number, the others also to its even share.
    A channel the second way could not read lately rests as it does for the blind read. */
export function movedPick({ moved, tier, health, settings, notice, nowSec, budget }) {
  const rows = [];
  let resting = 0;
  (moved || []).forEach((id, order) => {
    const e = health.ch[id] || {};
    if (e.x && e.t && nowSec - e.t < retryAfterMin(e.x, settings.after_min) * 60) { resting++; return; }
    rows.push({ id, order, turn: tier.get(id) ?? 2, last: lastRead(e) });
  });
  rows.sort((a, b) => a.turn - b.turn || a.last - b.last || a.order - b.order);
  const pick = [];
  let waiting = 0, cap = null;
  for (const row of rows) {
    if (pick.length >= notice.moved_per_pass) { waiting++; cap = cap || "pass"; continue; }
    const room = (row.turn === 0 ? budget.room() : budget.paced()) - pick.length;
    if (room < 1) { waiting++; cap = cap || (budget.closed() || !budget.room() || row.turn === 0 ? budget.why() : "pace"); continue; }
    pick.push(row.id);
  }
  return { pick, waiting, resting, cap };
}

/** THE WHOLE SECOND WAY FOR ONE PASS — the notice, the reads it asks for, and the blind read under them. The pass
    and the look-only door both run exactly this; neither the table nor the remembered row is touched here.
    Returns what happened; the caller files the videos and writes what is remembered. */
export async function secondWayPass({ followed, tier, feedOk, health, settings, notice, apiKey, nowSec, budget, fetchFn = globalThis.fetch }) {
  const unread = (followed || []).filter((id) => !feedOk.has(id));
  const ask = noticePlan({ followed, tier, feedOk, health, notice, nowSec, budget });
  let counted = { sent: 0, counts: new Map(), quota: false, calls: [] };
  if (ask.ask.length) {
    counted = await readCounts(ask.ask, apiKey, fetchFn);
    budget.spend(counted.sent);
    if (counted.quota) budget.quota_gone = true;
  }
  const said = readCountsAgainst({ unread, health, counts: counted.counts });
  const movedPlan = movedPick({ moved: said.moved, tier, health, settings, notice, nowSec, budget });
  budget.spend(movedPlan.pick.length);
  /* the blind read: Y5's rule, with the counts vouching where they can. YouTube saying "the day is gone" on a
     count call stops it at once, as the remembered row would on the next pass. */
  const rested = budget.quota_gone ? { ...health, quota_day: budget.day } : health;
  const plan = fallbackPlan({ unread, health: rested, settings, nowSec, confirmed: said.confirmed, moved: new Set(said.moved),
    exclude: new Set(movedPlan.pick), spent: budget.spent, dayCap: budget.ceiling, verifyMin: notice.notice ? notice.verify_min : 0 });
  budget.spend(plan.pick.length);
  const toRead = [...movedPlan.pick, ...plan.pick];
  const reads = toRead.length ? await readUploadsPass(toRead, apiKey, fetchFn, { maxResults: settings.max_results, nowSec }) : [];
  const readOk = new Set(reads.filter((read) => read.outcome === "ok").map((read) => read.id));
  /* A MOVE MUST BE EXPLAINED (see EXPLAIN above): which of the moved channels just read did not show the videos
     their count rose by */
  const unexplained = new Set();
  for (const read of reads) {
    if (read.outcome !== "ok" || !movedPlan.pick.includes(read.id)) continue;
    const e = health.ch[read.id] || {}, count = counted.counts.get(read.id);
    if (count == null || e.c == null || count <= e.c || (e.cu || 0) >= UNEXPLAINED_READS) continue;
    const since = (e.ca || 0) - COUNT_GRACE_SEC;
    const shown = read.rows.filter((row) => Date.parse(row.published_at) / 1000 > since).length;
    if (shown < Math.min(count - e.c, Math.max(1, read.rows.length))) unexplained.add(read.id);
  }
  return { unread, ask, counted, said, movedPlan, plan, reads, unexplained,
    report: { on: !!notice.notice, calls: counted.sent, asked: ask.ask.length, answered: counted.counts.size, for_the_scintilla_list: ask.must, refresh: ask.refresh,
      filled_free: ask.fill, not_counted: ask.short, not_counted_why: ask.why,
      unread_counted: unread.filter((id) => counted.counts.has(id)).length, moved: said.moved.length,
      moved_read: movedPlan.pick.filter((id) => readOk.has(id)).length, moved_unexplained: unexplained.size, moved_waiting: movedPlan.waiting, moved_resting: movedPlan.resting, moved_cap: movedPlan.cap,
      unmoved: said.confirmed.size, first_count: said.first.length,
      calls_not_ok: counted.calls.filter((call) => call.outcome !== "ok").map((call) => ({ outcome: call.outcome, reason: call.reason, channels: call.asked })) } };
}
