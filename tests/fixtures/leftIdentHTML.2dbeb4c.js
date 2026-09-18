/* GOLDEN - production 2dbeb4c leftIdentHTML, extracted verbatim from git show 2dbeb4c:index.html (economic-port lane). */
function leftIdentHTML(data) {
  const chg = data.chg, live = S.state === "live";
  const pc = num(prevClose[data.t]);
  const col = chg != null ? (chg >= 0 ? "var(--bull)" : "var(--bear)") : "var(--ink)";
  return '<div class="sc-cident">' +
    '<span class="sc-ctkbig">' + esc(data.t || "") + "</span>" +
    '<span class="sc-cname">' + esc(data.name || "") + "</span>" +
    '<span class="sc-cpx" id="coPx" style="color:' + col + '">' + (data.price != null ? fmtPxIdent(data.price) : "—") + "</span>" +
    '<span class="sc-cchg" id="coChg" style="color:' + col + '">' + (chg != null ? fmtC(chg) : "") + "</span>" +
    '<span class="sc-cprev" id="coPrev">' + (pc != null && pc !== 0 ? "Prev " + fmtPxIdent(pc) : "") + "</span>" +
    '<span class="sc-clive' + (live ? "" : " is-off") + '">● ' + (live ? "LIVE" : "OFFLINE") + "</span></div>";
}
