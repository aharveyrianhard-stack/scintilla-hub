/*
 * SCINTILLA Hub Geiger authority contract.
 *
 * This file is deliberately dependency-free and works in both the browser and Node's test
 * runner.  It validates what the Hub is allowed to accept; it does not fetch, publish, or mutate
 * any operator state.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SCGeigerAuthority = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const GLOBAL_OWNER_ID = "00000000-0000-0000-0000-000000000000";
  const TIMEFRAME_TOKENS = Object.freeze({
    "1m": "1m", "3m": "3m", "5m": "5m", "10m": "10m", "15m": "15",
    "30m": "30", "1h": "60", "2h": "120", "3h": "180", "4h": "240",
    "6h": "6h", "12h": "12h", "1d": "D", "3d": "3D", "1w": "W",
    "2w": "2W", "1M": "M"
  });
  const TIMEFRAME_KEYS = Object.freeze(Object.keys(TIMEFRAME_TOKENS));
  const EXPECTED_KEYS = Object.freeze({
    fam_handle: Object.freeze(["0", "1"]),
    family: Object.freeze(["MOMENTUM", "TREND"]),
    momentum: Object.freeze(["RSI", "WILLIAMS"]),
    momentum_mix: Object.freeze(["rsi", "williams"]),
    tf_handle: Object.freeze(Array.from({ length: 17 }, function (_, i) { return String(i); })),
    timeframe: TIMEFRAME_KEYS
  });
  const EXPECTED_ROW_COUNT = Object.values(EXPECTED_KEYS)
    .reduce(function (sum, keys) { return sum + keys.length; }, 0);
  const ROW_FIELDS = Object.freeze(["dim", "enabled", "key", "owner_id", "weight"]);
  const ACTIVE_DIMENSIONS = new Set(["family", "momentum_mix"]);

  function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function sameArray(a, b) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length &&
      a.every(function (value, index) { return value === b[index]; });
  }
  function stableJson(value) {
    if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
    if (value && typeof value === "object") {
      return "{" + Object.keys(value).sort(cmp).map(function (key) {
        return JSON.stringify(key) + ":" + stableJson(value[key]);
      }).join(",") + "}";
    }
    return JSON.stringify(value);
  }
  async function sha256Hex(value) {
    if (!(root && root.crypto && root.crypto.subtle)) throw new Error("EQUALIZER_DIGEST_UNAVAILABLE");
    const bytes = new TextEncoder().encode(value);
    const digest = await root.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map(function (b) {
      return b.toString(16).padStart(2, "0");
    }).join("");
  }
  function validateWeight(row) {
    if (typeof row.weight !== "number" || !Number.isFinite(row.weight) ||
        row.weight < 0 || Object.is(row.weight, -0)) {
      throw new Error("EQUALIZER_WEIGHT_INVALID:" + row.dim + ":" + row.key);
    }
    const scaled = row.weight * 1000000;
    if (!Number.isSafeInteger(Math.round(scaled)) || Math.abs(scaled - Math.round(scaled)) > 1e-6) {
      throw new Error("EQUALIZER_WEIGHT_PRECISION_INVALID:" + row.dim + ":" + row.key);
    }
  }

  async function deriveOperatorEqualizer(inputRows) {
    if (!Array.isArray(inputRows)) throw new Error("EQUALIZER_ROWS_NOT_ARRAY");
    if (inputRows.length !== EXPECTED_ROW_COUNT) {
      throw new Error("EQUALIZER_ROW_COUNT_INVALID:found=" + inputRows.length +
        ";expected=" + EXPECTED_ROW_COUNT);
    }
    const expectedDims = Object.keys(EXPECTED_KEYS).sort(cmp);
    const seen = new Set();
    const rows = inputRows.map(function (input, index) {
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error("EQUALIZER_ROW_NOT_OBJECT:" + index);
      }
      if (!sameArray(Object.keys(input).sort(cmp), ROW_FIELDS)) {
        throw new Error("EQUALIZER_ROW_FIELDS_INVALID:" + index);
      }
      if (typeof input.dim !== "string" || typeof input.key !== "string" ||
          input.owner_id !== GLOBAL_OWNER_ID) {
        throw new Error("EQUALIZER_ROW_IDENTITY_INVALID:" + index);
      }
      if (typeof input.enabled !== "boolean") {
        throw new Error("EQUALIZER_ENABLED_INVALID:" + input.dim + ":" + input.key);
      }
      validateWeight(input);
      const identity = input.dim + "\u0000" + input.key;
      if (seen.has(identity)) throw new Error("EQUALIZER_ROW_DUPLICATE:" + input.dim + ":" + input.key);
      seen.add(identity);
      return { dim: input.dim, key: input.key, weight: input.weight,
        enabled: input.enabled, owner_id: input.owner_id };
    });
    const actualDims = Array.from(new Set(rows.map(function (row) { return row.dim; }))).sort(cmp);
    if (!sameArray(actualDims, expectedDims)) throw new Error("EQUALIZER_DIMENSIONS_INVALID");
    expectedDims.forEach(function (dim) {
      const actual = rows.filter(function (row) { return row.dim === dim; })
        .map(function (row) { return row.key; }).sort(cmp);
      const expected = Array.from(EXPECTED_KEYS[dim]).sort(cmp);
      if (!sameArray(actual, expected)) throw new Error("EQUALIZER_KEYS_INVALID:" + dim);
    });
    rows.filter(function (row) { return ACTIVE_DIMENSIONS.has(row.dim); }).forEach(function (row) {
      if (!row.enabled) throw new Error("EQUALIZER_ACTIVE_DIMENSION_DISABLED:" + row.dim + ":" + row.key);
    });
    function rowsFor(dim) {
      return Object.fromEntries(rows.filter(function (row) { return row.dim === dim; })
        .map(function (row) { return [row.key, row]; }));
    }
    const family = rowsFor("family");
    const momentumMix = rowsFor("momentum_mix");
    const timeframes = rowsFor("timeframe");
    if (!(Object.values(family).reduce(function (sum, row) { return sum + row.weight; }, 0) > 0)) {
      throw new Error("EQUALIZER_FAMILY_WEIGHT_SUM_ZERO");
    }
    if (!(Object.values(momentumMix).reduce(function (sum, row) { return sum + row.weight; }, 0) > 0)) {
      throw new Error("EQUALIZER_MOMENTUM_MIX_SUM_ZERO");
    }
    const participatingRungs = TIMEFRAME_KEYS.filter(function (key) {
      return timeframes[key].enabled && timeframes[key].weight > 0;
    }).map(function (key) {
      return { equalizer_key: key, tf_token: TIMEFRAME_TOKENS[key], weight: timeframes[key].weight };
    }).sort(function (a, b) { return cmp(a.equalizer_key, b.equalizer_key); });
    if (!participatingRungs.length) throw new Error("TIMEFRAME_PROFILE_HAS_NO_ENABLED_POSITIVE_WEIGHT");
    const excludedZeroWeight = TIMEFRAME_KEYS.filter(function (key) {
      return timeframes[key].enabled && timeframes[key].weight === 0;
    }).sort(cmp);
    const excludedDisabled = TIMEFRAME_KEYS.filter(function (key) {
      return !timeframes[key].enabled;
    }).sort(cmp);
    const canonicalRows = rows.sort(function (a, b) { return cmp(a.dim, b.dim) || cmp(a.key, b.key); });
    const canonical = stableJson(canonicalRows);
    return {
      receipt: await sha256Hex(canonical),
      canonical: canonical,
      rows: canonicalRows,
      timeframe_keys: Array.from(TIMEFRAME_KEYS),
      participating_rungs: participatingRungs,
      excluded_zero_weight: excludedZeroWeight,
      excluded_disabled: excludedDisabled
    };
  }

  function normalizedRungs(value, label) {
    if (!Array.isArray(value)) throw new Error("GEIGER_" + label + "_MISMATCH");
    const seen = new Set();
    const rows = value.map(function (rung) {
      if (!rung || typeof rung !== "object" || Array.isArray(rung) ||
          !sameArray(Object.keys(rung).sort(cmp), ["equalizer_key", "tf_token", "weight"]) ||
          typeof rung.equalizer_key !== "string" || typeof rung.tf_token !== "string" ||
          typeof rung.weight !== "number" || !Number.isFinite(rung.weight) || rung.weight <= 0 ||
          seen.has(rung.equalizer_key)) {
        throw new Error("GEIGER_" + label + "_MISMATCH");
      }
      seen.add(rung.equalizer_key);
      return { equalizer_key: rung.equalizer_key, tf_token: rung.tf_token, weight: rung.weight };
    });
    return rows.sort(function (a, b) { return cmp(a.equalizer_key, b.equalizer_key); });
  }
  function normalizedStringSet(value, label) {
    if (!Array.isArray(value) || value.some(function (entry) { return typeof entry !== "string"; }) ||
        new Set(value).size !== value.length) {
      throw new Error("GEIGER_" + label + "_MISMATCH");
    }
    return Array.from(value).sort(cmp);
  }
  function validateArtifactProfile(artifact, equalizer) {
    if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
      throw new Error("GEIGER_ARTIFACT_NOT_OBJECT");
    }
    if (!equalizer || artifact.equalizer_receipt_sha256 !== equalizer.receipt) {
      throw new Error("GEIGER_EQUALIZER_DIGEST_MISMATCH");
    }
    if (stableJson(normalizedRungs(artifact.participating_rungs, "PARTICIPATING_RUNGS")) !==
        stableJson(normalizedRungs(equalizer.participating_rungs, "PARTICIPATING_RUNGS"))) {
      throw new Error("GEIGER_PARTICIPATING_RUNGS_MISMATCH");
    }
    if (!sameArray(normalizedStringSet(artifact.excluded_zero_weight, "EXCLUDED_ZERO_WEIGHT"),
        normalizedStringSet(equalizer.excluded_zero_weight, "EXCLUDED_ZERO_WEIGHT"))) {
      throw new Error("GEIGER_EXCLUDED_ZERO_WEIGHT_MISMATCH");
    }
    if (!sameArray(normalizedStringSet(artifact.excluded_disabled, "EXCLUDED_DISABLED"),
        normalizedStringSet(equalizer.excluded_disabled, "EXCLUDED_DISABLED"))) {
      throw new Error("GEIGER_EXCLUDED_DISABLED_MISMATCH");
    }
    return true;
  }

  function auditArtifactAccounting(artifact, expectedSymbolCount) {
    const participating = artifact && artifact.participating_rungs;
    const accounting = artifact && artifact.accounting;
    if (!Array.isArray(participating) || !participating.length) {
      throw new Error("GEIGER_PARTICIPATING_RUNGS_INVALID");
    }
    if (!Number.isInteger(expectedSymbolCount) || expectedSymbolCount < 1) {
      throw new Error("GEIGER_EXPECTED_SYMBOL_COUNT_INVALID");
    }
    if (!accounting || typeof accounting !== "object" || Array.isArray(accounting)) {
      throw new Error("GEIGER_ACCOUNTING_MISSING");
    }
    const computed = accounting.rungs_computed;
    const absent = accounting.rung_absent;
    const failed = accounting.failed;
    const failures = accounting.failures;
    const named = accounting.named_rung_absences;
    if (![computed, absent, failed].every(function (n) { return Number.isInteger(n) && n >= 0; }) ||
        !Array.isArray(failures) || !Array.isArray(named)) {
      throw new Error("GEIGER_ACCOUNTING_INVALID");
    }
    if (failed !== 0 || failures.length !== 0) throw new Error("GEIGER_ACCOUNTING_FAILED");
    if (named.length !== absent) throw new Error("GEIGER_NAMED_ABSENCE_COUNT_MISMATCH");
    const expectedCells = expectedSymbolCount * participating.length;
    const unexplained = expectedCells - computed - absent;
    if (unexplained !== 0) throw new Error("GEIGER_ACCOUNTING_UNEXPLAINED:" + unexplained);
    const validKeys = new Set(participating.map(function (rung) { return rung.equalizer_key; }));
    const absenceIdentities = new Set();
    named.forEach(function (entry, index) {
      if (!entry || typeof entry.symbol !== "string" || !entry.symbol ||
          typeof entry.state !== "string" || !entry.state || !validKeys.has(entry.equalizer_key)) {
        throw new Error("GEIGER_NAMED_ABSENCE_INVALID:" + index);
      }
      const identity = entry.symbol + "\u0000" + entry.equalizer_key;
      if (absenceIdentities.has(identity)) throw new Error("GEIGER_NAMED_ABSENCE_DUPLICATE:" + identity);
      absenceIdentities.add(identity);
    });
    return { expected_cells: expectedCells, computed: computed, named_absent: absent,
      unexplained: unexplained, failed: failed };
  }

  function contributorCoverage(symbols, participatingCount) {
    if (!symbols || typeof symbols !== "object" || Array.isArray(symbols)) {
      throw new Error("GEIGER_SYMBOLS_INVALID");
    }
    if (!Number.isInteger(participatingCount) || participatingCount < 1) {
      throw new Error("GEIGER_PARTICIPATING_COUNT_INVALID");
    }
    const incomplete = [];
    Object.keys(symbols).forEach(function (symbol) {
      const count = symbols[symbol] && symbols[symbol].tf_contributors;
      if (!Number.isInteger(count) || count !== participatingCount) incomplete.push(symbol);
    });
    return { complete: incomplete.length === 0, incomplete_symbols: incomplete,
      complete_symbols: Object.keys(symbols).length - incomplete.length,
      expected_contributors_per_symbol: participatingCount };
  }

  return Object.freeze({
    GLOBAL_OWNER_ID: GLOBAL_OWNER_ID,
    TIMEFRAME_TOKENS: TIMEFRAME_TOKENS,
    EXPECTED_ROW_COUNT: EXPECTED_ROW_COUNT,
    stableJson: stableJson,
    deriveOperatorEqualizer: deriveOperatorEqualizer,
    validateArtifactProfile: validateArtifactProfile,
    auditArtifactAccounting: auditArtifactAccounting,
    contributorCoverage: contributorCoverage
  });
});
