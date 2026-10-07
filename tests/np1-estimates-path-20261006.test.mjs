// NP1 (6 Oct 2026, re-run and finished 7 Oct) — the page "names comps cannot price" and the data it is built from.
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
  assert.deepEqual(cbrs.reasons, ["NEW_LISTING", "IPO_18M", "NO_TRAILING_EARNINGS", "PROFIT_NOT_FROM_OPERATIONS", "FORWARD_PE_ABOVE_CUT"])
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
  // every new listing and every name whose estimates are too thin was read: the two groups Alan's ladder sends past the estimates
  const carried = path.path.filter((p) => p.reasons.includes("NEW_LISTING") || p.rung === "MODELS_AND_QUARTERLIES").map((p) => p.ticker)
  assert.deepEqual(done.map((f) => f.split(".")[0]).sort(), [...carried].sort(), "one model file per carried name, no other")
  for (const t of carried) assert.ok(existsSync(join(root, "data", "filings", t + ".filings.json")), t + " has its filings read")
  for (const file of done) {
    const m = json("models", file)
    assert.match(m.models.long_text, /Qwen2\.5-7B-Instruct.*llama\.cpp/); assert.equal(m.models.short_text, "ProsusAI/finbert")
    assert.ok(m.took.total_s > 0 && m.took.qwen_passages > 0 && m.took.finbert_sentences > 0, file)
    assert.ok(m.sections.length >= 1, file + " has at least one section read")
    assert.equal(m.models.gguf, "qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf")
    assert.ok(!/gpt|claude|anthropic|openai|gemini|grok/i.test(JSON.stringify(m.models)), "no paid model named as a reader in " + file)
    // a call is read only when it is the latest one: a stale call is named and left out
    const callSections = m.sections.filter((s) => s.section.startsWith("Earnings call"))
    if (m.call && m.call.read) { assert.ok(callSections.length >= 1 && m.call.age_days <= 200, file) } else assert.equal(callSections.length, 0, file + " has no call section")
    for (const s of m.sections) {
      assert.equal(s.finbert.pos + s.finbert.neg + s.finbert.neu, s.finbert.n, file + " " + s.section)
      assert.equal(s.qwen.positive + s.qwen.negative + s.qwen.mixed + s.qwen.factual, s.qwen.read, file + " " + s.section)
      assert.ok(s.qwen.read >= 0.9 * s.qwen.passages, "nearly every passage came back as valid JSON")
    }
    const audit = join(dir, file.replace(".models.json", ".passages.ndjson"))
    assert.ok(existsSync(audit)); assert.equal(readFileSync(audit, "utf8").trim().split("\n").length, m.took.qwen_passages, file + ": one audit line per passage")
  }
  const lac = json("models", "LAC.models.json")
  assert.equal(lac.call.read, false); assert.ok(lac.call.age_days > 200, "Lithium Americas' newest call on FMP is May 2024: named, not read")
})

test("NP1 data: the price is one settled day, and the operations test finds what the others miss", () => {
  const otherDay = path.path.filter((p) => p.price.d !== path.as_of).map((p) => p.ticker)
  assert.ok(otherDay.length <= 2, "nearly every name carries the 6 Oct close: " + otherDay.join(" "))
  for (const t of otherDay) assert.ok(text.includes(t), "a name priced a day earlier is named in the page specs")
  const flagged = path.path.filter((p) => p.reasons.includes("PROFIT_NOT_FROM_OPERATIONS"))
  assert.equal(flagged.length, path.reasons.PROFIT_NOT_FROM_OPERATIONS)
  for (const p of flagged) assert.ok(p.trailing.not_from_operations.length > 0 && p.trailing.not_from_operations.every((x) => x.ni > 0 && x.oi < 0), p.ticker)
  const lyft = path.path.find((p) => p.ticker === "LYFT")
  assert.deepEqual(lyft.reasons, ["PROFIT_NOT_FROM_OPERATIONS"]); assert.ok(lyft.trailing.pe < 5, "a trailing P/E that looks cheap and is not")
  assert.deepEqual(cbrs.trailing.not_from_operations.map((x) => x.period), ["FY2025"])
})

