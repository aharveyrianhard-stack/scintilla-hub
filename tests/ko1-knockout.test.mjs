/* The knockout over the whole universe (7 Oct · deliverables/20261007/knockout): every company with figures through
   the same three rounds — where to look, what on fundamentals, when — so the result does not start from Alan's lists.
   Tested here: the table stand-in the comps run reads through, the rules of each round together with the rules they
   lean on (the knockout's own quartile ramp and tie rule, the allocation tool's turn, the comps system's own flags, the
   estimates-versus-guidance study's one-off thresholds, the confluence study's 1% zone), the saved result re-derived
   from its own readings, and the page.
   Offline: the committed result (data/knockout.json), two small fixtures, the comps fix's own run. The rules are
   Python (tools/rounds.py, fundamentals.py, timing.py), called through tools/rules-cli.py; those tests are skipped
   where python3 with numpy is not installed. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { localPg } from "../deliverables/20261007/knockout/tools/local-pg.mjs";
import { CP1_DEFAULT, CP1_LINES_OFF } from "../deliverables/20261003/comps-c5/lines.mjs";
import { LIVE_FX } from "../deliverables/20261005/comps-c6/outliers.mjs";   /* RL1 (7 Oct): the switches the Hub's COMPS tab prices on */

const here = (p) => new URL(p, import.meta.url), J = (p) => JSON.parse(readFileSync(here(p), "utf8"));
const DIR = "../deliverables/20261007/knockout/", K = J(DIR + "data/knockout.json"), N = K.names, B = K.branches, F = K.funnel;
const CLI = fileURLToPath(here(DIR + "tools/rules-cli.py"));
const hasPy = spawnSync("python3", ["-c", "import numpy"], { encoding: "utf8" }).status === 0, PY = { skip: !hasPy && "python3 with numpy is not available" };
const py = (...calls) => { const r = spawnSync("python3", [CLI], { input: JSON.stringify({ calls }), encoding: "utf8", maxBuffer: 64e6 }); if (r.status !== 0) throw new Error(r.stderr.slice(-600)); return JSON.parse(r.stdout); };
const near = (a, b, eps, msg) => assert.ok(a != null && Math.abs(a - b) <= eps, `${msg || ""} ${a} vs ${b}`);
const LISTS = new Set([...K.lists.RADAR, ...K.lists.FAVORITES, ...K.lists.LIKED]);

/* ---- the table stand-in: one snapshot, answered the way the tables answer ---------------------------------- */
test("the stand-in answers the comps reader's query shapes and refuses what it cannot answer", async () => {
  const rows = [{ ticker: "B", fiscal_date: "2026-06-30", period: "Q2", v: 2 }, { ticker: "A", fiscal_date: "2026-03-31", period: "Q1", v: null }, { ticker: "A", fiscal_date: "2026-06-30", period: "FY", v: 5 }, { ticker: "C", fiscal_date: "2025-12-31", period: "FY", v: 1 }];
  const count = {}, pg = localPg({ t: rows }, { floors: { t: { fiscal_date: "2025-12-31" } }, counter: count });
  assert.deepEqual((await pg("t?select=ticker&ticker=in.(A,B)&order=ticker.asc,fiscal_date.desc")).map((r) => r.ticker), ["A", "A", "B"]);
  assert.deepEqual((await pg("t?select=ticker,fiscal_date&ticker=eq.A&order=fiscal_date.desc"))[0], { ticker: "A", fiscal_date: "2026-06-30" }, "select keeps only the columns asked for");
  assert.equal((await pg("t?select=*&fiscal_date=gte.2026-01-01")).length, 3);
  assert.equal((await pg("t?select=*&period=eq.FY&fiscal_date=gte.2026-01-01")).length, 1);
  assert.deepEqual((await pg("t?select=ticker&order=ticker.asc&limit=2&offset=1")).map((r) => r.ticker), ["A", "B"], "limit and offset page the way the tables do");
  assert.deepEqual((await pg("t?select=v&order=v.asc")).map((r) => r.v), [1, 2, 5, null], "ascending: nothing-on-file last");
  assert.deepEqual((await pg("t?select=v&order=v.desc")).map((r) => r.v), [null, 5, 2, 1], "descending: nothing-on-file first");
  assert.equal(count.t, 7, "every read is counted");
  await assert.rejects(pg("nope?select=*"), /not in the snapshot/);
  await assert.rejects(pg("t?select=*&ticker=like.A*"), /not one this stand-in answers/);
  await assert.rejects(pg("t?select=missing"), /not in the snapshot/);
  await assert.rejects(pg("t?select=*&fiscal_date=gte.2020-01-01"), /the snapshot starts at/, "a read that reaches under the snapshot's own floor is refused, never answered short");
});

/* ---- the comps run: the comps fix, switched on for the run only, nothing dropped --------------------------- */
/* RL1 (7 Oct) — re-pinned on purpose. Alan approved the same-business pricing and the debt steps; the knockout was re-run on
   them (KO1_FX=cp3, the one forward basis, KO1_DEBT=1) and the Hub's COMPS tab now prices on the same switches (LIVE_FX).
   As first published this test read: "the comps system is still switched off for the Hub", twelve switches. */
