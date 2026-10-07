/* Scintilla · CP2 (7 Oct 2026) · the CARDS tab of the company view: the decision card of one name.

   Reads ONE record per name — the shape of data/cards.json → cards.<TICKER>, which is also what a row of
   public.decision_cards would hold in `card` (CP1's migration, proposed, not applied):
     from the dated file  /deliverables/20261007/cards-tab/data/cards.json           (the default)
     from the table       decision_cards, newest row per name                         (opts.fromTable — the switch)
   Order on the card: THE BUSINESS (two pies · five chips · the blend · the same business side by side) · FUNDAMENTALS
   (growth · the estimates block with the flag line on top · the comps range) · TECHNICALS · LEVELS (the confluence
   zones, nearest first) · RISK · THE PLAN · PAGE SPECS.
   Nothing is computed here but pixels: every figure is in the record (business.mjs and card-parts.mjs made them).
   No descriptions in the content: labels, units and numbers only; every sentence sits in PAGE SPECS.
   The ticker, name and price are NOT repeated: the Hub's header shows them once. */

export const CARDS_URL = "/deliverables/20261007/cards-tab/data/cards.json";
/* The box's own width decides the layout (the Hub scales the company view, so the screen's width says nothing): below
   NARROW_BELOW it is a phone (three chips to a row, a short zones table); from WIDE_FROM the two pies sit side by side. */
