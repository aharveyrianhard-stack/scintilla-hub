import { parseLedger, mediaFor, filterPosts, normalizeReceipt, normalizeNotifications, normalizeSnapshot, snapshotDifference, shouldApplySnapshot, freshness, formatET, youtubeIdFromUrl } from './model.mjs';

const tape = document.getElementById('tape');
const state = document.getElementById('state');
const day = document.getElementById('day');
const dialog = document.getElementById('media-dialog');
const mediaContent = document.getElementById('media-content');
const mediaNote = document.getElementById('media-note');
const closeMedia = document.getElementById('close-media');
const statusLabel = document.getElementById('feed-status');
const refreshButton = document.getElementById('refresh-feed');
const updatesButton = document.getElementById('show-updates');
const receiptDetails = document.getElementById('receipt');
let view = 'trading';
let posts = [];
let ready = false;
let loadError = '';
let mediaTrigger = null;
let notifications = normalizeNotifications(null);
let displayedSnapshot = null;
let latestSnapshot = null;
let pendingSnapshot = null;
let refreshError = '';
let refreshing = false;
let failures = 0;
let pollTimer = null;
let lastCheckedAt = 0;
let stateBeforeMembershipChange = '';

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
    button.addEventListener('click', () => load());
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
  if (mediaTrigger?.isConnected && !tape.hidden) mediaTrigger.focus();
  else document.querySelector('[data-view="' + view + '"]').focus({ preventScroll: true });
  mediaTrigger = null;
});

