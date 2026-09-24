#!/usr/bin/env node
// Reproducibility manifest (packet §11): code, artifacts, environment, seed and hashes.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { sha256, canonicalJson, EVAL_SEED, EXTRACTOR_VERSION, settingsSha256, CANONICAL_SETTINGS } from "../lib/settings.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const hashTree = (dir, prefix = "") => readdirSync(`${ROOT}${dir}`).flatMap((f) => {
  const rel = `${dir}/${f}`;
  if (statSync(`${ROOT}${rel}`).isDirectory()) return f === "bars" ? [] : hashTree(rel, prefix);
  return [{ file: `research/trendoscope/${rel}`, sha256: sha256(readFileSync(`${ROOT}${rel}`, "utf8")),
    bytes: statSync(`${ROOT}${rel}`).size }];
});
const files = [...hashTree("lib"), ...hashTree("bin"), ...hashTree("migrations"), ...hashTree("parity"), ...hashTree("extracts")];
const testDir = fileURLToPath(new URL("../../../tests/", import.meta.url));
const tests = readdirSync(testDir).filter((f) => f.startsWith("trendoscope-")).map((f) => ({
  file: `tests/${f}`, sha256: sha256(readFileSync(`${testDir}${f}`, "utf8")) }));

const LAB = "/Users/alanharvey/SCINTILLA 0.5/INDICATOR_LAB/sprints/2026-09-17-visual-sprint";
const inputs = [
  ["TRENDOSCOPE_STATISTICAL_EVALUATION_PACKET_2026-09-23.md", `${LAB}/TRENDOSCOPE_STATISTICAL_EVALUATION_PACKET_2026-09-23.md`],
  ["pine/SCINTILLA_ACP_Duration_Review_V3.pine", `${LAB}/pine/SCINTILLA_ACP_Duration_Review_V3.pine`],
  ["pine/SCINTILLA_ACP_Continued_Rails_V2.pine", `${LAB}/pine/SCINTILLA_ACP_Continued_Rails_V2.pine`],
  ["evidence/ACP_CAPTURE_2026-09-24_4H.json", `${LAB}/evidence/ACP_CAPTURE_2026-09-24_4H.json`],
  ["evidence/ACP_CAPTURE_2026-09-24_D.json", `${LAB}/evidence/ACP_CAPTURE_2026-09-24_D.json`],
].map(([name, path]) => ({ input: name, sha256: sha256(readFileSync(path, "utf8")), read_only: true }));

const manifest = {
  frozen_utc: new Date().toISOString(),
  phase: "0 and 1 only — extractor proof, census, geometry. No outcome statistics, no predictive claim.",
  branch: execSync("git rev-parse --abbrev-ref HEAD", { cwd: ROOT }).toString().trim(),
  commit: execSync("git rev-parse HEAD", { cwd: ROOT }).toString().trim(),
  base_commit: "158a21e (origin/hub/release-20260923)",
  seed: EVAL_SEED, extractor_version: EXTRACTOR_VERSION,
  settings_sha256: settingsSha256(), settings: CANONICAL_SETTINGS,
  environment: { node: process.version, platform: process.platform, arch: process.arch },
  detector_status: { ported: false, reason: "TRENDOSCOPE_LIBRARY_SOURCE_UNAVAILABLE",
    detail: "research/trendoscope/MISSING-DETECTOR-SOURCES.md", formal_events: 0 },
  read_only_inputs: inputs, code_and_artifacts: files, tests,
  excluded_from_repo: { path: "research/trendoscope/extracts/bars/",
    reason: "13 MB of provider-derived bars; this repository is served publicly. Hashes are pinned in bars-manifest.json and the series were handed over in the run directory." },
};
manifest.manifest_sha256 = sha256(canonicalJson({ files, tests, inputs, settings_sha256: manifest.settings_sha256 }));
writeFileSync(`${ROOT}MANIFEST.json`, JSON.stringify(manifest, null, 1));
console.log(`manifest: ${files.length} code/artifact files, ${tests.length} test files, ${inputs.length} read-only inputs`);
console.log(`manifest_sha256 ${manifest.manifest_sha256}`);
