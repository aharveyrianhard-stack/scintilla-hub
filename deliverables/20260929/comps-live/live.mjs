/* Scintilla · comps on the live company view (C1, 29 Sep) · the mount.
   index.html's ESTIMATES tab carries a COMPS section (02·c) with an empty box; this module fills it for the
   company on screen: the six round-3 rows, way B as the tranche band, the numbered step-by-step, and COMPARE
   (two or three companies on one % axis). It reads through the Hub's own `pg` and the chart API's /quotes,
   takes the same snapshot the node script takes (snapshot-live.mjs), and keeps one snapshot per ticker for
   ten minutes so switching companies or comparing does not re-read the tables every time.
   Nothing is written anywhere; the compare list is remembered per browser (localStorage sc.comps.compare). */

import { takeSnapshot } from "./snapshot-live.mjs";
import { ladder, compareSet, ROW_KEYS } from "./ladder.mjs";
import { CSS, esc, P, rowNode, wayNode, compareFieldNode, legend, ladderHTML, PCT, P0 } from "./draw.mjs";

const CACHE = new Map(), TTL = 10 * 60e3;
const LS = "sc.comps.compare";
const lsGet = () => { try { const v = JSON.parse(localStorage.getItem(LS) || "[]"); return Array.isArray(v) ? v.map((t) => String(t).toUpperCase()).slice(0, 3) : []; } catch (_) { return []; } };
const lsSet = (v) => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch (_) {} };

function ensureCSS() { if (document.getElementById("cl-css")) return; const s = document.createElement("style"); s.id = "cl-css"; s.textContent = CSS; document.head.appendChild(s); }

/** One snapshot per ticker, fresh for ten minutes. opts: { pg, quotes, today, livePrice } */
export async function snapshotFor(ticker, opts) {
  const T = String(ticker).toUpperCase(), hit = CACHE.get(T);
  if (hit && Date.now() - hit.at < TTL && !(opts.livePrice > 0 && hit.snap.price !== opts.livePrice && hit.snap.price_from !== "the Hub's live quote")) return hit.snap;
  const p = (async () => {
    const snap = await takeSnapshot({ ticker: T, today: opts.today, pg: opts.pg, quotes: opts.quotes, livePrice: opts.livePrice || null });
    CACHE.set(T, { snap, at: Date.now() });
    return snap;
  })();
  CACHE.set(T, { snap: hit ? hit.snap : null, at: 0, pending: p });
  try { return await p; } catch (e) { CACHE.delete(T); throw e; }
}

/** Mount the comps for one company into root. Returns a promise that resolves when drawn (or the error is shown). */
export async function mountCompsLive(root, opts) {
  ensureCSS();
  const T = String(opts.ticker).toUpperCase();
  root.classList.add("cl");
  root.dataset.mounted = T;
  root.innerHTML = `<div class="cl-loading">READING THE PEERS OF ${esc(T)}…</div>`;
  let snap;
  try { snap = await snapshotFor(T, opts); }
  catch (e) { root.innerHTML = `<div class="cl-err"><b>${esc(T)}</b>: the comps could not be read — ${esc(e && e.message || e)}.</div>`; return; }
  if (root.dataset.mounted !== T) return;   // another company took the box meanwhile
  render(root, snap, opts);
}

