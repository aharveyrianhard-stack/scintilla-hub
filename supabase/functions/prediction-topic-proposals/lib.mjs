/* SCINTILLA · P2 (2 Oct 2026) — THE TOPIC METHOD: our own news decides which prediction markets we track.
   Alan, 2 Oct: "We never agreed on the topics … we need a methodology that scans the news from our streams, makes a
   list and tracks it." This module is the whole method, pure and keyless, so the node script
   (scripts/prediction-topic-proposals.mjs), the edge function beside this file (index.ts) and the tests run the SAME
   code over the same inputs. Nothing here touches topics.json: it writes PROPOSALS, and Alan approves.

   THE METHOD, IN PLAIN WORDS
   1. Read every headline of the last 7 days from our own news reel (public.news — R1 counted 35,592 over 545 sites).
   2. Count the headlines per THEME. A theme is a short list of words (below). The theme names are R1's
      (RESEARCH-SOURCES.html § 04); R1's exact word lists were not saved with its page, so the lists below are
      this lane's — the counts will differ a little from R1's and are printed with every proposal so that shows.
   3. A theme is HEAVY at 100 headlines or more in 7 days, QUIET under 20 (R1's floor and its retirement line).
   4. ADD: a heavy theme, with an open Polymarket market that passes the exclusion rule, and no tracked topic yet.
      REMOVE: a tracked topic whose theme is quiet AND which has no live market (no row in the last 8 hours).
      A topic with a live market is never proposed for removal on news alone (Alan: enduring topics roll forward).
      REMOVE, second way: a tracked topic that maps to no Polymarket market at all (Kalshi-only) while Kalshi is off —
      it can never have a reading, whatever the news says.
   5. Company-action themes (earnings, price targets, IPOs, offerings) are counted but never proposed: there is no
      macro market for "earnings" as a class, and single names live on their own company pages.
   THE EXCLUSION RULE (one sentence): markets about weather or temperatures, sports and games, tweet counts, prizes
   and celebrity novelties are left out whatever their volume, because none of them bears on a position. */

export const VERSION = "prediction-topic-proposals-v1";
export const ADD_MIN_7D = 100;      // a theme this heavy, with a market and no topic, is proposed for ADD
export const QUIET_MAX_7D = 20;     // a theme under this, with no live market, is proposed for REMOVE
export const LIVE_HOURS = 8;        // prediction_market_latest only holds rows from the last 8 hours: that is "live"

/* the theme map: name · the words (one case-insensitive regular expression over the headline) · the tracked topic ids
   that answer it · the Polymarket search words · kind (macro | instrument | company) */
