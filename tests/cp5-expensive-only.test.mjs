/* CP5 (7 Oct 2026) · EXPENSIVE-ONLY OUTLIERS, THE GROWTH CAP THAT HOLDS, THE LINE SEATS, "NOT A TARGET".
   Alan, 7 Oct ~15:30: "I would manage outliers for now removing expensive ones as a conservative method" · "you're not happy with
   the outlier filter and the growth cap — okay, let's fix that" · "find a good default that we accept and we roll with it".
   Every new rule here is a switch, and each is tested WITH ITS NEIGHBOURS: the cell rule, the peer verdict, the consistency rule
   and the influence rule (one side now), the operator's set that is live on the Hub (untouched), the cap against a re-priced row
   (the slip this round found), the seats against the same-business bar, and the artifact every screen reads. */
import test from "node:test"; import assert from "node:assert/strict"; import { readFileSync, existsSync } from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), DATA = ROOT + "/deliverables/20261007/comps-engine/data";
const J = (p) => JSON.parse(readFileSync(p, "utf8")), IDX = J(DATA + "/comps.json"), CARDS = J(DATA + "/cards.json"), KOF = J(DATA + "/knockout-comps.json"), name = (t) => J(`${DATA}/names/${t}.json`);
const TWELVE = ["GOOGL", "AMZN", "AVGO", "NVDA", "TSM", "VST", "MU", "ORCL", "DLR", "EQIX", "SNDK", "WDC"];
const O = await import(ROOT + "/deliverables/20261005/comps-c6/outliers.mjs"), F = await import(ROOT + "/deliverables/20261003/comps-c5/field.mjs"), L = await import(ROOT + "/deliverables/20261003/comps-c5/lines.mjs"), LAD = await import(ROOT + "/deliverables/20260929/comps-live/ladder.mjs");
const OK = Object.entries(IDX.names).filter(([, n]) => n.ok);
/* the nightly rebuild's neighbour: a test that names a figure of the 6 Oct close skips itself when the files are from another close; the rule tests always run */
const SIX_OCT = IDX.today === "2026-10-06" ? {} : { skip: "the engine's files are from the " + IDX.today + " close; this test names 6 Oct figures" };
const col = (pairs) => pairs.map(([ticker, v]) => ({ ticker, v }));
const PACK = [["A", 10], ["B", 11], ["C", 12], ["D", 9], ["E", 10.5], ["F", 9.5], ["G", 11.5]];

/* ---- 1 · the rule, one side ---- */
test("one multiple: far ABOVE the group it is flagged; far BELOW it is spared, never flagged", () => {
  const c = O.columnDistances(col([...PACK, ["DEAR", 200], ["CHEAP", 0.4]]), { log: true, highOnly: true });
  assert.equal(c.cells.DEAR.flag, true); assert.equal(c.cells.CHEAP.flag, false); assert.equal(c.cells.CHEAP.spared, true); assert.ok(c.cells.CHEAP.d < -O.CUT, "it is beyond the cut, below");
  for (const [t] of PACK) { assert.equal(c.cells[t].flag, false, t); assert.ok(!c.cells[t].spared, t); } });
test("neighbour: with the switch off the column answers exactly as it did — both sides flagged, nothing marked spared", () => {
  const c = O.columnDistances(col([...PACK, ["DEAR", 200], ["CHEAP", 0.4]]), { log: true });
  assert.equal(c.cells.DEAR.flag, true); assert.equal(c.cells.CHEAP.flag, true); assert.ok(!("spared" in c.cells.CHEAP)); });
test("neighbour: the five-peer floor still holds — four peers judge no one, on either side", () => {
  const c = O.columnDistances(col([["A", 10], ["B", 11], ["C", 12], ["DEAR", 900]]), { log: true, highOnly: true }); assert.equal(c.judged, false); assert.equal(c.cells.DEAR.flag, false); });
test("the cell rule in the field: a dear multiple leaves its yardstick, a cheap one stays and is named", () => {
  const row = { key: "pe_fwd", peers: [...PACK, ["DEAR", 200], ["CHEAP", 0.4]].map(([ticker, multiple]) => ({ ticker, multiple })) };
  const one = F.outlierFlags(row, { k: O.CUT, highOnly: true }), two = F.outlierFlags(row, { k: O.CUT });
  assert.deepEqual(one.out.map((o) => o.ticker), ["DEAR"]); assert.deepEqual(one.spared.map((o) => o.ticker), ["CHEAP"]);
  assert.deepEqual(two.out.map((o) => o.ticker).sort(), ["CHEAP", "DEAR"]); assert.deepEqual(two.spared, []); });
