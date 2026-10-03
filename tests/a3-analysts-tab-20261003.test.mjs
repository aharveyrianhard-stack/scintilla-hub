/* A3 (3 Oct 2026) — the ESTIMATES tab: the current price target first, five sub-tabs, the firms as a left-to-right swipe of
   cards, PAGE SPECS at the bottom. The firm count is checked against the real notes and FMP's consensus row of 3 Oct
   (tests/fixtures/a3-target-notes-20261003.json). No network. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fx = JSON.parse(readFileSync(new URL("./fixtures/a3-target-notes-20261003.json", import.meta.url), "utf8"));
const blk = (b, e) => { const a = html.indexOf(b), z = html.indexOf(e); assert.ok(a > 0 && z > a, b); return html.slice(a, z); };
const escSrc = html.slice(html.indexOf("const esc = (s) =>"), html.indexOf("const el = (id) =>"));
const secSrc = html.slice(html.indexOf("const estSechead = (n, t, meta) =>"), html.indexOf("/* 01 FORECAST — one metric tile"));
const r2 = blk("/* R2C-REVISIONS:BEGIN", "/* R2C-REVISIONS:END */"), r3 = blk("/* R3-REVISIONS:BEGIN", "/* R3-REVISIONS:END */");
const a3 = blk("/* A3-ESTIMATES:BEGIN", "/* A3-ESTIMATES:END */");
/* the other sections are stubs here: each prints its name and one source line, so the spec split can be seen */
const stub = (n) => `function ${n}(d) { return '<div class="stub">${n}</div><div class="sc-est-note">${n} source</div>'; }\n`;
const ctx = { todayISO: () => "2026-10-03", pg: () => Promise.resolve([]), S: { estSub: null }, LS: {} };
ctx.lsGet = (k) => ctx.LS[k] || null;
vm.createContext(ctx);
vm.runInContext(escSrc + secSrc + r2 + r3 + a3 + ["estConvictionHTML", "estGradesHTML", "estForecastHTML", "estConsensusGridHTML", "estValuationHTML", "estScenariosHTML"].map(stub).join("") +
  "; Object.assign(this, { ptcFirmSet, ptcPx, estPtcBody, estPtcSpecs, estSubNow, estSubStripHTML, estFirmCards, estFcardHTML, estFirmsBody, estFsparkSVG, estSpecSplit," +
  " estimatesTabHTML, revStripSpecs, REV_CACHE, REV_HIST_FIRM, EST_SUBS });", ctx);

const DAY = 864e5;
const anchorOf = (t) => fx.consensus[t].updated_ts * 1000;

