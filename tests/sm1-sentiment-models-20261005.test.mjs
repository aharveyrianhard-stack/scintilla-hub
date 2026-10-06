// SM1 report (5–6 Oct 2026): the page's numbers must be the ones the stored per-piece calls give, not typed by hand.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const D = new URL("../deliverables/20261005/sm1-sentiment-models/", import.meta.url);
const read = (f) => readFileSync(new URL(f, D), "utf8");
const page = read("SM1-SENTIMENT-MODELS.html");
const set = JSON.parse(read("evidence/testset-labels-calls.json"));
const board = JSON.parse(read("evidence/scoreboard.json")).board;
const acc = (model, kind) => {
  const rows = set.filter((t) => t.kind === kind);
  return rows.filter((t) => t.calls[model].split("/")[0] === t.ref.stance).length / rows.length;
};

test("SM1: the test set is 150 news + 150 spoken pieces, each with a reference lean and ticker", () => {
  assert.equal(set.filter((t) => t.kind === "news").length, 150);
  assert.equal(set.filter((t) => t.kind === "speech").length, 150);
  for (const t of set) { assert.match(t.ref.stance, /^[BSN]$/); assert.ok(t.ref.ticker); }
});

test("SM1: every scoreboard row equals what the stored per-piece calls give", () => {
  const models = Object.keys(set[0].calls);
  assert.ok(models.length >= 17);
  for (const m of models) {
    const [id, mode] = m.split(" | ");
    const row = board.find((b) => b.model.startsWith(id) && (!mode || b.model.includes("told the ticker") === mode.includes("ticker")));
    assert.ok(row, m);
    assert.ok(Math.abs(row.news.acc - acc(m, "news")) < 0.002, m + " news");
    assert.ok(Math.abs(row.speech.acc - acc(m, "speech")) < 0.002, m + " speech");
  }
});

test("SM1: the page shows the pick's measured figures and every candidate the brief named", () => {
  const q = "Qwen2.5-7B-Instruct-Q4_K_M.gguf";
  assert.ok(page.includes(`${Math.round(acc(q, "news") * 100)}%`) && page.includes(`${Math.round(acc(q, "speech") * 100)}%`));
  for (const name of ["ProsusAI/finbert", "yiyanghkust/finbert-tone", "distilroberta-finetuned-financial-news", "deberta-v3-ft-financial-news", "bart-large-mnli", "qwen2.5-1.5b-instruct", "Llama-3.2-3B-Instruct", "Qwen2.5-7B-Instruct"]) assert.ok(page.includes(name), name);
});

test("SM1: the page keeps the house rules (way back, PAGE SPECS, nothing armed stated)", () => {
  assert.ok(page.includes("scnav") && page.includes('<details class="sc-pagespecs">'));
  assert.ok(page.includes("nothing armed"));
  assert.ok(!/eyJ[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,}/.test(page + read("evidence/dry-run-20261006.ndjson")));
});
