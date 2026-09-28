/* entry.mjs — the Statistics tab's entry rules, as code (28 Sep review round).
   A card with all its parts is drawn; it goes ON the tab only if it passes these, otherwise it is HELD BACK below the
   tab with the reasons printed. Alan, 28 Sep: no arbitrary windows or cut-offs — full distributions (percentiles
   1..100), pivots/swings, own-history percentiles; research questions, not buy rules. */
export const ENTRY = [
  "the horizon is a pivot or swing, never a fixed count of sessions",
  "the condition is read over its full distribution (percentiles 1..100, every whole percent, every record), never a forced cut-off",
  "a named review that is not part of how the finding was chosen",
];
export function entryFaults(c) {
  const f = [];
  if (c.method?.horizon?.kind !== "pivot") f.push(`fixed window: ${c.method?.horizon?.text || "no horizon stated"} — pending a pivot re-measure`);
  if (c.method?.cutoffs?.kind !== "full") f.push(`forced cut-off: ${c.method?.cutoffs?.text || "no cut stated"} — pending a percentile 1..100 re-measure`);
  if (c.review?.status !== "reviewed") f.push(`not reviewed: ${c.review?.by || "no review named"}`);
  return f;
}
