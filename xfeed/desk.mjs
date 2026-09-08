import { parseLedger, mediaFor, filterPosts, normalizeReceipt, formatET, youtubeIdFromUrl } from './model.mjs';

const tape = document.getElementById('tape');
const state = document.getElementById('state');
const day = document.getElementById('day');
const dialog = document.getElementById('media-dialog');
const mediaContent = document.getElementById('media-content');
const mediaNote = document.getElementById('media-note');
const closeMedia = document.getElementById('close-media');
let view = 'trading';
let posts = [];
let ready = false;
let loadError = '';
let mediaTrigger = null;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function link(url, text, className) {
  const node = element('a', className, text);
  node.href = url;
  node.target = '_blank';
  node.rel = 'noopener noreferrer';
  return node;
}

function describe(value) {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return JSON.stringify(value, null, 2);
}

function setState(text, retry = false) {
  state.replaceChildren(document.createTextNode(text));
  state.hidden = !text;
  if (retry) {
    const button = element('button', '', 'Try again');
    button.type = 'button';
    button.addEventListener('click', load);
    state.append(button);
  }
}

function showMedia({ type, source, title, alt = '' }, trigger) {
  mediaTrigger = trigger;
  mediaContent.replaceChildren();
  document.getElementById('media-title').textContent = title;
  mediaNote.textContent = '';
  let player;
  if (type === 'photo') {
    player = element('img');
    player.alt = alt || title;
    player.referrerPolicy = 'no-referrer';
    player.src = source;
    player.addEventListener('error', () => { mediaNote.textContent = 'This image is unavailable from its source.'; });
  } else if (type === 'youtube') {
    player = element('iframe');
    player.title = title;
    player.src = 'https://www.youtube-nocookie.com/embed/' + source + '?autoplay=1&playsinline=1';
    player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    player.allowFullscreen = true;
    player.referrerPolicy = 'strict-origin-when-cross-origin';
    mediaNote.textContent = 'YouTube plays here. Some publishers restrict embedded playback.';
  } else {
    player = element('video');
    player.src = source;
    player.controls = true;
    player.autoplay = true;
    player.playsInline = true;
    player.preload = 'metadata';
    player.addEventListener('error', () => {
      mediaNote.textContent = 'This saved video URL is unavailable or unsupported. The post remains in the desk; its media needs to be resolved again.';
    });
  }
  mediaContent.append(player);
  dialog.showModal();
  document.body.style.overflow = 'hidden';
  closeMedia.focus();
}

closeMedia.addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
});
dialog.addEventListener('close', () => {
  const video = mediaContent.querySelector('video');
  if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
  mediaContent.replaceChildren();
  mediaNote.textContent = '';
  document.body.style.overflow = '';
  if (mediaTrigger?.isConnected) mediaTrigger.focus();
  mediaTrigger = null;
});

function mediaButton(post, type, source, photo, number, origin = {}) {
  const button = element('button', 'tile');
  button.type = 'button';
  const title = (origin.original ? 'Original · ' : '') + '@' + (origin.handle || post.handle) + ' · ' + (type === 'photo' ? 'Photo ' + number : type === 'youtube' ? 'YouTube video' : 'X video' + (number ? ' ' + number : ''));
  button.setAttribute('aria-label', (type === 'photo' ? 'Enlarge ' : 'Play ') + title);
  if (photo) {
    const img = element('img');
    img.referrerPolicy = 'no-referrer';
    img.src = photo.url;
    img.alt = photo.alt || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', () => button.classList.add('image-failed'));
    button.append(img, element('span', 'photo-fallback', 'Image unavailable'));
  }
  if (type !== 'photo') {
    const overlay = element('span', 'play');
    overlay.append(element('b', '', 'PLAY'));
    const label = (origin.original ? 'ORIGINAL · ' : '') + (type === 'youtube' ? 'YOUTUBE' : 'X VIDEO');
    button.append(overlay, element('span', 'video-label', label));
  }
  button.addEventListener('click', () => showMedia({ type, source, title, alt: photo?.alt }, button));
  return button;
}

function appendLinks(parent, links, post) {
  if (!links.length) return;
  const container = element('div', 'links');
  for (const outbound of links) {
    const youtube = youtubeIdFromUrl(outbound.url);
    const title = outbound.title || new URL(outbound.url).hostname + new URL(outbound.url).pathname;
    if (youtube) {
      const button = element('button', 'youtube-link', title + ' · Play here');
      button.type = 'button';
      button.addEventListener('click', () => showMedia({ type: 'youtube', source: youtube, title: '@' + post.handle + ' · YouTube video' }, button));
      container.append(button);
    } else container.append(link(outbound.url, title));
  }
  parent.append(container);
}

