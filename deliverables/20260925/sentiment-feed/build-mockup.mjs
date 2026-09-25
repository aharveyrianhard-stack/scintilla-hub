// Builds mockup-feed.html from real stored rows (feed-data.json, computed with the Hub's own scorer)
// and CNN's published index (cnn-fng.json). Static, self-contained, no network on the page.
//   node deliverables/20260925/sentiment-feed/build-mockup.mjs <feed-data.json> <cnn-fng.json> <series.json> <out.html>
import { readFileSync, writeFileSync } from "node:fs";
const [FD, CNN, SER, OUT] = process.argv.slice(2);
const D = JSON.parse(readFileSync(FD, "utf8")), C = JSON.parse(readFileSync(CNN, "utf8")), S = JSON.parse(readFileSync(SER, "utf8"));
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const sg = (v, d = 2) => v == null ? "—" : (v > 0 ? "+" : "") + (+v).toFixed(d);
const NOW = Date.parse(D.computed_utc);
const age = (ms) => { const m = Math.round((NOW - ms) / 60e3); return m < 60 ? m + "m" : m < 1440 ? Math.round(m / 60) + "h" : Math.round(m / 1440) + "d"; };
const cls = (v, t = 0.08) => v == null ? "flat" : v > t ? "up" : v < -t ? "dn" : "flat";
const word = (v) => v == null ? "no reading" : v > 0.25 ? "positive" : v > 0.08 ? "mildly positive" : v < -0.25 ? "negative" : v < -0.08 ? "mildly negative" : "balanced";
const VN = { news: "NEWS", youtube: "YOUTUBE", x: "X" }, VU = { news: "headlines", youtube: "clips", x: "posts" };
const MYLIST = ["NVDA", "META", "MU", "SPY", "AMD", "ORCL", "AAPL", "COST", "MSFT", "TSLA"];   // stands in for the board's own names

/* ── the strip: three voices, one bar each, yesterday as a notch ── */
function leanBar(v, y, wide) {
  const px = (x) => Math.max(0, Math.min(100, 50 + 50 * Math.max(-1, Math.min(1, x))));
  const p = v == null ? null : px(v), q = y == null ? null : px(y);
  return '<div class="lean' + (wide ? " lean--w" : "") + '"><i class="lean__mid"></i>' +
    (p == null ? "" : '<i class="lean__bar ' + cls(v) + '" style="' + (v >= 0 ? "left:50%;width:" + (p - 50) : "left:" + p + "%;width:" + (50 - p)) + '%"></i>') +
    (q == null ? "" : '<i class="lean__y" style="left:' + q + '%" title="yesterday ' + sg(y) + '"></i>') + "</div>";
}
const strip = ["news", "x", "youtube"].map((k) => {
  const v = D.voices[k], t = v.today, y = v.yesterday;
  const thin = t.items < 30;
  return '<div class="voice ' + cls(t.score) + '">' +
    '<div class="voice__hd"><span class="voice__nm">' + VN[k] + '</span><span class="voice__n">' + t.items + " " + VU[k] + " scored · " + t.tickers + " names" + (thin ? ' · <em class="thin">thin</em>' : "") + "</span></div>" +
    '<div class="voice__row">' + leanBar(t.score, y ? y.score : null, true) + '<b class="voice__v">' + sg(t.score) + "</b></div>" +
    '<div class="voice__say">' + word(t.score) + (t.move == null ? "" : " · " + (t.move > 0.05 ? "firmer" : t.move < -0.05 ? "softer" : "about the same as") + (t.move > 0.05 || t.move < -0.05 ? " than" : "") + " yesterday (" + sg(t.move) + ")") + "</div></div>";
}).join("");
const signs = ["news", "x", "youtube"].map((k) => cls(D.voices[k].today.score));
const upN = signs.filter((s) => s === "up").length, dnN = signs.filter((s) => s === "dn").length;
const agreeLine = (upN === 3 ? "All three voices lean up" : dnN === 3 ? "All three voices lean down" :
  ["news", "x", "youtube"].filter((k) => cls(D.voices[k].today.score) === "up").map((k) => VN[k]).join(" and ") + (upN ? " lean up, " : "") +
  ["news", "x", "youtube"].filter((k) => cls(D.voices[k].today.score) === "dn").map((k) => VN[k]).join(" and ") + (dnN ? " lean down" : "")) +
  " · <b>" + D.counts.multi + "</b> names were heard by more than one voice: <b>" + D.counts.agree + "</b> agree, <b class='dn'>" + D.counts.disagree + "</b> disagree.";