function mediaButton(post, type, source, photo, number, origin = {}) {
  const button = element('button', 'tile');
  button.type = 'button';
  const title = (origin.original ? 'Original ' + origin.depth + ' · ' : '') + '@' + (origin.handle || post.handle) + ' · ' + (type === 'photo' ? 'Photo ' + number : type === 'youtube' ? 'YouTube video' : 'X video' + (number ? ' ' + number : ''));
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
    const label = (origin.original ? 'ORIGINAL ' + origin.depth + ' · ' : '') + (type === 'youtube' ? 'YOUTUBE' : 'X VIDEO');
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

function originalBlock(source, parent, depth = 1) {
  const block = element('blockquote', 'original');
  const relationship = parent.kind === 'repost' ? 'Reposted post' : parent.kind === 'quote' ? 'Quoted post' : 'Original post';
  const label = relationship + (source.handle ? ' · @' + source.handle : '') + (source.kind && source.kind !== 'original' ? ' · ' + source.kind : '');
  block.append(source.url ? link(source.url, label, 'original-label') : element('span', 'original-label', label));
  if (source.text && source.text !== parent.text) block.append(element('p', '', source.text));
  appendLinks(block, source.links, source);
  if (source.original && depth < 4) block.append(originalBlock(source.original, source, depth + 1));
  else if (source.original_truncated || source.kind === 'quote' || source.kind === 'repost') block.append(element('p', 'original-label', source.original_truncated ? 'Further original content exceeds this capture’s nesting limit.' : 'Further original content is not available in this capture.'));
  return block;
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
    copy.append(originalBlock(post.original, post));
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
      const missing = element('div', 'missing-video', (video.original ? 'Original ' + video.depth + ' video' : 'Video') + ' ' + (index + 1) + ' unresolved');
      missing.append(element('span', '', 'Post retained · playable file not captured'));
      tiles.append(missing);
    }
  });
  media.youtube_videos.forEach(video => tiles.append(mediaButton(post, 'youtube', video.id, null, null, video)));
  media.photos.forEach((photo, index) => tiles.append(mediaButton(post, 'photo', photo.url, photo, index + 1, photo)));
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
  const rows = filterPosts(posts, view, notifications);
  tape.hidden = false;
  tape.replaceChildren();
  tape.setAttribute('aria-label', view === 'video' ? 'Posts with video' : view === 'notifications' ? 'Notification posts' : 'Trading posts');
  document.querySelectorAll('[data-view]').forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle('on', active);
    button.setAttribute('aria-pressed', String(active));
  });
  day.textContent = rows[0] ? formatET(rows[0].created_at, true) + ' · ET' : 'X · Desk';
  if (view === 'notifications' && notifications.status !== 'configured') { setState('Notifications unconfigured. ' + notifications.reason); return; }
  if (loadError) { setState(loadError, true); return; }
  if (!ready) { setState('Loading trading posts…'); return; }
  if (!rows.length) {
    setState(view === 'video' ? 'No video posts have been collected in this ledger.' : view === 'notifications' ? (notifications.handles.length ? 'No collected posts from the notification-enabled trading handles.' : 'No trading handles are configured for Notifications.') : 'No trading posts have been collected in this ledger yet.');
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
  const source = receipt.source_receipt;
  const listSource = source?.source_type === 'x_list_latest_timeline';
  const asCount = value => Number.isSafeInteger(value) && value >= 0 ? String(value) : 'unavailable';
  const captureUnits = source?.coverage?.captured_responses_or_chunks !== undefined ? 'saved responses/chunks' : 'captured pages';
  const captures = source?.coverage?.captured_responses_or_chunks ?? source?.coverage?.captured_pages;
  const scope = listSource ? asCount(captures) + ' ' + captureUnits + ' · ' + asCount(source?.coverage?.observed_posts) + ' window posts' : handles + ' handles queried' + scopeSummary;
  document.getElementById('receipt-summary').textContent = receipt.status.replaceAll('_', ' ') + ' · ' + receipt.posts_kept + ' posts · ' + scope;
  const content = document.getElementById('receipt-content');
  content.replaceChildren();
  const grid = element('dl', 'receipt-grid');
  const counts = [
    [listSource ? 'Source window posts' : 'Handles queried', listSource ? asCount(source?.coverage?.observed_posts) : handles], ['Posts kept', receipt.posts_kept],
    ['Native videos resolved', receipt.videos_resolved], ['Videos still missing', receipt.videos_missing],
    ['YouTube IDs', receipt.youtube_ids], ['Outbound links', receipt.outbound_links],
  ];
  for (const [label, value] of counts) {
    const group = element('div');
    group.append(element('dt', '', label), element('dd', '', String(value)));
    grid.append(group);
  }
  content.append(grid);
  if (listSource) content.append(element('p', '', 'Current list capture: ' + asCount(captures) + ' ' + captureUnits + '. Trading population: ' + asCount(receipt.handles_total) + ' handles.'));
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
  if (!listSource && handleStates.length) content.append(element('p', '', handleStates.map(([label, value]) => label + ': ' + value).join(' · ')));
  if (listSource && raw?.historical_search_coverage) {
    const historical = raw.historical_search_coverage;
    const details = element('details');
    details.append(element('summary', '', 'Historical search capture'));
    details.append(element('p', '', 'Handles queried: ' + asCount(historical.handles_queried) + ' / ' + asCount(receipt.handles_total) + ' · No results: ' + asCount(historical.handles_no_results) + ' · Blocked: ' + asCount(historical.handles_blocked) + ' · Failed: ' + asCount(historical.handles_failed)));
    if (formatET(historical.collected_at)) details.append(element('p', '', 'Historical collection: ' + formatET(historical.collected_at)));
    if (typeof historical.source_completeness === 'string') details.append(element('p', '', historical.source_completeness));
    content.append(details);
  }
  const notes = Array.isArray(receipt.notes) ? receipt.notes.join('\n') : receipt.notes;
  if (notes) content.append(element('p', '', notes));
  if (receipt.limitations.length) content.append(element('p', '', receipt.limitations.join('\n')));
  content.append(element('p', '', 'Collector: ' + receipt.collector_status + (receipt.collector_error ? ' · ' + receipt.collector_error : '')));
  if (receipt.collector_status === 'error' && receipt.collector_retry_at) content.append(element('p', '', 'Collector retry time: ' + formatET(receipt.collector_retry_at)));
  content.append(element('p', '', 'Collector heartbeat: ' + (receipt.collector_heartbeat_at ? formatET(receipt.collector_heartbeat_at) : 'unavailable')));
  content.append(element('p', '', 'Latest source event: ' + (receipt.latest_source_event_at ? formatET(receipt.latest_source_event_at) : 'unavailable')));
  content.append(element('p', '', notifications.status === 'configured' ? 'Notifications: ' + notifications.handles.length + ' trading handles enabled.' : 'Notifications unconfigured. ' + notifications.reason));
  if (notifications.source) content.append(element('p', '', 'Notification membership source: ' + notifications.source));
  if (notifications.updated_at) content.append(element('p', '', 'Notification membership updated ' + formatET(notifications.updated_at)));
  if (parsed.invalid) content.append(element('p', '', parsed.invalid + ' invalid ledger lines excluded from this view.'));
  if (parsed.duplicates) content.append(element('p', '', parsed.duplicates + ' older post versions replaced by the latest valid ledger entry.'));
}

