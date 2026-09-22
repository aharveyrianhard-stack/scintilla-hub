/* SCINTILLA · VISUAL ENGINE · geiger-engine.js
   The crew every Geiger surface hires: the Bar, the Mover, the Quiet Rule, the Clock, the Label.
   No dependencies, no data of its own — a surface hands it real values and it draws and moves them.
   Proposal: deliverables/20260922/prototypes-visual/VISUAL-ENGINE.html §3 (22 Sep 2026). */
(function (root) {
  'use strict';

  var SPEC_CURVE = 'cubic-bezier(.34,.02,.2,1)';   // the agreed spec curve (branch agent/geiger-motion)
  var OLD_CURVE = 'cubic-bezier(.32,0,.18,1)';     // what the live Hub still uses today
  var CURVES = { spec: SPEC_CURVE, old: OLD_CURVE, ease: 'ease-out', linear: 'linear' };
  var DEFAULTS = {
    geiger: 'composite',        // which Geiger drives the motion: the Hub composite, not the fan read
    mover: 'settle-reflow',     // values settle first, then rows slide
    curve: 'spec',
    resortMs: 1200,             // a re-sort (live tick / re-rank)
    playMs: 650,                // one step of playback
    tieHold: 0.02,              // rows closer than this keep their order
    quiet: true,                // while moving: name + Geiger + arrow only
    trails: false,
    badgeMs: 1400,
    returnToLiveMs: 45000
  };

  function reducedMotion() {
    try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  function fmtSigned(v, d) { return v == null || !isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d == null ? 2 : d); }
  function fmtAge(ms) {
    if (ms == null || !isFinite(ms)) return '—';
    var s = Math.max(0, Math.round(ms / 1000));
    return s < 60 ? s + ' s' : s < 3600 ? Math.round(s / 60) + ' min' : s < 172800 ? (s / 3600).toFixed(1) + ' h' : Math.round(s / 86400) + ' d';
  }

  /* ─────────────────────────────── THE BAR ──────────────────────────────────
     One drawing of a Geiger: zero in the middle, green grows right, red grows left, −1..+1.
     Vertical variant for the STRIP: zero in the middle, green grows up, red grows down. */
  var Bar = {
    html: function (vertical) {
      return '<span class="ve-track' + (vertical ? ' ve-v' : '') + '" role="img"><i class="ve-mid"></i><i class="ve-fill"></i></span>';
    },
    paint: function (track, v, opt) {
      opt = opt || {};
      var fill = track.querySelector('.ve-fill');
      var max = opt.max || 1, dur = opt.dur || 0, vertical = track.classList.contains('ve-v');
      var ok = v != null && isFinite(v);
      track.classList.toggle('ve-none', !ok);
      track.setAttribute('aria-label', ok ? 'Geiger ' + fmtSigned(v) : 'no reading');
      var t = dur ? (vertical ? 'top ' + dur + 'ms ease-out, height ' : 'left ' + dur + 'ms ease-out, width ') + dur + 'ms ease-out, background ' + Math.round(dur * .4) + 'ms linear' : 'none';
      fill.style.transition = t;
      var w = ok ? Math.min(Math.abs(v) / max, 1) * 50 : 0;
      var bull = ok && v >= 0;
      fill.className = 've-fill ' + (ok ? (bull ? 've-bull' : 've-bear') : '');
      if (vertical) {
        fill.style.left = ''; fill.style.width = '';
        fill.style.height = w + '%'; fill.style.top = (bull ? 50 - w : 50) + '%';
      } else {
        fill.style.top = ''; fill.style.height = '';
        fill.style.width = w + '%'; fill.style.left = (bull ? 50 : 50 - w) + '%';
      }
    }
  };

  /* ─────────────────────────────── THE MOVER ────────────────────────────────
     The only thing allowed to move rows. FLIP on translate; one curve; values settle first, then rows
     slide (or the other options, for comparison). Near-ties hold. Emits movestart / moveend so the
     Quiet Rule knows when to hide the rest. axis 'y' (rows) or 'x' (columns). */
  function Mover(container, opt) {
    this.el = container;
    this.opt = Object.assign({ axis: 'y', size: 30, mode: DEFAULTS.mover, curve: DEFAULTS.curve, resortMs: DEFAULTS.resortMs,
      playMs: DEFAULTS.playMs, tieHold: DEFAULTS.tieHold, trails: DEFAULTS.trails, badgeMs: DEFAULTS.badgeMs, badges: true, reduced: null }, opt || {});
    this.rows = {}; this.order = []; this.prev = []; this.pos = {}; this._timers = []; this._moving = false; this._ev = {};
    container.classList.add('ve-rows');
  }
  Mover.prototype.on = function (ev, fn) { (this._ev[ev] = this._ev[ev] || []).push(fn); return this; };
  Mover.prototype._emit = function (ev) { (this._ev[ev] || []).forEach(function (f) { try { f(); } catch (e) { /* a listener must not break the move */ } }); };
  Mover.prototype.configure = function (o) { Object.assign(this.opt, o || {}); return this; };
  Mover.prototype.curve = function () { return CURVES[this.opt.curve] || this.opt.curve || SPEC_CURVE; };
  Mover.prototype.reduced = function () { return this.opt.reduced == null ? reducedMotion() : !!this.opt.reduced; };
  Mover.prototype.moving = function () { return this._moving; };

  /* ensure(items): items = [{key, build(el)}] — create/remove row elements. Returns true if the set changed. */
  Mover.prototype.ensure = function (items) {
    var self = this, seen = {}, changed = false;
    items.forEach(function (it) {
      seen[it.key] = 1;
      if (!self.rows[it.key]) {
        var el = document.createElement('div'); el.className = 've-row'; el.dataset.key = it.key;
        it.build(el);
        var rk = document.createElement('span'); rk.className = 've-rk'; el.appendChild(rk);
        self.el.appendChild(el); self.rows[it.key] = el; changed = true;
      }
    });
    Object.keys(this.rows).forEach(function (k) {
      if (!seen[k]) { self.rows[k].remove(); delete self.rows[k]; delete self.pos[k]; changed = true; }
    });
    var n = items.length;
    if (this.opt.axis === 'y') this.el.style.height = (n * this.opt.size) + 'px'; else this.el.style.width = (n * this.opt.size) + 'px';
    return changed;
  };

  /* computeOrder(values): keys sorted by value desc; near-ties keep their previous relative order. */
  Mover.prototype.computeOrder = function (values) {
    var keys = Object.keys(this.rows), v = values, self = this;
    keys.sort(function (a, b) {
      var av = v[a], bv = v[b];
      if (av == null && bv == null) return a.localeCompare(b);
      if (av == null) return 1; if (bv == null) return -1;
      return bv - av;
    });
    if (this.opt.tieHold > 0 && this.prev.length) {
      var p = {}; this.prev.forEach(function (k, i) { p[k] = i; });
      for (var i = 0; i < keys.length - 1; i++) {
        var a = keys[i], b = keys[i + 1];
        if (v[a] != null && v[b] != null && Math.abs(v[a] - v[b]) < self.opt.tieHold && p[b] != null && p[a] != null && p[b] < p[a]) { keys[i] = b; keys[i + 1] = a; }
      }
    }
    return keys;
  };

  Mover.prototype._place = function (order, dur) {
    var self = this, axis = this.opt.axis, size = this.opt.size, moved = [];
    order.forEach(function (k, i) {
      var el = self.rows[k]; if (!el) return;
      var to = i * size, from = self.pos[k];
      self.pos[k] = to;
      var tf = axis === 'y' ? 'translateY(' + to + 'px)' : 'translateX(' + to + 'px)';
      if (!dur || from == null || from === to) { el.style.transition = 'none'; el.style.transform = tf; return; }
      moved.push([el, tf]);
    });
    if (!moved.length) return 0;
    moved[0][0].getBoundingClientRect();          // one flush for the whole set (FLIP)
    var c = this.curve();
    moved.forEach(function (m) { m[0].style.transition = 'transform ' + dur + 'ms ' + c; m[0].style.transform = m[1]; });
    return moved.length;
  };

  Mover.prototype._badges = function (order) {
    if (!this.opt.badges) return;
    var self = this, was = {}, now = {};
    this.prev.forEach(function (k, i) { was[k] = i; }); order.forEach(function (k, i) { now[k] = i; });
    order.forEach(function (k) {
      var el = self.rows[k], rk = el.querySelector('.ve-rk'); if (!rk) return;
      var d = (was[k] == null) ? 0 : was[k] - now[k];
      if (!d) { rk.classList.remove('ve-show'); return; }
      rk.textContent = (d > 0 ? '▲' : '▼') + Math.abs(d);
      rk.className = 've-rk ve-show ' + (d > 0 ? 've-up' : 've-dn');
      clearTimeout(el.__rkT);
      if (self.opt.badgeMs > 0) el.__rkT = setTimeout(function () { rk.classList.remove('ve-show'); }, self.opt.badgeMs);
    });
  };

  Mover.prototype._trails = function (order, dur) {
    if (!this.opt.trails || this.opt.axis !== 'y') return;
    var self = this, was = {}; this.prev.forEach(function (k, i) { was[k] = i; });
    order.forEach(function (k, pos) {
      var from = was[k]; if (from == null || from === pos) return;
      var a = Math.min(from, pos) * self.opt.size + 6, b = Math.max(from, pos) * self.opt.size + self.opt.size - 6;
      var tr = document.createElement('i'); tr.className = 've-trail ' + (pos < from ? 've-up' : 've-dn');
      tr.style.top = a + 'px'; tr.style.height = (b - a) + 'px';
      self.el.appendChild(tr);
      requestAnimationFrame(function () { tr.style.opacity = '0'; });
      setTimeout(function () { tr.remove(); }, dur + 100);
    });
  };

  /* update(values, paint, kind): values = {key: sortValue}; paint(el, key, dur, zero) draws a row's content.
     kind: 'tick' (same measure, new numbers) | 'play' (one playback step) | 'measure' (a different measure:
     continuity would be a lie, so collapse & rebuild) | 'fresh' (new set: no animation). */
  Mover.prototype.update = function (values, paint, kind) {
    var self = this;
    this._timers.forEach(clearTimeout); this._timers = [];
    var order = this.computeOrder(values);
    this.prev = this.order.length ? this.order.slice() : order.slice();
    this.order = order;
    var reduced = this.reduced();
    var D = kind === 'play' ? this.opt.playMs : this.opt.resortMs;
    if (reduced || kind === 'fresh' || this.opt.mode === 'cut') D = 0;
    var mode = this.opt.mode;
    if (kind === 'measure' && mode !== 'cut' && D) mode = 'collapse';
    var V = Math.round(D * .4), R = D;
    var keys = Object.keys(this.rows);
    var paintAll = function (dur, zero) { keys.forEach(function (k) { paint(self.rows[k], k, dur, zero); }); };
    var done = function () { self._moving = false; self.el.classList.remove('ve-moving'); self._emit('moveend'); };
    var later = function (fn, ms) { self._timers.push(setTimeout(fn, ms)); };
    if (!D) { paintAll(0, false); this._place(order, 0); this._badges(order); this._moving = false; this.el.classList.remove('ve-moving'); return; }
    this._moving = true; this.el.classList.add('ve-moving'); this._emit('movestart');
    if (mode === 'settle-reflow') {
      paintAll(V, false);
      later(function () { self._place(order, R); self._badges(order); self._trails(order, R); later(done, R + 40); }, V + 20);
    } else if (mode === 'reflow-settle') {
      this._place(order, R); this._badges(order); this._trails(order, R);
      later(function () { paintAll(V, false); later(done, V + 40); }, R + 20);
    } else if (mode === 'collapse') {
      paintAll(Math.round(V * .6), true);
      later(function () { self._place(order, R); self._badges(order); later(function () { paintAll(V, false); later(done, V + 40); }, R + 20); }, Math.round(V * .6) + 20);
    } else { // 'immediate' — both at once, with a wake where trails are on
      paintAll(V, false); this._place(order, R); this._badges(order); this._trails(order, R);
      later(done, Math.max(V, R) + 40);
    }
  };

  /* ─────────────────────────────── THE QUIET RULE ───────────────────────────
     While the Mover is working, only the name, the Geiger bar and the rank arrow are visible.
     Everything marked .ve-extra is gone — not dimmed — and comes back when rows land.
     visibility (not display) so nothing reflows: no layout jump. */
  var QuietRule = {
    attach: function (mover, boardEl, enabled) {
      var st = { on: enabled !== false };
      mover.on('movestart', function () { if (st.on) boardEl.classList.add('ve-quiet'); });
      mover.on('moveend', function () { boardEl.classList.remove('ve-quiet'); });
      return { set: function (on) { st.on = !!on; if (!on) boardEl.classList.remove('ve-quiet'); }, get: function () { return st.on; } };
    }
  };

  /* ─────────────────────────────── THE CLOCK ────────────────────────────────
     One time source for every surface: live or rewind, one scrubber, one lookback. After 45 s untouched
     it returns to live by itself. The LIVE chip has a reserved seat (the surface keeps its box). */
  function Clock(opt) {
    this.opt = Object.assign({ returnToLiveMs: DEFAULTS.returnToLiveMs, playMs: DEFAULTS.playMs }, opt || {});
    this.timeline = []; this.mode = 'live'; this.idx = -1; this.playing = false; this._idle = null; this._play = null; this._ev = {};
  }
  Clock.prototype.on = function (ev, fn) { (this._ev[ev] = this._ev[ev] || []).push(fn); return this; };
  Clock.prototype._emit = function (ev) { var s = this.state(); (this._ev[ev] || []).forEach(function (f) { f(s); }); };
  Clock.prototype.state = function () {
    return { mode: this.mode, idx: this.idx, playing: this.playing, entry: this.mode === 'rewind' ? this.timeline[this.idx] : null, n: this.timeline.length };
  };
  /* entries: [{t: ISO time, label}] oldest → newest */
  Clock.prototype.setTimeline = function (entries) {
    this.timeline = entries || [];
    if (this.mode === 'rewind') { this.idx = Math.min(this.idx, this.timeline.length - 1); if (this.idx < 0) this.goLive(); }
    this._emit('timeline');
  };
  Clock.prototype.touch = function () {
    var self = this; clearTimeout(this._idle);
    if (this.mode === 'rewind' && this.opt.returnToLiveMs > 0) this._idle = setTimeout(function () { if (self.mode === 'rewind' && !self.playing) self.goLive(); }, this.opt.returnToLiveMs);
  };
  Clock.prototype.rewindTo = function (i) {
    if (!this.timeline.length) return;
    this.idx = Math.max(0, Math.min(this.timeline.length - 1, i | 0));
    this.mode = this.idx >= this.timeline.length - 1 ? 'live' : 'rewind';
    if (this.mode === 'live') { this.idx = -1; }
    this.touch(); this._emit('change');
  };
  Clock.prototype.goLive = function () { this.pause(); clearTimeout(this._idle); this.mode = 'live'; this.idx = -1; this._emit('change'); };
  Clock.prototype.play = function () {
    var self = this; if (this.playing || !this.timeline.length) return;
    if (this.mode === 'live') { this.idx = 0; this.mode = 'rewind'; }
    this.playing = true; clearTimeout(this._idle); this._emit('change');
    var step = function () {
      if (!self.playing) return;
      if (self.idx >= self.timeline.length - 1) { self.goLive(); return; }
      self.idx += 1; self._emit('change');
      self._play = setTimeout(step, self.opt.playMs + 60);
    };
    this._play = setTimeout(step, this.opt.playMs + 60);
  };
  Clock.prototype.pause = function () { this.playing = false; clearTimeout(this._play); this.touch(); this._emit('change'); };
  Clock.prototype.toggle = function () { this.playing ? this.pause() : this.play(); };

  /* ─────────────────────────────── THE LABEL ────────────────────────────────
     Every surface says which Geiger it shows and how fresh. No data = one quiet line, never a grid of empty tiles. */
  var Label = {
    text: function (o) {
      var parts = [];
      if (o.geiger) parts.push('GEIGER: ' + o.geiger);
      if (o.computed) { var age = Date.now() - Date.parse(o.computed); parts.push('computed ' + String(o.computed).slice(11, 19) + 'Z (' + fmtAge(age) + ' ago)'); }
      if (o.verification) parts.push(o.verification);
      if (o.quotes) parts.push('quotes ' + o.quotes.n + ' names · oldest ' + fmtAge(o.quotes.oldestMs) + ' · median ' + fmtAge(o.quotes.medianMs));
      if (o.clock) parts.push(o.clock);
      if (reducedMotion()) parts.push('REDUCED MOTION (system setting): nothing animates');
      (o.notes || []).forEach(function (n) { if (n) parts.push(n); });
      return parts.join(' · ');
    },
    render: function (el, o) { el.textContent = Label.text(o); el.classList.toggle('ve-label-warn', !!(o.warn)); }
  };

  root.GeigerEngine = { SPEC_CURVE: SPEC_CURVE, OLD_CURVE: OLD_CURVE, CURVES: CURVES, DEFAULTS: DEFAULTS, Bar: Bar, Mover: Mover,
    QuietRule: QuietRule, Clock: Clock, Label: Label, reducedMotion: reducedMotion, fmtSigned: fmtSigned, fmtAge: fmtAge };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GeigerEngine;
})(typeof window !== 'undefined' ? window : globalThis);