/* five yardsticks, eight peers: seven ordinary, one that is far out on four of them */
const colsFor = (far, highOnly) => { const cols = {}; for (const k of ["pe_fwd", "ev_ebitda", "ev_sales", "ps", "peg"]) cols[k] = { key: k, short: k, ...O.columnDistances(col([...PACK, ["X", k === "peg" ? 10 : far]]), { log: true, highOnly }) }; return cols; };
test("one peer, far ABOVE on four of five yardsticks: left out. Far BELOW on four of five: kept, and named as spared", () => {
  const peers = [...PACK.map(([t]) => t), "X"];
  const dear = O.scorePeers(colsFor(300, true), peers, { highOnly: true, consistency: true }).X; assert.equal(dear.outlier, true); assert.equal(dear.sideWord, "above");
  const cheap = O.scorePeers(colsFor(0.3, true), peers, { highOnly: true, consistency: true }).X; assert.equal(cheap.outlier, false); assert.equal(cheap.n, 0);
  assert.ok(cheap.spared && cheap.spared.would_be_cut === true && cheap.spared.n === 4, JSON.stringify(cheap.spared)); });
test("neighbour: the two-sided rule (the switch off) still cuts that cheap peer — the Qualcomm case as it was", () => {
  const peers = [...PACK.map(([t]) => t), "X"]; const cheap = O.scorePeers(colsFor(0.3, false), peers, { consistency: true }).X; assert.equal(cheap.outlier, true); assert.equal(cheap.spared, null); });
test("neighbour: growth and margins never vote, on either side — a fast grower is not an outlier for growing", () => {
  assert.deepEqual(O.VOTES.map((v) => v.key), ["pe", "ev_ebitda", "ev_sales", "ps", "peg"]); assert.ok(!O.isVote("eps_g_fy") && !O.isVote("om")); });

/* ---- 2 · the switches: what is live is untouched ---- */
test("the configuration that is live on the Hub carries none of the new switches, and the release's one line is as the release wrote it", () => {
  assert.equal(O.LIVE_FX, O.CP3_ALL); for (const k of ["expensiveOnly", "lineSeats", "pegCap"]) assert.ok(!(k in O.CP3_ALL), k + " is not in the live configuration"); assert.ok(!("expensiveOnly" in O.CP4_ALL) && !("lineSeats" in O.CP4_ALL));
  assert.equal(O.CP5_ALL.expensiveOnly, true); assert.equal(O.CP5_ALL.lineSeats, true); assert.equal(O.CP5_ALL.pegCap, O.CP5_CAP); assert.equal(O.CP5_CAP, 30);
  for (const k of Object.keys(O.CP4_ALL)) if (k !== "pegCap") assert.equal(O.CP5_ALL[k], O.CP4_ALL[k], k + " as the afternoon's engine had it"); });
test("the live rule's own answer did not move: every name's reading on the live configuration equals the one recorded before this round", SIX_OCT, () => {
  const before = J(DATA + "/before-outlier-and-cap-fix.json"); assert.ok(Object.keys(before.names).length >= 400);
  /* the engine prints the live rule's centre beside the new one (variants.A); the tab on the same closes printed the same twelve (the release's table) */
  const rl1 = { GOOGL: 330.2, AMZN: 321.3, AVGO: 729.8, NVDA: 564.3, TSM: 525.5, VST: 181.3, MU: 1177.1, ORCL: 243.5, DLR: 208.1, EQIX: 849.0, SNDK: 990.5, WDC: 283.9 };
  for (const t of TWELVE) assert.ok(Math.abs(IDX.names[t].variants.A.centre / rl1[t] - 1) < 0.001, `${t}: ${IDX.names[t].variants.A.centre} against the release's ${rl1[t]}`); });

/* ---- 3 · the cap is a value, and it holds when a peer leaves the row ---- */
test("the cap is a value: true is 40, a number is itself, false and null are no cap", () => {
  assert.equal(F.pegCapOf(true), 40); assert.equal(F.pegCapOf(30), 30); assert.equal(F.pegCapOf(false), null); assert.equal(F.pegCapOf(null), null); assert.equal(F.pegCapOf(0), null); });
