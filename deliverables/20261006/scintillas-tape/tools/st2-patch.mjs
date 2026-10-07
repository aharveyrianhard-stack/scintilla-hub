/* ST2 (6 Oct 2026) — TODAY'S SCINTILLAS becomes a moving tape, short words.
   Alan, 6 Oct ~11:10 ET: "this today's scintillas, I think there needs to be a tape of this shit. Don't you think it
   needs to move? It says 28 scintillas today. Like, I need to move off of the screen to see them. And it's very wordy.
   I get the multiple. It's a multiple of usual day. It's clear. Doesn't need to be explained a bazillion times."

   This file IS the change, written as four anchored insertions into the Hub's index.html. Nothing is replaced or
   removed: a style block, one function block, and two one-line hooks. index.html on this branch is NOT touched;
       node deliverables/20261006/scintillas-tape/tools/st2-patch.mjs
   writes the preview copy (../preview/index.html = index.html + the four insertions + <base href="/">) and the
   coordinator's diff (../ST2-index.diff). tests/scintillas-tape-st2-20261006.test.mjs runs the patched layer. */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/* (1) the look — after the one-line strip's own rules, before the "no session today" rules */
export const CSS_ANCHOR = "/* 28 Sep — no session has run today: the line says why, then the last session's count and its newest one */\n";
export const CSS = `/* ── ST2 (6 Oct) · THE STRIP IS A TAPE ───────────────────────────────────────────────────────────
   Alan: "there needs to be a tape of this… it needs to move… it's very wordy." Same box and same height as the one
   line (so the board under it does not move); inside it, the Hub's own tape window and track — the same keyframes
   and the same 45 px/s law (tapeSpeed) as every other band — carrying ALL of today's, newest first, each one as
   "NBIS +8.3% 3.1×". Hover pauses it, as on the other tapes. */
.sc-ss--tape .sc-tape__win{ flex:1 1 0; min-width:0; overflow:hidden; align-self:stretch; margin-left:6px; }
.sc-ss--tape .sc-tape__track{ display:inline-block; white-space:nowrap; padding:0; line-height:18px;
  animation-name:sc-tape-move; animation-timing-function:linear; animation-iteration-count:infinite; }
.sc-ss--tape:hover .sc-tape__track{ animation-play-state:paused; }
.sc-ss__it{ display:inline-block; margin:0 22px 0 0; padding:0; background:none; border:0; cursor:pointer;
  font-family:var(--mono); font-size:11px; letter-spacing:.04em; line-height:18px; color:var(--ink2); white-space:nowrap; }
.sc-ss__it .sc-ss__tk{ font-weight:700; color:var(--ink); }
/* the flash prints the same text over the number (scScint's overlay): a box of its own keeps that copy exactly on it */
.sc-ss__it .sc-ss__mv, .sc-ss__it .sc-ss__tk{ display:inline-block; }
.sc-ss__it:hover .sc-ss__tk{ color:var(--crk); }
.sc-ss__it.up .sc-ss__mv, .sc-ss__it.up .sc-ss__x{ color:var(--bull); }
.sc-ss__it.dn .sc-ss__mv, .sc-ss__it.dn .sc-ss__x{ color:var(--bear); }
.sc-ss__it.hot .sc-ss__mv, .sc-ss__it.hot .sc-ss__x{ color:var(--sv5); }
.sc-ss__it.cool .sc-ss__mv, .sc-ss__it.cool .sc-ss__x{ color:var(--sv1); }
@media(max-width:700px){
  /* MEASURED at 390: beside the label and the count the window was 200 px, one and a half names. On a phone the tape
     takes its own full line under them (two names and the start of a third), and the strip is still shorter than the
     wrapped sentence it replaces (51 px against 64). */
  .sc-ss--tape{ flex-wrap:wrap; row-gap:2px; }
  .sc-ss--tape .sc-tape__win{ flex:1 1 100%; margin-left:0; }
}
@media (any-pointer:coarse){
  .sc-ss--tape .sc-tape__win{ overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; }
  .sc-ss--tape:active .sc-tape__track{ animation-play-state:paused; }
}
`;

