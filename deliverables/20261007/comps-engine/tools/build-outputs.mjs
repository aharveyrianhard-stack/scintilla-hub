/* CP4 · THE OTHER FILES EVERY SCREEN READS, derived from the artifact — never computed again here.
     data/cards.json            the decision cards: the one-basis cards' technicals, risk and plan kept; forward P/E, growth, PEG, the
                                comps block, debt, peers, channel and Geiger are the engine's reading, copied
     data/knockout-comps.json   the knockout's input (the shape of its comps-universe.json), from the artifact
     data/comps-readings.dryrun.sql   a table design and a dry run of its rows — NOT applied; for the coordinator to read
   Run from anywhere: node build-outputs.mjs */
import { readFileSync, writeFileSync, existsSync } from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), WT = path.resolve(HERE, "../../../.."), DATA = path.resolve(HERE, "../data");
const J = (p) => JSON.parse(readFileSync(p, "utf8")), IDX = J(DATA + "/comps.json"), full = (t) => J(`${DATA}/names/${t}.json`);
const OLD = J(WT + "/deliverables/20261007/one-basis/data/cards.json");
const inWords = (s) => String(s).replace(/000660\.KS/g, "SK hynix").replace(/005930\.KS/g, "Samsung").replace(/285A\.T/g, "Kioxia");
/* 1 · the cards */
const cardNames = [...new Set([...Object.keys(OLD.cards), ...IDX.twelve])].filter((t) => IDX.names[t] && IDX.names[t].ok);
const cards = { what: "the decision cards, every comps figure read from the one comps engine's artifact (CP4, 7 Oct 2026): the one-basis cards' technicals, risk and plan are kept; forward P/E, growth two ways, PEG, the comps range and its peers, the debt reading and discount, the long-term channel and the Geiger's own year are the engine's", as_of: { card_date: IDX.today, built_utc: new Date().toISOString(), engine_built_utc: IDX.built_utc, engine: IDX.version,
  /* CP5: the allocation tool reads every cards file it can reach and keeps the one with the newest card date, then the newest
     `repriced` stamp, then the first in its list. The morning's cards (one-basis) carry repriced "2026-10-07" and are served by the
     live Hub; without a stamp of their own the engine's cards LOST that tie-break and the tool's card table kept the morning's
     numbers beside a click-through that printed the engine's (found 7 Oct by looking at the tool's picture). The engine's cards
     are the newest re-pricing: they say so, to the second. */
  repriced: IDX.built_utc, basis: "next four quarters (the dashboard's forward P/E)" }, price_is: IDX.price_is, source: "/deliverables/20261007/comps-engine/data/comps.json and names/<TICKER>.json", cards: {} };