function render(root, snap, opts) {
  const T = snap.ticker, L = ladder(snap), rows = snap.rows.filter((r) => ROW_KEYS.includes(r.key));
  const B = L.steps[4].band, U = L.steps[5];
  root.innerHTML = "";
  const stamp = document.createElement("div"); stamp.className = "cl-stamp";
  stamp.innerHTML = `<b>${esc(T)}</b> · ${esc(snap.name)} · cohort <b>${esc(snap.cohort)}</b> · ${L.steps[0].peers.length} peers · price ${esc(P(snap.price))} (${esc(snap.price_from || "?")}, ${esc(snap.price_date || "?")}) · read ${esc(new Date(snap.taken).toLocaleTimeString("en-GB", { timeZone: "America/New_York", hour12: false }))} ET${snap.quotes_error ? ` · <span class="cl-dn">today's prices not reached: ${esc(snap.quotes_error)} — the fundamentals row's dated price stands in</span>` : ""}`;
  root.appendChild(stamp);
  const grid = document.createElement("div"); grid.className = "cl-grid"; root.appendChild(grid);
  const left = document.createElement("div"), right = document.createElement("div"); grid.appendChild(left); grid.appendChild(right);
  // the field
  left.innerHTML = `<h4>The football field <small>six rows · every mark named · multiples on top, the price each implies for ${esc(T)} below</small></h4>`;
  const panel = document.createElement("div"); panel.className = "cl-panel";
  panel.innerHTML = `<div class="cl-colhead"><span>Row</span><span>Top: the multiple · bottom: the price it implies for ${esc(T)}</span><span>Upside from ${esc(T)} today</span></div>`;
  for (const r of rows) panel.appendChild(rowNode(r, T));
  panel.insertAdjacentHTML("beforeend", legend("row", T));
  left.appendChild(panel);
  left.insertAdjacentHTML("beforeend", `<h4>The tranche band <small>way B · the six rows folded into one, in dollars for ${esc(T)}</small></h4>`);
  const wp = document.createElement("div"); wp.className = "cl-panel";
  wp.appendChild(wayNode(rows, T, snap.price));
  if (L.outliers.outliers.length && L.outliers.rows_without) {
    wp.appendChild(wayNode(L.outliers.rows_without, T, snap.price, { label: "THE SAME BAND WITHOUT THE OUTLIERS", sub: `${L.outliers.outliers.map((o) => o.ticker + " on " + o.label).join(", ")} set aside` }));
  }
  wp.insertAdjacentHTML("beforeend", legend("way", T));
  wp.insertAdjacentHTML("beforeend", `<div class="cl-note">${B ? `<b>${esc(T)} today ${esc(P(snap.price))}</b> · band ${esc(P0(B.lo))} – ${esc(P0(B.hi))}, centre ${esc(P0(B.mid))} · <b class="${U.mid.pct >= 0 ? "cl-up" : "cl-dn"}">${esc(PCT(U.mid.pct))} to the centre</b> · ${esc(PCT(U.lo.pct))} to the low edge · ${esc(PCT(U.hi.pct))} to the high edge` : "no band: no row can be priced"} · the analysts' price target on this tab is a different measure and never enters this band.</div>`);
  left.appendChild(wp);
  // the ladder
  right.innerHTML = `<h4>The step-by-step <small>seven steps from the peer set to the price range · every number checkable</small></h4><div class="cl-panel">${ladderHTML(L)}</div>`;
  // compare
  const cmp = document.createElement("div"); root.appendChild(cmp);
  renderCompare(cmp, snap, opts);
  // wide: the ladder beside the field
  const ro = new ResizeObserver(() => { const w = root.clientWidth; grid.classList.toggle("cl-wide", w >= 1180); });
  ro.observe(root);
}