test("the knockout's comps run and the Hub's COMPS tab are on the same switches: every one on, the fourteen of LIVE_FX; a caller that passes nothing still gets them off", () => {
  assert.equal(CP1_DEFAULT, CP1_LINES_OFF, "the bare default line is untouched: the reports, the tools and the older tests answer as before");
  assert.ok(Object.values(K.checks.comps_switches).every((v) => v === true), "every switch on for the run");
  assert.deepEqual(Object.keys(K.checks.comps_switches).sort(), Object.keys(LIVE_FX).sort(), "the run's switches are the tab's");
  assert.equal(Object.keys(K.checks.comps_switches).length, 14);
});
/* RL1 (7 Oct) — re-pinned on purpose: the knockout's comps are the RE-PRICED CARDS' own (one forward basis, same-business
   peers), no longer the 6 Oct comps fix's (Micron +98.8% on three US-listed peers, which CP3 showed does not stand). */
test("the comps numbers are the re-priced cards' own: all 27 come out the same — forward P/E, centre and upside — and Micron is priced on six memory and storage makers", () => {
  const cards = J("../deliverables/20261007/one-basis/data/cards.json").cards;
  let same = 0; const off = [];
  for (const [t, c] of Object.entries(cards)) { const n = N[t]; assert.ok(n, t + " was run"); const a = c.comps.centre != null ? c.comps.upside_pct : null;
    const centre = (n.comps_band || {}).centre ?? null, pe = c.fundamentals.fwd_pe != null ? Math.round(c.fundamentals.fwd_pe * 100) / 100 : null;
    if (n.comps === a && centre === (c.comps.centre ?? null) && n.comps_no_peer_set === (c.comps.centre == null) && (n.pe_fwd ?? null) === pe) same++; else off.push(t); }
  assert.equal(same, 27, "not equal: " + off.join(" "));
  assert.equal(N.MU.comps, 12.6); assert.equal(N.MU.comps_peers, 6); assert.equal(N.MU.comps_thin, false); assert.equal(N.MU.comps_priced_on, "business"); assert.equal(N.MU.comps_band.centre, 1177.05);
  assert.equal(N.BE.comps_no_peer_set, true); assert.equal(N.BE.comps, null);
  for (const t of ["EQIX", "DLR", "IRM"]) assert.equal(N[t].comps_peers, 2, t + " is priced on the other two data-centre landlords");
});
test("nothing is dropped silently: every name on file is run or counted with its reason, and the counts add up", () => {
  const skipped = Object.values(F.skipped).reduce((a, b) => a + b, 0);
  assert.equal(F.run_through_comps + skipped, F.profiles_on_file, "run + not run = every profile on file");
  assert.equal(F.run_through_comps, Object.keys(N).length);
  assert.equal(F.priced + F.no_peer_set + F.cannot_be_priced, F.run_through_comps, "priced + withheld + cannot be priced = run");
  assert.equal(F.sound + F.half_strength + F.not_used, F.run_through_comps, "every comps number is sound, half strength or not used");
  assert.equal(F.not_used, F.no_peer_set + F.cannot_be_priced + F.no_earnings_comps_not_used + F.thin_and_fragile, "the four reasons a comps number is not used");
  assert.equal(F.round2_pass + F.round2_fail + F.round2_not_judged, F.round1_in_a_branch); assert.equal(F.round3_now + F.round3_wait, F.round2_pass);
  for (const [t, why] of Object.entries(F.skipped_names)) assert.ok(why.length > 10, t + " carries its reason");
  assert.ok(F.skipped_names.QRVO && F.skipped_names.WBD, "the two names that stopped trading are named, not lost");
  for (const n of Object.values(N)) { assert.equal(n.comps_thin, n.comps != null && n.comps_peers < K.rules.thin_below, n.t + ": thin is fewer than four peers with figures"); if (n.comps_strength < 1) assert.ok(n.comps_words.length > 5, n.t + " says why its comps number is discounted"); }
});