export const THEMES = [
  { theme: "Fed / rates",             re: "\\b(fed|fomc|powell|federal reserve|rate (cut|hike)s?|basis points?)\\b",            topics: ["fed-2026-10", "fed-2026-12", "fed-2027-01", "fed-hikes-2026", "fed-cuts-2026"], q: "Fed decision", kind: "macro" },
  { theme: "CPI / inflation",         re: "\\b(cpi|inflation|consumer prices?)\\b",                                               topics: ["cpi-annual", "core-cpi", "inflation-peak-2026"], q: "CPI", kind: "macro" },
  { theme: "PCE",                     re: "\\bpce\\b",                                                                             topics: ["core-pce"], q: "PCE", kind: "macro" },
  { theme: "Jobs / payrolls",         re: "\\b(payrolls?|nonfarm|non-farm|jobs report|unemployment( rate)?|jobless claims)\\b",   topics: [], q: "unemployment", kind: "macro" },
  { theme: "GDP / recession",         re: "\\b(gdp|recession)\\b",                                                                 topics: ["gdp-2026", "recession-2026", "recession-2027"], q: "recession", kind: "macro" },
  { theme: "Treasury yields",         re: "\\b(treasur(y|ies)|10-year|10 year|2-year|30-year|bond yields?|yields?)\\b",            topics: ["ust10-2026", "ust30-2026"], q: "10-year Treasury yield", kind: "instrument" },
  { theme: "S&P / stocks",            re: "\\b(s&p ?500|spx|spy|nasdaq|dow jones|stock market)\\b",                                topics: ["spx-2026", "spy-month", "largest-company"], q: "S&P 500", kind: "instrument" },
  { theme: "Gold",                    re: "\\bgold\\b",                                                                            topics: ["gold-month"], q: "gold", kind: "instrument" },
  { theme: "Oil / OPEC",              re: "\\b(oil|crude|opec|brent|wti)\\b",                                                      topics: ["wti-month", "oil-ath", "opec-exit", "hormuz"], q: "oil", kind: "instrument" },
  { theme: "Iran",                    re: "\\b(iran|iranian|hormuz|tehran)\\b",                                                    topics: ["iran-us-ceasefire", "iran-israel-ceasefire", "iran-blockade", "iran-invasion", "iran-nuclear-deal"], q: "Iran", kind: "macro" },
  { theme: "China / Taiwan",          re: "\\b(china|chinese|taiwan|beijing|tsmc)\\b",                                             topics: ["taiwan-invade", "taiwan-blockade", "taiwan-clash"], q: "China Taiwan", kind: "macro" },
  { theme: "Tariffs / trade",         re: "\\b(tariffs?|trade (deal|war|talks))\\b",                                               topics: ["china-tariff", "trade-deals", "effective-tariff"], q: "tariff", kind: "macro" },
  { theme: "Russia / Ukraine",        re: "\\b(russia|russian|ukraine|putin|kremlin|nato)\\b",                                     topics: ["ukraine-ceasefire", "ukraine-talks", "nato-russia", "putin-out"], q: "Ukraine ceasefire", kind: "macro" },
  { theme: "Elections / midterms",    re: "\\b(midterms?|election|senate|house (race|seat|majority)|congress)\\b",                 topics: ["house-2026", "senate-2026", "congress-2026"], q: "midterms", kind: "macro" },
  { theme: "Shutdown",                re: "\\bgovernment shutdown\\b|\\bshutdown\\b",                                               topics: ["shutdown"], q: "government shutdown", kind: "macro" },
  { theme: "Washington / debt",       re: "\\b(debt ceiling|national debt|credit rating|moody's|fitch|downgrade of (the )?u\\.?s\\.?)\\b", topics: ["us-debt"], q: "US credit rating", kind: "macro" },
  { theme: "AI bubble / data centres",re: "\\b(ai bubble|data cent(er|re)s?|ai (capex|spending|infrastructure)|artificial intelligence)\\b", topics: ["ai-bubble", "ai-regulation"], q: "AI", kind: "macro" },
  { theme: "ECB / Europe",            re: "\\b(ecb|lagarde|european central bank|euro ?zone)\\b",                                  topics: ["ecb-next"], q: "ECB", kind: "macro" },
  { theme: "Yen / BoJ",               re: "\\b(yen|boj|bank of japan|carry trade|usd\\/jpy)\\b",                                   topics: ["boj-next", "boj-after", "usdjpy-2026"], q: "Bank of Japan", kind: "macro" },
  { theme: "Bitcoin / crypto",        re: "\\b(bitcoin|btc|crypto|stablecoins?)\\b",                                               topics: [], q: "Bitcoin", kind: "instrument" },
  { theme: "Ethereum",                re: "\\b(ethereum|ether|eth)\\b",                                                            topics: [], q: "Ethereum", kind: "instrument" },
  /* counted, never proposed: company actions have no macro market as a class */
  { theme: "Earnings",                re: "\\b(earnings|eps|quarterly results|q[1-4] (results|report))\\b",                        topics: [], q: null, kind: "company" },
  { theme: "Price target",            re: "\\b(price target|upgrades?d?|downgrades?d?)\\b",                                       topics: [], q: null, kind: "company" },
  { theme: "IPO / lock-up",           re: "\\b(ipo|lock-?ups?)\\b",                                                                topics: [], q: null, kind: "company" },
  { theme: "Offering / dilution",     re: "\\b(offering|dilution|convertible notes?|secondary)\\b",                                topics: [], q: null, kind: "company" },
];

/* the exclusion rule as data: a market is left out when a tag or its title says one of these */
export const EXCLUDE_TAGS = ["sports", "esports", "games", "soccer", "tennis", "nfl (all)", "nba", "mlb", "nhl", "basketball", "baseball", "football",
  "hockey", "golf", "cricket", "ufc", "f1", "boxing", "cfb (all)", "weather", "daily temperature", "highest temperature", "tweet markets", "mentions",
  "pop culture", "celebrities", "awards", "movies", "music"];
