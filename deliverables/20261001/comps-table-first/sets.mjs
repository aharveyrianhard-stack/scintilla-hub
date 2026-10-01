/* Scintilla · comps, table first (C3b, 1 Oct) · THE PEER SET IS A SWITCH.
   Four sets for one company, resolved from the Hub's own tables and read once each:
     TIGHTEST  the smallest theme or industry tag the company carries that holds at least MIN_SET names (size tags never
               count: MEGA_CAP, LARGE_CAP, BLUE_CHIP… are buckets, not comps). The default.
     HOME      the cohort the board files the company under (tickers.cohort) — a 43-name hardware bucket for TSM.
     FMP       FMP's own peer list (public.fmp_peers, filled by scripts/fmp-peers-sync.mjs on Fly); "not on hand" until then.
     LARGEST   the July 2026 demo's rule (FMP_CAPABILITY_DEMO.html): the 7 largest members of the home cohort by market
               value, re-derived every time. Offered only when it differs from the other sets.
   The read of a set's figures is C3's (deliverables/20261001/comps-template/cohort.mjs → readCohort), given the members. */
import { readCohort as readByCohort, snapshotFromCohort } from "../comps-template/cohort.mjs";
import { buildInputs, num } from "../../20260927/comps-r3/r3.mjs";
export { snapshotFromCohort };

export const SIZE_TAGS = new Set(["MEGA_CAP", "MEGACAP", "LARGE_CAP", "MID_CAP", "SMALL_CAP", "BLUE_CHIP", "INDEXES", "MACRO"]);
export const MIN_SET = 5;          // a set needs the company plus at least four others to carry a middle half
export const LARGEST_N = 7;        // the demo's cap
export const SET_WORDS = {
  TIGHTEST: { name: "tightest tag", plain: "the smallest theme or industry tag the company carries with at least five names" },
  HOME: { name: "home cohort", plain: "the cohort the board files the company under" },
  FMP: { name: "FMP peers", plain: "FMP's own peer list for the company" },
  LARGEST: { name: "largest 7", plain: "the seven largest members of the home cohort by market value (the July demo's rule)" },
};

/** Pure: pick the tightest tag from [{tag, size}]. */
export function tightestTag(tags, home) {
  const ok = tags.filter((t) => !SIZE_TAGS.has(t.tag) && t.size >= MIN_SET).sort((a, b) => a.size - b.size || a.tag.localeCompare(b.tag));
  return ok.length ? ok[0].tag : home || null;
}

