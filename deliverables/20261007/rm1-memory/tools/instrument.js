// RM1 soak instrumentation — injected into every frame BEFORE the page's own scripts run.
// It only counts; it never changes what the page does. Third-party frames (YouTube etc.) are
// left untouched so the page under test is the only thing being measured.
(() => {
  // A same-origin iframe starts life as about:blank and KEEPS that window when it navigates, so
  // an empty hostname is judged by the page that owns the frame.
  const ours = (h) => /(^|\.)scintillahub\.ai$/.test(h);
  let host = location.hostname;
  if (!host) { try { host = window.top.location.hostname; } catch (_) { host = "third-party"; } }
  if (!ours(host)) return;
  if (window.__rm1) return;

  const SKIP = "__rm1_";
  const normFrame = (line) => {
    // "    at fn (https://host/path?x:12:34)" -> "/path:12:34 fn"
    const m = /^\s*at (?:(.*?) \()?(.*?):(\d+):(\d+)\)?$/.exec(line);
    if (!m) return line.trim().slice(0, 120);
    let file = m[2] || "";
    try { file = new URL(file, location.href).pathname; } catch (_) { file = file.split("?")[0]; }
    return file + ":" + m[3] + ":" + m[4] + (m[1] ? " " + m[1] : "");
  };
  const site = () => {
    const prev = Error.stackTraceLimit;
    Error.stackTraceLimit = 8;
    const stack = String(new Error().stack || "").split("\n");
    Error.stackTraceLimit = prev;
    for (let i = 1; i < stack.length; i++) {
      const line = stack[i];
      if (line.indexOf(SKIP) !== -1 || line.indexOf("instrument.js") !== -1 || line.indexOf("http") === -1) continue;
      return normFrame(line);
    }
    return "(unknown)";
  };
  const bump = (map, key, by) => map.set(key, (map.get(key) || 0) + (by === undefined ? 1 : by));
  const top = (map, n) => [...map.entries()].filter((e) => e[1] !== 0).sort((a, b) => b[1] - a[1]).slice(0, n);

  // ---- timers -------------------------------------------------------------------------
  const intervals = new Map();          // id -> site
  const intervalsCreated = new Map();   // site -> created
  const timeouts = new Map();           // id -> site (pending only)
  const timeoutsCreated = new Map();
  let rafRequested = 0;

  const oSetInterval = window.setInterval, oClearInterval = window.clearInterval;
  const oSetTimeout = window.setTimeout, oClearTimeout = window.clearTimeout;
  const oRaf = window.requestAnimationFrame;

  window.setInterval = function __rm1_setInterval(cb, ms, ...rest) {
    const id = oSetInterval.call(window, cb, ms, ...rest);
    const s = site() + " every " + (ms | 0) + "ms";
    intervals.set(id, s); bump(intervalsCreated, s);
    return id;
  };
  window.clearInterval = function __rm1_clearInterval(id) {
    intervals.delete(id); timeouts.delete(id);
    return oClearInterval.call(window, id);
  };
  window.setTimeout = function __rm1_setTimeout(cb, ms, ...rest) {
    if (typeof cb !== "function") return oSetTimeout.call(window, cb, ms, ...rest);
    let id;
    const wrapped = function __rm1_timeoutFired() { timeouts.delete(id); return cb.apply(this, arguments); };
    id = oSetTimeout.call(window, wrapped, ms, ...rest);
    const s = site();
    timeouts.set(id, s); bump(timeoutsCreated, s);
    return id;
  };
  window.clearTimeout = function __rm1_clearTimeout(id) {
    timeouts.delete(id); intervals.delete(id);
    return oClearTimeout.call(window, id);
  };
  window.requestAnimationFrame = function __rm1_raf(cb) { rafRequested++; return oRaf.call(window, cb); };

  // ---- listeners (attribution only; the exact live count comes from the browser) ---------
  const lAdds = new Map(), lRemoves = new Map();
  const oAdd = EventTarget.prototype.addEventListener, oRemove = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function __rm1_addEventListener(type, fn, opts) {
    try { bump(lAdds, type + " @ " + site()); } catch (_) {}
    return oAdd.call(this, type, fn, opts);
  };
  EventTarget.prototype.removeEventListener = function __rm1_removeEventListener(type, fn, opts) {
    try { bump(lRemoves, type + " @ " + site()); } catch (_) {}
    return oRemove.call(this, type, fn, opts);
  };

  // ---- observers ------------------------------------------------------------------------
  const obsCreated = new Map(), obsLive = new Map();
  const registry = new FinalizationRegistry((kind) => bump(obsLive, kind, -1));
  for (const kind of ["MutationObserver", "ResizeObserver", "IntersectionObserver"]) {
    const Orig = window[kind];
    if (!Orig) continue;
    const Wrapped = function __rm1_observer(...args) {
      const o = new Orig(...args);
      bump(obsCreated, kind + " @ " + site()); bump(obsLive, kind);
      registry.register(o, kind);
      return o;
    };
    Wrapped.prototype = Orig.prototype;
    try { Object.setPrototypeOf(Wrapped, Orig); } catch (_) {}
    window[kind] = Wrapped;
  }

  // ---- canvases ---------------------------------------------------------------------------
  let canvasRefs = [];
  const seenCanvas = new WeakSet();
  const canvasCreated = new Map();
  const oGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function __rm1_getContext(type, ...rest) {
    const ctx = oGetContext.call(this, type, ...rest);
    if (ctx && !seenCanvas.has(this)) {
      seenCanvas.add(this);
      canvasRefs.push({ ref: new WeakRef(this), type: String(type) });
      try { bump(canvasCreated, String(type) + " @ " + site()); } catch (_) {}
    }
    return ctx;
  };
  const canvasStats = () => {
    const out = { live: 0, attached: 0, detached: 0, pixels: 0, detachedPixels: 0, byType: {} };
    const keep = [];
    for (const entry of canvasRefs) {
      const c = entry.ref.deref();
      if (!c) continue;
      keep.push(entry);
      out.live++; out.byType[entry.type] = (out.byType[entry.type] || 0) + 1;
      const px = (c.width | 0) * (c.height | 0);
      out.pixels += px;
      if (c.isConnected) out.attached++; else { out.detached++; out.detachedPixels += px; }
    }
    canvasRefs = keep;
    return out;
  };

  // ---- DOM shape ---------------------------------------------------------------------------
  const domStats = () => {
    const all = document.getElementsByTagName("*");
    const byContainer = new Map();
    const withId = document.querySelectorAll("[id]");
    for (const el of withId) {
      const n = el.getElementsByTagName("*").length;
      if (n >= 20) byContainer.set("#" + el.id, n);
    }
    return {
      elements: all.length,
      canvases: document.getElementsByTagName("canvas").length,
      iframes: document.getElementsByTagName("iframe").length,
      images: document.getElementsByTagName("img").length,
      svgs: document.getElementsByTagName("svg").length,
      videos: document.getElementsByTagName("video").length,
      styles: document.getElementsByTagName("style").length,
      byContainer: top(byContainer, 40)
    };
  };

  const safeHref = () => {
    try {
      const u = new URL(location.href);
      const keep = ["t", "range", "feed", "view", "scene", "shell", "bare", "cols"];
      const q = keep.filter((k) => u.searchParams.has(k)).map((k) => k + "=" + u.searchParams.get(k)).join("&");
      return u.origin + u.pathname + (q ? "?" + q : "");
    } catch (_) { return "(href)"; }
  };

  window.__rm1 = {
    report() {
      const bySite = new Map();
      for (const s of intervals.values()) bump(bySite, s);
      const pendingBySite = new Map();
      for (const s of timeouts.values()) bump(pendingBySite, s);
      const net = new Map();
      for (const [k, v] of lAdds) net.set(k, v - (lRemoves.get(k) || 0));
      let adds = 0, removes = 0;
      for (const v of lAdds.values()) adds += v;
      for (const v of lRemoves.values()) removes += v;
      return {
        href: safeHref(),
        top: window.top === window,
        visibility: document.visibilityState,
        timers: {
          intervalsActive: intervals.size,
          intervalsActiveBySite: top(bySite, 30),
          intervalsCreatedBySite: top(intervalsCreated, 30),
          timeoutsPending: timeouts.size,
          timeoutsPendingBySite: top(pendingBySite, 15),
          timeoutsCreatedBySite: top(timeoutsCreated, 25),
          rafRequested
        },
        listeners: { adds, removes, addsBySite: top(lAdds, 40), removesBySite: top(lRemoves, 15) },
        observers: { created: top(obsCreated, 20), live: top(obsLive, 5) },
        canvases: Object.assign(canvasStats(), { createdBySite: top(canvasCreated, 15) }),
        dom: domStats()
      };
    }
  };
})();
