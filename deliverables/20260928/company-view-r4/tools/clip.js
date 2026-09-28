(() => {
  /* R4 — every visible element whose own text is cut at its box edge (overflow hidden/clip, or an ellipsis), plus any
     board row whose ticker box runs into its price box. Reports a short path and the text, never changes the page. */
  const out = [], seen = new Set();
  const name = (e) => { let s = e.tagName.toLowerCase(); if (e.id) s += "#" + e.id; const c = (e.className && e.className.baseVal == null ? String(e.className) : "").trim().split(/\s+/).filter(Boolean).slice(0, 2); if (c.length) s += "." + c.join("."); return s; };
  const pth = (e) => { const a = []; let n = e; for (let i = 0; n && i < 3; i++, n = n.parentElement) a.unshift(name(n)); return a.join(" > "); };
  const vis = (e, r) => r.width > 2 && r.height > 2 && r.bottom > 0 && r.right > 0 && r.top < innerHeight * 3 && r.left < innerWidth;
  for (const e of document.querySelectorAll("body *")) {
    if (e.closest("svg,canvas,iframe,script,style,#trialBanner")) continue;
    const own = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
    if (!own) continue;
    const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = e.getBoundingClientRect(); if (!vis(e, r)) continue;
    const ox = cs.overflowX, oy = cs.overflowY;
    const cutX = e.scrollWidth > e.clientWidth + 1 && (ox === "hidden" || ox === "clip");
    const cutY = e.scrollHeight > e.clientHeight + 2 && (oy === "hidden" || oy === "clip") && cs.webkitLineClamp === "none";
    const ell = cs.textOverflow === "ellipsis" && e.scrollWidth > e.clientWidth + 1;
    /* text spilling out of a clipping ancestor */
    let anc = null;
    for (let p = e.parentElement, i = 0; p && i < 4; p = p.parentElement, i++) {
      const pc = getComputedStyle(p); if (pc.overflowX === "hidden" || pc.overflowX === "clip") {
        const pr = p.getBoundingClientRect(); if (r.right > pr.right + 2 || r.left < pr.left - 2) { anc = name(p); } break; }
    }
    if (cutX || cutY || ell || anc) {
      const k = pth(e) + "|" + own.slice(0, 30); if (seen.has(k)) continue; seen.add(k);
      out.push({ at: pth(e), text: own.slice(0, 60), why: [cutX && "cut-x", cutY && "cut-y", ell && "ellipsis", anc && "spills " + anc].filter(Boolean).join(","), w: Math.round(r.width), x: Math.round(r.left), y: Math.round(r.top) });
    }
  }
  /* board rows: ticker text wider than its cell, or running into the price */
  const ov = [];
  for (const row of [...document.querySelectorAll(".sc-board__row")].slice(0, 60)) {
    const tk = row.querySelector(".sc-ctk"), lp = row.querySelector(".sc-last"); if (!tk || !lp) continue;
    const a = tk.getBoundingClientRect(), b = lp.getBoundingClientRect();
    const rng = document.createRange(); rng.selectNodeContents(tk); const tr = rng.getBoundingClientRect();
    const rng2 = document.createRange(); rng2.selectNodeContents(lp); const pr = rng2.getBoundingClientRect();
    if (tr.right > pr.left - 2 || tr.right > a.right + 1) ov.push(row.dataset.t + " ticker ends " + Math.round(tr.right) + " price text starts " + Math.round(pr.left));
  }
  return { n: out.length, clipped: out.slice(0, 80), boardOverlap: ov.slice(0, 20), vw: innerWidth };
})()