/* ---- round 2's rules ------------------------------------------------------------------------------------- */
test("the vote: growth weighs most, the shares add to 100, and each reading is read against the branch's own middle half", PY, () => {
  const [w, c, q, r0, r1, rm, rh, rflat, rlow] = py(["weights", []], ["consts", []], ["quartiles", [[10, 20, 30, 40, 50]]], ["ramp", [20, { n: 5, q1: 20, med: 30, q3: 40 }]], ["ramp", [40, { n: 5, q1: 20, med: 30, q3: 40 }]],
    ["ramp", [null, { n: 5, q1: 20, med: 30, q3: 40 }]], ["ramp", [9999, { n: 5, q1: 20, med: 30, q3: 40 }]], ["ramp", [5, { n: 3, q1: 5, med: 5, q3: 5 }]], ["ramp", [20, { n: 5, q1: 20, med: 30, q3: 40 }, true]]);
  assert.equal(Object.values(w).reduce((a, b) => a + b, 0), 100);
  assert.ok(w.growth_next + w.growth_after > Math.max(w.comps, w.revisions, w.cash), "growth carries the largest share (Alan, 6 Oct)");
  assert.deepEqual(q, { n: 5, q1: 20, med: 30, q3: 40 }); assert.equal(r0, 0); assert.equal(r1, 1); assert.equal(rm, null, "a missing reading has no place: it counts as the middle in the score");
  assert.equal(rh, 1, "an extreme cannot win a branch by its size"); assert.equal(rflat, 0.5); assert.equal(rlow, 1);
  assert.equal(c.even, 0.02, "the knockout's own tie width"); assert.equal(c.hot, 70); assert.equal(c.top, 3); assert.equal(c.min_readings, 3, "a majority of the five readings");
});
test("how far a comps number is leaned on follows the comps system's own flags", PY, () => {
  const band = { lo: 1, centre: 2, hi: 3 }, base = { ok: true, band, eps_ttm: 2, eps_fy1: 3, n_behind: 12, thin: false, fragile: null };
  const r = py(["comps_use", [base]], ["comps_use", [{ ...base, thin: true, n_behind: 3 }]], ["comps_use", [{ ...base, fragile: { n: 2, of: 12 } }]], ["comps_use", [{ ...base, thin: true, n_behind: 2, fragile: { n: 2, of: 8 } }]],
    ["comps_use", [{ ...base, band: null, no_peer_set: true }]], ["comps_use", [{ ...base, band: null, reason: "no measure can be priced" }]], ["comps_use", [{ ...base, eps_ttm: -1, eps_fy1: -2 }]], ["comps_use", [{ ...base, eps_ttm: -1, eps_fy1: 0.5 }]]);
  assert.deepEqual(r.map((x) => x[0]), [1, 0.5, 0.5, 0, 0, 0, 0, 1], "sound · thin · fragile · both · withheld · cannot be priced · no earnings · turning profitable");
  assert.match(r[1][1], /thin: 3 peers/); assert.match(r[4][1], /no peer set/); assert.match(r[6][1], /no earnings/);
});
test("inside a branch: the upper half passes, a missing reading is the middle, and an even pair is settled by who is more washed out", PY, () => {
  const m = (t, g, comps, extra = {}) => ({ t, g1_rev: g, g1_eps: g, g2_rev: g, g2_eps: g, comps, comps_strength: 1, revisions: g / 10, cash: 2, pctl: 50, ...extra });
  const [S] = py(["score_branch", [[m("A", 50, 40), m("B", 30, 20), m("C", 20, 10), m("D", 10, -10), m("E", 5, -30)]]]);
  assert.deepEqual(S.order, ["A", "B", "C", "D", "E"]); assert.deepEqual(S.finalists, ["A", "B", "C"], "five names: the upper half is three, the middle one included");
  assert.deepEqual(S.rows.filter((r) => r.passes).map((r) => r.t), ["A", "B", "C"]);
  const a = S.rows.find((r) => r.t === "A"); near(a.score, 0.25 * 1 + 0.15 * 1 + 0.30 * 1 + 0.15 * 1 + 0.15 * 0.5, 1e-9, "flat cash yield is the middle");
  /* a comps number not used counts as the middle; at half strength it is pulled halfway there */
  const [S2] = py(["score_branch", [[m("A", 50, 40, { comps_strength: 0 }), m("B", 30, 40, { comps_strength: 0.5 }), m("C", 20, 10), m("D", 10, -10)]]]);
  assert.equal(S2.rows.find((r) => r.t === "A").parts.comps, null); near(S2.rows.find((r) => r.t === "B").parts.comps, 0.75, 1e-9, "full marks at half strength = 0.75");
  /* the tie rule: within 0.02 the lower own-year percentile goes first — and then it is the one that passes */
  const [S3] = py(["score_branch", [[m("HOT", 30, 20, { pctl: 90 }), m("COLD", 30, 20, { pctl: 10, revisions: 2.9 }), m("X", 5, -30), m("Y", 4, -40)]]]);
  assert.ok(Math.abs(S3.rows.find((r) => r.t === "HOT").score - S3.rows.find((r) => r.t === "COLD").score) < 0.02);
  assert.deepEqual(S3.order.slice(0, 2), ["COLD", "HOT"]);
  /* fewer than three of the five readings, or sales under 1% of market value: not judged, never ranked, never passed */
  const [S4] = py(["score_branch", [[m("A", 50, 40), m("B", 30, 20), { t: "Z", g1_rev: null, g1_eps: null, g2_rev: null, g2_eps: null, comps: null, comps_strength: 0, revisions: 9, cash: 1, pctl: 5 }, m("V", 900, 90, { venture: true })]]]);
  for (const t of ["Z", "V"]) { const z = S4.rows.find((r) => r.t === t); assert.equal(z.judged, false, t); assert.equal(z.rank, null); assert.equal(z.passes, false); }
  assert.equal(S4.judged, 2); assert.deepEqual(S4.order, ["A", "B"], "the venture name's +900% does not enter the order"); assert.equal(S4.rows.find((r) => r.t === "Z").n, 2);
});
test("never across branches: a branch's scores are a function of that branch's own readings, and the saved result re-derives from them", PY, () => {
  /* RL1 (7 Oct): the saved result is the run WITH the debt steps (2.5 / 4 / 6 times, approved), so it is re-derived with them on;
     the row carries the debt readings the step takes. Without them the same names pass — debt never decides who passes. */
  const rowOf = (t) => ({ t, g1_rev: N[t].g1_rev, g1_eps: N[t].g1_eps, g2_rev: N[t].g2_rev, g2_eps: N[t].g2_eps, comps: N[t].comps, comps_strength: N[t].comps_strength, revisions: N[t].revisions, cash: N[t].cash, pctl: N[t].pctl, venture: N[t].venture,
    nd_ebitda: N[t].nd_ebitda, net_debt: N[t].net_debt, ebitda_ttm: N[t].ebitda_ttm, financial: N[t].financial });
  const ids = Object.keys(B), out = py(...ids.map((c) => ["score_branch", [B[c].run.map(rowOf), true]])), plain = py(...ids.map((c) => ["score_branch", [B[c].run.map(rowOf)]]));
  ids.forEach((c, i) => { assert.deepEqual(out[i].order, B[c].order, B[c].label); assert.deepEqual(out[i].finalists, B[c].finalists, B[c].label); assert.deepEqual(out[i].debt_moved || [], B[c].debt_moved || [], B[c].label + ": who debt moved");
    assert.deepEqual(out[i].rows.filter((r) => r.passes).map((r) => r.t).sort(), plain[i].rows.filter((r) => r.passes).map((r) => r.t).sort(), B[c].label + ": debt never decides who passes"); });
  assert.equal(ids.length, 63); assert.equal(ids.filter((c) => (B[c].debt_moved || []).length).length, 17, "debt reorders 17 of the 63 branches");
  /* the lists are not an input: no reading the score takes is a list, and re-scoring without them gives the same result (above) */
  assert.ok(!Object.keys(rowOf("MU")).some((k) => /list/i.test(k)));
});

