/* PG1 — the screens the nightly slowness-and-glitch review walks. Public pages only; nothing here needs a key.
   A screen is either a page address (`url`) or a step taken on the Hub after it has loaded (`hubTab`, `hubCompany`).
   `lighthouse: true` means the page also gets a Lighthouse run (only whole pages can — Lighthouse loads an address). */
export const HUB = "https://scintillahub.ai/";
export const STATION = "https://station.scintillahub.ai/";

export const HUB_TABS = ["DASHBOARD", "NEWS", "SOCIAL", "SENTIMENT", "ALERTS", "SCREENER", "EVENTS", "USUAL", "ECONOMIC"];
export const HUB_TAB_NAME = { DASHBOARD: "board", EVENTS: "earnings", USUAL: "usual day" };
/* three names: a large equity, the dotted ticker that froze the Hub on 5 Oct, and a coin */
export const COMPANIES = ["NVDA", "BRK-B", "BTCUSD"];

export const SCREENS = [
  ...HUB_TABS.map((sec) => ({
    id: "hub-" + sec.toLowerCase(),
    name: "Hub · " + (HUB_TAB_NAME[sec] || sec.toLowerCase()),
    hubTab: sec,
    url: HUB,
    lighthouse: sec === "DASHBOARD",
  })),
  ...COMPANIES.map((t) => ({
    id: "hub-company-" + t.toLowerCase(),
    name: "Hub · company view " + t,
    hubCompany: t,
    url: HUB,
  })),
  { id: "station-deck", name: "Station · deck", url: STATION, lighthouse: true },
  { id: "station-chart", name: "Station · chart", url: STATION + "chart/", lighthouse: true },
  { id: "allocation", name: "Allocation tool", url: "https://allocation.scintillahub.ai/", lighthouse: true },
  { id: "tree", name: "Tree preview", url: HUB + "deliverables/20260929/tree-map/", lighthouse: true },
];

/* When a number is bad enough to be listed (amber) or to turn the night red.
   Sources: Google's Core Web Vitals bands (web.dev/vitals — layout shift good <= 0.1, poor > 0.25;
   long task = 50 ms, per the W3C Long Tasks spec) and Lighthouse's own performance bands (50 / 90). */
export const LIMITS = {
  firstDataMs: { amber: 4000, red: 10000 },
  weightKB: { amber: 2000, red: 5000 },
  layoutShift: { amber: 0.1, red: 0.25 },
  longestFreezeMs: { amber: 200, red: 1000 },
  consoleErrors: { amber: 1, red: 25 },
  failedCalls: { amber: 1, red: 10 },
  placeholders: { amber: 5, red: 40 },
  blankPanels: { amber: 1, red: 4 },
  staleBadges: { amber: 1, red: 5 },
  staleBadgeAgeMin: 24 * 60,          // a badge counts as stale when the age the page prints is over a day
  picChangedPct: { amber: 25, red: 60 },
  lighthousePerf: { amber: 89, red: 49 },   // LOWER is worse: amber at <= 89, red at <= 49
};
