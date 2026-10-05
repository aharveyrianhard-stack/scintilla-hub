-- SCINTILLA · Y2 ROLLBACK — takes the bridged channels out of the SCINTILLA feed's sources again.
--
-- STEP 1 (enough on its own): the next sweep, at most 5 minutes later, reads only our own channel list again and
-- makes no on-air check. Videos already collected stay in the table and in the feed, as any old video does.
delete from public.app_config where key in ('yt_bridge_channels', 'yt_bridge_live');

-- STEP 2 (optional, changes what the feed shows — Alan's word first): un-file the videos the bridge filed under
-- SCINTILLA, for the bridged channels that are NOT in our own list. Left commented out on purpose.
-- update public.youtube_videos v
--    set subscription_accounts = array_remove(v.subscription_accounts, 'scintilla')
--  where v.channel_id = any (array['UCfD3rq06LaA8wc3s2m3LwRQ', 'UCrOcsRCLkz8doOc4FGF4S4w', 'UCRvqjQPSeaWn-uEx-w0XOIg', 'UCvWx0-NX-9qVLCSW9yjdX-g', 'UCviK0XeiDS0l1deHtEVmrKw', 'UC4WdQJLdfdH4lyCV2hkt-iQ', 'UCnNV58dwf5X7dkrvCE18Djw', 'UC6Dnuzr4uJhfU5mcSm3pJgw', 'UCgtjx1rfbCJyo8RR0XdiWww', 'UCwX6kLA5qa3JsyXyxfixKAQ', 'UCsXaaMg95tCNL-tJb4j4GWQ', 'UCPiroGQ17KIh6htWW0pHSIw', 'UC2DGNpUZSnFl4RRAouQ3mLw', 'UCF3YBU7CfOLrQ7u1DjaxNRQ', 'UCoxmJkN7QnmYF55ukvekSuA', 'UCkDElJZEmdnswfoXK5cjDgw', 'UCwqHs_qbAQzx6mQtaV7C7gg', 'UCVvdnt2An8rC7zeey6Sa7bQ', 'UCOfLITbjjNjcIVaV9pBZuCA', 'UCaqenTegMoW98A4trRofR1A', 'UCvTUPg9PxLq3DO72AZBygNg', 'UCpNwmNz4Avr-mb-T_-xqllA', 'UCSA0DGhoraHLWhby7njGhoQ', 'UC5fZv7bPcF5j2RsfO-9OiLA', 'UCzX4HLkD7eXBgzVwHMZlhmg', 'UC1WnXpKhLxm4ewfG_dWEdgw', 'UCxvG6RV1YWTEKN34emXKcPA', 'UC307gGuaTYg0FYsnA2lsvOA', 'UCaO9gH0HOmvXjZg_tMG0lLQ'])
--    and 'scintilla' = any (v.subscription_accounts)
--    and not exists (select 1 from public.app_config c
--                     where c.key = 'yt_sub_channels_scintilla' and (c.value::jsonb -> 'ids') ? v.channel_id);
