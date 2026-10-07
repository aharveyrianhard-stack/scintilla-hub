/* CP5 · the test results, written down from the runners' own output (TAP) for the page and the return: nothing typed by hand.
     node record-tests.mjs --hub <tap> --hub-live <tap> --tool <tap> [<tap> …] --tool-base <tap>                              */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), argv = process.argv.slice(2);
const group = (flag) => { const i = argv.indexOf(flag); if (i < 0) return []; const out = []; for (let j = i + 1; j < argv.length && !argv[j].startsWith("--"); j++) out.push(argv[j]); return out; };
const read = (files) => { let tests = 0, pass = 0, fail = 0, skipped = 0; const failing = [], unfinished = []; for (const f of files) { if (!fs.existsSync(f)) { unfinished.push(path.basename(f)); continue; } const t = fs.readFileSync(f, "utf8"), n = (k) => { const m = new RegExp("^# " + k + " (\\d+)", "m").exec(t); return m ? Number(m[1]) : null; };
    if (n("tests") == null) { unfinished.push(path.basename(f)); continue; } tests += n("tests"); pass += n("pass"); fail += n("fail"); skipped += n("skipped") || 0; for (const m of t.matchAll(/^not ok \d+ - (.+)$/gm)) failing.push(m[1].replace(/^tests\//, "").slice(0, 90)); }
  return { tests, pass, fail, skipped, failing, unfinished }; };
const short = (s) => { const t = s.replace(/^\d+ · /, "").split(" — ")[0].trim(); return t.length > 84 ? t.slice(0, 82).replace(/[ ,;:]+\S*$/, "") + "…" : t; };
const hub = read(group("--hub")), live = read(group("--hub-live")), tool = read(group("--tool")), base = read(group("--tool-base"));
const out = { what: "Test results of 7 Oct 2026, read from the runners' own output.",
  hub: { ...hub, failing: hub.failing.map(short), on_the_live_line: { tests: live.tests, fail: live.fail, failing: live.failing.map(short) }, new_failing_names: hub.failing.map(short).filter((n) => !live.failing.map(short).includes(n)) },
  tool: { ...tool, failing: tool.failing.map(short), files_left_out: "the three files that are allowed to write (pa4, pa5, pa6-knockout)", older_card_tests_on_the_earlier_commit: base.tests ? { tests: base.tests, fail: base.fail, failing: base.failing.map(short) } : null,
    words: `${tool.tests} run without the three files that are allowed to write, ${tool.fail} fail (${tool.failing.map(short).join("; ") || "none"})${tool.unfinished.length ? `; not finished: ${tool.unfinished.join(", ")}` : ""}.` } };
fs.writeFileSync(ROOT + "/data/tests.json", JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1));
