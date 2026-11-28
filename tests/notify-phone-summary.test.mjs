/* 28 Nov 2026 (coordinator). The phone's alert text is a COMPLETE summary (notify-push v15, supabase/functions/notify-push/summary.mjs).
   Alan, 13:14 ET (relayed): "the few sentences that I see there are incomplete. So like that summary should be complete in the space that the
   notification center allows. I click in and then I can see more detail." The cards below are real ones from 28 Nov. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { phoneBody, wholeSentences, firstParagraph, PHONE_BODY_MAX } from "../supabase/functions/notify-push/summary.mjs";

const v14 = (title, body) => (title + (body ? "\n" + body : "")).slice(0, 300);   // what the phone got before
const ends = (s) => /[.!?…]["'”’)\]]*$/.test(s);

test("card 16387: the headline and the whole first paragraph, not 300 characters cut mid-word", () => {
  const t = "SAVED · @GeorgeGammon · Livestream on Friday's bank failure";
  const b = "George Gammon posted a 28-minute emergency livestream titled 'Another Bank Just Failed... What You Need To Know'.\n\nCheck: [NOT WATCHED] I did not watch or transcribe the video, so I cannot report its arguments. [MEASURED earlier today, FDIC release of 27 November] The bank is United Fidelity of Evansville, Indiana, 5.9 billion dollars of assets.";
  assert.equal(phoneBody(t, b), t + "\nGeorge Gammon posted a 28-minute emergency livestream titled 'Another Bank Just Failed... What You Need To Know'.");
  assert.ok(!ends(v14(t, b)), "before: it stopped mid-sentence");
});

test("card 16395 (one long paragraph): whole sentences only, and J.P. Morgan is not a sentence end", () => {
  const t = "X WATCH · 4 items · AI debt at a record";
  const b = "AI-related debt sold worldwide is a record 599 billion dollars so far in 2026 (226 billion in all of 2025), 80 billion of it in November; the monthly bars add up, the data is Bloomberg and J.P. Morgan's. The money is still flowing to the build-out, so no sign of a slowdown from funding drying up, and no change to a playbook trigger or path odds. Jobs report Friday 4 December.";
  const out = phoneBody(t, b);
  assert.ok(out.endsWith("the data is Bloomberg and J.P. Morgan's."), out);
  assert.ok(out.length <= PHONE_BODY_MAX);
});

test("card 16366: the first sentence when both do not fit", () => {
  const t = "Reported: Hungary Lifts Entry Ban on Ukraine's Drone Forces Commander";
  const b = "Hungary reportedly lifts the Schengen-wide entry ban on Ukraine's drone forces commander, imposed in August 2025 after Ukraine struck the Druzhba oil pipeline supplying Russian oil to Hungary. Unverified report from the Monitor The Situation channel.";
  assert.equal(phoneBody(t, b), t + "\nHungary reportedly lifts the Schengen-wide entry ban on Ukraine's drone forces commander, imposed in August 2025 after Ukraine struck the Druzhba oil pipeline supplying Russian oil to Hungary.");
});

test("short alerts are unchanged; no body = the headline; abbreviations and decimals are not sentence ends", () => {
  assert.equal(phoneBody("MU up", "Memory prices rose. Shipments too."), "MU up\nMemory prices rose. Shipments too.");
  assert.equal(phoneBody("Report refresh had a problem", null), "Report refresh had a problem");
  assert.equal(phoneBody("Report refresh had a problem", ""), "Report refresh had a problem");
  assert.equal(wholeSentences("U.S. stocks rose 3.5 percent at 10 a.m. Eastern. Then they fell back hard into the close, the third such day in a row.", 60), "U.S. stocks rose 3.5 percent at 10 a.m. Eastern.");
  assert.equal(firstParagraph("one\ntwo\n\nthree"), "one\ntwo");
});

test("when not one sentence fits (or the source sent a fragment), the headline alone - no trailing fragment, never over 300", () => {
  const t = "FLASH · a headline";
  assert.equal(phoneBody(t, "word ".repeat(120).trim() + "."), t);
  assert.equal(phoneBody(t, "Ukrainian drones hit the refinery, and the refinery was… Unverified report from the"), t + "\nUkrainian drones hit the refinery, and the refinery was… Unverified report from the");
  assert.equal(phoneBody("Drones strike two oil sites", "Drones hit the Novoshakhtinsk refinery. Fires " + "burned ".repeat(60) + "and the refinery was… Unverified report from the"), "Drones strike two oil sites\nDrones hit the Novoshakhtinsk refinery.");
  assert.ok(phoneBody("", "word ".repeat(120)).endsWith("word…"), "no headline: whole words and an ellipsis");
  const huge = "T".repeat(400);
  assert.ok(phoneBody(huge, "x").length <= PHONE_BODY_MAX);
});

test("notify-push uses it for every phone card", () => {
  const src = readFileSync(new URL("../supabase/functions/notify-push/index.ts", import.meta.url), "utf8");
  assert.match(src, /import \{ phoneBody \} from "\.\/summary\.mjs";/);
  assert.match(src, /body: phoneBody\(r\.title, r\.body\)/);
  assert.doesNotMatch(src, /body: r\.title \+ \(r\.body \? "\\n" \+ r\.body : ""\)/);
});