/* (2) scintStripHTML: with rows today, the tape instead of the one line */
export const HTML_ANCHOR = "  const ev = rows[0], d = ev.detail || {};\n  const when = (() => { try { return ET_HM.format(new Date(ev.ts)); } catch (_) { return \"\"; } })();\n  const line = '<button class=\"sc-ss__one ' + scintClass(ev) + '\" data-act=\"scintbell\"";
export const HTML_HOOK = "  if (SCINT_TAPE_ON) return scintTapeHTML(rows, cohHTML, crit);                /* ST2 — a moving tape of all of today's, short words */\n";

/* (3) scintStripRender: the tape paints itself (speed, the carried position, the flash) */
export const RENDER_ANCHOR = "  const html = scintStripHTML();\n  if (html !== SCINT_HTML || host.innerHTML === \"\") { SCINT_HTML = html; host.innerHTML = html; }\n";
export const RENDER_HOOK = "  if (SCINT_TAPE_ON && scintTapeRender(host, html)) return;                    /* ST2 */\n";

/* (4) the functions — right after scintStripRender */
export const JS_ANCHOR = "/* ── M55 · EVERY SCINTILLA LANDS IN THE HUB'S OWN NOTIFICATIONS ─";
export const JS = `/* ── ST2 (6 Oct) · TODAY'S SCINTILLAS IS A TAPE, IN SHORT WORDS ───────────────────────────────────────
   Alan, 6 Oct: "there needs to be a tape of this… Don't you think it needs to move? It says 28 scintillas today. Like,
   I need to move off of the screen to see them. And it's very wordy. I get the multiple. It's a multiple of usual day.
   It's clear. Doesn't need to be explained a bazillion times."
   WHAT CHANGES. With rows today the strip is no longer one sentence about the newest: it is every one of today's,
   newest first, moving at the tapes' one speed (tapeSpeed, 45 px/s), each as  TICKER  MOVE  MULTIPLE  in the day's
   green or red. The numbers are the stored ones — the move and the multiple at the first spike — so an item never
   changes under the reader and the tape never restarts because a price ticked.
   WHAT DOES NOT. The label, the count (still the way into USUAL DAY), the cohort chip and the spark; the box and its
   height; the "usual day" sentence, which is said ONCE, as the strip's hover text, and never per item; the closed-day
   line (scintLastSessionHTML) and the empty states. A click goes where the scintilla is (scintgo: a ticker opens its
   company, a release opens its day in ECONOMIC). An item's own hover says only when it first spiked.
   THE FLASH. One primitive, scScint, once per event per surface (SCINT_SEEN), as everywhere else. A NEW scintilla
   restarts the tape at its start, so the newcomer is the first thing in the window, and it flashes there once.
   SCINT_TAPE_ON = false puts the one line back exactly as it was. */
const SCINT_TAPE_ON = true;
const scintPct1 = (v) => (v > 0 ? "+" : v < 0 ? "\\u2212" : "") + Math.abs(v).toFixed(1) + "%";
/* the short words for one scintilla: who, how far, how many of its usual days — and, for the hover only, when */
function scintItemShort(ev) {
  const d = (ev && ev.detail) || {}, x = scintMult(ev);
  const hm = (ts) => { try { return ET_HM.format(new Date(ts)); } catch (_) { return ""; } };
  const at = hm(ev.ts);
  if (ev.kind === "price_outlier") {
    const f = scintFlashAt(ev);
    return { w: ev.subject, mv: d.move_pct != null && isFinite(+d.move_pct) ? scintPct1(+d.move_pct) : "", x: x,
             tip: "first spike " + (f ? f.hm + " ET" + (f.off ? ", " + f.off : "") : at + " ET") };
  }
  if (ev.kind === "earnings_surprise") {
    const m = (d.measures || []).find((q) => q && q.name === d.measure) || {};
    const what = /rev/i.test(d.measure || "") ? "REV" : /eps|earn/i.test(d.measure || "") ? "EPS" : "";
    return { w: ev.subject, mv: [what, m.surprise_pct != null && isFinite(+m.surprise_pct) ? scintPct1(+m.surprise_pct) : ""].filter(Boolean).join(" "),
             x: x, tip: "earnings surprise, reported " + at + " ET" };
  }
  if (ev.kind === "econ_surprise")
    return { w: ev.subject, mv: d.actual != null ? String(d.actual) : "", x: x, tip: "surprise print " + at + " ET" };
  if (ev.kind === "econ_imminent")       /* nothing has printed, so there is no move and no multiple: the time IS the news */
    return { w: ev.subject, mv: d.event_ts ? hm(d.event_ts) + " ET" : "soon", x: "", tip: "about to print" };
  return { w: ev.subject, mv: "", x: x, tip: scintWhat(ev) + " " + at + " ET" };
}
function scintTapeItemHTML(ev) {
  const d = ev.detail || {}, s = scintItemShort(ev);
  return '<button class="sc-ss__it ' + scintClass(ev) + '" data-act="scintgo" data-kind="' + esc(ev.kind) +
    '" data-sub="' + esc(ev.subject) + '" data-cty="' + esc(d.country || "") + '" data-day="' +
    esc(d.event_ts ? scintDayET(d.event_ts) : "") + '" data-ts="' + esc(ev.ts) + '" title="' + esc(s.tip) + '">' +
    '<b class="sc-ss__tk">' + esc(s.w) + "</b>" + (s.mv ? ' <span class="sc-ss__mv">' + esc(s.mv) + "</span>" : "") +
    (s.x ? ' <span class="sc-ss__x">' + esc(s.x) + "</span>" : "") + "</button>";
}
function scintTapeHTML(rows, cohHTML, crit) {
  const seg = rows.map(scintTapeItemHTML).join("");
  /* the one explanation, once: the strip's own hover. Its last clause used to send the reader to the bell for the list;
     the list is now the tape itself, so that clause says what a click does here. */
  const note = scintUsualNote().replace(/ · tap to open the notifications[^]*$/, "") +
    " · each item is the name, its move at the first spike, and how many of its usual days that was; hover one for the time, click it to open it.";
  return scintOneLineHTML('<button class="sc-ss__n sc-ss__n--go" data-act="scintlast" data-day="' + esc(todayISO()) +
      '" title="open USUAL DAY on today: all ' + rows.length + ' listed, and where today sits in its own history">' + rows.length + "</button>" +
      (cohHTML || "") + '<div class="sc-tape__win"><span class="sc-tape__track">' + seg + seg + "</span></div>" + scintSpark(crit),
    note).replace('class="sc-ss sc-ss--one"', 'class="sc-ss sc-ss--one sc-ss--tape"');
}
/* which scintillas the tape is carrying — when this is unchanged, a repaint (the spark turns over on the hour) must
   not send the tape back to its start */
let SCINT_TAPE_SIG = "";
function scintTapeRender(host, html) {
  if (html.indexOf("sc-ss--tape") < 0) return false;                 /* a closed day, an empty day, a failed read: the one line */
  const q = (root, sel) => (root && typeof root.querySelector === "function" ? root.querySelector(sel) : null);
  if (html !== SCINT_HTML || host.innerHTML === "") {
    const sig = scintToday().map((r) => r.kind + "|" + r.subject + "|" + r.ts).join(",");
    let at = null;
    if (sig === SCINT_TAPE_SIG) {
      try { const a = q(host, ".sc-tape__track").getAnimations()[0]; at = a && a.currentTime != null ? +a.currentTime : null; } catch (_) {}
    }
    SCINT_TAPE_SIG = sig; SCINT_HTML = html; host.innerHTML = html;
    const track = q(host, ".sc-ss--tape .sc-tape__track");
    if (track && typeof tapeSpeed === "function") {
      tapeSpeed(track);                                               /* the one speed law: 45 px/s, repeated to fill a wide window */
      const dur = parseFloat(track.style.animationDuration);
      if (at != null && dur > 0) track.style.animationDelay = -((at / 1000) % dur) + "s";   /* same items: carry on from where it was */
    }
  }
  if (typeof host.querySelectorAll !== "function") return true;
  /* the flash: the newest row of each subject, once (SCINT_SEEN), on every copy of it the loop carries */
  const by = scintBy(), lit = new Map();
  let n = 0;
  for (const it of host.querySelectorAll(".sc-ss__it[data-kind]")) {
    const k = scintKey(it.dataset.kind, it.dataset.sub), ev = by.get(k);
    if (!ev || String(ev.ts) !== it.dataset.ts) continue;
    const node = q(it, ".sc-ss__mv") || q(it, ".sc-ss__tk") || it;
    if (lit.has(k)) { if (lit.get(k)) scScint(node, scintTone(ev)); continue; }
    /* past the cap (opening the page with 28 on the tape) the rest are marked as seen WITHOUT a flash: otherwise the
       next tick would flash the next dozen, and the one after that the next, and a flash would stop meaning "new" */
    const go = n < SCINT_GLOW_CAP ? scintGlow("strip", ev, node) : (SCINT_SEEN.set("strip|" + k, ev.ts), false);
    lit.set(k, go);
    if (go) n++;
  }
  return true;
}
`;