function postRow(post) {
  const item = element('li', 'post');
  const meta = element('div', 'meta');
  meta.append(post.url ? link(post.url, '@' + post.handle, 'handle') : element('span', 'handle', '@' + post.handle));
  const time = element('time', '', formatET(post.created_at));
  time.dateTime = post.created_at;
  meta.append(time);
  if (post.kind !== 'original') meta.append(element('span', 'kind', post.kind));
  item.append(meta);

  const row = element('div', 'row');
  const copy = element('div', 'copy');
  if (post.text) copy.append(element('p', 'post-text', post.text));
  if (post.original) {
    const original = element('blockquote', 'original');
    const label = 'Original' + (post.original.handle ? ' · @' + post.original.handle : ' post');
    original.append(post.original.url ? link(post.original.url, label, 'original-label') : element('span', 'original-label', label));
    if (post.original.text && post.original.text !== post.text) original.append(element('p', '', post.original.text));
    appendLinks(original, post.original.links, post);
    copy.append(original);
  } else if (post.kind === 'quote' || post.kind === 'repost') {
    copy.append(element('p', 'original', 'Original post not available in this capture.'));
  }
  appendLinks(copy, post.links, post);
  if (copy.childNodes.length) row.append(copy);

  const media = mediaFor(post);
  const tiles = element('div', 'media-tiles');
  media.videos.forEach((video, index) => {
    if (video.url) tiles.append(mediaButton(post, 'video', video.url, video.poster ? { url: video.poster, alt: video.alt } : null, index + 1, video));
    else {
      const missing = element('div', 'missing-video', (video.original ? 'Original video' : 'Video') + ' ' + (index + 1) + ' unresolved');
      missing.append(element('span', '', 'Post retained · playable file not captured'));
      tiles.append(missing);
    }
  });
  media.youtube_videos.forEach(video => tiles.append(mediaButton(post, 'youtube', video.id, null, null, video)));
  media.photos.forEach((photo, index) => tiles.append(mediaButton(post, 'photo', photo.url, photo, index + 1)));
  if (tiles.childNodes.length) row.append(tiles);
  if (row.childNodes.length) item.append(row);
  const foot = element('div', 'post-foot');
  if (media.originalMedia) foot.append(element('span', '', 'Includes original media'));
  if (post.url) foot.append(link(post.url, 'Source post'));
  if (post.provenance !== null) {
    const details = element('details', 'provenance');
    details.append(element('summary', '', 'Collection evidence'), element('p', '', describe(post.provenance)));
    foot.append(details);
  }
  if (foot.childNodes.length) item.append(foot);
  return item;
}

function render() {
  const rows = filterPosts(posts, view);
  tape.replaceChildren();
  tape.setAttribute('aria-label', view === 'video' ? 'Posts with video' : view === 'notifications' ? 'Notification posts' : 'Trading posts');
  document.querySelectorAll('[data-view]').forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle('on', active);
    button.setAttribute('aria-pressed', String(active));
  });
  day.textContent = rows[0] ? formatET(rows[0].created_at, true) + ' · ET' : 'X · Desk';
  if (view === 'notifications') { setState('Notifications list not connected yet.'); return; }
  if (loadError) { setState(loadError, true); return; }
  if (!ready) { setState('Loading trading posts…'); return; }
  if (!rows.length) {
    setState(view === 'video' ? 'No video posts have been collected in this ledger.' : 'No trading posts have been collected in this ledger yet.');
    return;
  }
  setState('');
  const fragment = document.createDocumentFragment();
  rows.forEach(post => fragment.append(postRow(post)));
  tape.append(fragment);
}