/* ---------- the target block ---------- */
test("the firm count: the newest target per firm in the 183 days before FMP's update gives back FMP's consensus (AMZN 30 firms, NVDA 28)", () => {
  for (const [t, n] of [["AMZN", 30], ["NVDA", 28]]) {
    const c = fx.consensus[t], s = ctx.ptcFirmSet(fx.notes[t], anchorOf(t), 183);
    assert.equal(s.n, n, t + " firms");
    assert.equal(+s.mean.toFixed(2), c.target_avg, t + " mean");
    assert.equal(s.med, c.target_median, t + " median");
    assert.equal(s.lo, c.target_low); assert.equal(s.hi, c.target_high);
  }
  /* NVDA: Wells Fargo's $210 of 2 Oct came after FMP's 1 Oct update — counting it would move the low to $210 */
  const late = ctx.ptcFirmSet(fx.notes.NVDA, Date.parse("2026-10-03T00:00:00Z"), 183);
  assert.equal(late.lo, 210, "the window ends at FMP's update, not today");
});
test("the firm set: one target per firm (the newest), split-adjusted, two spellings one firm, roundups out, nothing outside the window", () => {
  const A = Date.parse("2026-10-01T00:00:00Z");
  const rows = [
    { published_utc: "2026-09-01T00:00:00Z", firm: "D.A. Davidson", target: 100, adj_target: 100, title: "" },
    { published_utc: "2026-09-20T00:00:00Z", firm: "DA Davidson", target: 120, adj_target: 120, title: "" },
    { published_utc: "2026-08-01T00:00:00Z", firm: "X", target: 1000, adj_target: 50, title: "" },
    { published_utc: "2026-09-11T00:00:00Z", firm: "Citi", target: 999, adj_target: 999, title: "Wall Street's top 10 stock calls this week" },
    { published_utc: "2025-01-01T00:00:00Z", firm: "Old", target: 5, adj_target: 5, title: "" },
  ];
  const s = ctx.ptcFirmSet(rows, A, 183);
  assert.equal(s.n, 2); assert.equal(s.mean, 85); assert.equal(s.lo, 50); assert.equal(s.hi, 120);
  assert.equal(ctx.ptcFirmSet([], A, 183).n, 0);
});
test("the target block: mean big, median, firms, the distance from today in colour, low / high on one track; first in the tab", () => {
  const c = { at: Date.now(), rows: [], hist: fx.notes.AMZN, grades: [], est: [], sum: null };
  const h = ctx.estPtcBody("AMZN", fx.consensus.AMZN, 251.37, c, Date.parse("2026-10-03T14:00:00Z"));
  assert.match(h, /^<div class="sc-ptc" data-rev-t="AMZN">/);
  assert.match(h, /<span class="sc-ptc-v">\$326\.83<\/span><span class="sc-ptc-l">mean<\/span>/);
  assert.match(h, /\$325<\/span><span class="sc-ptc-l">median/);
  assert.match(h, />30<\/span><span class="sc-ptc-l">firms/);
  assert.match(h, /sc-ptc-v2 up">▲ \+30%<\/span><span class="sc-ptc-l">vs \$251\.37 now/, "326.83 / 251.37 − 1 = +30.0%");
  assert.match(h, /low \$200/); assert.match(h, /high \$390/); assert.match(h, /now \$251\.37/);
  assert.match(h, /class="sc-ptc-fill up"/); assert.match(h, /<span class="asof">2 Oct<\/span>/);
  assert.ok(!/NaN|undefined/.test(h));
  const dn = ctx.estPtcBody("AMZN", fx.consensus.AMZN, 400, c, Date.now());
  assert.match(dn, /sc-ptc-v2 dn">▼ −18%/); assert.match(dn, /sc-ptc-fill dn/);
  assert.match(ctx.estPtcBody("AMZN", fx.consensus.AMZN, 251.37, null, Date.now()), />…<\/span><span class="sc-ptc-l">firms/, "the count waits for the notes");
  const fromNotes = ctx.estPtcBody("AMZN", null, 251.37, c, Date.parse("2026-10-03T00:00:00Z"));
  assert.match(fromNotes, /the firms' notes/); assert.match(fromNotes, /sc-ptc-v">\$/);
  assert.match(ctx.estPtcBody("ZZZ", null, 10, { rows: [], hist: [] }, Date.now()), /No price-target consensus for \$ZZZ/);
  assert.equal(ctx.ptcPx(1544.17), "$1,544"); assert.equal(ctx.ptcPx(322.5), "$322.50"); assert.equal(ctx.ptcPx(325), "$325");
});
test("the target block's words are in PAGE SPECS: what the median is, how the firms are counted, the check against FMP", () => {
  const c = { hist: fx.notes.AMZN };
  const sp = ctx.estPtcSpecs("AMZN", fx.consensus.AMZN, c, Date.now()).join(" ");
  assert.match(sp, /MEDIAN = the middle of the price targets published by the firms that cover \$AMZN/);
  assert.match(sp, /183 days before FMP's update of 2026-10-02/);
  assert.match(sp, /On these 30 firms the mean is \$326\.83[^.]*FMP's own: \$326\.83 and \$325 — the same set\./);
});

/* ---------- the sub-tabs ---------- */
test("sub-tabs: REVISIONS · FIRMS · RATINGS · EARNINGS ESTIMATES · VALUATION, left to right, the company tabs' buttons; remembered, REVISIONS first", () => {
  const strip = ctx.estSubStripHTML("FIRMS");
  assert.deepEqual([...strip.matchAll(/data-sub="([A-Z]+)">([^<]+)</g)].map((m) => m[2]), ["REVISIONS", "FIRMS", "RATINGS", "EARNINGS ESTIMATES", "VALUATION"]);
  assert.match(strip, /class="sc-esub-b on" aria-selected="true" data-act="estsub" data-sub="FIRMS"/);
  ctx.S.estSub = null; ctx.LS = {}; assert.equal(ctx.estSubNow(), "REVISIONS");
  ctx.LS["hub.estimates.sub"] = "RATINGS"; assert.equal(ctx.estSubNow(), "RATINGS", "remembered per browser");
  ctx.S.estSub = "VALUATION"; assert.equal(ctx.estSubNow(), "VALUATION");
  ctx.S.estSub = "NOPE"; ctx.LS = {}; assert.equal(ctx.estSubNow(), "REVISIONS");
  ctx.S.estSub = null;
});
test("the tab: PRICE TARGET → sub-tabs → the active sub-tab only → PAGE SPECS; source lines leave the content for the specs", () => {
  const T = "AMZN";
  ctx.REV_CACHE[T] = { at: Date.now(), rows: [], sum: null, err: null, hist: fx.notes.AMZN, grades: [], est: [], px: [] };
  const data = { t: T, price: 251.37, _pt: fx.consensus.AMZN };
  const want = { REVISIONS: /sc-rvs/, FIRMS: /sc-fsw-box/, RATINGS: /estConvictionHTML[\s\S]*estGradesHTML/, EARNINGS: /estForecastHTML[\s\S]*estConsensusGridHTML/, VALUATION: /estValuationHTML[\s\S]*estScenariosHTML/ };
  for (const sub of ctx.EST_SUBS) {
    ctx.S.estSub = sub;
    const h = ctx.estimatesTabHTML(data);
    const iP = h.indexOf('class="sc-ptc"'), iS = h.indexOf('class="sc-esub"'), iB = h.indexOf('class="sc-esub-body"'), iD = h.indexOf('<details class="sc-pagespecs');
    assert.ok(iP > 0 && iP < iS && iS < iB && iB < iD, sub + ": the order");
    const body = h.slice(iB, iD), specs = h.slice(iD);
    assert.match(body, want[sub], sub);
    for (const other of ctx.EST_SUBS) if (other !== sub && other !== "REVISIONS") assert.ok(!want[other].test(body), sub + " does not also draw " + other);
    assert.ok(!/sc-est-note|sc-rvs-note|sc-rvs-say|sc-rvh-say/.test(body), sub + ": no description in the content");
    assert.match(specs, /^<details class="sc-pagespecs sc-espec" data-rev-t="AMZN"><summary>PAGE SPECS<\/summary>/);
    if (sub === "RATINGS") assert.match(specs, /estConvictionHTML source/, "a section's source line is in the specs");
  }
  ctx.S.estSub = null;
  assert.match(ctx.estimatesTabHTML({ t: T, _loading: true }), /^<div class="sc-etab" data-sub="REVISIONS"><div class="sc-esub"/, "still loading: no block, no specs");
  const sp = ctx.estSpecSplit('<div class="a">x</div><div class="sc-est-note">one <b>two</b></div><div class="sc-est-hint">three</div>');
  assert.equal(sp.html, '<div class="a">x</div>'); assert.deepEqual([...sp.notes], ["one <b>two</b>", "three"]);
});
test("00 REVISIONS keeps the arrows and the estimates box; its sentence, note list and fold moved to PAGE SPECS", () => {
  const sum = { as_of_date: "2026-10-02", last_month_count: 3, last_month_avg: 246.67, last_quarter_count: 25, last_quarter_avg: 331.72, last_year_count: 96, last_year_avg: 299.77, all_time_count: 342, all_time_avg: 152.34 };
  const rows = [{ kind: "TARGET", published_utc: "2026-10-02T09:25:00+00:00", firm: "Wells Fargo", target: 210, adj_target: 210, price_when_posted: 230.86, title: "Wells Fargo lowers Nvidia price target to $210 from $265" },
    { kind: "TARGET", published_utc: "2026-09-11T12:00:00+00:00", firm: "Citi", target: 999, adj_target: 999, title: "Wall Street's top 10 stock calls this week" }];
  const c = { rows, sum, est: [] };
  const vmBody = vm.runInContext("revStripBody", ctx)("NVDA", c, 2026);
  assert.match(vmBody, /sc-rvs-arrows/); assert.match(vmBody, /▼ −26% vs last quarter/);
  assert.ok(!/sc-rvs-row|sc-rvs-say|sc-rvs-note|<details/.test(vmBody));
  const sp = ctx.revStripSpecs("NVDA", c).join(" ");
  assert.match(sp, /analysts are revising DOWN\. Only 3 targets this month — a thin read\./);
  assert.match(sp, /1 roundup-headline note set aside/);
  /* the strip paints a second time when the reads land: that paint is split the same way (the estimates box's source line once leaked back) */
  assert.match(r2, /const sp = estSpecSplit\(revStripBody\(t, c\)\); el\.outerHTML = sp\.html; ESPEC_NOTES\[t\] = sp\.notes;/);
  const est = [{ fiscal_date: "2027-01-25", as_of_date: "2026-10-02", eps_avg: "9.27", revenue_avg: "409426638637" }, { fiscal_date: "2028-01-25", as_of_date: "2026-10-02", eps_avg: "15.75", revenue_avg: "691862290915" }];
  const split = ctx.estSpecSplit(vm.runInContext("revStripBody", ctx)("NVDA", { rows, sum, est }, 2026));
  assert.ok(!/sc-rvs-note/.test(split.html)); assert.ok(split.notes.some((n) => /analyst_estimates_daily/.test(n)));
});

/* ---------- the firm swipe ---------- */
const NOW = Date.parse("2026-10-03T14:00:00Z");
const nv = [
  { kind: "TARGET", published_utc: "2026-10-02T09:25:00+00:00", firm: "Wells Fargo", analyst: "Aaron Rakers", target: 210, adj_target: 210, price_when_posted: 230.86, title: "Wells Fargo lowers Nvidia price target to $210 from $265" },
  { kind: "TARGET", published_utc: "2026-06-01T12:00:00+00:00", firm: "Wells Fargo", target: 265, adj_target: 265, title: "x" },
  { kind: "TARGET", published_utc: "2026-09-20T12:00:00+00:00", firm: "Melius", target: 300, adj_target: 300, title: "y" },
  { kind: "TARGET", published_utc: "2025-12-01T12:00:00+00:00", firm: "Melius", target: 250, adj_target: 250, title: "z" },
  { kind: "TARGET", published_utc: "2026-09-11T12:00:00+00:00", firm: "Citi", target: 999, adj_target: 999, title: "Wall Street's top 10 stock calls this week" },
];
const grades = [
  { published_utc: "2026-10-02T09:25:00+00:00", firm: "Wells Fargo", prior_grade: "Overweight", new_grade: "Equal Weight", action: "downgrade", title: "" },
  { published_utc: "2026-09-25T12:00:00+00:00", firm: "Guggenheim", prior_grade: "Neutral", new_grade: "Buy", action: "upgrade", title: "" },
];
const cNV = { at: NOW, rows: [], hist: nv, grades, est: [], px: [] };
test("the cards: one per firm, newest first; old → new from the headline or the firm's previous note; its rating; a rating-only firm too; roundups out", () => {
  const cards = ctx.estFirmCards(cNV, NOW);
  assert.deepEqual([...cards.map((x) => x.firm)], ["Wells Fargo", "Guggenheim", "Melius"]);
  const [wf, gg, me] = cards;
  assert.equal(wf.prior, 265); assert.equal(wf.src, "headline"); assert.equal(wf.v, 210); assert.equal(wf.dir, -1);
  assert.equal(Math.round(wf.mv * 10) / 10, -20.8, "210 / 265 − 1");
  assert.equal(wf.rating.to, "Equal Weight"); assert.equal(wf.hot, true);
  assert.equal(gg.v, null); assert.equal(gg.rating.to, "Buy");
  assert.equal(me.prior, 250); assert.equal(me.src, "previous note"); assert.equal(me.dir, 1);
  assert.ok(!cards.some((x) => x.firm === "Citi"), "a roundup headline is never a firm's card");
  assert.deepEqual([...ctx.estFirmCards(null, NOW)], []);
});
test("a card shows the date, the firm, old → new, the move in %, the rating, the target against today, a step line", () => {
  const [wf, gg, me] = ctx.estFirmCards(cNV, NOW);
  const h = ctx.estFcardHTML(wf, 2026, 230, "", NOW);
  assert.match(h, /^<div class="sc-fcard hot" role="button" tabindex="0" data-fcard="wellsfargo"/);
  assert.match(h, /<b>2 Oct<\/b><span>1d<\/span>/);
  assert.match(h, /class="fc-fm">Wells Fargo</); assert.match(h, /class="fc-an">Aaron Rakers</);
  assert.match(h, /<span class="dn">\$265 → \$210 ▼<\/span>/);
  assert.match(h, /class="fc-mvp dn">−21%</);
  assert.match(h, /class="fc-rt dn"[^>]*>Overweight → Equal Weight ▼</);
  assert.match(h, /−8\.7% vs now/, "210 / 230 − 1");
  assert.match(h, /<svg viewBox="0 0 150 22"/); assert.match(h, /line[^>]*class="dn"/);
  const g = ctx.estFcardHTML(gg, 2026, 230, "", NOW);
  assert.match(g, /<i>no target<\/i>/); assert.match(g, /class="fc-rt up"[^>]*>Neutral → Buy ▲</);
  assert.match(ctx.estFcardHTML(me, 2026, 230, "melius", NOW), /class="sc-fcard hot on"/, "the open firm is framed");
  const rated = ctx.estFcardHTML({ ...me, ms: Date.parse("2026-10-01T12:00:00Z"), rating: { ms: Date.parse("2026-10-01T12:00:00Z"), to: "Buy", from: "Buy", action: "maintain" } }, 2026, 230, "", NOW);
  assert.match(rated, /<b>1 Oct<\/b>[\s\S]*<div class="fc-tg">[\s\S]*?<\/div><div class="fc-ts">target of 20 Sep<\/div>/, "a newer rating dates the card; the target keeps its own date");
  assert.match(ctx.estFcardHTML({ ...me, prior: null, mv: null, dir: 0 }, 2026, 230, "", NOW), /\$300 <i>first note<\/i>/);
  assert.ok(!/NaN|undefined/.test(h + g));
});
test("FIRMS: the swipe holds every card; a tapped firm's notes open under it; honest loading / empty states", () => {
  ctx.REV_HIST_FIRM.NVDA = "";
  const h = ctx.estFirmsBody("NVDA", cNV, 230, NOW);
  assert.match(h, /^<div class="sc-fsw-box" data-rev-t="NVDA">/);
  assert.match(h, /<span class="n">00b<\/span><span class="t">Firms<\/span>/);
  assert.match(h, /3 firms · newest first · 3 in 30 days/);
  assert.equal((h.match(/class="sc-fcard/g) || []).length, 3);
  assert.match(h, /<div class="sc-fsw" role="list">/);
  ctx.REV_HIST_FIRM.NVDA = "wellsfargo";
  const o = ctx.estFirmsBody("NVDA", cNV, 230, NOW);
  assert.match(o, /sc-rvh-notes/); assert.match(o, /\$265 → \$210 ▼/);
  ctx.REV_HIST_FIRM.NVDA = "";
  assert.match(ctx.estFirmsBody("NVDA", null, 230, NOW), /reading…/);
  assert.match(ctx.estFirmsBody("NVDA", { rows: [], hist: [], grades: [] }, 230, NOW), /No firm notes for \$NVDA/);
  assert.match(ctx.estFirmsBody("NVDA", { err: "x" }, 230, NOW), /could not be read/);
});
test("the swipe moves like the Hub's other swipes: wheel sideways (page scrolls on at an end), mouse drag, a finger natively; a drag is not a tap", () => {
  assert.match(a3, /document\.addEventListener\("wheel", \(e\) => \{[\s\S]*?closest\("\.sc-fsw"\)[\s\S]*?sc\.scrollLeft \+= px;\n  \}, \{ passive: false \}\);/);
  assert.match(a3, /\(px < 0 && sc\.scrollLeft <= 0\) \|\| \(px > 0 && sc\.scrollLeft >= max - 1\)\) return;/, "at an end the wheel goes back to the page");
  assert.match(a3, /if \(e\.pointerType === "touch"\) return;/, "a finger scrolls natively");
  assert.match(a3, /d\.sc\.scrollLeft = d\.l0 - dx; d\.sc\.classList\.add\("is-drag"\);/);
  assert.match(a3, /if \(EST_FSW_MOVED > 4\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); return; \}/);
  assert.match(html, /\.sc-fsw\{ display:flex; gap:8px; overflow-x:auto;/);
  assert.match(html, /case "estsub": \{[\s\S]{0,400}lsSet\(EST_SUB_KEY, S\.estSub\);[\s\S]{0,120}rc4\.innerHTML = coTabHTML\(S\.coData\);/);
  assert.ok(!/sc-rvh-svg|data-rvh-span|revHistHTML\(/.test(html), "the step chart and its switch are gone");
});
test("A3's CSS is greys plus the direction colours, text 11 px and up", () => {
  const a = html.indexOf("/* A3 (3 Oct 2026) · ESTIMATES: the current price target first"), b = html.indexOf("/* SCINTILLA · Rooms 4/5", a);
  assert.ok(a > 0 && b > a);
  const css = html.slice(a, b).replace(/\/\*[\s\S]*?\*\//g, "");
  for (const hex of css.match(/#[0-9A-Fa-f]{6}\b/g) || []) {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, bl) - Math.min(r, g, bl) <= 24 && Math.max(r, g, bl) <= 210, hex + " is a grey");
  }
  assert.ok(!/rgba?\(|#fff\b|:\s*white\b/i.test(css), "no other colour, no white");
  for (const m of css.matchAll(/font(?:-size)?:[^;}]*?(\d+(?:\.\d+)?)px/g)) assert.ok(+m[1] >= 11, "font " + m[0]);
});
test("declared once, and the comps tab is untouched", () => {
  for (const fn of ["estimatesTabHTML", "estPtcBody", "estFirmCards", "estFcardHTML", "estFirmsBody", "estSubStripHTML", "estSpecsHTML", "estA3Paint", "estConvictionHTML"])
    assert.equal(html.split("function " + fn + "(").length - 1, 1, fn);
  assert.ok(!/function estPTGaugeHTML/.test(html), "the old gauge is merged into the target block");
  assert.match(html, /import\("\/deliverables\/20261001\/comps-mechanic\/tab\.mjs"\)/);
});