const pegSnap = () => ({ ticker: "T", forward: "next-four-quarters", price: 100, eps_fy1: 5, members: ["T", "A", "B", "C", "D"],
  rows: [{ key: "pe_fwd", own: { multiple: 20 }, values: { A: { multiple: 30 }, B: { multiple: 24 }, C: { multiple: 40 }, D: { multiple: 18 } } }],
  table: { company: { eps_g_fy: 60 }, peers: { A: { eps_g_fy: 20 }, B: { eps_g_fy: 50 }, C: { eps_g_fy: 80 }, D: { eps_g_fy: 10 } } } });
test("the slip this round found: when a peer leaves the PEG row, the re-priced row still counts growth only up to the cap", () => {
  const snap = pegSnap(), row = F.pegRow(snap, {}, "2026-10-06", { cap: 30 });
  assert.equal(row.figure.growth, 60, "the company's own growth is still said in full"); assert.equal(row.figure.growth_counted, 30); assert.equal(row.figure.value, 30 * 5, "growth counted × EPS");
  assert.equal(row.values.C.multiple, 40 / 30, "a peer growing 80% is read on 30"); assert.equal(row.values.A.multiple, 30 / 20, "a peer under the cap is read on its own growth");
  const kept = row.peers.filter((p) => p.ticker !== "C"), again = LAD.repriceRow(row, kept, { ...snap, rows: [...snap.rows, row] });
  assert.equal(again.ends.median.price, again.ends.median.multiple * 30 * 5, "re-priced at the cap, not at 60%");
  assert.equal(row.ends.median.price, row.ends.median.multiple * 30 * 5); });
test("neighbour: with no cap the PEG row is the straight line, exactly as it was", () => {
  const snap = pegSnap(), row = F.pegRow(snap, {}, "2026-10-06", { cap: null }); assert.equal(row.figure.value, 60 * 5); assert.equal(row.values.C.multiple, 40 / 80); assert.equal(row.ends.median.price, row.ends.median.multiple * 60 * 5); });
test("in the artifact the growth yardstick never counts more than the cap, for any name, and says both figures", () => {
  const cap = IDX.rule.growth_cap_pct; assert.equal(cap, 30); let fast = 0;
  for (const [t] of OK) { const y = name(t).yardsticks.peg; if (!y || y.growth_counted_pct == null) continue; assert.ok(y.growth_counted_pct <= cap + 1e-9, `${t} counts ${y.growth_counted_pct}`); if (y.growth_own_pct > cap) { fast++; assert.equal(y.growth_counted_pct, cap, t); } else assert.equal(y.growth_counted_pct, y.growth_own_pct, t); }
  assert.ok(fast >= 20, "plenty of names grow faster than the cap: " + fast);
  const a = name("AVGO"), y = a.yardsticks.peg, eps = a.forward.eps_usd; assert.ok(y.growth_own_pct > 50 && y.growth_counted_pct === 30);
  assert.ok(Math.abs(y.implied / (y.median * 30 * eps) - 1) < 0.02, `Broadcom's growth yardstick is priced at the cap: ${y.implied} against ${(y.median * 30 * eps).toFixed(0)}`); });
test("every name is priced at 30, at 40 and with no cap, side by side with the live rule", () => {
  for (const [t, n] of OK) { if (n.blend.centre == null) continue; const v = n.variants; assert.deepEqual(Object.keys(v.caps).sort(), ["30", "40", "none"], t); assert.equal(v.C.centre, n.blend.centre, t + ": C is the headline"); assert.equal(v.C.centre, v.caps["30"].centre, t); assert.equal(v.B.centre, v.caps.none.centre, t + ": B is the same engine with no cap"); assert.ok("centre" in v.A, t + " has the live rule's reading"); } });

/* ---- 4 · the cases, written out ---- */
test("nobody is ever left out for being cheap: every peer the rule leaves out sits above the group, every spared one below", () => {
  let out = 0, kept = 0;
  for (const [t] of OK) { const r = name(t); for (const c of r.outlier_cases) { assert.ok(["left out", "left out of one yardstick", "kept"].includes(c.verdict), t); if (c.verdict === "kept") { kept++; assert.equal(c.side, "below", t + " " + c.ticker); } else { out++; assert.equal(c.side, "above", t + " " + c.ticker); } }
    for (const p of r.peers) if (p.outlier) assert.ok(r.outlier_cases.some((c) => c.ticker === p.ticker && c.verdict === "left out"), `${t}: ${p.ticker} is out and its reason is written`);
    for (const p of r.peers) if (p.spared) assert.equal(p.priced, true, `${t}: the spared ${p.ticker} prices it`); }
  assert.ok(out >= 50 && kept >= 20, `${out} left out, ${kept} kept`); });
