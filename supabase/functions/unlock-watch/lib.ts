// SCINTILLA · unlock-watch · lib.ts — the PURE half (no network, no clock): every rule that turns a prospectus into a
// lock-up row lives here, so tests/r2-unlock-20261002.test.mjs can hold it to real SEC text without a request.
//
// What the prospectus says, and how this file reads it (R2 Part B, 2 Oct 2026):
//   · The lock-up term is counted from "the date of this prospectus" — printed on the cover as "Prospectus dated May 13,
//     2026" (Cerebras), "Prospectus Dated June 11, 2026." (SpaceX) or "The date of this prospectus is March 19, 2024"
//     (Astera). The unlock date is that date + the day count: SpaceX's own table calls December 8, 2026 "the 180th day after
//     the date of this prospectus" (June 11 + 180), so the count runs from the prospectus date, not the first trading day.
//   · The day count is the number the lock-up sentences agree on ("180-day lock-up period", "180 days after the date of this
//     prospectus", "the 180th day after the date of this prospectus"); Rule 144 / Rule 701 sentences (90 days) never vote.
//   · An early-release trigger is kept as the sentence that states it (Cerebras: "the second trading day following our
//     release of earnings for the quarter ending September 30, 2026 or (ii) 180 days…") and as short words for the Hub.
//   · A staged release (SpaceX, Cerebras) is the prospectus's own "Earliest Date Available for Sale in the Public Market"
//     table, read row by row: a date or an earnings trigger, and the shares it frees.
//   · A relisting or a direct listing has no underwriters' lock-up: the row says so and carries no computed date.

export type Tranche = {
  date: string | null;             // ISO date the tranche becomes saleable, when the table prints one
  day: number | null;              // "(120th day after the date of this prospectus)"
  trigger: string | null;          // short words for an earnings / price trigger ("2 trading days after the Q3 2026 report")
  quarter_end: string | null;      // the quarter whose earnings release starts the clock, ISO
  shares: string | null;           // as printed: "328.4 million", "1.3 billion", "all remaining"
  pct: string | null;              // "7%" when the row states a share of the locked stock
  conditional: boolean;            // the row only releases if a price test passes
  final: boolean;                  // the last row: everything still locked
};
export type Lockup = {
  days: number | null; months: number | null; clause: string | null;
  early_release: string | null; early_rule: string | null;
  prospectus_date: string | null; schedule: Tranche[]; direct_listing: boolean;
};

const MON = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const ORD: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 };
const MONTH_WORD = "(?:January|February|March|April|May|June|July|August|September|October|November|December)";
const pad = (n: number) => String(n).padStart(2, "0");

/** "May 13, 2026" → "2026-05-13" (null when it is not a calendar date) */
export function isoFromWords(s: string | null | undefined): string | null {
  const m = /([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(String(s || ""));
  if (!m) return null;
  const mi = MON.indexOf(m[1].toLowerCase());
  if (mi < 0) return null;
  const d = +m[2], y = +m[3];
  const dt = new Date(Date.UTC(y, mi, d));
  return dt.getUTCMonth() === mi && dt.getUTCDate() === d ? `${y}-${pad(mi + 1)}-${pad(d)}` : null;
}
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();          // day 31 + 1 month → the month's last day
  const dt = new Date(Date.UTC(y, m - 1 + n, Math.min(d, last)));
  return dt.toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400e3);
}
/** the trailing N calendar months as [from, to] windows, newest first; the current month ends today */
export function monthWindows(todayIso: string, n: number): [string, string][] {
  const out: [string, string][] = [];
  const [y, m] = todayIso.split("-").map(Number);
  for (let i = 0; i < n; i++) {
    const first = new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 10);
    const last = new Date(Date.UTC(y, m - i, 0)).toISOString().slice(0, 10);
    out.push([first, last > todayIso ? todayIso : last]);
  }
  return out;
}
/** calendar quarter from a quarter-end ISO date: "2026-09-30" → "Q3 2026" */
export function quarterName(iso: string | null): string | null {
  if (!iso) return null;
  const mo = +iso.slice(5, 7);
  return mo % 3 === 0 ? "Q" + mo / 3 + " " + iso.slice(0, 4) : null;
}

/** HTML → one line of plain text. Typographic quotes, dashes and non-breaking spaces become plain ones, the page's
    running "123 Table of Contents" footers are dropped. */