export const NARROW_BELOW = 400, WIDE_FROM = 620, ZONES_FIVE_FROM = 700;
export const TABLE_PATH = (tickers) => "decision_cards?ticker=in.(" + tickers.map(encodeURIComponent).join(",") + ")&select=ticker,card_date,built_utc,card&order=card_date.desc,built_utc.desc&limit=" + Math.max(20, tickers.length * 8);

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const day = (iso) => { const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? +m[3] + " " + MON[+m[2] - 1] + " " + m[1] : "—"; };
const dayShort = (iso) => { const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? +m[3] + " " + MON[+m[2] - 1] : "—"; };
const dayS = (iso) => day(iso).replace(/[A-Z]{3}/, (m) => m[0] + m.slice(1).toLowerCase());   // "3 Jul 2026", for sentences
const par = (neg, s) => (neg ? "(" + s + ")" : s);
/** dollars in billions / millions; negatives in parentheses */
export const money = (v) => { if (num(v) == null) return "—"; const a = Math.abs(v); return par(v < 0, "$" + (a >= 1e12 ? (a / 1e12).toFixed(2) + "T" : a >= 1e11 ? (a / 1e9).toFixed(0) + "B" : a >= 1e10 ? (a / 1e9).toFixed(1) + "B" : a >= 1e9 ? (a / 1e9).toFixed(2) + "B" : (a / 1e6).toFixed(0) + "M")); };
/** a share or a margin: no plus sign, negatives in parentheses */
export const pctPlain = (v, d = 1) => (num(v) == null ? "—" : par(v < 0, Math.abs(v).toFixed(Math.abs(v) >= 100 ? 0 : d) + "%"));
/** cents per dollar of stock */
export const cents = (v) => (num(v) == null ? "—" : par(v < 0, Math.abs(v).toFixed(Math.abs(v) >= 10 ? 1 : 2) + "¢"));
const signed = (v, d = 1, unit = "%") => (num(v) == null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(d) + unit);
const dir = (v) => (num(v) == null || v === 0 ? "" : v > 0 ? " up" : " dn");
const sp = (v, d = 1, unit = "%") => '<span class="' + dir(v).trim() + '">' + signed(v, d, unit) + "</span>";
const px = (v) => (num(v) == null ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const usd0 = (v) => (num(v) == null ? "—" : "$" + Math.round(v).toLocaleString("en-US"));
const mult = (v) => (num(v) == null ? "—" : Math.abs(v) < 10 ? v.toFixed(2) + "×" : v.toFixed(0) + "×");
const ordinal = (n) => { n = Math.round(n); const t = n % 100; return n + (t >= 10 && t <= 20 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"); };

export const CSS = `
.cd{font-family:var(--mono);color:var(--ink2);font-size:11px;line-height:1.5;letter-spacing:.02em;text-transform:none}
.cd *{box-sizing:border-box;min-width:0}
.cd .up{color:var(--bull)}.cd .dn{color:var(--bear)}
.cd .sec{background:var(--panel);padding:9px 12px 10px;margin-bottom:6px;overflow:hidden}
.cd .cd-h{font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:var(--ink);font-weight:600;margin:0 0 6px;display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline}
.cd .cd-h small{font-size:9px;letter-spacing:.1em;color:var(--dim);font-weight:400}
.cd .k{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
.cd .cd-src{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);padding:1px 2px 6px;display:flex;flex-wrap:wrap;gap:2px 12px;align-items:center}
.cd .cd-src b{color:var(--ink2);font-weight:600}
.cd .par{display:inline-block;font-size:9px;letter-spacing:.1em;padding:1px 6px;background:rgba(0,212,255,.1);color:var(--ink2);margin-left:4px;cursor:pointer;border:0;font-family:inherit}
.cd .par:hover{color:var(--ink)}
/* the pies */
.cd .cd-pies{display:grid;grid-template-columns:minmax(0,1fr);gap:10px 22px}
.cd.wide .cd-pies{grid-template-columns:repeat(2,minmax(0,1fr))}
.cd .cd-pie{display:grid;grid-template-columns:76px minmax(0,1fr);gap:3px 12px;align-items:center}
.cd .cd-pt{grid-column:1 / -1;font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink3)}
.cd .cd-pt b{color:var(--ink);font-weight:600}
.cd .cd-pn{grid-column:1 / -1;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3)}
.cd .cd-pn::before{content:"▸ ";color:var(--crk)}
.cd .cd-pie svg{display:block;width:76px;height:76px}
.cd .cd-pie path.w,.cd .cd-pie circle.w{stroke:var(--panel);stroke-width:2;vector-effect:non-scaling-stroke}
.cd .w.dc{fill:var(--crk)}.cd .w.g0{fill:#A9ABC8}.cd .w.g1{fill:#7C7FA0}.cd .w.g2{fill:#5C5F7E}.cd .w.g3{fill:#454763}.cd .w.g4{fill:#34364E}.cd .w.g5{fill:#2A2B40}
.cd .cd-pie .nopie{fill:none;stroke:var(--mute);stroke-width:1.5;stroke-dasharray:3 4}
.cd .cd-lg{list-style:none;margin:0;padding:0;font-variant-numeric:tabular-nums}
.cd .cd-lg li{display:grid;grid-template-columns:9px minmax(0,1fr) auto auto;gap:0 7px;align-items:baseline;padding:1px 0;font-size:10.5px;color:var(--ink2)}
.cd .cd-lg li i{display:block;width:9px;height:9px;align-self:start;margin-top:3px}
.cd .cd-lg li i.dc{background:var(--crk)}.cd .cd-lg li i.g0{background:#A9ABC8}.cd .cd-lg li i.g1{background:#7C7FA0}.cd .cd-lg li i.g2{background:#5C5F7E}.cd .cd-lg li i.g3{background:#454763}.cd .cd-lg li i.g4{background:#34364E}.cd .cd-lg li i.g5{background:#2A2B40}
.cd .cd-lg li span{overflow-wrap:anywhere;line-height:1.3}
.cd.narrow .cd-lg li{grid-template-columns:9px minmax(0,1fr) auto}.cd.narrow .cd-lg li em{display:none}
.cd .cd-lg li.dc span{color:var(--ink);font-weight:600}
.cd .cd-lg li b{color:var(--ink);font-weight:600;text-align:right}
.cd .cd-lg li em{font-style:normal;color:var(--dim);text-align:right;font-size:9.5px}
.cd .cd-lg .none{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}
/* the chips: no frames, a number over a thin cyan bar */
.cd .cd-chips{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px 10px;margin-top:12px}
.cd.narrow .cd-chips{grid-template-columns:repeat(3,minmax(0,1fr))}
.cd .cd-chip .k{display:block;line-height:1.3;min-height:22px;font-size:8.5px;letter-spacing:.08em}
.cd .cd-chip b{display:block;font-size:16px;font-weight:700;color:var(--ink);line-height:1.15;letter-spacing:0;white-space:nowrap}
.cd.wide .cd-chip .k{font-size:9px;letter-spacing:.14em}.cd.wide .cd-chip b{font-size:18px}
.cd .cd-chip b small{font-size:10px;font-weight:400;color:var(--crk);margin-left:4px;cursor:help}
.cd .cd-chip u{display:block;height:3px;background:rgba(0,212,255,.14);margin-top:4px;text-decoration:none}
.cd .cd-chip u s{display:block;height:100%;background:var(--crk);text-decoration:none}
.cd .cd-chip.no b{color:var(--mute);font-weight:400}
.cd .cd-per{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin-top:8px;display:flex;flex-wrap:wrap;gap:2px 14px}
.cd .cd-per b{color:var(--ink3);font-weight:400}
/* the blend */
.cd .cd-blend{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:12px}
.cd .cd-bl{background:rgba(0,212,255,.07);padding:8px 10px;cursor:help}
.cd .cd-bl .k{display:block;color:var(--ink3);min-height:27px;line-height:1.5}
.cd .cd-bl b{display:block;font-size:26px;font-weight:700;color:var(--ink);line-height:1.1;letter-spacing:-.01em}
.cd .cd-bl.no b{color:var(--mute);font-weight:400}
.cd .cd-bl u{display:block;height:4px;background:rgba(0,212,255,.14);margin-top:5px;text-decoration:none}.cd .cd-bl u s{display:block;height:100%;background:var(--crk);text-decoration:none}
/* the same business, side by side */
.cd table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
.cd th{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);font-weight:400;padding:4px 6px;text-align:right;white-space:nowrap;vertical-align:bottom}
.cd td{padding:3px 6px;text-align:right;color:var(--ink2);font-size:11px;vertical-align:middle}
.cd th:first-child,.cd td:first-child{text-align:left;padding-left:0}
.cd .cd-side{margin-top:12px}
.cd .cd-side th{white-space:normal;line-height:1.3}
.cd .cd-side td.tk{color:var(--ink);font-weight:600;letter-spacing:.04em;white-space:nowrap}
.cd .cd-side td.tk button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;letter-spacing:inherit}
.cd .cd-side td.tk button:hover{color:var(--crk)}
.cd .cd-side tr.me td{background:rgba(0,212,255,.09);color:var(--ink)}.cd .cd-side tr.me td.tk{color:var(--crk)}
.cd .cd-side td .bar{display:block;height:3px;background:rgba(0,212,255,.12);margin-top:2px}.cd .cd-side td .bar s{display:block;height:100%;background:var(--crk);margin-left:auto}
.cd .cd-side td.no{color:var(--mute)}
/* fundamentals */
.cd .cd-kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px 14px;margin:8px 0 2px}
.cd .cd-kv>div{display:flex;flex-direction:column}
.cd .cd-kv b{font-size:11.5px;color:var(--ink);font-weight:600}
.cd .cd-flag{margin:10px 0 2px;padding:7px 9px;background:rgba(0,212,255,.05);font-size:10.5px;line-height:1.6;color:var(--ink2)}
.cd .cd-flag .fc{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px}
.cd .cd-flag .f{display:inline-block;font-size:9px;letter-spacing:.12em;text-transform:uppercase;padding:1px 6px;background:rgba(134,138,170,.16);color:var(--ink3)}
.cd .cd-flag .f.warn{background:rgba(255,45,85,.14);color:var(--bear);font-weight:600}
.cd .cd-flag .f.ok{background:rgba(0,255,163,.11);color:var(--bull);font-weight:600}
.cd .cd-flag .fp{display:block}.cd .cd-flag .fp i{font-style:normal;color:var(--dim);margin:0 2px}
.cd .cd-flag.not{color:var(--dim);font-size:9px;letter-spacing:.12em;text-transform:uppercase}
.cd .cd-band{display:flex;align-items:baseline;gap:6px 12px;flex-wrap:wrap;margin-top:12px}
.cd .cd-band b{font-size:20px;font-weight:700;color:var(--ink);line-height:1}
.cd .cd-sub{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);margin:3px 0 4px}
.cd .cd-cf{display:inline-block;font-size:9px;letter-spacing:.1em;text-transform:uppercase;padding:1px 6px;background:rgba(134,138,170,.16);color:var(--ink3);margin:0 4px 4px 0}
.cd .cd-nopeer{margin-top:12px;padding:7px 9px;background:rgba(134,138,170,.14);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink);font-weight:600}
.cd .ff svg{display:block;width:100%;height:auto;overflow:visible}
.cd .ff text{font-family:var(--mono);font-size:11px;fill:var(--ink3)}
.cd .ff .l{fill:var(--ink3)}.cd .ff .f{fill:var(--mute)}.cd .ff .i{fill:var(--ink)}.cd .ff .d{fill:var(--dim)}
.cd .ff .bar{fill:rgba(0,212,255,.3)}.cd .ff .mid{fill:var(--crk)}.cd .ff .band{fill:rgba(0,212,255,.5)}.cd .ff .off{fill:rgba(134,138,170,.22)}.cd .ff .offm{fill:var(--mute)}
.cd .ff .ws{fill:rgba(134,138,170,.35)}.cd .ff .wsm{fill:var(--dim)}.cd .ff .pl{stroke:var(--ink);stroke-width:1;stroke-dasharray:3 3}
/* technicals */
.cd .cd-two{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px 22px;margin-bottom:6px}
.cd .cd-g{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.cd .cd-g b{font-size:17px;font-weight:700;color:var(--ink);line-height:1.1}
.cd .gb{display:block;width:100%;max-width:320px;height:22px}
.cd .gb .tr{fill:rgba(134,138,170,.16)}.cd .gb .own{fill:rgba(134,138,170,.42)}.cd .gb .md{fill:var(--dim)}.cd .gb .me{fill:var(--crk)}
.cd .cd-ma td,.cd .cd-ma th{text-align:right}.cd .cd-ma td small{display:block;font-size:10px}
/* levels: one grid row per zone; on a phone the members go on a second line */
.cd .cd-zones{font-variant-numeric:tabular-nums}
.cd .cd-zones .zh,.cd .cd-zones .zr{display:grid;gap:0 10px;align-items:start;padding:4px 0}
.cd .cd-zones.c5 .zh,.cd .cd-zones.c5 .zr{grid-template-columns:142px minmax(0,1fr) 58px 96px 78px}
.cd .cd-zones.c4 .zh,.cd .cd-zones.c4 .zr{grid-template-columns:136px minmax(0,1fr) 54px 44px}
.cd .cd-zones.c3 .zh,.cd .cd-zones.c3 .zr{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"z d" "m m"}
.cd .cd-zones.c3 .z{grid-area:z}.cd .cd-zones.c3 .d{grid-area:d}.cd .cd-zones.c3 .m{grid-area:m;padding-left:13px}
.cd .cd-zones .zh span{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}
.cd .cd-zones .zr{border-top:1px solid rgba(134,138,170,.1);font-size:11px;color:var(--ink2)}
.cd .cd-zones .z{color:var(--ink);font-weight:600;white-space:nowrap}
.cd .cd-zones .z i{display:inline-block;width:7px;height:7px;margin-right:6px;vertical-align:1px}
.cd .cd-zones .z i.above{background:var(--bear)}.cd .cd-zones .z i.below{background:var(--bull)}.cd .cd-zones .z i.at{background:var(--ink3)}
.cd .cd-zones .m{color:var(--ink);line-height:1.55}.cd .cd-zones .m span{display:inline-block;white-space:nowrap;margin-right:14px}.cd .cd-zones .m em{font-style:normal;color:var(--dim);margin-left:5px}
.cd .cd-zones .d,.cd .cd-zones .s,.cd .cd-zones .l{text-align:right;white-space:nowrap}
.cd .cd-zones .zh .d,.cd .cd-zones .zh .l,.cd .cd-zones .zh .s{white-space:normal;line-height:1.3}
.cd .cd-near{font-size:10px;color:var(--ink3);margin-top:8px;display:flex;flex-wrap:wrap;gap:2px 16px}.cd .cd-near b{color:var(--ink);font-weight:600}
/* the plan */
.cd .cd-pl{display:grid;grid-template-columns:150px minmax(0,1fr);gap:10px;padding:4px 0;border-bottom:1px dashed var(--line2);font-size:11px;color:var(--ink)}
.cd.narrow .cd-pl{grid-template-columns:112px minmax(0,1fr)}
.cd .cd-pl .blank{color:var(--mute)}
/* no card */
.cd .cd-none{padding:14px 12px;background:var(--panel)}
.cd .cd-none .t{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--ink);font-weight:600;margin-bottom:10px}
.cd .cd-none .lst{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.cd .cd-none button{font:inherit;font-size:10px;letter-spacing:.08em;padding:3px 8px;background:rgba(0,212,255,.08);border:0;color:var(--ink2);cursor:pointer}
.cd .cd-none button:hover{color:#061015;background:var(--crk)}
.cd .cd-err{padding:10px 12px;color:var(--bear);font-size:10.5px}
.cd .loading{color:var(--ink3);font-size:10px;padding:12px 2px;letter-spacing:.2em}
/* PAGE SPECS */
.cd details.sc-pagespecs{margin-top:10px;background:var(--panel2);font-size:11px;line-height:1.6;color:var(--ink3)}
.cd details.sc-pagespecs > summary{cursor:pointer;padding:8px 12px;font-size:9px;letter-spacing:.24em;text-transform:uppercase;color:var(--dim);list-style:none}
.cd details.sc-pagespecs > summary::-webkit-details-marker{display:none}
.cd details.sc-pagespecs > div{padding:2px 14px 12px;font-family:var(--sans);letter-spacing:0}
.cd details.sc-pagespecs p{margin:7px 0}.cd details.sc-pagespecs b{color:var(--ink2);font-weight:600}`;

function ensureCSS() { if (typeof document !== "undefined" && !document.getElementById("cd-css")) { const s = document.createElement("style"); s.id = "cd-css"; s.textContent = CSS; document.head.appendChild(s); } }

/* ------------------------------------------------------------------ the pies */
const GREY = ["g0", "g1", "g2", "g3", "g4", "g5"];
/** the class of each slice: the data-centre slice is cyan, the rest step down in grey by size */
export function sliceClasses(slices) { let g = 0; return slices.map((s) => (s.dc ? "dc" : GREY[Math.min(g++, GREY.length - 1)])); }
/** one wedge of a pie centred at 50,50 radius r, from fraction a0 to a1 of the circle, clockwise from 12 o'clock */
export function wedgePath(a0, a1, r = 46) {
  const p = (a) => { const t = a * 2 * Math.PI - Math.PI / 2; return [(50 + r * Math.cos(t)).toFixed(2), (50 + r * Math.sin(t)).toFixed(2)]; };
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return "M50 50 L" + x0 + " " + y0 + " A" + r + " " + r + " 0 " + (a1 - a0 > 0.5 ? 1 : 0) + " 1 " + x1 + " " + y1 + " Z";
}
function pieHTML(p, title, emptyWord) {
  if (!p || !p.slices || !p.slices.length)
    return '<div class="cd-pie"><div class="cd-pt"><b>' + esc(title) + '</b></div><svg viewBox="0 0 100 100" role="img" aria-label="' + esc(title) + ': no split"><circle class="nopie" cx="50" cy="50" r="45"/></svg><ul class="cd-lg"><li class="none" style="display:block">' + esc(emptyWord) + "</li></ul></div>";
  const cls = sliceClasses(p.slices), tot = p.slices.reduce((s, x) => s + x.revenue, 0);
  let a = 0; const parts = [];
  p.slices.forEach((s, i) => {
    const f = s.revenue / tot, tip = s.label + " · " + pctPlain(s.share) + " · " + money(s.revenue) + " · FMP's label: " + s.fmp;
    parts.push(p.slices.length === 1 ? '<circle class="w ' + cls[i] + '" cx="50" cy="50" r="46"><title>' + esc(tip) + "</title></circle>"
      : '<path class="w ' + cls[i] + '" d="' + wedgePath(a, a + f) + '"><title>' + esc(tip) + "</title></path>");
    a += f;
  });
  const notes = [];
  if (p.behind) notes.push("A YEAR BEHIND · THE STATEMENTS ARE FISCAL " + p.newest_fy);
  if (p.partial && p.covers_pct != null) notes.push("ADDS TO " + p.covers_pct + "% OF THE YEAR'S REVENUE");
  return '<div class="cd-pie"><div class="cd-pt"><b>' + esc(title) + "</b> · FISCAL " + esc(p.fy) + " · TO " + esc(day(p.date)) + "</div>" +
    '<svg viewBox="0 0 100 100" role="img" aria-label="' + esc(title + ", fiscal " + p.fy + ": " + p.slices.map((s) => s.label + " " + pctPlain(s.share)).join(", ")) + '">' + parts.join("") + "</svg>" +
    '<ul class="cd-lg">' + p.slices.map((s, i) => '<li class="' + (s.dc ? "dc" : "") + '" title="' + esc("FMP's label: " + s.fmp) + '"><i class="' + cls[i] + '"></i><span>' + esc(s.label) + "</span><b>" + pctPlain(s.share) + "</b><em>" + money(s.revenue) + "</em></li>").join("") + "</ul>" +
    (notes.length ? '<div class="cd-pn">' + esc(notes.join(" · ")) + "</div>" : "") + "</div>";
}

/* ------------------------------------------------------------------ the chips and the blend */
const periodWord = (per) => !per ? "—" : per.basis === "q4" ? "12 MONTHS TO " + day(per.end) : "FISCAL " + per.fy + " · TO " + day(per.end) + (per.basis === "fy_older" ? " · NO NEWER QUARTERS" : "");
const periodSentence = (per) => !per ? "no period on file" : per.basis === "q4" ? "the 12 months to " + dayS(per.end) + " (four quarters added)" : "fiscal " + per.fy + ", to " + dayS(per.end);
const cashWord = (k, per) => (k.basis === "fy" ? "FISCAL " + String(k.end).slice(0, 4) + " · TO " + day(k.end) : "12 MONTHS TO " + day(k.end));
const basisWord = (k) => (k === "fy" ? "the full-year statement" : "four quarters added");
function chip(label, value, frac, title, mark) {
  const no = value === "—";
  return '<div class="cd-chip' + (no ? " no" : "") + '"' + (title ? ' title="' + esc(title) + '"' : "") + '><span class="k">' + esc(label) + "</span><b>" + esc(value) + (mark ? "<small>" + esc(mark) + "</small>" : "") + "</b><u><s style=\"width:" + (num(frac) == null ? 0 : Math.max(0, Math.min(100, frac * 100)).toFixed(1)) + '%"></s></u></div>';
}
export function dcTitle(b) {
  const dc = b.data_centre || {};
  if (dc.share == null) return "No data-centre figure: " + (dc.why || "not reported") + ".";
  if (dc.basis === "stated") return "Approximate. The company's own words, " + dc.call + ": “" + dc.quote + "” — " + dc.why + ". FMP's split has no data-centre line for this company.";
  return "Of fiscal " + dc.fy + " revenue. Counts FMP's line" + (dc.counts.length > 1 ? "s" : "") + ": " + dc.counts.join(", ") + (dc.why ? " — " + dc.why : "") + "." + (dc.note ? " " + dc.note + "." : "");
}
export function cashTitle(b) {
  const k = b.cash || {};
  if (num(k.fcf) == null) return "No free-cash-flow figure: " + (k.why || "not on file") + ".";
  let t = "Free cash flow " + money(k.fcf) + " = cash from operations " + money(k.ocf) + " less capital spending " + money(Math.abs(k.capex || 0)) + ", on " + basisWord(k.basis) + " to " + dayS(k.end) + ".";
  if (k.differs && k.other) t += " FMP's other reading for the same twelve months, " + basisWord(k.other.basis) + ", is " + money(k.other.fcf) + " (" + signed(k.differs_pct, 0) + ")" + (k.other.bad ? ": " + k.other.bad : "") + ".";
  if (k.older) t += " This is an older twelve months than the margins.";
  if (k.note) t += " " + k.note.charAt(0).toUpperCase() + k.note.slice(1) + ".";
  return t;
}
export function blendTitles(b) {
  const bl = b.blend || {}, dc = b.data_centre || {}, per = b.period || {};
  const dcT = num(bl.dc_profit_per_dollar) == null
    ? "No figure: " + (bl.why_dc || "not reported") + "."
    : "For every $1 of the stock's market value, " + cents(bl.dc_profit_per_dollar) + " a year of gross profit on data-centre sales: data-centre share " + (dc.approx ? "about " : "") + pctPlain(dc.share, dc.approx ? 0 : 1) + " × revenue " + money(per.revenue) + " × gross margin " + pctPlain(bl.gross_margin) + " ÷ market value " + money(bl.market_value) + ". Segment margins are not reported, so the company's gross margin is applied." + (dc.approx ? " The share is the company's own figure from its " + dc.call + ", so this is approximate." : "");
  const cT = num(bl.cash_per_dollar) == null
    ? "No figure: " + (bl.why_cash || "not on file") + "."
    : "For every $1 of the stock's market value, " + cents(bl.cash_per_dollar) + " a year of free cash flow: " + money((b.cash || {}).fcf) + " ÷ market value " + money(bl.market_value) + ". The free-cash-flow yield, in cents.";
  return { dc: dcT, cash: cT };
}
function chipsHTML(b, cardDate) {
  const dc = b.data_centre || {}, m = b.margins || {}, k = b.cash || {};
  const why = m.why ? m.why.charAt(0).toUpperCase() + m.why.slice(1) + "." : "";
  const mark = k.differs ? "≠" : k.older ? "OLDER" : "";
  return '<div class="cd-chips">' +
    chip("DATA-CENTRE SHARE", dc.share == null ? "—" : (dc.approx ? "≈" : "") + pctPlain(dc.share, dc.approx ? 0 : 1), dc.share == null ? null : dc.share / 100, dcTitle(b)) +
    chip("GROSS MARGIN", pctPlain(m.gross), m.gross == null ? null : m.gross / 100, why || "Gross profit " + money((b.period || {}).gross_profit) + " over revenue " + money((b.period || {}).revenue) + ", " + periodSentence(b.period) + ".") +
    chip("OPERATING MARGIN", pctPlain(m.operating), m.operating == null ? null : m.operating / 100, why || "Operating income " + money((b.period || {}).operating_income) + " over revenue " + money((b.period || {}).revenue) + ", " + periodSentence(b.period) + ".") +
    chip("FREE-CASH-FLOW MARGIN", pctPlain(k.margin), k.margin == null ? null : k.margin / 100, cashTitle(b), mark) +
    chip("FREE-CASH-FLOW YIELD", pctPlain(k.yield, 2), k.yield == null ? null : k.yield / 10, cashTitle(b) + (num(k.yield) != null ? " Over the market value " + money(b.market_value) + "." : ""), mark) +
    "</div>" +
    '<div class="cd-per">' + (m.why ? "<span>MARGINS AND CASH · <b>" + esc(m.why.replace(": ", " · ").toUpperCase()) + "</b></span>" : num(k.fcf) != null && b.period && k.end === b.period.end ? "<span>MARGINS AND CASH · <b>" + esc(periodWord(b.period)) + "</b></span>"
      : "<span>MARGINS · <b>" + esc(periodWord(b.period)) + "</b></span>" + (num(k.fcf) != null ? "<span>CASH · <b>" + esc(cashWord(k, b.period)) + "</b></span>" : "")) +
    "<span>MARKET VALUE · <b>" + money(b.market_value) + " AT THE " + esc(dayShort(cardDate)) + " CLOSE</b></span>" +
    (dc.basis === "stated" ? "<span>≈ · <b>THE COMPANY'S OWN WORDS, " + esc(String(dc.call).toUpperCase()) + "</b></span>" : "") +
    (dc.note ? "<span>DATA CENTRE · <b>" + esc(String(dc.counts.join(" + ")).toUpperCase()) + ", ONE LINE IN FMP</b></span>" : "") +
    (k.differs && k.other ? "<span>≠ · <b>FMP'S OTHER CASH READING " + money(k.other.fcf) + " · " + (k.other.basis === "fy" ? "FULL-YEAR STATEMENT" : "FOUR QUARTERS ADDED") + "</b></span>" : "") +
    (k.older && num(k.fcf) != null ? "<span>CASH · <b>AN OLDER TWELVE MONTHS THAN THE MARGINS</b></span>" : "") +
    (!m.why && num(k.fcf) == null && k.why ? "<span>CASH · <b>" + esc(String(k.why).toUpperCase()) + "</b></span>" : "") + "</div>";
}
function blendHTML(b) {
  const bl = b.blend || {}, t = blendTitles(b), scale = 10;   // the bars: ten cents per dollar fills the track
  const one = (label, v, approx, title) => '<div class="cd-bl' + (num(v) == null ? " no" : "") + '" title="' + esc(title) + '"><span class="k">' + esc(label) + "</span><b>" + (num(v) == null ? "—" : (approx ? "≈" : "") + cents(v)) + "</b><u><s style=\"width:" + (num(v) == null ? 0 : Math.max(0, Math.min(100, (v / scale) * 100)).toFixed(1)) + '%"></s></u></div>';
  return '<div class="cd-blend">' + one("DATA-CENTRE PROFIT PER DOLLAR OF STOCK", bl.dc_profit_per_dollar, bl.approx, t.dc) + one("CASH PER DOLLAR OF STOCK", bl.cash_per_dollar, false, t.cash) + "</div>";
}
function sideHTML(card, all) {
  const list = (card.business.side_by_side || []).filter((t) => all[t] && all[t].business);
  if (list.length < 2) return "";
  const rows = list.map((t) => ({ t, b: all[t].business }));
  if (!rows.some((r) => [r.b.data_centre.share, r.b.margins.gross, r.b.blend.dc_profit_per_dollar, r.b.blend.cash_per_dollar].some((v) => num(v) != null))) return "";   // all dashes: no table
  const max = (f) => Math.max(0.0001, ...rows.map((r) => Math.max(0, num(f(r.b)) || 0)));
  const cols = [
    ["DATA-CENTRE SHARE", (b) => b.data_centre.share, (b) => (b.data_centre.share == null ? "—" : (b.data_centre.approx ? "≈" : "") + pctPlain(b.data_centre.share, b.data_centre.approx ? 0 : 1)), dcTitle],
    ["GROSS MARGIN", (b) => b.margins.gross, (b) => pctPlain(b.margins.gross), () => ""],
    ["DATA-CENTRE PROFIT PER $1 OF STOCK", (b) => b.blend.dc_profit_per_dollar, (b) => (b.blend.dc_profit_per_dollar == null ? "—" : (b.blend.approx ? "≈" : "") + cents(b.blend.dc_profit_per_dollar)), (b) => blendTitles(b).dc],
    ["CASH PER $1 OF STOCK", (b) => b.blend.cash_per_dollar, (b) => cents(b.blend.cash_per_dollar), (b) => blendTitles(b).cash],
  ];
  const mx = cols.map((c) => max(c[1]));
  return '<table class="cd-side"><thead><tr><th>SAME BUSINESS</th>' + cols.map((c) => "<th>" + c[0] + "</th>").join("") + "</tr></thead><tbody>" +
    rows.map((r) => '<tr class="' + (r.t === card.ticker ? "me" : "") + '"><td class="tk">' + (r.t === card.ticker ? esc(r.t) : '<button type="button" data-cd-open="' + esc(r.t) + '" title="open ' + esc(r.t) + '">' + esc(r.t) + "</button>") + "</td>" +
      cols.map((c, i) => { const v = num(c[1](r.b)); return '<td class="' + (v == null ? "no" : "") + '" title="' + esc(c[3](r.b)) + '">' + c[2](r.b) + '<span class="bar"><s style="width:' + (v == null ? 0 : Math.max(0, (v / mx[i]) * 100).toFixed(1)) + '%"></s></span></td>'; }).join("") + "</tr>").join("") +
    "</tbody></table>";
}
function businessHTML(card, all) {
  const b = card.business;
  if (!b) return '<div class="sec cd-biz"><div class="cd-h">THE BUSINESS</div><div class="k">NO BUSINESS FACTS ON FILE FOR ' + esc(card.ticker) + "</div></div>";
  return '<div class="sec cd-biz"><div class="cd-h">THE BUSINESS<small>WHERE THE REVENUE COMES FROM</small></div>' +
    '<div class="cd-pies">' + pieHTML(b.lines, "BY BUSINESS LINE", "FMP CARRIES NO SPLIT BY BUSINESS LINE") + pieHTML(b.regions, "BY REGION", "FMP CARRIES NO SPLIT BY REGION") + "</div>" +
    chipsHTML(b, card.card_date) + blendHTML(b) + sideHTML(card, all) + "</div>";
}

/* ------------------------------------------------------------------ fundamentals */
function growthHTML(f) {
  if (f.why && f.rev_g_ntm == null) return '<div class="k">' + esc(String(f.why).toUpperCase()) + "</div>";
  const yr = (d) => (d ? "FY" + String(d).slice(2, 4) : "—");
  const rows = [["NEXT 12 MONTHS", f.rev_g_ntm, f.eps_g_ntm], ["THIS FISCAL YEAR · " + yr(f.this_fy), f.rev_g_this_fy, f.eps_g_this_fy], ["NEXT FISCAL YEAR · " + yr(f.next_fy), f.rev_g_next_fy, f.eps_g_next_fy], ["TWO YEARS, A YEAR", f.rev_g_2y_a_year, f.eps_g_2y_a_year]];
  return "<table><thead><tr><th>GROWTH</th><th>REVENUE</th><th>EPS</th></tr></thead><tbody>" + rows.map((r) => '<tr><td class="k">' + r[0] + "</td><td>" + pctPlain(r[1], 0) + "</td><td>" + pctPlain(r[2], 0) + "</td></tr>").join("") + "</tbody></table>";
}
export function flagHTML(fl) {
  if (!fl || !fl.checked) return '<div class="cd-flag not">ESTIMATES NOT YET CHECKED AGAINST THE COMPANY\'S GUIDANCE</div>';
  const bit = (x) => (x.dot ? "<i>·</i>" : x.t != null ? esc(x.t) : sp(x.pct, 0));
  return '<div class="cd-flag"><div class="fc">' + fl.chips.map((c) => '<span class="f ' + esc(c.tone) + '">' + esc(c.word) + "</span>").join("") + "</div>" +
    fl.parts.map((p) => '<span class="fp">' + p.bits.map(bit).join(" ") + "</span>").join("") + "</div>";
}
function estHTML(f, fl) {
  const t = f.targets_30d || {}, lr = f.last_report || {}, nr = f.next_report || {};
  const bits = [["FORWARD P/E", mult(f.fwd_pe)], ["FY EPS ESTIMATE · SINCE " + (f.revision_from ? dayShort(f.revision_from) : "—"), f.revision_fy1_eps_pct != null ? sp(f.revision_fy1_eps_pct, 1) : "—"],
    ["TARGETS · 30 DAYS", '<span class="up">' + (t.raised || 0) + ' raised</span> · <span class="dn">' + (t.lowered || 0) + " lowered</span>"], ["AVERAGE TARGET", f.target_avg ? usd0(f.target_avg) + " · " + sp(f.target_vs_price_pct, 0) : "—"],
    ["LAST REPORT · " + (lr.date ? day(lr.date) : "—"), lr.date ? "EPS " + sp(lr.surprise_pct, 1) + " · revenue " + sp(lr.rev_surprise_pct, 1) : "—"], ["NEXT REPORT", nr.date ? day(nr.date) + " · " + nr.days + " days" : "—"]];
  return '<div class="cd-h" style="margin-top:12px">ESTIMATES</div>' + flagHTML(fl) + '<div class="cd-kv">' + bits.map((b) => '<div><span class="k">' + b[0] + "</span><b>" + b[1] + "</b></div>").join("") + "</div>";
}
/** the comps range, CP1's football field, drawn at the width it is shown at so its text stays its own size */
export function footballSVG(card, W) {
  const r = card.comps, price = card.price, big = W >= 560;
  const rows = Object.entries(r.rows || {}).filter(([, v]) => num(v.price) != null);
  const band = r.centre ? [r.low, r.centre, r.high] : r.peers_say ? [r.peers_say.lo, r.peers_say.centre, r.peers_say.hi] : [null, null, null];
  const ws = (r.whole_set && r.whole_set.band) || null;
  const xs = [price, ...band.filter(Boolean), ...rows.flatMap(([, v]) => [v.q1, v.q3, v.price].filter(Boolean))];
  const lo = Math.min(...xs) * 0.86, hi = Math.min(Math.max(...xs) * 1.06, price * 5);
  const LW = big ? 214 : 150, RW = big ? 122 : 60, rh = big ? 22 : 19;
  const X = (v) => LW + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (W - LW - RW);
  const m1 = big ? mult : (v) => (num(v) == null ? "—" : Math.abs(v) < 10 ? v.toFixed(1) + "×" : v.toFixed(0) + "×");
  const SHORT = { "P/E, trailing": "P/E", "P/E trailing": "P/E", "P/E, forward": "P/E FWD", "P/E forward": "P/E FWD", "EV / EBITDA": "EV/EBITDA", "EV / sales": "EV/S", "EV/sales": "EV/S" };
  const H = 24 + rh * rows.length + (band[1] ? 56 : 28) + (ws ? 24 : 0), o = [];
  let y = 13;
  for (const [, v] of rows) {
    const off = !!v.off, q1 = v.q1 || v.price, q3 = v.q3 || v.price, m = v.price;
    o.push('<text x="0" y="' + (y + 4) + '" class="' + (off ? "f" : "l") + '">' + esc((big ? v.label : SHORT[v.label] || v.label).toUpperCase()) + '</text><text x="' + (LW - 10) + '" y="' + (y + 4) + '" class="f" text-anchor="end">' + m1(v.own) + " v " + m1(v.median) + "</text>");
    o.push('<rect class="' + (off ? "off" : "bar") + '" x="' + X(Math.min(q1, q3)).toFixed(1) + '" y="' + (y - 4) + '" width="' + Math.max(2, Math.abs(X(q3) - X(q1))).toFixed(1) + '" height="8"/><rect class="' + (off ? "offm" : "mid") + '" x="' + (X(m) - 1.5).toFixed(1) + '" y="' + (y - 6) + '" width="3" height="12"/>');
    if (m > hi) o.push('<text x="' + (W - RW - 2) + '" y="' + (y + 4) + '" class="' + (off ? "f" : "l") + '" text-anchor="end">▸</text>');
    o.push('<text x="' + W + '" y="' + (y + 4) + '" class="' + (off ? "f" : "i") + '" text-anchor="end">' + usd0(m) + (off ? (big ? " · left out" : " · out") : big ? " · " + Math.round((v.weight || 0) * 100) + "%" : "") + "</text>");
    y += rh;
  }
  y += 8;
  if (band[1]) {
    const dead = r.priced_on === "none", xl = X(band[0]), xc = X(band[1]), xh = X(band[2]);
    o.push('<rect class="' + (dead ? "off" : "band") + '" x="' + xl.toFixed(1) + '" y="' + y + '" width="' + Math.max(3, xh - xl).toFixed(1) + '" height="16"/><rect class="' + (dead ? "offm" : "mid") + '" x="' + (xc - 2).toFixed(1) + '" y="' + (y - 4) + '" width="4" height="24"/>');
    o.push('<text x="0" y="' + (y + 12) + '" class="' + (dead ? "d" : "i") + '" font-weight="700">' + (dead ? (big ? "PEERS SAY · NOT USED" : "NOT USED") : "THE RANGE") + "</text>");
    o.push('<text x="' + Math.max(big ? 96 : 78, xl - 6).toFixed(1) + '" y="' + (y + 12) + '" class="d" text-anchor="' + (xl - 6 > (big ? 176 : 140) ? "end" : "start") + '">' + (big ? "LOW " : "") + usd0(band[0]) + "</text>");
    o.push('<text x="' + Math.min(W - 2, xh + 6).toFixed(1) + '" y="' + (y + 12) + '" class="d" text-anchor="' + (xh + 6 < W - (big ? 96 : 62) ? "start" : "end") + '">' + (big ? "HIGH " : "") + usd0(band[2]) + "</text>");
    o.push('<text x="' + Math.min(W - 60, Math.max(LW, xc)).toFixed(1) + '" y="' + (y + 36) + '" class="' + (dead ? "d" : "i") + '" text-anchor="middle" font-weight="700">' + (big ? "CENTRE " : "") + usd0(band[1]) + "</text>");
    y += 44;
  }
  if (ws) {
    o.push('<rect class="ws" x="' + X(ws.lo).toFixed(1) + '" y="' + y + '" width="' + Math.max(3, X(ws.hi) - X(ws.lo)).toFixed(1) + '" height="6"/><rect class="wsm" x="' + (X(ws.centre) - 1.5).toFixed(1) + '" y="' + (y - 3) + '" width="3" height="12"/><text x="0" y="' + (y + 7) + '" class="f">WHOLE SET</text><text x="' + W + '" y="' + (y + 7) + '" class="f" text-anchor="end">' + usd0(ws.centre) + (ws.centre > hi ? " ▸" : "") + "</text>");
    y += 22;
  }
  o.push('<line class="pl" x1="' + X(price).toFixed(1) + '" y1="2" x2="' + X(price).toFixed(1) + '" y2="' + (y - 2) + '"/><text x="' + (X(price) + 4).toFixed(1) + '" y="' + (y + 4) + '" class="i">PRICE ' + px(price) + "</text>");
  return '<svg viewBox="0 0 ' + W + " " + (H + 4) + '" role="img" aria-label="' + esc(card.ticker) + ' comps range per share">' + o.join("") + "</svg>";
}
function compsHTML(card, W) {
  const r = card.comps;
  if (!r) return "";
  const head = r.priced_on === "none" ? '<div class="cd-nopeer">NO PEER SET — VALUED ON GROWTH (PEG) AND ESTIMATES</div>'
    : '<div class="cd-band"><span class="k">COMPS CENTRE</span><b>' + usd0(r.centre) + "</b>" + sp(r.upside_pct, 0) + '<span class="k">LOW ' + usd0(r.low) + " · HIGH " + usd0(r.high) + "</span></div>";
  const on = r.priced_on === "business" ? "PRICED ON " + r.n_priced + " SAME-BUSINESS PEERS · " + (r.peers_priced || []).join(" ") : r.priced_on === "set" ? "PRICED ON " + r.n_priced + " PEERS" : "THE PEERS' READING IS SHOWN, NOT USED";
  const was = r.before && r.before.centre ? " · BEFORE THE FIXES " + usd0(r.before.centre) + " · " + signed(r.before.upside_pct, 0) : "";
  const flags = (r.flags || []).filter((f) => f !== "no peer set").map((f) => '<span class="cd-cf">' + esc(f.toUpperCase()) + "</span>").join("");
  return head + '<div class="cd-sub">' + esc(on + was) + "</div>" + (flags ? "<div>" + flags + "</div>" : "") + '<div class="ff">' + footballSVG(card, W) + "</div>";
}
function fundamentalsHTML(card, W) {
  return '<div class="sec cd-fund"><div class="cd-h">FUNDAMENTALS</div>' + growthHTML(card.fundamentals || {}) + estHTML(card.fundamentals || {}, card.estimates_flag) + compsHTML(card, W) + "</div>";
}

/* ------------------------------------------------------------------ technicals, levels, risk, the plan */
function gbar(v, p10, med, p90, lo, hi, label) {
  if (num(v) == null) return "";
  const W = 300, X = (x) => 4 + ((Math.max(lo, Math.min(hi, x)) - lo) / (hi - lo)) * (W - 8);
  return '<svg class="gb" viewBox="0 0 ' + W + ' 22" preserveAspectRatio="none" role="img" aria-label="' + esc(label) + '"><rect class="tr" x="4" y="8" width="' + (W - 8) + '" height="6"/>' +
    (num(p10) != null && num(p90) != null ? '<rect class="own" x="' + X(p10).toFixed(1) + '" y="8" width="' + Math.max(2, X(p90) - X(p10)).toFixed(1) + '" height="6"/>' : "") +
    (num(med) != null ? '<rect class="md" x="' + (X(med) - 1).toFixed(1) + '" y="5" width="2" height="12"/>' : "") + '<rect class="me" x="' + (X(v) - 2).toFixed(1) + '" y="2" width="4" height="18"/></svg>';
}
function technicalsHTML(card) {
  const T = card.technicals || {};
  const pw = (p) => (num(p) == null ? "—" : ordinal(p) + " PCT OF ITS OWN YEAR");
  const g = '<div><div class="cd-g"><span class="k">GEIGER</span><b>' + signed(T.geiger, 2, "") + '</b><span class="k">' + pw(T.geiger_pctl_own_year) + "</span></div>" + gbar(T.geiger, T.geiger_own_p10, T.geiger_own_median, T.geiger_own_p90, -1, 1, "Geiger against its own year") + "</div>";
  const rs = '<div><div class="cd-g"><span class="k">RSI 14</span><b>' + (num(T.rsi14) == null ? "—" : T.rsi14.toFixed(0)) + '</b><span class="k">' + pw(T.rsi_pctl_own_year) + "</span></div>" + gbar(T.rsi14, T.rsi_own_p10, null, T.rsi_own_p90, 0, 100, "RSI against its own year") + "</div>";
  const ks = [21, 50, 100, 200];
  const ma = '<table class="cd-ma"><thead><tr>' + ks.map((k) => "<th>" + k + "-DAY</th>").join("") + "<th>52-WK HIGH</th></tr></thead><tbody><tr>" + ks.map((k) => "<td>" + px(T["sma" + k]) + "<small>" + sp(T["vs_sma" + k + "_pct"], 1) + "</small></td>").join("") + "<td>" + px(T.hi_52w) + "<small>" + sp(T.from_high_pct, 1) + "</small></td></tr></tbody></table>";
  return '<div class="sec cd-tech"><div class="cd-h">TECHNICALS</div><div class="cd-two">' + g + rs + "</div>" + ma + "</div>";
}
const SESS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
/** cols: 3 = zone · members · from the close (a phone) · 4 = + lasts · 5 = + sources */
export function zoneRowHTML(z, cols = 5) {
  const rng = px(z.lo) + "–" + px(z.hi);
  const mem = z.members.map((m) => "<span>" + esc(m.label) + "<em>" + px(m.v) + "</em></span>").join(" ");
  const until = z.last > 0 && z.until ? z.until : null;
  const lastsLong = until ? "to " + ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(until + "T12:00:00Z").getUTCDay()] + " " + dayS(until).replace(/ \d{4}$/, "") : "today only";
  const tip = (z.ms ? "Members from two or more sources" : "Members from one timeframe") + " · at a flat price the zone lasts " + lastsLong + " · " + z.w + "% wide";
  return '<div class="zr" title="' + esc(tip) + '"><span class="z"><i class="' + esc(z.side) + '"></i>' + rng + '</span><span class="m">' + mem + '</span><span class="d">' + sp(z.d, 2) + "</span>" +
    (cols >= 5 ? '<span class="s">' + (z.ms ? "TWO OR MORE" : "ONE TIMEFRAME") + "</span>" : "") + (cols >= 4 ? '<span class="l">' + (until ? (cols >= 5 ? SESS[new Date(until + "T12:00:00Z").getUTCDay()] + " " : "") + dayShort(until) : "TODAY") + "</span>" : "") + "</div>";
}
function levelsHTML(card, W) {
  const cols = W >= ZONES_FIVE_FROM ? 5 : W >= NARROW_BELOW ? 4 : 3;
  const z = card.zones, T = card.technicals || {};
  const near = () => { const a = (T.lines_above || [])[0], b = (T.lines_below || [])[0]; return (a || b) ? '<div class="cd-near"><span class="k">NEAREST SINGLE LINES</span>' + (a ? "<span>ABOVE <b>" + esc(a.label) + "</b> " + px(a.level) + " " + sp(a.pct, 1) + "</span>" : "") + (b ? "<span>BELOW <b>" + esc(b.label) + "</b> " + px(b.level) + " " + sp(b.pct, 1) + "</span>" : "") + "</div>" : ""; };
  if (!z || !z.list || !z.list.length)
    return '<div class="sec cd-lev"><div class="cd-h">LEVELS</div><div class="k">' + (T.lines_reviewed ? "NO CONFLUENCE ZONE ON FILE FOR " + esc(card.ticker) : "NO REVIEWED LINES FOR " + esc(card.ticker) + " YET · NO ZONES") + "</div>" + near() + "</div>";
  const head = '<div class="zh"><span class="z">ZONE · NEAREST FIRST</span><span class="m">MEMBERS, BY LABEL</span><span class="d">FROM THE CLOSE</span>' + (cols >= 5 ? '<span class="s">SOURCES</span>' : "") + (cols >= 4 ? '<span class="l">LASTS TO</span>' : "") + "</div>";
  /* the zones are CZ1's, on the Lab's newest line pack; CP1's "nearest single lines" come from an older extract, so they are not mixed in under them */
  return '<div class="sec cd-lev"><div class="cd-h">LEVELS<small>CONFLUENCE ZONES · CLOSE ' + px(z.price) + " · " + esc(dayShort(z.as_of)) + "</small></div>" +
    '<div class="cd-zones c' + cols + '">' + head + z.list.map((x) => zoneRowHTML(x, cols)).join("") + "</div></div>";
}
function riskHTML(card) {
  const R = card.risk || {};
  if (!R.x_spy) return '<div class="sec cd-risk"><div class="cd-h">RISK</div><div class="k">NO USUAL-DAY FIGURE ON FILE</div></div>';
  return '<div class="sec cd-risk"><div class="cd-h">RISK</div><div class="cd-kv"><div><span class="k">USUAL DAY</span><b>' + R.usual_day_60.toFixed(2) + '%</b></div><div><span class="k">SPY\'S</span><b>' + R.spy_usual_day_60.toFixed(2) + '%</b></div><div><span class="k">TIMES SPY</span><b>' + R.x_spy.toFixed(1) + '×</b></div><div><span class="k">RISK-EQUAL POSITION</span><b>' + (R.risk_equal_share * 100).toFixed(0) + "% OF THE DOLLARS</b></div></div></div>";
}
function planHTML(card) {
  const g = (card.plan && card.plan.given) || null, blank = '<span class="blank">—</span>';
  const rows = [["CORE OR CONVICTION", blank], ["ENTRY LEVELS", g ? esc(g.entries) : blank], ["SIZE BY RISK", blank], ["EXIT / TRIM RULE", blank]];
  if (g) rows.splice(1, 0, ["BUY ZONE", esc(g.buy_zone)], ["STOP", esc(g.stop)], ["MAGNET", esc(g.magnet)], ["BETWEEN PRICE AND THE 100-DAY", esc(g.between)]);
  return '<div class="sec cd-plan"><div class="cd-h">THE PLAN — ALAN\'S' + (g ? "<small>AS GIVEN, " + esc(String(g.said).toUpperCase()) + "</small>" : "") + "</div>" + rows.map((r) => '<div class="cd-pl"><span class="k">' + r[0] + "</span><span>" + r[1] + "</span></div>").join("") + "</div>";
}
function specsHTML(doc, source) {
  const a = doc.as_of || {};
  return `<details class="sc-pagespecs"><summary>PAGE SPECS</summary><div>
<p><b>What this is.</b> The decision card for this name: the facts and the levels in one place, with the plan left for you. It lays things out; it never says buy or sell.</p>
<p><b>The pies.</b> Revenue of the company's latest fiscal year as FMP reports it, split by business line and by region. The cyan slice is data-centre revenue; the grey slices are everything else, largest first. Labels are in plain words — rest the pointer on a slice or a row to see FMP's own label. When FMP's split is a year behind the statements, or does not add up to the year's revenue, a cyan line under the pie says so.</p>
<p><b>The five chips.</b> Data-centre share is the cyan slice. Gross margin, operating margin and free cash flow are for the last twelve months on file: the full-year statement when the year has just ended, otherwise the last four quarters added. Free-cash-flow margin is free cash flow over revenue; the yield is free cash flow over the market value at the card's close. A ≠ beside a cash figure means FMP's full-year statement and its four quarters disagree by more than 5% for the same twelve months — rest the pointer on it for both numbers.</p>
<p><b>The blend.</b> Two figures in the same unit — cents a year for every dollar of the stock — so a company with a big data-centre share and one with a fat margin can be weighed against each other. Data-centre profit per dollar of stock is data-centre share × revenue × gross margin ÷ market value. Cash per dollar of stock is free cash flow ÷ market value (the free-cash-flow yield, in cents). Companies do not report a margin for each segment, so the company's own gross margin is applied to its data-centre revenue: where the data-centre lines earn more than the company's average the figure is too low, where they earn less it is too high.</p>
<p><b>The ≈ sign.</b> FMP's split has no data-centre line for some companies (Micron is split into DRAM and NAND; Seagate is not split at all). For those the share is the company's own statement on an earnings call, applied to the twelve months' revenue — approximate, and the sentence is on the chip.</p>
<p><b>Banks and landlords</b> show no margin or cash chips: gross margin and free cash flow are not how those businesses are measured.</p>
<p><b>The estimates flag line.</b> Three checks on the analysts' numbers: is there a one-off inside this year's earnings, is next quarter's estimate in line with what the company itself guided, and how many analysts stand behind next year. Checked for six names so far (Alphabet, Amazon, Western Digital, Seagate, Micron, Lam Research).</p>
<p><b>Levels.</b> A confluence zone is two or more levels within 1% of each other — reviewed lines, named exactly as the Lab labels them, and the 21, 50, 100 and 200-day averages. Nearest to the price first; green is below the price, red above. "Lasts" is how long the zone holds if the price stays where it closed.</p>
<p><b>Dates.</b> Card and price: the ${esc(dayShort(a.card_date))} close. Business facts: FMP, read ${esc(day(a.business_facts_utc))}. Zones: as of ${esc(day(a.zones_as_of))}. ${esc(source)}.</p>
</div></details>`;
}

/* ------------------------------------------------------------------ reading and mounting */
let DOC = null;
async function loadFile(fetchJSON) { if (!DOC) DOC = fetchJSON(CARDS_URL).catch((e) => { DOC = null; throw e; }); return DOC; }
/** the newest row per name from rows of decision_cards (already ordered newest first) */
export function newestPerName(rows) { const out = {}; for (const r of rows || []) if (r && r.ticker && r.card && !out[r.ticker]) out[r.ticker] = r.card; return out; }

/** the whole card as HTML (exported for the tests and for the study page) */
export function cardHTML(card, all, doc, W, source) {
  return '<div class="cd-card"><div class="cd-src"><span><b>' + esc(dayShort(card.card_date)) + " CLOSE " + px(card.price) + "</b></span><span>" + esc(((card.cohorts || [])[0] || card.line || "").toUpperCase()) + "</span>" +
    ((card.parents || []).length ? "<span>PARENTS" + card.parents.map((p) => '<button type="button" class="par" data-cd-open="' + esc(p) + '">' + esc(p) + "</button>").join("") + "</span>" : "") + "</div>" +
    businessHTML(card, all) + fundamentalsHTML(card, Math.max(300, W - 24)) + technicalsHTML(card) + levelsHTML(card, W) + riskHTML(card) + planHTML(card) + specsHTML(doc, source) + "</div>";
}

/** the cards, from the dated file — or, with the switch on, the newest row per name from public.decision_cards; a name the
    table does not hold falls back to the file, and `source` says which it was */
async function readCards(t, opts) {
  const fetchJSON = opts.fetchJSON || ((u) => fetch(u).then((r) => { if (!r.ok) throw new Error("cards file → " + r.status); return r.json(); }));
  const doc = await loadFile(fetchJSON);
  let all = doc.cards || {}, source = "Read from the dated file";
  if (opts.fromTable && typeof opts.read === "function") {
    const want = [t, ...(((all[t] || {}).business || {}).side_by_side || [])].filter((x, i, a) => a.indexOf(x) === i);
    const got = newestPerName(await opts.read(TABLE_PATH(want)));
    if (got[t]) { all = { ...all, ...got }; source = "Read from the table decision_cards"; } else source = "The table holds no card for " + t + ": read from the dated file";
  }
  return { doc, all, source };
}

/** The same flag line, alone, for the top of the ESTIMATES tab (where the estimates study first drew it). The Hub mounts it
    only when its own switch is on. A name that has not been checked gets NOTHING: the tab stays exactly as it was. */
export async function mountEstimatesFlag(root, opts) {
  ensureCSS();
  try {
    const { all } = await readCards(opts.ticker, opts), fl = (all[opts.ticker] || {}).estimates_flag;
    root.innerHTML = fl && fl.checked ? flagHTML(fl) : "";
    if (fl && fl.checked) root.classList.add("cd");
  } catch (_) { root.innerHTML = ""; }   // an extra line: when it cannot be read the tab is simply as before
}

export async function mountCardsTab(root, opts) {
  ensureCSS();
  const t = opts.ticker;
  root.classList.add("cd");
  root.innerHTML = '<div class="loading">READING THE CARD OF ' + esc(t) + "…</div>";
  let doc, all, source;
  try { ({ doc, all, source } = await readCards(t, opts)); }
  catch (e) {
    root.innerHTML = '<div class="cd-err">The card could not be read: ' + esc(String((e && e.message) || e)) + "</div>";
    return;
  }
  const paint = () => {
    const W = Math.max(300, root.clientWidth || 600), card = all[t];
    root.classList.toggle("narrow", W < NARROW_BELOW); root.classList.toggle("wide", W >= WIDE_FROM);
    if (!card) {
      root.innerHTML = '<div class="cd-none"><div class="t">NO DECISION CARD FOR ' + esc(t) + ' YET</div><span class="k">CARDS ON FILE · ' + Object.keys(all).length + '</span><div class="lst">' + Object.keys(all).map((x) => '<button type="button" data-cd-open="' + esc(x) + '">' + esc(x) + "</button>").join("") + "</div></div>";
      return;
    }
    root.innerHTML = cardHTML(card, all, doc, W, source);
  };
  paint();
  root.onclick = (e) => { const b = e.target.closest && e.target.closest("[data-cd-open]"); if (b && typeof opts.open === "function") opts.open(b.getAttribute("data-cd-open")); };
  if (typeof ResizeObserver !== "undefined") {
    let last = root.clientWidth, timer = null;
    const ro = new ResizeObserver(() => { if (!root.isConnected) { ro.disconnect(); return; } const w = root.clientWidth; if (Math.abs(w - last) < 24) return; last = w; clearTimeout(timer); timer = setTimeout(paint, 120); });
    ro.observe(root);
  }
}
