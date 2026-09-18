import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

const escSrc = page.match(/const esc = \(s\) => String\(s == null \? "" : s\)\n[\s\S]*?"&#39;"\);/)[0];
const fnSrc = page.match(/function summaryInlineHTML\(s\) \{[\s\S]*?\n\}\nfunction summaryHTML\(text\) \{[\s\S]*?\n\}\n/)[0];
const summaryHTML = new Function(escSrc + "\n" + fnSrc + "return summaryHTML;")();

/* everything summaryHTML may emit besides escaped text: these exact constant tags, no attributes beyond the fixed classes */
const CONSTANT_TAGS = /<div class="sc-sum">|<div class="sc-sum__gap"><\/div>|<div class="sc-sum__li"><span class="g">•<\/span><span class="t">|<div class="sc-sum__p">|<\/span><\/div>|<\/div>|<b>|<\/b>|<i>|<\/i>/g;
const onlyConstantMarkup = (html) => !/[<>]/.test(html.replace(CONSTANT_TAGS, ""));
const textOf = (html) => html.replace(CONSTANT_TAGS, "\n").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

/* the stored shape, verbatim from the surviving FedEx Q4 FY26 call summary (first two bullets) and a KR-style "•" summary */
const STORED_DASH = "- **Q4 results vs. expectations:** Consolidated Q4 revenue +13% YoY; adjusted EPS $6.31, above the high end of the March revised outlook range.\n\n- **Forward guidance/outlook:** Initiating CY2026 adjusted EPS guidance of $16.90–$18.10 (midpoint $17.50).";
const STORED_DOT = "• **EPS beat, revenue in line:** Adjusted EPS $1.09 vs est $1.06; management is *not* changing the full-year range.\n\n• **Risks";

test("the stored light markdown is drawn as formatting: no literal ** or *emphasis* markers, bullets and line breaks kept", () => {
  const a = summaryHTML(STORED_DASH);
  assert.equal((a.match(/<div class="sc-sum__li">/g) || []).length, 2, "two stored bullets, two rows");
  assert.equal((a.match(/<div class="sc-sum__gap">/g) || []).length, 1, "the blank line between them is a gap");
  assert.match(a, /<b>Q4 results vs\. expectations:<\/b> Consolidated Q4 revenue \+13% YoY/);
  assert.doesNotMatch(a, /\*\*/);
  assert.doesNotMatch(textOf(a), /^\s*- /m, "the dash marker is replaced by the drawn bullet");
  const b = summaryHTML(STORED_DOT);
  assert.match(b, /management is <i>not<\/i> changing/);
  assert.match(b, /<span class="t">Risks<\/span>/, "a summary cut off mid-bold by the old output cap loses the stray marker, keeps the word");
  assert.doesNotMatch(b, /\*/);
  assert.equal(textOf(summaryHTML("first line\nsecond line\n\nthird")).split("\n").filter((x) => x.trim()).join("|"), "first line|second line|third", "one block per stored line");
});

