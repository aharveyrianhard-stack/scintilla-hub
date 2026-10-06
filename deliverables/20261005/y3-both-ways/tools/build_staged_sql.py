#!/usr/bin/env python3
"""Y3 — writes the staged SQL from control/YOUTUBE_X_BOTH_WAYS.json and the row as it stood when read
(staged/yt_bridge_channels.current-row.txt, byte for byte). No network, no database."""
import json, os, hashlib
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
ST = os.path.join(HERE, "..", "staged")
B = json.load(open(os.path.join(ROOT, "control", "YOUTUBE_X_BOTH_WAYS.json")))
cur_text = open(os.path.join(ST, "yt_bridge_channels.current-row.txt")).read()
cur = json.loads(cur_text)
adds = [a for a in B["proposals"]["add_to_bridge_staged"] if a["channel_id"] not in cur["ids"]]
new = dict(cur); new["ids"] = cur["ids"] + [a["channel_id"] for a in adds]
new["y3"] = {"built_at": B["built_at"], "source": "control/YOUTUBE_X_BOTH_WAYS.json", "added": len(adds)}
new_text = json.dumps(new, separators=(",", ":"))
assert "$y3$" not in new_text and "$y3$" not in cur_text
sha = hashlib.sha256(cur_text.encode()).hexdigest()
lines = "\n".join("--   %s  %s  <- @%s (Y2 said: %s)%s" % (a["channel_id"], a["channel_title"], a["x_handle"], a["y2_said"],
                  "" if not a["already_in_feed_by_subscription"] else " — already in the feed by subscription; the bridge adds the on-air check") for a in adds)
up = f"""-- SCINTILLA · Y3 (5 Oct 2026) — STAGED, NOT APPLIED. {len(adds)} more channels for the YouTube bridge.
--
-- Alan: "Did we do it both ways?" Reading each channel's own About page settled {len(adds)} of Y2's look-alikes: the
-- channel itself lists the Trading-list account among its links. Sure matches only.
--
-- CHANGES ONE ROW: app_config.yt_bridge_channels, {len(cur["ids"])} channel ids -> {len(new["ids"])}. No table, column or other row.
-- The first {len(cur["ids"])} ids are the row as it stands, in the same order; the {len(adds)} new ones follow.
-- It runs only if the row is still exactly what was read on {B["built_at"][:10]} (sha256 {sha[:16]}…): if somebody
-- changed the row since, this updates nothing — rebuild instead of forcing it.
-- The on-air check reads one page per bridged channel every 20 minutes: {len(cur["ids"])} -> {len(new["ids"])} pages, under its limit of 60.
-- UNDO: Y3_bridge_adds_ROLLBACK.sql puts the row back byte for byte.
--
{lines}

update public.app_config
   set value = $y3${new_text}$y3$
 where key = 'yt_bridge_channels'
   and encode(sha256(convert_to(value, 'UTF8')), 'hex') = '{sha}';
"""
down = f"""-- SCINTILLA · Y3 ROLLBACK — puts app_config.yt_bridge_channels back to the row read on {B["built_at"][:10]} ({len(cur["ids"])} ids), byte for byte.
-- The next sweep (at most 5 minutes later) reads the old list again. Videos already collected stay, as any old video does.
update public.app_config
   set value = $y3${cur_text}$y3$
 where key = 'yt_bridge_channels';
"""
open(os.path.join(ST, "Y3_bridge_adds.sql"), "w").write(up)
open(os.path.join(ST, "Y3_bridge_adds_ROLLBACK.sql"), "w").write(down)
print(len(cur["ids"]), "->", len(new["ids"]), "sha", sha[:16])