function renderReceipt(raw, parsed, receiptAvailable) {
  const receipt = normalizeReceipt(raw, parsed.posts);
  const queried = receipt.handles_queried === null ? 'unavailable' : String(receipt.handles_queried);
  const handles = queried + (receipt.handles_total === null ? '' : ' / ' + receipt.handles_total);
  const scopeSummary = receipt.collection_scopes.includes('latest_page_per_handle') ? ' · latest page / handle' : '';
  document.getElementById('receipt-summary').textContent = receipt.status.replaceAll('_', ' ') + ' · ' + receipt.posts_kept + ' posts · ' + handles + ' handles queried' + scopeSummary;
  const content = document.getElementById('receipt-content');
  content.replaceChildren();
  const grid = element('dl', 'receipt-grid');
  const counts = [
    ['Handles queried', handles], ['Posts kept', receipt.posts_kept],
    ['Native videos resolved', receipt.videos_resolved], ['Videos still missing', receipt.videos_missing],
    ['YouTube IDs', receipt.youtube_ids], ['Outbound links', receipt.outbound_links],
  ];
  for (const [label, value] of counts) {
    const group = element('div');
    group.append(element('dt', '', label), element('dd', '', String(value)));
    grid.append(group);
  }
  content.append(grid);
  content.append(element('p', '', receipt.collected_at ? 'Collected ' + formatET(receipt.collected_at) : 'Collection time unavailable.'));
  if (receipt.generated_at) content.append(element('p', '', 'Receipt generated ' + formatET(receipt.generated_at)));
  content.append(element('p', '', 'Media counts describe saved ledger rows. A saved URL does not guarantee that its host still permits playback.'));
  if (!receiptAvailable) content.append(element('p', '', 'The collection receipt is unavailable. Handle coverage has not been verified.'));
  if (receipt.collection_scopes.length) {
    const scopes = receipt.collection_scopes.map(scope => scope === 'latest_page_per_handle' ? 'latest available page per handle' : scope.replaceAll('_', ' '));
    content.append(element('p', '', 'Collection scope: ' + scopes.join('; ') + '. Historical coverage beyond this scope has not been established.'));
  }
  if (receipt.source_completeness !== null) content.append(element('p', '', 'Source coverage: ' + describe(receipt.source_completeness)));
  else if (receipt.first_pass_complete !== null || receipt.query_pass_complete !== null) {
    const coverage = [];
    if (receipt.query_pass_complete !== null) coverage.push('Query pass ' + (receipt.query_pass_complete ? 'complete' : 'incomplete'));
    if (receipt.first_pass_complete !== null) coverage.push('Full-post extraction ' + (receipt.first_pass_complete ? 'complete for this pass' : 'incomplete'));
    content.append(element('p', '', coverage.join(' · ') + '. This does not establish complete X history.'));
  } else content.append(element('p', '', 'Source completeness has not been established.'));
  const handleStates = [['No results', receipt.handles_no_results], ['Blocked', receipt.handles_blocked], ['Failed', receipt.handles_failed], ['Unattempted', receipt.handles_unattempted]].filter(([, value]) => value !== null);
  if (handleStates.length) content.append(element('p', '', handleStates.map(([label, value]) => label + ': ' + value).join(' · ')));
  const notes = Array.isArray(receipt.notes) ? receipt.notes.join('\n') : receipt.notes;
  if (notes) content.append(element('p', '', notes));
  if (receipt.limitations.length) content.append(element('p', '', receipt.limitations.join('\n')));
  if (parsed.invalid) content.append(element('p', '', parsed.invalid + ' invalid ledger lines excluded from this view.'));
  if (parsed.duplicates) content.append(element('p', '', parsed.duplicates + ' older post versions replaced by the latest valid ledger entry.'));
}

async function fetchFile(path, format) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return format === 'json' ? response.json() : response.text();
}

async function load() {
  ready = false;
  loadError = '';
  tape.setAttribute('aria-busy', 'true');
  render();
  const [ledger, receipt] = await Promise.allSettled([
    fetchFile('./data/ledger.jsonl', 'text'), fetchFile('./data/receipt.json', 'json'),
  ]);
  if (ledger.status === 'fulfilled') {
    const parsed = parseLedger(ledger.value);
    posts = parsed.posts;
    ready = true;
    if (!posts.length && parsed.invalid) loadError = 'The ledger loaded, but none of its entries could be read as valid posts. See the collection receipt for rejected-line counts.';
    renderReceipt(receipt.status === 'fulfilled' ? receipt.value : null, parsed, receipt.status === 'fulfilled');
  } else {
    posts = [];
    loadError = 'The trading ledger could not be loaded. No posts are being substituted.';
    document.getElementById('receipt-summary').textContent = 'Ledger unavailable';
    document.getElementById('receipt-content').replaceChildren(element('p', '', 'Post and media totals cannot be verified until the ledger loads.'));
  }
  tape.setAttribute('aria-busy', 'false');
  render();
}

document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  view = button.dataset.view;
  render();
}));

load();
