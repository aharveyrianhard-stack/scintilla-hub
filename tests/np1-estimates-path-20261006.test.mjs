// NP1 (6 Oct 2026) — the page "names comps cannot price" and the data it is built from.
// The page is a static report under deliverables/: it fetches nothing, so everything it says can be checked against the files beside it.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "deliverables", "20261006", "np1-estimates-path")
const page = readFileSync(join(root, "NP1-ESTIMATES-PATH.html"), "utf8")
const own = page.slice(0, page.indexOf("<!-- scnav · ") > 0 ? page.indexOf("<!-- scnav · ") : page.length)   // the BACK / CLOSE block has its own tests
const json = (...p) => JSON.parse(readFileSync(join(root, "data", ...p), "utf8"))
const path = json("path.json")
const cbrs = path.path.find((p) => p.ticker === "CBRS")
const text = own.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/\s+/g, " ")

test("NP1 page: the way back, the page specs, and nothing loaded from outside", () => {
  assert.ok(page.includes("<!-- scnav · "), "the BACK / CLOSE pair is placed")
  assert.ok((page.match(/data-scnav-slot/g) || []).length >= 2)
  assert.ok(own.includes('<details class="sc-pagespecs"><summary>PAGE SPECS</summary>'))
  assert.ok(own.indexOf('<details class="sc-pagespecs">') > own.indexOf("CALLS FOR ALAN"), "page specs sit at the bottom")
  assert.ok(!/<script[^>]+src=|<link[^>]+href=|<img[^>]+src=|\bfetch\(|XMLHttpRequest/.test(own), "self-contained: no outside script, sheet, picture or request")
})

test("NP1 page: grey everywhere, the two house hues for direction only, no text under 11px", () => {
  const css = own.slice(own.indexOf("<style>"), own.indexOf("</style>"))
  const hexes = [...own.matchAll(/#([0-9a-fA-F]{6})\b/g)].map((m) => m[1].toUpperCase())
  assert.ok(hexes.length > 8)
  for (const h of hexes) {
    if (h === "00FFA3" || h === "FF2D55") continue                      // up and down, Alan's rule
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24 && Math.max(r, g, b) <= 210, "#" + h + " is not a house grey")
  }
  assert.ok(!/rgba?\(|hsla?\(/.test(own), "colours are written as hex so the rule above sees all of them")
  for (const [, px] of own.matchAll(/font(?:-size)?:\s*(\d+)px/g)) assert.ok(+px >= 11, px + "px text")
  assert.match(css, /--up:#00FFA3/); assert.match(css, /--dn:#FF2D55/)
})

test("NP1 page: Alan's wording rules — brackets for a negative, no plus sign, no 'neutral', no instructions inside the panels", () => {
  assert.ok(!/(^|[\s>(])\+\d/.test(text), "no +12% style numbers")
  assert.ok(!/\bneutral\b/i.test(text))
  assert.ok(text.includes("(0.52)"), "a negative EPS is written in brackets")
  const beforeSpecs = text.slice(0, text.indexOf("PAGE SPECS"))
  assert.ok(!/\b(click|tap|hover|scroll) (on|to|the)\b/i.test(beforeSpecs), "no how-to sentences above the page specs")
})

test("NP1 data: the list is what the rules say", () => {
  assert.equal(path.schema, "scintilla.estimates_path.v1"); assert.equal(path.as_of, "2026-10-06")
  assert.equal(path.path.length, path.universe.on_path)
  assert.equal(path.path.length + path.off_path.length, path.universe.companies)
  assert.ok(path.path.every((p) => p.reasons.length > 0 && p.rung))
  for (const [code, n] of Object.entries(path.reasons)) assert.equal(path.path.filter((p) => p.reasons.includes(code)).length, n, code)
  assert.equal(Object.values(path.rungs).reduce((a, b) => a + b, 0), path.universe.on_path)
  // the cut is Tukey's upper fence over the universe's own forward P/Es
  const c = path.cuts.fwd_pe
  assert.ok(Math.abs(c.upper - (c.q3 + 1.5 * (c.q3 - c.q1))) < 1e-9)
  assert.ok(path.path.filter((p) => p.reasons.includes("FORWARD_PE_ABOVE_CUT")).every((p) => p.mult.fwd_pe > c.upper))
  assert.ok(path.path.filter((p) => p.reasons.includes("NEW_LISTING")).every((p) => p.listed.months < 24))
  assert.ok(path.other_currency.every((o) => { const p = path.path.find((x) => x.ticker === o.ticker); return !p || (p.mult.fwd_pe === null && p.mult.fwd_ev_sales === null) }))
})

test("NP1 data: CBRS, the worked example, end to end", () => {
  assert.deepEqual(cbrs.reasons, ["NEW_LISTING", "IPO_18M", "NO_TRAILING_EARNINGS", "FORWARD_PE_ABOVE_CUT"])
  assert.equal(cbrs.rung, "ESTIMATES_AND_PROSPECTUS"); assert.equal(cbrs.estimates_weak, false)
  assert.equal(cbrs.price.d, "2026-10-06")
  assert.ok(Math.abs(cbrs.mcap - cbrs.price.v * cbrs.shares) < 1); assert.ok(Math.abs(cbrs.ev - (cbrs.mcap + cbrs.net_debt)) < 1)
  assert.ok(Math.abs(cbrs.mult.fwd_ev_sales - cbrs.ev / cbrs.ntm.rev) < 1e-9); assert.equal(cbrs.ntm.basis, "four quarters")
  assert.equal(cbrs.mult.peg, null); assert.equal(cbrs.trailing.pe, null)
  const f = json("filings", "CBRS.filings.json")
  assert.equal(f.picked.prospectus.form, "424B4"); assert.equal(f.picked.quarterly.form, "10-Q")
  assert.ok(f.picked.prospectus.url.startsWith("https://www.sec.gov/Archives/edgar/data/2021728/"))
  const cover = f.facts.quarterly.cover_shares
  assert.equal(cover.total, cover.classes.reduce((a, c) => a + c.shares, 0)); assert.equal(cover.classes.length, 3)
  assert.ok(cover.quote.includes(cover.classes[0].shares.toLocaleString("en-US")), "the count is in the sentence it was read from")
  assert.ok(Math.abs(f.facts.quarterly.revenue_mix.lines.reduce((a, l) => a + l.share, 0) - 1) < 1e-9)
  const cash = f.facts.cash
  assert.equal(cash.liquid, cash.cash + cash.securities); assert.equal(cash.free_cash_flow_quarter, cash.operating_cash_flow_quarter - cash.capex_quarter)
  assert.ok(Math.abs(cash.quarters_of_cash - cash.liquid / -cash.free_cash_flow_quarter) < 1e-9)
  // the lock-up date on the page is the one unlock-watch already holds, and the prospectus sentence agrees with it
  const lock = json("ipo_lockups.json").find((r) => r.ticker === "CBRS")
  assert.equal(lock.unlock_date, "2026-11-09"); assert.ok(f.facts.prospectus.lockup.some((s) => s.includes("180 days after the date of this prospectus")))
})

test("NP1 page: the numbers printed are the numbers in the files", () => {
  const f = json("filings", "CBRS.filings.json")
  const has = (s) => assert.ok(text.includes(s), "page shows " + s)
  has(`${path.universe.on_path} of ${path.universe.companies} companies`)
  has(`THE LIST · ${path.universe.on_path} NAMES`)
  has(`$${cbrs.target.median.toFixed(0)}`); has(`${cbrs.price.v.toFixed(2)}`)
  has(`${(f.facts.quarterly.cover_shares.total / 1e6).toFixed(1)}M`); has(`${(cbrs.shares / 1e6).toFixed(1)}M`); has(`${(cbrs.shares_profile / 1e6).toFixed(1)}M`)
  has(`${cbrs.mult.fwd_ev_sales.toFixed(1)}×`); has(`${path.ai.medians.fwd_ev_sales.median.toFixed(1)}×`)
  has(`${f.facts.cash.quarters_of_cash.toFixed(1)}`); has(`${Math.round(path.cuts.fwd_pe.upper)}×`)
  const rows = [...own.matchAll(/<tr data-r="([^"]*)"/g)].map((m) => m[1])
  assert.equal(rows.length, path.universe.on_path, "one row per name on the path")
  for (const [code, n] of Object.entries(path.reasons)) assert.equal(rows.filter((r) => (" " + r + " ").includes(" " + code + " ")).length, n, "rows carrying " + code)
  assert.equal(rows.filter((r) => r.includes("WEAK")).length, path.rungs.MODELS_AND_QUARTERLIES)
  for (const [code, n] of Object.entries(path.reasons)) assert.match(own, new RegExp(`data-k="${code}"[^>]*>[^<]*<b>${n}</b>`), "chip count for " + code)
})

test("NP1 models: open models only, every section read by both levels, timings kept, passages kept for audit", () => {
  const dir = join(root, "data", "models")
  const done = readdirSync(dir).filter((f) => f.endsWith(".models.json"))
  assert.ok(done.includes("CBRS.models.json")); assert.ok(done.length >= 5, "the new listings were read")
  for (const file of done) {
    const m = json("models", file)
    assert.match(m.models.long_text, /Qwen2\.5-7B-Instruct.*llama\.cpp/); assert.equal(m.models.short_text, "ProsusAI/finbert")
    assert.ok(m.took.total_s > 0 && m.took.qwen_passages > 0 && m.took.finbert_sentences > 0, file)
    for (const s of m.sections) {
      assert.equal(s.finbert.pos + s.finbert.neg + s.finbert.neu, s.finbert.n, file + " " + s.section)
      assert.equal(s.qwen.positive + s.qwen.negative + s.qwen.mixed + s.qwen.factual, s.qwen.read, file + " " + s.section)
      assert.ok(s.qwen.read >= 0.9 * s.qwen.passages, "nearly every passage came back as valid JSON")
    }
    const audit = join(dir, file.replace(".models.json", ".passages.ndjson"))
    assert.ok(existsSync(audit)); assert.equal(readFileSync(audit, "utf8").trim().split("\n").length, m.took.qwen_passages, file + ": one audit line per passage")
  }
  const all = readdirSync(dir).map((f) => readFileSync(join(dir, f), "utf8")).join("\n")
  assert.ok(!/gpt-|claude|anthropic|openai\.com|api\.openai|gemini/i.test(all.replace(/OpenAI/g, "")), "no paid model named as a reader")   // "OpenAI" is Cerebras's customer
})

test("NP1 folder: no key, and the keyed pull's proof holds only counts and public links", () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]))
  for (const f of walk(root).filter((f) => /\.(json|ndjson|html|py|mjs)$/.test(f))) {
    const s = readFileSync(f, "utf8")
    assert.ok(!/apikey=[A-Za-z0-9]{6,}|eyJ[A-Za-z0-9_-]{30,}|sk-[A-Za-z0-9]{20,}/.test(s), "no key-shaped string in " + f.slice(root.length))
  }
  const leg = json("fmp-leg-proof.json")
  assert.ok(leg.names.every((n) => n.errors.length === 0 && n.estimate_rows > 0 && n.transcript === undefined && n.headlines === undefined))
  assert.ok(leg.names.flatMap((n) => n.filings_kept).every((f) => f.url.startsWith("https://www.sec.gov/")))
})