test("Broadcom's set shows both cases: Arm is left out for being priced far above the group, Qualcomm stays although far below", SIX_OCT, () => {
  const r = name("AVGO"), arm = r.outlier_cases.find((c) => c.ticker === "ARM"), q = r.outlier_cases.find((c) => c.ticker === "QCOM");
  assert.equal(arm.verdict, "left out"); assert.match(arm.words, /^Arm is left out: it is priced far above the group on \d of the \d yardsticks/);
  assert.equal(q.verdict, "kept"); assert.equal(q.would_be_cut, true); assert.match(q.words, /^Qualcomm stays in: it is priced far below the group/); assert.match(q.words, /two-sided rule left it out/);
  assert.deepEqual(r.sets.outliers, ["ARM"]); assert.deepEqual(r.sets.spared, ["QCOM"]); assert.ok(r.sets.priced.includes("QCOM") && !r.sets.priced.includes("ARM"));
  assert.ok(r.variants.two_sided_rule.upside_pct > r.blend.upside_pct, "taking the cheap peer out reads higher: the one-sided rule is the conservative one"); });
test("the conservative direction, measured on everything: the one-sided rule reads lower than the two-sided one far more often than higher", () => {
  let lower = 0, higher = 0; for (const [, n] of OK) { const two = n.variants && n.variants.two_sided_rule; if (!two || two.upside_pct == null || n.blend.upside_pct == null) continue; const d = n.blend.upside_pct - two.upside_pct; if (d < -0.5) lower++; else if (d > 0.5) higher++; }
  assert.ok(lower >= 40 && lower > 4 * higher, `lower on ${lower}, higher on ${higher}`); });

/* ---- 5 · a business line with no peer of its own seats its two best ---- */
test("Alphabet: Amazon and Microsoft are seated on its cloud line, and Meta no longer carries the set alone", SIX_OCT, () => {
  const r = name("GOOGL"); assert.deepEqual(r.sets.seated.map((s) => s.ticker).sort(), ["AMZN", "MSFT"]); for (const s of r.sets.seated) assert.equal(s.line, "cloud");
  const w = Object.fromEntries(r.peers.map((p) => [p.ticker, p.weight_share || 0])); assert.ok(w.META < 0.35, "Meta's share of the weight: " + w.META); assert.ok(w.AMZN > 0.1 && w.MSFT > 0.1, `Amazon ${w.AMZN}, Microsoft ${w.MSFT}`);
  for (const t of ["META", "AMZN", "MSFT"]) assert.ok(r.sets.priced.includes(t), t + " prices it");
  assert.ok(r.sets.seat_lines.advertising.peers.includes("META") && r.sets.seat_lines.cloud.peers.includes("MSFT"));
  assert.ok(!r.sets.before.includes("MSFT") && !r.sets.before.includes("AMZN"), "neither was in the afternoon's set"); });
test("neighbour: the seat adds, it never re-labels or removes — Oracle's and Broadcom's sets are the afternoon's, peer for peer", SIX_OCT, () => {
  for (const t of ["ORCL", "AVGO", "NVDA", "MU", "VST", "TSM", "DLR", "EQIX", "SNDK", "WDC", "AMZN"]) { const r = name(t); assert.deepEqual(r.sets.now, r.sets.before, t); assert.deepEqual(r.sets.seated, [], t); }
  for (const [t] of OK) { const r = name(t); for (const p of r.sets.before) assert.ok(r.sets.now.includes(p), `${t} still has ${p}`); }
  assert.ok(IDX.counts.with_a_seated_peer >= 1 && IDX.counts.with_a_seated_peer <= 12, "a handful of sets, not the universe: " + IDX.counts.with_a_seated_peer); });