for (const t of cardNames) { const r = full(t), o = OLD.cards[t] || null, s = IDX.names[t];
  cards.cards[t] = { ticker: t, name: r.name, card_date: IDX.today, price: r.price, price_is: r.price_is, parents: o ? o.parents : [], cohorts: o ? o.cohorts : [], line: r.line, technicals: { ...((o && o.technicals) || {}), long_term_channel: r.channel.position_pct != null ? { position_pct: r.channel.position_pct, words: r.channel.words, source: (r.channel.lab || r.channel.computed || {}).source } : null, geiger_year: r.geiger && r.geiger.year ? r.geiger.year : null, geiger: r.geiger ? r.geiger.close : (o && o.technicals ? o.technicals.geiger : null), geiger_pctl_own_year: r.geiger ? r.geiger.pctl_close : (o && o.technicals ? o.technicals.geiger_pctl_own_year : null) }, risk: o ? o.risk : {}, plan: o ? o.plan : {},
    fundamentals: { ...((o && o.fundamentals) || {}), fwd_pe: r.forward.pe, fwd_pe_text: r.forward.text, fwd_pe_basis: r.forward.label, fwd_eps: r.forward.eps_usd, fwd_pe_was: { on_the_fiscal_year: r.forward.fiscal_year_pe }, eps_g_reported_to_next_four: r.growth.reported_to_next_pct, eps_g_following_year: r.growth.next_to_following_pct, rev_g_following_year: r.growth.revenue_following_pct, peg: r.peg.value, growth_words: r.growth.words, forward_flags: r.forward.flags, forward_rate: r.forward.rate, one_off: r.growth.one_off },
    comps: { priced_on: r.blend.priced_on, rule: r.sets.rule, peers_priced: r.sets.priced, n_priced: r.sets.priced.length, same_business: r.sets.same_business, adjacent: r.sets.adjacent, low: r.blend.low, centre: r.blend.centre, high: r.blend.high, upside_pct: r.blend.upside_pct, centre_before_debt: r.blend.centre_before_debt, upside_before_debt_pct: r.blend.upside_before_debt_pct, before: { live_as_it_stands: r.before.live_as_it_stands.upside_pct, cp3: r.before.cp3.upside_pct, card_on_the_fiscal_year: o && o.comps && o.comps.before ? o.comps.before.card_on_the_fiscal_year : null }, flags: r.flags.map(inWords), rows: r.yardsticks, weights: r.weights, growth_credit: r.blend.growth_credit, consistency: r.consistency, old_set: r.sets.old, cp3_set: r.sets.cp3, set: r.sets.now, reit: r.blend.reit, thin: r.blend.thin, fragile: r.blend.fragile,
      /* CP5: the one line that says the centre is not a target (or null), the outlier rule and its cases, the cap, the three readings side by side */
      not_a_target: r.not_a_target ? r.not_a_target.words : null, not_a_target_reasons: r.not_a_target ? r.not_a_target.reasons : [], centre_without_growth: r.blend.centre_without_growth, upside_without_growth_pct: r.blend.upside_without_growth_pct, outlier_rule: r.outlier_rule, outlier_cases: r.outlier_cases, left_out: r.sets.outliers, spared: r.sets.spared, seated: r.sets.seated, growth_cap_pct: r.peg.growth_cap_pct,
      side_by_side: { live: r.variants.A, outliers_only: r.variants.B, with_cap: r.variants.C, caps: Object.fromEntries(Object.entries(r.variants.caps).map(([c, v]) => [c, v ? { centre: v.centre, upside_pct: v.upside_pct } : null])) } },
    debt: r.debt, peers: r.peers.map((p) => ({ ticker: p.ticker, name: p.name, priced: p.priced, same_business: p.same_business, adjacent: p.adjacent, weight: p.weight, votes: p.votes, in_old_set: p.in_old_set, reference: p.reference, has_figures: p.has_figures, pe_fwd: p.pe_fwd ?? null, pe_fwd_text: p.pe_fwd_text || "—", pe_ttm: p.pe_ttm ?? null, ev_ebitda: p.ev_ebitda ?? null, peg: p.peg ?? null, growth_eps: p.growth_eps ?? null, om: p.om ?? null, net_debt_ebitda: p.debt ? p.debt.net_debt_ebitda : null, outlier: p.outlier, spared: !!p.spared, seat_line: p.seat_line || null, weight_share: p.weight_share ?? null })), engine: { version: IDX.version, built_utc: IDX.built_utc, file: `/deliverables/20261007/comps-engine/data/names/${t}.json` } }; }
writeFileSync(DATA + "/cards.json", JSON.stringify(cards));
/* 2 · the knockout's input, in the shape its tools read (comps-universe.json: meta, skipped, names → after) */
const KO = { meta: { run_utc: IDX.built_utc, today: IDX.today, price_is: IDX.price_is, comps_code: "the one comps engine (CP4, deliverables/20261007/comps-engine) — this file is derived from its artifact, nothing is computed here", forward: "next-four-quarters", counts: IDX.counts }, skipped: IDX.skipped, names: {} };
for (const [t, s] of Object.entries(IDX.names)) { if (!s.ok) { KO.names[t] = { ok: false, error: s.error || s.why || "not priced" }; continue; } const r = full(t);
  KO.names[t] = { ok: true, name: s.name, industry: s.industry, sector: s.sector, lines: s.line, line: String(s.line || "").split(" ")[0] ? s.line.split(" · ")[0].replace(/ \d+%$/, "") : null, set: r.peers.map((p) => ({ t: p.ticker, same: !!p.same_business, added: !!p.added_by_method, ref: !!p.reference, fig: p.has_figures !== false })),
    after: { ok: true, price: s.price, n_set: r.peers.length, n_behind: s.blend.n_behind, behind: r.blend.behind, thin: s.blend.thin, band: s.blend.centre != null ? { lo: s.blend.low, centre: s.blend.centre, hi: s.blend.high } : null, upside_pct: s.blend.upside_pct, no_peer_set: s.blend.no_peer_set, priced_on: s.blend.priced_on, fragile: s.blend.fragile ? { words: (s.flags.find((f) => /^FRAGILE/.test(f)) || "") } : null, outliers: r.sets.outliers, spared: r.sets.spared, not_a_target: r.not_a_target ? r.not_a_target.words : null, growth_cap_pct: r.peg.growth_cap_pct, growth_credit: r.blend.growth_credit && r.blend.growth_credit.credit > 1 ? r.blend.growth_credit.credit : null, sales_rows_off: r.blend.sales_rows_off, reit: r.blend.reit,
      rows: Object.fromEntries(Object.entries(r.yardsticks).map(([k, y]) => [k, { own: y.own, median: y.median, n: y.n, price: y.implied, weight: y.weight }])), own: { rev_g_ttm: r.growth.revenue_ttm_pct, rev_g_fy: r.growth.revenue_following_pct, eps_g_fy: r.growth.next_to_following_pct, nd_ebitda: r.debt.net_debt_ebitda }, debt_discount_pct: r.debt.discount.pct, pe_fwd: r.forward.pe, eps_fy1: r.forward.eps_usd, currency: s.currency },
    before: { ok: r.before.live_as_it_stands.upside_pct != null, upside_pct: r.before.live_as_it_stands.upside_pct } }; }
