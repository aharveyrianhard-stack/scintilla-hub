/* GEIGER MOTION v3 · the arithmetic behind the three views, with no drawing in it.
   Loaded by the pages (window.GV3M) and by tests/geiger-motion-v3.test.mjs (module.exports).
   Every function is pure: names in, numbers out, so a test can pin each one. */
(function (root, make) {
  if (typeof module === "object" && module.exports) module.exports = make(); else root.GV3M = make();
})(typeof self !== "undefined" ? self : this, function () {
  const M = {};

  /* ---- ranking ------------------------------------------------------------------
     Best first, descending by value. A name with no value ranks last. Ties break by name,
     so two equal readings always come out in the same order and a row never jitters. */
  M.order = function (names, valueOf) {
    return names.map((t) => [t, valueOf(t)]).sort((a, b) => {
      const av = a[1], bv = b[1];
      if (av == null && bv == null) return a[0] < b[0] ? -1 : 1;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (bv !== av) return bv - av;
      return a[0] < b[0] ? -1 : 1;
    }).map((x) => x[0]);
  };

  /* The whole window at once: for each day the order, and for each name its rank per day (1 = leader). */
  M.rankTable = function (names, nDays, valueAt) {
    const order = [], rank = {};
    for (const t of names) rank[t] = new Array(nDays);
    for (let d = 0; d < nDays; d++) {
      const o = M.order(names, (t) => valueAt(t, d));
      order.push(o);
      o.forEach((t, i) => { rank[t][d] = i + 1; });
    }
    return { order, rank, n: names.length, days: nDays };
  };

  /* Rank at a fractional day: the straight line between the two real days either side. */
  M.rankAt = function (rank, t, pos) {
    const r = rank[t], L = r.length;
    const i = Math.max(0, Math.min(L - 1, Math.floor(pos))), j = Math.min(L - 1, i + 1), f = pos - i;
    return r[i] + (r[j] - r[i]) * f;
  };

  /* Places climbed from the day before (+ = up the board, − = down, 0 on the first day). */
  M.move = function (rank, t, d) { return d <= 0 ? 0 : rank[t][d - 1] - rank[t][d]; };

  /* Crossings between day d−1 and day d: the number of pairs whose order flipped.
     This is what the timeline draws as lines crossing; it is also the number of overtakes. */
  M.crossings = function (table, d) {
    if (d <= 0) return 0;
    const prev = table.order[d - 1], pos = {};
    table.order[d].forEach((t, i) => { pos[t] = i; });
    let x = 0;
    for (let a = 0; a < prev.length; a++) for (let b = a + 1; b < prev.length; b++) if (pos[prev[a]] > pos[prev[b]]) x++;
    return x;
  };

  /* Who led after each hole. */
  M.leaders = function (table) { return table.order.map((o) => o[0]); };

  /* ---- the race -----------------------------------------------------------------
     A runner's distance is what it has earned so far. Two honest definitions:
       "sum"      the readings added up day by day (a bear day walks it back);
       "compound" the day moves compounded, i.e. the % since the start.
     Returns progress[t][d]. Missing days add nothing. */
  M.progress = function (names, nDays, valueAt, mode) {
    const P = {};
    for (const t of names) {
      const row = new Array(nDays); let acc = mode === "compound" ? 1 : 0;
      for (let d = 0; d < nDays; d++) {
        const v = valueAt(t, d);
        if (v != null) acc = mode === "compound" ? acc * (1 + v / 100) : acc + v;
        row[d] = mode === "compound" ? (acc - 1) * 100 : acc;
      }
      P[t] = row;
    }
    return P;
  };
  M.progressAt = function (P, t, pos) {
    const r = P[t], L = r.length;
    const i = Math.max(0, Math.min(L - 1, Math.floor(pos))), j = Math.min(L - 1, i + 1), f = pos - i;
    return r[i] + (r[j] - r[i]) * f;
  };
  /* The track: from the furthest anyone fell back to the furthest anyone got, over the whole window.
     The finish line is the winner's final distance, so it is where the leader arrives on the last day. */
  M.track = function (P) {
    let lo = 0, hi = 0, finish = -Infinity;
    for (const t in P) { for (const v of P[t]) { if (v < lo) lo = v; if (v > hi) hi = v; } const last = P[t][P[t].length - 1]; if (last > finish) finish = last; }
    return { lo, hi, finish };
  };

  /* ---- what fits ----------------------------------------------------------------
     Rows that do not fit fold under "+N more"; nothing scrolls inside a player. */
  M.fit = function (height, pitch, reserve) {
    return Math.max(1, Math.floor((height - (reserve || 0)) / pitch));
  };
  M.fold = function (order, visible) {
    return { shown: order.slice(0, visible), hidden: order.length - Math.min(visible, order.length), next: order.slice(visible, visible + 3) };
  };

  /* ---- the holes on show ----------------------------------------------------------
     A leaderboard column per day only fits so many; the window always ENDS on the hole being played. */
  M.holeWindow = function (cur, nDays, maxCols) {
    const end = Math.max(0, Math.min(nDays - 1, cur)), start = Math.max(0, end - maxCols + 1);
    return { start, end };
  };

  return M;
});