test("NP1 worked example: the company's guidance against the analysts, the reads and the line-by-line check", () => {
  const call = json("calls", "CBRS.call.json")
  assert.equal(call.source, "FMP earning-call-transcript"); assert.equal(call.call_date, "2026-08-12")
  const vs = call.against_consensus
  assert.deepEqual(vs.map((x) => x.period).sort(), ["FY 2026", "Q3 2026"])
  for (const x of vs) { assert.ok(x.low <= x.value && x.value <= x.high); assert.equal(x.consensus_is, "inside the range"); assert.equal(x.guided_as, "core revenue") }
  assert.equal(vs.find((x) => x.period === "FY 2026").value, cbrs.fy.find((f) => f.fy === "2026-12-31").rev, "the analysts' figure is the one on the estimates table")
  assert.ok(text.includes("inside the range")); assert.ok(text.includes("$880M – $890M")); assert.ok(text.includes("$214M – $216M"))
  // the reads: every quote was found word for word in the document it names when the data was assembled
  const reads = json("CBRS.read.json").reads
  assert.ok(reads.length >= 6)
  for (const r of reads) { assert.ok(text.includes(r.topic.toUpperCase()), r.topic); for (const q of r.quotes) assert.equal(q.found_in_source, true, q.text.slice(0, 60)) }
  assert.ok(!text.includes("NOT FOUND IN THE TEXT"))
  // the check covers every line the model wrote for the example, and the page strikes exactly the ones the text does not support
  const m = json("models", "CBRS.models.json")
  const lines = m.sections.flatMap((s) => [...s.growth_drivers, ...s.risks])
  const checks = json("CBRS.checks.json").claims
  assert.deepEqual(checks.map((c) => c.claim).sort(), [...lines].sort(), "one check per line, for this run's lines")
  assert.ok(checks.every((c) => c.checked_against && c.evidence_found_word_for_word !== false))
  const bad = checks.filter((c) => !c.supported)
  assert.equal((own.match(/not in the text<\/em>/g) || []).length, bad.length); assert.ok(bad.length >= 1 && bad.length <= 4)
  assert.ok(text.includes(`${checks.length - bad.length} of ${checks.length} are supported by the text`))
})

test("NP1 page: the thin-estimate names are carried to the last rung, each with what was read", () => {
  const thin = path.path.filter((p) => p.rung === "MODELS_AND_QUARTERLIES")
  assert.ok(text.includes(`THE ${thin.length} WITH ESTIMATES TOO THIN`))
  const section = own.slice(own.indexOf("WITH ESTIMATES TOO THIN"), own.indexOf("PROPOSED TABLES"))
  for (const p of thin) assert.ok(section.includes(`<td class="tk">${p.ticker}</td>`), p.ticker + " has a row")
  assert.ok(thin.every((p) => p.estimates_weak))
  const q = json("quarters.json")
  for (const p of thin) assert.ok(Array.isArray(q[p.ticker]) && q[p.ticker].length >= 4, p.ticker + " has its quarterly reports")
  assert.ok(section.includes("too old, not read"), "the stale call is said, not hidden")
  assert.ok(section.includes("none held"), "a company with no call on FMP says so")
})

test("NP1 folder: no key, and the keyed pull's proof holds only counts and public links", () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]))
  for (const f of walk(root).filter((f) => /\.(json|ndjson|html|py|mjs)$/.test(f))) {
    const s = readFileSync(f, "utf8")
    assert.ok(!/apikey=[A-Za-z0-9]{6,}|eyJ[A-Za-z0-9_-]{30,}|sk-[A-Za-z0-9]{20,}/.test(s), "no key-shaped string in " + f.slice(root.length))
  }
  const leg = json("fmp-leg-proof.json")
  assert.ok(leg.names.every((n) => n.errors.length === 0 && n.estimate_rows > 0 && n.transcript === undefined && n.headlines === undefined))
  assert.equal(leg.names.length, 19)
  // the documents the reader picked from EDGAR's own index are in FMP's list too, except where FMP's 1,000-row page no longer reaches them
  const missing = leg.names.flatMap((n) => Object.entries(n.picked_in_fmp_list).filter(([, ok]) => !ok).map(([doc]) => n.ticker + " " + doc))
  assert.ok(missing.length <= 3, "picked documents missing from FMP's list: " + missing.join(", "))
  assert.ok(leg.names.flatMap((n) => n.filings_kept).every((f) => f.url.startsWith("https://www.sec.gov/")))
})
