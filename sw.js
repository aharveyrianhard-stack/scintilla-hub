/* SCINTILLA · kill-switch service worker.
   Any dock/PWA install left holding a STALE cached service worker will, on its next
   launch, byte-check /sw.js, pick THIS up, wipe every cache, take control, force the
   open window to reload fresh network content, then unregister itself — so the app is
   pure-network forever after. Safe for fresh visitors: the page does NOT register a SW,
   so nobody newly installs this; it only runs to clean up stale registrations. */
self.addEventListener('install', function (e) { self.skipWaiting(); });

self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    } catch (err) {}
    try { await self.clients.claim(); } catch (err) {}
    try {
      var cs = await self.clients.matchAll({ type: 'window' });
      cs.forEach(function (c) { try { c.navigate(c.url); } catch (err) {} });
    } catch (err) {}
    try { await self.registration.unregister(); } catch (err) {}
  })());
});

/* pure passthrough — never serve from cache */
self.addEventListener('fetch', function (e) {
  e.respondWith(fetch(e.request).catch(function () { return new Response('', { status: 504 }); }));
});