export function applyST2(src) {
  const once = (s, anchor) => { const n = s.split(anchor).length - 1; if (n !== 1) throw new Error("ST2 anchor found " + n + " times: " + anchor.slice(0, 70)); };
  let out = src;
  once(out, CSS_ANCHOR);    out = out.replace(CSS_ANCHOR, () => CSS + CSS_ANCHOR);
  once(out, HTML_ANCHOR);   out = out.replace(HTML_ANCHOR, () => HTML_HOOK + HTML_ANCHOR);
  once(out, RENDER_ANCHOR); out = out.replace(RENDER_ANCHOR, () => RENDER_ANCHOR.split("\n")[0] + "\n" + RENDER_HOOK + RENDER_ANCHOR.split("\n")[1] + "\n");
  once(out, JS_ANCHOR);     out = out.replace(JS_ANCHOR, () => JS + JS_ANCHOR);
  return out;
}
export const PREVIEW_HEAD = '<base href="/">\n<!-- PREVIEW COPY (6 Oct 2026): ST2, TODAY\'S SCINTILLAS as a moving tape (hub/st2-scintillas-tape-20261006). ' +
  "This is index.html plus the four ST2 insertions. The live page at / is unchanged. -->\n";
export function previewOf(src) {
  if (src.split("<head>\n").length !== 2) throw new Error("one <head> expected");
  return applyST2(src).replace("<head>\n", () => "<head>\n" + PREVIEW_HEAD);
}