/* ---- round 1 ----------------------------------------------------------------------------------------------- */
test("round 1 keeps every branch and ranks it on its own year and the allocation tool's turn", PY, () => {
  const [turn, R] = py(["turn", []], ["round1_rank", [[{ id: "cold-breakdown", pctl: 5, kind: "avoid" }, { id: "cold-bounce", pctl: 30, kind: "improve" }, { id: "hot-uptrend", pctl: 95, kind: "go" }, { id: "mid-pullback", pctl: 50, kind: "buy" }, { id: "new", pctl: null, kind: "go" }]]]);
  assert.deepEqual(turn, { improve: 1.35, go: 1, buy: 0.85, avoid: 0.6, none: 1 }, "the allocation tool's own multipliers (index.html: improving ×1.35 · leading ×1 · pullback ×0.85 · breakdown ×0.6)");
  assert.deepEqual(R.sort((a, b) => a.rank - b.rank).map((b) => b.id), ["cold-bounce", "cold-breakdown", "new", "mid-pullback", "hot-uptrend"], "cold and turning up first; hot last; nothing dropped");
  near(R.find((b) => b.id === "hot-uptrend").coldness, 0.05, 1e-9, "the tool's floor");
  const ranks = Object.values(B).map((b) => b.rank).sort((a, b) => a - b); assert.deepEqual(ranks, Array.from({ length: 63 }, (_, i) => i + 1), "63 branches, every rank once");
  assert.equal(Object.keys(K.sectors).length, 14); assert.deepEqual(Object.values(K.sectors).map((s) => s.rank).sort((a, b) => a - b), Array.from({ length: 14 }, (_, i) => i + 1));
  for (const b of Object.values(B)) { assert.ok(b.heat >= -1 && b.heat <= 1, b.label + " heat on −1…+1"); assert.ok(b.pctl == null || (b.pctl >= 0 && b.pctl <= 100)); near(b.raw, Math.max(0.05, 1 - b.pctl / 100) * turn[b.kind], 1e-9, b.label); }
  assert.ok(!Object.keys(B).some((c) => /^IDX_/.test(c)), "the index layer is funds: read as lines, never a branch of companies");
});