/* ── what changed since yesterday ── */
const flips = D.tickers.filter((t) => t.ylean != null && t.lean != null && cls(t.lean) !== "flat" && cls(t.ylean) !== "flat" && cls(t.lean) !== cls(t.ylean)).slice(0, 4);
const fresh = D.tickers.filter((t) => !Object.keys(t.yday).length).slice(0, 4);
const changed = '<div class="chg"><span class="chg__k">SINCE YESTERDAY</span> ' +
  ["news", "x", "youtube"].map((k) => { const m = D.voices[k].today.move; return VN[k] + " " + (m == null ? "—" : m > 0.05 ? '<b class="up">firmer</b>' : m < -0.05 ? '<b class="dn">softer</b>' : "unchanged"); }).join(" · ") +
  (flips.length ? " · flipped: " + flips.map((t) => '<b class="' + cls(t.lean) + '">' + t.ticker + "</b> " + sg(t.ylean, 1) + "→" + sg(t.lean, 1)).join(", ") : "") +
  (fresh.length ? " · new today: " + fresh.map((t) => "<b>" + t.ticker + "</b>").join(", ") : "") + "</div>";

/* ── fear & greed: CNN's own, on its own card, monochrome dial, direction in colour ── */
const fg = C.fear_and_greed, sc = Math.round(fg.score);
const hist = C.fear_and_greed_historical.data.slice(-30).map((p) => p.y);
function dial(v) {
  const cx = 60, cy = 56, r = 46, a = Math.PI * (1 - v / 100);
  const pt = (ang, rr) => [(cx + rr * Math.cos(ang)).toFixed(1), (cy - rr * Math.sin(ang)).toFixed(1)];
  const [x0, y0] = pt(Math.PI, r), [x1, y1] = pt(0, r), [nx, ny] = pt(a, r - 10);
  const ticks = [25, 45, 55, 75].map((t) => { const [a0, b0] = pt(Math.PI * (1 - t / 100), r - 6), [a1, b1] = pt(Math.PI * (1 - t / 100), r + 5); return `<line x1="${a0}" y1="${b0}" x2="${a1}" y2="${b1}" stroke="var(--dim)" stroke-width="1"/>`; }).join("");
  return `<svg viewBox="0 0 120 64" class="dial" aria-label="CNN fear and greed ${v}"><path d="M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}" fill="none" stroke="var(--mute)" stroke-width="8"/>${ticks}<line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="var(--ink)" stroke-width="2" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="3" fill="var(--ink)"/><text x="2" y="62" fill="var(--dn)" font-size="7" letter-spacing="1">FEAR</text><text x="118" y="62" fill="var(--up)" font-size="7" letter-spacing="1" text-anchor="end">GREED</text></svg>`;
}
function spark(vals, w, h, col) {
  const v = vals.filter((x) => x != null); if (v.length < 2) return "";
  const lo = Math.min(...v), hi = Math.max(...v), sp = (hi - lo) || 1;
  const pts = v.map((x, i) => (i * (w - 2) / (v.length - 1) + 1).toFixed(1) + "," + (h - 1 - (x - lo) / sp * (h - 2)).toFixed(1)).join(" ");
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="spark"><polyline fill="none" stroke="${col}" stroke-width="1.3" points="${pts}"/></svg>`;
}
const fgCls = sc < 45 ? "dn" : sc > 55 ? "up" : "flat";
const fgCard = '<div class="card fg"><div class="card__hd"><span>FEAR &amp; GREED</span><span class="card__by">CNN Business · theirs, not ours</span></div>' +
  '<div class="fg__row">' + dial(sc) + '<div class="fg__val"><b class="' + fgCls + '">' + sc + '</b><span class="' + fgCls + '">' + esc(fg.rating) + "</span></div></div>" +
  '<div class="fg__prev"><div><span>yesterday</span><b>' + Math.round(fg.previous_close) + "</b></div><div><span>week ago</span><b>" + Math.round(fg.previous_1_week) + "</b></div><div><span>month ago</span><b>" + Math.round(fg.previous_1_month) + "</b></div><div><span>30 days</span>" + spark(hist, 64, 18, sc >= hist[0] ? "var(--up)" : "var(--dn)") + "</div></div>" +
  '<div class="card__ft">seven market readings, each measured as distance from its own average · as of ' + esc(String(fg.timestamp).slice(0, 16).replace("T", " ")) + "Z · our own seven market inputs stay in their own tab and are never mixed into this number</div></div>";

/* ── trending tickers with a 10-day tape each ── */
const trend = D.tickers.filter((t) => t.ticker !== "_MARKET").slice(0, 10);
const trendRows = trend.map((t) => {
  const ser = S[t.ticker] || [];
  const voices = ["news", "x", "youtube"].filter((k) => t.today[k] && t.today[k].score != null).map((k) => '<i class="dot ' + cls(t.today[k].score) + '" title="' + VN[k] + " " + sg(t.today[k].score) + '"></i>').join("");
  return '<div class="tk ' + (MYLIST.includes(t.ticker) ? "is-mine" : "") + '"><span class="tk__t">' + t.ticker + '</span><b class="tk__v ' + cls(t.lean) + '">' + sg(t.lean) + "</b>" +
    '<span class="tk__n">' + t.items + "</span><span class=\"tk__d\">" + voices + (t.agree === false ? '<em class="split">split</em>' : "") + "</span>" +
    '<span class="tk__s">' + spark(ser.map((x) => x.score), 70, 16, (ser.length && ser[ser.length - 1].score >= ser[0].score) ? "var(--up)" : "var(--dn)") + "</span></div>";
}).join("");

/* ── keyword tracker, the idiom Alan liked, one column pair per voice ── */
function kwCol(list, side) {
  const max = list.length ? list[0].n : 1;
  return '<div class="kw kw--' + side + '"><h5>' + (side === "bull" ? "bullish words" : "bearish words") + "</h5>" +
    list.slice(0, 8).map((w) => '<div class="kw__r"><span class="kw__w">' + esc(w.w) + '</span><span class="kw__b"><i style="width:' + Math.max(4, Math.round(100 * w.n / max)) + '%"></i></span><span class="kw__n">' + w.n + "</span></div>").join("") + "</div>";
}
const kwTabs = ["news", "x", "youtube"].map((k, i) => '<button class="tab' + (i === 0 ? " is-on" : "") + '" data-kw="' + k + '">' + VN[k] + " · " + D.keywords[k].words + "</button>").join("");
const kwPanes = ["news", "x", "youtube"].map((k, i) => '<div class="kwpane" data-kw="' + k + '"' + (i ? ' hidden' : "") + '><div class="kwgrid">' + kwCol(D.keywords[k].bull, "bull") + kwCol(D.keywords[k].bear, "bear") + "</div></div>").join("");

/* ── the feed: strongest items, words highlighted, one story once ── */
const seenT = new Map();
const feed = [];
for (const it of D.feed) {
  const key = it.kind + "|" + String(it.text || "").toLowerCase().replace(/\([a-z]+:[a-z.]+\)/g, "").replace(/\s*[-|·]\s*[a-z0-9 .'&]+$/i, "").replace(/[^a-z0-9]+/g, " ").trim().slice(0, 70);
  if (seenT.has(key)) { seenT.get(key).dupes++; continue; }
  it.dupes = 0; seenT.set(key, it); feed.push(it);
  if (feed.length >= 40) break;
}
function hilite(text, hits) {
  let out = esc(text || "");
  const words = [...new Set((hits || []).map((h) => h.w))].sort((a, b) => b.length - a.length);
  for (const w of words) {
    const h = hits.find((x) => x.w === w);
    const c = (h.effect > 0 ? "hb" : "hr") + (h.negated ? " hf" : "");
    out = out.replace(new RegExp("(^|[^a-z0-9])(" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")(?![a-z0-9])", "gi"), '$1<mark class="' + c + '">$2</mark>');
  }
  return out;
}
const feedHTML = feed.map((it) => {
  const badge = it.score > 0 ? '<span class="bd up">BULLISH ' + sg(it.score) + "</span>" : it.score < 0 ? '<span class="bd dn">BEARISH ' + sg(it.score) + "</span>" : '<span class="bd flat">EVEN</span>';
  const tks = [...new Set(it.tickers)].slice(0, 4).map((t) => '<span class="chip' + (MYLIST.includes(t) ? " is-mine" : "") + '">' + t + "</span>").join("");
  const mine = it.tickers.some((t) => MYLIST.includes(t));
  return '<article class="it" data-kind="' + it.kind + '" data-mine="' + (mine ? 1 : 0) + '"><div class="it__hd"><span class="kind kind--' + it.kind + '">' + (it.kind === "news" ? "NEWS" : it.kind === "video" ? "VIDEO" : "POST") + "</span>" + tks + badge +
    '<span class="it__age">' + age(it.at) + "</span></div>" +
    '<div class="it__t">' + hilite(it.text, it.hits) + "</div>" +
    (it.sample && it.sample.replace(/[.\s]+$/, "") !== String(it.text || "").replace(/[.\s]+$/, "") && it.kind !== "post" ? '<div class="it__q">“' + hilite(it.sample, it.hits) + "”</div>" : "") +
    '<div class="it__m">' + esc(it.who || "source not stated") + (it.dupes ? " · same story in " + (it.dupes + 1) + " outlets" : "") + (it.src === "title" ? " · scored on the title, no transcript yet" : "") + (it.flips ? " · " + it.flips + " word flipped by a negator" : "") + "</div></article>";
}).join("");

const stamp = D.computed_utc.slice(0, 16).replace("T", " ") + "Z";
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>SENTIMENT · feed mockup · ${D.today}</title>
<style>
:root{color-scheme:dark;--bg:#0A0A0F;--panel:#0D0D14;--line:#1A1B28;--line2:#25263A;--mute:#3A3C4E;--dim:#82849A;--ink2:#9C9EB0;--ink:#C4C6D2;--up:#2FBF71;--dn:#E8384F;
--mono:"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace;--sans:ui-sans-serif,-apple-system,"Helvetica Neue",Helvetica,sans-serif}
*{box-sizing:border-box;min-width:0}html,body{margin:0;background:var(--bg);color:var(--ink2);font:12px/1.5 var(--sans)}
.wrap{max-width:1600px;margin:0 auto;padding:12px 16px 60px}
.tabs{display:flex;flex-wrap:wrap;border:1px solid var(--line);margin-bottom:12px}
.tabs button{font:11px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--ink2);background:transparent;border:0;border-right:1px solid var(--line);padding:11px 18px;cursor:pointer}
.tabs button.is-on{color:var(--ink);background:rgba(156,158,176,.06);box-shadow:inset 0 -2px 0 var(--ink2)}
.body{display:grid;grid-template-columns:1.55fr 1fr;gap:12px;align-items:start}
.panel{border:1px solid var(--line);background:var(--panel);padding:12px 14px}
.plabel{font:8.5px/1 var(--mono);letter-spacing:.3em;text-transform:uppercase;color:var(--dim);margin:0 0 10px}
.h2{font:11px/1.3 var(--mono);letter-spacing:.22em;text-transform:uppercase;color:var(--ink2);padding:14px 0 6px}
.h2 small{letter-spacing:.06em;text-transform:none;color:var(--dim)}
.up{color:var(--up)}.dn{color:var(--dn)}.flat{color:var(--dim)}
/* strip */
.strip{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.voice{border:1px solid var(--line2);padding:9px 11px;background:var(--bg)}
.voice__hd{display:flex;justify-content:space-between;gap:8px;align-items:baseline;flex-wrap:wrap}
.voice__nm{font:700 11px/1 var(--mono);letter-spacing:.16em;color:var(--ink)}
.voice__n{font:10px/1.3 var(--mono);color:var(--dim)}
.thin{font-style:normal;color:var(--dn);letter-spacing:.1em;text-transform:uppercase}
.voice__row{display:flex;align-items:center;gap:10px;margin:9px 0 6px}
.voice__v{font:700 16px/1 var(--mono);font-variant-numeric:tabular-nums;min-width:52px;text-align:right}
.voice.up .voice__v{color:var(--up)}.voice.dn .voice__v{color:var(--dn)}.voice.flat .voice__v{color:var(--ink2)}
.voice__say{font-size:11px;color:var(--ink2)}
.lean{position:relative;height:14px;flex:1;background:var(--mute)}
.lean__mid{position:absolute;left:50%;top:0;bottom:0;width:1px;background:var(--dim)}
.lean__bar{position:absolute;top:0;bottom:0}.lean__bar.up{background:var(--up)}.lean__bar.dn{background:var(--dn)}.lean__bar.flat{background:var(--ink2)}
.lean__y{position:absolute;top:-3px;bottom:-3px;width:2px;background:var(--ink);transform:translateX(-1px)}
.agree{font-size:11px;color:var(--ink2);margin:10px 0 0}.agree b{color:var(--ink)}
.chg{font:11px/1.6 var(--sans);color:var(--ink2);border-left:2px solid var(--line2);padding:4px 10px;margin:10px 0 2px}
.chg__k{font:9px/1 var(--mono);letter-spacing:.2em;color:var(--dim);margin-right:6px}.chg b{font-weight:700}
/* cards */
.card{border:1px solid var(--line);background:var(--bg);padding:10px 12px;margin:0 0 10px}
.card__hd{display:flex;justify-content:space-between;gap:8px;font:9px/1.3 var(--mono);letter-spacing:.2em;text-transform:uppercase;color:var(--dim);flex-wrap:wrap}
.card__by{letter-spacing:.06em;text-transform:none;color:var(--dim)}
.card__ft{font-size:10px;color:var(--dim);margin-top:8px;line-height:1.5}
.fg__row{display:flex;align-items:center;gap:14px;margin-top:6px}.dial{width:120px;height:64px;flex:0 0 auto}
.fg__val b{display:block;font:700 30px/1 var(--mono);font-variant-numeric:tabular-nums}.fg__val span{font:11px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase}
.fg__prev{display:flex;gap:16px;margin-top:8px;flex-wrap:wrap}.fg__prev div{display:flex;flex-direction:column;gap:2px}.fg__prev span{font:8.5px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}.fg__prev b{font:700 13px/1 var(--mono);color:var(--ink)}
.spark{display:block}
/* trending */
.tk{display:grid;grid-template-columns:52px 48px 30px 1fr 74px;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid var(--line);font:11px/1 var(--mono)}
.tk__t{font-weight:700;color:var(--ink);letter-spacing:.06em}.tk.is-mine .tk__t::after{content:"★";color:var(--dim);font-size:8px;margin-left:3px}
.tk__v{font-variant-numeric:tabular-nums;text-align:right}.tk__n{color:var(--dim);text-align:right}
.tk__d{display:flex;gap:4px;align-items:center}.dot{width:7px;height:7px;border-radius:50%;background:var(--dim)}.dot.up{background:var(--up)}.dot.dn{background:var(--dn)}
.split{font:8.5px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--dim);border:1px solid var(--line2);padding:2px 4px;font-style:normal;margin-left:4px}
.tk__s .spark{margin-left:auto}
.tkhd{display:grid;grid-template-columns:52px 48px 30px 1fr 74px;gap:8px;font:8.5px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--dim);padding:0 0 4px}
/* keywords */
.kwtabs{display:flex;gap:4px;margin:0 0 8px;flex-wrap:wrap}.tab{font:10px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;padding:5px 9px;background:var(--bg);color:var(--ink2);border:1px solid var(--line2);cursor:pointer}.tab.is-on{color:var(--bg);background:var(--ink2);font-weight:700}
.kwgrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.kw h5{font:700 10px/1 var(--mono);letter-spacing:.2em;text-transform:uppercase;margin:0 0 6px}.kw--bull h5{color:var(--up)}.kw--bear h5{color:var(--dn)}
.kw__r{display:flex;align-items:center;gap:8px;font-size:11px;padding:4px 0;border-bottom:1px solid var(--line)}
.kw__w{color:var(--ink);font-weight:600;min-width:84px;font-family:var(--mono)}.kw__b{flex:1;height:7px;background:var(--mute);position:relative;min-width:30px}.kw__b i{position:absolute;inset:0 auto 0 0}
.kw--bull .kw__b i{background:var(--up)}.kw--bear .kw__b i{background:var(--dn)}.kw__n{font-family:var(--mono);color:var(--ink2);min-width:26px;text-align:right}
/* feed */
.filters{display:flex;gap:4px;flex-wrap:wrap;margin:0 0 8px}
.it{border:1px solid var(--line);border-left:2px solid var(--line2);padding:9px 11px;margin:0 0 8px;background:var(--bg)}
.it__hd{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.kind{font:700 8.5px/1 var(--mono);letter-spacing:.16em;padding:3px 5px;border:1px solid var(--line2);color:var(--ink2)}
.chip{font:10px/1 var(--mono);letter-spacing:.06em;padding:3px 6px;background:var(--mute);color:var(--ink)}.chip.is-mine::after{content:"★";font-size:8px;color:var(--dim);margin-left:3px}
.bd{font:700 9px/1 var(--mono);letter-spacing:.12em;padding:3px 6px;border:1px solid currentColor}.bd.flat{color:var(--dim)}
.it__age{margin-left:auto;font:10px/1 var(--mono);color:var(--dim)}
.it__t{font-size:12.5px;line-height:1.55;color:var(--ink);margin:7px 0 4px}
.it__q{font-size:11px;line-height:1.55;color:var(--ink2);font-style:italic;margin:0 0 4px}
.it__m{font:10px/1.4 var(--mono);color:var(--dim)}
mark{background:transparent;font-weight:700;padding:0 1px}mark.hb{color:var(--up)}mark.hr{color:var(--dn)}mark.hf{text-decoration:line-through dotted}
.note{font-size:10px;color:var(--dim);line-height:1.5;margin-top:8px}
@media(max-width:900px){.wrap{padding:10px 16px 40px}.body{grid-template-columns:1fr}.strip{grid-template-columns:1fr;gap:6px}.voice{padding:8px 10px}.tabs button{padding:10px 12px;font-size:10px}
.kwgrid{grid-template-columns:1fr}.tk{grid-template-columns:48px 44px 26px 1fr 60px}.tkhd{grid-template-columns:48px 44px 26px 1fr 60px}.fg__row{gap:10px}.rail{order:2}}
</style></head><body><div class="wrap">
<div data-scnav-slot style="margin:0 0 10px"></div>
<div class="tabs"><button class="is-on">FEED</button><button>HOW IT IS BUILT</button><button>NEWS</button><button>YOUTUBE</button><button>X</button></div>
<div class="body">
<div class="panel main">
 <div class="plabel">sentiment · <b>the three voices, today</b> · ${D.today} · read ${stamp}</div>
 <div class="strip">${strip}</div>
 <div class="agree">${agreeLine}</div>
 ${changed}
 <div class="h2">the words that did it <small>· counted after negation · today · stored</small></div>
 <div class="kwtabs">${kwTabs}</div>${kwPanes}
 <div class="h2">the feed <small>· strongest first · one story once · the words that scored it in colour</small></div>
 <div class="filters"><button class="tab is-on" data-f="all">ALL</button><button class="tab" data-f="mine">MY LIST ★</button><button class="tab" data-f="news">NEWS</button><button class="tab" data-f="video">VIDEO</button><button class="tab" data-f="post">POSTS</button></div>
 <div class="feed">${feedHTML}</div>
 <div class="note">Every item above is a stored row (news_headline_sentiment, youtube_video_sentiment, x_post_sentiment). The badge is the balance of the coloured words: (green − red) ÷ (green + red). A struck word was flipped by a negator in the three words before it. Nothing here is an AI read. “My list” stands in for the board’s own names in this mockup.</div>
</div>
<div class="panel rail">
 <div class="plabel">sentiment · <b>the small things beside the feed</b></div>
 ${fgCard}
 <div class="card trend"><div class="card__hd"><span>TRENDING · TODAY</span><span class="card__by">items · voices · 10 days</span></div>
  <div class="tkhd" style="margin-top:8px"><span>name</span><span>lean</span><span>n</span><span>voices</span><span>10 days</span></div>${trendRows}
  <div class="card__ft">lean is the item-weighted mean of the voices that heard the name · a dot per voice, in its direction · <em class="split" style="margin:0">split</em> when the voices disagree · ★ on the board’s own names</div></div>
 <div class="card"><div class="card__hd"><span>HOW TO READ THIS PAGE</span></div>
  <div class="card__ft" style="margin-top:6px">Three bars, one per voice: the bar is today’s balance, the white notch is yesterday’s. <b>Thin</b> means fewer than 30 scored items — a small sample, not a quiet market. The keyword tracker is what the voice actually said. The feed is the strongest items, with the exact words that scored them. Tap a name anywhere to open its own tape.</div></div>
</div></div></div>
<script>
/* phone: the small cards (fear & greed, trending) come right after the strip, before the words and the feed */
(function(){ if(!matchMedia('(max-width:900px)').matches) return; var chg=document.querySelector('.chg'); ['.card.fg','.card.trend'].forEach(function(sel){ var c=document.querySelector(sel); if(c&&chg){ chg.after(c); chg=c; } }); })();
document.querySelectorAll('[data-kw]').forEach(function(b){ if(b.tagName!=='BUTTON')return; b.onclick=function(){ document.querySelectorAll('button[data-kw]').forEach(function(x){x.classList.toggle('is-on',x===b)}); document.querySelectorAll('.kwpane').forEach(function(p){p.hidden=p.dataset.kw!==b.dataset.kw}); }; });
document.querySelectorAll('.filters .tab').forEach(function(b){ b.onclick=function(){ document.querySelectorAll('.filters .tab').forEach(function(x){x.classList.toggle('is-on',x===b)}); var f=b.dataset.f; document.querySelectorAll('.it').forEach(function(it){ it.style.display = f==='all' || (f==='mine' ? it.dataset.mine==='1' : it.dataset.kind===f) ? '' : 'none'; }); }; });
</script></body></html>`;
writeFileSync(OUT, html);
console.log("wrote", OUT, html.length, "bytes; feed items", feed.length, "trend", trend.length);