export const EXCLUDE_TITLE = /\b(temperature|weather|tweets?|nobel|aliens?|oscars?|grammys?|ballon d'or|celebrity|vs\.)\b/i;

export function exclusionReason(ev) {
  const tags = (ev && ev.tags || []).map((t) => String((t && t.label) || t || "").toLowerCase());
  const hit = tags.find((t) => EXCLUDE_TAGS.includes(t));
  if (hit) return "tag " + JSON.stringify(hit);
  const m = EXCLUDE_TITLE.exec(String((ev && ev.title) || ""));
  if (m) return "title says " + JSON.stringify(m[0]);
  if (ev && (ev.closed === true || ev.active === false)) return "closed";
  return null;
}

/* headlines per theme: {theme → {n, distinct}} over the titles given (one regular expression each) */
export function countThemes(titles) {
  const out = {};
  const res = THEMES.map((t) => ({ t, rx: new RegExp(t.re, "i"), seen: new Set() }));
  for (const t of THEMES) out[t.theme] = { n: 0, distinct: 0 };
  for (const raw of titles || []) {
    const s = String(raw == null ? "" : raw);
    if (!s) continue;
    const key = s.trim().toLowerCase();
    for (const r of res) if (r.rx.test(s)) { out[r.t.theme].n++; if (!r.seen.has(key)) { r.seen.add(key); out[r.t.theme].distinct++; } }
  }
  return out;
}

/* the best open market for a theme from Polymarket's public search: the first one that passes the exclusion rule,
   by 24-hour volume; a market in a series is preferred (it rolls to the next question by itself) */
export function bestMarket(events) {
  const ok = (events || []).map((ev) => ({ ev, why: exclusionReason(ev) })).filter((x) => !x.why).map((x) => x.ev);
  ok.sort((a, b) => (Number(b.volume24hr) || 0) - (Number(a.volume24hr) || 0));
  const withSeries = ok.filter((e) => Array.isArray(e.series) && e.series.length);
  const pick = (withSeries.length ? withSeries : ok)[0];
  if (!pick) return null;
  const series = Array.isArray(pick.series) && pick.series[0] ? String(pick.series[0].id || pick.series[0]) : null;
  return { event_id: String(pick.id), title: String(pick.title || ""), series_id: series, volume_24h: Number(pick.volume24hr) || null,
    slug: pick.slug ? String(pick.slug) : null, end_date: pick.endDate || null };
}

/* THE PROPOSALS. counts: countThemes() · registryIds: every topic id in topics.json · liveTopics: topic ids with a row
   in prediction_market_latest · searches: {theme → events[] from public search} · runId/ts: stamped on every row */
export function propose({ counts, registryIds, liveTopics, searches, runId, ts, registryTopics, kalshiOn }) {
  const reg = new Set(registryIds || []), live = new Set(liveTopics || []);
  const rows = [];
  const noVenue = new Set();                                                       // Kalshi-only topics while Kalshi is off
  if (!kalshiOn) for (const t of registryTopics || []) {
    const pm = (t && t.polymarket) || {};
    if (!((pm.events || []).length) && !pm.roll) noVenue.add(t.id);
  }
  for (const t of THEMES) {
    const c = (counts && counts[t.theme]) || { n: 0, distinct: 0 };
    const tracked = t.topics.filter((id) => reg.has(id));
    if (t.kind === "company") continue;                                            // counted, never proposed (rule 5)
    if (c.n >= ADD_MIN_7D && !tracked.length) {
      const evs = (searches && searches[t.theme]) || [];
      const best = bestMarket(evs);
      const left = evs.map((ev) => exclusionReason(ev)).filter(Boolean);
      if (best) rows.push({ run_id: runId, ts, kind: "add", theme: t.theme, topic: null, headline_7d: c.n, distinct_7d: c.distinct,
        market_title: best.title, event_id: best.event_id, series_id: best.series_id, volume_24h: best.volume_24h, status: "proposed",
        why: c.n + " headlines in 7 days (" + c.distinct + " distinct) say " + t.theme + ", no topic tracks it, and Polymarket has an open market: “" + best.title + "”" +
          (best.series_id ? " (in a series, so it rolls to the next question by itself)" : " (a one-off question: it will need a successor when it ends)") +
          (left.length ? " · " + left.length + " other search hit" + (left.length === 1 ? "" : "s") + " left out by the exclusion rule" : "") });
      else rows.push({ run_id: runId, ts, kind: "add", theme: t.theme, topic: null, headline_7d: c.n, distinct_7d: c.distinct, market_title: null, event_id: null,
        series_id: null, volume_24h: null, status: "no-market",
        why: c.n + " headlines in 7 days say " + t.theme + " and no topic tracks it, but Polymarket's public search found no open market that passes the exclusion rule" +
          (left.length ? " (" + left.length + " hit" + (left.length === 1 ? "" : "s") + " left out)" : "") + " — nothing to add yet" });
    }
    for (const id of tracked) if (noVenue.has(id) && !live.has(id)) rows.push({ run_id: runId, ts, kind: "remove", theme: t.theme, topic: id,
      headline_7d: c.n, distinct_7d: c.distinct, market_title: null, event_id: null, series_id: null, volume_24h: null, status: "proposed",
      why: "\u201c" + id + "\u201d maps to no Polymarket market (Kalshi only) and Kalshi is off, so it can never have a reading \u2014 " + c.n + " headline" + (c.n === 1 ? "" : "s") + " in 7 days say " + t.theme + " either way" });
    if (c.n < QUIET_MAX_7D) for (const id of tracked) if (!live.has(id) && !noVenue.has(id)) rows.push({ run_id: runId, ts, kind: "remove", theme: t.theme, topic: id,
      headline_7d: c.n, distinct_7d: c.distinct, market_title: null, event_id: null, series_id: null, volume_24h: null, status: "proposed",
      why: "only " + c.n + " headline" + (c.n === 1 ? "" : "s") + " in 7 days say " + t.theme + ", and “" + id + "” has had no live market reading in the last " + LIVE_HOURS + " hours" });
  }
  return rows;
}

/* the heavy themes without a topic — the ones the caller must search Polymarket for */
export function themesToSearch(counts, registryIds) {
  const reg = new Set(registryIds || []);
  return THEMES.filter((t) => t.kind !== "company" && t.q && !t.topics.some((id) => reg.has(id)) && ((counts[t.theme] || {}).n || 0) >= ADD_MIN_7D);
}
export const SEARCH_URL = (q) => "https://gamma-api.polymarket.com/public-search?q=" + encodeURIComponent(q) + "&limit_per_type=12&events_status=active";
