import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')

test('the Hub carries and visibly renders every provider-bar Geiger rung as-of', () => {
  assert.match(source, /function scCandidateGeigerDetail/)
  assert.match(source, /geiger\?symbols=" \+ encodeURIComponent\(t\) \+ "&detail=1/)
  assert.match(source, /await scCandidateGeigerDetail\(t\)/)
  assert.match(source, /index\[t\]\.rungs = v\.rungs \|\| \{\}/)
  assert.match(source, /geigerRungs: c\.rungs \|\| \{\}/)
  assert.match(source, /BAR AS-OF/)
  assert.match(source, /r\.availability === "ABSENT" \? "ABSENT"/)
})

test('the Hub displays FMP date-state and explains unavailable native features', () => {
  assert.match(source, /indicatorSourceDate, indicatorSessionState/)
  assert.match(source, /raw FMP provider" \+ \(indStamp/)
  /* D2 (27 Sep): the RSI / Williams / MACD tiles are gone from the GEIGER tab (the RSI is the chart's own pane; MACD
     was never served). The FMP date-state now rides the moving-average ladder, which is the FMP data left on the tab. */
  assert.match(source, /data-gs="ladsub"/)
  assert.doesNotMatch(source, /data-gs="macd"/)
  assert.doesNotMatch(source, /data-gs="rsitable"/)
  assert.doesNotMatch(source, /Struct · legacy/)
  assert.doesNotMatch(source, /data-gs="f_struc"/)
})

test('pre-provenance local cache envelopes cannot first-paint current values', () => {
  assert.match(source, /sc_geiger3_/)
  assert.match(source, /PROVIDER_CURRENTNESS_V2/)
  assert.doesNotMatch(source, /cacheGet\("sc_geiger2_"/)
})