/* ---- growth on a clean base ------------------------------------------------------------------------------- */
test("the one-off rule keeps the study's thresholds and lands near its filing-based figures for Alphabet and Amazon", PY, () => {
  const fx = J(DIR + "data/fixture-one-off.json");
  const [rule, g, a] = py(["rule", []], ["year_one_offs", [fx.names.GOOGL.quarters.filter((q) => q.date > "2026-01-01"), fx.names.GOOGL.street, 20.61, fx.names.GOOGL.quarters]], ["year_one_offs", [fx.names.AMZN.quarters.filter((q) => q.date > "2026-01-01"), fx.names.AMZN.street, 12.77, fx.names.AMZN.quarters]]);
  assert.equal(rule.oneOffShareOfPretax, 0.25); assert.equal(rule.oneOffShareOfYear, 0.15); assert.equal(rule.basisBand, 0.10);
  assert.equal(g.basis, "GAAP"); assert.equal(g.flagged, true); near(g.one_off_ps, fx.study.GOOGL.one_off_per_share, 0.15 * fx.study.GOOGL.one_off_per_share, "Alphabet, within 15% of the study's 8.92"); near(g.clean, fx.study.GOOGL.clean_base, 1.0, "Alphabet clean base");
  assert.equal(a.basis, "GAAP"); assert.equal(a.flagged, true); near(a.one_off_ps, fx.study.AMZN.one_off_per_share, 0.15 * fx.study.AMZN.one_off_per_share, "Amazon, within 15% of the study's 4.91");
  assert.equal(g.quarters_marked.length, 2, "the two 2026 quarters, not the ordinary ones before them");
});
test("the one-off rule leaves a leveraged utility, a no-tax landlord and steady interest income alone, and never cleans a non-GAAP consensus", PY, () => {
  const q = (date, oi, ni, eps = ni / 100) => ({ date, eps_dil: eps, oi, ni, shares: 100 });
  const hist = (ratio) => Array.from({ length: 10 }, (_, i) => q("2024-0" + (i % 9 + 1) + "-28", 100, 100 * ratio));
  const street = (qs, k = 1) => Object.fromEntries(qs.map((x) => [x.date, x.eps_dil * k]));
  const year = (ratio, last) => [q("2026-03-31", 100, 100 * ratio), q("2026-06-30", 100, last)];
  const run = (ratio, last, k = 1) => { const y = year(ratio, last), h = [...hist(ratio), ...y]; return ["year_one_offs", [y, street(y, k), 4 * ratio, h]]; };
  const [utility, landlord, rich, gain, nongaap, loss] = py(run(0.55, 75), run(1.0, 104), run(1.2, 126), run(0.8, 260), run(0.8, 260, 0.5), ["one_off_quarter", [{ oi: 100, ni: -5, shares: 100 }, 0.8]]);
  assert.equal(utility.flagged, false, "interest takes its share: net income never passes operating income"); assert.equal(utility.quarters_marked.length, 0);
  assert.equal(landlord.flagged, false, "no tax, so net income is about operating income every quarter: usual for it"); assert.equal(rich.quarters_marked.length, 0, "steady interest income is its usual");
  assert.equal(gain.flagged, true); assert.equal(gain.quarters_marked.length, 1); near(gain.one_off_ps, (260 - 0.8 * 100) / 100, 1e-9, "the part above its own usual, already after tax");
  assert.equal(nongaap.basis, "NON-GAAP"); assert.equal(nongaap.flagged, false); assert.equal(nongaap.one_off_ps, 0); assert.ok(nongaap.gaap_one_off_ps > 0, "the gain is seen, and left outside a non-GAAP consensus");
  assert.deepEqual(loss, [false, 0, null], "a loss-making quarter carries no one-off gain");
});
test("growth is measured on one calendar and only from a base that can be grown from", PY, () => {
  const [cal, g, gl, dip, nodip, okb, lossb, dipb, flat, small] = py(["calendarize", [10, 20, 30, 40, 0.25]], ["growth", [22, 20]], ["growth", [5, -1]], ["dip_year", [7.28, 2.73, 9.47]], ["dip_year", [7.28, 6.5, 9.47]],
    ["base_ok", [[[0.25, 10, false], [0.75, 12, false]], 11.5, 100]], ["base_ok", [[[0.25, -2, false], [0.75, 12, false]], 8.5, 100]], ["base_ok", [[[0.25, 10, false], [0.75, 3, true]], 4.75, 100]], ["base_ok", [[[0.05, -2, false], [0.95, 12, false]], 11.3, 100]], ["base_ok", [[[0.25, 0.5, false], [0.75, 0.6, false]], 0.57, 100]]);
  assert.deepEqual(cal, [17.5, 27.5, 37.5], "a quarter of the year in progress still to run: last twelve months = ¼ last year + ¾ this year");
  near(g, 10, 1e-9); assert.equal(gl, null, "growth from a loss is not a rate");
  assert.equal(dip, true, "a year more than 40% under both neighbours is a one-off year"); assert.equal(nodip, false);
  assert.equal(okb[0], true); assert.equal(lossb[0], false); assert.match(lossb[1], /loss/); assert.equal(dipb[0], false); assert.match(dipb[1], /one-off year/);
  assert.equal(flat[0], true, "a year that counts for under a tenth of the base does not decide"); assert.equal(small[0], false); assert.match(small[1], /break-even/);
  /* in the saved result: the two the study worked through read up on the clean base, not down */
  for (const t of ["GOOGL", "AMZN"]) { assert.ok(N[t].one_off.length >= 1, t + " carries its one-off words"); assert.ok(N[t].g1_eps > 15 && N[t].g1_eps_as_shown < 0, `${t}: ${N[t].g1_eps_as_shown}% as shown, ${N[t].g1_eps}% clean`); }
  near(N.MU.g1_rev, 92, 1.5, "Micron's next twelve months, as its decision card has it"); near(N.MU.g1_eps, 109.5, 1.5, "Micron EPS");
  const venture = Object.values(N).filter((n) => n.venture); assert.ok(venture.length >= 10 && venture.length <= 25, venture.length + " venture names");
  for (const n of venture) { assert.ok(n.g1_rev == null && n.g2_rev == null, n.t + ": growth from so small a base is not ranked"); assert.equal(n.r2, null, n.t + " is not judged"); assert.match(n.verdict, /^not judged: sales under 1%/); assert.deepEqual(n.finalist_in, [], n.t + " is never a finalist"); }
  for (const t of ["OKLO", "QBTS", "ASTS", "ACHR"]) assert.equal(N[t].venture, true, t); for (const t of ["MU", "NBIS", "IREN", "CBRS", "RKLB"]) assert.equal(N[t].venture, false, t + " has sales to grow from");
});