async function fetchFile(path, format, { cache = 'no-store' } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(path, { cache, signal: controller.signal });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return await (format === 'json' ? response.json() : response.text());
  } finally { clearTimeout(timeout); }
}

function membershipKey(membership) {
  return membership.status + ':' + [...membership.handles].sort().join(',');
}

function updateStatus() {
  const status = freshness({ source: latestSnapshot?.source, receipt: latestSnapshot?.receipt, error: refreshError, refreshing });
  if (statusLabel.textContent !== status.text) statusLabel.textContent = status.text;
  statusLabel.dataset.state = status.state;
  statusLabel.title = refreshError || latestSnapshot?.receipt.collector_error || '';
  refreshButton.disabled = refreshing;
  refreshButton.textContent = refreshing ? 'Checking…' : 'Refresh';
  updatesButton.hidden = !pendingSnapshot;
  if (pendingSnapshot) {
    const changes = snapshotDifference(posts, pendingSnapshot.parsed.posts);
    const relevant = filterPosts(changes.added, view, pendingSnapshot.notifications).length;
    updatesButton.textContent = relevant ? 'Show ' + relevant + ' new post' + (relevant === 1 ? '' : 's') : 'Show feed updates';
  }
  const membershipPending = view === 'notifications' && pendingSnapshot && membershipKey(notifications) !== membershipKey(pendingSnapshot.notifications);
  if (membershipPending) {
    if (!tape.hidden) stateBeforeMembershipChange = state.hidden ? '' : state.textContent;
    tape.hidden = true;
    setState(pendingSnapshot.notifications.status === 'unconfigured' ? 'Notifications unconfigured. ' + pendingSnapshot.notifications.reason : 'Notification membership changed. Show feed updates to load the confirmed subset.');
  } else if (tape.hidden) {
    tape.hidden = false;
    setState(stateBeforeMembershipChange);
  }
}

function updateReceipt() {
  if (displayedSnapshot && !receiptDetails.open) renderReceipt(displayedSnapshot.rawReceipt, displayedSnapshot.parsed, displayedSnapshot.receiptAvailable !== false);
}

function applySnapshot(snapshot, { scrollToTop = false } = {}) {
  displayedSnapshot = snapshot;
  posts = snapshot.parsed.posts;
  notifications = snapshot.notifications;
  pendingSnapshot = null;
  ready = true;
  loadError = '';
  render();
  renderReceipt(snapshot.rawReceipt, snapshot.parsed, snapshot.receiptAvailable !== false);
  updateStatus();
  if (scrollToTop) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.querySelector('[data-view="' + view + '"]').focus({ preventScroll: true });
  }
}

