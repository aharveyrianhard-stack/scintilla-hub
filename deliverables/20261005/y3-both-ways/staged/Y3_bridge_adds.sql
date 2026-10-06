-- SCINTILLA · Y3 (5 Oct 2026) — STAGED, NOT APPLIED. 8 more channels for the YouTube bridge.
--
-- Alan: "Did we do it both ways?" Reading each channel's own About page settled 8 of Y2's look-alikes: the
-- channel itself lists the Trading-list account among its links. Sure matches only.
--
-- CHANGES ONE ROW: app_config.yt_bridge_channels, 29 channel ids -> 37. No table, column or other row.
-- The first 29 ids are the row as it stands, in the same order; the 8 new ones follow.
-- It runs only if the row is still exactly what was read on 2026-10-06 (sha256 926bd024d0d046b4…): if somebody
-- changed the row since, this updates nothing — rebuild instead of forcing it.
-- The on-air check reads one page per bridged channel every 20 minutes: 29 -> 37 pages, under its limit of 60.
-- UNDO: Y3_bridge_adds_ROLLBACK.sql puts the row back byte for byte.
--
--   UCjZnbgPb08NFg7MHyPQRZ3Q  Amit Kukreja  <- @amitisinvesting (Y2 said: look-alike)
--   UCRu9sUsNNvtsqpRAKJ3fWng  Barchart  <- @Barchart (Y2 said: look-alike)
--   UCnjOXrJhaVd0tDDLUW0Yg_w  CappThesis - Frank Cappelleri  <- @FrankCappelleri (Y2 said: look-alike) — already in the feed by subscription; the bridge adds the on-air check
--   UCvJZEG5x-DVYZKTz--pS39w  FX Evolution - Trading Academy  <- @fxevolution (Y2 said: look-alike) — already in the feed by subscription; the bridge adds the on-air check
--   UCZ-J2m1AUSLnifUEKam5_dA  Verified Investing  <- @InvestVerified (Y2 said: look-alike) — already in the feed by subscription; the bridge adds the on-air check
--   UCtuoqGiIHBGMRmTGeXVrf9g  Jesse Olson  <- @JesseOlson (Y2 said: look-alike) — already in the feed by subscription; the bridge adds the on-air check
--   UCfdPOTevbfCh_QHsyPeZ8MQ  Figuring Out Money  <- @MarketMike (Y2 said: look-alike) — already in the feed by subscription; the bridge adds the on-air check
--   UCP2LVr4LRvGZif5Ry7D_SFw  PSax  <- @saxena_puru (Y2 said: look-alike)

update public.app_config
   set value = $y3${"ids":["UCfD3rq06LaA8wc3s2m3LwRQ","UCrOcsRCLkz8doOc4FGF4S4w","UCRvqjQPSeaWn-uEx-w0XOIg","UCvWx0-NX-9qVLCSW9yjdX-g","UCviK0XeiDS0l1deHtEVmrKw","UC4WdQJLdfdH4lyCV2hkt-iQ","UCnNV58dwf5X7dkrvCE18Djw","UC6Dnuzr4uJhfU5mcSm3pJgw","UCgtjx1rfbCJyo8RR0XdiWww","UCwX6kLA5qa3JsyXyxfixKAQ","UCsXaaMg95tCNL-tJb4j4GWQ","UCPiroGQ17KIh6htWW0pHSIw","UC2DGNpUZSnFl4RRAouQ3mLw","UCF3YBU7CfOLrQ7u1DjaxNRQ","UCoxmJkN7QnmYF55ukvekSuA","UCkDElJZEmdnswfoXK5cjDgw","UCwqHs_qbAQzx6mQtaV7C7gg","UCVvdnt2An8rC7zeey6Sa7bQ","UCOfLITbjjNjcIVaV9pBZuCA","UCaqenTegMoW98A4trRofR1A","UCvTUPg9PxLq3DO72AZBygNg","UCpNwmNz4Avr-mb-T_-xqllA","UCSA0DGhoraHLWhby7njGhoQ","UC5fZv7bPcF5j2RsfO-9OiLA","UCzX4HLkD7eXBgzVwHMZlhmg","UC1WnXpKhLxm4ewfG_dWEdgw","UCxvG6RV1YWTEKN34emXKcPA","UC307gGuaTYg0FYsnA2lsvOA","UCaO9gH0HOmvXjZg_tMG0lLQ","UCjZnbgPb08NFg7MHyPQRZ3Q","UCRu9sUsNNvtsqpRAKJ3fWng","UCnjOXrJhaVd0tDDLUW0Yg_w","UCvJZEG5x-DVYZKTz--pS39w","UCZ-J2m1AUSLnifUEKam5_dA","UCtuoqGiIHBGMRmTGeXVrf9g","UCfdPOTevbfCh_QHsyPeZ8MQ","UCP2LVr4LRvGZif5Ry7D_SFw"],"built_at":"2026-10-05T19:26:03.572Z","source":"control/YOUTUBE_CHANNEL_BRIDGE.json","accounts":126,"matched":30,"y3":{"built_at":"2026-10-06T01:07:35.414Z","source":"control/YOUTUBE_X_BOTH_WAYS.json","added":8}}$y3$
 where key = 'yt_bridge_channels'
   and encode(sha256(convert_to(value, 'UTF8')), 'hex') = '926bd024d0d046b4cc9080679cde14e5a9d5250d9a18406c809284fca403a39e';