export function cleanHtml(s: string): string {
  return String(s || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;|&#xa0;/gi, " ")
    .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;|&#x201c;|&#x201d;/gi, '"')
    .replace(/&lsquo;|&rsquo;|&#8216;|&#8217;|&#x2018;|&#x2019;/gi, "'")
    .replace(/&ndash;|&mdash;|&#8211;|&#8212;|&#x2013;|&#x2014;/gi, "-")
    .replace(/&#(\d{2,5});/g, (_m, d) => String.fromCharCode(+d))
    .replace(/&#x([0-9a-f]{2,4});/gi, (_m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/g, "'")
    .replace(/[    ]/g, " ")
    .replace(/[‐-―]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/\s\d{1,3}\s+Table\s+o\s?f\s+Contents\s/g, " ")
    .replace(/(\d{1,3})\s+(st|nd|rd|th)\b/g, "$1$2");           // "70 th day" (a typesetting split) → "70th day"
}

/** split text into sentences without breaking on "a.m.", "Inc.", "U.S." or a decimal ("1.3 billion") */
export function sentences(t: string): string[] {
  const H = "․";
  const p = String(t || "")
    .replace(/\bU\.S\./g, "U" + H + "S" + H)
    .replace(/\b(a\.m|p\.m|Inc|Nos?|Co|Corp|Ltd|i\.e|e\.g|vs|Mr|Ms|Dr|Jr|L\.P|N\.A|S\.A|N\.V|B\.V|Sec|Art)\./gi, (m) => m.replace(/\./g, H))
    .replace(/(\d)\.(\d)/g, "$1" + H + "$2");
  return p.split(/(?<=[.!?])\s+(?=["'(]?[A-Z0-9])/).map((x) => x.split(H).join(".").trim()).filter(Boolean);
}

const LOCK_RE = /lock[\s-]?up|restricted period|market stand-?off/i;
const ANCHOR = "(?:after|following|from)\\s+(?:the\\s+)?(?:date\\s+of\\s+(?:this|the\\s+final|the)\\s+prospectus|closing(?:\\s+date)?|consummation|date\\s+of\\s+the\\s+underwriting\\s+agreement)";

/** the cover's prospectus date: "Prospectus dated May 13, 2026" / "The date of this prospectus is March 19, 2024" */
export function parseProspectusDate(text: string): string | null {
  const m = new RegExp("(?:prospectus\\s+dated|date\\s+of\\s+this\\s+prospectus\\s+is)\\s+(" + MONTH_WORD + "\\s+\\d{1,2},\\s+\\d{4})", "i").exec(text || "");
  return m ? isoFromWords(m[1]) : null;
}

/** every day count a lock-up sentence states, with how strongly it states it (a tranche row's "70th day" is weak) */
export function dayVotes(sentence: string): { n: number; w: number }[] {
  const s = sentence, out: { n: number; w: number }[] = [];
  if (/Rule\s+(?:144|701)\b/i.test(s) && !/lock[\s-]?up\s+(?:period|agreements?)\s+(?:of|ending|for)/i.test(s)) return out;
  for (const m of s.matchAll(/\b(\d{2,3})-day\s+(?:lock[\s-]?up|restricted|market stand-?off)/gi)) out.push({ n: +m[1], w: 2 });
  for (const m of s.matchAll(new RegExp("\\b(\\d{2,3})\\s*(?:\\(\\d{2,3}\\)\\s*)?days?\\s+" + ANCHOR, "gi"))) out.push({ n: +m[1], w: 3 });
  for (const m of s.matchAll(new RegExp("\\((\\d{2,3})\\)\\s*days?\\s+" + ANCHOR, "gi"))) out.push({ n: +m[1], w: 3 });
  for (const m of s.matchAll(new RegExp("\\b(\\d{2,3})(?:st|nd|rd|th)\\s+day\\s+" + ANCHOR, "gi"))) out.push({ n: +m[1], w: 1 });
  return out.filter((v) => v.n >= 30 && v.n <= 1100);
}
/** month-based terms ("one year after the Closing", "six months after the date of this prospectus") — SPAC sponsors use them */
export function monthVote(sentence: string): number | null {
  const W: Record<string, number> = { one: 1, two: 2, three: 3, six: 6, nine: 9, twelve: 12, eighteen: 18, twenty_four: 24 };
  const m = new RegExp("\\b(one|two|three|six|nine|twelve|eighteen|\\d{1,2})\\s*(?:\\(\\d{1,2}\\)\\s*)?(months?|years?)\\s+" + ANCHOR, "i").exec(sentence);
  if (!m) return null;
  const k = /^\d+$/.test(m[1]) ? +m[1] : W[m[1].toLowerCase()];
  if (!k) return null;
  return /^year/i.test(m[2]) ? k * 12 : k;
}

/** short words for an earnings-release trigger in a sentence, or null.
    "the second trading day following our release of earnings for the quarter ending September 30, 2026" → "2 trading days after the Q3 2026 report" */
export function earningsTrigger(sentence: string): { words: string; quarter_end: string | null; n: number } | null {
  const re = new RegExp("\\b(first|second|third|fourth|fifth|\\d{1,2})(?:st|nd|rd|th)?\\s+(?:full\\s+)?trading\\s+day\\s+(?:on\\s+\\w+\\s+)?(?:immediately\\s+)?(?:following|after)\\s+" +
    "(?:the\\s+date\\s+(?:that|on\\s+which)\\s+we\\s+publicly\\s+announce\\s+earnings|(?:our|the)\\s+(?:public\\s+)?(?:release|announcement)\\s+of\\s+(?:our\\s+)?(?:earnings|(?:quarterly\\s+)?financial\\s+results)|the\\s+First\\s+Earnings\\s+Release\\s+Date)" +
    "([^.]{0,160})", "i");
  const m = re.exec(sentence);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? +m[1] : ORD[m[1].toLowerCase()];
  const q = new RegExp("quarter\\s+(?:ending|ended)\\s+(" + MONTH_WORD + "\\s+\\d{1,2},\\s+\\d{4})", "i").exec(m[2] || "");
  const qe = q ? isoFromWords(q[1]) : null, qn = quarterName(qe);
  const what = qn ? "the " + qn + " report" : /First\s+Earnings\s+Release/i.test(m[0]) ? "the first earnings report as a public company"
    : /second\s+quarter\s+following/i.test(m[2] || "") ? "the second earnings report after the listing"
    : /first\s+quarter\s+following/i.test(m[2] || "") ? "the first earnings report after the listing" : "a set earnings report";
  return { words: n + " trading day" + (n === 1 ? "" : "s") + " after " + what, quarter_end: qe, n };
}

/** the "Earliest Date Available for Sale in the Public Market" table → tranches in the prospectus's own order */
export function parseSchedule(tableText: string): Tranche[] {
  const t = tableText || "";
  const rowStart = new RegExp(
    "(?:6:00\\s+a\\.m\\.\\s+Eastern\\s+Time\\s+on\\s+|the\\s+opening\\s+of\\s+trading\\s+on\\s+)?" +
    "(?:(?<!(?:ended|ending|to|of|through|before|after)\\s)(" + MONTH_WORD + "\\s+\\d{1,2},\\s+\\d{4})(?:\\s*\\((\\d{2,3})(?:st|nd|rd|th)\\s+day\\s+after\\s+the\\s+date\\s+of\\s+this\\s+prospectus\\))?" +
    "|The\\s+(?:earlier|later)\\s+of\\s+\\(i\\)" +
    "|(?:The|the)\\s+(?:first|second|third|fourth)\\s+(?:full\\s+)?trading\\s+day\\s+(?:on\\s+\\w+\\s+)?(?:immediately\\s+)?(?:following|after)\\s+(?:(?:our|the)\\s+(?:public\\s+)?(?:release|announcement|effectiveness)|the\\s+First\\s+Earnings\\s+Release\\s+Date)" +
    "|If\\s+the\\s+reported\\s+closing\\s+price)", "g");
  const starts: { i: number; date: string | null; day: number | null }[] = [];
  for (const m of t.matchAll(rowStart)) {
    const prev = starts[starts.length - 1];
    if (prev && m.index! - prev.i < 40) continue;                               // "The earlier of (i) 6:00 a.m. … on …" is one row
    starts.push({ i: m.index!, date: m[1] ? isoFromWords(m[1]) : null, day: m[2] ? +m[2] : null });
  }
  const out: Tranche[] = [];
  const COND = /provided\s+that\s+the\s+(?:reported\s+)?closing\s+price|If\s+the\s+reported\s+closing\s+price|Release\s+Trigger\s+was\s+satisfied/i;
  let carryCond = false;                       // "If the reported closing price … , the second full trading day …" is ONE row
  for (let k = 0; k < starts.length; k++) {
    const seg = t.slice(starts[k].i, k + 1 < starts.length ? starts[k + 1].i : Math.min(t.length, starts[k].i + 900));
    const sh = /(?:up\s+to|aggregate\s+of\s+up\s+to|approximately)\s+(?:approximately\s+)?(?:\(i\)\s+)?([\d.,]+\s*(?:million|billion|thousand))\s+(?:additional\s+)?shares/i.exec(seg);
    const all = /\ball\s+remaining\s+shares|remaining\s+shares\s+(?:subject\s+to|held\s+by)/i.test(seg);
    if (!sh && !all) { if (COND.test(seg)) carryCond = true; continue; }       // a row that frees nothing is a heading, a footnote or a price test
    const pct = /representing\s+(?:the\s+)?(\d{1,3})%/i.exec(seg);
    const earlierOf = /^The\s+earlier\s+of/i.test(seg);
    const trig = earningsTrigger(seg);
    const listing = /effectiveness\s+of\s+the\s+registration\s+statement/i.exec(seg.slice(0, 220));
    const ord = /\b(first|second|third)\s+trading\s+day/i.exec(seg.slice(0, 160));
    let date = trig && !earlierOf ? null : starts[k].date, day = starts[k].day;
    if (earlierOf) {                                                             // "(ii) 180 days after the date of this prospectus" → the dated leg
      const dd = new RegExp("\\(ii\\)\\s+(?:the\\s+)?(\\d{2,3})(?:st|nd|rd|th)?\\s*days?\\s+" + ANCHOR, "i").exec(seg);
      if (dd) { day = +dd[1]; date = null; }
    }
    out.push({ date, day,
      trigger: trig ? trig.words : listing && ord ? ORD[ord[1].toLowerCase()] + " trading day" + (ORD[ord[1].toLowerCase()] === 1 ? "" : "s") + " after the listing" : null,
      quarter_end: trig ? trig.quarter_end : null,
      shares: sh ? sh[1].replace(/\s+/g, " ") : "all remaining", pct: pct ? pct[1] + "%" : null,
      conditional: carryCond || (COND.test(seg) && !/was\s+not\s+satisfied/i.test(seg.slice(0, 160))),
      final: all });
    carryCond = false;
  }
  return out;
}
/** keep a long sentence readable: the part from "for a period" / "the earlier of" through its end, at most `max` characters */
export function focusClause(s: string | null, max = 420): string | null {
  if (!s) return null;
  if (s.length <= max) return s;
  const m = /(?:for\s+a\s+period|during\s+the\s+period|period\s+ending|the\s+earlier\s+of|the\s+later\s+of|until)\b/i.exec(s)
    || /\b(?:The\s+|the\s+)?(?:first|second|third|fourth)\s+(?:full\s+)?trading\s+day\b/.exec(s);       // a staged table's trigger row
  let from = m && m.index > 0 ? m.index : Math.max(0, s.length - max);
  if (!m && from > 0) { const sp = s.indexOf(" ", from); if (sp > 0) from = sp + 1; }                         // never start mid-word
  const out = s.slice(from, from + max);
  return (from > 0 ? "… " : "") + out + (from + max < s.length ? " …" : "");
}

/** read the lock-up out of prospectus text (already cleaned). Pure: the caller decides what text to pass. */
export function findLockup(text: string, todayIso?: string): Lockup {
  text = String(text || "").replace(/\s{2,}/g, " ");                    // streamed pieces are joined with a space: never a run of them
  const prospectus_date = parseProspectusDate(text);
  const sents = sentences(text).filter((s) => LOCK_RE.test(s) || new RegExp("\\d{2,3}(?:st|nd|rd|th)\\s+day\\s+" + ANCHOR, "i").test(s));
  // each day count's votes, and the sentence that states it best: "180 days after the date of this prospectus" (rank 3) over
  // "the 180th day after the date of this prospectus" (2) over "the 180-day lock-up period" (1)
  const votes = new Map<number, number>(), bestFor = new Map<number, { r: number; s: string }>();
  let months: number | null = null, monthClause: string | null = null;
  for (const s of sents) {
    for (const v of dayVotes(s)) {
      votes.set(v.n, (votes.get(v.n) || 0) + v.w);
      const r = v.w === 3 ? 3 : v.w === 1 ? 2 : 1, cur = bestFor.get(v.n);
      if (LOCK_RE.test(s) && (!cur || r > cur.r)) bestFor.set(v.n, { r, s });
    }
    if (months == null && LOCK_RE.test(s)) { const mv = monthVote(s); if (mv) { months = mv; monthClause = s; } }
  }
  let days: number | null = null, best = 0;
  for (const [n, w] of votes) if (w > best || (w === best && days != null && n > days)) { best = w; days = n; }
  const clause = days != null ? (bestFor.get(days)?.s || null) : monthClause;
  if (days != null) months = null;
  // the early-release sentence: a lock-up sentence that names an earnings release (or, failing that, a price test)
  const early = sents.find((s) => LOCK_RE.test(s) && /the\s+(?:earlier|later)\s+of/i.test(s) && earningsTrigger(s))
    || sents.find((s) => LOCK_RE.test(s) && earningsTrigger(s))
    || sents.find((s) => LOCK_RE.test(s) && /closing\s+price[^.]{0,200}?(?:at\s+least|exceed(?:s|ed)?)\s+\d{2,3}%/i.test(s)) || null;
  // the staged table, when the prospectus has one: from its heading to the next section heading (case matters: a heading)
  let schedule: Tranche[] = [];
  const ti = text.search(/Earliest\s+Date\s+Available\s+for\s+Sale/i);
  if (ti >= 0) {
    const rest = text.slice(ti + 40, ti + 16000);
    const end = rest.search(/Lock-[Uu]p Agreements|Lock-[Uu]p and Market Stand|Market Standoff (?:Agreements|Provisions) [A-Z]|Rule 144 In general|Rule 144 Affiliates|Rule 701 In general/);
    schedule = parseSchedule(text.slice(ti, ti + 40 + (end < 0 ? rest.length : end)));
  }
  let early_rule: string | null = null;
  const et = early ? earningsTrigger(early) : null;
  if (et) early_rule = "or " + et.words + (/the\s+later\s+of/i.test(early!) && !/the\s+earlier\s+of/i.test(early!) ? ", if later" : ", if earlier");
  else if (early) early_rule = "earlier if the share price passes a set test";
  // a staged release: the final row's own "earlier of" leg, then the steps STILL AHEAD (todayIso) inside the main lock-up
  const fin = schedule.find((x) => x.final) || null;
  const mainEnd = prospectus_date && days != null ? addDays(prospectus_date, days) : null;
  const ahead = (x: Tranche) => !todayIso || (x.date ? x.date >= todayIso : x.quarter_end ? x.quarter_end >= addDays(todayIso, -75) : true);
  const inMain = (x: Tranche) => !mainEnd || (x.date ? x.date <= mainEnd : x.quarter_end ? x.quarter_end <= mainEnd : true);
  const dated = schedule.filter((x) => x.date && !x.final && ahead(x) && inMain(x));
  const trigSteps = schedule.filter((x) => x.trigger && x.quarter_end && !x.final && !x.conditional && ahead(x) && inMain(x));
  const big = trigSteps.sort((a, b) => (parseFloat(b.pct || "0") - parseFloat(a.pct || "0")))[0] || null;
  const later = schedule.filter((x) => x.date && mainEnd && x.date > mainEnd).map((x) => x.date!).sort().pop() || null;
  if (schedule.filter((x) => x.date && !x.final).length >= 2) {
    const finRule = fin && fin.trigger && fin.quarter_end ? "or " + fin.trigger + ", if earlier" : null;
    const steps = (dated.length ? dated.length + " dated step" + (dated.length === 1 ? "" : "s") + " before it" : "") +
      (big ? (dated.length ? " and " : "") + (big.pct || big.shares + " sh") + " " + big.trigger : "");
    early_rule = [finRule, steps ? "staged: " + steps : null, later ? "an extended lock-up runs to " + later : null].filter(Boolean).join(" · ") || null;
  }
  const direct_listing = /\bdirect\s+listing\b/i.test(text.slice(0, 200000)) && !/\bunderwriters?\s+(?:have|has)\s+(?:severally\s+)?agreed\s+to\s+purchase/i.test(text);
  // a staged table's first row arrives glued to the table's heading: keep the row, drop the heading
  const earlyRow = early ? early.replace(/^[\s\S]*?Earliest\s+Date\s+Available\s+for\s+Sale\s+in\s+the\s+Public\s+Market\s+(?:Approximate\s+)?Number\s+of\s+Shares\s+of\s+(?:our\s+)?(?:Class\s+[A-Z]\s+)?Common\s+Stock\s+/i, "") : null;
  return { days, months, clause: focusClause(clause), early_release: focusClause(earlyRow, 520),
           early_rule, prospectus_date, schedule, direct_listing };
}

/** the unlock date and how it was found. A relisting or a direct listing gets none: there is no underwriters' lock-up. */
export function unlockFrom(kind: string, anchorIso: string | null, lk: Pick<Lockup, "days" | "months">):
  { unlock_date: string | null; lockup_days: number | null; basis: "PROSPECTUS" | "ASSUMED_180" | null } {
  if (kind === "RELISTING" || kind === "DIRECT_LISTING" || kind === "SPINOFF") return { unlock_date: null, lockup_days: null, basis: null };
  if (!anchorIso) return { unlock_date: null, lockup_days: null, basis: null };
  if (lk.days != null) return { unlock_date: addDays(anchorIso, lk.days), lockup_days: lk.days, basis: "PROSPECTUS" };
  if (lk.months != null) { const u = addMonths(anchorIso, lk.months); return { unlock_date: u, lockup_days: daysBetween(anchorIso, u), basis: "PROSPECTUS" }; }
  return { unlock_date: addDays(anchorIso, 180), lockup_days: 180, basis: "ASSUMED_180" };
}

/** which SEC document carries the deal's terms: the final IPO prospectus (424B4, else 424B1), else the merger prospectus
    of a SPAC (424B3 after an S-4/F-4), else the last registration statement (S-1/F-1 and amendments). */
export function pickProspectus(filings: { formType: string; filingDate: string; link?: string; finalLink?: string }[], listingIso: string):
  { form: string; date: string; url: string; kind: "IPO" | "SPAC" | "UNKNOWN" } | null {
  const f = (filings || []).map((r) => ({ form: String(r.formType || "").toUpperCase(), date: String(r.filingDate || "").slice(0, 10), url: r.finalLink || r.link || "" }))
    .filter((r) => r.url && /^https:\/\/www\.sec\.gov\//.test(r.url));
  const near = (r: { date: string }) => Math.abs(daysBetween(r.date, listingIso));
  const by = (forms: string[]) => f.filter((r) => forms.includes(r.form)).sort((a, b) => near(a) - near(b))[0] || null;
  const b4 = by(["424B4", "424B1"]);
  if (b4 && near(b4) <= 30) return { ...b4, kind: "IPO" };
  const merger = f.some((r) => /^(S-4|F-4|S-4\/A|F-4\/A|DEFM14A)$/.test(r.form));
  const b3 = merger ? f.filter((r) => r.form === "424B3" && r.date <= addDays(listingIso, 10)).sort((a, b) => (a.date < b.date ? 1 : -1))
    .find((r) => f.some((s) => /^(S-4|F-4)/.test(s.form) && s.date <= r.date)) || null : null;
  if (b3) return { ...b3, kind: "SPAC" };
  if (merger) { const s4 = f.filter((r) => /^(S-4|F-4)/.test(r.form)).sort((a, b) => (a.date < b.date ? 1 : -1))[0]; if (s4) return { ...s4, kind: "SPAC" }; }
  const s1 = f.filter((r) => /^(S-1|F-1)(\/A)?$/.test(r.form) && r.date <= addDays(listingIso, 5)).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (s1) return { ...s1, kind: "UNKNOWN" };
  return b4 ? { ...b4, kind: "IPO" } : null;
}

/** IPO | RELISTING | DIRECT_LISTING | SPAC | SPINOFF. A name whose profile listing date is more than a year older than its new
    listing (Nebius: Yandex 2011, back on Nasdaq 2024) is a relisting; a merger prospectus means a SPAC. */
export function classifyListing(o: { calendarIso: string | null; profileIpoIso: string | null; prospectusKind: string | null; directListing: boolean; olderAnnualReport: boolean; form10?: boolean }):
  "IPO" | "RELISTING" | "DIRECT_LISTING" | "SPAC" | "SPINOFF" {
  if (o.calendarIso && o.profileIpoIso && daysBetween(o.profileIpoIso, o.calendarIso) > 365) return "RELISTING";
  if (o.form10 && o.prospectusKind !== "IPO" && o.prospectusKind !== "SPAC") return "SPINOFF";    // a Form 10 spin-off: no underwriters, no lock-up
  if (o.prospectusKind === "SPAC") return "SPAC";
  if (o.directListing) return "DIRECT_LISTING";
  if (o.olderAnnualReport && o.prospectusKind !== "IPO") return "RELISTING";
  return "IPO";
}

/** the words the Hub prints for a row (STATS line). Pure, shared with the tests. */
export function statsLine(r: { listing_kind: string; unlock_date: string | null; lockup_days: number | null; basis: string | null; early_rule: string | null }): string | null {
  if (r.listing_kind === "RELISTING") return "no lock-up (relisting)";
  if (r.listing_kind === "DIRECT_LISTING") return "no lock-up (direct listing)";
  if (r.listing_kind === "SPINOFF") return "no lock-up (spin-off)";
  if (!r.unlock_date) return null;
  const [y, m, d] = r.unlock_date.split("-").map(Number);
  const when = d + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1] + " " + y;
  const src = r.basis === "PROSPECTUS" ? "prospectus: " + r.lockup_days + " days" : "assumed 180 days — the prospectus clause was not found";
  return "lock-up ends " + when + " (" + src + (r.early_rule ? ", " + r.early_rule.replace(/^or /, "or ").replace(/, if earlier$/, "") : "") + ")";
}

/** ONE streamed read of a prospectus: each piece becomes plain text as it arrives (cut at the last whole tag, so no tag is
    split) and its HTML is dropped. The read stops once the lock-up section has been read and a day count found — the
    "Earliest Date Available for Sale" table plus 20,000 characters, or the UNDERWRITING section's lock-up paragraph plus
    10,000 — else at the end (or maxBytes). The stop marks are looked for in each NEW piece only. Network-free: the edge
    function hands it the SEC response's reader, the tests a file's. */
export async function lockupFromStream(reader: { read(): Promise<{ value?: Uint8Array; done: boolean }>; cancel?: () => Promise<void> },
  todayIso: string, maxBytes = 16_000_000): Promise<{ bytes: number; complete: boolean; stoppedEarly: boolean; lk: Lockup }> {
  const dec = new TextDecoder();
  let carry = "", parts: string[] = [], textLen = 0, bytes = 0, done = false, stoppedEarly = false;
  let lk: Lockup | null = null, checkedAt = 0, eiAt = -1, uwAt = -1, lockAfterUw = -1, tail = "";
  const text = () => parts.join(" ");
  while (!done) {
    const { value, done: d } = await reader.read();
    done = d;
    if (value) { bytes += value.byteLength; carry += dec.decode(value, { stream: true }); }
    if (done) carry += dec.decode();
    if (!done && carry.length < 262_144) continue;                              // clean in ~256 KB pieces
    let cut = done ? carry.length : carry.lastIndexOf(">") + 1;
    if (cut <= 0) cut = carry.length;
    const piece = cleanHtml(carry.slice(0, cut));
    carry = carry.slice(cut);
    // the stop marks are looked for in the NEW piece only (plus a 64-character seam), never in the whole text again
    const base = textLen, probe = tail + piece, off = base - tail.length;
    parts.push(piece); textLen += piece.length + 1; tail = piece.slice(-64);
    if (eiAt < 0) { const i = probe.search(/Earliest\s+Date\s+Available\s+for\s+Sale/i); if (i >= 0) eiAt = off + i; }
    if (uwAt < 0) { const j = probe.indexOf("UNDERWRITING"); if (j >= 0 && off + j > 60_000) uwAt = off + j; }
    if (uwAt >= 0 && lockAfterUw < 0) { const s = Math.max(0, uwAt - off), k = probe.slice(s).search(/lock-?\s?up/i); if (k >= 0) lockAfterUw = off + s + k; }
    if (bytes > maxBytes) { stoppedEarly = true; break; }
    const ready = (eiAt > 0 && textLen > eiAt + 20_000) || (lockAfterUw > 0 && textLen > lockAfterUw + 10_000);
    if (done || !ready || textLen - checkedAt < 40_000) continue;
    checkedAt = textLen;
    lk = findLockup(text(), todayIso);
    if (lk.days != null || lk.months != null) { stoppedEarly = true; break; }
  }
  try { if (reader.cancel) await reader.cancel(); } catch (_) { /* already closed */ }
  if (!lk || (lk.days == null && lk.months == null)) lk = findLockup(text(), todayIso);
  return { bytes, complete: done && !stoppedEarly, stoppedEarly, lk };
}
