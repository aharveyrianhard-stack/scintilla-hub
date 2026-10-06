// Q5 (5 Oct 2026) — the outside critique flagged 28 places in the Hub repo that build HTML by joining strings. All 28 were
// read. In 23 of them every value that comes from data was already escaped; in the layout prototype (d1-hub.js / d1-live.js)
// two were not — a timeframe label and a fiscal date went into the page as they arrived. Those are escaped now; this file
// feeds hostile text through the real code and requires that none of it reaches the page as markup.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const read = rel => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const live = read('deliverables/20260926/hub-layout-tape/d1-live.js');
const hub = read('deliverables/20260926/hub-layout-tape/d1-hub.js');
const HOSTILE = '"><img src=x onerror=alert(1)>';

function loadD1() {
  const window = {};
  const box = { window, location: { search: '', hostname: 'localhost', origin: 'http://localhost', href: 'http://localhost/' }, document: {}, localStorage: { getItem: () => null, setItem: () => {} },
    fetch: async () => { throw new Error('offline'); }, console, Date, Math, Intl, URLSearchParams, setTimeout, clearTimeout, isFinite, JSON };
  box.self = window; box.globalThis = box;
  vm.runInNewContext(live, box);
  return window.D1;
}

test('the prototype\'s helpers: a hostile timeframe label cannot leave its attribute', () => {
  const D = loadD1();
  assert.equal(typeof D.rungCells, 'function');
  const html = D.rungCells([{ lbl: HOSTILE, tfc: 0.4 }, { lbl: '1d', tfc: -0.2 }]);
  assert.doesNotMatch(html, /<img/);
  assert.equal((html.match(/"/g) || []).length % 2, 0, 'no stray quote opened or closed an attribute');
  assert.match(html, /title="&quot;&gt;&lt;img src=x onerror=alert\(1\)&gt; \+0\.40 · 1d −0\.20"/);
  assert.equal((html.match(/<i style=/g) || []).length, 2, 'the two cells are still drawn');
});

test('the prototype\'s number formatters only ever return a number or a dash', () => {
  const D = loadD1();
  for (const f of ['pct', 'signed', 'price', 'cap']) {
    assert.equal(D[f](HOSTILE), '—', f);
    assert.doesNotMatch(String(D[f]('12.5')), /[<>"]/, f);
  }
  assert.equal(D.dirCls(HOSTILE), 'flat');
  assert.equal(D.esc(HOSTILE), '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
});

test('the prototype page: every field that comes from data goes through esc() before it is joined into HTML', () => {
  assert.ok(hub.includes("d.rungs.map((r) => '<b>' + esc(r.lbl) + '</b>"), 'the timeframe label is escaped');
  assert.ok(hub.includes('"<span>" + esc(String(x.fiscal_date).slice(2, 7)) + "<br>"'), 'the fiscal date is escaped');
  // a data field (row, item, quote, profile, fundamentals … .name) joined straight between two string pieces, with no esc( and no
  // number formatter around it, is the shape of the two gaps that were found
  const raw = [...hub.matchAll(/['"] \+ ((?:r|x|i|q|pf|f|d|hb|s)\.[A-Za-z_]+(?:\.[A-Za-z_]+)*) \+ ['"]/g)].map(m => m[1])
    .filter(name => !/\.(length|n)$/.test(name));
  assert.deepEqual(raw.filter(name => !['hb.date'].includes(name)), [], 'hb.date goes to textContent, never to HTML');
  assert.ok(hub.includes('s.textContent = "stats · ticker_heartbeat_daily " + hb.date'));
  for (const bare of ['" " + S.tf + " candles', '" on " + S.tf + "</div>', '" " + S.tf + \' chart">\'', '\'<div class="d1-note">\' + S.l0 + "']) assert.ok(!hub.includes(bare), bare);
});

test('the two company-view harnesses name the page\'s openCo explicitly and answer by name when it is missing', () => {
  for (const rel of ['deliverables/20260927/company-view-r2/tools/harness.mjs', 'deliverables/20260927/company-view-r3/tools/harness.mjs']) {
    const src = read(rel);
    assert.doesNotMatch(src, /[^.]\bopenCo\(t\)/, rel + ': no bare reference');
    assert.match(src, /if \(typeof globalThis\.openCo !== "function"\) return "NO_OPENCO_ON_PAGE";\n\s+globalThis\.openCo\(t\); return "openCo";/);
  }
  assert.match(read('index.html'), /^function openCo\(t\) \{/m, 'the page still defines it as a global function');
});

test('the live page: the USUAL DAY list writes the names from its data file through esc()', () => {
  const page = read('index.html');
  assert.ok(page.includes(`data-hu-pick="'+esc(s.t)+'">'+esc(s.name)+"<b>"`));
  assert.ok(page.includes(`'<h2 class="hu__head">'+esc(sym.name)+" · "+esc(sym.t)+"</h2>"`));
  // the page's own esc, run on the name the file really carries and on a hostile one
  const esc = vm.runInNewContext('(' + page.match(/^const esc = (\(s\) => String\(s == null \? "" : s\)[\s\S]*?);\n/m)[1] + ')');
  assert.equal(esc('S&P 500 fund'), 'S&amp;P 500 fund', 'shown exactly as before: the browser prints &amp; as &');
  assert.doesNotMatch(esc(HOSTILE), /[<>"]/);
});