test("what looks like markup but is not: negative numbers, footnote asterisks, a whole-line *(note)*, arithmetic", () => {
  assert.match(summaryHTML("-0.04 GAAP loss per ADS"), /<div class="sc-sum__p">-0\.04 GAAP loss per ADS<\/div>/, "a leading minus sign is not a bullet");
  assert.match(summaryHTML("-$1.2B charge"), /sc-sum__p">-\$1\.2B charge/);
  assert.match(summaryHTML("*(headline figures only — call summary to follow)*"), /<div class="sc-sum__p"><i>\(headline figures only — call summary to follow\)<\/i><\/div>/, "stored 27 times: emphasis on a whole line, not a bullet");
  assert.match(summaryHTML("Adjusted EPS* of $2.10 and revenue* flat"), /Adjusted EPS\* of \$2\.10 and revenue\* flat/, "footnote asterisks stay as written");
  assert.match(summaryHTML("margin 3*4*5 bps"), /3\*4\*5/);
  assert.match(summaryHTML("**a *b** c*"), /<b>a \*b<\/b> c\*/, "emphasis never crosses a bold boundary (no mis-nested tags)");
  assert.equal(summaryHTML("•"), '<div class="sc-sum"></div>', "a bare marker draws nothing");
  assert.equal(summaryHTML(null), '<div class="sc-sum"></div>');
  assert.equal(summaryHTML(undefined), '<div class="sc-sum"></div>');
});

test("stored text can never become markup: hostile HTML, handlers, javascript: links and entities come out as visible text", () => {
  const hostile = '• **Results <img src=x onerror="window.__xss=1">:** revenue <script>window.__xss=2</script> up *not* down\n- [click](javascript:window.__xss=3) and <b onmouseover="window.__xss=4">bold tag</b> &amp; "quotes" \'single\'\n\n**<svg/onload=window.__xss=5>** tail ** stray\n<iframe src="javascript:window.__xss=6"></iframe>\n</div></div><style>*{display:none}</style>';
  const h = summaryHTML(hostile);
  assert.ok(onlyConstantMarkup(h), "no < or > survives outside the constant tags");
  assert.doesNotMatch(h, /<(?!\/?(?:div|span|b|i)\b)/i, "no tag other than div/span/b/i");
  assert.doesNotMatch(h, /<(?:div|span|b|i)\b[^>]*\bon\w+\s*=/i, "no event-handler attribute on any emitted tag");
  assert.doesNotMatch(h, /<a\b/i, "a markdown link is not turned into a link");
  assert.match(h, /&lt;img src=x onerror=&quot;window\.__xss=1&quot;&gt;/);
  assert.match(h, /&lt;script&gt;window\.__xss=2&lt;\/script&gt;/);
  assert.match(h, /\[click\]\(javascript:window\.__xss=3\)/, "the link syntax stays plain text");
  assert.match(h, /&amp;amp; &quot;quotes&quot; &#39;single&#39;/, "an entity in stored text is shown as typed, not decoded");
  assert.match(h, /<b>&lt;svg\/onload=window\.__xss=5&gt;<\/b> tail  stray/);
  assert.equal(textOf(h).replace(/\s+/g, " ").trim(), hostile.replace(/\*\*/g, "").replace(/\*not\*/, "not").replace(/^[•-] /gm, "").replace(/\s+/g, " ").trim(), "every stored character is still there as text");
});

test("fuzz: 4,000 generated lines over a hostile alphabet never yield anything but the constant tags, and b/i stay balanced", () => {
  const A = ["<", ">", "&", '"', "'", "*", "**", "-", "•", " ", "\n", "a", "b", "1", "(", ")", "[", "]", "/", "=", "script", "img", "onerror", "\\", "`", "_", "#", "\r\n", "\t", "—", "&lt;", "<b>", "</b>", "<i>", "</div>"];
  let seed = 20260918; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let n = 0; n < 4000; n++) {
    let s = ""; const len = 1 + Math.floor(rnd() * 24); for (let k = 0; k < len; k++) s += A[Math.floor(rnd() * A.length)];
    const h = summaryHTML(s);
    assert.ok(onlyConstantMarkup(h), JSON.stringify(s) + " -> " + h);
    assert.equal((h.match(/<b>/g) || []).length, (h.match(/<\/b>/g) || []).length, "balanced <b> for " + JSON.stringify(s));
    assert.equal((h.match(/<i>/g) || []).length, (h.match(/<\/i>/g) || []).length, "balanced <i> for " + JSON.stringify(s));
    assert.doesNotMatch(h, /\*\*/, "no literal ** for " + JSON.stringify(s));
  }
});

test("both summary displays use the formatter, nothing prints a stored summary raw, and the script stays parseable on older Safari", () => {
  assert.match(page, /if \(r\.release_summary\) h \+= '<div style="margin-bottom:14px">' \+ summaryHTML\(r\.release_summary\) \+ '<\/div>';/, "event summary panel");
  assert.match(page, /const bodyHTML = sum \? summaryHTML\(sum\)/, "earnings-call bubble");
  assert.doesNotMatch(page, /esc\(r\.release_summary\)|\? esc\(sum\)|esc\([a-z.]*ai_summary\)/, "no raw print of a stored summary is left");
  assert.doesNotMatch(fnSrc, /\(\?<[=!]/, "no regex lookbehind: one would stop the whole page script on Safari before 16.4");
  assert.doesNotMatch(fnSrc, /innerHTML|document\.|createElement/, "the formatter is a pure string function");
  assert.match(page, /\.sc-sum\{ overflow-wrap:anywhere; \}/, "long tokens wrap instead of overflowing the panel");
});

test("the open call summary scrolls inside its own bounded box instead of being cut off below the panel", () => {
  assert.match(page, /\.sc-trbubble__body\{[^}]*max-height:min\(30vh,240px\); overflow-y:auto;[^}]*\}/);
  assert.match(page, /\.sc-evtab\.tr-open \.sc-evfix\{ flex:0 1 auto; min-height:0; overflow-y:auto; \}/, "a tall header may scroll while the summary is open");
  assert.match(page, /\.sc-evtab\.tr-open \.sc-evpastscroll\{ flex:1 1 0; min-height:88px; \}/, "PAST EARNINGS keeps a visible strip");
  assert.match(page, /const tab = bub\.closest\("\.sc-evtab"\); if \(tab\) tab\.classList\.toggle\("tr-open", bub\.style\.display === "block"\);/);
  assert.match(page, /\.sc-evfix\{ flex:0 0 auto; \}/, "with the summary closed the header block is exactly as before");
  assert.match(page, /\.sc-trbubble__hd a, \.sc-trbubble__full\{/, "the read-full-transcript control is styled like the link it replaced");
});

test("Esc closes the summary panel first and leaves what is under it alone; the panel is announced as a dialog", () => {
  assert.match(page, /if \(e\.key !== "Escape"\) return;\n  const fh = el\("trFullHost"\), sh = el\("ernSumHost"\);\n  if \(fh && fh\.firstChild\) \{ fh\.innerHTML = ""; return; \}[^\n]*\n  if \(sh && sh\.firstChild\) \{ sh\.innerHTML = ""; return; \}/);
  assert.match(page, /closeTvModal\(\); clearSecFs\(\);/, "the earlier Esc behaviour is kept");
  assert.match(page, /<div role="dialog" aria-modal="true" aria-label="' \+ esc\(tk\) \+ ' summary"/);
});