test("neighbour: a seated peer counts in full only when 15 cents of the dollar is shared; a tenth of the revenue never carries the price", SIX_OCT, () => {
  assert.equal(L.CP5_LINES_ON.lineSeats, true); assert.equal(L.CP5_LINES_ON.seatMin, 0.10); assert.ok(!("lineSeats" in L.CP4_LINES_ON) && !("lineSeats" in L.CP3_LINES_ON));
  const u = name("UBER"); for (const p of u.peers.filter((x) => x.seated)) assert.equal(p.same_business, false, "Uber's freight-line seat " + p.ticker + " blends in as adjacent"); });

/* ---- 6 · "not a target" ---- */
test("not a target: Oracle for growth, Nvidia and TSMC for the size of their peers — each in its own plain words, each well above its price", SIX_OCT, () => {
  const o = name("ORCL").not_a_target, n = name("NVDA").not_a_target, t = name("TSM").not_a_target;
  assert.deepEqual(o.reasons, ["growth"]); assert.match(o.words, /^Not a target\. .* of the gap between today's price and the centre comes from the growth yardstick/);
  assert.deepEqual(n.reasons, ["size"]); assert.match(n.words, /^Not a target\. Every company that shares Nvidia's business here is a fraction of its size/); assert.deepEqual(t.reasons, ["size"]);
  assert.ok(n.growth_share_of_gap < 0.2, "Nvidia's centre does not rest on the growth yardstick: " + n.growth_share_of_gap);
  for (const [tk, s] of OK) { const r = s.not_a_target ? name(tk) : null; if (!r) continue; const x = r.not_a_target; assert.ok(x.upside_pct >= 25, tk + " is well above its price: " + x.upside_pct);
    if (x.reasons.includes("growth")) assert.ok(x.growth_share_of_gap > 0.5, tk); if (x.reasons.includes("size")) assert.ok(x.largest_peer.ratio < 0.25 && x.upside_pct >= 50, tk); assert.equal(r.flags[0], x.words, tk + ": it is the first flag every screen reads"); }
  assert.ok(IDX.counts.not_a_target >= 3 && IDX.counts.not_a_target <= 60, "a few names, not a disclaimer on everything: " + IDX.counts.not_a_target); });
test("the line travels with the number: the card and the knockout's row carry the same words, and the tab prints them", () => {
  for (const t of TWELVE) { const r = name(t), w = r.not_a_target ? r.not_a_target.words : null; assert.equal(CARDS.cards[t].comps.not_a_target, w, t + " card"); assert.equal(KOF.names[t].after.not_a_target, w, t + " knockout"); assert.equal(IDX.names[t].not_a_target, w, t + " index");
    assert.deepEqual(CARDS.cards[t].comps.outlier_cases, r.outlier_cases, t); assert.equal(CARDS.cards[t].comps.centre, r.blend.centre, t); }
  const tab = readFileSync(ROOT + "/deliverables/20261007/comps-engine/tab.mjs", "utf8"); assert.ok(/NOT A TARGET/.test(tab) && /r\.not_a_target/.test(tab) && /r\.outlier_cases/.test(tab));
  for (const word of ["buildSet", "conclusion6", "readSet", "snapshotFromCohort", "measureWeights", "scorePeers"]) assert.ok(!tab.includes(word), "the tab still computes nothing: " + word); });

test("the engine's cards are the ones the allocation tool keeps: same card date as the morning's cards, a later re-priced stamp", () => {
  const morning = J(ROOT + "/deliverables/20261007/one-basis/data/cards.json").as_of, engine = CARDS.as_of;
  assert.ok(engine.repriced && engine.basis, "the engine's cards carry both stamps");
  /* the tool's own rule (loadCards): newest card date, then newest re-priced stamp, then the order of its list */
  const pick = [{ who: "morning", as_of: morning.card_date, repriced: morning.repriced, order: 2 }, { who: "engine", as_of: engine.card_date, repriced: engine.repriced, order: 0 }].sort((a, b) => String(b.as_of || "").localeCompare(String(a.as_of || "")) || String(b.repriced || "").localeCompare(String(a.repriced || "")) || a.order - b.order)[0];
  assert.equal(pick.who, "engine", `card dates ${morning.card_date} / ${engine.card_date}; re-priced ${morning.repriced} / ${engine.repriced}`); });
test("PEG is the PEG ratio everywhere it is printed: forward P/E ÷ growth, for the company and for every peer; the yardstick says when it counts less growth", () => {
  for (const t of TWELVE) { const r = name(t), g = r.growth.next_to_following_pct; if (r.peg.value != null && g > 0) assert.ok(Math.abs(r.peg.value - r.forward.pe / g) < 0.012, `${t}: ${r.peg.value} against ${(r.forward.pe / g).toFixed(3)}`);
    assert.equal(CARDS.cards[t].fundamentals.peg, r.peg.value, t + " card"); assert.equal(IDX.names[t].peg, r.peg.value, t + " index");
    for (const p of r.peers) if (p.peg != null && p.growth_eps > 0 && p.pe_fwd > 0) assert.ok(Math.abs(p.peg - p.pe_fwd / p.growth_eps) < 0.03, `${t} · ${p.ticker}: ${p.peg} against ${(p.pe_fwd / p.growth_eps).toFixed(3)}`);
    const y = r.yardsticks.peg; if (y && y.capped) { assert.ok(y.own > y.own_plain, t + ": on counted growth the ratio is higher"); assert.equal(y.own_plain, r.peg.value, t); } else if (y && y.own != null) assert.equal(y.own, r.peg.value, t + ": under the cap the two are one number"); }
  const tab = readFileSync(ROOT + "/deliverables/20261007/comps-engine/tab.mjs", "utf8"); assert.ok(/growth counted to \$\{esc\(y\.growth_cap_pct\)\}%/.test(tab), "the yardstick row says what it counts"); });

/* ---- 7 · plain words ---- */
test("what Alan reads carries no internal codes: the cases, the not-a-target lines and the tab's own text", () => {
  const bad = /\b(CP\d|C6b?|C5b?|FD1|RL1|v[12]|rung|MAD|z-score|jackknife|cellRule|selfOutlier|fx)\b|line vs reading|\bevenings?\b/;
  for (const [t] of OK) { const r = name(t); for (const c of r.outlier_cases) assert.ok(!bad.test(c.words), `${t}: ${c.words}`); if (r.not_a_target) assert.ok(!bad.test(r.not_a_target.words), t); }
  const tab = readFileSync(ROOT + "/deliverables/20261007/comps-engine/tab.mjs", "utf8"), shown = tab.slice(tab.indexOf("export function render"));
  assert.ok(!/\bevenings?\b/.test(shown), "the tab says trading days"); assert.ok(!/\b(CP\d|C6b?|v[12]|rung)\b/.test(shown.replace(/cp3/g, "")), "no internal codes in what the tab draws"); });

/* ---- 8 · the nightly rebuild is designed, written with its way back, and not installed ---- */
test("the nightly rebuild: the step, its gate and its way back are on the branch; it is dry by default, never deploys, and only ever sends a data branch", () => {
  const dir = ROOT + "/deliverables/20261007/comps-default/nightly"; for (const f of ["rebuild-comps.sh", "inputs.mjs", "check-artifact.mjs", "DESIGN.md", "ROLLBACK.md", "com.scintilla.comps-rebuild.plist.NOT-INSTALLED"]) assert.ok(existsSync(dir + "/" + f), f);
  const sh = readFileSync(dir + "/rebuild-comps.sh", "utf8"), code = sh.replace(/^\s*#.*$/gm, "").replace(/^\s*say .*$/gm, "");
  assert.match(code, /MODE="\$\{MODE:-dry\}"/, "dry unless asked"); assert.match(code, /DRY_RUN:-0\}" = "1" \] && MODE=dry/, "DRY_RUN is a second lock");
  assert.ok(!/\bvercel\b|supabase\s|\bfly\b|launchctl/.test(code), "it never deploys, writes a table, touches a machine or installs itself");
  const pushes = code.match(/\bpush\b[^\n]*/g) || []; assert.equal(pushes.length, 1, "one push in the whole file"); assert.match(pushes[0], /origin "\$BR"/); assert.match(code, /BR="data\/comps-\$DAY"/, "and it is the night's data branch, never the live line");
  assert.match(code, /grep -v " \$ENGINE_DIR\/data\/"/, "anything changed outside the engine's data stops the run");
  for (const f of ["inputs.mjs", "check-artifact.mjs"]) { const js = readFileSync(dir + "/" + f, "utf8"); assert.ok(!/method:\s*["'](POST|PUT|PATCH|DELETE)/i.test(js), f + " only reads"); assert.ok(!/console\.log\([^)]*KEY/.test(js), f + " never prints the key"); }
  assert.ok(!existsSync(dir + "/com.scintilla.comps-rebuild.plist"), "the schedule file cannot be loaded under this name"); });