/* ---- round 3 ----------------------------------------------------------------------------------------------- */
test("timing: the confluence study's 1% zone on the averages, the allocation tool's four-way read, and the own-year percentile", PY, () => {
  const mu = [{ label: "21-day", level: 1028.24 }, { label: "50-day", level: 961.81 }, { label: "100-day", level: 959.57 }, { label: "200-day", level: 689.87 }];
  const [z, none, chain, p, lead, pull, bounce, down, w0, w1, w2, w3] = py(["zones_of", [mu]], ["zones_of", [[{ label: "a", level: 100 }, { label: "b", level: 101.5 }]]], ["zones_of", [[{ label: "a", level: 100 }, { label: "b", level: 100.4 }, { label: "c", level: 101.2 }]]],
    ["pctl_of", [[-0.5, -0.2, 0.1, 0.3, 0.6], 0.2]], ["read_of", [0.4, 0.2]], ["read_of", [0.4, -0.1]], ["read_of", [-0.1, 0.2]], ["read_of", [-0.3, -0.2]], ["timing_word", [96]], ["timing_word", [70]], ["timing_word", [21]], ["timing_word", [null]]);
  assert.deepEqual(z, [{ low: 959.57, high: 961.81, members: ["100-day", "50-day"] }], "Micron's 50-day and 100-day, as the confluence study reads them");
  assert.deepEqual(none, [], "1.5% apart is not a zone"); assert.equal(chain.length, 1); assert.deepEqual(chain[0].members, ["a", "b"], "the top may be no more than 1% above the bottom: a chain is not a zone");
  assert.equal(p, 60); assert.deepEqual([lead.kind, pull.kind, bounce.kind, down.kind], ["go", "buy", "improve", "avoid"]);
  assert.match(w0, /wait/); assert.match(w1, /usual/, "the 70th itself is not above the 70th"); assert.match(w2, /washed out/); assert.match(w3, /no place/);
});
test("one more session ending at a chosen close: a daily bar from the last close, the intraday rungs walked there in as many bars as the last session had", PY, () => {
  const H = 3600e3, D = 86400e3, mon = Date.UTC(2026, 9, 5, 4), day = (i, c) => [mon + i * D, c, c + 1, c - 1, c];          // Mon 5 Oct 2026, stamped at midnight New York
  const daily = [day(0, 100), day(1, 102)], bars = (n, step) => Array.from({ length: n }, (_, i) => [mon + D + (4 + i * step) * H, 101, 103, 100, 102]);
  const [down, fri] = py(["sim_shape", [daily, { "180": bars(5, 3), "12h": bars(2, 6) }, 96.9]], ["sim_shape", [[day(3, 100), day(4, 102)], { "180": [[mon + 4 * D + 6 * H, 101, 103, 100, 102]] }, 110]]);
  assert.equal(down.D.added, 1); assert.equal(down.D.last_t, mon + 2 * D, "the next day"); assert.equal(down.D.last_close, 96.9); assert.equal(down.D.high, 102, "it opens at the last close"); assert.equal(down.D.low, 96.9);
  assert.equal(down["180"].added, 5); assert.equal(down["12h"].added, 2, "as many bars as the last session had"); assert.equal(down["180"].last_close, 96.9); assert.equal(down["180"].first_open, 102);
  assert.equal(fri.D.last_t, mon + 7 * D, "after a Friday the next session is Monday"); assert.equal(fri.D.high, 110); assert.equal(fri["180"].added, 1);
});
test("the replay behind every percentile equals the live Geiger, and the one-session cool-down is checked against what really happened", () => {
  const r = K.checks.replay, c = K.checks.cool;
  assert.ok(r.names >= 500 && r.equal_4dp / r.names > 0.9, `${r.equal_4dp} of ${r.names} names equal to four decimals`); assert.ok(r.max < 0.05, "largest gap " + r.max);
  assert.deepEqual(c.one_evening_equals_replay[0], c.one_evening_equals_replay[1], "one evening read alone = the whole replay's last evening, on every hot name");
  assert.ok(c.sessions > 1500 && c.median_gap < 0.03 && c.p90_gap < 0.1, JSON.stringify(c));
});
test("went green = above the 70th percentile of its own year: the seven Alan named are all there, each with its cool-down close and a named level", () => {
  assert.deepEqual(K.named_green, ["AVGO", "VST", "NBIS", "BE", "CRWV", "NVDA", "MSTR"]);
  for (const t of K.green) assert.ok(N[t].pctl > 70 && N[t].hot, t);
  for (const [t, n] of Object.entries(N)) assert.equal(K.green.includes(t), n.pctl != null && n.pctl > 70, t);
  for (const t of K.named_green) { const c = N[t].cool; assert.ok(c && c.price > 0 && c.price <= N[t].price && c.pct <= 0, t + " cools at or under its close"); assert.ok(c.near && c.near.label && c.near.level > 0, t + " has a named level by that close"); assert.ok(N[t].near_below && N[t].near_below.label, t); }
  assert.equal(N.AMZN.hot, false, "Amazon at its 70th is not above it");
  /* the Lab's labels, exactly: timeframe and id, never a bare P1 */
  const labels = Object.values(N).filter((n) => n.reviewed).flatMap((n) => [n.near_below, ...(n.above || []), n.cool && n.cool.near, ...(n.zone ? n.zone.members.map((l) => ({ label: l })) : [])]).filter(Boolean).map((x) => x.label);
  assert.ok(labels.length > 30); for (const l of labels) assert.match(l, /^(?:\d+-day|(?:1D|3D|1W|2W) [A-Z]\S*(?: \/ (?:1D|3D|1W|2W) [A-Z]\S*)?(?: · (?:LT|near 1W\/2W))?)$/, "label: " + l);
  assert.deepEqual(N.MU.zone.members, ["21-day", "2W D3", "3D P1"], "Micron's first zone under price, as agreed on 7 Oct"); near(N.MU.zone.low, 1028.24, 0.01); near(N.MU.zone.high, 1036.13, 0.01);
  assert.equal(Object.values(N).filter((n) => n.reviewed).length, 15, "the fifteen companies the Lab has reviewed");
});

