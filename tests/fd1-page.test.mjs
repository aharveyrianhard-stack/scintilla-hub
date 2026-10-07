/* FD1 (7 Oct 2026) — the page for Alan, deliverables/20261007/feed-fix/FEED-FIX.html: the house rules it must keep
   (BACK / CLOSE, greys only, nothing under 11px, every explaining sentence in PAGE SPECS) and that what it prints is
   what the data files beside it hold. Offline. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8"), J = (p) => JSON.parse(read(p));
const DIR = "deliverables/20261007/feed-fix/", html = read(DIR + "FEED-FIX.html");
const KO = J(DIR + "data/knockout-feed-before-after.json"), RR = J(DIR + "data/comps-rerun-26.json"), RV = J(DIR + "data/revisions-26.json"), MV = J(DIR + "data/market-value-scan.json");
const own = html.slice(html.indexOf("<style>") + 7, html.indexOf("</style>")), body = html.slice(html.indexOf("<body>"), html.indexOf("<!-- scnav"));
const text = (h) => h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ");

test("the way back, and where the explaining goes", () => {
  assert.match(html, /<header class="top"><span data-scnav-slot><\/span>/); assert.equal((html.match(/<!-- scnav · /g) || []).length, 1); assert.match(html, /<!-- \/scnav -->\n<\/body>/);
  assert.equal(read("scripts/scnav-snippet.html").trim(), html.slice(html.indexOf("<!-- scnav · "), html.indexOf("<!-- /scnav -->") + 15), "the pair is the shared snippet, as inject-scnav.py places it");
  assert.equal((html.match(/<details class="sc-pagespecs"><summary>PAGE SPECS<\/summary>/g) || []).length, 1);
  /* no sentence sits inside a panel: a panel holds headings, labels, figures and rows; nothing there ends like prose */
  const panels = body.slice(0, body.indexOf('<details class="sc-pagespecs">')).replace(/<div class="cmd">[\s\S]*?<\/div>/g, " ");
  assert.ok(!/<p[ >]/.test(panels), "no paragraph outside PAGE SPECS");
  const specs = text(html.slice(html.indexOf('<details class="sc-pagespecs">'), html.indexOf("</details>", html.indexOf('<details class="sc-pagespecs">'))));
  for (const need of ["WHAT THIS PAGE IS", "WHERE THE NUMBERS ON THE FEED PANELS COME FROM", "WHAT COULD BE WRONG", "WHAT WAS NOT DONE", "HOW IT WAS CHECKED"]) assert.ok(specs.includes(need), need);
  assert.ok(!/\b(buy|sell)\b/i.test(text(body)), "the page lays out figures; it gives no instruction");
});
test("the look: every colour is a grey with no channel above 210, and no text is set under 11px", () => {
  const hexes = [...new Set((own.match(/#[0-9a-fA-F]{6}\b/g) || []).map((h) => h.toLowerCase()))];
  assert.ok(hexes.length >= 6);
  for (const h of hexes) { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); assert.ok(Math.max(...c) - Math.min(...c) <= 24, h + " is a grey"); assert.ok(Math.max(...c) <= 210, h + " is not white"); }
  assert.ok(!/#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])/.test(own.replace(/#[0-9a-fA-F]{6}/g, "")), "no three-digit colour slipped in"); assert.ok(!/\bwhite\b(?!-space)|rgba?\(|hsla?\(/i.test(own), "no colour by name or by function: only the greys above");
  const sizes = [...own.matchAll(/font(?:-size)?:[^;}]*?(\d+(?:\.\d+)?)px/g)].map((m) => +m[1]);
  assert.ok(sizes.length > 10 && Math.min(...sizes) >= 11, "smallest text " + Math.min(...sizes) + "px");
  /* before and after are told apart by shape as well as shade: a ring and a dot */
  assert.match(own, /\.dot\.now\{background:#c8c8cc/); assert.match(own, /\.dot\.was\{background:#111114;border:2px solid #8c8c92\}/); assert.match(own, /\.dot\{[^}]*width:10px;height:10px/);
  const shots = DIR + "shots/shots-facts.json";
  if (existsSync(new URL("../" + shots, import.meta.url))) { const f = J(shots); for (const w of ["1680", "390"]) { assert.equal(f.widths[w].sideways_scroll, false, w + ": no sideways scroll"); assert.deepEqual(f.widths[w].text_under_11px, [], w); assert.deepEqual(f.widths[w].back_close, ["←BACK", "✕CLOSE"]); assert.deepEqual(f.widths[w].page_errors, []); assert.equal(f.widths[w].non_get_blocked, 0); assert.ok(f.widths[w].tooltip_on_hover.startsWith("Micron")); } assert.equal(f.visible_windows, 0); }
});
test("what the page prints is what the data holds", () => {
  const t = text(body), has = (s) => assert.ok(t.includes(s), "the page says: " + s);
  const B = KO.before, A = KO.after, pc = (f) => (f > 0 ? "+" : f < 0 ? "−" : "") + Math.abs(f * 100).toFixed(0) + "%";
  assert.equal(pc(B.figures.MU.rev_growth), "−59%"); assert.equal(pc(A.figures.MU.rev_growth), "+256%"); has("−59% → +256%");
  assert.equal(B.figures.MU.fwd_pe, 0); assert.ok(Math.abs(A.figures.MU.fwd_pe - 6.02) < 0.01); has("0.0× → 6.0×");
  has(`${B.counts.fwd_pe_zero.toLocaleString("en-US")} → ${A.counts.fwd_pe_zero}`); assert.equal(A.counts.fwd_pe_zero, 0); assert.equal(A.counts.growth_zero, 0);
  has(`${MV.stored_over_today.more_than_10pct_off} of ${MV.dollar_reporters}`);
  const mu = RR.names.MU; assert.equal(mu.cp1.upside_pct, 98.8); assert.equal(mu.cp1_mv.upside_pct, 72); has("+99% → +72%");
  assert.deepEqual(mu.cp1_mv.business_peers.slice().sort(), ["SNDK", "STX", "WDC"]); assert.equal(mu.cp1_mv.points.length, 12);
  assert.equal(Math.round(mu.cp1_mv.per_peer.SNDK.upside_pct), 56); has("alone +56%"); has("no figures yet");
  assert.deepEqual(RR.reference.carried, [], "no reference facts were on file for this run"); assert.equal(RR.reference.missing.length, 3);
  const y = RV.names.MU.years.fy1; assert.equal(y.eps.on_the_date.copies, 3); assert.equal(y.eps.on_the_fiscal_year.copies, 4); assert.equal(y.eps.on_the_fiscal_year.pct, 12.4); has("+12.4%"); has("+24.5%");
  assert.equal(Object.values(RV.names).filter((n) => n.key_moved).map((n) => 1).length, 4);
  assert.equal(RR.names.LLY.cp1.upside_pct, -35.9); assert.equal(RR.names.LLY.fd1.upside_pct, -30.6); assert.equal(RR.names.VST.cp1.upside_pct, 22.2); assert.equal(RR.names.VST.fd1.upside_pct, 25.1); has("−36% → −31%"); has("+22% → +25%");
  /* a number means the same thing in the knockout and on the COMPS tab: for all 26 names the fixed feed's trailing P/E,
     forward P/E and P/S are the comps reader's own (on today's market values), from two separate runs of two programs */
  let compared = 0;
  for (const s of KO.cards) { const a = A.figures[s], m = RR.names[s].cp1_mv.multiples[s];
    for (const [fk, mk] of [["pe", "pe_ttm"], ["fwd_pe", "pe_fwd"], ["ps", "ps"]]) { if (a[fk] == null || m[mk] == null || a[fk] <= 0) continue; assert.ok(Math.abs(a[fk] - m[mk]) <= 0.006 * Math.abs(m[mk]) + 0.006, `${s} ${fk}: feed ${a[fk]} · comps ${m[mk]}`); compared++; } }
  assert.ok(compared >= 70, compared + " figures compared");
  /* every one of the 26 is on the page, the eighteen in both charts */
  for (const s of KO.cards) assert.ok(body.includes(`<b>${s}</b>`), s); assert.equal(KO.eighteen.length, 18); assert.equal(KO.cards.length, 26);
  assert.equal(KO.before.non_get_blocked, 0); assert.equal(KO.after.non_get_blocked, 0); assert.deepEqual(KO.after.page_errors, []);
  /* the two ready-to-run routes for the foreign peers, in full: the job that exists, where its key lives, and the raw-answer tool */
  has("fx-multiples-check.mjs 000660.KS 005930.KS 285A.T SKHY"); has("--file-local /app/fx-multiples-check.mjs=scripts/fx-multiples-check.mjs"); has("FMP_API_KEY"); has("reference-facts-from-raw.mjs"); has("staging/fmp-foreign-peers-20261007");
  assert.ok(existsSync(new URL("../scripts/fx-multiples-check.mjs", import.meta.url)) && existsSync(new URL("../" + DIR + "tools/reference-facts-from-raw.mjs", import.meta.url)));
});