/** Resolve the four sets for one company: members per set, counts, and why a set is missing. */
export async function resolveSets({ ticker, pg }) {
  const T = String(ticker).toUpperCase();
  const [own, home, fmp] = await Promise.all([
    pg(`ticker_cohorts?select=cohort&ticker=eq.${encodeURIComponent(T)}`),
    pg(`tickers?select=cohort&ticker=eq.${encodeURIComponent(T)}`).catch(() => []),
    pg(`fmp_peers?select=peer,position,fetched_at&ticker=eq.${encodeURIComponent(T)}&order=position.asc`).catch(() => null),
  ]);
  const tagNames = [...new Set(own.map((x) => String(x.cohort).toUpperCase()))];
  const homeCohort = home && home[0] && home[0].cohort ? String(home[0].cohort).toUpperCase() : null;
  const need = [...new Set([...tagNames, homeCohort].filter(Boolean))];
  const memberLists = await Promise.all(need.map((c) => pg(`ticker_cohorts?select=ticker&cohort=eq.${encodeURIComponent(c)}&order=ticker.asc`).then((r) => [c, [...new Set(r.map((x) => String(x.ticker).toUpperCase()))]])));
  const members = Object.fromEntries(memberLists);
  const tags = tagNames.map((tag) => ({ tag, size: (members[tag] || []).length, size_tag: SIZE_TAGS.has(tag) }));
  const tight = tightestTag(tags, homeCohort);
  const served = new Set(Object.values(members).flat());
  const sets = [];
  if (tight) sets.push({ key: "TIGHTEST", label: tight, members: members[tight] || [], source: `ticker_cohorts tag ${tight}, ${(members[tight] || []).length} names` });
  if (homeCohort) sets.push({ key: "HOME", label: homeCohort, members: members[homeCohort] || [], source: `tickers.cohort = ${homeCohort}, ${(members[homeCohort] || []).length} names` });
  if (fmp === null) sets.push({ key: "FMP", label: "FMP peers", members: [], missing: "not on hand: public.fmp_peers does not exist yet (migration 20261001_fmp_peers.sql + scripts/fmp-peers-sync.mjs)" });
  else if (!fmp.length) sets.push({ key: "FMP", label: "FMP peers", members: [], missing: "not on hand: fmp_peers holds no row for this company yet (run scripts/fmp-peers-sync.mjs)" });
  else {
    const peers = fmp.map((r) => String(r.peer).toUpperCase());
    const onHub = peers.filter((p) => served.has(p)), off = peers.filter((p) => !served.has(p));
    sets.push({ key: "FMP", label: "FMP peers", members: [T, ...onHub], all_peers: peers, off_hub: off, fetched_at: fmp[0].fetched_at || null, source: `FMP stock_peers, ${peers.length} names, ${onHub.length} served on the Hub${off.length ? " (" + off.join(", ") + " not served)" : ""}` });
  }
  if (homeCohort) sets.push({ key: "LARGEST", label: `largest ${LARGEST_N} of ${homeCohort}`, members: null, source: `the ${LARGEST_N} largest of ${homeCohort} by market value (re-derived)`, from: homeCohort });
  return { ticker: T, tags, home: homeCohort, tightest: tight, sets, members };
}

/** Read one set: the figures for its members through C3's reader (currency conversion included). For LARGEST the
    members are picked by market value from the home cohort's read. */
export async function readSet({ ticker, set, sets, today, pg, quotes, livePrices = {}, fxStandin = null, cache = new Map() }) {
  const T = String(ticker).toUpperCase();
  const s = sets.sets.find((x) => x.key === set) || sets.sets[0];
  if (!s || s.missing) throw new Error(s ? s.missing : "no peer set");
  const readMembers = async (list, label, source) => {
    const key = list.slice().sort().join(",");
    if (cache.has(key)) return { ...cache.get(key), set: s.key, set_label: label, peer_source: source };
    const ctx = await readByCohort({ ticker: T, cohortAsked: null, today, pg, quotes, livePrices, fxStandin, membersAsked: list, labelAsked: label });
    cache.set(key, ctx);
    return { ...ctx, set: s.key, set_label: label, peer_source: source };
  };
  if (s.key !== "LARGEST") return readMembers(s.members, s.label, s.source);
  const homeSet = sets.sets.find((x) => x.key === "HOME");
  const homeCtx = await readMembers(homeSet.members, homeSet.label, homeSet.source);
  const ranked = homeCtx.inputs.filter((i) => i.ticker !== T && !i.is_etf && i.mcap > 0).sort((a, b) => b.mcap - a.mcap).slice(0, LARGEST_N).map((i) => i.ticker);
  s.members = [T, ...ranked];
  const sub = { ...homeCtx, members: [T, ...ranked], inputs: homeCtx.inputs.filter((i) => [T, ...ranked].includes(i.ticker)), excluded: homeCtx.excluded.filter((e) => [T, ...ranked].includes(e.ticker)), set: "LARGEST", set_label: s.label, peer_source: s.source, cohort: s.label, cohort_options: homeCtx.cohort_options };
  return sub;
}

/** Does the LARGEST set differ from the others? (pure) */
export function largestDiffers(sets) {
  const L = sets.sets.find((x) => x.key === "LARGEST"); if (!L || !L.members) return false;
  const key = (m) => m.slice().sort().join(",");
  return !sets.sets.some((x) => x.key !== "LARGEST" && x.members && x.members.length && key(x.members) === key(L.members));
}
