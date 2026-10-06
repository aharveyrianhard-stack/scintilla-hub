/* PG1 — runs INSIDE the page under review (injected before any page script, in every frame).
   It only watches: layout shifts, long main-thread tasks, and the moment numbers first appear.
   It reads nothing private and sends nothing anywhere; the review script collects `window.__pg1` afterwards. */
(() => {
  if (window.__pg1) return;
  const P = (window.__pg1 = { shift: 0, shifts: [], longTasks: [], firstData: null, t0: performance.now() });
  /* mark(): start a fresh measurement on a page that is already open (a tab click, a company opened).
     From then on "first data" only counts numbers inside parts of the page that were ADDED after the mark,
     so the board that is already on screen cannot answer for the room that is still loading. */
  P.fresh = null;
  P.mark = () => {
    P.t0 = performance.now(); P.shift = 0; P.shifts = []; P.longTasks = []; P.firstData = null;
    P.fresh = new WeakSet();
    if (!P.mo) {
      P.mo = new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) P.fresh.add(n); });
      P.mo.observe(document.documentElement, { childList: true, subtree: true });
    }
  };
  /* parts of the page a script added after the first HTML arrived (as opposed to words that were in the HTML itself) */
  P.dyn = new WeakSet();
  document.addEventListener("DOMContentLoaded", () => {
    new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) P.dyn.add(n); })
      .observe(document.documentElement, { childList: true, subtree: true });
  });
  const isDyn = (el) => { for (let p = el; p; p = p.parentElement) if (P.dyn.has(p)) return true; return false; };
  const isFresh = (el) => { if (!P.fresh) return true; for (let p = el; p; p = p.parentElement) if (P.fresh.has(p)) return true; return false; };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.hadRecentInput) continue;
        P.shift += e.value;
        if (e.value >= 0.01 && P.shifts.length < 12) {
          const src = (e.sources || []).map((s) => {
            const n = s.node && s.node.nodeType === 1 ? s.node : s.node && s.node.parentElement;
            return n ? n.tagName.toLowerCase() + (n.id ? "#" + n.id : "") + (n.classList && n.classList.length ? "." + n.classList[0] : "") : "?";
          });
          P.shifts.push({ at: Math.round(e.startTime), value: +e.value.toFixed(4), what: src.slice(0, 3) });
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch (e) { /* not supported in this frame */ }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) P.longTasks.push({ at: Math.round(e.startTime), ms: Math.round(e.duration) });
    }).observe({ type: "longtask", buffered: true });
  } catch (e) { /* not supported */ }

  /* "first data": the first moment the screen shows at least 8 visible number readouts (a price, a %, a count),
     30 ticker labels, 20 short lines carrying a figure (an outline of rows), or a drawn chart at least 200 px wide —
     whichever comes first. Checked every 100 ms. */
  /* a map of names with no printed numbers (the tree) also counts: 30 or more ticker labels on screen */
  const NAME = /^[A-Z][A-Z0-9]{0,4}([.\-][A-Z]{1,2})?$/;
  const NUM = /^[\s(+\-−$€£]*\d[\d,]*(\.\d+)?\s*(%|[kKmMbBtTx]|bp|bps)?\)?$/;
  P.countNumbers = (fresh) => {
    let n = 0, names = 0, loose = 0;
    const w = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const s = w.currentNode.nodeValue;
      if (!s || s.length > 40) continue;
      const isNum = s.length <= 16 && NUM.test(s.trim()), isName = !isNum && s.length <= 16 && NAME.test(s.trim());
      const isLoose = !isNum && !isName && /\d/.test(s);
      if (!isNum && !isName && !isLoose) continue;
      const el = w.currentNode.parentElement;
      if (!el || !el.getClientRects().length) continue;
      const tag = el.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "OPTION") continue;
      if (fresh && !isFresh(el)) continue;
      if (isName) { names++; continue; }
      if (isLoose) { if (isDyn(el)) loose++; continue; }
      if (++n >= 60) break;
    }
    P.names = names; P.loose = loose;
    return n;
  };
  P.canvasDrawn = (fresh) => {
    for (const c of document.querySelectorAll("canvas")) {
      if (c.width < 200 || c.height < 80 || !c.getClientRects().length) continue;
      if (fresh && !isFresh(c)) continue;
      /* shrink the whole canvas to 48×48 and look for more than one colour — a line anywhere on it counts */
      try {
        const k = document.createElement("canvas"); k.width = k.height = 48;
        const g = k.getContext("2d", { willReadFrequently: true });
        g.drawImage(c, 0, 0, 48, 48);
        const d = g.getImageData(0, 0, 48, 48).data;
        let seen = 0;
        for (let i = 4; i < d.length; i += 4)
          if (Math.abs(d[i] - d[0]) + Math.abs(d[i + 1] - d[1]) + Math.abs(d[i + 2] - d[2]) + Math.abs(d[i + 3] - d[3]) > 24 && ++seen > 6) return true;
      } catch (e) { return true; }
    }
    /* a drawing made of shapes rather than a canvas (the tree): 40 or more drawn marks on screen */
    let marks = 0;
    for (const g of document.querySelectorAll("svg")) {
      if (!g.getClientRects().length || (fresh && !isFresh(g))) continue;
      marks += g.querySelectorAll("rect,path,circle,line,polyline,polygon").length;
      if (marks >= 40) return true;
    }
    return false;
  };
  const tick = () => {
    if (P.firstData == null && document.body) {
      try { if (P.countNumbers(true) >= 8 || P.names >= 30 || P.loose >= 20 || P.canvasDrawn(true)) P.firstData = Math.round(performance.now() - P.t0); } catch (e) { /* keep polling */ }
    }
  };
  setInterval(tick, 100);

  /* what is on the screen once it has settled */
  P.audit = (staleMin) => {
    const out = { numbers: P.countNumbers(), placeholders: [], blankPanels: [], ages: [], stale: [] };
    const PH = /^(—|–|-{1,3}|…|\.{3}|n\/a|nan|undefined|null|loading…?|loading\.{3})$/i;
    const vw = innerWidth, vh = innerHeight;
    const where = (el) => {
      let p = el, bits = [];
      for (let i = 0; p && p.nodeType === 1 && i < 3; i++, p = p.parentElement)
        bits.unshift(p.tagName.toLowerCase() + (p.id ? "#" + p.id : "") + (p.classList && p.classList.length ? "." + p.classList[0] : ""));
      return bits.join(" > ");
    };
    const onScreen = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw; };
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const FLAG = /\b(fallback|stale|degraded|unavailable|offline|no data|not answering|not responding)\b/i;
    const AGE = /(?<![\d.])(\d{1,4})\s*(s|sec|secs|m|min|mins|h|hr|hrs|d|day|days|w|wk|wks)\b\s*(ago|old|late|stale)\b/i;
    const UNIT = { s: 1 / 60, sec: 1 / 60, secs: 1 / 60, m: 1, min: 1, mins: 1, h: 60, hr: 60, hrs: 60, d: 1440, day: 1440, days: 1440, w: 10080, wk: 10080, wks: 10080 };
    while (w.nextNode()) {
      const raw = w.currentNode.nodeValue; if (!raw) continue;
      const s = raw.trim(); if (!s) continue;
      const el = w.currentNode.parentElement;
      if (!el || el.tagName === "SCRIPT" || el.tagName === "STYLE" || !onScreen(el)) continue;
      if (s.length <= 12 && PH.test(s)) { if (out.placeholders.length < 400) out.placeholders.push(where(el)); continue; }
      /* the page saying so in words: "market_breadth · FALLBACK", "500 STALE TRADES", "UNAVAILABLE",
         "194 channel feeds not answering" */
      if (s.length <= 60 && FLAG.test(s) && out.stale.length < 60) { out.stale.push({ text: s.slice(0, 60), minutes: null, where: where(el), flag: true }); continue; }
      if (s.length <= 80) {
        const m = AGE.exec(s);
        if (m) {
          const min = Math.round(+m[1] * UNIT[m[2].toLowerCase()]);
          const rec = { text: s.slice(0, 60), minutes: min, where: where(el) };
          if (out.ages.length < 60) out.ages.push(rec);
          if (min > staleMin && out.stale.length < 60) out.stale.push(rec);
        }
      }
    }
    /* anything the page itself marks as stale */
    for (const el of document.querySelectorAll('[class*="stale" i],[data-stale="1"],[data-stale="true"]')) {
      if (!onScreen(el)) continue;
      const cls = String(el.className && el.className.baseVal != null ? el.className.baseVal : el.className);
      if (/(^|[\s_-])(not|no|un)[_-]?stale|stale[_-]?(ok|false|0)\b/i.test(cls)) continue;
      const tip = String(el.getAttribute("title") || "").trim().split("\n").pop();   // the page's own note, e.g. "computed … · 14 min old"
      const t = ((el.textContent || "").trim() + (tip ? " — " + tip : "")).slice(0, 90);
      if (out.stale.length < 60) out.stale.push({ text: t || "(marked stale)", minutes: null, where: where(el), marked: true });
    }
    /* a blank panel: a box of real size on screen with no words, no picture and no drawn canvas */
    const seen = new Set();
    for (const el of document.querySelectorAll('[class*="panel" i],[class*="card" i],[class*="pane" i],[class*="box" i],[class*="widget" i],section,iframe')) {
      const r = el.getBoundingClientRect();
      if (r.width < 160 || r.height < 90 || !onScreen(el)) continue;
      if (el.tagName === "IFRAME") continue;        // frames are audited from inside (every frame carries this probe)
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
      if ((el.innerText || "").trim().length > 0) continue;
      if (el.querySelector("img,svg,video,iframe,input,select,textarea")) continue;
      let drawn = false;
      for (const c of el.querySelectorAll("canvas")) if (c.width > 0 && c.height > 0) drawn = true;
      if (drawn) continue;
      let dup = false; for (const s of seen) if (s.contains(el) || el.contains(s)) dup = true;
      if (dup) continue;
      seen.add(el);
      if (out.blankPanels.length < 40) out.blankPanels.push({ where: where(el), w: Math.round(r.width), h: Math.round(r.height) });
    }
    return out;
  };
})();