function acceptSnapshot(snapshot) {
  const changes = snapshotDifference(posts, snapshot.parsed.posts);
  if (ready && changes.removed.length) throw new Error('The latest snapshot omitted previously loaded posts; the current feed was retained.');
  latestSnapshot = snapshot;
  const membershipChanged = membershipKey(notifications) !== membershipKey(snapshot.notifications);
  if (!ready) { applySnapshot(snapshot); return; }
  if (!changes.changed && !membershipChanged) {
    pendingSnapshot = null;
    displayedSnapshot = { ...snapshot, parsed: { ...snapshot.parsed, posts } };
    notifications = snapshot.notifications;
    updateReceipt();
    updateStatus();
    return;
  }
  pendingSnapshot = snapshot;
  const canApply = shouldApplySnapshot({
    atTop: window.scrollY <= 24,
    mediaOpen: dialog.open,
    focusedInTape: tape.contains(document.activeElement),
    selectingText: !!window.getSelection()?.toString(),
    receiptOpen: receiptDetails.open,
  });
  if (canApply) applySnapshot(snapshot);
  else updateStatus();
}

async function loadStaticSnapshot() {
  const [ledger, receipt] = await Promise.allSettled([
    fetchFile('./data/ledger.jsonl', 'text'), fetchFile('./data/receipt.json', 'json'),
  ]);
  if (ledger.status !== 'fulfilled') throw ledger.reason;
  const parsed = parseLedger(ledger.value);
  if (!parsed.posts.length && parsed.invalid) throw new Error('No valid posts could be read from the static ledger.');
  const rawReceipt = { ...(receipt.status === 'fulfilled' ? receipt.value : {}), collector_status: 'unconfigured', collector_error: 'The live feed could not be reached. This is a saved static snapshot.' };
  return { source: 'static', parsed, rawReceipt, receipt: normalizeReceipt(rawReceipt, parsed.posts), notifications: normalizeNotifications(null), receiptAvailable: receipt.status === 'fulfilled' };
}

function schedulePoll() {
  clearTimeout(pollTimer);
  if (document.visibilityState === 'hidden') return;
  const delay = Math.min(120000, 30000 * 2 ** Math.min(failures, 2));
  pollTimer = setTimeout(() => load(), delay);
}

async function load() {
  if (refreshing) return;
  clearTimeout(pollTimer);
  refreshing = true;
  if (!ready) { loadError = ''; tape.setAttribute('aria-busy', 'true'); render(); }
  updateStatus();
  try {
    // The API's no-store redirect stays fresh; its immutable target can use the browser cache.
    const snapshot = normalizeSnapshot(await fetchFile('/api/xfeed', 'json', { cache: 'default' }));
    snapshot.source = 'api';
    refreshError = '';
    acceptSnapshot(snapshot);
    failures = 0;
  } catch (error) {
    failures++;
    refreshError = error.name === 'AbortError' ? 'The feed request timed out.' : 'The live feed could not be refreshed. ' + error.message;
    if (!ready) {
      try { acceptSnapshot(await loadStaticSnapshot()); }
      catch {
        loadError = 'The live feed and saved ledger could not be loaded. No posts are being substituted.';
        document.getElementById('receipt-summary').textContent = 'Feed unavailable';
        document.getElementById('receipt-content').replaceChildren(element('p', '', 'Post and media totals cannot be verified until a snapshot loads.'));
        render();
      }
    }
  } finally {
    refreshing = false;
    lastCheckedAt = Date.now();
    tape.setAttribute('aria-busy', 'false');
    updateStatus();
    schedulePoll();
  }
}

document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  view = button.dataset.view;
  if (pendingSnapshot) applySnapshot(pendingSnapshot, { scrollToTop: true });
  else { render(); updateStatus(); window.scrollTo({ top: 0, behavior: 'instant' }); }
}));

refreshButton.addEventListener('click', () => load());
updatesButton.addEventListener('click', () => { if (pendingSnapshot) applySnapshot(pendingSnapshot, { scrollToTop: true }); });
receiptDetails.addEventListener('toggle', () => {
  if (receiptDetails.open && displayedSnapshot) renderReceipt(displayedSnapshot.rawReceipt, displayedSnapshot.parsed, displayedSnapshot.receiptAvailable !== false);
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') clearTimeout(pollTimer);
  else if (Date.now() - lastCheckedAt >= 10000) load();
  else schedulePoll();
});
window.addEventListener('online', () => load());
setInterval(updateStatus, 15000);
load();