/* ---- finalists, champions, and the loop opened --------------------------------------------------------------- */
test("finalists are the top three of a branch among those that passed round 2, and the champion is the first of them", () => {
  let slots = 0; const champs = new Set();
  for (const b of Object.values(B)) {
    if (!b.order.length) { assert.equal(b.champion, null); assert.deepEqual(b.finalists, []); assert.ok(b.run.every((t) => N[t].r2 === null || N[t].verdict_branches.some((c) => c !== b.id)), b.label + ": nothing in it can be judged"); continue; }
    assert.ok(b.finalists.length <= 3 && b.finalists.length >= 1, b.label); assert.equal(b.champion, b.finalists[0]); slots += b.finalists.length; champs.add(b.champion);
    assert.deepEqual(b.finalists, b.order.filter((t) => b.scores[t].passes).slice(0, 3), b.label);
    const judged = b.order.length; assert.equal(b.order.filter((t) => b.scores[t].passes).length, Math.ceil(judged / 2), b.label + ": the upper half, the middle name included");
    for (const r of b.finalist_rows) { assert.ok(r.why.length > 15, r.t + " says why"); assert.ok(r.buy.words.length > 8, r.t + " says where it would be bought"); }
    for (const [t, why] of Object.entries(b.not_run)) assert.ok(why.length > 8, `${t} in ${b.label} says why it was not run`);
  }
  assert.equal(slots, F.finalist_slots); assert.equal(champs.size, F.champions); assert.equal(K.champions.length, F.champion_slots);
  assert.deepEqual(Object.values(B).filter((b) => !b.champion).map((b) => b.label), ["QUANTUM"], "one branch has no name the fundamentals can judge, and says so instead of crowning one");
  assert.equal(B.MEMORY_STORAGE.champion, "MU"); assert.deepEqual(B.MEMORY_STORAGE.finalists.slice(0, 2), ["MU", "SNDK"]);
});
test("the loop is open: blind spots are on none of the lists, tunnel vision is on one, and neither list changes a score", () => {
  assert.ok(K.blind_spots.length > 50, "more than fifty finalists Alan does not track");
  for (const t of K.blind_spots) { assert.ok(!LISTS.has(t), t + " is on none of the lists"); assert.ok(N[t].finalist_where_it_counts.length >= 1 && N[t].r2 === true, t + " passed, in a branch its verdict rests on"); assert.deepEqual(N[t].lists, []); }
  /* a name that is top three only in a club by place or size, and fails its own business branch, is not offered as a blind spot */
  for (const [t, n] of Object.entries(N)) if (n.finalist_in.length && !n.finalist_where_it_counts.length) assert.ok(!K.blind_spots.includes(t) && n.finalist_in.every((c) => K.rules.region_or_size.includes(c)), t);
  for (const x of K.tunnel) { assert.ok(LISTS.has(x.t), x.t + " is on a list"); assert.ok(x.why.length > 10, x.t + " says why");
    if (x.round === 2) { assert.equal(N[x.t].r2, false); assert.ok(x.branch && x.rank > Math.ceil(x.of / 2), `${x.t} is in the lower half of ${x.branch}`); }
    if (x.round === null && N[x.t]) assert.match(x.why, /^not judged: /, x.t);
    if (x.round === 3) { assert.equal(N[x.t].r2, true); assert.equal(N[x.t].hot, true); } }
  const listed = [...LISTS], inTunnel = new Set(K.tunnel.map((x) => x.t));
  for (const t of listed) { const n = N[t]; assert.equal(inTunnel.has(t), !n || n.r2 !== true || n.hot, t + ": on the tunnel list exactly when it is not scored, not judged, fails round 2 or must wait"); }
  /* where the lists sit in round 1: every scored company of a list is in exactly one sector row, in round-1 order */
  assert.deepEqual(K.lists_by_sector.map((r) => r.rank), Array.from({ length: 14 }, (_, i) => i + 1));
  for (const k of ["RADAR", "FAVORITES", "LIKED"]) { const all = K.lists_by_sector.flatMap((r) => r[k]); assert.equal(new Set(all).size, all.length, k); assert.equal(all.length, K.list_read[k].companies_scored, k + ": every scored company has its sector"); }
  const last4 = K.lists_by_sector.slice(-4).reduce((a, r) => a + r.RADAR.length, 0), first4 = K.lists_by_sector.slice(0, 4).reduce((a, r) => a + r.RADAR.length, 0);
  assert.ok(last4 >= 12 && first4 <= 2, `the radar's tunnel: ${last4} of its companies in the four sectors ranked last, ${first4} in the four ranked first`);
  assert.deepEqual(K.lists_by_sector.find((r) => r.RADAR.includes("VST")).label, "ENERGY & POWER", "a name is counted in the sector of the branch where it stands best: Vistra with the power producers");
  for (const k of ["RADAR", "FAVORITES", "LIKED"]) { const r = K.list_read[k]; assert.equal(r.n, K.lists[k].length); assert.equal(r.companies_scored + r.not_scored.length, r.n, k); }
  assert.deepEqual(K.list_read.RADAR.fail_r2.sort(), ["GOOGL", "NFLX", "WDC", "WMT"], "the four radar names the fundamentals round does not support (RL1, 7 Oct: Alphabet joins them on the one basis — priced like its peers, growing half as fast)");
  assert.ok(K.list_read.RADAR.pass_both.includes("MU") && K.list_read.RADAR.pass_wait.includes("NVDA"));
});