async function renderCompare(box, snap, opts) {
  const T = snap.ticker;
  const others = lsGet().filter((t) => t !== T).slice(0, 2);
  const peers = (snap.members || []).filter((t) => t !== T && !(snap.excluded || []).some((e) => e.ticker === t));
  box.innerHTML = `<h4>Compare <small>two or three companies on one axis: upside is upside</small></h4><div class="cl-panel">
    <div class="cl-cmpbar"><span>Compare ${esc(T)} with</span><input type="text" placeholder="NVDA, GEV" value="${esc(others.join(", "))}" aria-label="tickers to compare, up to two" spellcheck="false"><button type="button" data-cl="go">Compare</button><button type="button" data-cl="clear">Clear</button>
      <span style="flex-basis:100%"></span><span>Quick picks from ${esc(snap.cohort)}:</span>${peers.slice(0, 10).map((t) => `<button type="button" data-cl="pick" data-t="${esc(t)}" aria-pressed="${others.includes(t)}">${esc(t)}</button>`).join("")}</div>
    <div data-cl="body">${others.length ? `<div class="cl-loading">READING…</div>` : `<div class="cl-words">Type one or two tickers (any served company with a cohort), or take a quick pick. Each company's band is drawn as upside from its own price, so the axis reads the same for all of them.</div>`}</div></div>`;
  const input = box.querySelector("input"), body = box.querySelector('[data-cl="body"]');
  const go = async (list) => {
    const want = [...new Set(list.map((t) => String(t).toUpperCase().replace(/[^A-Z0-9.\-]/g, "")).filter((t) => t && t !== T))].slice(0, 2);
    lsSet(want); input.value = want.join(", ");
    for (const b of box.querySelectorAll('[data-cl="pick"]')) b.setAttribute("aria-pressed", String(want.includes(b.dataset.t)));
    if (!want.length) { body.innerHTML = `<div class="cl-words">Nothing to compare yet.</div>`; return; }
    body.innerHTML = `<div class="cl-loading">READING ${esc(want.join(" AND "))}…</div>`;
    const snaps = [snap], failed = [];
    for (const t of want) { try { snaps.push(await snapshotFor(t, { ...opts, livePrice: opts.priceOf ? opts.priceOf(t) : null })); } catch (e) { failed.push(`${t}: ${e && e.message || e}`); } }
    const C = compareSet(snaps);
    body.innerHTML = "";
    body.appendChild(compareFieldNode(C));
    body.insertAdjacentHTML("beforeend", legend("cmp", T));
    const grid = document.createElement("div"); grid.className = "cl-cmpgrid";
    for (const s of snaps) {
      const L = ladder(s), B = L.steps[4].band, U = L.steps[5];
      const d = document.createElement("div");
      d.innerHTML = `<div class="cl-nm">${esc(s.ticker)} <small style="color:var(--cl-dim);font-weight:400">${esc(s.name)}</small></div>
        <dl><dt>cohort</dt><dd>${esc(s.cohort)} · ${L.steps[0].peers.length} peers</dd><dt>today</dt><dd>${esc(P(s.price))}</dd>
        ${B ? `<dt>low edge</dt><dd>${esc(P0(B.lo))} · <span class="${U.lo.pct >= 0 ? "cl-up" : "cl-dn"}">${esc(PCT(U.lo.pct))}</span></dd><dt>centre</dt><dd><b>${esc(P0(B.mid))} · <span class="${U.mid.pct >= 0 ? "cl-up" : "cl-dn"}">${esc(PCT(U.mid.pct))}</span></b></dd><dt>high edge</dt><dd>${esc(P0(B.hi))} · <span class="${U.hi.pct >= 0 ? "cl-up" : "cl-dn"}">${esc(PCT(U.hi.pct))}</span></dd><dt>rows priced</dt><dd>${L.steps[4].used.length} of 6</dd><dt>outliers</dt><dd>${L.outliers.outliers.length ? L.outliers.outliers.map((o) => o.ticker).join(", ") : "none"}${L.outliers.without && L.outliers.changed ? ` · without: ${esc(PCT(L.without.upside.mid.pct))}` : ""}</dd>` : `<dt>band</dt><dd>none</dd>`}</dl>
        <div class="cl-sentence">${esc(L.steps[6].sentence)}</div>
        <details class="cl-step"><summary><span class="cl-stepn">1–7</span><span class="cl-stept">the ladder for ${esc(s.ticker)}</span></summary><div class="cl-body">${ladderHTML(L, { compact: true })}</div></details>`;
      grid.appendChild(d);
    }
    body.appendChild(grid);
    if (C.ranked.length > 1) body.insertAdjacentHTML("beforeend", `<div class="cl-note">Ranked by the upside to the centre: <b>${C.ranked.map((t) => { const c = C.companies.find((x) => x.ticker === t); return `${esc(t)} ${esc(PCT(c.upside.mid.pct))}`; }).join(" · ")}</b>. Upside is upside: the same arithmetic, each against its own cohort, on one axis.</div>`);
    if (failed.length) body.insertAdjacentHTML("beforeend", `<div class="cl-err">Could not be read: ${esc(failed.join("; "))}</div>`);
  };
  box.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-cl]"); if (!b) return;
    if (b.dataset.cl === "go") go(input.value.split(/[,\s]+/));
    else if (b.dataset.cl === "clear") go([]);
    else if (b.dataset.cl === "pick") { const cur = lsGet().filter((t) => t !== T); const t = b.dataset.t; go(cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t].slice(-2)); }
  });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(input.value.split(/[,\s]+/)); });
  if (others.length) go(others);
}
