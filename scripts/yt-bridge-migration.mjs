#!/usr/bin/env node
/** Y2 — writes the two SQL files from control/YOUTUBE_CHANNEL_BRIDGE.json, so the stored list is always the file's list.
 *  usage: node scripts/yt-bridge-migration.mjs   (writes; applies nothing — the coordinator applies it) */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bridgeChannelIds } from '../supabase/functions/_shared/yt-bridge.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const bridge = JSON.parse(await readFile(join(ROOT, 'control/YOUTUBE_CHANNEL_BRIDGE.json'), 'utf8'));
const ids = bridgeChannelIds(bridge);
const value = JSON.stringify({ ids, built_at: bridge.built_at, source: 'control/YOUTUBE_CHANNEL_BRIDGE.json', accounts: bridge.counts.accounts, matched: bridge.counts.matched_in_feed });
const names = bridge.channels.filter((r) => r.in_feed).map((r) => '--   ' + r.channel_id + '  ' + (r.channel_title || '').replace(/[^\x20-\x7e]/g, '?') + '  ← @' + r.x_handle + ' (' + r.confidence + ')').join('\n');

const up = `-- SCINTILLA · Y2 (5 Oct 2026): the YouTube channels of the X accounts Alan reads ride with our own channel list.
--
-- Alan: "bridge the gap: subscribe to all of those, have the feed. Wolf Trading is live right now on X Spaces and
-- on YouTube — I don't see it on our YouTube feed."
--
-- ADDITIVE: one new row in app_config (key yt_bridge_channels). No table, column, view or existing row is changed.
-- yt-rss-sweep v8 reads the row on every pass and adds these channels to the SCINTILLA account's channels FOR THAT
-- PASS ONLY; the account's own list (yt_sub_channels_scintilla) is never written with them.
-- Until yt-rss-sweep v8 is deployed the row is read by nothing, so apply order is safe either way.
-- UNDO: 20261005_youtube_channel_bridge_ROLLBACK.sql (read it first).
--
-- ${ids.length} channels, from ${bridge.counts.accounts} X accounts (control/YOUTUBE_CHANNEL_BRIDGE.json, built ${bridge.built_at}):
${names}

insert into public.app_config (key, value)
values ('yt_bridge_channels', $bridge$${value}$bridge$)
on conflict (key) do update set value = excluded.value;
`;
const down = `-- SCINTILLA · Y2 ROLLBACK — takes the bridged channels out of the SCINTILLA feed's sources again.
--
-- STEP 1 (enough on its own): the next sweep, at most 5 minutes later, reads only our own channel list again and
-- makes no on-air check. Videos already collected stay in the table and in the feed, as any old video does.
delete from public.app_config where key in ('yt_bridge_channels', 'yt_bridge_live');

-- STEP 2 (optional, changes what the feed shows — Alan's word first): un-file the videos the bridge filed under
-- SCINTILLA, for the bridged channels that are NOT in our own list. Left commented out on purpose.
-- update public.youtube_videos v
--    set subscription_accounts = array_remove(v.subscription_accounts, 'scintilla')
--  where v.channel_id = any (array[${ids.map((id) => "'" + id + "'").join(', ')}])
--    and 'scintilla' = any (v.subscription_accounts)
--    and not exists (select 1 from public.app_config c
--                     where c.key = 'yt_sub_channels_scintilla' and (c.value::jsonb -> 'ids') ? v.channel_id);
`;
await writeFile(join(ROOT, 'supabase/migrations/20261005_youtube_channel_bridge.sql'), up);
await writeFile(join(ROOT, 'supabase/migrations/20261005_youtube_channel_bridge_ROLLBACK.sql'), down);
console.log(ids.length + ' channel ids written');