writeFileSync(DATA + "/knockout-comps.json", JSON.stringify(KO));
/* 3 · the table design, as a dry run */
const twelve = IDX.twelve.filter((t) => IDX.names[t] && IDX.names[t].ok).map((t) => { const s = IDX.names[t]; return `  ('${t}', '${IDX.today}', ${s.price}, ${s.forward.pe == null ? "null" : Number(s.forward.pe).toFixed(3)}, ${s.growth ?? "null"}, ${s.peg ?? "null"}, ${s.blend.low ?? "null"}, ${s.blend.centre ?? "null"}, ${s.blend.high ?? "null"}, ${s.blend.upside_pct ?? "null"}, '${s.blend.priced_on}', ${s.blend.n_behind}, ${s.blend.thin}, ${s.blend.fragile}, ${s.debt.discount_pct}, ${IDX.rule.growth_cap_pct ?? "null"}, ${s.not_a_target ? "'" + s.not_a_target.replace(/'/g, "''") + "'" : "null"}, '${JSON.stringify(s.outliers).replace(/'/g, "''")}'::jsonb, '${JSON.stringify(s.weights).replace(/'/g, "''")}'::jsonb, '${JSON.stringify(s.priced).replace(/'/g, "''")}'::jsonb, '${JSON.stringify(s.flags.slice(0, 6)).replace(/'/g, "''")}'::jsonb, '${IDX.version}', '${IDX.built_utc}')`; });
writeFileSync(DATA + "/comps-readings.dryrun.sql", `-- CP4 (7 Oct 2026) · A TABLE FOR THE ENGINE'S READINGS — A DRY RUN. NOT APPLIED. For the coordinator and Alan to read.
-- One row per name per day, written by the one comps engine and read by every screen (today they read the JSON artifact; a table
-- would let the Hub's PostgREST serve the same rows, keep a history, and let the knockout join on it). Additive: a new table, no row
-- of any existing table touched. The rollback is one line: drop table if exists public.comps_readings;
create table if not exists public.comps_readings (
  ticker            text        not null,
  as_of             date        not null,                 -- the close the reading is on
  price             numeric,                              -- that close
  fwd_pe            numeric,                              -- price ÷ the next four quarters of consensus EPS (lib/forward-basis.mjs)
  growth_pct        numeric,                              -- the four quarters after the next four ÷ the next four − 1
  peg               numeric,                              -- fwd_pe ÷ growth_pct
  low               numeric, centre numeric, high numeric,-- the blend, per share, after the debt discount
  upside_pct        numeric,                              -- centre ÷ price − 1
  priced_on         text,                                 -- 'blend' (same-business peers price, adjacent blend in) or 'set'
  n_behind          integer,                              -- peers whose figures the centre is built from
  thin              boolean, fragile boolean,
  debt_discount_pct numeric,
  growth_cap_pct    numeric,                              -- the growth the PEG yardstick counts up to, % a year (null = no cap)
  not_a_target      text,                                 -- the one plain line, when the centre must not be read as a target; else null
  peers_left_out    jsonb,                                -- the peers the expensive-only rule left out
  weights           jsonb,                                -- each yardstick's weight as printed
  peers_priced      jsonb,                                -- the tickers that price it
  flags             jsonb,                                -- the flags in words
  engine_version    text, built_utc timestamptz,
  primary key (ticker, as_of)
);
comment on table public.comps_readings is 'The one comps engine''s reading per name per day (deliverables/20261007/comps-engine). Every screen reads it; none computes its own.';
-- DRY RUN · the twelve names of 7 Oct as they would be inserted (${twelve.length} rows). Not executed.
-- insert into public.comps_readings (ticker, as_of, price, fwd_pe, growth_pct, peg, low, centre, high, upside_pct, priced_on, n_behind, thin, fragile, debt_discount_pct, growth_cap_pct, not_a_target, peers_left_out, weights, peers_priced, flags, engine_version, built_utc) values
${twelve.map((r) => "-- " + r).join(",\n")};
-- rollback: drop table if exists public.comps_readings;
`);
console.log("cards", Object.keys(cards.cards).length, "· knockout feed", Object.keys(KO.names).length, "· dry-run rows", twelve.length);