/* Every page under deliverables/ carries the Hub's grey BACK / CLOSE pair (scripts/inject-scnav.py puts a slot in the
   page's <header> and the pair before </body>). The preview copy carries it too. This takes exactly that back out, so
   the test can hold the rest of the copy to the byte and the picture run can show the Hub as the Hub (which, at "/",
   is not a sub-page and has no such pair). */
export function withoutScnav(html) {
  return html.replace(/<!-- scnav · [^]*?<!-- \/scnav -->\n/, "").replace("<span data-scnav-slot></span>", "");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, "../../../..");
  const src = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const dst = path.join(here, "..", "preview", "index.html");
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, previewOf(src));
  execFileSync("python3", [path.join(root, "scripts", "inject-scnav.py")], { stdio: "ignore" });   /* the BACK / CLOSE pair; it also refreshes older pages — `git checkout --` those */
  if (withoutScnav(fs.readFileSync(dst, "utf8")) !== previewOf(src)) throw new Error("the preview is not index.html + ST2 + the BACK / CLOSE pair");
  const tmp = path.join(here, ".index.st2.html");
  fs.writeFileSync(tmp, applyST2(src));
  let diff = "";
  try { execFileSync("diff", ["-u", "--label", "a/index.html", "--label", "b/index.html", path.join(root, "index.html"), tmp]); }
  catch (e) { diff = String(e.stdout || ""); }
  fs.unlinkSync(tmp);
  fs.writeFileSync(path.join(here, "..", "ST2-index.diff"), diff);
  console.log("preview", path.relative(root, dst), fs.statSync(dst).size, "bytes · diff", diff.split("\n").length, "lines,",
    (diff.match(/^@@/gm) || []).length, "hunks, +" + (diff.match(/^\+(?!\+\+)/gm) || []).length + " −" + (diff.match(/^-(?!--)/gm) || []).length);
}
