// SCINTILLA · Y3 — the rules for reading an X account off a YouTube channel's About page, and for settling a
// look-alike. Pure text → facts, so the builder (scripts/yt-x-both-ways.mjs) and the tests read the same rules.
//
// The About page carries the channel's own link list (channelExternalLinkViewModel: a title and an address)
// and its description. yt-dlp reads the same block for a channel's links (youtube:tab extractor,
// https://github.com/yt-dlp/yt-dlp). A link the channel lists itself is the strongest evidence there is in this
// direction; an address in the description is next; a bare "@name" beside the word Twitter or X is the weakest.

const unjson = (s) => { try { return JSON.parse('"' + String(s || '') + '"'); } catch (_) { return String(s || ''); } };

/** words that sit where a handle would on x.com but are pages of the site, not accounts */
const NOT_A_HANDLE = new Set(['i', 'intent', 'share', 'home', 'search', 'hashtag', 'explore', 'settings', 'messages', 'notifications',
  'login', 'signup', 'compose', 'privacy', 'tos', 'about', 'download', 'widgets', 'statuses', 'status', 'twitter', 'x', 'en', 'web']);

/** every X account an address or a piece of text points at, in order, without duplicates */
export function xHandlesIn(text) {
  const out = [];
  for (const m of String(text || '').matchAll(/(?:^|[^A-Za-z0-9.-])(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/(?:#!\/)?@?([A-Za-z0-9_]{1,15})(?![A-Za-z0-9_])/gi)) {
    const h = m[1];
    if (NOT_A_HANDLE.has(h.toLowerCase())) continue;
    if (!out.some((o) => o.toLowerCase() === h.toLowerCase())) out.push(h);
  }
  return out;
}
/** "Twitter: @name", "X - @name", "Follow me on X @name" — a handle said in words */
export function xHandlesSaid(text) {
  const out = [];
  for (const m of String(text || '').matchAll(/(?:\btwitter\b|(?:^|[\s(|•·-])X\b)[^\n@]{0,24}@([A-Za-z0-9_]{2,15})(?![A-Za-z0-9_.])/gi)) {
    if (!out.some((o) => o.toLowerCase() === m[1].toLowerCase())) out.push(m[1]);
  }
  return out;
}

/** an About page → { links: [{title, url}], description } */
export function parseAbout(html) {
  const text = String(html || ''), at = text.indexOf('"aboutChannelViewModel":{');
  if (at < 0) return { links: [], description: '', about_block: false };
  const block = text.slice(at, at + 80000);
  const links = [...block.matchAll(/"channelExternalLinkViewModel":\{"title":\{"content":"((?:[^"\\]|\\.)*)"\},"link":\{"content":"((?:[^"\\]|\\.)*)"/g)]
    .map((m) => ({ title: unjson(m[1]), url: unjson(m[2]) }));
  const d = block.match(/"description":"((?:[^"\\]|\\.)*)"/);
  return { links, description: d ? unjson(d[1]).slice(0, 4000) : '', about_block: true };
}

/** which X account does this channel say is its own? */
export function xAccountOf(about, channelTitle) {
  const a = about || {}, fromLinks = [], fromText = xHandlesIn(a.description), said = xHandlesSaid(a.description);
  for (const l of a.links || []) for (const h of xHandlesIn(' ' + l.url)) if (!fromLinks.some((o) => o.toLowerCase() === h.toLowerCase())) fromLinks.push(h);
  const all = [...fromLinks];
  for (const h of [...fromText, ...said]) if (!all.some((o) => o.toLowerCase() === h.toLowerCase())) all.push(h);
  if (fromLinks.length) {
    const title = (a.links.find((l) => xHandlesIn(' ' + l.url)[0] === fromLinks[0]) || {}).title || '';
    return { handle: fromLinks[0], all, where: 'links', count: fromLinks.length,
      how: 'the channel lists x.com/' + fromLinks[0] + ' among its own About links' + (title ? ' ("' + title.slice(0, 40) + '")' : '') + (fromLinks.length > 1 ? ' · it lists ' + fromLinks.length + ' X accounts, this is the first' : '') };
  }
  if (fromText.length) return { handle: fromText[0], all, where: 'description', count: fromText.length,
    how: 'the channel description gives the address x.com/' + fromText[0] + (fromText.length > 1 ? ' · it gives ' + fromText.length + ' X addresses, this is the first' : '') };
  if (said.length) return { handle: said[0], all, where: 'said', count: said.length, how: 'the channel description says "@' + said[0] + '" beside the word Twitter or X (no address)' };
  return { handle: null, all: [], where: null, count: 0, how: '' };
}

/** HOW SURE, YouTube → X. A single account in the channel's own link list is sure. Several accounts in the link
    list, or an address only in the description, is likely (a description often credits guests and partners).
    A name said without an address is weak. */
export function reverseConfidence(found, about) {
  if (!found || !found.handle) return 'none';
  if (found.where === 'links') return found.count === 1 ? 'high' : 'medium';
  if (found.where === 'description') return found.count === 1 ? 'medium' : 'low';
  return 'low';
}

/** a Y2 look-alike, settled by the candidates' own About pages:
    sure       — a candidate's About names this X account;
    not theirs — the candidate Y2 picked names a different X account (so it belongs to somebody else);
    open       — the About page names nobody: nothing new to go on. */
export function settleLookalike(xHandle, pages, roster) {
  const want = String(xHandle).toLowerCase();
  let firstOther = null;
  for (const { id, a } of pages || []) {
    if (!a || a.status !== 200 || a.unreadable) continue;
    const x = xAccountOf(a, a.title);
    if (x.all.some((h) => h.toLowerCase() === want) && x.where !== 'said') {
      return { verdict: 'sure', channel_id: id, channel_title: a.title || '', why: 'the channel\'s own About page names x.com/' + xHandle + ' (' + x.how + ')' };
    }
    if (x.handle && x.where !== 'said' && !x.all.some((h) => h.toLowerCase() === want) && !firstOther && id === pages[0].id) firstOther = { id, title: a.title || '', handle: x.handle, onList: !!(roster && roster.has(x.handle.toLowerCase())) };
  }
  if (firstOther) return { verdict: 'not theirs', channel_id: null, why: 'the look-alike "' + firstOther.title + '" names a different X account, @' + firstOther.handle + (firstOther.onList ? ' (which is on the Trading list)' : '') };
  const first = (pages || [])[0];
  if (first && first.a && first.a.status === 200 && !first.a.unreadable) return { verdict: 'open', channel_id: null, why: 'the look-alike\'s About page names no X account' };
  return { verdict: 'open', channel_id: null, why: 'the look-alike\'s About page could not be read' };
}