/* ---- the page ----------------------------------------------------------------------------------------------- */
test("the page: pictures first, the numbers the data holds, no internal codes, the house greys, BACK / CLOSE in place", () => {
  const p = DIR + "KNOCKOUT.html"; assert.ok(existsSync(here(p))); const html = readFileSync(here(p), "utf8");
  const order = ["id=\"funnel\"", "id=\"lists\"", "id=\"round1\"", "id=\"champions\"", "id=\"blind\"", "id=\"tunnel\"", "id=\"green\"", "id=\"all\"", "id=\"notrun\"", "<details class=\"sc-pagespecs\""].map((s) => html.indexOf(s));
  assert.ok(order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])), "the funnel, the lists, round 1, the champions, the loop, every name, what was not run — then PAGE SPECS last");
  assert.match(html, /data-scnav-slot/); assert.match(html, /<!-- scnav · /); assert.match(html, /<!-- \/scnav -->\s*<\/body>/, "the BACK / CLOSE pair where the injector puts it");
  const text = html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ");
  assert.equal((text.match(/\b(?:CP1|ER1|CZ1|GH1|KO1|TR[123]|LB[12]|NQ1|C5b?|C6b?|PA6|AL7|HM1|R4)\b/g) || []).length, 0, "no internal codes in anything Alan reads");
  assert.ok(!/licensed advisor|not financial advice/i.test(text));
  for (const c of Object.keys(B)) assert.ok(!new RegExp("\\b" + c + "\\b").test(text) || !c.includes("_"), "a branch is named by its label, never its id: " + c);
  for (const n of [F.run_through_comps, F.round2_pass, F.round3_now, F.finalists, F.champions]) assert.ok(text.includes(String(n)), "the funnel shows " + n);
  assert.equal((html.match(/<tr data-k=/g) || []).length, Object.keys(N).length, "every company run has its row in EVERY NAME");
  assert.equal((html.split('id="champions"')[1].split("</section>")[0].split("<tbody>")[1].match(/<tr>/g) || []).length, 63, "one champion row a branch");
  /* explanatory sentences sit in PAGE SPECS, not in the panels: the specs hold the long prose */
  const specs = html.slice(html.indexOf("<details class=\"sc-pagespecs\""));
  assert.equal(new Set(html.match(/ id="[^"]+"/g)).size, html.match(/ id="[^"]+"/g).length, "no id is used twice"); for (const h of ["WHAT THIS PAGE SHOWS", "ROUND 1", "ROUND 2", "GROWTH ON A CLEAN BASE", "ROUND 3", "WHAT COULD BE WRONG", "WHAT WAS NOT DONE"]) assert.ok(specs.includes(h), h);
  /* every colour is a grey (channels within 24, none above 210) or one of the three the Hub already uses for direction and for Alan's tickers */
  const allowed = new Set(["#3caa6e", "#c85050", "#3cb4c8"]), css = html.slice(0, html.indexOf("</head>")) + html.slice(html.indexOf("<body"), html.indexOf("<!-- scnav · "));
  for (const hex of new Set((css.match(/#[0-9a-fA-F]{6}\b/g) || []).map((h) => h.toLowerCase()))) { if (allowed.has(hex)) continue; const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); assert.ok(Math.max(...c) - Math.min(...c) <= 24 && Math.max(...c) <= 210, "not a house grey: " + hex); }
  const facts = J(DIR + "shots/shots-facts.json");
  for (const w of ["1680", "390"]) { const f = facts[w]; assert.equal(f.sideways, false, w + ": no sideways scroll"); assert.ok(f.smallest_font_px >= 11, w + ": text 11px or more"); assert.equal(f.scnav, true); assert.deepEqual(f.page_errors, []); assert.equal(f.non_get_blocked, 0); assert.equal(f.requests_off_file, 0, "the page fetches nothing"); assert.equal(f.champion_rows, 63); }
});
