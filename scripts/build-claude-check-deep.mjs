#!/usr/bin/env node
/**
 * build-claude-check-deep.mjs — build the backlog page from what the deep read found.
 *
 * Two inputs:
 *   1. the collector's private index   <runtime>/bookmarks/<slug>/deep/index.json
 *      — machine facts: who posted, how many pictures, how long the thread, what was linked.
 *   2. the readings in this repository xfeed/data/claude-check-readings.json
 *      — the words a person (or a model that actually opened the picture) wrote about it.
 *
 * It writes ONE html file and copies NO picture. The pictures stay in the collector's store
 * on this Mac: they are other people's work, and the page describes them and links to the post.
 *
 *   node scripts/build-claude-check-deep.mjs [--out deliverables/20260924/claude-check-deep/CLAUDE-CHECK-DEEP.html]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
export const DEFAULT_INDEX = '/Users/alanharvey/SCINTILLA 0.5/_orchestration/xfeed-live/runtime/bookmarks/claude-check/deep/index.json';
export const DEFAULT_READINGS = join(REPO, 'xfeed/data/claude-check-readings.json');
export const DEFAULT_OUT = join(REPO, 'deliverables/20260924/claude-check-deep/CLAUDE-CHECK-DEEP.html');

export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** One row per bookmark: the machine's facts joined to the reading, if anyone has written one. */
export function joinCards(index, readings) {
  const reads = readings?.posts ?? {};
  return Object.values(index?.posts ?? {}).map(p => {
    const r = reads[p.id] ?? null;
    return {
      id: p.id,
      author: p.author_handle ? `@${p.author_handle}` : 'unknown',
      url: p.url ?? `https://x.com/i/status/${p.id}`,
      created_at: (p.created_at ?? '').slice(0, 10),
      status: p.status ?? 'unknown',
      pictures: p.pictures ?? 0,
      thread_posts: p.thread_posts ?? 0,
      readings_linked: (p.links ?? []).filter(l => l.file && l.kind !== 'shortener').length,
      link_titles: (p.links ?? []).filter(l => l.title).map(l => ({ title: l.title, url: l.url })),
      link_errors: (p.links ?? []).filter(l => l.error).map(l => ({ url: l.url, error: l.error })),
      hints: p.method_hints ?? [],
      cashtags: p.cashtags ?? [],
      described: Boolean(r?.shows),
      shows: r?.shows ?? null,
      method: r?.method ?? null,
      data_needed: r?.data_needed ?? null,
      hub_has: r?.hub_has ?? null,
      build: r?.build ?? null,
      recommendation: r?.recommendation ?? null,
      theme: r?.theme ?? 'Not yet read',
      rank: r?.rank ?? null,
      why: r?.why ?? null,
    };
  }).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export function byTheme(cards) {
  const map = new Map();
  for (const c of cards) {
    if (!map.has(c.theme)) map.set(c.theme, []);
    map.get(c.theme).push(c);
  }
  // Themes with the most read cards first; "Not yet read" always last.
  return [...map.entries()].sort((a, b) => {
    if (a[0] === 'Not yet read') return 1;
    if (b[0] === 'Not yet read') return -1;
    return b[1].filter(c => c.described).length - a[1].filter(c => c.described).length;
  });
}

export function topTen(cards) {
  return cards.filter(c => Number.isFinite(c.rank)).sort((a, b) => a.rank - b.rank).slice(0, 10);
}

export function counts(cards) {
  return {
    bookmarks: cards.length,
    read: cards.filter(c => c.status === 'read').length,
    described: cards.filter(c => c.described).length,
    pictures: cards.reduce((s, c) => s + c.pictures, 0),
    threads: cards.filter(c => c.thread_posts > 0).length,
    readings: cards.reduce((s, c) => s + c.readings_linked, 0),
    themes: new Set(cards.filter(c => c.described).map(c => c.theme)).size,
  };
}

const card = c => `
      <article class="card${c.described ? '' : ' thin'}">
        <header>
          <a class="who" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.author)}</a>
          <span class="when">${esc(c.created_at)}</span>
        </header>
        ${c.shows ? `<p class="shows"><b>What it shows.</b> ${esc(c.shows)}</p>` : '<p class="shows muted">Captured, not yet described. The picture is in the collector’s store; the next reading pass writes these words.</p>'}
        ${c.method ? `<p><b>The method.</b> ${esc(c.method)}</p>` : ''}
        ${c.data_needed ? `<p><b>Data it needs.</b> ${esc(c.data_needed)}</p>` : ''}
        ${c.hub_has ? `<p><b>Do we have it?</b> ${esc(c.hub_has)}</p>` : ''}
        ${c.build || c.recommendation ? `<p>${c.build ? `<b>Size.</b> ${esc(c.build)} ` : ''}${c.recommendation ? `<b>Recommendation.</b> ${esc(c.recommendation)}` : ''}</p>` : ''}
        <footer>
          <span>${c.pictures} picture${c.pictures === 1 ? '' : 's'} kept privately</span>
          ${c.thread_posts ? `<span>${c.thread_posts}-post thread read</span>` : ''}
          ${c.readings_linked ? `<span>${c.readings_linked} linked reading saved</span>` : ''}
          ${c.hints.length ? `<span>words: ${esc(c.hints.join(', '))}</span>` : ''}
          ${c.cashtags.length ? `<span>${esc(c.cashtags.slice(0, 6).map(t => `$${t}`).join(' '))}</span>` : ''}
        </footer>
      </article>`;

export function renderPage({ cards, generatedAt, storePath, health, folder = 'Claude Check', proof = [], operationalNote = null }) {
  const n = counts(cards);
  const top = topTen(cards);
  const themes = byTheme(cards);
  const notOpened = cards.flatMap(c => c.link_errors.map(e => ({ ...e, author: c.author, url: c.url })));
  const notRead = cards.filter(c => c.status !== 'read');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Claude Check, read properly — ideas from the folder</title>
<style>
  :root { --ink:#d2d2d2; --dim:#9a9a9a; --faint:#6e6e6e; --line:#2a2a2a; --panel:#121212; --bg:#0a0a0a; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
  .wrap { max-width:1100px; margin:0 auto; padding:28px 16px 80px; }
  header.page { margin:0 0 4px; }
  h1 { font:600 22px/1.3 -apple-system,sans-serif; margin:0 0 6px; letter-spacing:.2px; }
  h2 { font:600 15px/1.3 -apple-system,sans-serif; margin:36px 0 10px; color:var(--ink); border-bottom:1px solid var(--line); padding-bottom:8px; }
  h3 { font:600 13px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace; margin:24px 0 8px; color:var(--dim); text-transform:uppercase; letter-spacing:.09em; }
  p { margin:0 0 10px; }
  a { color:var(--ink); }
  .lede { color:var(--dim); font-size:13px; max-width:78ch; }
  .mono { font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; color:var(--faint); letter-spacing:.04em; }
  .tiles { display:flex; flex-wrap:wrap; gap:10px; margin:18px 0 6px; }
  .tile { background:var(--panel); border:1px solid var(--line); padding:10px 14px; min-width:120px; }
  .tile b { display:block; font:600 20px/1.2 ui-monospace,Menlo,monospace; }
  .tile span { font:11px/1.4 ui-monospace,Menlo,monospace; color:var(--faint); text-transform:uppercase; letter-spacing:.08em; }
  ol.top { counter-reset:t; list-style:none; padding:0; margin:12px 0 0; }
  ol.top li { counter-increment:t; background:var(--panel); border:1px solid var(--line); border-left:2px solid var(--dim); padding:12px 14px 12px 44px; margin:0 0 8px; position:relative; }
  ol.top li::before { content:counter(t); position:absolute; left:14px; top:12px; font:600 13px ui-monospace,Menlo,monospace; color:var(--faint); }
  ol.top b { color:var(--ink); }
  ol.top .why { color:var(--dim); display:block; margin-top:4px; }
  ol.top .src { font:11px ui-monospace,Menlo,monospace; color:var(--faint); }
  .cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(330px,1fr)); gap:10px; }
  .card { background:var(--panel); border:1px solid var(--line); padding:12px 14px; }
  .card.thin { opacity:.72; }
  .card header { display:flex; justify-content:space-between; align-items:baseline; gap:8px; margin-bottom:8px; }
  .card .who { font:600 12px ui-monospace,Menlo,monospace; text-decoration:none; }
  .card .when, .card footer span { font:11px ui-monospace,Menlo,monospace; color:var(--faint); }
  .card p { font-size:13px; }
  .card .muted { color:var(--faint); }
  .card footer { margin-top:10px; padding-top:8px; border-top:1px solid var(--line); display:flex; flex-wrap:wrap; gap:4px 12px; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th, td { text-align:left; padding:7px 10px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { font:11px ui-monospace,Menlo,monospace; color:var(--faint); text-transform:uppercase; letter-spacing:.08em; font-weight:600; }
  code { font:11px ui-monospace,Menlo,monospace; color:var(--dim); background:#151515; padding:1px 5px; border:1px solid var(--line); }
  ul.proof { margin:8px 0 14px; padding-left:18px; color:var(--dim); font-size:13px; }
  ul.proof li { margin:0 0 6px; }
  .note { border-left:2px solid var(--line); padding:2px 0 2px 14px; color:var(--dim); margin:12px 0; }
  @media (max-width:560px){ .cards { grid-template-columns:1fr; } .wrap { padding:20px 14px 60px; } }
</style>
</head>
<body>
<div class="wrap">
  <header class="page">
    <h1>Claude Check, read properly</h1>
    <p class="mono">${esc(folder)} bookmark folder &middot; built ${esc(generatedAt)} &middot; pictures kept on this Mac, never published</p>
  </header>

  <p class="lede">The first pass read only the words in each bookmark, so a chart posted as a picture arrived as
  &ldquo;ticker only&rdquo;. This pass opens each bookmark the way you would: the whole thread, the quoted post,
  every picture, and the pages and PDFs a post links to. The pictures are other people&rsquo;s work, so they stay in
  the collector&rsquo;s own store on this Mac. Here they are described in words, with a link to the post.</p>

  <div class="tiles">
    <div class="tile"><b>${n.bookmarks}</b><span>bookmarks</span></div>
    <div class="tile"><b>${n.read}</b><span>read deeply</span></div>
    <div class="tile"><b>${n.pictures}</b><span>pictures kept</span></div>
    <div class="tile"><b>${n.threads}</b><span>threads recovered</span></div>
    <div class="tile"><b>${n.readings}</b><span>linked readings</span></div>
    <div class="tile"><b>${n.described}</b><span>described by eye</span></div>
  </div>

  <h2>The ten worth building, in order</h2>
  <ol class="top">
${top.map(c => `    <li><b>${esc(c.shows ?? '')}</b>
      <span class="why">${esc(c.why ?? '')}</span>
      <span class="src">${esc(c.method ?? '')} &middot; data: ${esc(c.data_needed ?? '')} &middot; we have: ${esc(c.hub_has ?? '')} &middot; size: ${esc(c.build ?? '')} &middot; <a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.author)}</a></span></li>`).join('\n')}
  </ol>

  <h2>Every bookmark, by theme</h2>
  <p class="lede">Each card says what the picture or report actually shows, the method behind it, the data it needs,
  whether we already hold that data, how big the build is, and what I would do.</p>
${themes.map(([theme, list]) => `
  <h3>${esc(theme)} &middot; ${list.length}</h3>
  <div class="cards">${list.map(card).join('')}
  </div>`).join('\n')}

  <h2>The recurring behaviour</h2>
  <p>The deep read now rides the collector&rsquo;s existing schedule &mdash; no new background job. Each cycle, after the
  folder is re-read, up to six bookmarks that have never been read deeply get this same treatment: thread, quoted post,
  pictures, linked readings, all kept privately, and a card appears here within one cycle. It is bounded by count and
  by seconds, and it can neither change nor fail the Trading-list pass that runs before it.</p>
  <p class="mono">writer: scripts/xfeed-bookmark-deep.mjs &middot; rides: scripts/xfeed-program.mjs run &middot; store: ${esc(storePath)}</p>
  ${proof.length ? `<h3>Proved by hand, not assumed</h3>\n  <ul class="proof">${proof.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
  ${operationalNote ? `<p class="note">${esc(operationalNote)}</p>` : ''}
  ${health ? `<p class="mono">last pass: ${esc(health.last_pass?.pass_id ?? '')} &middot; ${esc(health.last_pass?.status ?? '')} &middot; read ${esc(String(health.last_pass?.read ?? 0))} &middot; ${esc(String(health.last_pass?.media_saved ?? 0))} pictures &middot; ${esc(health.last_pass?.finished_at ?? '')}</p>` : ''}
  <p class="note">Another folder or list: it is read by name, not by id. Say the name of the folder
  (for example <code>--folder "Macro Reads"</code>) and the same pass reads it into its own store beside this one.
  Nothing about this folder changes.</p>

  <h2>What could not be opened</h2>
  ${notOpened.length || notRead.length ? `<table>
    <tr><th>What</th><th>Why</th></tr>
${notRead.map(c => `    <tr><td>${esc(c.author)} &mdash; <a href="${esc(c.url)}" target="_blank" rel="noopener">post</a></td><td>${esc(c.status)}</td></tr>`).join('\n')}
${notOpened.map(e => `    <tr><td>link from ${esc(e.author)}</td><td>${esc(e.error)}</td></tr>`).join('\n')}
  </table>` : '<p>Everything in the folder opened.</p>'}

  <h2>Where each number comes from, and what could be wrong</h2>
  <table>
    <tr><th>On this page</th><th>Source</th></tr>
    <tr><td>Counts, authors, dates, thread length, picture count</td><td>The collector&rsquo;s own deep index, written by <code>xfeed-bookmark-deep.mjs</code> from X&rsquo;s own payloads.</td></tr>
    <tr><td>&ldquo;What it shows&rdquo;, the method, the recommendation</td><td>Written after opening the saved picture and reading it. A card that says &ldquo;not yet described&rdquo; has been captured but not yet looked at.</td></tr>
    <tr><td>&ldquo;Do we have it?&rdquo;</td><td>Judged against the Hub&rsquo;s own stored bars and fundamentals. Where it says no, it means no source is wired today, not that it is impossible.</td></tr>
  </table>
  <p class="lede">What could be wrong: a description is one reading of someone else&rsquo;s chart, and the axis labels are
  sometimes small &mdash; where a number was unreadable it is left out rather than guessed. X sometimes returns a post
  without its pictures; the pass keeps the richest copy it saw, so a thin card can mean X was thin, not that the post
  was. Nothing here is a recommendation to trade; it is a list of things worth building.</p>

  <h2>What this page does not do</h2>
  <p class="lede">It publishes no picture and no PDF &mdash; those stay on this Mac. It changes no Hub calculation, no
  saved Equalizer and no setting. It does not bookmark, like, reply or post on X; the collector only reads.</p>
</div>
</body>
</html>
`;
}

export async function build({ indexPath = DEFAULT_INDEX, readingsPath = DEFAULT_READINGS, out = DEFAULT_OUT, now = new Date().toISOString() } = {}) {
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  const readings = JSON.parse(await readFile(readingsPath, 'utf8'));
  let health = null;
  try { health = JSON.parse(await readFile(join(dirname(indexPath), 'health.json'), 'utf8')); } catch { /* optional */ }
  const cards = joinCards(index, readings);
  const html = renderPage({ cards, generatedAt: now.slice(0, 16).replace('T', ' ') + 'Z', storePath: dirname(indexPath), health, folder: index.folder ?? 'Claude Check', proof: readings.proof ?? [], operationalNote: readings.operational_note ?? null });
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, html);
  return { out, cards: cards.length, described: cards.filter(c => c.described).length, bytes: html.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--out');
  build(i > -1 ? { out: resolve(process.argv[i + 1]) } : {})
    .then(r => process.stdout.write(`${JSON.stringify(r, null, 2)}\n`))
    .catch(e => { process.stderr.write(`build failed: ${e.message}\n`); process.exitCode = 1; });
}
